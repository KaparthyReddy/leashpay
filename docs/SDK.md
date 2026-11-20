# SDK guide

`sdk/` is a small TypeScript client over viem. It is workspace package `@leashpay/sdk`.

## Create a client

```ts
import { LeashClient, loadConfig } from "@leashpay/sdk";
import { privateKeyToAccount } from "viem/accounts";

const config = loadConfig();
const readOnly = new LeashClient(config);
const owner = new LeashClient(config, privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`));
```

`loadConfig` reads `INVOICE_REGISTRY_ADDRESS` and `AGENT_VAULT_ADDRESS` and falls back to Aevum testnet defaults for the RPC, chain ID, explorer and tUSD8.

## Owner

```ts
await owner.deposit(3_000_000n);
await owner.setPayee(merchantAddress, true);
await owner.grantAgent({
  agent: agentAddress,
  expiresAt: BigInt(Math.floor(Date.now() / 1000) + 7 * 86400),
  perTxCap: 1_000_000n,
  dailyCap: 2_000_000n,
});
await owner.setPaused(true);
await owner.revokeAgent(agentAddress);
```

All amounts are tUSD8 base units (6 decimals).

## Merchant

```ts
const { id, hash } = await merchant.createInvoice({
  amount: 500_000n,
  expiresInSeconds: 3600,
  ref: "0x...",
  payer: vaultAddress,
});
```

## Agent

```ts
import { explainRevert } from "@leashpay/sdk";

try {
  await agent.payInvoice(id, reasonHash);
} catch (err) {
  console.log(explainRevert(err));
}
```

`payInvoice` simulates first, so a blocked payment is explained without sending a transaction. To produce an on-chain failure for a demo, pass `{ skipSimulation: true, gas: 400_000n }`.

## Reads

```ts
await readOnly.vaultBalance();
await readOnly.getPolicy(agentAddress);
await readOnly.remainingToday(agentAddress);
await readOnly.getInvoice(1n);
await readOnly.isPayeeAllowed(merchantAddress);
```

## Audit trail

```ts
import { getAuditTrail } from "@leashpay/sdk";

const events = await getAuditTrail(readOnly, deployBlock);
```

The reader splits `eth_getLogs` into chunks of at most 1,000 blocks, the Aevum limit.

## Plain-language errors

`explainRevert` turns contract errors into sentences, for example "Amount 1.5 tUSD8 exceeds the per-transaction cap of 1 tUSD8." It accepts a formatter so amounts print as tUSD8.

## Constraints

- Transactions are legacy (type 0).
- No WebSocket RPC: use polling.
- Shanghai EVM only.
