// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {CampaignTreasuryFactory} from "../src/CampaignTreasuryFactory.sol";

/// @notice Deploys the factory. Run with:
///   forge script script/DeployFactory.s.sol --rpc-url $ARC_RPC_URL --broadcast
contract DeployFactory is Script {
    function run() external returns (address factory) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        factory = address(new CampaignTreasuryFactory());
        vm.stopBroadcast();
        console2.log("CampaignTreasuryFactory:", factory);
    }
}
