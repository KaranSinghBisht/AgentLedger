// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title IACPHook — ERC-8183 Agent Commerce Protocol Hook
/// @notice Called by the escrow contract before/after state transitions
interface IACPHook is IERC165 {
    /// @param jobId The job being acted on
    /// @param selector The function selector of the action (e.g., complete.selector)
    /// @param data ABI-encoded action-specific data
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
}
