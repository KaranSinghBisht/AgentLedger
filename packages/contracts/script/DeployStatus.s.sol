// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AgentLedgerEscrow} from "../src/AgentLedgerEscrow.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @title DeployStatus — Status Network Sepolia deployment ($50 bounty)
/// @dev Gas is literally 0 on Status Network. Deploy + gasless tx proof.
///      Usage: forge script packages/contracts/script/DeployStatus.s.sol \
///             --rpc-url https://public.sepolia.rpc.status.network --broadcast
contract DeployStatus is Script {
    uint256 constant PLATFORM_FEE_BP = 200;
    uint256 constant EVALUATOR_FEE_BP = 100;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // Deploy a mock USDC since Status testnet has no native USDC
        MockERC20 mockUsdc = new MockERC20("Mock USDC", "mUSDC", 6);

        AgentLedgerEscrow escrow = new AgentLedgerEscrow(
            address(mockUsdc),
            deployer,
            PLATFORM_FEE_BP,
            EVALUATOR_FEE_BP
        );

        // Create a sample job as gasless tx proof (gasPrice=0 on Status)
        mockUsdc.mint(deployer, 100e6);
        mockUsdc.approve(address(escrow), type(uint256).max);

        vm.stopBroadcast();

        console.log("MockUSDC:", address(mockUsdc));
        console.log("Escrow:", address(escrow));
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
    }
}
