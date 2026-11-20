import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Abi,
  type Account,
  type Address,
  type Chain,
  type Hash,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import { erc20Abi, registryAbi, vaultAbi } from "./abi";
import { aevumChain } from "./chain";
import type { LeashConfig } from "./config";

export enum InvoiceStatus {
  None = 0,
  Open = 1,
  Paid = 2,
  Cancelled = 3,
}

export type Invoice = {
  merchant: Address;
  payer: Address;
  amount: bigint;
  expiresAt: bigint;
  status: InvoiceStatus;
  ref: Hex;
};

export type Policy = {
  active: boolean;
  expiresAt: bigint;
  perTxCap: bigint;
  dailyCap: bigint;
  spentInWindow: bigint;
  windowStart: bigint;
};

export type TxResult = {
  hash: Hash;
  status: "success" | "reverted";
  url?: string;
  receipt: TransactionReceipt;
};

type WriteRequest = {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
};

type SendOptions = { skipSimulation?: boolean; gas?: bigint };

export class LeashClient {
  readonly chain: Chain;
  readonly publicClient: PublicClient;
  readonly walletClient?: WalletClient;
  readonly account?: Account;
  readonly addresses: { token: Address; registry: Address; vault: Address };
  private readonly explorerUrl?: string;

  constructor(config: LeashConfig, account?: Account) {
    this.chain = aevumChain(config.rpcUrl, config.chainId, config.explorerUrl);
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(config.rpcUrl),
    }) as PublicClient;
    if (account) {
      this.account = account;
      this.walletClient = createWalletClient({
        account,
        chain: this.chain,
        transport: http(config.rpcUrl),
      });
    }
    this.addresses = { token: config.token, registry: config.registry, vault: config.vault };
    this.explorerUrl = config.explorerUrl?.replace(/\/$/, "");
  }

  txUrl(hash: Hash): string | undefined {
    return this.explorerUrl ? `${this.explorerUrl}/tx/${hash}` : undefined;
  }

  addressUrl(address: Address): string | undefined {
    return this.explorerUrl ? `${this.explorerUrl}/address/${address}` : undefined;
  }

  private async read<T>(
    address: Address,
    abi: Abi,
    functionName: string,
    args: readonly unknown[] = [],
  ): Promise<T> {
    const result = await this.publicClient.readContract({
      address,
      abi,
      functionName,
      args,
    } as never);
    return result as T;
  }

  private async send(req: WriteRequest, opts: SendOptions = {}): Promise<TxResult> {
    if (!this.walletClient || !this.account) {
      throw new Error("This client has no account; construct LeashClient with a signer to send transactions");
    }
    let hash: Hash;
    if (opts.skipSimulation) {
      hash = await this.walletClient.writeContract({
        ...req,
        account: this.account,
        chain: this.chain,
        gas: opts.gas,
      } as never);
    } else {
      const { request } = await this.publicClient.simulateContract({
        ...req,
        account: this.account,
      } as never);
      hash = await this.walletClient.writeContract(request as never);
    }
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return { hash, status: receipt.status, url: this.txUrl(hash), receipt };
  }

  private async sendOrThrow(req: WriteRequest): Promise<TxResult> {
    const res = await this.send(req);
    if (res.status === "reverted") throw new Error(`Transaction reverted: ${res.hash}`);
    return res;
  }

  tokenDecimals(): Promise<number> {
    return this.read<number>(this.addresses.token, erc20Abi, "decimals");
  }

  tokenSymbol(): Promise<string> {
    return this.read<string>(this.addresses.token, erc20Abi, "symbol");
  }

  tokenBalance(account: Address): Promise<bigint> {
    return this.read<bigint>(this.addresses.token, erc20Abi, "balanceOf", [account]);
  }

  vaultBalance(): Promise<bigint> {
    return this.read<bigint>(this.addresses.vault, vaultAbi, "balance");
  }

  isPaused(): Promise<boolean> {
    return this.read<boolean>(this.addresses.vault, vaultAbi, "paused");
  }

  isPayeeAllowed(payee: Address): Promise<boolean> {
    return this.read<boolean>(this.addresses.vault, vaultAbi, "payeeAllowed", [payee]);
  }

  getPolicy(agent: Address): Promise<Policy> {
    return this.read<Policy>(this.addresses.vault, vaultAbi, "getPolicy", [agent]);
  }

  remainingToday(agent: Address): Promise<bigint> {
    return this.read<bigint>(this.addresses.vault, vaultAbi, "remainingToday", [agent]);
  }

  nextInvoiceId(): Promise<bigint> {
    return this.read<bigint>(this.addresses.registry, registryAbi, "nextInvoiceId");
  }

  async getInvoice(id: bigint): Promise<Invoice> {
    return this.read<Invoice>(this.addresses.registry, registryAbi, "getInvoice", [id]);
  }

  async createInvoice(params: {
    amount: bigint;
    expiresInSeconds: number;
    ref: Hex;
    payer?: Address;
  }): Promise<TxResult & { id: bigint }> {
    const block = await this.publicClient.getBlock();
    const expiresAt = block.timestamp + BigInt(params.expiresInSeconds);
    const res = await this.sendOrThrow({
      address: this.addresses.registry,
      abi: registryAbi,
      functionName: "createInvoice",
      args: [params.payer ?? "0x0000000000000000000000000000000000000000", params.amount, expiresAt, params.ref],
    });
    const [created] = parseEventLogs({
      abi: registryAbi,
      eventName: "InvoiceCreated",
      logs: res.receipt.logs,
    });
    if (!created) throw new Error("InvoiceCreated event not found in receipt");
    return { ...res, id: created.args.id };
  }

  cancelInvoice(id: bigint): Promise<TxResult> {
    return this.sendOrThrow({
      address: this.addresses.registry,
      abi: registryAbi,
      functionName: "cancelInvoice",
      args: [id],
    });
  }

  async deposit(amount: bigint): Promise<TxResult> {
    if (!this.account) throw new Error("No account configured");
    const allowance = await this.read<bigint>(this.addresses.token, erc20Abi, "allowance", [
      this.account.address,
      this.addresses.vault,
    ]);
    if (allowance < amount) {
      await this.sendOrThrow({
        address: this.addresses.token,
        abi: erc20Abi,
        functionName: "approve",
        args: [this.addresses.vault, amount],
      });
    }
    return this.sendOrThrow({
      address: this.addresses.vault,
      abi: vaultAbi,
      functionName: "deposit",
      args: [amount],
    });
  }

  withdraw(to: Address, amount: bigint): Promise<TxResult> {
    return this.sendOrThrow({
      address: this.addresses.vault,
      abi: vaultAbi,
      functionName: "withdraw",
      args: [to, amount],
    });
  }

  setPayee(payee: Address, allowed: boolean): Promise<TxResult> {
    return this.sendOrThrow({
      address: this.addresses.vault,
      abi: vaultAbi,
      functionName: "setPayee",
      args: [payee, allowed],
    });
  }

  grantAgent(params: {
    agent: Address;
    expiresAt: bigint;
    perTxCap: bigint;
    dailyCap: bigint;
  }): Promise<TxResult> {
    return this.sendOrThrow({
      address: this.addresses.vault,
      abi: vaultAbi,
      functionName: "grantAgent",
      args: [params.agent, params.expiresAt, params.perTxCap, params.dailyCap],
    });
  }

  revokeAgent(agent: Address): Promise<TxResult> {
    return this.sendOrThrow({
      address: this.addresses.vault,
      abi: vaultAbi,
      functionName: "revokeAgent",
      args: [agent],
    });
  }

  setPaused(paused: boolean): Promise<TxResult> {
    return this.sendOrThrow({
      address: this.addresses.vault,
      abi: vaultAbi,
      functionName: "setPaused",
      args: [paused],
    });
  }

  payInvoice(id: bigint, reasonHash: Hex, opts: SendOptions = {}): Promise<TxResult> {
    return this.send(
      {
        address: this.addresses.vault,
        abi: vaultAbi,
        functionName: "payInvoice",
        args: [id, reasonHash],
      },
      opts,
    );
  }
}
