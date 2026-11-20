import { getAuditTrail } from "@leashpay/sdk";
import { deployBlock, fmt, owner, title } from "./lib";

const AMOUNT_KEYS = new Set(["amount", "perTxCap", "dailyCap"]);

function render(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([k, v]) => {
      if (typeof v === "bigint") return `${k}=${AMOUNT_KEYS.has(k) ? fmt(v) : v.toString()}`;
      return `${k}=${String(v)}`;
    })
    .join(" ");
}

async function main() {
  const from = await deployBlock();
  title(`Vault audit trail from block ${from}`);
  const events = await getAuditTrail(owner, from);
  for (const e of events) {
    console.log(`#${e.blockNumber} ${e.kind}  ${render(e.args)}`);
    console.log(`   ${owner.txUrl(e.txHash) ?? e.txHash}`);
  }
  console.log(`\n${events.length} events`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
