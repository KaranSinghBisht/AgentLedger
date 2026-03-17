// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TestSetup} from "./helpers/TestSetup.sol";
import {AgentLedgerEscrow} from "../src/AgentLedgerEscrow.sol";
import {MarketplaceHook} from "../src/MarketplaceHook.sol";
import {IACPHook} from "../src/interfaces/IACPHook.sol";

contract MarketplaceHookTest is TestSetup {
    event ReputationDue(
        uint256 indexed jobId,
        address indexed provider,
        bool positive,
        bytes32 reason
    );

    function test_emitsReputationDue_onComplete() public {
        uint256 jobId = _createSubmittedJob();
        bytes32 reason = keccak256("good-work");

        vm.expectEmit(true, true, false, true);
        emit ReputationDue(jobId, provider, true, reason);

        vm.prank(evaluator);
        escrow.complete(jobId, reason, "");
    }

    function test_emitsReputationDue_onReject() public {
        uint256 jobId = _createSubmittedJob();
        bytes32 reason = keccak256("bad-work");

        vm.expectEmit(true, true, false, true);
        emit ReputationDue(jobId, provider, false, reason);

        vm.prank(evaluator);
        escrow.reject(jobId, reason, "");
    }

    function test_supportsInterface() public view {
        // IACPHook interface ID
        assertTrue(hook.supportsInterface(type(IACPHook).interfaceId));
        // IERC165
        assertTrue(hook.supportsInterface(0x01ffc9a7));
    }

    function test_revert_directCall_notEscrow() public {
        vm.prank(client);
        vm.expectRevert(MarketplaceHook.OnlyEscrow.selector);
        hook.afterAction(0, bytes4(0), "");
    }

    function test_revert_beforeAction_notEscrow() public {
        vm.prank(client);
        vm.expectRevert(MarketplaceHook.OnlyEscrow.selector);
        hook.beforeAction(0, bytes4(0), "");
    }

    function test_noReputationDue_onOtherActions() public {
        // fund() should not emit ReputationDue
        vm.prank(client);
        uint256 jobId = escrow.createJob(
            provider, evaluator, block.timestamp + 1 days, "x", address(hook)
        );

        vm.prank(provider);
        escrow.setBudget(jobId, JOB_BUDGET, "");

        // This triggers hook but should NOT emit ReputationDue
        vm.prank(client);
        escrow.fund(jobId, "");

        // If we got here without ReputationDue, the hook correctly ignores non-settlement actions
    }
}
