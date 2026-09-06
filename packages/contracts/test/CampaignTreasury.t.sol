// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CampaignTreasuryFactory} from "../src/CampaignTreasuryFactory.sol";
import {CampaignTreasury} from "../src/CampaignTreasury.sol";
import {MockUSDC} from "../src/test/MockUSDC.sol";

contract CampaignTreasuryTest is Test {
    bytes32 constant AUTH_TYPEHASH = keccak256(
        "RewardAuthorization(bytes32 claimId,address customer,bytes32 nullifierHash,bytes32 receiptHash,uint256 amount,uint256 giftTokenId,uint256 deadline)"
    );

    MockUSDC usdc;
    CampaignTreasuryFactory factory;
    CampaignTreasury treasury;

    address business = makeAddr("business");
    address customer = makeAddr("customer");
    uint256 agentPk = 0xA11CE;
    address agent;

    uint256 constant PER_TX = 5e6; // 5 USDC
    uint256 constant TOTAL = 500e6; // 500 USDC

    function setUp() public {
        agent = vm.addr(agentPk);
        usdc = new MockUSDC();
        factory = new CampaignTreasuryFactory();

        vm.prank(business);
        treasury = CampaignTreasury(factory.createCampaign(address(usdc), agent, PER_TX, TOTAL));

        usdc.mint(business, TOTAL);
        vm.startPrank(business);
        usdc.approve(address(treasury), TOTAL);
        treasury.fund(TOTAL);
        vm.stopPrank();
    }

    // --- helpers ---

    function _auth(bytes32 claimId, uint256 amount)
        internal
        view
        returns (CampaignTreasury.RewardAuthorization memory a)
    {
        a = CampaignTreasury.RewardAuthorization({
            claimId: claimId,
            customer: customer,
            nullifierHash: keccak256("nullifier"),
            receiptHash: keccak256("receipt"),
            amount: amount,
            giftTokenId: 1,
            deadline: block.timestamp + 1 hours
        });
    }

    function _sign(CampaignTreasury.RewardAuthorization memory a, uint256 pk)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                AUTH_TYPEHASH,
                a.claimId,
                a.customer,
                a.nullifierHash,
                a.receiptHash,
                a.amount,
                a.giftTokenId,
                a.deadline
            )
        );
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", treasury.domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    // --- tests ---

    function test_factory_indexesCampaign() public view {
        assertEq(factory.campaignCount(), 1);
        assertEq(factory.getCampaigns(business)[0], address(treasury));
        assertEq(treasury.business(), business);
    }

    function test_fund_increasesBalance() public view {
        assertEq(treasury.balance(), TOTAL);
    }

    function test_payout_valid() public {
        CampaignTreasury.RewardAuthorization memory a = _auth(keccak256("c1"), 5e6);
        treasury.payout(a, _sign(a, agentPk));

        assertEq(usdc.balanceOf(customer), 5e6);
        assertEq(treasury.totalPaidOut(), 5e6);
        assertTrue(treasury.claimUsed(a.claimId));
    }

    function test_payout_rejectsOverPerTxLimit() public {
        CampaignTreasury.RewardAuthorization memory a = _auth(keccak256("c1"), 5e6 + 1);
        bytes memory sig = _sign(a, agentPk);
        vm.expectRevert(CampaignTreasury.OverPerTxLimit.selector);
        treasury.payout(a, sig);
    }

    function test_payout_rejectsOverCampaignLimit() public {
        // per-tx allows 5, campaign total 500 -> 100 payouts max. 101st must fail.
        for (uint256 i = 0; i < 100; i++) {
            CampaignTreasury.RewardAuthorization memory a =
                _auth(keccak256(abi.encode("c", i)), 5e6);
            treasury.payout(a, _sign(a, agentPk));
        }
        assertEq(treasury.totalPaidOut(), TOTAL);

        CampaignTreasury.RewardAuthorization memory over = _auth(keccak256("over"), 5e6);
        bytes memory sig = _sign(over, agentPk);
        vm.expectRevert(CampaignTreasury.OverCampaignLimit.selector);
        treasury.payout(over, sig);
    }

    function test_payout_rejectsReplay() public {
        CampaignTreasury.RewardAuthorization memory a = _auth(keccak256("c1"), 5e6);
        bytes memory sig = _sign(a, agentPk);
        treasury.payout(a, sig);
        vm.expectRevert(CampaignTreasury.ClaimAlreadyUsed.selector);
        treasury.payout(a, sig);
    }

    function test_payout_rejectsUnauthorizedSigner() public {
        CampaignTreasury.RewardAuthorization memory a = _auth(keccak256("c1"), 5e6);
        bytes memory sig = _sign(a, 0xB0B);
        vm.expectRevert(CampaignTreasury.BadSigner.selector);
        treasury.payout(a, sig);
    }

    function test_payout_rejectsExpiredAuth() public {
        CampaignTreasury.RewardAuthorization memory a = _auth(keccak256("c1"), 5e6);
        bytes memory sig = _sign(a, agentPk);
        vm.warp(a.deadline + 1);
        vm.expectRevert(CampaignTreasury.AuthExpired.selector);
        treasury.payout(a, sig);
    }

    function test_payout_blockedWhenPaused() public {
        CampaignTreasury.RewardAuthorization memory a = _auth(keccak256("c1"), 5e6);
        bytes memory sig = _sign(a, agentPk);

        vm.prank(business);
        treasury.setPaused(true);

        vm.expectRevert(CampaignTreasury.IsPaused.selector);
        treasury.payout(a, sig);
    }

    function test_close_returnsRemainderToBusiness() public {
        CampaignTreasury.RewardAuthorization memory a = _auth(keccak256("c1"), 5e6);
        treasury.payout(a, _sign(a, agentPk));

        vm.prank(business);
        treasury.close();

        assertEq(usdc.balanceOf(business), TOTAL - 5e6);
        assertEq(treasury.balance(), 0);
        assertTrue(treasury.closed());
    }

    function test_close_onlyBusiness() public {
        vm.expectRevert(CampaignTreasury.NotBusiness.selector);
        treasury.close();
    }
}
