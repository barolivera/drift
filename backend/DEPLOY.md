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

- **Circle faucet** (official, 10 USDC/hour): <https://faucet.circle.com> → network *Base Sepolia*.
  Token address: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- Add it to MetaMask with that address, symbol `USDC`, 6 decimals.

## Deploy — step by step

From the `backend/` directory.

**1. Configure env.** Add to `backend/.env` (never commit it):

```dotenv
PRIVATE_KEY=0x…                       # deployer, becomes owner
P2P_DIAMOND_ADDRESS=0x…               # Base Sepolia Diamond from P2P
DRIFT_TREASURY_ADDRESS=0x…            # where USDC lands
# optional:
# USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
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

**5. Verify on Basescan** so P2P reviewers can diff the source. Easiest path is Basescan's
"Verify & Publish" UI with *Solidity (Standard-Json-Input)*: compiler `v0.8.28`, EVM `cancun`,
optimizer on / 200 runs, viaIR **enabled**. Constructor args ABI-encoded:

```bash
node -e "const {AbiCoder}=require('ethers');console.log(AbiCoder.defaultAbiCoder().encode(['address','address','address'],[process.env.USDC,process.env.DIAMOND,process.env.TREASURY]))"
```

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
