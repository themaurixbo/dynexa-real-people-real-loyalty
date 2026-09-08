// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CampaignTreasuryFactory} from "../src/CampaignTreasuryFactory.sol";
import {CampaignTreasury} from "../src/CampaignTreasury.sol";

/// @notice Creates a campaign on Arc, funds it, and pushes one signed payout.
///   forge script script/DemoCampaign.s.sol --rpc-url $ARC_RPC_URL --broadcast
/// Env: DEPLOYER_PRIVATE_KEY, FACTORY_ADDRESS, ARC_USDC_ADDRESS, CUSTOMER_ADDRESS
contract DemoCampaign is Script {
    uint256 constant PER_TX = 5_000_000; // 5 USDC
    uint256 constant TOTAL = 20_000_000; // 20 USDC
    uint256 constant FUND = 5_000_000; // 5 USDC
    uint256 constant PAYOUT = 1_000_000; // 1 USDC

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address signer = vm.addr(pk);
        CampaignTreasuryFactory factory = CampaignTreasuryFactory(vm.envAddress("FACTORY_ADDRESS"));
        IERC20 usdc = IERC20(vm.envAddress("ARC_USDC_ADDRESS"));
        address customer = vm.envAddress("CUSTOMER_ADDRESS");

        vm.startBroadcast(pk);

        address treasury = factory.createCampaign(address(usdc), signer, PER_TX, TOTAL);
        console2.log("treasury:", treasury);

        usdc.approve(treasury, FUND);
        CampaignTreasury(treasury).fund(FUND);
        console2.log("funded:", FUND);

        CampaignTreasury.RewardAuthorization memory auth = CampaignTreasury.RewardAuthorization({
            claimId: keccak256(abi.encode(block.timestamp, customer)),
            customer: customer,
            nullifierHash: keccak256("demo-nullifier"),
            receiptHash: keccak256("demo-receipt"),
            amount: PAYOUT,
            giftTokenId: 1,
            deadline: block.timestamp + 1 hours
        });

        bytes32 digest = _digest(CampaignTreasury(treasury).domainSeparator(), auth);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        CampaignTreasury(treasury).payout(auth, abi.encodePacked(r, s, v));
        console2.log("paid out:", PAYOUT, "to", customer);

        vm.stopBroadcast();
    }

    function _digest(bytes32 domainSeparator, CampaignTreasury.RewardAuthorization memory a)
        internal
        pure
        returns (bytes32)
    {
        bytes32 typeHash = keccak256(
            "RewardAuthorization(bytes32 claimId,address customer,bytes32 nullifierHash,bytes32 receiptHash,uint256 amount,uint256 giftTokenId,uint256 deadline)"
        );
        bytes32 structHash = keccak256(
            abi.encode(
                typeHash,
                a.claimId,
                a.customer,
                a.nullifierHash,
                a.receiptHash,
                a.amount,
                a.giftTokenId,
                a.deadline
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }
}
