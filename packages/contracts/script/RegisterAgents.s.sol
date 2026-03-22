// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";

/// @title RegisterAgents — Register 3 agents on ERC-8004 Identity Registry
/// @dev Each agent uses a DIFFERENT wallet (self-feedback is blocked).
///      Usage: forge script packages/contracts/script/RegisterAgents.s.sol --rpc-url celo_sepolia --broadcast
contract RegisterAgents is Script {
    // ERC-8004 IdentityRegistry on Ethereum Sepolia (agents registered here via TypeScript)
    address constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    function run() external {
        // Three separate wallets
        uint256 orchestratorKey = vm.envUint("PRIVATE_KEY");
        uint256 workerKey = vm.envUint("WORKER_PRIVATE_KEY");
        uint256 sentinelKey = vm.envUint("SENTINEL_PRIVATE_KEY");

        IAgentRegistry registry = IAgentRegistry(IDENTITY_REGISTRY);

        // Register Orchestrator
        vm.startBroadcast(orchestratorKey);
        IAgentRegistry.Metadata[] memory orchMeta = new IAgentRegistry.Metadata[](2);
        orchMeta[0] = IAgentRegistry.Metadata("role", "orchestrator");
        orchMeta[1] = IAgentRegistry.Metadata("capabilities", "job_creation,worker_selection,verification");
        uint256 orchId = registry.register("https://agentledger.paracausal.tech/agents/orchestrator", orchMeta);
        vm.stopBroadcast();
        console.log("Orchestrator agent ID:", orchId);

        // Register Worker
        vm.startBroadcast(workerKey);
        IAgentRegistry.Metadata[] memory workerMeta = new IAgentRegistry.Metadata[](2);
        workerMeta[0] = IAgentRegistry.Metadata("role", "worker");
        workerMeta[1] = IAgentRegistry.Metadata("capabilities", "code_generation,research,data_analysis");
        uint256 workerId = registry.register("https://agentledger.paracausal.tech/agents/worker", workerMeta);
        vm.stopBroadcast();
        console.log("Worker agent ID:", workerId);

        // Register Sentinel
        vm.startBroadcast(sentinelKey);
        IAgentRegistry.Metadata[] memory sentMeta = new IAgentRegistry.Metadata[](2);
        sentMeta[0] = IAgentRegistry.Metadata("role", "sentinel");
        sentMeta[1] = IAgentRegistry.Metadata("capabilities", "evaluation,quality_assurance,reputation_management");
        uint256 sentId = registry.register("https://agentledger.paracausal.tech/agents/sentinel", sentMeta);
        vm.stopBroadcast();
        console.log("Sentinel agent ID:", sentId);
    }
}
