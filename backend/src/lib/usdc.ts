/**
 * On-chain verification of a direct USDC payment.
 *
 * The client sends the hash of an ERC-20 transfer it made to the treasury;
 * nothing about the booking is settled until the receipt on Base proves a
 * `Transfer(from, to, value)` of the configured token with
 *   to    == DRIFT_TREASURY_ADDRESS
 *   value == the payment amount (in token units)
 *   from  == the guest's wallet, when we know it
 *
 * Failures are typed so the API can tell "not mined yet — poll again" from
 * "this transaction does not pay for this booking".
 */
import { Contract, Interface, JsonRpcProvider, getAddress, isAddress } from 'ethers';
import { env } from '../config/env.js';

export type UsdcVerifyCode =
  | 'not_mined' // unknown to the node yet, or still pending → retry
  | 'reverted'
  | 'no_transfer' // mined, but no Transfer of the configured token in it
  | 'wrong_recipient'
  | 'wrong_amount'
  | 'wrong_sender';

export class UsdcVerifyError extends Error {
  constructor(
    public readonly code: UsdcVerifyCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'UsdcVerifyError';
  }
}

const TRANSFER = new Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);

export const isUsdcConfigured = () => isAddress(env.USDC_ADDRESS) && isAddress(env.DRIFT_TREASURY_ADDRESS);

let provider: JsonRpcProvider | null = null;
const getProvider = () => (provider ??= new JsonRpcProvider(env.BASE_SEPOLIA_RPC));

let decimalsPromise: Promise<number> | null = null;
/** Token decimals, read once from the contract. */
export function usdcDecimals(): Promise<number> {
  return (decimalsPromise ??= new Contract(env.USDC_ADDRESS, ['function decimals() view returns (uint8)'], getProvider())
    .decimals()
    .then((d: bigint) => Number(d))
    .catch((err: unknown) => {
      decimalsPromise = null;
      throw err;
    }));
}

/** "950.00" → 950_000_000n at 6 decimals, without going through floats. */
export function amountToUnits(amount: string | number, decimals: number): bigint {
  const [whole, frac = ''] = String(amount).split('.');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((frac + '0'.repeat(decimals)).slice(0, decimals));
}

export function unitsToAmount(units: bigint, decimals: number): string {
  const s = units.toString().padStart(decimals + 1, '0');
  return `${s.slice(0, -decimals)}.${s.slice(-decimals)}`.replace(/\.?0+$/, '');
}

export interface VerifiedTransfer {
  from: string;
  to: string;
  value: bigint;
  blockNumber: number;
  confirmations: number;
}

/**
 * Throws UsdcVerifyError unless `txHash` is a mined, successful transaction
 * containing a Transfer of exactly `amountUsdc` of the configured token to the
 * treasury (from `expectedFrom` when given).
 */
export async function verifyUsdcTransfer(opts: {
  txHash: string;
  amountUsdc: string | number;
  expectedFrom?: string | null;
}): Promise<VerifiedTransfer> {
  const rpc = getProvider();
  const token = getAddress(env.USDC_ADDRESS);
  const treasury = getAddress(env.DRIFT_TREASURY_ADDRESS);
  const expectedFrom = opts.expectedFrom && isAddress(opts.expectedFrom) ? getAddress(opts.expectedFrom) : null;

  const receipt = await rpc.getTransactionReceipt(opts.txHash);
  if (!receipt) {
    const pending = await rpc.getTransaction(opts.txHash);
    throw new UsdcVerifyError(
      'not_mined',
      pending ? 'Transaction is pending — not mined yet' : 'Transaction not found on the network yet',
      true,
    );
  }
  if (receipt.status !== 1) throw new UsdcVerifyError('reverted', 'Transaction reverted');

  const transfers = receipt.logs
    .filter((log) => getAddress(log.address) === token)
    .map((log) => {
      try {
        return TRANSFER.parseLog({ topics: [...log.topics], data: log.data });
      } catch {
        return null;
      }
    })
    .filter((l): l is NonNullable<typeof l> => l !== null && l.name === 'Transfer')
    .map((l) => ({ from: getAddress(l.args.from), to: getAddress(l.args.to), value: BigInt(l.args.value) }));

  if (transfers.length === 0) throw new UsdcVerifyError('no_transfer', 'No USDC transfer in this transaction');

  const toTreasury = transfers.filter((t) => t.to === treasury);
  if (toTreasury.length === 0) {
    throw new UsdcVerifyError('wrong_recipient', `USDC went to ${transfers[0].to}, not to Drift's treasury`);
  }

  const fromGuest = expectedFrom ? toTreasury.filter((t) => t.from === expectedFrom) : toTreasury;
  if (fromGuest.length === 0) {
    throw new UsdcVerifyError('wrong_sender', `Transfer was sent from ${toTreasury[0].from}, not from your wallet`);
  }

  const decimals = await usdcDecimals();
  const expected = amountToUnits(opts.amountUsdc, decimals);
  const value = fromGuest.reduce((sum, t) => sum + t.value, 0n);
  if (value !== expected) {
    throw new UsdcVerifyError(
      'wrong_amount',
      `Transfer is ${unitsToAmount(value, decimals)} USDC, expected ${unitsToAmount(expected, decimals)}`,
    );
  }

  const latest = await rpc.getBlockNumber();
  return {
    from: fromGuest[0].from,
    to: treasury,
    value,
    blockNumber: receipt.blockNumber,
    confirmations: Math.max(1, latest - receipt.blockNumber + 1),
  };
}
