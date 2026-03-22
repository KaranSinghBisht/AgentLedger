// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TestSetup} from "./helpers/TestSetup.sol";
import {AgentLedgerEscrow} from "../src/AgentLedgerEscrow.sol";
import {MarketplaceHook} from "../src/MarketplaceHook.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IACPHook} from "../src/interfaces/IACPHook.sol";

/// @dev A hook that always reverts, used to test settlement resilience.
contract RevertingHook is IACPHook, ERC165 {
    function beforeAction(uint256, bytes4, bytes calldata) external pure {
        revert("hook-reverted");
    }

    function afterAction(uint256, bytes4, bytes calldata) external pure {
        revert("hook-reverted");
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(IACPHook).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}

contract IntegrationTest is TestSetup {
    // ─── Helpers ──────────────────────────────────────────────────────────

    /// @dev Creates a funded job WITH the MarketplaceHook attached.
    function _createHookedFundedJob(
        string memory description
    ) internal returns (uint256 jobId) {
        vm.prank(client);
        jobId = escrow.createJob(
            provider,
            evaluator,
            block.timestamp + 1 days,
            description,
            address(hook)
        );

        vm.prank(provider);
        escrow.setBudget(jobId, JOB_BUDGET, "");

        vm.prank(client);
        escrow.fund(jobId, "");
    }

    /// @dev Creates a funded + submitted job WITH the MarketplaceHook attached.
    function _createHookedSubmittedJob(
        string memory description,
        bytes32 deliverable
    ) internal returns (uint256 jobId) {
        jobId = _createHookedFundedJob(description);

        vm.prank(provider);
        escrow.submit(jobId, deliverable, "");
    }

    // ─── 1. Full lifecycle: create → complete ─────────────────────────────

    function test_fullLifecycle_createToComplete() public {
        // Record balances before the flow
        uint256 providerBefore = usdc.balanceOf(provider);
        uint256 evaluatorBefore = usdc.balanceOf(evaluator);
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        // Create job with hook
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider,
            evaluator,
            block.timestamp + 1 days,
            "Integration: full lifecycle to complete",
            address(hook)
        );
        assertEq(escrow.getJob(jobId).hook, address(hook));

        // Provider sets budget
        vm.prank(provider);
        escrow.setBudget(jobId, JOB_BUDGET, "");

        // Client funds
        vm.prank(client);
        escrow.fund(jobId, "");

        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Funded)
        );
        assertEq(usdc.balanceOf(address(escrow)), JOB_BUDGET);

        // Provider submits deliverable
        bytes32 deliverable = keccak256("landing-page-v1");
        vm.prank(provider);
        escrow.submit(jobId, deliverable, "");

        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Submitted)
        );

        // Expect ReputationDue from hook with positive=true
        bytes32 completionReason = keccak256("work-approved");
        uint256 platformFee = (JOB_BUDGET * PLATFORM_FEE_BP) / 10_000;
        uint256 evaluatorFee = (JOB_BUDGET * EVALUATOR_FEE_BP) / 10_000;
        uint256 providerPayment = JOB_BUDGET - platformFee - evaluatorFee;

        vm.expectEmit(true, true, false, true, address(hook));
        emit MarketplaceHook.ReputationDue(
            jobId,
            provider,
            true,
            completionReason
        );

        // Evaluator completes
        vm.prank(evaluator);
        escrow.complete(jobId, completionReason, "");

        // Verify final status
        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Completed)
        );

        // Verify provider got paid
        assertEq(
            usdc.balanceOf(provider) - providerBefore,
            providerPayment
        );

        // Verify fee distribution
        assertEq(
            usdc.balanceOf(treasury) - treasuryBefore,
            platformFee
        );
        assertEq(
            usdc.balanceOf(evaluator) - evaluatorBefore,
            evaluatorFee
        );

        // Escrow should be fully drained
        assertEq(usdc.balanceOf(address(escrow)), 0);

        // Verify sum: platformFee + evaluatorFee + providerPayment == budget
        assertEq(platformFee + evaluatorFee + providerPayment, JOB_BUDGET);
    }

    // ─── 2. Full lifecycle: create → reject ───────────────────────────────

    function test_fullLifecycle_createToReject() public {
        uint256 clientBefore = usdc.balanceOf(client);
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 providerBefore = usdc.balanceOf(provider);
        uint256 evaluatorBefore = usdc.balanceOf(evaluator);

        // Full setup: create → setBudget → fund → submit
        bytes32 deliverable = keccak256("broken-deliverable");
        uint256 jobId = _createHookedSubmittedJob(
            "Integration: full lifecycle to reject",
            deliverable
        );

        // Expect ReputationDue from hook with positive=false
        bytes32 rejectionReason = keccak256("work-rejected-low-quality");

        vm.expectEmit(true, true, false, true, address(hook));
        emit MarketplaceHook.ReputationDue(
            jobId,
            provider,
            false,
            rejectionReason
        );

        // Evaluator rejects
        vm.prank(evaluator);
        escrow.reject(jobId, rejectionReason, "");

        // Verify final status
        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Rejected)
        );

        // Client gets full refund (back to original balance)
        assertEq(usdc.balanceOf(client), clientBefore);

        // No fees taken on rejection
        assertEq(usdc.balanceOf(treasury), treasuryBefore);
        assertEq(usdc.balanceOf(evaluator), evaluatorBefore);
        assertEq(usdc.balanceOf(provider), providerBefore);

        // Escrow drained
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    // ─── 3. Full lifecycle: expired refund ────────────────────────────────

    function test_fullLifecycle_expiredRefund() public {
        uint256 clientBefore = usdc.balanceOf(client);

        // Create job with hook → setBudget → fund
        uint256 jobId = _createHookedFundedJob(
            "Integration: expired refund"
        );

        // Client's balance decreased by JOB_BUDGET after funding
        assertEq(usdc.balanceOf(client), clientBefore - JOB_BUDGET);

        // Warp past expiry (1 day + 1 second)
        vm.warp(block.timestamp + 1 days + 1);

        // Anyone can claim refund
        escrow.claimRefund(jobId);

        // Verify expired status
        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Expired)
        );

        // Client gets full refund
        assertEq(usdc.balanceOf(client), clientBefore);

        // Escrow drained
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    // ─── 4. Multiple jobs: sequential completion ──────────────────────────

    function test_multipleJobs_sequentialCompletion() public {
        uint256 providerBefore = usdc.balanceOf(provider);
        uint256 evaluatorBefore = usdc.balanceOf(evaluator);
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        // Create 3 jobs, all with the same hook
        uint256 jobId0 = _createHookedFundedJob("Job Alpha");
        uint256 jobId1 = _createHookedFundedJob("Job Beta");
        uint256 jobId2 = _createHookedFundedJob("Job Gamma");

        // All three should be funded
        assertEq(usdc.balanceOf(address(escrow)), JOB_BUDGET * 3);

        // Submit all three
        vm.startPrank(provider);
        escrow.submit(jobId0, keccak256("alpha-work"), "");
        escrow.submit(jobId1, keccak256("beta-work"), "");
        escrow.submit(jobId2, keccak256("gamma-work"), "");
        vm.stopPrank();

        // Complete all three, expecting ReputationDue for each
        bytes32 reason0 = keccak256("alpha-approved");
        bytes32 reason1 = keccak256("beta-approved");
        bytes32 reason2 = keccak256("gamma-approved");

        // Job 0
        vm.expectEmit(true, true, false, true, address(hook));
        emit MarketplaceHook.ReputationDue(jobId0, provider, true, reason0);
        vm.prank(evaluator);
        escrow.complete(jobId0, reason0, "");

        // Job 1
        vm.expectEmit(true, true, false, true, address(hook));
        emit MarketplaceHook.ReputationDue(jobId1, provider, true, reason1);
        vm.prank(evaluator);
        escrow.complete(jobId1, reason1, "");

        // Job 2
        vm.expectEmit(true, true, false, true, address(hook));
        emit MarketplaceHook.ReputationDue(jobId2, provider, true, reason2);
        vm.prank(evaluator);
        escrow.complete(jobId2, reason2, "");

        // Verify all three are completed
        assertEq(
            uint256(escrow.getJob(jobId0).status),
            uint256(AgentLedgerEscrow.JobStatus.Completed)
        );
        assertEq(
            uint256(escrow.getJob(jobId1).status),
            uint256(AgentLedgerEscrow.JobStatus.Completed)
        );
        assertEq(
            uint256(escrow.getJob(jobId2).status),
            uint256(AgentLedgerEscrow.JobStatus.Completed)
        );

        // Verify total payment distribution across all 3 jobs
        uint256 totalBudget = JOB_BUDGET * 3;
        uint256 totalPlatformFee = (totalBudget * PLATFORM_FEE_BP) / 10_000;
        uint256 totalEvaluatorFee = (totalBudget * EVALUATOR_FEE_BP) / 10_000;
        uint256 totalProviderPayment =
            totalBudget - totalPlatformFee - totalEvaluatorFee;

        assertEq(
            usdc.balanceOf(provider) - providerBefore,
            totalProviderPayment
        );
        assertEq(
            usdc.balanceOf(treasury) - treasuryBefore,
            totalPlatformFee
        );
        assertEq(
            usdc.balanceOf(evaluator) - evaluatorBefore,
            totalEvaluatorFee
        );

        // Escrow fully drained
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    // ─── 5. Hook failure does not block settlement ────────────────────────

    function test_hookFailure_doesNotBlockSettlement() public {
        // Deploy and whitelist a reverting hook
        RevertingHook badHook = new RevertingHook();
        escrow.whitelistHook(address(badHook), true);

        uint256 providerBefore = usdc.balanceOf(provider);
        uint256 evaluatorBefore = usdc.balanceOf(evaluator);
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        // Create job with the reverting hook
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider,
            evaluator,
            block.timestamp + 1 days,
            "Integration: reverting hook",
            address(badHook)
        );

        // setBudget triggers hook — should not revert
        vm.prank(provider);
        escrow.setBudget(jobId, JOB_BUDGET, "");

        // fund triggers hook — should not revert
        vm.prank(client);
        escrow.fund(jobId, "");

        assertEq(usdc.balanceOf(address(escrow)), JOB_BUDGET);

        // submit triggers hook — should not revert
        vm.prank(provider);
        escrow.submit(jobId, keccak256("work"), "");

        // complete triggers hook — should not revert, payment must succeed
        uint256 platformFee = (JOB_BUDGET * PLATFORM_FEE_BP) / 10_000;
        uint256 evaluatorFee = (JOB_BUDGET * EVALUATOR_FEE_BP) / 10_000;
        uint256 providerPayment = JOB_BUDGET - platformFee - evaluatorFee;

        vm.prank(evaluator);
        escrow.complete(jobId, keccak256("good"), "");

        // Verify settlement succeeded despite hook failures
        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Completed)
        );
        assertEq(
            usdc.balanceOf(provider) - providerBefore,
            providerPayment
        );
        assertEq(
            usdc.balanceOf(treasury) - treasuryBefore,
            platformFee
        );
        assertEq(
            usdc.balanceOf(evaluator) - evaluatorBefore,
            evaluatorFee
        );
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }
}
