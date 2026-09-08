// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {GiftToken} from "../src/GiftToken.sol";

/// forge script script/DeployGiftToken.s.sol --rpc-url $ARC_RPC_URL --broadcast
/// Env: DEPLOYER_PRIVATE_KEY, AGENT_WALLET_ADDRESS (the Circle Agent Wallet)
contract DeployGiftToken is Script {
    function run() external returns (address gift) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address agent = vm.envAddress("AGENT_WALLET_ADDRESS");

        vm.startBroadcast(pk);
        GiftToken g = new GiftToken();
        g.setMinter(agent);
        vm.stopBroadcast();

        gift = address(g);
        console2.log("GiftToken:", gift);
        console2.log("minter:", agent);
    }
}
