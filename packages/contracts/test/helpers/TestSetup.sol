// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentLedgerEscrow} from "../../src/AgentLedgerEscrow.sol";
import {MarketplaceHook} from "../../src/MarketplaceHook.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

abstract contract TestSetup is Test {
    MockERC20 public usdc;
    AgentLedgerEscrow public escrow;
    MarketplaceHook public hook;

    address public client = makeAddr("client");
    address public provider = makeAddr("provider");
    address public evaluator = makeAddr("evaluator");
    address public treasury = makeAddr("treasury");

    uint256 constant PLATFORM_FEE_BP = 200; // 2%
    uint256 constant EVALUATOR_FEE_BP = 100; // 1%
    uint256 constant JOB_BUDGET = 100e6; // 100 USDC (6 decimals)

    function setUp() public virtual {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        escrow = new AgentLedgerEscrow(
            address(usdc),
            treasury,
            PLATFORM_FEE_BP,
            EVALUATOR_FEE_BP
        );
        hook = new MarketplaceHook(address(escrow));
        escrow.whitelistHook(address(hook), true);

        usdc.mint(client, 10_000e6);
        vm.prank(client);
        usdc.approve(address(escrow), type(uint256).max);
    }

    /// @dev Helper: creates a fully funded job with hook, ready for submission
    function _createFundedJob() internal returns (uint256 jobId) {
        vm.prank(client);
        jobId = escrow.createJob(
            provider,
            evaluator,
            block.timestamp + 1 days,
            "Build a landing page",
            address(hook)
        );

        vm.prank(provider);
        escrow.setBudget(jobId, JOB_BUDGET, "");

        vm.prank(client);
        escrow.fund(jobId, "");
    }

    /// @dev Helper: creates a funded job and submits work
    function _createSubmittedJob() internal returns (uint256 jobId) {
        jobId = _createFundedJob();

        vm.prank(provider);
        escrow.submit(jobId, keccak256("deliverable-hash"), "");
    }
}
