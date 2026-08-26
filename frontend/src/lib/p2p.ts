/**
 * p2pkit / DriftIntegrator configuration for the frontend.
 *
 * All addresses come from env so the same code runs against Base Sepolia
 * (default) and Base mainnet. See frontend/.env.example.
 */
import type { CurrencyOption } from '@p2pdotme/widgets';

type Hex = `0x${string}`;

const env = import.meta.env;
const addr = (v: string | undefined, fallback?: Hex): Hex | undefined =>
  v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Hex) : fallback;

export const P2P = {
  /** Base Sepolia. The widget defaults to this too. */
  chainId: 84532,
  /** DriftIntegrator (backend/src/contracts/DriftIntegrator.sol). */
  integrator: addr(env.VITE_DRIFT_INTEGRATOR_ADDRESS),
  /** P2P Diamond on Base Sepolia (the widget's built-in default). */
  diamond: addr(env.VITE_P2P_DIAMOND_ADDRESS, '0xeb0BB8E3c014D915D9B2df03aBB130a1Fb44beb9')!,
  /** USDC the Diamond settles in — P2P's *test* USDC on Sepolia, not Circle's. */
  usdc: addr(env.VITE_USDC_ADDRESS, '0x4095fE4f1E636f11A95820BA2bB87F335Bd1040d')!,
  /** Subgraph used by the widget to auto-pick a merchant circle. */
  subgraphUrl: env.VITE_P2P_SUBGRAPH_URL || undefined,
  /** Pinned BRL circle when no subgraph is configured. */
  brlCircleId: env.VITE_P2P_BRL_CIRCLE_ID ? BigInt(env.VITE_P2P_BRL_CIRCLE_ID) : undefined,
  /** Demo mode: widget fakes the on-chain lifecycle. */
  demo: env.VITE_P2P_DEMO === 'true',
} as const;

/** Drift only sells in Brazil → BRL via PIX. */
export const CURRENCIES: CurrencyOption[] = [
  {
    symbol: 'BRL',
    flag: '🇧🇷',
    paymentMethod: 'PIX',
    ...(P2P.brlCircleId !== undefined ? { circleId: P2P.brlCircleId } : {}),
  },
];

/** Can the widget route an order? Either a subgraph or a pinned circle is needed. */
export const routingConfigured = Boolean(P2P.subgraphUrl || P2P.brlCircleId !== undefined);

/** `bookTrip` entry point of DriftIntegrator — the only function the frontend calls. */
export const DRIFT_INTEGRATOR_ABI = [
  {
    name: 'bookTrip',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'bookingId', type: 'bytes32' },
      { name: 'amountUsdc', type: 'uint256' },
      { name: 'currency', type: 'bytes32' },
      { name: 'circleId', type: 'uint256' },
      { name: 'pubKey', type: 'string' },
      { name: 'preferredPaymentChannelConfigId', type: 'uint256' },
      { name: 'fiatAmountLimit', type: 'uint256' },
    ],
    outputs: [{ name: 'orderId', type: 'uint256' }],
  },
] as const;

/** Booking UUID (16 bytes) → bytes32, left-padded, as DriftIntegrator expects. */
export function uuidToBytes32(uuid: string): Hex {
  const hex = uuid.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error(`Not a UUID: ${uuid}`);
  return `0x${'0'.repeat(32)}${hex}`;
}

/** "4500.00" USDC → 4_500_000_000n (6 decimals). */
export function usdcToUnits(price: string | number): bigint {
  const [whole, frac = ''] = String(price).split('.');
  return BigInt(whole) * 1_000_000n + BigInt((frac + '000000').slice(0, 6));
}
