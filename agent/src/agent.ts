import { explainRevert, InvoiceStatus, type LeashClient } from "@leashpay/sdk";
import { formatUnits, keccak256, toHex } from "viem";
import type { OllamaConfig } from "./config";
import { loadMemo } from "./inbox";
import { preflight } from "./preflight";
import { reviewInvoice } from "./review";

export type Outcome = {
  id: bigint;
  action:
    | "paid"
    | "rejected-by-agent"
    | "blocked-by-preflight"
    | "rejected-by-contract"
    | "reverted-onchain"
    | "skipped";
  detail: string;
  txHash?: string;
  url?: string;
};

export type AgentDeps = {
  client: LeashClient;
  ollama: OllamaConfig;
  inboxDir: string;
  log: (line: string) => void;
};

export async function processInvoice(
  deps: AgentDeps,
  id: bigint,
  opts: { force?: boolean } = {},
): Promise<Outcome> {
  const { client, ollama, inboxDir, log } = deps;
  const agent = client.account?.address;
  if (!agent) throw new Error("Agent client has no account");

  const invoice = await client.getInvoice(id);
  if (invoice.status === InvoiceStatus.None) {
    return { id, action: "skipped", detail: "invoice does not exist" };
  }

  const [decimals, symbol, policy, allowlisted, paused, remaining, block] = await Promise.all([
    client.tokenDecimals(),
    client.tokenSymbol(),
    client.getPolicy(agent),
    client.isPayeeAllowed(invoice.merchant),
    client.isPaused(),
    client.remainingToday(agent),
    client.publicClient.getBlock(),
  ]);
  const fmt = (v: bigint) => `${formatUnits(v, decimals)} ${symbol}`;

  log(`invoice #${id}: ${fmt(invoice.amount)} to ${invoice.merchant} (allowlisted: ${allowlisted})`);

  const memo = await loadMemo(inboxDir, id);
  if (memo) log(`memo: ${memo.subject ?? "(no subject)"}`);

  const review = await reviewInvoice(
    ollama,
    {
      invoiceId: id.toString(),
      merchant: invoice.merchant,
      amount: fmt(invoice.amount),
      expiresAt: new Date(Number(invoice.expiresAt) * 1000).toISOString(),
      merchantAllowlisted: allowlisted,
      remainingToday: fmt(remaining),
    },
    memo,
  );
  log(`llm: ${review.decision} (risk ${review.risk}) - ${review.reason}`);

  const pre = preflight({
    invoice,
    policy,
    payeeAllowed: allowlisted,
    paused,
    nowSec: block.timestamp,
    vault: client.addresses.vault,
  });

  if (review.decision === "reject") {
    return { id, action: "rejected-by-agent", detail: review.reason };
  }

  if (!pre.ok && !opts.force) {
    return { id, action: "blocked-by-preflight", detail: pre.problems.join("; ") };
  }

  const reasonHash = keccak256(
    toHex(
      JSON.stringify({
        invoiceId: id.toString(),
        decision: review.decision,
        reason: review.reason,
        risk: review.risk,
        model: ollama.model,
      }),
    ),
  );

  try {
    if (!pre.ok) {
      log(`force mode: sending anyway to demonstrate on-chain enforcement (${pre.problems.join("; ")})`);
      const res = await client.payInvoice(id, reasonHash, { skipSimulation: true, gas: 400_000n });
      if (res.status === "reverted") {
        return {
          id,
          action: "reverted-onchain",
          detail: `contract rejected the payment: ${pre.problems.join("; ")}`,
          txHash: res.hash,
          url: res.url,
        };
      }
      return { id, action: "paid", detail: "paid", txHash: res.hash, url: res.url };
    }
    const res = await client.payInvoice(id, reasonHash);
    if (res.status === "reverted") {
      return { id, action: "reverted-onchain", detail: "transaction reverted", txHash: res.hash, url: res.url };
    }
    return { id, action: "paid", detail: review.reason, txHash: res.hash, url: res.url };
  } catch (err) {
    return { id, action: "rejected-by-contract", detail: explainRevert(err, fmt) };
  }
}
