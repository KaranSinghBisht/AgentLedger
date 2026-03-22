// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IACPHook} from "./interfaces/IACPHook.sol";

/// @title AgentLedgerEscrow — ERC-8183 Agent Commerce Protocol Escrow
/// @notice Manages escrowed jobs between clients, providers, and evaluators on Celo.
///         Provider proposes budget (setBudget), client funds, evaluator settles.
/// @dev Uses USDC (6 decimals). Three separate wallets required for roles.
contract AgentLedgerEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────────

    enum JobStatus { Open, Funded, Submitted, Completed, Rejected, Expired }

    struct Job {
        uint256 id;
        address client;
        address provider;
        address evaluator;
        address hook;
        string description;
        uint256 budget;
        uint256 expiredAt;
        JobStatus status;
        bytes32 deliverable;
        bytes32 completionReason;
    }

    // ─── State ───────────────────────────────────────────────────────────

    IERC20 public immutable paymentToken;
    uint256 public platformFeeBP;
    uint256 public evaluatorFeeBP;
    address public treasury;
    address public owner;
    uint256 public jobCount;
    uint256 public constant EVALUATOR_GRACE_PERIOD = 1 days;

    mapping(uint256 => Job) internal _jobs;
    mapping(address => bool) public whitelistedHooks;

    // ─── Events (12) ─────────────────────────────────────────────────────

    event JobCreated(uint256 indexed jobId, address indexed client, string description, uint256 expiredAt);
    event ProviderSet(uint256 indexed jobId, address indexed provider);
    event BudgetSet(uint256 indexed jobId, uint256 amount);
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event WorkSubmitted(uint256 indexed jobId, bytes32 deliverable);
    event JobCompleted(
        uint256 indexed jobId,
        bytes32 reason,
        uint256 providerPayment,
        uint256 platformFee,
        uint256 evaluatorFee
    );
    event JobRejected(uint256 indexed jobId, bytes32 reason);
    event JobExpiredRefund(uint256 indexed jobId, uint256 refundAmount);
    event HookWhitelisted(address indexed hook, bool status);
    event PlatformFeeUpdated(uint256 newFeeBP);
    event EvaluatorFeeUpdated(uint256 newFeeBP);
    event TreasuryUpdated(address newTreasury);
    event HookCallFailed(uint256 indexed jobId, address hook, bool isBefore);

    // ─── Errors (9) ─────────────────────────────────────────────────────

    error Unauthorized();
    error InvalidAddress();
    error InvalidStatus(JobStatus current, JobStatus required);
    error JobExpired();
    error JobNotExpired();
    error ProviderAlreadySet();
    error BudgetNotSet();
    error HookNotWhitelisted();
    error FeeTooHigh();
    error EvaluatorGracePeriod();

    // ─── Modifiers ──────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyClient(uint256 jobId) {
        if (msg.sender != _jobs[jobId].client) revert Unauthorized();
        _;
    }

    modifier onlyProvider(uint256 jobId) {
        if (msg.sender != _jobs[jobId].provider) revert Unauthorized();
        _;
    }

    modifier onlyEvaluator(uint256 jobId) {
        if (msg.sender != _jobs[jobId].evaluator) revert Unauthorized();
        _;
    }

    modifier notExpired(uint256 jobId) {
        if (block.timestamp >= _jobs[jobId].expiredAt) revert JobExpired();
        _;
    }

    modifier inStatus(uint256 jobId, JobStatus required) {
        if (_jobs[jobId].status != required) {
            revert InvalidStatus(_jobs[jobId].status, required);
        }
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────

    constructor(
        address _paymentToken,
        address _treasury,
        uint256 _platformFeeBP,
        uint256 _evaluatorFeeBP
    ) {
        if (_paymentToken == address(0) || _treasury == address(0)) {
            revert InvalidAddress();
        }
        if (_platformFeeBP + _evaluatorFeeBP > 5000) revert FeeTooHigh();

        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
        platformFeeBP = _platformFeeBP;
        evaluatorFeeBP = _evaluatorFeeBP;
        owner = msg.sender;
    }

    // ─── Core Lifecycle (ERC-8183) ──────────────────────────────────────

    /// @notice Create a new job. Provider can be set now or later via setProvider.
    function createJob(
        address provider,
        address evaluator,
        uint256 expiredAt,
        string calldata description,
        address hook
    ) external returns (uint256 jobId) {
        if (evaluator == address(0)) revert InvalidAddress();
        if (expiredAt <= block.timestamp) revert JobExpired();
        if (hook != address(0)) {
            if (!whitelistedHooks[hook]) revert HookNotWhitelisted();
            if (!IERC165(hook).supportsInterface(type(IACPHook).interfaceId)) {
                revert HookNotWhitelisted();
            }
        }

        jobId = jobCount++;
        Job storage job = _jobs[jobId];
        job.id = jobId;
        job.client = msg.sender;
        job.provider = provider;
        job.evaluator = evaluator;
        job.hook = hook;
        job.description = description;
        job.expiredAt = expiredAt;
        job.status = JobStatus.Open;

        emit JobCreated(jobId, msg.sender, description, expiredAt);
        if (provider != address(0)) {
            emit ProviderSet(jobId, provider);
        }
    }

    /// @notice Client assigns a provider (one-time, before funding)
    function setProvider(
        uint256 jobId,
        address provider
    )
        external
        onlyClient(jobId)
        inStatus(jobId, JobStatus.Open)
        notExpired(jobId)
    {
        if (provider == address(0)) revert InvalidAddress();
        if (_jobs[jobId].provider != address(0)) revert ProviderAlreadySet();

        _beforeHook(jobId, abi.encode(provider));
        _jobs[jobId].provider = provider;
        _afterHook(jobId, abi.encode(provider));

        emit ProviderSet(jobId, provider);
    }

    /// @notice Provider proposes a price (ERC-8183: setBudget is PROVIDER-only)
    function setBudget(
        uint256 jobId,
        uint256 amount,
        bytes calldata /* optParams */
    )
        external
        onlyProvider(jobId)
        inStatus(jobId, JobStatus.Open)
        notExpired(jobId)
    {
        if (amount == 0) revert BudgetNotSet();

        _beforeHook(jobId, abi.encode(amount));
        _jobs[jobId].budget = amount;
        _afterHook(jobId, abi.encode(amount));

        emit BudgetSet(jobId, amount);
    }

    /// @notice Client funds the job (transfers budget from client to escrow)
    function fund(
        uint256 jobId,
        bytes calldata /* optParams */
    )
        external
        onlyClient(jobId)
        inStatus(jobId, JobStatus.Open)
        notExpired(jobId)
        nonReentrant
    {
        Job storage job = _jobs[jobId];
        if (job.budget == 0) revert BudgetNotSet();
        if (job.provider == address(0)) revert InvalidAddress();

        _beforeHook(jobId, abi.encode(job.budget));

        paymentToken.safeTransferFrom(msg.sender, address(this), job.budget);
        job.status = JobStatus.Funded;

        _afterHook(jobId, abi.encode(job.budget));

        emit JobFunded(jobId, job.budget);
    }

    /// @notice Provider submits a deliverable hash
    function submit(
        uint256 jobId,
        bytes32 deliverable,
        bytes calldata /* optParams */
    )
        external
        onlyProvider(jobId)
        inStatus(jobId, JobStatus.Funded)
        notExpired(jobId)
    {
        _beforeHook(jobId, abi.encode(deliverable));
        _jobs[jobId].status = JobStatus.Submitted;
        _jobs[jobId].deliverable = deliverable;
        _afterHook(jobId, abi.encode(deliverable));

        emit WorkSubmitted(jobId, deliverable);
    }

    /// @notice Evaluator accepts the work and triggers settlement
    /// @dev No notExpired — evaluator can settle even after deadline
    function complete(
        uint256 jobId,
        bytes32 reason,
        bytes calldata /* optParams */
    )
        external
        onlyEvaluator(jobId)
        inStatus(jobId, JobStatus.Submitted)
        nonReentrant
    {
        Job storage job = _jobs[jobId];
        uint256 budget = job.budget;

        uint256 platformFee = (budget * platformFeeBP) / 10_000;
        uint256 evaluatorFee = (budget * evaluatorFeeBP) / 10_000;
        uint256 providerPayment = budget - platformFee - evaluatorFee;

        bytes memory hookData = abi.encode(reason, job.provider, providerPayment);
        _beforeHook(jobId, hookData);

        job.status = JobStatus.Completed;
        job.completionReason = reason;

        if (platformFee > 0) {
            paymentToken.safeTransfer(treasury, platformFee);
        }
        if (evaluatorFee > 0) {
            paymentToken.safeTransfer(job.evaluator, evaluatorFee);
        }
        paymentToken.safeTransfer(job.provider, providerPayment);

        _afterHook(jobId, hookData);

        emit JobCompleted(jobId, reason, providerPayment, platformFee, evaluatorFee);
    }

    /// @notice Evaluator rejects the work, full refund to client
    /// @dev No notExpired — evaluator can reject even after deadline
    function reject(
        uint256 jobId,
        bytes32 reason,
        bytes calldata /* optParams */
    )
        external
        onlyEvaluator(jobId)
        inStatus(jobId, JobStatus.Submitted)
        nonReentrant
    {
        Job storage job = _jobs[jobId];

        bytes memory hookData = abi.encode(reason, job.provider);
        _beforeHook(jobId, hookData);

        job.status = JobStatus.Rejected;
        job.completionReason = reason;
        paymentToken.safeTransfer(job.client, job.budget);

        _afterHook(jobId, hookData);

        emit JobRejected(jobId, reason);
    }

    /// @notice Anyone can claim refund after expiry. NOT hookable per ERC-8183.
    /// @dev Submitted jobs get a grace period so the evaluator can settle first.
    function claimRefund(uint256 jobId) external nonReentrant {
        Job storage job = _jobs[jobId];
        if (block.timestamp < job.expiredAt) revert JobNotExpired();

        JobStatus status = job.status;
        if (
            status == JobStatus.Completed ||
            status == JobStatus.Rejected ||
            status == JobStatus.Expired
        ) {
            revert InvalidStatus(status, JobStatus.Open);
        }

        // Provider already submitted — give evaluator a grace period to settle
        if (status == JobStatus.Submitted) {
            if (block.timestamp < job.expiredAt + EVALUATOR_GRACE_PERIOD) {
                revert EvaluatorGracePeriod();
            }
        }

        uint256 refundAmount = 0;
        if (status == JobStatus.Funded || status == JobStatus.Submitted) {
            refundAmount = job.budget;
        }

        job.status = JobStatus.Expired;

        if (refundAmount > 0) {
            paymentToken.safeTransfer(job.client, refundAmount);
        }

        emit JobExpiredRefund(jobId, refundAmount);
    }

    // ─── Admin ──────────────────────────────────────────────────────────

    function whitelistHook(address hook, bool status) external onlyOwner {
        whitelistedHooks[hook] = status;
        emit HookWhitelisted(hook, status);
    }

    function setPlatformFee(uint256 newFeeBP) external onlyOwner {
        if (newFeeBP + evaluatorFeeBP > 5000) revert FeeTooHigh();
        platformFeeBP = newFeeBP;
        emit PlatformFeeUpdated(newFeeBP);
    }

    function setEvaluatorFee(uint256 newFeeBP) external onlyOwner {
        if (platformFeeBP + newFeeBP > 5000) revert FeeTooHigh();
        evaluatorFeeBP = newFeeBP;
        emit EvaluatorFeeUpdated(newFeeBP);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    // ─── View ───────────────────────────────────────────────────────────

    function getJob(uint256 jobId) external view returns (Job memory) {
        return _jobs[jobId];
    }

    // ─── Internal Hooks ─────────────────────────────────────────────────

    function _beforeHook(uint256 jobId, bytes memory data) internal {
        address hook = _jobs[jobId].hook;
        if (hook == address(0)) return;
        try IACPHook(hook).beforeAction(jobId, msg.sig, data) {}
        catch { emit HookCallFailed(jobId, hook, true); }
    }

    function _afterHook(uint256 jobId, bytes memory data) internal {
        address hook = _jobs[jobId].hook;
        if (hook == address(0)) return;
        try IACPHook(hook).afterAction(jobId, msg.sig, data) {}
        catch { emit HookCallFailed(jobId, hook, false); }
    }
}
