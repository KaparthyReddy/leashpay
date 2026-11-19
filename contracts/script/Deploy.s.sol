// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockTUSD8} from "../src/MockTUSD8.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {AgentVault} from "../src/AgentVault.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address tokenAddr = vm.envOr("TUSD8_ADDRESS", address(0));

        vm.startBroadcast(pk);
        if (tokenAddr == address(0)) {
            MockTUSD8 mock = new MockTUSD8();
            tokenAddr = address(mock);
            console2.log("MockTUSD8:", tokenAddr);
        }
        InvoiceRegistry registry = new InvoiceRegistry(IERC20(tokenAddr));
        AgentVault vault = new AgentVault(deployer, registry);
        vm.stopBroadcast();

        console2.log("Token:", tokenAddr);
        console2.log("InvoiceRegistry:", address(registry));
        console2.log("AgentVault:", address(vault));
        console2.log("Owner:", deployer);
    }
}
