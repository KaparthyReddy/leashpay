// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockTUSD8} from "../src/MockTUSD8.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {AgentVault} from "../src/AgentVault.sol";

contract Deploy is Script {
    address constant AEVUM_TUSD8 = 0x456569838f1d43009A91ebA4263147Afd7233483;
    uint256 constant ANVIL_CHAIN = 31337;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address tokenAddr = vm.envOr("TUSD8_ADDRESS", AEVUM_TUSD8);

        vm.startBroadcast(pk);
        if (tokenAddr.code.length == 0) {
            require(block.chainid == ANVIL_CHAIN, "tUSD8 not found on this chain. Aevum testnet is chain 44005.");
            MockTUSD8 mock = new MockTUSD8();
            mock.mint(deployer, 1_000e6);
            tokenAddr = address(mock);
        }
        InvoiceRegistry registry = new InvoiceRegistry(IERC20(tokenAddr));
        AgentVault vault = new AgentVault(deployer, registry);
        vm.stopBroadcast();

        console2.log("chainId:", block.chainid);
        console2.log("Token:", tokenAddr);
        console2.log("InvoiceRegistry:", address(registry));
        console2.log("AgentVault:", address(vault));
        console2.log("Owner:", deployer);
        console2.log("Deploy block:", block.number);
    }
}
