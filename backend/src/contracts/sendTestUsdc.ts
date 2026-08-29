/**
 * Test helper (Base Sepolia only): move test USDC from the PRIVATE_KEY wallet
 * to another address, e.g. to fund a guest wallet before trying "Pay with USDC".
 *
 *   npm run contract:send-test-usdc -- 0xRecipient 900
 */
import 'dotenv/config';
import { Contract, JsonRpcProvider, Wallet, isAddress, parseUnits, formatUnits } from 'ethers';

const [to, amount] = process.argv.slice(2);
if (!to || !isAddress(to) || !amount) {
  console.error('Usage: npm run contract:send-test-usdc -- 0xRecipient <amount>');
  process.exit(1);
}
const pk = process.env.PRIVATE_KEY;
const token = process.env.USDC_ADDRESS ?? '0x4095fE4f1E636f11A95820BA2bB87F335Bd1040d';
if (!pk) {
  console.error('PRIVATE_KEY missing');
  process.exit(1);
}
const provider = new JsonRpcProvider(process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org');
const { chainId } = await provider.getNetwork();
if (Number(chainId) !== 84532) throw new Error(`Refusing: RPC is chain ${chainId}, this helper is for Base Sepolia (84532) only`);
const wallet = new Wallet(pk, provider);
const erc20 = new Contract(
  token,
  ['function decimals() view returns (uint8)', 'function symbol() view returns (string)', 'function balanceOf(address) view returns (uint256)', 'function transfer(address,uint256) returns (bool)'],
  wallet,
);
const [decimals, symbol, balance] = await Promise.all([erc20.decimals(), erc20.symbol(), erc20.balanceOf(wallet.address)]);
const units = parseUnits(amount, decimals);
console.log(`${wallet.address} holds ${formatUnits(balance, decimals)} ${symbol}; sending ${amount} to ${to}`);
if (balance < units) throw new Error('Not enough balance');
const tx = await erc20.transfer(to, units);
console.log(`tx ${tx.hash} — waiting…`);
await tx.wait(1);
console.log(`✔ sent. ${to} now holds ${formatUnits(await erc20.balanceOf(to), decimals)} ${symbol}`);
