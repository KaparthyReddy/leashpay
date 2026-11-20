import { InvoiceStatus, type Invoice, type Policy } from "@leashpay/sdk";
import type { Address } from "viem";

export type PreflightInput = {
  invoice: Invoice;
  policy: Policy;
  payeeAllowed: boolean;
  paused: boolean;
  nowSec: bigint;
  vault: Address;
};

export type PreflightResult = { ok: boolean; problems: string[] };

const DAY = 86_400n;

export function preflight(i: PreflightInput): PreflightResult {
  const problems: string[] = [];
  const { invoice, policy } = i;

  if (i.paused) problems.push("vault is paused");
  if (!policy.active) problems.push("agent key is not active");
  else if (i.nowSec >= policy.expiresAt) problems.push("agent session key has expired");

  if (invoice.status !== InvoiceStatus.Open) problems.push("invoice is not open");
  else if (i.nowSec > invoice.expiresAt) problems.push("invoice has expired");

  const zero = "0x0000000000000000000000000000000000000000";
  if (invoice.payer !== zero && invoice.payer.toLowerCase() !== i.vault.toLowerCase()) {
    problems.push("invoice is restricted to a different payer");
  }

  if (!i.payeeAllowed) problems.push(`payee ${invoice.merchant} is not on the allowlist`);
  if (invoice.amount > policy.perTxCap) problems.push("amount exceeds per-transaction cap");

  const windowExpired = i.nowSec >= policy.windowStart + DAY;
  const spent = windowExpired ? 0n : policy.spentInWindow;
  if (spent + invoice.amount > policy.dailyCap) problems.push("amount would exceed daily cap");

  return { ok: problems.length === 0, problems };
}
