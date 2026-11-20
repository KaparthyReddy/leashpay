import { BaseError, ContractFunctionRevertedError } from "viem";

export type AmountFormatter = (value: bigint) => string;

const raw: AmountFormatter = (v) => v.toString();

export function describeRevert(
  name: string,
  args: readonly unknown[] = [],
  fmt: AmountFormatter = raw,
): string {
  const n = (i: number) => (typeof args[i] === "bigint" ? fmt(args[i] as bigint) : String(args[i]));
  switch (name) {
    case "PayeeNotAllowed":
      return `Payee ${String(args[0])} is not on this vault's allowlist.`;
    case "PerTxCapExceeded":
      return `Amount ${n(0)} exceeds the per-transaction cap of ${n(1)}.`;
    case "DailyCapExceeded":
      return `Payment would bring today's spend to ${n(0)}, above the daily cap of ${n(1)}.`;
    case "NotActiveAgent":
      return "This agent key is not authorized (never granted, or revoked).";
    case "AgentExpired":
      return "This agent's session key has expired.";
    case "VaultPaused":
      return "The vault is paused by its owner.";
    case "InvoiceNotOpen":
    case "NotOpen":
      return "Invoice is not open (already paid, cancelled, or unknown).";
    case "InvoiceExpired":
      return "Invoice has expired.";
    case "WrongPayer":
      return "Invoice is restricted to a different payer.";
    case "InvalidPolicy":
      return "Invalid policy: expiry must be in the future and caps must satisfy 0 < per-tx cap <= daily cap.";
    case "ZeroAddress":
      return "Address must not be zero.";
    case "ZeroAmount":
      return "Amount must be greater than zero.";
    case "AlreadyExpired":
      return "Expiry must be in the future.";
    case "NotMerchant":
      return "Only the invoice's merchant can do that.";
    default:
      return `Contract reverted: ${name}`;
  }
}

export function explainRevert(err: unknown, fmt: AmountFormatter = raw): string {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name) return describeRevert(name, (reverted.data?.args ?? []) as readonly unknown[], fmt);
      return reverted.reason ?? reverted.shortMessage;
    }
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : String(err);
}
