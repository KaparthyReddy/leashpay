# Demo script (3 to 5 minutes)

Before recording: fund the wallets, run `npx tsx scripts/setup.ts`, start Ollama, open the web console with the owner wallet imported, and keep the explorer open on the vault address.

## 0:00 The problem (30 seconds)

"AI agents read untrusted text and hold money. Telling a model to be careful is not a control. LeashPay moves the control on-chain."

Show the web console: the allowance bar, the rules, the ledger.

## 0:30 The owner's leash (30 seconds)

Point at: the agent's per-payment cap, daily cap, expiry, and the allowlist with one payee. "This is everything the agent is allowed to do."

## 1:00 A normal payment (60 seconds)

```
npx tsx scripts/demo-pay.ts
```

Narrate the output: the merchant creates an invoice, the local model reviews it, the vault pays. Open the transaction on the explorer. Refresh the console: the allowance dropped and the ledger shows the payment with its reasoning hash.

## 2:00 The attack (60 seconds)

```
npx tsx scripts/demo-attack.ts
```

"A stranger sends an invoice with a prompt-injection memo." Show the model rejecting it, then "assume the agent is fully compromised." Show the failed transaction on the explorer. Vault balance unchanged, attacker received zero.

## 3:00 Owner controls (60 seconds)

```
npx tsx scripts/demo-controls.ts
```

Show the oversized invoice rejected by the cap, a payment rejected while paused, a payment rejected after revocation. Then in the web console click "Pause all payments" and "Resume payments" live.

## 4:00 Audit and close (30 seconds)

```
npx tsx scripts/audit.ts
```

"Every action is on-chain. Limits are enforced by the contract, so a fooled or hijacked agent stays inside its leash." Mention the roadmap: ERC-8004 identity, multisig owner, per-payee caps.

## Checklist

- Vault holds at least 1 tUSD8 and the agent policy is active.
- Merchant and agent each have gas (0.05 tQDAY is plenty).
- `ollama run llama3.2:3b` responds.
- Explorer tabs open: the vault address and the registry address.
