/**
 * Verify DriftIntegrator source on Basescan (Etherscan API v2).
 *
 *   npm run verify:contract                 # Base Sepolia, address from deployments/baseSepolia.json
 *   npm run verify:contract -- --network base
 *   npm run verify:contract -- --address 0x…   # override
 *
 * Steps:
 *   1. Build the solc standard-JSON with every source (contract, p2p/, OpenZeppelin)
 *      and the exact deploy settings (0.8.28, cancun, viaIR, optimizer 200).
 *   2. Compile locally and compare runtime bytecode with the on-chain code.
 *      On mismatch: print the settings/metadata diff and STOP (nothing is submitted).
 *   3. Submit to Etherscan v2, poll until verified, confirm with getsourcecode.
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { AbiCoder, JsonRpcProvider, keccak256 } from 'ethers';

const require = createRequire(import.meta.url);
const solc = require('solc');

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '../..');
const nodeModules = path.resolve(backendRoot, '../node_modules');

const NETWORKS = {
  baseSepolia: { chainId: 84532, rpc: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org', explorer: 'https://sepolia.basescan.org' },
  base: { chainId: 8453, rpc: process.env.BASE_RPC || 'https://mainnet.base.org', explorer: 'https://basescan.org' },
} as const;
type NetworkKey = keyof typeof NETWORKS;

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const networkKey = (flag('--network') ?? 'baseSepolia') as NetworkKey;
const net = NETWORKS[networkKey];
if (!net) { console.error(`Unknown --network ${networkKey}`); process.exit(1); }

const apiKey = process.env.ETHERSCAN_API_KEY;
if (!apiKey) { console.error('❌ ETHERSCAN_API_KEY missing in backend/.env'); process.exit(1); }

const record = JSON.parse(readFileSync(path.join(here, 'deployments', `${networkKey}.json`), 'utf8'));
const address: string = flag('--address') ?? record.address;
const ctorArgs = [record.usdc, record.diamond, record.treasury];

// ─── 1. Collect sources (resolve imports the way solc names source units) ──
const SETTINGS = { evmVersion: 'cancun', viaIR: true, optimizer: { enabled: true, runs: 200 } };
const MAIN = 'DriftIntegrator.sol';

function locate(unit: string): string {
  for (const c of [path.join(here, unit), path.join(nodeModules, unit)]) if (existsSync(c)) return c;
  throw new Error(`Cannot locate source unit ${unit}`);
}
function resolveUnit(importer: string, spec: string): string {
  return spec.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(importer), spec)) : spec;
}
const sources: Record<string, { content: string }> = {};
(function collect(unit: string) {
  if (sources[unit]) return;
  const content = readFileSync(locate(unit), 'utf8');
  sources[unit] = { content };
  for (const m of content.matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) collect(resolveUnit(unit, m[1]));
})(MAIN);

const input = {
  language: 'Solidity',
  sources,
  settings: { ...SETTINGS, outputSelection: { '*': { '*': ['abi', 'evm.deployedBytecode.object', 'evm.deployedBytecode.immutableReferences', 'metadata'] } } },
};
console.log(`▶ ${Object.keys(sources).length} source units:`, Object.keys(sources).join(', '));

// ─── 2. Compile locally and compare with on-chain runtime ──────────────
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const fatal = (out.errors ?? []).filter((e: any) => e.severity === 'error');
if (fatal.length) { fatal.forEach((e: any) => console.error(e.formattedMessage)); process.exit(1); }
const c = out.contracts[MAIN].DriftIntegrator;
const local = '0x' + c.evm.deployedBytecode.object;
const compilerVersion = 'v' + solc.version().replace('.Emscripten.clang', '');

const provider = new JsonRpcProvider(net.rpc);
const onchain = await provider.getCode(address);
if (onchain === '0x') { console.error(`❌ no code at ${address} on ${networkKey}`); process.exit(1); }

// Immutables are baked into runtime code at deploy time; mask them for the comparison.
const immRefs: Record<string, { start: number; length: number }[]> = c.evm.deployedBytecode.immutableReferences ?? {};
function mask(hex: string) {
  const b = Buffer.from(hex.slice(2), 'hex');
  for (const refs of Object.values(immRefs)) for (const r of refs) b.fill(0, r.start, r.start + r.length);
  return '0x' + b.toString('hex');
}
// Report where the raw bytes differ, so a mismatch is explainable (immutable slots vs real drift).
const diffRanges: [number, number][] = [];
{
  const a = Buffer.from(local.slice(2), 'hex'), b = Buffer.from(onchain.slice(2), 'hex');
  let start = -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = a[i] !== b[i];
    if (d && start < 0) start = i;
    if (!d && start >= 0) { diffRanges.push([start, i]); start = -1; }
  }
  if (start >= 0) diffRanges.push([start, Math.max(a.length, b.length)]);
}
const immRanges = Object.values(immRefs).flat().map((r) => [r.start, r.start + r.length] as [number, number]);
console.log(`▶ immutable slots (${immRanges.length}):`, immRanges.map(([s, e]) => `${s}-${e}`).join(' '));
console.log(`▶ raw byte diffs (${diffRanges.length}):`, diffRanges.map(([s, e]) => `${s}-${e}`).join(' ') || 'none');
const same = mask(local) === mask(onchain);
console.log(`▶ runtime bytecode ${same ? 'MATCHES' : 'DIFFERS'} (local ${(local.length - 2) / 2} B, on-chain ${(onchain.length - 2) / 2} B, keccak on-chain ${keccak256(onchain)})`);
if (!same) {
  const meta = JSON.parse(c.metadata);
  console.error('\n❌ Local build does not reproduce the deployed bytecode — NOT submitting.');
  console.error('   Local settings :', JSON.stringify({ compiler: meta.compiler.version, ...meta.settings.optimizer, evmVersion: meta.settings.evmVersion, viaIR: meta.settings.viaIR }));
  console.error('   Deployed record:', JSON.stringify(record.bytecodeHash ? { bytecodeHash: record.bytecodeHash } : {}));
  // CBOR metadata tail carries the IPFS hash + solc version of the deployed build
  const tail = (h: string) => h.slice(-2 * (parseInt(h.slice(-4), 16) + 2));
  console.error('   metadata tail local   :', tail(local));
  console.error('   metadata tail on-chain:', tail(onchain));
  process.exit(2);
}

// ─── 3. Submit to Etherscan v2 ─────────────────────────────────────────
const api = `https://api.etherscan.io/v2/api?chainid=${net.chainId}`;
const ctorEncoded = AbiCoder.defaultAbiCoder().encode(['address', 'address', 'address'], ctorArgs).slice(2);

async function call(params: Record<string, string>, method: 'GET' | 'POST' = 'GET') {
  const body = new URLSearchParams({ apikey: apiKey!, ...params });
  const res = method === 'POST'
    ? await fetch(api, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
    : await fetch(`${api}&${body}`);
  return res.json() as Promise<{ status: string; message: string; result: any }>;
}

const already = await call({ module: 'contract', action: 'getsourcecode', address });
if (already.result?.[0]?.SourceCode) {
  console.log(`✔ already verified as ${already.result[0].ContractName} (${already.result[0].CompilerVersion})`);
} else {
  console.log(`▶ submitting to Etherscan v2 (chainid ${net.chainId}) as ${compilerVersion} …`);
  const sub = await call({
    module: 'contract', action: 'verifysourcecode',
    contractaddress: address,
    sourceCode: JSON.stringify(input),
    codeformat: 'solidity-standard-json-input',
    contractname: `${MAIN}:DriftIntegrator`,
    compilerversion: compilerVersion,
    constructorArguements: ctorEncoded,
  }, 'POST');
  if (sub.status !== '1') { console.error('❌ submit failed:', sub.message, sub.result); process.exit(1); }
  const guid = sub.result as string;
  console.log(`  guid ${guid} — polling…`);
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await call({ module: 'contract', action: 'checkverifystatus', guid });
    const msg = String(st.result);
    if (/pending/i.test(msg)) { process.stdout.write('.'); continue; }
    console.log('\n  result:', msg);
    if (st.status !== '1') process.exit(1);
    break;
  }
}

const confirm = await call({ module: 'contract', action: 'getsourcecode', address });
const info = confirm.result?.[0] ?? {};
console.log('\n=== Basescan record ===');
console.log('ContractName:   ', info.ContractName);
console.log('CompilerVersion:', info.CompilerVersion);
console.log('OptimizationUsed/Runs:', info.OptimizationUsed, '/', info.Runs, ' EVMVersion:', info.EVMVersion);
console.log('ABI present:    ', Boolean(info.ABI && info.ABI !== 'Contract source code not verified'));
console.log(`URL:             ${net.explorer}/address/${address}#code`);
