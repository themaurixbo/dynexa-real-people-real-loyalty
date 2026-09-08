// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {CampaignTreasuryFactory} from "../src/CampaignTreasuryFactory.sol";
import {CampaignTreasury} from "../src/CampaignTreasury.sol";
import {MockUSDC} from "../src/test/MockUSDC.sol";

contract CampaignTreasuryTest is Test {
    MockUSDC usdc;
    CampaignTreasuryFactory factory;
    CampaignTreasury treasury;

    address business = makeAddr("business");
    address agent = makeAddr("agent");
    address customer = makeAddr("customer");

    uint256 constant PER_TX = 5e6; // 5 USDC
    uint256 constant TOTAL = 500e6; // 500 USDC

    function setUp() public {
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

    function _pay(bytes32 claimId, uint256 amount) internal {
        vm.prank(agent);
        treasury.payout(claimId, customer, keccak256("nullifier"), keccak256("receipt"), amount);
    }

    function test_factory_indexesCampaign() public view {
        assertEq(factory.campaignCount(), 1);
        assertEq(factory.getCampaigns(business)[0], address(treasury));
        assertEq(treasury.business(), business);
        assertEq(treasury.agent(), agent);
    }

    function test_fund_increasesBalance() public view {
        assertEq(treasury.balance(), TOTAL);
    }

    function test_payout_valid() public {
        _pay(keccak256("c1"), 5e6);
        assertEq(usdc.balanceOf(customer), 5e6);
        assertEq(treasury.totalPaidOut(), 5e6);
        assertTrue(treasury.claimUsed(keccak256("c1")));
    }

    function test_payout_onlyAgent() public {
        vm.expectRevert(CampaignTreasury.NotAgent.selector);
        treasury.payout(keccak256("c1"), customer, bytes32(0), bytes32(0), 5e6);
    }

    function test_payout_rejectsOverPerTxLimit() public {
        vm.prank(agent);
        vm.expectRevert(CampaignTreasury.OverPerTxLimit.selector);
        treasury.payout(keccak256("c1"), customer, bytes32(0), bytes32(0), 5e6 + 1);
    }

    function test_payout_rejectsOverCampaignLimit() public {
        for (uint256 i = 0; i < 100; i++) {
            _pay(keccak256(abi.encode("c", i)), 5e6);
        }
        assertEq(treasury.totalPaidOut(), TOTAL);
        vm.prank(agent);
        vm.expectRevert(CampaignTreasury.OverCampaignLimit.selector);
        treasury.payout(keccak256("over"), customer, bytes32(0), bytes32(0), 5e6);
    }

    function test_payout_rejectsReplay() public {
        _pay(keccak256("c1"), 5e6);
        vm.prank(agent);
        vm.expectRevert(CampaignTreasury.ClaimAlreadyUsed.selector);
        treasury.payout(keccak256("c1"), customer, bytes32(0), bytes32(0), 5e6);
    }

    function test_payout_blockedWhenPaused() public {
        vm.prank(business);
        treasury.setPaused(true);
        vm.prank(agent);
        vm.expectRevert(CampaignTreasury.IsPaused.selector);
        treasury.payout(keccak256("c1"), customer, bytes32(0), bytes32(0), 5e6);
    }

    function test_setAgent_onlyBusiness() public {
        vm.expectRevert(CampaignTreasury.NotBusiness.selector);
        treasury.setAgent(address(1));

        vm.prank(business);
        treasury.setAgent(address(1));
        assertEq(treasury.agent(), address(1));
    }

    function test_close_returnsRemainderToBusiness() public {
        _pay(keccak256("c1"), 5e6);
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
