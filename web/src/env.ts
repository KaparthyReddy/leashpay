import { AEVUM } from "@leashpay/sdk";
import type { Address } from "viem";

const e = import.meta.env;

export const web = {
  rpcUrl: (e.VITE_RPC_URL as string | undefined) || AEVUM.rpcUrl,
  chainId: Number((e.VITE_CHAIN_ID as string | undefined) || AEVUM.chainId),
  explorerUrl: ((e.VITE_EXPLORER_URL as string | undefined) || AEVUM.explorerUrl).replace(/\/$/, ""),
  token: ((e.VITE_TOKEN_ADDRESS as string | undefined) || AEVUM.tusd8) as Address,
  registry: e.VITE_REGISTRY_ADDRESS as Address | undefined,
  vault: e.VITE_VAULT_ADDRESS as Address | undefined,
  agent: e.VITE_AGENT_ADDRESS as Address | undefined,
  deployBlock: BigInt((e.VITE_DEPLOY_BLOCK as string | undefined) || "0"),
};

export const configError: string | null =
  !web.registry || !web.vault
    ? "Set VITE_REGISTRY_ADDRESS and VITE_VAULT_ADDRESS in web/.env, then restart the dev server."
    : null;
