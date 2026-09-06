// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CampaignTreasury} from "./CampaignTreasury.sol";

/// @title CampaignTreasuryFactory
/// @notice Deploys one CampaignTreasury per loyalty campaign and keeps an index
///         by business address.
contract CampaignTreasuryFactory {
    address[] public allCampaigns;
    mapping(address => address[]) public campaignsByBusiness;

    event CampaignCreated(
        address indexed treasury,
        address indexed business,
        address usdc,
        address agentSigner,
        uint256 perTxLimit,
        uint256 campaignTotalLimit
    );

    function createCampaign(
        address usdc,
        address agentSigner,
        uint256 perTxLimit,
        uint256 campaignTotalLimit
    ) external returns (address treasury) {
        treasury = address(
            new CampaignTreasury(usdc, msg.sender, agentSigner, perTxLimit, campaignTotalLimit)
        );
        allCampaigns.push(treasury);
        campaignsByBusiness[msg.sender].push(treasury);
        emit CampaignCreated(
            treasury, msg.sender, usdc, agentSigner, perTxLimit, campaignTotalLimit
        );
    }

    function campaignCount() external view returns (uint256) {
        return allCampaigns.length;
    }

    function getCampaigns(address business) external view returns (address[] memory) {
        return campaignsByBusiness[business];
    }
}
