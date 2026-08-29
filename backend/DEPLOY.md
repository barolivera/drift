# Deploying `DriftIntegrator` to Base

## What the contract is

`src/contracts/DriftIntegrator.sol` is Drift's **p2pkit (P2P.me) integrator**: the on-chain
piece that lets a nomad pay for a trip in PIX/BRL and lets Drift receive USDC on Base.

It implements p2pkit's `IP2PIntegrator` interface (vendored verbatim under `src/contracts/p2p/`):

| Function | Who calls it | What Drift does |
|---|---|---|
| `bookTrip(bookingId, amountUsdc, currency, circleId, pubKey, …)` | our frontend | deploys the user's `UserProxy` (once) and places a `placeB2BOrder` on the P2P Diamond through it |
| `validateOrder(user, amount, currency)` | Diamond, synchronously inside `placeB2BOrder` | enforces **5 000 USDC max per order** and **10 orders per user per UTC day**; reserves a daily slot |
| `onOrderComplete(orderId, user, amount, recipient)` | Diamond, after the merchant confirms the PIX | collects the USDC (from this contract or the user's proxy) and forwards it to `treasury`; emits `TripOrderPaid` |
| `onOrderCancel(orderId)` | Diamond, on expiry / dispute / manual cancel | releases the daily slot, marks the order cancelled, emits `TripOrderCancelled` |

Key facts:

- **Constructor:** `(usdc, p2pDiamond, treasury)`. The deployer becomes `owner`.
- **Owner powers:** `setTreasury`, `setPaused`, `recoverStranded(user)`. No upgradeability, by design (p2pkit requirement).
- **USDC never reaches the user's EOA.** The user's `UserProxy` is always the order's `recipientAddr`; the proxy blocks user-side USDC sweeps.
- **Refunds:** fiat is paid to a P2P merchant, and USDC only arrives at completion, so cancellation moves nothing on-chain. The backend listens for `TripOrderCancelled` to free the seat and, in the rare post-payment dispute, refunds via PIX.
- **`proxyImpl`** (the canonical `UserProxy` implementation) is deployed by the constructor and must be reported to P2P when whitelisting. It is **set-once** on the Diamond.

## Prerequisites

1. **Node 20+** and the repo installed (`npm install` at the root). The backend already has `ethers`, `solc@0.8.28` and `@openzeppelin/contracts`.
2. **A deployer wallet** for Base Sepolia. Create a fresh one — do not reuse a mainnet key:
   ```bash
   node -e "const w=require('ethers').Wallet.createRandom();console.log(w.address, w.privateKey)"
   ```
3. **Base Sepolia ETH for gas** (~0.002 ETH is plenty; deploy costs ≈ 9 KB of bytecode × 2 contracts):
   - Coinbase faucet: <https://portal.cdp.coinbase.com/products/faucet> (select Base Sepolia)
   - Alchemy faucet: <https://www.alchemy.com/faucets/base-sepolia>
   - Or bridge Sepolia ETH via <https://bridge.base.org> (testnet mode)
4. **P2P Diamond address** for Base Sepolia. It is not published in the integrators repo — get it from the P2P.me team (Telegram/Discord in <https://p2p-me.gitbook.io/p2p.me-docs>) or from an existing whitelisted integrator's `diamond()` getter on Sepolia Basescan.
5. **Treasury address** (`DRIFT_TREASURY_ADDRESS`). On Sepolia any wallet you control; on mainnet use a multisig (Safe).

### Getting testnet USDC on Base Sepolia

You do **not** need USDC to deploy, and the buyer never sends USDC — in the p2pkit flow the
merchant supplies it. You only need testnet USDC to simulate a merchant or to test
`recoverStranded`. Sources:

> ⚠️ The P2P **Sepolia Diamond settles in its own test USDC**:
> `0x4095fE4f1E636f11A95820BA2bB87F335Bd1040d` — *not* Circle's testnet USDC
> (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). `deploy.ts` defaults to the P2P one.
> Deploying with Circle's address makes `onOrderComplete` revert on every order.

- **P2P test USDC** (`0x4095…040d`): ask the P2P team for a mint, or use their gas/token faucet
  (`services/gas-faucet` in the integrators repo). Merchants in the test circles hold it.
- **Circle faucet** (only useful for non-P2P testing): <https://faucet.circle.com> → *Base Sepolia*.
- Add either token to MetaMask with its address, symbol `USDC`, 6 decimals.

## Deploy — step by step

From the `backend/` directory.

**1. Configure env.** Add to `backend/.env` (never commit it):

```dotenv
PRIVATE_KEY=0x…                       # deployer, becomes owner
P2P_DIAMOND_ADDRESS=0x…               # Base Sepolia Diamond from P2P
DRIFT_TREASURY_ADDRESS=0x…            # where USDC lands
# optional:
# USDC_ADDRESS=0x4095fE4f1E636f11A95820BA2bB87F335Bd1040d   # P2P test USDC (default)
# BASE_SEPOLIA_RPC=https://sepolia.base.org
```

**2. Compile only** (no network, sanity check):

```bash
npm run contract:compile
# ▶ compiling DriftIntegrator.sol with solc 0.8.28 …
# ✔ artifact written to src/contracts/artifacts/DriftIntegrator.json
```

**3. Deploy to Base Sepolia:**

```bash
npm run deploy:contract
# or, inline without .env:
PRIVATE_KEY=tu_key P2P_DIAMOND_ADDRESS=0x… DRIFT_TREASURY_ADDRESS=0x… npx tsx src/contracts/deploy.ts
# ts-node also works (the backend is ESM, so pass --esm):
PRIVATE_KEY=tu_key npx ts-node --esm src/contracts/deploy.ts
```

The script checks the chain id, that Diamond/USDC have code, and that the deployer has ETH;
then deploys, waits 2 confirmations, and prints:

```
=== DriftIntegrator deployed ===
Address:        0x…
Explorer:       https://sepolia.basescan.org/address/0x…
proxyImpl:      0x…
Owner:          0x…
Bytecode hash:  0x…
```

It also saves `src/contracts/deployments/baseSepolia.json` (commit this).

**4. Wire it into the app.** Add to `backend/.env`:

```dotenv
DRIFT_INTEGRATOR_ADDRESS=0x…
```

**5. Verify on Basescan.** Put an Etherscan API v2 key (covers Basescan / Base Sepolia) in
`backend/.env` as `ETHERSCAN_API_KEY`, then:

```bash
npm run verify:contract                    # Base Sepolia, address from deployments/baseSepolia.json
npm run verify:contract -- --network base  # mainnet
```

The script rebuilds the standard-JSON with every source unit (contract, `p2p/`, OpenZeppelin)
and the deploy settings, **compares the runtime bytecode with the on-chain code first** (immutable
slots masked; on any other difference it prints the settings/metadata diff and does not submit),
then submits with the ABI-encoded constructor args and polls until `Pass - Verified`.
Sepolia integrator: <https://sepolia.basescan.org/address/0x7e1b37c447284257B30f82bc6668B7a4a0F5bb3F#code> — verified.

**6. Request whitelisting.** Nothing works until P2P calls `registerIntegrator` on the Diamond.
Open a "Whitelist request" issue on <https://github.com/p2pdotme/payment-integrators> with:

- Network: `baseSepolia`
- Integrator address + **pinned `proxyImpl`** (both printed by the script)
- **`usdcThroughIntegrator: true`** (the contract also tolerates `false`, but `true` is what it is coded for)
- Deployer address, bytecode hash, Basescan link
- Expected `circleId` for BRL (P2P gives you this per network)
- Operational contact

**7. Smoke test** once whitelisted: call `bookTrip` from the frontend (or `cast send`) with a
tiny amount, pay the PIX in the P2P test flow, and confirm `TripOrderPaid` fires and USDC
shows up in the treasury. P2P requires one successful Sepolia end-to-end order before they
whitelist on mainnet.

## Mainnet

Same script with `--network base` (`npm run deploy:contract:mainnet`). Use `USDC` =
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, the mainnet Diamond, a multisig treasury and a
hardware-wallet/fresh deployer key. Re-sync `src/contracts/p2p/` from upstream `main` first —
a stale `UserProxy` will fail P2P's bytecode review.

## If it fails

| Symptom | Cause / fix |
|---|---|
| `missing env: PRIVATE_KEY…` | Env not loaded. Run from `backend/` (dotenv reads `backend/.env`) or pass vars inline. |
| `RPC … is chain X, expected 84532` | `BASE_SEPOLIA_RPC` points at the wrong network. Unset it or use `https://sepolia.base.org`. |
| `Deployer has 0 ETH` | Fund the deployer from a faucet (see Prerequisites). Wait ~1 min and retry. |
| `Diamond address … has no code` | Wrong network or wrong Diamond address. Check it on <https://sepolia.basescan.org>. |
| `insufficient funds for gas` mid-deploy | Gas spiked. Top up a bit more ETH; the failed tx cost nothing but the attempt. |
| `replacement transaction underpriced` / nonce errors | A previous tx is pending. Wait for it or reset the account nonce in your wallet; then rerun. |
| Compile error mentioning `transient` | solc < 0.8.28 or EVM ≠ cancun. `npm ls solc` should show 0.8.28; the script pins `evmVersion: cancun`. |
| Compile error `File not found: @openzeppelin/…` | Run `npm install` at the repo root; deploy.ts resolves imports from the root `node_modules`. |
| Deployed, but `bookTrip` reverts | Not whitelisted yet — the Diamond rejects proxies from unregistered integrators. Finish step 6. |
| `bookTrip` reverts with `CurrencyMismatch` | `(currency, circleId)` pair doesn't match the Diamond's config. Get the BRL circleId from P2P. |
| `PerTxLimitExceeded` / `DailyTxLimitExceeded` | Working as intended: 5 000 USDC per order, 10 orders/user/day (UTC). |
| Script hangs after "deploying …" | Public RPC is slow. Set `BASE_SEPOLIA_RPC` to an Alchemy/Infura/QuickNode Base Sepolia endpoint. |
| Lost the address | It's in `src/contracts/deployments/baseSepolia.json`, or look up the deployer's txs on Basescan. |

Contracts are immutable: to change limits or logic, deploy a new version, re-verify, and file
a new whitelist request (and a deregister request for the old address).

## Rotating the treasury

`owner` is immutable, so the deployer key keeps admin forever; the only thing that
can be moved is where the USDC lands:

```bash
npm run contract:set-treasury -- 0xNewTreasury            # Base Sepolia
npm run contract:set-treasury -- 0xNewTreasury --network base
```

Signs with `PRIVATE_KEY` (must be the owner), then update `DRIFT_TREASURY_ADDRESS`
wherever the backend runs. A full key rotation (new owner) means redeploying the
integrator with a new deployer and getting the new address + `proxyImpl`
whitelisted by P2P.me again.

## Hosting — Railway (API + Postgres) and Vercel (web)

The repo is an npm-workspaces monorepo (`frontend/`, `backend/`); both hosts build
from the repo root.

**Railway** — `railway.json` at the root drives the API service:
build `npm ci && npm run build -w backend`, start `npm run start -w backend`,
health check `GET /health`. Add a Postgres service and reference it as
`DATABASE_URL=${{Postgres.DATABASE_URL}}`. Runtime variables (see
`backend/src/config/env.ts`): `NODE_ENV=production`, `PORT` (Railway injects it),
`CORS_ORIGIN` (comma-separated; `*.vercel.app` allows preview deployments),
`DATABASE_URL`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `P2PKIT_API_KEY`,
`P2PKIT_API_URL`, `P2PKIT_WEBHOOK_SECRET`, `P2PKIT_CHAIN`, `P2PKIT_ASSET`,
`DRIFT_TREASURY_ADDRESS`, `DRIFT_INTEGRATOR_ADDRESS`, `USDC_ADDRESS` (direct USDC
payments are verified against it), `BASE_SEPOLIA_RPC`.
`PRIVATE_KEY` and `ETHERSCAN_API_KEY` are **not** runtime variables — they only
serve the contract scripts, keep them off the host.

`backend/db/schema.sql` is idempotent, so the start command runs `db:migrate`
before the server on every deploy. The Postgres service has no public URL; run
one-off commands inside the API container instead:

```bash
railway ssh --service api -- npm run db:seed -w backend   # backend/db/seed.sql (upserts by slug)
```

P2P.me webhook: point it at `https://<railway-domain>/webhooks/p2pkit` and set the
same `P2PKIT_WEBHOOK_SECRET` on both sides (sent as `x-webhook-secret`).

**Vercel** — project root directory `frontend`; `frontend/vercel.json` installs and
builds from the repo root (`cd .. && npm ci`, `cd .. && npm run build -w frontend`)
and rewrites every path to `index.html` for the React Router routes. Variables:
`VITE_API_URL` (the Railway domain, no trailing slash), `VITE_PRIVY_APP_ID`,
`VITE_CHAIN`, `VITE_DRIFT_INTEGRATOR_ADDRESS`, `VITE_P2P_DIAMOND_ADDRESS`,
`VITE_USDC_ADDRESS`, `VITE_P2P_SUBGRAPH_URL` (or `VITE_P2P_BRL_CIRCLE_ID`),
`VITE_PRIVY_GAS_SPONSORSHIP`, `VITE_P2P_DEMO`, `VITE_TELEGRAM_INVITE_URL`.
Add the Vercel domain to Privy's allowed origins as well.
