import { LeashClient } from "@leashpay/sdk";
import { formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { processInvoice, type AgentDeps, type Outcome } from "./agent";
import { loadAgentConfig } from "./config";
import { ensureOllama } from "./ollama";
import { InvoiceStatus } from "@leashpay/sdk";

const log = (line: string) => console.log(line);

function printOutcome(o: Outcome) {
  console.log(`=> #${o.id} ${o.action}: ${o.detail}`);
  if (o.txHash) console.log(`   tx: ${o.txHash}${o.url ? `\n   ${o.url}` : ""}`);
}

function usage(): never {
  console.log(
    [
      "usage:",
      "  status",
      "  pay <invoiceId> [--force]",
      "  watch [--interval <seconds>] [--force]",
    ].join("\n"),
  );
  process.exit(1);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) usage();

  const cfg = loadAgentConfig();
  const account = privateKeyToAccount(cfg.agentKey);
  const client = new LeashClient(cfg.leash, account);
  const deps: AgentDeps = { client, ollama: cfg.ollama, inboxDir: cfg.inboxDir, log };
  const force = rest.includes("--force");

  if (command === "status") {
    const [decimals, symbol, balance, policy, remaining, paused] = await Promise.all([
      client.tokenDecimals(),
      client.tokenSymbol(),
      client.vaultBalance(),
      client.getPolicy(account.address),
      client.remainingToday(account.address),
      client.isPaused(),
    ]);
    const fmt = (v: bigint) => `${formatUnits(v, decimals)} ${symbol}`;
    console.log(`agent:        ${account.address}`);
    console.log(`vault:        ${cfg.leash.vault}`);
    console.log(`balance:      ${fmt(balance)}`);
    console.log(`paused:       ${paused}`);
    console.log(`active:       ${policy.active}`);
    console.log(`expires:      ${new Date(Number(policy.expiresAt) * 1000).toISOString()}`);
    console.log(`per-tx cap:   ${fmt(policy.perTxCap)}`);
    console.log(`daily cap:    ${fmt(policy.dailyCap)}`);
    console.log(`left today:   ${fmt(remaining)}`);
    try {
      await ensureOllama(cfg.ollama);
      console.log(`ollama:       ok (${cfg.ollama.model})`);
    } catch (err) {
      console.log(`ollama:       ${err instanceof Error ? err.message : String(err)}`);
    }
    return;
  }

  await ensureOllama(cfg.ollama);

  if (command === "pay") {
    const raw = rest.find((a) => !a.startsWith("--"));
    if (!raw || !/^\d+$/.test(raw)) usage();
    printOutcome(await processInvoice(deps, BigInt(raw), { force }));
    return;
  }

  if (command === "watch") {
    const idx = rest.indexOf("--interval");
    const intervalSec = idx >= 0 ? Number(rest[idx + 1]) : cfg.pollSeconds;
    if (!Number.isFinite(intervalSec) || intervalSec <= 0) usage();
    const handled = new Set<string>();
    log(`watching registry every ${intervalSec}s (ctrl+c to stop)`);
    for (;;) {
      const next = await client.nextInvoiceId();
      for (let id = 1n; id < next; id++) {
        const key = id.toString();
        if (handled.has(key)) continue;
        const inv = await client.getInvoice(id);
        if (inv.status !== InvoiceStatus.Open) {
          handled.add(key);
          continue;
        }
        const zero = "0x0000000000000000000000000000000000000000";
        const mine = inv.payer === zero || inv.payer.toLowerCase() === cfg.leash.vault.toLowerCase();
        if (!mine) {
          handled.add(key);
          continue;
        }
        handled.add(key);
        printOutcome(await processInvoice(deps, id, { force }));
      }
      await new Promise((r) => setTimeout(r, intervalSec * 1000));
    }
  }

  usage();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
