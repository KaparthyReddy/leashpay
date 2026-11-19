// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract InvoiceRegistry is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Open,
        Paid,
        Cancelled
    }

    struct Invoice {
        address merchant;
        address payer;
        uint128 amount;
        uint64 expiresAt;
        Status status;
        bytes32 ref;
    }

    IERC20 public immutable token;
    uint256 public nextInvoiceId = 1;
    mapping(uint256 => Invoice) private _invoices;

    event InvoiceCreated(
        uint256 indexed id, address indexed merchant, address indexed payer, uint256 amount, uint64 expiresAt, bytes32 ref
    );
    event InvoiceCancelled(uint256 indexed id, address indexed merchant);
    event InvoicePaid(uint256 indexed id, address indexed merchant, address indexed payer, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error AlreadyExpired();
    error NotMerchant();
    error NotOpen();
    error InvoiceExpired();
    error WrongPayer();

    constructor(IERC20 token_) {
        if (address(token_) == address(0)) revert ZeroAddress();
        token = token_;
    }

    function createInvoice(address payer, uint128 amount, uint64 expiresAt, bytes32 ref)
        external
        returns (uint256 id)
    {
        if (amount == 0) revert ZeroAmount();
        if (expiresAt <= block.timestamp) revert AlreadyExpired();
        id = nextInvoiceId++;
        _invoices[id] = Invoice({
            merchant: msg.sender,
            payer: payer,
            amount: amount,
            expiresAt: expiresAt,
            status: Status.Open,
            ref: ref
        });
        emit InvoiceCreated(id, msg.sender, payer, amount, expiresAt, ref);
    }

    function cancelInvoice(uint256 id) external {
        Invoice storage inv = _invoices[id];
        if (inv.merchant != msg.sender) revert NotMerchant();
        if (inv.status != Status.Open) revert NotOpen();
        inv.status = Status.Cancelled;
        emit InvoiceCancelled(id, msg.sender);
    }

    function settle(uint256 id) external nonReentrant {
        Invoice storage inv = _invoices[id];
        if (inv.status != Status.Open) revert NotOpen();
        if (block.timestamp > inv.expiresAt) revert InvoiceExpired();
        if (inv.payer != address(0) && inv.payer != msg.sender) revert WrongPayer();
        inv.status = Status.Paid;
        token.safeTransferFrom(msg.sender, inv.merchant, inv.amount);
        emit InvoicePaid(id, inv.merchant, msg.sender, inv.amount);
    }

    function getInvoice(uint256 id) external view returns (Invoice memory) {
        return _invoices[id];
    }
}
