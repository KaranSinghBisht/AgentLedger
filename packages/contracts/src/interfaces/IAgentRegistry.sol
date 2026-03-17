// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IAgentRegistry — ERC-8004 Identity Registry (subset)
/// @notice Minimal interface for registering and querying agent identities
interface IAgentRegistry {
    struct Metadata {
        string key;
        string value;
    }

    function register(
        string calldata agentURI,
        Metadata[] calldata metadata
    ) external returns (uint256 agentId);

    function getIdentity(uint256 agentId)
        external
        view
        returns (address owner, string memory agentURI, Metadata[] memory metadata);

    function updateAgentURI(uint256 agentId, string calldata agentURI) external;

    function addMetadata(uint256 agentId, Metadata[] calldata metadata) external;
}
