// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import { IP2PIntegrator } from "./p2p/IP2PIntegrator.sol";
import { IB2BGateway } from "./p2p/IB2BGateway.sol";
import { UserProxy } from "./p2p/UserProxy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";

/**
 * @title DriftIntegrator
 * @notice p2pkit (P2P.me) B2B integrator for Drift — surf trips in Brazil for
 *         crypto nomads. Lets a nomad pay for a trip booking in local fiat
 *         (PIX / BRL) and settles the price in USDC on Base into Drift's
 *         treasury.
 *
 *         Order lifecycle (see p2p/README.md and the upstream docs):
 *
 *           1. Frontend calls `bookTrip(bookingId, amount, ...)`.
 *           2. This contract deploys (once) a per-user `UserProxy` and routes
 *              `IB2BGateway.placeB2BOrder` through it — the Diamond only
 *              accepts placements from CREATE2-derived proxies.
 *           3. The Diamond synchronously calls back `validateOrder`, where we
 *              enforce Drift's limits (5 000 USDC per order, 10 orders per
 *              user per UTC day).
 *           4. Off-chain: the user pays PIX to a P2P merchant; the merchant
 *              releases USDC.
 *           5. The Diamond calls `onOrderComplete` — we collect the USDC and
 *              forward it to the Drift treasury, emitting `TripOrderPaid`
 *              so the backend can confirm the booking.
 *           6. If the order is cancelled/expired/disputed instead, the Diamond
 *              calls `onOrderCancel` — we release the limit slots reserved in
 *              step 3 and emit `TripOrderCancelled` (refund handling below).
 *
 *         Refunds: fiat is only ever paid to a P2P merchant, never to this
 *         contract, and USDC only arrives at completion. So on cancellation
 *         there is nothing to move on-chain — "refund" means releasing the
 *         user's daily slot and signalling the backend to release the seat
 *         (and, for the rare post-fiat dispute, to refund via PIX off-chain).
 *         USDC stranded on a proxy after a failed completion callback can be
 *         swept to the treasury by the owner via `recoverStranded`.
 *
 * @dev    Register on the Diamond with `usdcThroughIntegrator = true`
 *         (see backend/DEPLOY.md). `onOrderComplete` also tolerates the
 *         `false` routing (USDC landing on the user's proxy) by pulling it
 *         from the proxy — the proxy is always the order's `recipientAddr`,
 *         never the user EOA, so purchased USDC can never bypass the treasury.
 */
