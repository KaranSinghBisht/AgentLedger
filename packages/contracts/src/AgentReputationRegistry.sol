// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract AgentReputationRegistry {
    struct Feedback {
        address client;
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
    }

    mapping(uint256 => Feedback[]) private _feedbacks;
    mapping(uint256 => mapping(address => bool)) private _clientExists;
    mapping(uint256 => address[]) private _clients;

    event FeedbackGiven(uint256 indexed agentId, address indexed client, int128 value);

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        _feedbacks[agentId].push(Feedback(msg.sender, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash));
        if (!_clientExists[agentId][msg.sender]) {
            _clientExists[agentId][msg.sender] = true;
            _clients[agentId].push(msg.sender);
        }
        emit FeedbackGiven(agentId, msg.sender, value);
    }

    function getClients(uint256 agentId) external view returns (address[] memory) {
        return _clients[agentId];
    }

    function getSummary(uint256 agentId, address[] calldata clientAddresses) external view returns (uint256 totalFeedbacks, int128 averageValue, uint8 averageValueDecimals) {
        Feedback[] storage feedbacks = _feedbacks[agentId];
        totalFeedbacks = feedbacks.length;
        if (totalFeedbacks == 0) return (0, 0, 0);
        int256 sum = 0;
        for (uint256 i = 0; i < totalFeedbacks; i++) {
            sum += int256(feedbacks[i].value);
        }
        averageValue = int128(sum / int256(totalFeedbacks));
        averageValueDecimals = 0;
    }
}
