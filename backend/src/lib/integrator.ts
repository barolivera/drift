/**
 * Read-only access to the deployed DriftIntegrator (Base Sepolia) so the API
 * can verify what the frontend claims about an order.
 */
import { Contract, JsonRpcProvider } from 'ethers';
import { env } from '../config/env.js';

const ABI = [
  'function getSession(uint256 orderId) view returns (tuple(address user, uint8 status, uint32 placementDay, uint256 amount, bytes32 bookingId))',
];
const STATUS = ['None', 'Placed', 'Paid', 'Cancelled'] as const;

export const isIntegratorConfigured = () => /^0x[0-9a-fA-F]{40}$/.test(env.DRIFT_INTEGRATOR_ADDRESS);

let contract: Contract | null = null;
function getContract() {
  if (!contract) {
    contract = new Contract(env.DRIFT_INTEGRATOR_ADDRESS, ABI, new JsonRpcProvider(env.BASE_SEPOLIA_RPC));
  }
  return contract;
}

export async function readOrderSession(orderId: string) {
  const s = await getContract().getSession(BigInt(orderId));
  return {
    user: s.user as string,
    status: STATUS[Number(s.status)] ?? 'None',
    amount: BigInt(s.amount),
    bookingId: s.bookingId as string,
  };
}
