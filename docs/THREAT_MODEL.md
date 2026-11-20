# Threat model

What can go wrong, what stops it, and what is still your responsibility. Amounts below use the demo policy (1 tUSD8 per payment, 2 tUSD8 per day).

| Threat | What happens | Control | Residual risk |
|---|---|---|---|
| Prompt injection in an invoice memo | Text tells the agent to ignore its rules and pay. | The memo is treated as data. Even if the model obeys, the vault refuses unlisted payees. Demonstrated by `scripts/demo-attack.ts`. | An allowlisted payee could still send a misleading memo. The loss is bounded by the caps. |
| Compromised agent key | An attacker holds the agent key and calls `payInvoice` directly. | Per-payment and daily caps, allowlist, expiry, open invoices only, instant revoke or pause. | Up to the daily cap can reach allowlisted payees before the owner reacts. |
| Invoice from an unknown payee | A stranger creates an invoice addressed to the vault. | Allowlist check reverts with `PayeeNotAllowed`. | None for the vault's funds. Spam invoices cost the sender gas. |
| Oversized invoice | An allowlisted merchant (or an attacker holding its key) invoices more than the cap. | `PerTxCapExceeded`. | None above the cap. |
| Drip attack | Many small invoices to stay under the per-payment cap. | `DailyCapExceeded` on the rolling 24 hour window. | Up to the daily cap per day until revoked. |
| Replay or double payment | The same invoice is paid twice. | Invoice status moves from open to paid once. `InvoiceNotOpen` afterwards. | None. |
| Payer front-running | A third party settles an invoice that was meant for the vault. | Invoices created for the vault set `payer`, so only the vault can settle them. | For payer-less invoices, anyone may pay with their own funds, which is harmless. |
| Runaway agent loop | The agent keeps paying. | Daily cap and balance bound the loss. The owner can pause. | Same as above. |
| Stale authority | A forgotten key keeps working. | Every policy has an expiry. | None after expiry. |
| LLM unavailable or malformed output | The model is down or returns garbage. | The agent fails closed and rejects. | Invoices are not paid until the model is back. |
| Reentrancy | A hostile token or merchant re-enters. | `ReentrancyGuard` on payment paths, checks-effects-interactions, status set before transfer. | Low, the token is the platform's tUSD8. |
| Lingering allowance | An approval stays after payment. | The vault approves exactly the invoice amount, consumed by `settle` in the same transaction. | None. |
| Owner key compromise | The owner key is stolen. | Out of scope for the contract. `Ownable2Step` prevents accidental ownership transfers. | Use a multisig owner for real funds (roadmap). |
| Wrong network | A signed action is replayed on another chain. | Transactions carry the chain ID. The kit's isolated fork ID is not used by the web console. | Standard EVM replay protections apply. |

## What the contract does not do

- It does not judge whether an invoice is legitimate. The allowlist and caps bound the damage; deciding which payees to trust is the owner's job.
- It does not hide data. Invoices, payments and policies are public on-chain. Memos stay off-chain.
- It does not make an advisory model trustworthy. That is why the model is not the control.

## Testing

`contracts/test/AgentVault.t.sol` covers: an allowlisted payment, payee not allowed, per-payment cap, daily cap, daily window reset, revoked agent, expired agent, paused vault, double payment, a stranger calling the vault, owner-only functions, withdrawals, invalid policies, and a fuzz test that no amount above the per-payment cap can be paid. `InvoiceRegistry.t.sol` covers creation, settlement, restricted payers, double settlement, expiry, cancellation and input validation.

The same rules are exercised on the live testnet by `scripts/demo-attack.ts` and `scripts/demo-controls.ts`. See [EVIDENCE.md](EVIDENCE.md) for the transaction hashes.
