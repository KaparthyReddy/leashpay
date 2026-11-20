import { parseEventLogs, type Hash } from "viem";
import { vaultAbi } from "./abi";
import type { LeashClient } from "./client";

export type AuditKind =
  | "AgentPaid"
  | "AgentGranted"
  | "AgentRevoked"
  | "PausedSet"
  | "PayeeSet"
  | "Deposited"
  | "Withdrawn";

const KINDS: readonly string[] = [
  "AgentPaid",
  "AgentGranted",
  "AgentRevoked",
  "PausedSet",
  "PayeeSet",
  "Deposited",
  "Withdrawn",
];

export type AuditEvent = {
  kind: AuditKind;
  blockNumber: bigint;
  logIndex: number;
  txHash: Hash;
  args: Record<string, unknown>;
};

export async function getAuditTrail(
  client: LeashClient,
  fromBlock: bigint,
  toBlock?: bigint,
  chunkSize = 5000n,
): Promise<AuditEvent[]> {
  const end = toBlock ?? (await client.publicClient.getBlockNumber());
  const events: AuditEvent[] = [];

  for (let start = fromBlock; start <= end; start += chunkSize) {
    const stop = start + chunkSize - 1n > end ? end : start + chunkSize - 1n;
    const logs = await client.publicClient.getLogs({
      address: client.addresses.vault,
      fromBlock: start,
      toBlock: stop,
    });
    const parsed = parseEventLogs({ abi: vaultAbi, logs, strict: false });
    for (const log of parsed) {
      const name = (log as { eventName?: string }).eventName;
      if (!name || !KINDS.includes(name)) continue;
      events.push({
        kind: name as AuditKind,
        blockNumber: log.blockNumber ?? 0n,
        logIndex: log.logIndex ?? 0,
        txHash: (log.transactionHash ?? "0x") as Hash,
        args: ((log as { args?: unknown }).args ?? {}) as Record<string, unknown>,
      });
    }
  }

  return events.sort((a, b) =>
    a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1,
  );
}
