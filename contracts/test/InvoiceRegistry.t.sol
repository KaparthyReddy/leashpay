// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockTUSD8} from "../src/MockTUSD8.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";

contract InvoiceRegistryTest is Test {
    MockTUSD8 token;
    InvoiceRegistry registry;

    address merchant = makeAddr("merchant");
    address payer = makeAddr("payer");
    address other = makeAddr("other");

    function setUp() public {
        token = new MockTUSD8();
        registry = new InvoiceRegistry(token);
        token.mint(payer, 1_000e6);
        token.mint(other, 1_000e6);
        vm.prank(payer);
        token.approve(address(registry), type(uint256).max);
        vm.prank(other);
        token.approve(address(registry), type(uint256).max);
    }

    function _create(address restrictTo) internal returns (uint256) {
        vm.prank(merchant);
        return registry.createInvoice(restrictTo, 100e6, uint64(block.timestamp + 1 days), keccak256("ref"));
    }

    function test_CreateAndSettle() public {
        uint256 id = _create(address(0));
        vm.prank(payer);
        registry.settle(id);
        assertEq(token.balanceOf(merchant), 100e6);
        assertEq(uint8(registry.getInvoice(id).status), uint8(InvoiceRegistry.Status.Paid));
    }

    function test_RestrictedPayer() public {
        uint256 id = _create(payer);
        vm.prank(other);
        vm.expectRevert(InvoiceRegistry.WrongPayer.selector);
        registry.settle(id);
        vm.prank(payer);
        registry.settle(id);
    }

    function test_CannotSettleTwice() public {
        uint256 id = _create(address(0));
        vm.startPrank(payer);
        registry.settle(id);
        vm.expectRevert(InvoiceRegistry.NotOpen.selector);
        registry.settle(id);
        vm.stopPrank();
    }

    function test_CannotSettleExpired() public {
        uint256 id = _create(address(0));
        vm.warp(block.timestamp + 2 days);
        vm.prank(payer);
        vm.expectRevert(InvoiceRegistry.InvoiceExpired.selector);
        registry.settle(id);
    }

    function test_CancelOnlyMerchant() public {
        uint256 id = _create(address(0));
        vm.prank(other);
        vm.expectRevert(InvoiceRegistry.NotMerchant.selector);
        registry.cancelInvoice(id);
        vm.prank(merchant);
        registry.cancelInvoice(id);
        vm.prank(payer);
        vm.expectRevert(InvoiceRegistry.NotOpen.selector);
        registry.settle(id);
    }

    function test_RevertWhen_ZeroAmountOrPastExpiry() public {
        vm.startPrank(merchant);
        vm.expectRevert(InvoiceRegistry.ZeroAmount.selector);
        registry.createInvoice(address(0), 0, uint64(block.timestamp + 1 days), bytes32(0));
        vm.expectRevert(InvoiceRegistry.AlreadyExpired.selector);
        registry.createInvoice(address(0), 1, uint64(block.timestamp), bytes32(0));
        vm.stopPrank();
    }
}
