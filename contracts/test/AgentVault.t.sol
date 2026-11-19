// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockTUSD8} from "../src/MockTUSD8.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {AgentVault} from "../src/AgentVault.sol";

contract AgentVaultTest is Test {
    MockTUSD8 token;
    InvoiceRegistry registry;
    AgentVault vault;

    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address merchant = makeAddr("merchant");
    address attacker = makeAddr("attacker");

    uint256 constant UNIT = 1e6;

    function setUp() public {
        token = new MockTUSD8();
        registry = new InvoiceRegistry(token);
        vault = new AgentVault(owner, registry);

        token.mint(owner, 10_000 * UNIT);
        vm.startPrank(owner);
        token.approve(address(vault), type(uint256).max);
        vault.deposit(1_000 * UNIT);
        vault.setPayee(merchant, true);
        vault.grantAgent(agent, uint64(block.timestamp + 7 days), uint128(200 * UNIT), uint128(300 * UNIT));
        vm.stopPrank();
    }

    function _invoice(address from, uint128 amount) internal returns (uint256 id) {
        vm.prank(from);
        id = registry.createInvoice(address(0), amount, uint64(block.timestamp + 1 days), keccak256("INV"));
    }

    function test_AgentPaysAllowlistedInvoice() public {
        uint256 id = _invoice(merchant, uint128(120 * UNIT));
        vm.prank(agent);
        vault.payInvoice(id, keccak256("verified payee"));
        assertEq(token.balanceOf(merchant), 120 * UNIT);
        assertEq(vault.balance(), 880 * UNIT);
        assertEq(uint8(registry.getInvoice(id).status), uint8(InvoiceRegistry.Status.Paid));
        assertEq(vault.remainingToday(agent), 180 * UNIT);
    }

    function test_RevertWhen_PayeeNotAllowed() public {
        uint256 id = _invoice(attacker, uint128(10 * UNIT));
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentVault.PayeeNotAllowed.selector, attacker));
        vault.payInvoice(id, bytes32(0));
    }

    function test_RevertWhen_PerTxCapExceeded() public {
        uint256 id = _invoice(merchant, uint128(250 * UNIT));
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(AgentVault.PerTxCapExceeded.selector, 250 * UNIT, 200 * UNIT));
        vault.payInvoice(id, bytes32(0));
    }

    function test_RevertWhen_DailyCapExceeded() public {
        uint256 a = _invoice(merchant, uint128(200 * UNIT));
        uint256 b = _invoice(merchant, uint128(150 * UNIT));
        vm.startPrank(agent);
        vault.payInvoice(a, bytes32(0));
        vm.expectRevert(abi.encodeWithSelector(AgentVault.DailyCapExceeded.selector, 350 * UNIT, 300 * UNIT));
        vault.payInvoice(b, bytes32(0));
        vm.stopPrank();
    }

    function test_DailyWindowResets() public {
        uint256 a = _invoice(merchant, uint128(200 * UNIT));
        vm.prank(agent);
        vault.payInvoice(a, bytes32(0));
        vm.warp(block.timestamp + 1 days + 1);
        uint256 b = _invoice(merchant, uint128(200 * UNIT));
        vm.prank(agent);
        vault.payInvoice(b, bytes32(0));
        assertEq(token.balanceOf(merchant), 400 * UNIT);
    }

    function test_RevertWhen_AgentRevoked() public {
        uint256 id = _invoice(merchant, uint128(10 * UNIT));
        vm.prank(owner);
        vault.revokeAgent(agent);
        vm.prank(agent);
        vm.expectRevert(AgentVault.NotActiveAgent.selector);
        vault.payInvoice(id, bytes32(0));
    }

    function test_RevertWhen_AgentExpired() public {
        uint256 id = _invoice(merchant, uint128(10 * UNIT));
        vm.warp(block.timestamp + 8 days);
        vm.prank(agent);
        vm.expectRevert(AgentVault.AgentExpired.selector);
        vault.payInvoice(id, bytes32(0));
    }

    function test_RevertWhen_Paused() public {
        uint256 id = _invoice(merchant, uint128(10 * UNIT));
        vm.prank(owner);
        vault.setPaused(true);
        vm.prank(agent);
        vm.expectRevert(AgentVault.VaultPaused.selector);
        vault.payInvoice(id, bytes32(0));
    }

    function test_RevertWhen_DoublePay() public {
        uint256 id = _invoice(merchant, uint128(10 * UNIT));
        vm.startPrank(agent);
        vault.payInvoice(id, bytes32(0));
        vm.expectRevert(AgentVault.InvoiceNotOpen.selector);
        vault.payInvoice(id, bytes32(0));
        vm.stopPrank();
    }

    function test_RevertWhen_StrangerPays() public {
        uint256 id = _invoice(merchant, uint128(10 * UNIT));
        vm.prank(attacker);
        vm.expectRevert(AgentVault.NotActiveAgent.selector);
        vault.payInvoice(id, bytes32(0));
    }

    function test_OnlyOwnerAdmin() public {
        vm.startPrank(attacker);
        vm.expectRevert();
        vault.withdraw(attacker, 1);
        vm.expectRevert();
        vault.setPayee(attacker, true);
        vm.expectRevert();
        vault.grantAgent(attacker, uint64(block.timestamp + 1 days), 1, 1);
        vm.stopPrank();
    }

    function test_OwnerWithdraw() public {
        vm.prank(owner);
        vault.withdraw(owner, 400 * UNIT);
        assertEq(vault.balance(), 600 * UNIT);
    }

    function test_InvalidPolicyReverts() public {
        vm.startPrank(owner);
        vm.expectRevert(AgentVault.InvalidPolicy.selector);
        vault.grantAgent(agent, uint64(block.timestamp + 1 days), uint128(100 * UNIT), uint128(50 * UNIT));
        vm.stopPrank();
    }

    function testFuzz_NeverExceedsPerTxCap(uint128 amount) public {
        amount = uint128(bound(amount, 200 * UNIT + 1, 5_000 * UNIT));
        uint256 id = _invoice(merchant, amount);
        vm.prank(agent);
        vm.expectRevert();
        vault.payInvoice(id, bytes32(0));
        assertEq(token.balanceOf(merchant), 0);
    }
}