contract DriftIntegrator is IP2PIntegrator {
    using SafeERC20 for IERC20;

    // ─── Errors ───────────────────────────────────────────────────────
    error OnlyDiamond();
    error OnlyOwner();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidBookingId();
    error Paused();
    error PerTxLimitExceeded(uint256 amount, uint256 limit);
    error DailyTxLimitExceeded(address user, uint256 limit);
    error OrderAlreadyFinalised(uint256 orderId);
    error InsufficientUsdcCollected(uint256 expected, uint256 collected);

    // ─── Events ───────────────────────────────────────────────────────
    event TripOrderPlaced(
        uint256 indexed orderId,
        bytes32 indexed bookingId,
        address indexed user,
        uint256 amountUsdc,
        bytes32 currency
    );
    /// @notice Emitted once USDC for `orderId` is safely in the treasury.
    ///         The Drift backend indexes this to flip the booking to `confirmed`.
    event TripOrderPaid(
        uint256 indexed orderId,
        bytes32 indexed bookingId,
        address indexed user,
        uint256 amountUsdc
    );
    /// @notice Emitted on Diamond-side cancellation. Backend should release the
    ///         seat and, if fiat was already paid (dispute), refund via PIX.
    event TripOrderCancelled(uint256 indexed orderId, bytes32 indexed bookingId, address indexed user);
    event UserProxyDeployed(address indexed user, address proxy);
    event TreasuryUpdated(address indexed previous, address indexed current);
    event PausedUpdated(bool paused);
    event StrandedRecovered(address indexed user, address indexed proxy, uint256 amount);

    // ─── Limits ───────────────────────────────────────────────────────
    /// @notice Hard cap per order: 5 000 USDC (USDC has 6 decimals).
    uint256 public constant MAX_TX_USDC = 5_000e6;
    /// @notice Max orders a single user may place per UTC day.
    uint256 public constant DAILY_TX_LIMIT = 10;

    // ─── Immutables ───────────────────────────────────────────────────
    /// @notice P2P Diamond (B2B gateway). Only address allowed to call the
    ///         IP2PIntegrator callbacks.
    address public immutable diamond;
    /// @notice USDC on this network. Public getter is REQUIRED: the canonical
    ///         UserProxy calls `IUsdcSource(integrator()).usdc()` to block
    ///         user-initiated USDC sweeps.
    IERC20 public immutable usdc;
    /// @notice Deployer; can rotate treasury, pause, and recover stranded USDC.
    address public immutable owner;
    /// @notice Canonical UserProxy implementation, deployed once in the
    ///         constructor and pinned on the Diamond at whitelisting time.
    address public immutable proxyImpl;

    // ─── State ────────────────────────────────────────────────────────
    /// @notice Where settled USDC ends up (DRIFT_TREASURY_ADDRESS).
    address public treasury;
    /// @notice Emergency stop for new placements. In-flight orders still
    ///         complete/cancel normally.
    bool public paused;

    enum Status {
        None,
        Placed,
        Paid,
        Cancelled
    }

    struct Session {
        address user;        // 20 bytes
        Status status;       //  1 byte  — packs with user
        uint32 placementDay; //  4 bytes — pinned so onOrderCancel releases the right day
        uint256 amount;      // micro-USDC
        bytes32 bookingId;   // Drift booking UUID (bytes32-encoded) for backend reconciliation
    }

    /// @notice Diamond orderId → Drift session.
    mapping(uint256 => Session) public sessions;
    /// @notice user → UTC day index → orders placed that day.
    mapping(address => mapping(uint256 => uint256)) public userDailyCount;

    // ─── Modifiers ────────────────────────────────────────────────────
    modifier onlyDiamond() {
        if (msg.sender != diamond) revert OnlyDiamond();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────

    /**
     * @param _usdc     USDC token on the target network
     *                  (Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e,
     *                   Base mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).
     * @param _diamond  P2P Diamond address for the same network (ask the P2P team
     *                  / see p2p.me docs).
     * @param _treasury Drift treasury wallet (DRIFT_TREASURY_ADDRESS) that
     *                  receives every settled payment. Use a multisig on mainnet.
     *
     * Deploys the canonical `UserProxy` implementation. Every per-user proxy is
     * a `cloneDeterministicWithImmutableArgs` of it with `(user, address(this))`
     * as immutable args — the exact layout the Diamond's CREATE2 auth expects.
     */
    constructor(address _usdc, address _diamond, address _treasury) {
        if (_usdc == address(0) || _diamond == address(0) || _treasury == address(0)) {
            revert InvalidAddress();
        }
        usdc = IERC20(_usdc);
        diamond = _diamond;
        treasury = _treasury;
        owner = msg.sender;
        proxyImpl = address(new UserProxy());
        emit TreasuryUpdated(address(0), _treasury);
    }

    // ─── Admin ────────────────────────────────────────────────────────

    /// @notice Rotate the treasury (e.g. EOA → multisig). Affects future
    ///         completions only.
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert InvalidAddress();
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    /// @notice Block new placements (both `bookTrip` and `validateOrder`).
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedUpdated(_paused);
    }

    /**
     * @notice Sweep USDC stuck on a user's proxy into the treasury.
     * @dev    Only reachable if the Diamond delivered USDC to the proxy but the
     *         `onOrderComplete` callback reverted (the gateway treats callbacks
     *         as best-effort and finalises anyway). The proxy only allows the
     *         integrator to pull to itself, so this is the sole recovery path.
     */
    function recoverStranded(address user) external onlyOwner {
        address proxy = proxyAddress(user);
        uint256 bal = usdc.balanceOf(proxy);
        if (bal == 0) return;
        UserProxy(proxy).transferERC20ToIntegrator(address(usdc), bal);
        usdc.safeTransfer(treasury, bal);
        emit StrandedRecovered(user, proxy, bal);
    }

    // ─── Views ────────────────────────────────────────────────────────

    /// @notice Orders `user` can still place today (UTC).
    function remainingDailyOrders(address user) external view returns (uint256) {
        uint256 used = userDailyCount[user][_today()];
        return used >= DAILY_TX_LIMIT ? 0 : DAILY_TX_LIMIT - used;
    }

    function getSession(uint256 orderId) external view returns (Session memory) {
        return sessions[orderId];
    }

    /// @notice Deterministic UserProxy address for `user` (may not be deployed
    ///         yet — check `code.length`).
    function proxyAddress(address user) public view returns (address) {
        return
            Clones.predictDeterministicAddressWithImmutableArgs(
                proxyImpl,
                _proxyArgs(user),
                _salt(user),
                address(this)
            );
    }

    // ─── User entry point ─────────────────────────────────────────────

    /**
     * @notice Place a fiat → USDC order to pay for a Drift booking.
     * @param bookingId  Drift booking UUID packed into bytes32 (backend does
     *                   `0x` + uuid-hex left-padded). Used only for events /
     *                   reconciliation; the contract does not validate it
     *                   against the DB.
     * @param amountUsdc Trip price in micro-USDC (6 dp), e.g. 4 500 USDC = 4_500e6.
     * @param currency   Fiat the user pays in, e.g. `bytes32("BRL")`.
     * @param circleId   Diamond circle for that currency (operational config,
     *                   provided by P2P per network).
     * @param pubKey     User's encrypted pubkey for the merchant channel (from
     *                   the p2pkit SDK / widget).
     * @param preferredPaymentChannelConfigId  0 = let the Diamond choose.
     * @param fiatAmountLimit  Max fiat the user accepts to pay; 0 = no cap.
     * @return orderId   The Diamond's order id — persist it on the booking.
     *
     * @dev    Limits are pre-checked here for a clean revert reason, and
     *         enforced authoritatively in `validateOrder` when the Diamond
     *         calls back during `placeB2BOrder`.
     */
    function bookTrip(
        bytes32 bookingId,
        uint256 amountUsdc,
        bytes32 currency,
        uint256 circleId,
        string calldata pubKey,
        uint256 preferredPaymentChannelConfigId,
        uint256 fiatAmountLimit
    ) external returns (uint256 orderId) {
        if (paused) revert Paused();
        if (bookingId == bytes32(0)) revert InvalidBookingId();
        if (amountUsdc == 0) revert InvalidAmount();
        if (amountUsdc > MAX_TX_USDC) revert PerTxLimitExceeded(amountUsdc, MAX_TX_USDC);
        if (userDailyCount[msg.sender][_today()] >= DAILY_TX_LIMIT) {
            revert DailyTxLimitExceeded(msg.sender, DAILY_TX_LIMIT);
        }

        // The proxy is both the authenticated caller of placeB2BOrder AND the
        // order's recipientAddr. USDC therefore lands either on this contract
        // (usdcThroughIntegrator = true) or on the proxy (= false) — never on
        // the user's EOA. Either way onOrderComplete moves it to the treasury.
        address proxy = _ensureProxy(msg.sender);
        bytes memory data = abi.encodeCall(
            IB2BGateway.placeB2BOrder,
            (
                msg.sender,
                amountUsdc,
                currency,
                proxy,
                pubKey,
                circleId,
                preferredPaymentChannelConfigId,
                fiatAmountLimit
            )
        );
        // usdcAllowance = 0: placement never pulls USDC; settlement is off-chain.
        bytes memory result = UserProxy(proxy).execute(diamond, data, address(usdc), 0);
        orderId = abi.decode(result, (uint256));

        sessions[orderId] = Session({
            user: msg.sender,
            status: Status.Placed,
            placementDay: uint32(_today()),
            amount: amountUsdc,
            bookingId: bookingId
        });

        emit TripOrderPlaced(orderId, bookingId, msg.sender, amountUsdc, currency);
    }

    // ─── IP2PIntegrator: validateOrder ────────────────────────────────

    /**
     * @notice Synchronous gate the Diamond runs inside `placeB2BOrder`.
     *         Enforces Drift's two limits and, on success, reserves one of the
     *         user's daily slots (released again by `onOrderCancel`).
     *
     *         - `amount` must be in (0, MAX_TX_USDC]  → 5 000 USDC per order.
     *         - user must have placed < DAILY_TX_LIMIT orders today (UTC)
     *           → 10 orders per user per day.
     *
     *         Returning `false` blocks the order without reverting the whole
     *         placement with an opaque error; the Diamond rejects on `false`.
     * @dev    `currency` is unused: the Diamond already cross-checks it against
     *         `circleId`, and Drift's caps are currency-agnostic (USDC-denominated).
     */
    function validateOrder(
        address user,
        uint256 amount,
        bytes32 /* currency */
    ) external onlyDiamond returns (bool allowed) {
        if (paused) return false;
        if (amount == 0 || amount > MAX_TX_USDC) return false;

        uint256 day = _today();
        uint256 count = userDailyCount[user][day];
        if (count >= DAILY_TX_LIMIT) return false;

        userDailyCount[user][day] = count + 1;
        return true;
    }

    // ─── IP2PIntegrator: onOrderComplete ──────────────────────────────

    /**
     * @notice Called by the Diamond once the merchant confirms the fiat payment
     *         and USDC has been released on Base. Collects the USDC and forwards
     *         it to the Drift treasury.
     *
     *         Routing tolerance:
     *           - `usdcThroughIntegrator = true`  → USDC is already on this
     *             contract; nothing to pull.
     *           - `usdcThroughIntegrator = false` → USDC sits on the user's
     *             proxy (`recipientAddr`); pull it with
     *             `transferERC20ToIntegrator` (integrator-only, proxy → us).
     *
     *         We then require that at least `amount` is available before
     *         paying the treasury, so a mis-routed order can never be marked
     *         paid without funds actually moving.
     * @dev    Unknown `orderId` is a no-op (best-effort contract with the
     *         gateway). A second call for an already-finalised order reverts;
     *         the gateway catches callback reverts and finalises regardless,
     *         which is exactly what we want for a replay.
     */
    function onOrderComplete(
        uint256 orderId,
        address user,
        uint256 amount,
        address /* recipientAddr */
    ) external onlyDiamond {
        Session storage s = sessions[orderId];
        if (s.status == Status.None) return; // not one of ours
        if (s.status != Status.Placed) revert OrderAlreadyFinalised(orderId);

        // Prefer the user recorded at placement; `user` from the Diamond is
        // the same address but we don't need to trust the argument.
        address proxy = proxyAddress(s.user);
        uint256 onProxy = usdc.balanceOf(proxy);
        if (onProxy > 0) {
            UserProxy(proxy).transferERC20ToIntegrator(address(usdc), onProxy);
        }

        uint256 have = usdc.balanceOf(address(this));
        if (have < amount) revert InsufficientUsdcCollected(amount, have);

        s.status = Status.Paid;
        usdc.safeTransfer(treasury, amount);

        emit TripOrderPaid(orderId, s.bookingId, user, amount);
    }

    // ─── IP2PIntegrator: onOrderCancel ────────────────────────────────

    /**
     * @notice Called by the Diamond when a BUY order is cancelled (manual,
     *         expiry, dispute or PAY-failure). Implements Drift's refund
     *         semantics:
     *
     *           1. Release the daily slot reserved in `validateOrder`, keyed on
     *              the day the order was placed (not today — a cancellation
     *              after midnight must not corrupt the new day's counter).
     *           2. Mark the session cancelled so a late `onOrderComplete`
     *              cannot pay out for it.
     *           3. Emit `TripOrderCancelled` — the backend frees the seat and,
     *              if the user had already paid fiat (dispute path), refunds
     *              via PIX off-chain. No USDC ever needs to move here: it only
     *              reaches this contract on completion.
     *
     * @dev    Best-effort and idempotent: unknown or already-cancelled orders
     *         are silently ignored. Never touches Diamond order state.
     */
    function onOrderCancel(uint256 orderId) external onlyDiamond {
        Session storage s = sessions[orderId];
        if (s.status != Status.Placed) return; // unknown, already paid, or already cancelled

        s.status = Status.Cancelled;

        uint256 day = uint256(s.placementDay);
        uint256 count = userDailyCount[s.user][day];
        if (count > 0) userDailyCount[s.user][day] = count - 1;

        emit TripOrderCancelled(orderId, s.bookingId, s.user);
    }

    // ─── Internals ────────────────────────────────────────────────────

    /// @dev UTC day index; the daily limit window rolls at 00:00 UTC.
    function _today() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    /// @dev Salt is the user EOA only. Per-(integrator, user) uniqueness comes
    ///      from this contract being the CREATE2 deployer.
    function _salt(address user) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(user)));
    }

    /// @dev Immutable args layout [owner(20)][integrator(20)] — 40 bytes. The
    ///      Diamond re-derives the proxy address from exactly this; do not change.
    function _proxyArgs(address user) internal view returns (bytes memory) {
        return abi.encodePacked(user, address(this));
    }

    /// @dev Deploy the user's proxy on first order; no-op afterwards.
    function _ensureProxy(address user) internal returns (address proxy) {
        proxy = proxyAddress(user);
        if (proxy.code.length == 0) {
            address deployed = Clones.cloneDeterministicWithImmutableArgs(
                proxyImpl,
                _proxyArgs(user),
                _salt(user)
            );
            assert(deployed == proxy);
            emit UserProxyDeployed(user, proxy);
        }
    }
}
