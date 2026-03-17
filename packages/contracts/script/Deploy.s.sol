// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AgentLedgerEscrow} from "../src/AgentLedgerEscrow.sol";
import {MarketplaceHook} from "../src/MarketplaceHook.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @title Deploy — Celo Alfajores / Mainnet deployment
/// @dev Alfajores: deploys MockERC20 as payment token (no faucet USDC available)
///      Mainnet:   uses real USDC
///      Usage: forge script packages/contracts/script/Deploy.s.sol --rpc-url celo_sepolia --broadcast
contract Deploy is Script {
    address constant CELO_USDC = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C;

    uint256 constant PLATFORM_FEE_BP = 200; // 2%
    uint256 constant EVALUATOR_FEE_BP = 100; // 1%
    uint256 constant MINT_AMOUNT = 10_000e6; // 10,000 tUSDC to deployer

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address treasury = deployer;

        vm.startBroadcast(deployerKey);

        address paymentToken;
        if (block.chainid == 42220) {
            // Mainnet: use real USDC
            paymentToken = CELO_USDC;
        } else {
            // Testnet: deploy our own MockERC20
            MockERC20 mockUsdc = new MockERC20("Test USDC", "tUSDC", 6);
            mockUsdc.mint(deployer, MINT_AMOUNT);
            paymentToken = address(mockUsdc);
        }

        AgentLedgerEscrow escrow = new AgentLedgerEscrow(
            paymentToken,
            treasury,
            PLATFORM_FEE_BP,
            EVALUATOR_FEE_BP
        );

        MarketplaceHook hook = new MarketplaceHook(address(escrow));
        escrow.whitelistHook(address(hook), true);

        vm.stopBroadcast();

        console.log("=== Deployed Contracts ===");
        console.log("Payment Token:", paymentToken);
        console.log("Escrow:", address(escrow));
        console.log("Hook:", address(hook));
        console.log("Treasury:", treasury);
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
    }
}
