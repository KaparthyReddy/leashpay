import { aevumChain, type LeashClient } from "@leashpay/sdk";
import {
  createWalletClient,
  custom,
  type Abi,
  type Address,
  type EIP1193Provider,
  type Hash,
  type WalletClient,
} from "viem";
import { web } from "./env";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export type WalletSession = { address: Address; walletClient: WalletClient };

export const chain = aevumChain(web.rpcUrl, web.chainId, web.explorerUrl);

async function ensureChain(eth: EIP1193Provider): Promise<void> {
  const chainId = `0x${chain.id.toString(16)}`;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 4902 && code !== -32603) throw err;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls.default.http as string[],
          blockExplorerUrls: [web.explorerUrl],
        },
      ],
    } as never);
  }
}

export async function connectWallet(): Promise<WalletSession> {
  const eth = window.ethereum;
  if (!eth) throw new Error("No browser wallet found. Install MetaMask or Rabby, then reload.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
  if (!accounts.length) throw new Error("The wallet did not share an account.");
  await ensureChain(eth);
  return {
    address: accounts[0],
    walletClient: createWalletClient({ account: accounts[0], chain, transport: custom(eth) }),
  };
}

export type TxRequest = { address: Address; abi: Abi; functionName: string; args: readonly unknown[] };

export async function sendTx(session: WalletSession, client: LeashClient, req: TxRequest): Promise<Hash> {
  const { request } = await client.publicClient.simulateContract({
    ...req,
    account: session.address,
  } as never);
  const hash = await session.walletClient.writeContract({ ...request, type: "legacy" } as never);
  const receipt = await client.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw new Error(`Transaction reverted on-chain: ${hash}`);
  return hash;
}
