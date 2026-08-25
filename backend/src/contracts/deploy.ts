/**
 * Deploy DriftIntegrator to Base Sepolia (or Base mainnet).
 *
 * Compiles src/contracts/DriftIntegrator.sol with solc-js (same settings as
 * the upstream payment-integrators repo: 0.8.28, cancun, viaIR, optimizer 200)
 * and deploys it with ethers v6. No Hardhat needed.
 *
 * Usage (from backend/):
 *   PRIVATE_KEY=0x... npx tsx src/contracts/deploy.ts
 *   PRIVATE_KEY=0x... npx ts-node --esm src/contracts/deploy.ts   # if you prefer ts-node
 *   npm run deploy:contract                                        # reads backend/.env
 *
 * Flags:
 *   --compile-only   compile and write the artifact, don't touch the network
 *   --network base   deploy to Base mainnet instead of Base Sepolia
 *
 * Env (backend/.env or inline):
 *   PRIVATE_KEY               deployer key (becomes the contract owner)
 *   P2P_DIAMOND_ADDRESS       P2P Diamond for the target network (required)
 *   DRIFT_TREASURY_ADDRESS    treasury that receives USDC (required)
 *   USDC_ADDRESS              optional override; defaults per network
 *   BASE_SEPOLIA_RPC / BASE_RPC   optional RPC overrides
 */
import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ethers } from 'ethers';

const require = createRequire(import.meta.url);
// solc-js has no ESM types; load via require.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const solc = require('solc');

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '../..');
const nodeModules = path.resolve(backendRoot, '../node_modules');

// ─── Networks ─────────────────────────────────────────────────────────
const NETWORKS = {
  baseSepolia: {
    name: 'Base Sepolia',
    chainId: 84532n,
    rpc: process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Circle USDC (testnet)
    explorer: 'https://sepolia.basescan.org',
  },
  base: {
    name: 'Base',
    chainId: 8453n,
    rpc: process.env.BASE_RPC ?? 'https://mainnet.base.org',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Circle USDC (native)
    explorer: 'https://basescan.org',
  },
} as const;
type NetworkKey = keyof typeof NETWORKS;

const args = process.argv.slice(2);
const compileOnly = args.includes('--compile-only');
const netIdx = args.indexOf('--network');
const networkKey = (netIdx >= 0 ? args[netIdx + 1] : 'baseSepolia') as NetworkKey;
const net = NETWORKS[networkKey];
if (!net) {
  console.error(`Unknown --network "${networkKey}". Use: ${Object.keys(NETWORKS).join(' | ')}`);
  process.exit(1);
}

// ─── Compile ──────────────────────────────────────────────────────────
function findImports(importPath: string): { contents: string } | { error: string } {
  const candidates = [
    path.resolve(here, importPath), // ./p2p/...
    path.resolve(nodeModules, importPath), // @openzeppelin/...
  ];
  for (const c of candidates) {
    if (existsSync(c)) return { contents: readFileSync(c, 'utf8') };
  }
  return { error: `File not found: ${importPath}` };
}

function compile() {
  const source = readFileSync(path.join(here, 'DriftIntegrator.sol'), 'utf8');
  const input = {
    language: 'Solidity',
    sources: { 'DriftIntegrator.sol': { content: source } },
    settings: {
      evmVersion: 'cancun', // UserProxy uses `transient` storage (EIP-1153)
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
    },
  };

  console.log(`▶ compiling DriftIntegrator.sol with solc ${solc.version()} …`);
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  const errors = (output.errors ?? []) as Array<{ severity: string; formattedMessage: string }>;
  for (const e of errors.filter((e) => e.severity === 'warning')) console.warn(e.formattedMessage);
  const fatal = errors.filter((e) => e.severity === 'error');
  if (fatal.length) {
    for (const e of fatal) console.error(e.formattedMessage);
    throw new Error(`${fatal.length} compile error(s)`);
  }

  const contract = output.contracts['DriftIntegrator.sol'].DriftIntegrator;
  const artifact = {
    contractName: 'DriftIntegrator',
    compiler: { version: solc.version(), evmVersion: 'cancun', viaIR: true, optimizerRuns: 200 },
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object,
    deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
  };

  const artifactsDir = path.join(here, 'artifacts');
  mkdirSync(artifactsDir, { recursive: true });
  const artifactPath = path.join(artifactsDir, 'DriftIntegrator.json');
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log(`✔ artifact written to ${path.relative(backendRoot, artifactPath)}`);
  console.log(`  bytecode: ${(artifact.bytecode.length - 2) / 2} bytes`);
  return artifact;
}

