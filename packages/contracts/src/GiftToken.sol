// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title GiftToken
/// @notice One branded gift per issuance (ERC-1155, amount 1, unique id). Minted
///         by the agent on an approved claim, redeemed once by the campaign's
///         redeemer (the POS), then burned. A second redemption reverts.
contract GiftToken is ERC1155, Ownable {
    struct GiftCampaign {
        string uri;
        uint64 expiry; // 0 = no expiry
        bool transferable;
        address redeemer; // who can redeem at the point of sale
        bool exists;
    }

    address public minter;
    uint256 public nextCampaignId = 1;
    uint256 public nextTokenId = 1;

    mapping(uint256 => GiftCampaign) public campaigns;
    mapping(uint256 => uint256) public campaignOf; // tokenId => campaignId
    mapping(uint256 => bool) public redeemed; // tokenId => redeemed
    mapping(bytes32 => bool) public claimUsed; // claimId => minted

    event GiftCampaignRegistered(uint256 indexed campaignId, address redeemer, uint64 expiry);
    event MinterUpdated(address indexed minter);
    event GiftMinted(
        uint256 indexed tokenId, uint256 indexed campaignId, address indexed to, bytes32 claimId
    );
    event GiftRedeemed(uint256 indexed tokenId, uint256 indexed campaignId, address indexed holder);

    error NotMinter();
    error NotRedeemer();
    error UnknownCampaign();
    error Expired();
    error AlreadyRedeemed();
    error ClaimAlreadyUsed();
    error NotHolder();
    error NotTransferable();

    constructor() ERC1155("") Ownable(msg.sender) {}

    function setMinter(address m) external onlyOwner {
        minter = m;
        emit MinterUpdated(m);
    }

    function registerGiftCampaign(
        string calldata metadataUri,
        uint64 expiry,
        bool transferable,
        address redeemer
    ) external onlyOwner returns (uint256 campaignId) {
        campaignId = nextCampaignId++;
        campaigns[campaignId] = GiftCampaign({
            uri: metadataUri,
            expiry: expiry,
            transferable: transferable,
            redeemer: redeemer,
            exists: true
        });
        emit GiftCampaignRegistered(campaignId, redeemer, expiry);
    }

    function mint(address to, uint256 campaignId, bytes32 claimId)
        external
        returns (uint256 tokenId)
    {
        if (msg.sender != minter) revert NotMinter();
        GiftCampaign storage c = campaigns[campaignId];
        if (!c.exists) revert UnknownCampaign();
        if (c.expiry != 0 && block.timestamp > c.expiry) revert Expired();
        if (claimUsed[claimId]) revert ClaimAlreadyUsed();

        claimUsed[claimId] = true;
        tokenId = nextTokenId++;
        campaignOf[tokenId] = campaignId;
        _mint(to, tokenId, 1, "");
        emit GiftMinted(tokenId, campaignId, to, claimId);
    }

    /// @notice Redeem a gift at the point of sale. Only the campaign's redeemer.
    function redeem(uint256 tokenId, address holder) external {
        uint256 campaignId = campaignOf[tokenId];
        GiftCampaign storage c = campaigns[campaignId];
        if (!c.exists) revert UnknownCampaign();
        if (msg.sender != c.redeemer) revert NotRedeemer();
        if (redeemed[tokenId]) revert AlreadyRedeemed();
        if (balanceOf(holder, tokenId) != 1) revert NotHolder();
        if (c.expiry != 0 && block.timestamp > c.expiry) revert Expired();

        redeemed[tokenId] = true;
        _burn(holder, tokenId, 1);
        emit GiftRedeemed(tokenId, campaignId, holder);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return campaigns[campaignOf[tokenId]].uri;
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
    {
        // block wallet-to-wallet transfers for non-transferable campaigns; mint
        // (from == 0) and burn (to == 0) are always allowed
        if (from != address(0) && to != address(0)) {
            for (uint256 i = 0; i < ids.length; i++) {
                if (!campaigns[campaignOf[ids[i]]].transferable) revert NotTransferable();
            }
        }
        super._update(from, to, ids, values);
    }
}
