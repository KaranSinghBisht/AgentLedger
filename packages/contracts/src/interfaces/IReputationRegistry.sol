// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IReputationRegistry — ERC-8004 Reputation Registry (subset)
/// @notice Minimal interface for writing and querying agent reputation
/// @dev Uses int128 value (not int64) and string tags (not bytes32) per spec
interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    /// @dev Requires explicit clientAddresses array — call getClients() first
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses
    ) external view returns (
        uint256 totalFeedbacks,
        int128 averageValue,
        uint8 averageValueDecimals
    );

    function getClients(uint256 agentId) external view returns (address[] memory);

    function getFeedback(
        uint256 agentId,
        address clientAddress,
        uint256 feedbackIndex
    ) external view returns (
        int128 value,
        uint8 valueDecimals,
        string memory tag1,
        string memory tag2,
        string memory endpoint,
        string memory feedbackURI,
        bytes32 feedbackHash,
        uint256 timestamp
    );
}
