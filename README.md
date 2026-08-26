# Drift 🏄

**Drift** is a booking platform for surf trips in Brazil aimed at crypto nomads: two-week
residencies for sixteen people (lodging, boards, coaching, a dedicated work room and a demo night)
at spots like Itamambuca or Praia do Rosa — three protected hours of deep work every day is the one
house rule.
Nomads log in with Privy (email, Google or wallet), reserve a seat and pay in **local fiat via
PIX**; Drift receives **USDC on Base** through a [p2pkit / P2P.me](https://p2p.me) integrator
contract — no card processor, no bank account in Brazil required, and the on-chain order is the
source of truth for whether a seat was paid.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18 · Vite 6 · TypeScript · Tailwind CSS v4 · `@p2pdotme/widgets` |
| Auth     | [Privy](https://privy.io) (embedded wallets, gas-sponsored on Base Sepolia) |
| Backend  | Node 20 · Express · TypeScript · `ethers` (on-chain reads) |
| Database | PostgreSQL 16 (`pg`) |
| Contract | `DriftIntegrator.sol` — implements p2pkit's `IP2PIntegrator` (Solidity 0.8.28, Base) |

## Architecture — payment flow

```mermaid
sequenceDiagram
    autonumber
    actor U as Nomad (browser)
    participant FE as Frontend<br/>PaymentCheckout + p2pkit widget
    participant API as Drift API
    participant DB as Postgres
    participant IC as DriftIntegrator<br/>(Base Sepolia)
    participant DM as P2P Diamond
    participant M as PIX merchant
    participant WH as P2P webhook

    U->>FE: Book Now → registration form
    FE->>API: POST /api/bookings {trip_id, form fields}
    API->>DB: booking status = pending (+ form data)
    API-->>FE: booking {id}
    FE->>FE: render <Checkout> (BRL / PIX)
    U->>FE: Pay now
    FE->>IC: bookTrip(bookingId, amountUsdc, "BRL", circleId, pubKey)
    IC->>DM: placeB2BOrder via the user's UserProxy
    DM->>IC: validateOrder (≤ 5 000 USDC, ≤ 10 orders/day)
    DM-->>FE: orderId
    FE->>API: POST /api/payments/p2pkit {booking_id, order_id, tx_hash}
    API->>DB: payment status = processing
    loop every 2 s (usePaymentStatus)
        FE->>API: GET /api/payments/:orderId
    end
    U->>M: pays BRL via PIX
    M->>DM: releases USDC → order COMPLETED
    DM->>IC: onOrderComplete → USDC to Drift treasury
    WH->>API: POST /webhooks/p2pkit {orderId, status: completed}
    API->>DB: payment = settled, booking = confirmed
    API-->>FE: GET /api/payments/:orderId → settled / confirmed
    FE->>U: "You're in!" 🏄
```

Text version: **Book Now → registration form → booking `pending` → `bookTrip` on-chain (UserProxy → Diamond) →
p2pkit order placed → user pays PIX → merchant releases USDC → `onOrderComplete` pays the
treasury → webhook (or the widget's `onComplete` → `/complete`, which verifies the on-chain
session is `Paid`) → booking `confirmed`.** The frontend polls every 2 s, so whichever path
lands first flips the UI.

Cancellation (expiry / dispute) hits `onOrderCancel` on the contract, which releases the
user's daily slot and emits `TripOrderCancelled`; the webhook with `status: cancelled` marks the
payment `failed` and the booking `cancelled`.

## Deployed addresses (Base Sepolia, chainId 84532)

| Contract | Address |
|----------|---------|
| **DriftIntegrator** | [`0x7e1b37c447284257B30f82bc6668B7a4a0F5bb3F`](https://sepolia.basescan.org/address/0x7e1b37c447284257B30f82bc6668B7a4a0F5bb3F) — deploy tx [`0xbeab7f…a005`](https://sepolia.basescan.org/tx/0xbeab7fc447e4e80c7686d9ac7bf03b83afa3ae1a8d5686511cef17b785e1a005) |
| UserProxy impl (pinned `proxyImpl`) | [`0x89d595f7b2afdEce175Fe372C3EF1FeA813CDBBb`](https://sepolia.basescan.org/address/0x89d595f7b2afdEce175Fe372C3EF1FeA813CDBBb) |
| P2P Diamond | [`0xeb0BB8E3c014D915D9B2df03aBB130a1Fb44beb9`](https://sepolia.basescan.org/address/0xeb0BB8E3c014D915D9B2df03aBB130a1Fb44beb9) |
| USDC (P2P **test** token — not Circle's) | [`0x4095fE4f1E636f11A95820BA2bB87F335Bd1040d`](https://sepolia.basescan.org/address/0x4095fE4f1E636f11A95820BA2bB87F335Bd1040d) |
| Treasury / owner | [`0x0aA91DE214B8b1cb36CB0AcB8aFdf40561F5Af32`](https://sepolia.basescan.org/address/0x0aA91DE214B8b1cb36CB0AcB8aFdf40561F5Af32) |

Limits baked into the contract: **5 000 USDC per order, 10 orders per user per UTC day**.
Deployment record: `backend/src/contracts/deployments/baseSepolia.json`. Redeploy guide:
[`backend/DEPLOY.md`](backend/DEPLOY.md).

## Local setup (from zero)

Requirements: Node ≥ 20, PostgreSQL 16 (Homebrew or Docker), a [Privy](https://dashboard.privy.io) app.

```bash
git clone https://github.com/barolivera/drift && cd drift
npm install                      # installs both workspaces

# 1. Database — pick one
npm run db:up                    # Docker: postgres + schema + seed
#   or, with Homebrew:
brew install postgresql@16 && brew services start postgresql@16
createuser -s drift && psql -d postgres -c "ALTER USER drift PASSWORD 'drift'" && createdb -O drift drift
npm run db:migrate && npm run db:seed

# 2. Environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill in `backend/.env`:

| Variable | Value |
|---|---|
| `PRIVY_APP_ID`, `PRIVY_APP_SECRET` | from the Privy dashboard |
| `DATABASE_URL` | `postgres://drift:drift@localhost:5432/drift` (default) |
| `DRIFT_INTEGRATOR_ADDRESS` | `0x7e1b37c447284257B30f82bc6668B7a4a0F5bb3F` (enables on-chain verification of `/complete`) |
| `P2PKIT_WEBHOOK_SECRET` | shared secret P2P sends in `x-webhook-secret`; empty = unauthenticated webhooks in dev only |
| `PRIVATE_KEY`, `P2P_DIAMOND_ADDRESS`, `DRIFT_TREASURY_ADDRESS` | only needed to (re)deploy the contract |

And `frontend/.env`:

| Variable | Value |
|---|---|
| `VITE_PRIVY_APP_ID` | same Privy app id |
| `VITE_DRIFT_INTEGRATOR_ADDRESS` | `0x7e1b37c447284257B30f82bc6668B7a4a0F5bb3F` |
| `VITE_P2P_DIAMOND_ADDRESS` / `VITE_USDC_ADDRESS` | Diamond + P2P test USDC above (defaults are built in) |
| `VITE_P2P_SUBGRAPH_URL` **or** `VITE_P2P_BRL_CIRCLE_ID` | from P2P — needed for real orders (merchant routing) |
| `VITE_P2P_DEMO` | `true` to run the widget's simulated flow (no tx, no whitelisting needed) |

```bash
# 3. Run
npm run dev                      # api → http://localhost:4000, web → http://localhost:5173
```

Open a trip, **Book Now**, pay. In demo mode you can simulate P2P's webhook from another terminal
and watch the booking confirm in real time:

```bash
# orderId = the id logged by the frontend ("[checkout] order placed demo…")
curl -X POST http://localhost:4000/webhooks/p2pkit \
  -H "Content-Type: application/json" \
  -d '{"orderId":"demo1787703162992","status":"completed","txHash":"0x…","amount":1200}'
```

Other scripts: `npm run typecheck` · `npm run build` · `npm run contract:compile -w backend` ·
`npm run deploy:contract -w backend` (see `backend/DEPLOY.md`).

## Layout

```
drift/
├── frontend/src/
│   ├── components/BookingForm.tsx       registration form → POST /api/bookings (pending)
│   ├── components/PaymentCheckout.tsx   p2pkit <Checkout> + order registration/confirmation
│   ├── hooks/useCheckoutSigner.ts       Privy wallet → CheckoutSigner
│   ├── hooks/usePaymentStatus.ts        2 s polling of /api/payments/:orderId
│   ├── lib/p2p.ts                       addresses, currencies, bookTrip ABI
│   └── pages/                           Home, Trips, TripDetail (long copy, included/not, daily timeline, Book Now), Profile
├── backend/src/
│   ├── routes/                          auth, spots, trips, bookings, payments, webhooks
│   ├── middleware/auth.ts               Privy token verification → req.user
│   ├── lib/integrator.ts                ethers read of DriftIntegrator.getSession
│   ├── contracts/DriftIntegrator.sol    IP2PIntegrator implementation (+ vendored p2p/ files)
│   ├── contracts/deploy.ts              solc + ethers deploy script
│   └── db/                              pool, migrate, seed
├── backend/db/schema.sql · seed.sql    data model + the two 2027 editions
├── backend/DEPLOY.md                    contract deployment + whitelisting guide
└── docker-compose.yml                   postgres
```

## Data model

`backend/db/schema.sql` — all statements are idempotent (`CREATE … IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`), so `npm run db:migrate` is safe to re-run on an existing database.

| Table | Purpose / notable columns |
|---|---|
| `users` | one row per Privy identity (`privy_did`), `wallet_address`, `is_host` |
| `spots` | surf spot: `slug`, `city`, `state`, `capacity`, `daily_rate_usdc`, `level` |
| `trips` | an edition at a spot. Booking fields: `starts_on`, `ends_on`, `capacity` (= total seats), `price_usdc`, `level`, `is_published`. Editorial fields: `slug`, `location`, `description`, `description_long`, `included` / `not_included` (jsonb string[]), `who_its_for`, `daily_schedule` (jsonb `{time, title, detail, highlight?}[]` — `highlight` marks the 10:00 deep-work block) |
| `bookings` | `(trip_id, user_id)` unique, `seats`, `status` pending → confirmed / cancelled / completed. Registration form (saved before checkout, no effect on status): `full_name`, `email`, `telegram` (no `@`), `country`, `surf_level` (`never`/`beginner`/`intermediate`/`advanced`), `working_on`, `dietary`, `agreed_terms_at` |
| `payments` | one per attempt: `method` (`pix_p2pkit` / `usdc`), `status`, `amount_usdc`, `tx_hash`, `p2pkit_order_id` (Diamond orderId), `p2pkit_payload` |
| `trip_availability` (view) | `seats_taken` / `seats_left` per trip from pending + confirmed bookings |

`backend/db/seed.sql` upserts the host, the two spots and the two 2027 editions (by `slug`), so
editing copy and re-running `npm run db:seed` updates the rows in place:

| Edition | Dates | Seats | Price |
|---|---|---|---|
| Itamambuca — Summer Edition (`itamambuca-summer-2027`) | 16 – 30 Jan 2027 | 16 | from 1,200 USDC |
| Praia do Rosa — Autumn Edition (`praia-do-rosa-autumn-2027`) | 24 Apr – 8 May 2027 | 16 | from 1,300 USDC |

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/trips`, `/api/trips/:id`, `/api/spots` | – | catalogue (with live `seats_left`) |
| GET/PATCH | `/api/auth/me` | Privy | profile |
| GET/POST | `/api/bookings`, `POST /api/bookings/:id/cancel` | Privy | reservations. `POST` takes the registration form (`full_name`, `email`, `telegram`, `country`, `surf_level`, `working_on`, `dietary?`, `agreed_terms: true`) and creates the `pending` booking (row-locked against overselling; one per user per trip — a re-submit on a still-pending booking updates the form data) |
| POST | `/api/payments/p2pkit` | Privy | register a placed Diamond order |
| GET | `/api/payments/:orderId` | Privy | poll payment + booking status |
| POST | `/api/payments/p2pkit/:orderId/complete` | Privy | widget reported COMPLETED; verified on-chain when `DRIFT_INTEGRATOR_ADDRESS` is set |
| POST | `/webhooks/p2pkit` | `x-webhook-secret` | P2P order lifecycle → settle payment / confirm booking (idempotent) |
| GET | `/health`, `/webhooks/p2pkit` | – | liveness |

## Status

**Working today**

- Trip catalogue, Privy login, seat reservation with overselling protection and duplicate-booking guard
- p2pkit `<Checkout>` embedded in the trip page (BRL / PIX), demo mode end-to-end
- `DriftIntegrator` deployed on Base Sepolia with the correct P2P test USDC; 18/18 checks against a
  Diamond mock (limits, completion in both USDC routings, cancellation, replay protection, stranded-funds recovery)
- Webhook receiver + 2 s polling → booking confirms in the UI without user interaction
- Backend verifies `/complete` claims against the contract's on-chain session

**Pending**

- **Whitelisting on the P2P Diamond** (`registerIntegrator(integrator, usdcThroughIntegrator=true, proxyImpl)`) —
  until then real `bookTrip` calls revert. Request filed per `backend/DEPLOY.md` §6.
- **Merchant routing config from P2P**: `VITE_P2P_SUBGRAPH_URL` or the BRL `circleId`.
- **Real mode** (`VITE_P2P_DEMO=false`): needs the two items above plus Privy gas sponsorship on Base Sepolia.
- Webhook: verify the on-chain session (`getSession(orderId).status == Paid`) in addition to the shared secret;
  index `TripOrderPaid` / `TripOrderCancelled` events as a fallback confirmation path.
- Basescan source verification of the integrator (helps P2P's review).
- Mainnet: redeploy with Circle USDC (`0x8335…2913`), the mainnet Diamond and a multisig treasury.
- No automated test suite yet — flows are verified manually (see PRs / session notes).
