// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IACPHook} from "./interfaces/IACPHook.sol";

/// @title MarketplaceHook — Emits reputation events on job settlement
/// @notice Listens for complete/reject via afterAction and emits ReputationDue.
///         Sentinel agent monitors these events off-chain and calls ERC-8004
///         giveFeedback() from its own wallet (avoids msg.sender / self-feedback issues).
contract MarketplaceHook is IACPHook, ERC165 {
    // ─── Constants ──────────────────────────────────────────────────────

    /// @dev Selector for AgentLedgerEscrow.complete(uint256,bytes32,bytes)
    bytes4 private constant COMPLETE_SELECTOR =
        bytes4(keccak256("complete(uint256,bytes32,bytes)"));

    /// @dev Selector for AgentLedgerEscrow.reject(uint256,bytes32,bytes)
    bytes4 private constant REJECT_SELECTOR =
        bytes4(keccak256("reject(uint256,bytes32,bytes)"));

    // ─── State ──────────────────────────────────────────────────────────

    address public immutable escrow;

    // ─── Events ─────────────────────────────────────────────────────────

    /// @notice Emitted when reputation should be written for a provider
    /// @param jobId The completed/rejected job
    /// @param provider The worker agent's address
    /// @param positive True for completion, false for rejection
    /// @param reason The evaluator's reason hash
    event ReputationDue(
        uint256 indexed jobId,
        address indexed provider,
        bool positive,
        bytes32 reason
    );

    // ─── Errors ─────────────────────────────────────────────────────────

    error OnlyEscrow();

    // ─── Constructor ────────────────────────────────────────────────────

    constructor(address _escrow) {
        escrow = _escrow;
    }

    // ─── IACPHook ───────────────────────────────────────────────────────

    /// @notice No-op before actions
    function beforeAction(uint256, bytes4, bytes calldata) external view {
        if (msg.sender != escrow) revert OnlyEscrow();
    }

    /// @notice Emits ReputationDue on complete/reject
    function afterAction(
        uint256 jobId,
        bytes4 selector,
        bytes calldata data
    ) external {
        if (msg.sender != escrow) revert OnlyEscrow();

        if (selector == COMPLETE_SELECTOR) {
            (bytes32 reason, address provider, ) = abi.decode(
                data,
                (bytes32, address, uint256)
            );
            emit ReputationDue(jobId, provider, true, reason);
        } else if (selector == REJECT_SELECTOR) {
            (bytes32 reason, address provider) = abi.decode(
                data,
                (bytes32, address)
            );
            emit ReputationDue(jobId, provider, false, reason);
        }
    }

    // ─── ERC-165 ────────────────────────────────────────────────────────

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(IACPHook).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
