// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {GiftToken} from "../src/GiftToken.sol";

contract GiftTokenTest is Test {
    GiftToken gift;
    address agent = makeAddr("agent");
    address pos = makeAddr("pos");
    address customer = makeAddr("customer");
    address other = makeAddr("other");

    uint256 campaignId;

    function setUp() public {
        gift = new GiftToken();
        gift.setMinter(agent);
        campaignId = gift.registerGiftCampaign("ipfs://pistacho", 0, false, pos);
    }

    function _mint(bytes32 claimId) internal returns (uint256) {
        vm.prank(agent);
        return gift.mint(customer, campaignId, claimId);
    }

    function test_mint_onlyMinter() public {
        vm.expectRevert(GiftToken.NotMinter.selector);
        gift.mint(customer, campaignId, keccak256("c1"));
    }

    function test_mint_andRedeem() public {
        uint256 id = _mint(keccak256("c1"));
        assertEq(gift.balanceOf(customer, id), 1);
        assertEq(gift.uri(id), "ipfs://pistacho");

        vm.prank(pos);
        gift.redeem(id, customer);
        assertEq(gift.balanceOf(customer, id), 0);
        assertTrue(gift.redeemed(id));
    }

    function test_redeem_onlyRedeemer() public {
        uint256 id = _mint(keccak256("c1"));
        vm.expectRevert(GiftToken.NotRedeemer.selector);
        gift.redeem(id, customer);
    }

    function test_redeem_rejectsSecondAttempt() public {
        uint256 id = _mint(keccak256("c1"));
        vm.prank(pos);
        gift.redeem(id, customer);
        vm.prank(pos);
        vm.expectRevert(GiftToken.AlreadyRedeemed.selector);
        gift.redeem(id, customer);
    }

    function test_mint_rejectsReusedClaim() public {
        _mint(keccak256("c1"));
        vm.prank(agent);
        vm.expectRevert(GiftToken.ClaimAlreadyUsed.selector);
        gift.mint(customer, campaignId, keccak256("c1"));
    }

    function test_nonTransferable_blocksTransfer() public {
        uint256 id = _mint(keccak256("c1"));
        vm.prank(customer);
        vm.expectRevert(GiftToken.NotTransferable.selector);
        gift.safeTransferFrom(customer, other, id, 1, "");
    }

    function test_transferable_allowsTransfer() public {
        uint256 c2 = gift.registerGiftCampaign("ipfs://x", 0, true, pos);
        vm.prank(agent);
        uint256 id = gift.mint(customer, c2, keccak256("t1"));
        vm.prank(customer);
        gift.safeTransferFrom(customer, other, id, 1, "");
        assertEq(gift.balanceOf(other, id), 1);
    }

    function test_expiredCampaign_blocksMint() public {
        uint256 c3 =
            gift.registerGiftCampaign("ipfs://y", uint64(block.timestamp + 1 days), false, pos);
        vm.warp(block.timestamp + 2 days);
        vm.prank(agent);
        vm.expectRevert(GiftToken.Expired.selector);
        gift.mint(customer, c3, keccak256("e1"));
    }
}
