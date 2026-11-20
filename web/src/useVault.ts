import {
  getAuditTrail,
  InvoiceStatus,
  LeashClient,
  vaultAbi,
  type AuditEvent,
  type Invoice,
  type Policy,
} from "@leashpay/sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { web } from "./env";

export type InvoiceRow = Invoice & { id: bigint; allowed: boolean };

export type VaultData = {
  decimals: number;
  symbol: string;
  owner: Address;
  balance: bigint;
  paused: boolean;
  policy: Policy | null;
  remaining: bigint;
  nowSec: bigint;
  invoices: InvoiceRow[];
  events: AuditEvent[];
  allowlist: Address[];
};

const INVOICE_WINDOW = 12n;
const FALLBACK_SCAN = 2000n;

export function useLeashClient(): LeashClient | null {
  return useMemo(() => {
    if (!web.vault || !web.registry) return null;
    return new LeashClient({
      rpcUrl: web.rpcUrl,
      chainId: web.chainId,
      explorerUrl: web.explorerUrl,
      token: web.token,
      registry: web.registry,
      vault: web.vault,
    });
  }, []);
}

export function useVault(client: LeashClient | null, agent: Address | undefined) {
  const [data, setData] = useState<VaultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef<{ next: bigint | null; events: AuditEvent[] }>({ next: null, events: [] });

  const refresh = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const [decimals, symbol, owner, balance, paused, block, head, nextId] = await Promise.all([
        client.tokenDecimals(),
        client.tokenSymbol(),
        client.publicClient.readContract({
          address: client.addresses.vault,
          abi: vaultAbi,
          functionName: "owner",
        }),
        client.vaultBalance(),
        client.isPaused(),
        client.publicClient.getBlock(),
        client.publicClient.getBlockNumber(),
        client.nextInvoiceId(),
      ]);

      const [policy, remaining] = agent
        ? await Promise.all([client.getPolicy(agent), client.remainingToday(agent)])
        : [null, 0n];

      const first = nextId > INVOICE_WINDOW ? nextId - INVOICE_WINDOW : 1n;
      const ids: bigint[] = [];
      for (let id = nextId - 1n; id >= first; id--) ids.push(id);
      const invoices = await Promise.all(
        ids.map(async (id) => {
          const inv = await client.getInvoice(id);
          const allowed = await client.isPayeeAllowed(inv.merchant);
          return { ...inv, id, allowed } as InvoiceRow;
        }),
      );

      if (cache.current.next === null) {
        const start = web.deployBlock > 0n ? web.deployBlock : head > FALLBACK_SCAN ? head - FALLBACK_SCAN : 0n;
        cache.current.next = start;
      }
      if (head >= cache.current.next) {
        const fresh = await getAuditTrail(client, cache.current.next, head);
        cache.current = { next: head + 1n, events: [...cache.current.events, ...fresh] };
      }
      const events = cache.current.events;

      const allow = new Map<string, boolean>();
      for (const e of events) {
        if (e.kind === "PayeeSet") allow.set(String(e.args.payee), Boolean(e.args.allowed));
      }
      const allowlist = [...allow.entries()].filter(([, v]) => v).map(([k]) => k as Address);

      setData({
        decimals: Number(decimals),
        symbol,
        owner: owner as Address,
        balance,
        paused,
        policy: policy as Policy | null,
        remaining: remaining as bigint,
        nowSec: block.timestamp,
        invoices,
        events,
        allowlist,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [client, agent]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  return { data, error, loading, refresh };
}

export function statusLabel(inv: Invoice, nowSec: bigint): string {
  if (inv.status === InvoiceStatus.Paid) return "Paid";
  if (inv.status === InvoiceStatus.Cancelled) return "Cancelled";
  if (inv.status === InvoiceStatus.Open) return nowSec > inv.expiresAt ? "Expired" : "Open";
  return "Unknown";
}
