// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title AgentIdentityRegistry
/// @notice ERC-8004-compatible identity registry for AI agents on Celo.
///         Lightweight implementation without ERC721 to stay paris-compatible.
contract AgentIdentityRegistry {
    struct Metadata {
        string key;
        string value;
    }

    uint256 public nextAgentId;
    mapping(uint256 => address) private _owners;
    mapping(uint256 => string) private _agentURIs;
    mapping(uint256 => Metadata[]) private _metadata;
    mapping(address => uint256) private _balances;

    event Registered(uint256 indexed agentId, address indexed owner, string agentURI);

    function register(string calldata agentURI, Metadata[] calldata metadata) external returns (uint256 agentId) {
        agentId = nextAgentId++;
        _owners[agentId] = msg.sender;
        _balances[msg.sender]++;
        _agentURIs[agentId] = agentURI;
        for (uint256 i = 0; i < metadata.length; i++) {
            _metadata[agentId].push(metadata[i]);
        }
        emit Registered(agentId, msg.sender, agentURI);
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        address owner = _owners[agentId];
        require(owner != address(0), "AgentIdentityRegistry: nonexistent agent");
        return owner;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balances[owner];
    }

    function getIdentity(uint256 agentId) external view returns (address owner, string memory agentURI, Metadata[] memory metadata) {
        owner = _owners[agentId];
        require(owner != address(0), "AgentIdentityRegistry: nonexistent agent");
        agentURI = _agentURIs[agentId];
        metadata = _metadata[agentId];
    }
}
