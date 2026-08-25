# Vendored p2pkit protocol files

Copied verbatim from [p2pdotme/payment-integrators](https://github.com/p2pdotme/payment-integrators)
(`contracts/interfaces/` and `contracts/base/`), Apache-2.0.

| File | Purpose |
|------|---------|
| `IP2PIntegrator.sol` | Interface every integrator must implement (`validateOrder`, `onOrderComplete`, `onOrderCancel`). |
| `IB2BGateway.sol`    | The Diamond's B2B facet (`placeB2BOrder`). |
| `UserProxy.sol`      | Canonical per-user CREATE2 proxy. **Do not modify** — the Diamond authenticates proxies by re-deriving their CREATE2 address from this exact bytecode. |

Re-sync from upstream `main` before a mainnet deploy.