// ─── Deploy ───────────────────────────────────────────────────────────
async function deploy(artifact: ReturnType<typeof compile>) {
  const pk = process.env.PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
  const diamond = process.env.P2P_DIAMOND_ADDRESS;
  const treasury = process.env.DRIFT_TREASURY_ADDRESS;
  const usdc = process.env.USDC_ADDRESS ?? net.usdc;

  const missing = [
    !pk && 'PRIVATE_KEY',
    !diamond && 'P2P_DIAMOND_ADDRESS',
    !treasury && 'DRIFT_TREASURY_ADDRESS',
  ].filter(Boolean);
  if (missing.length) {
    console.error(`❌ missing env: ${missing.join(', ')}`);
    console.error('   e.g.  PRIVATE_KEY=0x… P2P_DIAMOND_ADDRESS=0x… DRIFT_TREASURY_ADDRESS=0x… npx tsx src/contracts/deploy.ts');
    process.exit(1);
  }
  for (const [label, addr] of [['P2P_DIAMOND_ADDRESS', diamond], ['DRIFT_TREASURY_ADDRESS', treasury], ['USDC_ADDRESS', usdc]] as const) {
    if (!ethers.isAddress(addr)) {
      console.error(`❌ ${label} is not a valid address: ${addr}`);
      process.exit(1);
    }
  }

  const provider = new ethers.JsonRpcProvider(net.rpc);
  const chain = await provider.getNetwork();
  if (chain.chainId !== net.chainId) {
    throw new Error(`RPC ${net.rpc} is chain ${chain.chainId}, expected ${net.chainId} (${net.name})`);
  }
  const wallet = new ethers.Wallet(pk!, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log('');
  console.log(`Network:   ${net.name} (chainId ${net.chainId})`);
  console.log(`RPC:       ${net.rpc}`);
  console.log(`Deployer:  ${wallet.address}  (${ethers.formatEther(balance)} ETH)`);
  console.log(`USDC:      ${usdc}`);
  console.log(`Diamond:   ${diamond}`);
  console.log(`Treasury:  ${treasury}`);
  console.log('');

  if (balance === 0n) {
    throw new Error('Deployer has 0 ETH — fund it first (see backend/DEPLOY.md → Gas).');
  }

  // Sanity: the Diamond and USDC must be contracts on this chain.
  for (const [label, addr] of [['Diamond', diamond!], ['USDC', usdc]] as const) {
    const code = await provider.getCode(addr);
    if (code === '0x') throw new Error(`${label} address ${addr} has no code on ${net.name}`);
  }

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log('▶ deploying DriftIntegrator(usdc, diamond, treasury) …');
  const contract = await factory.deploy(usdc, diamond, treasury);
  const tx = contract.deploymentTransaction()!;
  console.log(`  tx: ${net.explorer}/tx/${tx.hash}`);
  await tx.wait(2);

  const address = await contract.getAddress();
  const proxyImpl: string = await (contract as any).proxyImpl();
  const runtime = await provider.getCode(address);

  console.log('');
  console.log('=== DriftIntegrator deployed ===');
  console.log(`Address:        ${address}`);
  console.log(`Explorer:       ${net.explorer}/address/${address}`);
  console.log(`proxyImpl:      ${proxyImpl}`);
  console.log(`Owner:          ${wallet.address}`);
  console.log(`Bytecode hash:  ${ethers.keccak256(runtime)}`);
  console.log(`MAX_TX_USDC:    5000 USDC   DAILY_TX_LIMIT: 10 / user / day`);
  console.log('');

  const deploymentsDir = path.join(here, 'deployments');
  mkdirSync(deploymentsDir, { recursive: true });
  const record = {
    network: networkKey,
    chainId: Number(net.chainId),
    address,
    proxyImpl,
    owner: wallet.address,
    usdc,
    diamond,
    treasury,
    txHash: tx.hash,
    bytecodeHash: ethers.keccak256(runtime),
    deployedAt: new Date().toISOString(),
  };
  const recordPath = path.join(deploymentsDir, `${networkKey}.json`);
  writeFileSync(recordPath, JSON.stringify(record, null, 2));
  console.log(`✔ saved ${path.relative(backendRoot, recordPath)}`);
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Add to backend/.env:  DRIFT_INTEGRATOR_ADDRESS=${address}`);
  console.log(`  2. Verify source on Basescan (see DEPLOY.md → Verify).`);
  console.log(`  3. Open a whitelist request with P2P: integrator=${address}, proxyImpl=${proxyImpl},`);
  console.log(`     usdcThroughIntegrator=true. Nothing works until the Diamond registers you.`);
}

// ─── Main ─────────────────────────────────────────────────────────────
try {
  const artifact = compile();
  if (compileOnly) {
    console.log('--compile-only: skipping deploy');
  } else {
    await deploy(artifact);
  }
} catch (err) {
  console.error('');
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
}
