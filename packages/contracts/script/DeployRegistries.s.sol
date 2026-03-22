// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AgentIdentityRegistry} from "../src/AgentIdentityRegistry.sol";
import {AgentReputationRegistry} from "../src/AgentReputationRegistry.sol";

contract DeployRegistries is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        AgentIdentityRegistry identity = new AgentIdentityRegistry();
        AgentReputationRegistry reputation = new AgentReputationRegistry();
        vm.stopBroadcast();
        console.log("IdentityRegistry:", address(identity));
        console.log("ReputationRegistry:", address(reputation));
    }
}
