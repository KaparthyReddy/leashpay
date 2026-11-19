// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {InvoiceRegistry} from "./InvoiceRegistry.sol";

contract AgentVault is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Policy {
        bool active;
        uint64 expiresAt;
        uint128 perTxCap;
        uint128 dailyCap;
        uint128 spentInWindow;
        uint64 windowStart;
    }

    IERC20 public immutable token;
    InvoiceRegistry public immutable registry;

    bool public paused;
    mapping(address => Policy) private _policies;
    mapping(address => bool) public payeeAllowed;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event PayeeSet(address indexed payee, bool allowed);
    event AgentGranted(address indexed agent, uint64 expiresAt, uint128 perTxCap, uint128 dailyCap);
    event AgentRevoked(address indexed agent);
    event PausedSet(bool paused);
    event AgentPaid(
        address indexed agent, uint256 indexed invoiceId, address indexed merchant, uint256 amount, bytes32 reasonHash
    );

    error ZeroAddress();
    error VaultPaused();
    error NotActiveAgent();
    error AgentExpired();
    error PayeeNotAllowed(address merchant);
    error PerTxCapExceeded(uint256 amount, uint256 cap);
    error DailyCapExceeded(uint256 attempted, uint256 cap);
    error InvalidPolicy();
    error InvoiceNotOpen();

    constructor(address owner_, InvoiceRegistry registry_) Ownable(owner_) {
        if (address(registry_) == address(0)) revert ZeroAddress();
        registry = registry_;
        token = registry_.token();
    }

    function deposit(uint256 amount) external {
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        token.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    function setPayee(address payee, bool allowed) external onlyOwner {
        if (payee == address(0)) revert ZeroAddress();
        payeeAllowed[payee] = allowed;
        emit PayeeSet(payee, allowed);
    }

    function grantAgent(address agent, uint64 expiresAt, uint128 perTxCap, uint128 dailyCap) external onlyOwner {
        if (agent == address(0)) revert ZeroAddress();
        if (expiresAt <= block.timestamp || perTxCap == 0 || dailyCap < perTxCap) revert InvalidPolicy();
        _policies[agent] = Policy({
            active: true,
            expiresAt: expiresAt,
            perTxCap: perTxCap,
            dailyCap: dailyCap,
            spentInWindow: 0,
            windowStart: uint64(block.timestamp)
        });
        emit AgentGranted(agent, expiresAt, perTxCap, dailyCap);
    }

    function revokeAgent(address agent) external onlyOwner {
        _policies[agent].active = false;
        emit AgentRevoked(agent);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PausedSet(value);
    }

    function payInvoice(uint256 invoiceId, bytes32 reasonHash) external nonReentrant {
        if (paused) revert VaultPaused();
        Policy storage p = _policies[msg.sender];
        if (!p.active) revert NotActiveAgent();
        if (block.timestamp >= p.expiresAt) revert AgentExpired();

        InvoiceRegistry.Invoice memory inv = registry.getInvoice(invoiceId);
        if (inv.status != InvoiceRegistry.Status.Open) revert InvoiceNotOpen();
        if (!payeeAllowed[inv.merchant]) revert PayeeNotAllowed(inv.merchant);
        if (inv.amount > p.perTxCap) revert PerTxCapExceeded(inv.amount, p.perTxCap);

        if (block.timestamp >= uint256(p.windowStart) + 1 days) {
            p.windowStart = uint64(block.timestamp);
            p.spentInWindow = 0;
        }
        uint256 attempted = uint256(p.spentInWindow) + inv.amount;
        if (attempted > p.dailyCap) revert DailyCapExceeded(attempted, p.dailyCap);
        p.spentInWindow = uint128(attempted);

        token.forceApprove(address(registry), inv.amount);
        registry.settle(invoiceId);

        emit AgentPaid(msg.sender, invoiceId, inv.merchant, inv.amount, reasonHash);
    }

    function getPolicy(address agent) external view returns (Policy memory) {
        return _policies[agent];
    }

    function remainingToday(address agent) external view returns (uint256) {
        Policy memory p = _policies[agent];
        if (!p.active || block.timestamp >= p.expiresAt) return 0;
        if (block.timestamp >= uint256(p.windowStart) + 1 days) return p.dailyCap;
        return p.dailyCap - p.spentInWindow;
    }

    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
