import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { explainRevert, LeashClient, type TxResult } from "@leashpay/sdk";
import { formatUnits, keccak256, parseEther, parseUnits, toHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadAgentConfig, ROOT } from "../agent/src/config";
import type { Memo } from "../agent/src/inbox";

export const config = loadAgentConfig();

function keyOf(name: string): Hex {
  const v = process.env[name]?.trim();
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`${name} is missing or invalid in .env`);
  return v as Hex;
}

export const owner = new LeashClient(config.leash, privateKeyToAccount(keyOf("DEPLOYER_PRIVATE_KEY")));
export const agent = new LeashClient(config.leash, privateKeyToAccount(config.agentKey));
export const merchant = new LeashClient(config.leash, privateKeyToAccount(keyOf("MERCHANT_PRIVATE_KEY")));

export const addr = (c: LeashClient): Address => c.account!.address;

export const usd = (amount: string): bigint => parseUnits(amount, 6);
export const fmt = (v: bigint): string => `${formatUnits(v, 6)} tUSD8`;

export const POLICY = {
  perTxCap: usd("1"),
  dailyCap: usd("2"),
  ttlSeconds: 7n * 86_400n,
};

export function title(text: string): void {
  console.log(`\n=== ${text} ===`);
}

export function showTx(label: string, res: { hash: string; status?: string; url?: string }): void {
  console.log(`  ${label}: ${res.status ?? "sent"}  ${res.hash}`);
  if (res.url) console.log(`  ${res.url}`);
}

export async function grantAgentPolicy(): Promise<void> {
  const block = await owner.publicClient.getBlock();
  const res = await owner.grantAgent({
    agent: addr(agent),
    expiresAt: block.timestamp + POLICY.ttlSeconds,
    perTxCap: POLICY.perTxCap,
    dailyCap: POLICY.dailyCap,
  });
  showTx("grantAgent", res);
}

export async function createInvoiceWithMemo(
  client: LeashClient,
  params: { amount: bigint; memo: Memo; payer?: Address },
): Promise<bigint> {
  const ref = keccak256(toHex(params.memo.body));
  const res = await client.createInvoice({
    amount: params.amount,
    expiresInSeconds: 3600,
    ref,
    payer: params.payer,
  });
  await mkdir(config.inboxDir, { recursive: true });
  await writeFile(join(config.inboxDir, `${res.id}.json`), JSON.stringify(params.memo, null, 2));
  showTx(`createInvoice #${res.id} (${fmt(params.amount)})`, res);
  return res.id;
}

export async function attempt(label: string, client: LeashClient, id: bigint): Promise<TxResult | null> {
  const reasonHash = keccak256(toHex(label));
  console.log(`\n[${label}] invoice #${id}`);
  try {
    const res = await client.payInvoice(id, reasonHash);
    showTx("payment went through", res);
    return res;
  } catch (err) {
    console.log(`  contract says: ${explainRevert(err, fmt)}`);
  }
  const res = await client.payInvoice(id, reasonHash, { skipSimulation: true, gas: 400_000n });
  showTx("on-chain attempt", res);
  return res;
}

export async function sendGas(from: LeashClient, to: Address, tqday: string): Promise<string> {
  const hash = await from.walletClient!.sendTransaction({
    account: from.account!,
    chain: from.chain,
    to,
    value: parseEther(tqday),
    type: "legacy",
  } as never);
  await from.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function deployBlock(): Promise<bigint> {
  const fromEnv = process.env.DEPLOY_BLOCK?.trim();
  if (fromEnv && /^\d+$/.test(fromEnv)) return BigInt(fromEnv);
  try {
    const file = join(ROOT, "contracts/broadcast/Deploy.s.sol", String(config.leash.chainId), "run-latest.json");
    const data = JSON.parse(await readFile(file, "utf8")) as { receipts?: { blockNumber: string }[] };
    const blocks = (data.receipts ?? []).map((r) => BigInt(r.blockNumber));
    if (blocks.length) return blocks.reduce((a, b) => (a < b ? a : b));
  } catch {
    // fall through
  }
  const head = await owner.publicClient.getBlockNumber();
  return head > 5000n ? head - 5000n : 0n;
}
