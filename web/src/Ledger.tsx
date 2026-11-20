import type { AuditEvent } from "@leashpay/sdk";
import { addrLink, money, short, txLink } from "./format";
import type { VaultData } from "./useVault";

function describe(e: AuditEvent, fmt: (v: bigint) => string): string {
  const a = e.args as Record<string, unknown>;
  const s = (k: string) => short(String(a[k]));
  const n = (k: string) => fmt(a[k] as bigint);
  switch (e.kind) {
    case "AgentPaid":
      return `Agent ${s("agent")} paid invoice #${String(a.invoiceId)} (${n("amount")}) to ${s("merchant")}`;
    case "AgentGranted":
      return `Agent ${s("agent")} got a session: up to ${n("perTxCap")} per payment, ${n("dailyCap")} per day`;
    case "AgentRevoked":
      return `Agent ${s("agent")} was revoked`;
    case "PausedSet":
      return a.paused ? "Owner paused all payments" : "Owner resumed payments";
    case "PayeeSet":
      return `${s("payee")} ${a.allowed ? "was added to" : "was removed from"} the allowlist`;
    case "Deposited":
      return `${s("from")} deposited ${n("amount")}`;
    case "Withdrawn":
      return `Owner withdrew ${n("amount")} to ${s("to")}`;
    default:
      return e.kind;
  }
}

export function Ledger({ data, vault }: { data: VaultData; vault: string }) {
  const fmt = (v: bigint) => money(v, data.decimals, data.symbol);
  const events = [...data.events].reverse();
  return (
    <section className="block" aria-labelledby="ledger-title">
      <h2 id="ledger-title">Everything that happened, on-chain</h2>
      {events.length === 0 ? (
        <p className="hint">No activity found in the scanned blocks.</p>
      ) : (
        <ol className="ledger">
          {events.map((e) => (
            <li key={`${e.txHash}-${e.logIndex}`} className={e.kind === "AgentPaid" ? "is-payment" : undefined}>
              <span className="ledger-text">{describe(e, fmt)}</span>
              <a href={txLink(e.txHash)} target="_blank" rel="noreferrer">
                Block {e.blockNumber.toString()}
              </a>
            </li>
          ))}
        </ol>
      )}
      <p className="hint">
        Payments the vault refuses revert on-chain, so they never appear above. Find them as failed transactions on the{" "}
        <a href={addrLink(vault)} target="_blank" rel="noreferrer">
          vault's explorer page
        </a>
        .
      </p>
    </section>
  );
}
