/**
 * Rotate the DriftIntegrator treasury (owner-only).
 *
 *   npm run contract:set-treasury -- 0xNewTreasury [--network base]
 *
 * Signs with PRIVATE_KEY (the contract owner — `owner` is immutable, so this is
 * the only admin the deployer key keeps). Prints the tx and the new treasury.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Contract, JsonRpcProvider, Wallet, isAddress } from 'ethers';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const mainnet = args.includes('--network') && args[args.indexOf('--network') + 1] === 'base';
const newTreasury = args.find((a) => a.startsWith('0x'));

if (!newTreasury || !isAddress(newTreasury)) {
  console.error('Usage: npm run contract:set-treasury -- 0xNewTreasury [--network base]');
  process.exit(1);
}
const pk = process.env.PRIVATE_KEY;
if (!pk) {
  console.error('PRIVATE_KEY missing');
  process.exit(1);
}

const file = path.join(here, 'deployments', mainnet ? 'base.json' : 'baseSepolia.json');
const deployment = JSON.parse(await readFile(file, 'utf8')) as { address: string; chainId: number; owner: string };
const rpc = mainnet ? process.env.BASE_RPC ?? 'https://mainnet.base.org' : process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org';

const provider = new JsonRpcProvider(rpc);
const wallet = new Wallet(pk, provider);
const abi = [
  'function owner() view returns (address)',
  'function treasury() view returns (address)',
  'function setTreasury(address _treasury)',
];
const integrator = new Contract(deployment.address, abi, wallet);

const [{ chainId }, owner, before] = await Promise.all([provider.getNetwork(), integrator.owner(), integrator.treasury()]);
if (Number(chainId) !== deployment.chainId) throw new Error(`RPC chain ${chainId} ≠ deployment chain ${deployment.chainId}`);
if (owner.toLowerCase() !== wallet.address.toLowerCase()) throw new Error(`PRIVATE_KEY is ${wallet.address}, but the owner is ${owner}`);
console.log(`Integrator ${deployment.address} (chain ${chainId})`);
console.log(`treasury: ${before} → ${newTreasury}`);
if (before.toLowerCase() === newTreasury.toLowerCase()) {
  console.log('Already set — nothing to do.');
  process.exit(0);
}

const tx = await integrator.setTreasury(newTreasury);
console.log(`tx ${tx.hash} — waiting…`);
await tx.wait(1);
const after = await integrator.treasury();
console.log(`✔ treasury is now ${after}`);
console.log(`Update DRIFT_TREASURY_ADDRESS=${after} wherever the backend runs.`);
