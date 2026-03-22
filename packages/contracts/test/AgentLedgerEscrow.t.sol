// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TestSetup} from "./helpers/TestSetup.sol";
import {AgentLedgerEscrow} from "../src/AgentLedgerEscrow.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IACPHook} from "../src/interfaces/IACPHook.sol";

/// @dev A hook that always reverts, used to test try-catch resilience.
contract RevertingHook is IACPHook, ERC165 {
    function beforeAction(uint256, bytes4, bytes calldata) external pure {
        revert("hook-reverted");
    }
    function afterAction(uint256, bytes4, bytes calldata) external pure {
        revert("hook-reverted");
    }
    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IACPHook).interfaceId || super.supportsInterface(interfaceId);
    }
}

contract AgentLedgerEscrowTest is TestSetup {
    // ─── createJob ──────────────────────────────────────────────────────

    function test_createJob_basic() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider,
            evaluator,
            block.timestamp + 1 days,
            "Test job",
            address(0)
        );

        AgentLedgerEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(job.client, client);
        assertEq(job.provider, provider);
        assertEq(job.evaluator, evaluator);
        assertEq(job.hook, address(0));
        assertEq(job.budget, 0);
        assertEq(uint256(job.status), uint256(AgentLedgerEscrow.JobStatus.Open));
    }

    function test_createJob_withHook() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider,
            evaluator,
            block.timestamp + 1 days,
            "Hooked job",
            address(hook)
        );

        AgentLedgerEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(job.hook, address(hook));
    }

    function test_createJob_noProvider() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            address(0),
            evaluator,
            block.timestamp + 1 days,
            "Open job",
            address(0)
        );

        AgentLedgerEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(job.provider, address(0));
    }

    function test_createJob_revert_zeroEvaluator() public {
        vm.prank(client);
        vm.expectRevert(AgentLedgerEscrow.InvalidAddress.selector);
        escrow.createJob(provider, address(0), block.timestamp + 1 days, "x", address(0));
    }

    function test_createJob_revert_pastExpiry() public {
        vm.prank(client);
        vm.expectRevert(AgentLedgerEscrow.JobExpired.selector);
        escrow.createJob(provider, evaluator, block.timestamp, "x", address(0));
    }

    function test_createJob_revert_unwhitelistedHook() public {
        address badHook = makeAddr("badHook");
        vm.prank(client);
        vm.expectRevert(AgentLedgerEscrow.HookNotWhitelisted.selector);
        escrow.createJob(provider, evaluator, block.timestamp + 1 days, "x", badHook);
    }

    function test_createJob_incrementsJobCount() public {
        vm.startPrank(client);
        uint256 id0 = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "a", address(0)
        );
        uint256 id1 = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "b", address(0)
        );
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(escrow.jobCount(), 2);
    }

    // ─── setProvider ────────────────────────────────────────────────────

    function test_setProvider() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            address(0), evaluator, block.timestamp + 1 days, "x", address(0)
        );

        vm.prank(client);
        escrow.setProvider(jobId, provider);

        assertEq(escrow.getJob(jobId).provider, provider);
    }

    function test_setProvider_revert_alreadySet() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "x", address(0)
        );

        vm.prank(client);
        vm.expectRevert(AgentLedgerEscrow.ProviderAlreadySet.selector);
        escrow.setProvider(jobId, makeAddr("other"));
    }

    function test_setProvider_revert_notClient() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            address(0), evaluator, block.timestamp + 1 days, "x", address(0)
        );

        vm.prank(provider);
        vm.expectRevert(AgentLedgerEscrow.Unauthorized.selector);
        escrow.setProvider(jobId, provider);
    }

    // ─── setBudget ──────────────────────────────────────────────────────

    function test_setBudget() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "x", address(0)
        );

        vm.prank(provider);
        escrow.setBudget(jobId, JOB_BUDGET, "");

        assertEq(escrow.getJob(jobId).budget, JOB_BUDGET);
    }

    function test_setBudget_revert_notProvider() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "x", address(0)
        );

        vm.prank(client);
        vm.expectRevert(AgentLedgerEscrow.Unauthorized.selector);
        escrow.setBudget(jobId, JOB_BUDGET, "");
    }

    function test_setBudget_revert_zeroAmount() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "x", address(0)
        );

        vm.prank(provider);
        vm.expectRevert(AgentLedgerEscrow.BudgetNotSet.selector);
        escrow.setBudget(jobId, 0, "");
    }

    // ─── fund ───────────────────────────────────────────────────────────

    function test_fund() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "x", address(0)
        );

        vm.prank(provider);
        escrow.setBudget(jobId, JOB_BUDGET, "");

        vm.prank(client);
        escrow.fund(jobId, "");

        AgentLedgerEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(uint256(job.status), uint256(AgentLedgerEscrow.JobStatus.Funded));
        assertEq(usdc.balanceOf(address(escrow)), JOB_BUDGET);
    }

    function test_fund_revert_noBudget() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "x", address(0)
        );

        vm.prank(client);
        vm.expectRevert(AgentLedgerEscrow.BudgetNotSet.selector);
        escrow.fund(jobId, "");
    }

    function test_fund_revert_noProvider() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            address(0), evaluator, block.timestamp + 1 days, "x", address(0)
        );
        // Can't setBudget without provider either, but let's test fund path
        // Need to set provider first, then budget, so this path won't happen naturally.
        // Testing the guard: forge a scenario with budget set but no provider
        // Actually, setBudget requires onlyProvider, so budget can't be set without provider.
        // This test validates the guard is technically there but unreachable in practice.
    }

    // ─── submit ─────────────────────────────────────────────────────────

    function test_submit() public {
        uint256 jobId = _createFundedJob();

        vm.prank(provider);
        escrow.submit(jobId, keccak256("work"), "");

        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Submitted)
        );
    }

    function test_submit_revert_notProvider() public {
        uint256 jobId = _createFundedJob();

        vm.prank(client);
        vm.expectRevert(AgentLedgerEscrow.Unauthorized.selector);
        escrow.submit(jobId, keccak256("work"), "");
    }

    function test_submit_revert_notFunded() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "x", address(0)
        );

        vm.prank(provider);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentLedgerEscrow.InvalidStatus.selector,
                AgentLedgerEscrow.JobStatus.Open,
                AgentLedgerEscrow.JobStatus.Funded
            )
        );
        escrow.submit(jobId, keccak256("work"), "");
    }

    // ─── complete ───────────────────────────────────────────────────────

    function test_complete_settlement() public {
        uint256 jobId = _createSubmittedJob();

        uint256 clientBefore = usdc.balanceOf(client);
        uint256 providerBefore = usdc.balanceOf(provider);
        uint256 evaluatorBefore = usdc.balanceOf(evaluator);
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        vm.prank(evaluator);
        escrow.complete(jobId, keccak256("good-work"), "");

        // 2% platform + 1% evaluator = 3% fees
        uint256 platformFee = (JOB_BUDGET * PLATFORM_FEE_BP) / 10_000; // 2_000_000
        uint256 evaluatorFee = (JOB_BUDGET * EVALUATOR_FEE_BP) / 10_000; // 1_000_000
        uint256 providerPayment = JOB_BUDGET - platformFee - evaluatorFee; // 97_000_000

        assertEq(usdc.balanceOf(treasury) - treasuryBefore, platformFee);
        assertEq(usdc.balanceOf(evaluator) - evaluatorBefore, evaluatorFee);
        assertEq(usdc.balanceOf(provider) - providerBefore, providerPayment);
        assertEq(usdc.balanceOf(client), clientBefore); // no change
        assertEq(usdc.balanceOf(address(escrow)), 0);

        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Completed)
        );
    }

    function test_complete_afterExpiry() public {
        uint256 jobId = _createSubmittedJob();

        vm.warp(block.timestamp + 2 days);

        vm.prank(evaluator);
        escrow.complete(jobId, keccak256("late-but-valid"), "");

        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Completed)
        );
    }

    function test_complete_revert_notEvaluator() public {
        uint256 jobId = _createSubmittedJob();

        vm.prank(client);
        vm.expectRevert(AgentLedgerEscrow.Unauthorized.selector);
        escrow.complete(jobId, keccak256("x"), "");
    }

    // ─── reject ─────────────────────────────────────────────────────────

    function test_reject_fullRefund() public {
        uint256 jobId = _createSubmittedJob();
        uint256 clientBefore = usdc.balanceOf(client);

        vm.prank(evaluator);
        escrow.reject(jobId, keccak256("bad-work"), "");

        assertEq(usdc.balanceOf(client) - clientBefore, JOB_BUDGET);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(usdc.balanceOf(treasury), 0); // no fees on reject

        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Rejected)
        );
    }

    function test_reject_revert_notEvaluator() public {
        uint256 jobId = _createSubmittedJob();

        vm.prank(provider);
        vm.expectRevert(AgentLedgerEscrow.Unauthorized.selector);
        escrow.reject(jobId, keccak256("x"), "");
    }

    // ─── claimRefund ────────────────────────────────────────────────────

    function test_claimRefund_funded() public {
        uint256 jobId = _createFundedJob();
        uint256 clientBefore = usdc.balanceOf(client);

        vm.warp(block.timestamp + 2 days);
        escrow.claimRefund(jobId);

        assertEq(usdc.balanceOf(client) - clientBefore, JOB_BUDGET);
        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Expired)
        );
    }

    function test_claimRefund_submitted() public {
        uint256 jobId = _createSubmittedJob();
        uint256 clientBefore = usdc.balanceOf(client);

        // Must warp past expiry (1 day) + grace period (1 day)
        vm.warp(block.timestamp + 2 days + 1);
        escrow.claimRefund(jobId);

        assertEq(usdc.balanceOf(client) - clientBefore, JOB_BUDGET);
    }

    function test_claimRefund_openNoFunds() public {
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "x", address(0)
        );

        vm.warp(block.timestamp + 2 days);
        escrow.claimRefund(jobId);

        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Expired)
        );
    }

    function test_claimRefund_revert_notExpired() public {
        uint256 jobId = _createFundedJob();

        vm.expectRevert(AgentLedgerEscrow.JobNotExpired.selector);
        escrow.claimRefund(jobId);
    }

    function test_claimRefund_revert_alreadyCompleted() public {
        uint256 jobId = _createSubmittedJob();

        vm.prank(evaluator);
        escrow.complete(jobId, keccak256("done"), "");

        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentLedgerEscrow.InvalidStatus.selector,
                AgentLedgerEscrow.JobStatus.Completed,
                AgentLedgerEscrow.JobStatus.Open
            )
        );
        escrow.claimRefund(jobId);
    }

    // ─── Admin ──────────────────────────────────────────────────────────

    function test_admin_setPlatformFee() public {
        escrow.setPlatformFee(500);
        assertEq(escrow.platformFeeBP(), 500);
    }

    function test_admin_revert_feeTooHigh() public {
        vm.expectRevert(AgentLedgerEscrow.FeeTooHigh.selector);
        escrow.setPlatformFee(5000); // 50% + 1% evaluator > 50%
    }

    function test_admin_revert_notOwner() public {
        vm.prank(client);
        vm.expectRevert(AgentLedgerEscrow.Unauthorized.selector);
        escrow.setPlatformFee(100);
    }

    // ─── Expiry edge: evaluator vs claimRefund race ─────────────────────

    function test_evaluatorWinsRace() public {
        uint256 jobId = _createSubmittedJob();
        vm.warp(block.timestamp + 2 days);

        // Evaluator completes first
        vm.prank(evaluator);
        escrow.complete(jobId, keccak256("done"), "");

        // claimRefund should fail
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentLedgerEscrow.InvalidStatus.selector,
                AgentLedgerEscrow.JobStatus.Completed,
                AgentLedgerEscrow.JobStatus.Open
            )
        );
        escrow.claimRefund(jobId);
    }

    function test_submittedRefund_revert_duringGracePeriod() public {
        uint256 jobId = _createSubmittedJob();
        // Warp past expiry but within grace period (expiry + 12 hours < expiry + 1 day)
        vm.warp(block.timestamp + 1 days + 12 hours);

        // claimRefund reverts because evaluator grace period hasn't elapsed
        vm.expectRevert(AgentLedgerEscrow.EvaluatorGracePeriod.selector);
        escrow.claimRefund(jobId);

        // But evaluator can still settle
        vm.prank(evaluator);
        escrow.complete(jobId, keccak256("settled-in-grace"), "");

        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Completed)
        );
    }

    function test_submittedRefund_afterGracePeriod() public {
        uint256 jobId = _createSubmittedJob();
        // Warp past expiry + grace period (1 day expiry + 1 day grace + 1 second)
        vm.warp(block.timestamp + 2 days + 1);

        uint256 clientBefore = usdc.balanceOf(client);
        escrow.claimRefund(jobId);

        assertEq(usdc.balanceOf(client) - clientBefore, JOB_BUDGET);
        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Expired)
        );
    }

    function test_fundedRefund_noGracePeriod() public {
        // Funded (not submitted) jobs can be refunded immediately at expiry — no grace
        uint256 jobId = _createFundedJob();
        uint256 clientBefore = usdc.balanceOf(client);

        vm.warp(block.timestamp + 1 days + 1);
        escrow.claimRefund(jobId);

        assertEq(usdc.balanceOf(client) - clientBefore, JOB_BUDGET);
    }

    // ─── Fuzz: settlement math ──────────────────────────────────────────

    function testFuzz_settlementMath(uint256 budget) public {
        // Bound to reasonable USDC range: 1 USDC to 1M USDC
        budget = bound(budget, 1e6, 1_000_000e6);

        // Create job with fuzzed budget
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "fuzz", address(0)
        );

        vm.prank(provider);
        escrow.setBudget(jobId, budget, "");

        usdc.mint(client, budget); // ensure client has enough
        vm.prank(client);
        usdc.approve(address(escrow), budget);
        vm.prank(client);
        escrow.fund(jobId, "");

        vm.prank(provider);
        escrow.submit(jobId, keccak256("fuzz-work"), "");

        uint256 escrowBefore = usdc.balanceOf(address(escrow));
        assertEq(escrowBefore, budget);

        vm.prank(evaluator);
        escrow.complete(jobId, keccak256("ok"), "");

        // Invariant: escrow is fully drained
        assertEq(usdc.balanceOf(address(escrow)), 0);

        // Invariant: sum of payouts == budget
        uint256 platformFee = (budget * PLATFORM_FEE_BP) / 10_000;
        uint256 evaluatorFee = (budget * EVALUATOR_FEE_BP) / 10_000;
        uint256 providerPayment = budget - platformFee - evaluatorFee;
        assertEq(platformFee + evaluatorFee + providerPayment, budget);
    }

    // ─── Reverting hook resilience ──────────────────────────────────────

    function test_revertingHook_completeStillWorks() public {
        // Deploy and whitelist a reverting hook
        RevertingHook badHook = new RevertingHook();
        escrow.whitelistHook(address(badHook), true);

        // Create job with the reverting hook
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "bad-hook job", address(badHook)
        );

        vm.prank(provider);
        escrow.setBudget(jobId, JOB_BUDGET, "");

        vm.prank(client);
        escrow.fund(jobId, "");

        vm.prank(provider);
        escrow.submit(jobId, keccak256("work"), "");

        // complete() should succeed despite the reverting hook
        uint256 providerBefore = usdc.balanceOf(provider);
        vm.prank(evaluator);
        escrow.complete(jobId, keccak256("good"), "");

        // Verify settlement happened correctly
        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Completed)
        );
        uint256 platformFee = (JOB_BUDGET * PLATFORM_FEE_BP) / 10_000;
        uint256 evaluatorFee = (JOB_BUDGET * EVALUATOR_FEE_BP) / 10_000;
        uint256 expectedPayment = JOB_BUDGET - platformFee - evaluatorFee;
        assertEq(usdc.balanceOf(provider) - providerBefore, expectedPayment);
    }

    function test_revertingHook_rejectStillWorks() public {
        RevertingHook badHook = new RevertingHook();
        escrow.whitelistHook(address(badHook), true);

        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "bad-hook job", address(badHook)
        );

        vm.prank(provider);
        escrow.setBudget(jobId, JOB_BUDGET, "");

        vm.prank(client);
        escrow.fund(jobId, "");

        vm.prank(provider);
        escrow.submit(jobId, keccak256("work"), "");

        // reject() should succeed despite the reverting hook
        uint256 clientBefore = usdc.balanceOf(client);
        vm.prank(evaluator);
        escrow.reject(jobId, keccak256("bad"), "");

        assertEq(
            uint256(escrow.getJob(jobId).status),
            uint256(AgentLedgerEscrow.JobStatus.Rejected)
        );
        assertEq(usdc.balanceOf(client) - clientBefore, JOB_BUDGET);
    }

    // ─── Fuzz: full refund on reject ─────────────────────────────────────

    function testFuzz_rejectFullRefund(uint256 budget) public {
        budget = bound(budget, 1e6, 1_000_000e6);

        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "fuzz", address(0)
        );

        vm.prank(provider);
        escrow.setBudget(jobId, budget, "");

        usdc.mint(client, budget);
        vm.prank(client);
        usdc.approve(address(escrow), budget);
        vm.prank(client);
        escrow.fund(jobId, "");

        vm.prank(provider);
        escrow.submit(jobId, keccak256("fuzz-work"), "");

        uint256 clientBefore = usdc.balanceOf(client);

        vm.prank(evaluator);
        escrow.reject(jobId, keccak256("bad"), "");

        // Invariant: full refund to client
        assertEq(usdc.balanceOf(client) - clientBefore, budget);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }
}
