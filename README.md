# Drift 🏄

Surf trips in Brazil for crypto nomads. Book a trip, pay in USDC (or PIX via p2pkit), show up.

## Stack

| Layer    | Tech                                              |
|----------|---------------------------------------------------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS v4    |
| Auth     | [Privy](https://privy.io) (email / wallet / social)|
| Backend  | Node 20 + Express + TypeScript                    |
| Database | PostgreSQL 16 (`pg`)                              |
| Payments | p2pkit adapter (`backend/src/lib/p2pkit.ts`) + on-chain integrator `backend/src/contracts/DriftIntegrator.sol` (see `backend/DEPLOY.md`) |

## Quick start

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# fill in PRIVY_APP_ID / PRIVY_APP_SECRET (https://dashboard.privy.io)

npm install
npm run db:up        # postgres via docker (runs schema.sql + seed.sql on first boot)
npm run dev          # api on :4000, web on :5173
```

Without Docker: create a database and run `npm run db:migrate && npm run db:seed`.

## Layout

```
drift/
├── frontend/          React app (Vite)
│   └── src/
│       ├── providers/ PrivyProvider
│       ├── pages/     Home, Trips, Trip, Profile
│       ├── components/
│       ├── hooks/     useApi (authenticated fetch)
│       └── lib/       api client
├── backend/           Express API
│   ├── db/            schema.sql, seed.sql
│   ├── DEPLOY.md      how to deploy the p2pkit integrator contract
│   └── src/
│       ├── config/    env validation
│       ├── db/        pg pool + migrate/seed scripts
│       ├── middleware/ Privy token verification
│       ├── routes/    /auth, /trips, /bookings, /payments
│       ├── lib/       p2pkit adapter
│       └── contracts/ DriftIntegrator.sol + deploy.ts (Base)
└── docker-compose.yml postgres
```

## Scripts

- `npm run dev` — api + web concurrently
- `npm run build` — build both workspaces
- `npm run db:up` / `db:down` — postgres container
- `npm run db:migrate` / `db:seed` — apply SQL files to `DATABASE_URL`
- `npm run typecheck` — tsc in both workspaces
