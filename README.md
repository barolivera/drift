# Drift 🏄

**Drift** is a booking platform for surf trips in Brazil aimed at crypto nomads: two-week
residencies for sixteen people (lodging, boards, coaching, a dedicated work room and a demo night)
at spots like Itamambuca or Praia do Rosa — three protected hours of deep work every day is the one
house rule.
Nomads log in with Privy (email, Google or wallet), reserve a seat and pay either in **local fiat
via PIX** — Drift receives **USDC on Base** through a [p2pkit / P2P.me](https://p2p.me) integrator
contract — or **directly in USDC** from their wallet, verified against the transaction receipt
on-chain. No card processor, no bank account in Brazil required, and the chain is the source of
truth for whether a seat was paid.

## Live

| | |
|---|---|
| Frontend | **<https://drift-trip.vercel.app>** — Vercel, auto-deploys on every push to `main` (project root directory `frontend`, config in `frontend/vercel.json`) |
| API | **<https://api-production-bcab.up.railway.app>** — Railway (`api` service + Postgres). Deployed from local with `railway up --service api` (not git-connected); the start command migrates then serves |

Production runs the **real** payment flow (`VITE_P2P_DEMO=false`) on Base Sepolia.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18 · Vite 6 · TypeScript · Tailwind CSS v4 · `@p2pdotme/widgets` · `@phosphor-icons/react` |
| Auth     | [Privy](https://privy.io) (embedded wallets, gas-sponsored on Base Sepolia) |
| Backend  | Node 20 · Express · TypeScript · `ethers` (on-chain reads) |
| Database | PostgreSQL 16 (`pg`) |
| Contract | `DriftIntegrator.sol` — implements p2pkit's `IP2PIntegrator` (Solidity 0.8.28, Base) |

## Architecture — PIX payment flow

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

### Direct USDC

The second method skips the Diamond entirely: `POST /api/payments {method: "usdc"}` returns the
treasury address and exact amount, the guest sends USDC from their (Privy) wallet, and
`POST /api/payments/:id/confirm {tx_hash}` settles **only** after the receipt on Base proves a
`Transfer` of the configured token, for the exact amount, to the treasury, from the guest's
wallet (`backend/src/lib/usdc.ts` — typed failures distinguish "not mined yet, poll again" from
"this tx does not pay for this booking"). Idempotent per hash; a used hash 409s.

### Checkout (`/trips/:id/book`)

One page (`frontend/src/pages/Book.tsx`), four steps — **Details › Matching › Pay › Done** —
with a single Drift stepper and a different layout per step. The p2pkit widget stays mounted
across steps; its own header/stepper are hidden and its stage is read back from the DOM
(`hooks/useWidgetStage.ts`), its copy and emoji swapped for ours (`hooks/useWidgetCopy.tsx`).

## Deployed addresses (Base Sepolia, chainId 84532)

| Contract | Address |
|----------|---------|
| **DriftIntegrator** | [`0x7e1b37c447284257B30f82bc6668B7a4a0F5bb3F`](https://sepolia.basescan.org/address/0x7e1b37c447284257B30f82bc6668B7a4a0F5bb3F) — deploy tx [`0xbeab7f…a005`](https://sepolia.basescan.org/tx/0xbeab7fc447e4e80c7686d9ac7bf03b83afa3ae1a8d5686511cef17b785e1a005). **Whitelisted on the P2P Diamond** — real `bookTrip` orders go through |
| UserProxy impl (pinned `proxyImpl`) | [`0x89d595f7b2afdEce175Fe372C3EF1FeA813CDBBb`](https://sepolia.basescan.org/address/0x89d595f7b2afdEce175Fe372C3EF1FeA813CDBBb) |
| P2P Diamond | [`0xeb0BB8E3c014D915D9B2df03aBB130a1Fb44beb9`](https://sepolia.basescan.org/address/0xeb0BB8E3c014D915D9B2df03aBB130a1Fb44beb9) |
| USDC (P2P **test** token — not Circle's) | [`0x4095fE4f1E636f11A95820BA2bB87F335Bd1040d`](https://sepolia.basescan.org/address/0x4095fE4f1E636f11A95820BA2bB87F335Bd1040d) |
| Treasury | [`0x56aE3fdbc0D30Af095D4B1284899Db2CE811bc7E`](https://sepolia.basescan.org/address/0x56aE3fdbc0D30Af095D4B1284899Db2CE811bc7E) — rotated on-chain after deploy; the contract's immutable `owner` remains the deploy key [`0x0aA9…Af32`](https://sepolia.basescan.org/address/0x0aA91DE214B8b1cb36CB0AcB8aFdf40561F5Af32) until a redeploy |

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
| `DRIFT_TREASURY_ADDRESS` | wallet that receives trip payments (direct USDC verifies against it) |
| `USDC_ADDRESS`, `BASE_SEPOLIA_RPC` | token + RPC used to verify direct USDC receipts |
| `P2PKIT_WEBHOOK_SECRET` | shared secret P2P sends in `x-webhook-secret`; empty = unauthenticated webhooks in dev only (production rejects) |
| `PRIVATE_KEY`, `P2P_DIAMOND_ADDRESS` | only needed to (re)deploy the contract — never commit |

And `frontend/.env`:

| Variable | Value |
|---|---|
| `VITE_API_URL` | backend base URL — `http://localhost:4000` in dev, the Railway domain in prod |
| `VITE_PRIVY_APP_ID` | same Privy app id |
| `VITE_CHAIN` | `base-sepolia` while the integrator lives on testnet |
| `VITE_DRIFT_INTEGRATOR_ADDRESS` | `0x7e1b37c447284257B30f82bc6668B7a4a0F5bb3F` |
| `VITE_P2P_DIAMOND_ADDRESS` / `VITE_USDC_ADDRESS` | Diamond + P2P test USDC above (defaults are built in) |
| `VITE_P2P_SUBGRAPH_URL` **or** `VITE_P2P_BRL_CIRCLE_ID` | merchant-circle routing; `.env.example` ships a working subgraph URL |
| `VITE_PRIVY_GAS_SPONSORSHIP` | `true` only after enabling sponsorship in the Privy dashboard; otherwise the embedded wallet pays its own gas |
| `VITE_P2P_DEMO` | `true` → the widget fakes the on-chain lifecycle (no tx, no whitelisting needed). Production runs `false` |
| `VITE_TELEGRAM_INVITE_URL` | optional — the "Join the trip's Telegram" button on the Seat-confirmed screen |

```bash
# 3. Run
npm run dev                      # api → http://localhost:4000, web → http://localhost:5173
```

Open a trip, **Book Now**, pay. Demo mode is a **local-only** switch (`VITE_P2P_DEMO=true`) that
fakes the widget's on-chain lifecycle for UX work — production runs the real flow. With the API
in dev you can also simulate P2P's webhook from another terminal and watch the booking confirm
in real time:

```bash
# orderId = the id logged by the frontend ("[checkout] order placed demo…")
curl -X POST http://localhost:4000/webhooks/p2pkit \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $P2PKIT_WEBHOOK_SECRET" \
  -d '{"orderId":"demo1787703162992","status":"completed","txHash":"0x…","amount":1200}'
```

Other scripts: `npm run typecheck` · `npm run build` · `npm run contract:compile -w backend` ·
`npm run deploy:contract -w backend` (see `backend/DEPLOY.md`) ·
`npm run db:reset-booking -w backend -- <trip> [--dry-run]` (clears a test booking; local DB only).

## Layout

```
drift/
├── frontend/src/
│   ├── pages/                           Home · Trips · TripDetail (edition template: hero card,
│   │                                    house gallery, inclusions, dates & prices, FAQ) ·
│   │                                    Book (4-step checkout) · Profile
│   ├── components/
│   │   ├── BookingForm.tsx              registration form → POST /api/bookings (pending)
│   │   ├── PaymentCheckout.tsx          p2pkit <Checkout> + order registration/confirmation
│   │   ├── UsdcCheckout.tsx             direct USDC: pay from the wallet → /:id/confirm
│   │   ├── EditionCard.tsx · Inclusions.tsx · Faq.tsx · Reveal.tsx · …   see DESIGN.md
│   ├── hooks/
│   │   ├── useCheckoutSigner.ts         Privy wallet → CheckoutSigner
│   │   ├── usePaymentStatus.ts          2 s polling of /api/payments/:orderId
│   │   ├── useWidgetStage.ts · useWidgetCopy.tsx   widget DOM → our stepper / our copy
│   └── lib/p2p.ts                       addresses, currencies, bookTrip ABI
├── backend/src/
│   ├── routes/                          auth, spots, trips, bookings, payments, webhooks
│   ├── middleware/auth.ts               Privy token verification → req.user
│   ├── lib/integrator.ts                ethers read of DriftIntegrator.getSession
│   ├── lib/usdc.ts                      receipt verification for direct USDC payments
│   ├── contracts/DriftIntegrator.sol    IP2PIntegrator implementation (+ vendored p2p/ files)
│   ├── contracts/deploy.ts              solc + ethers deploy script
│   └── db/                              pool, migrate, seed, reset-booking
├── backend/db/schema.sql · seed.sql     data model + the two 2027 editions
├── backend/DEPLOY.md                    contract deployment + whitelisting + hosting guide
├── DESIGN.md                            design system (tokens, type, components)
└── docker-compose.yml                   postgres
```

## Data model

`backend/db/schema.sql` — all statements are idempotent (`CREATE … IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`), so `npm run db:migrate` is safe to re-run on an existing database.

| Table | Purpose / notable columns |
|---|---|
| `users` | one row per Privy identity (`privy_did`), `wallet_address`, `is_host` |
| `spots` | surf spot: `slug`, `city`, `state`, `capacity`, `daily_rate_usdc`, `level` |
| `trips` | an edition at a spot. Booking fields: `starts_on`, `ends_on`, `capacity` (= total seats), `price_usdc` (current/founding price), `price_full_usdc` (regular price once the `founding_seats` are gone), `level`, `is_published`. Editorial fields: `slug`, `location`, `description`, `description_long`, `included` / `not_included` (jsonb string[]), `who_its_for`, `daily_schedule` (jsonb, kept in the DB; the edition page no longer renders a day-by-day timeline) |
| `bookings` | `(trip_id, user_id)` unique, `seats`, `status` pending → confirmed / cancelled / completed. Registration form (saved before checkout, no effect on status): `full_name`, `email`, `telegram` (no `@`), `country`, `surf_level` (`never`/`beginner`/`intermediate`/`advanced`), `working_on`, `dietary`, `agreed_terms_at` |
| `payments` | one per attempt: `method` (`pix_p2pkit` / `usdc`), `status`, `amount_usdc`, `tx_hash`, `p2pkit_order_id` (Diamond orderId), `p2pkit_payload` |
| `trip_availability` (view) | `seats_taken` / `seats_left` per trip from pending + confirmed bookings |

`backend/db/seed.sql` upserts the host, the two spots and the two 2027 editions (by `slug`), so
editing copy and re-running `npm run db:seed` updates the rows in place:

| Edition | Dates | Seats | Price |
|---|---|---|---|
| Itamambuca — Summer Edition (`itamambuca-summer-2027`) | 16 – 30 Jan 2027 | 16 | **900 USDC** founding (first 8 seats) · 1,200 after |
| Praia do Rosa — Autumn Edition (`praia-do-rosa-autumn-2027`) | 24 Apr – 8 May 2027 | 16 | **950 USDC** founding (first 8 seats) · 1,300 after |

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/trips`, `/api/trips/:id`, `/api/spots` | – | catalogue (with live `seats_left`) |
| GET/PATCH | `/api/auth/me` | Privy | profile |
| GET/POST | `/api/bookings`, `POST /api/bookings/:id/cancel` | Privy | reservations. `POST` takes the registration form (`full_name`, `email`, `telegram`, `country`, `surf_level`, `working_on`, `dietary?`, `agreed_terms: true`) and creates the `pending` booking (row-locked against overselling; one per user per trip — a re-submit on a still-pending booking updates the form data) |
| GET | `/api/payments/quote?amount_usdc=` | Privy | BRL quote via p2pkit |
| POST | `/api/payments` | Privy | start a payment: `usdc` → treasury address + amount; `pix_p2pkit` → p2pkit order |
| POST | `/api/payments/p2pkit` | Privy | register a placed Diamond order |
| GET | `/api/payments/:orderId` | Privy | poll payment + booking status |
| POST | `/api/payments/p2pkit/:orderId/complete` | Privy | widget reported COMPLETED; verified on-chain when `DRIFT_INTEGRATOR_ADDRESS` is set |
| POST | `/api/payments/:id/confirm` | Privy | direct USDC: verify the tx receipt on Base — `200` settled · `202` not mined yet, poll again · `422` tx doesn't pay for this booking · `409` hash already used |
| POST | `/webhooks/p2pkit` | `x-webhook-secret` | P2P order lifecycle → settle payment / confirm booking (idempotent; terminal states never regress) |
| GET | `/health`, `/webhooks/p2pkit` | – | liveness |

## Status

**Working today**

- **Deployed to production** — frontend on Vercel, API + Postgres on Railway (see [Live](#live)), running the real payment flow on Base Sepolia
- Trip catalogue, Privy login (email / Google / wallet), seat reservation with overselling protection and duplicate-booking guard
- Edition pages from a single template (boxed hero + title card, house photo gallery, inclusions, dates & prices, FAQ) with the design system in `DESIGN.md`
- Checkout at `/trips/:id/book`: four steps (Details › Matching › Pay › Done), one Drift stepper, the widget's own chrome hidden
- Two payment methods end-to-end: **PIX via the p2pkit widget** and **direct USDC** verified against the on-chain receipt — the first real USDC booking settled in production
- `DriftIntegrator` deployed on Base Sepolia and **whitelisted on the P2P Diamond** (real `bookTrip` orders go through); 18/18 checks against a Diamond mock (limits, completion in both USDC routings, cancellation, replay protection, stranded-funds recovery)
- Webhook receiver live in production + 2 s polling → booking confirms in the UI without user interaction
- Backend verifies `/complete` claims against the contract's on-chain session

**Pending**

- **Webhook registration on P2P.me's side** — point their dashboard at `https://api-production-bcab.up.railway.app/webhooks/p2pkit` with the shared `x-webhook-secret`; until then confirmation rides on the widget callback + on-chain verification
- Webhook hardening: also verify the on-chain session (`getSession(orderId).status == Paid`); index `TripOrderPaid` / `TripOrderCancelled` events as a fallback confirmation path
- Basescan source verification of the integrator
- Mainnet: redeploy with Circle USDC (`0x8335…2913`), the mainnet Diamond, a multisig treasury and a fresh `owner`
- No automated test suite yet — flows are verified manually (see PRs / session notes)
