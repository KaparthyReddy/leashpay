import { isAddress, type Address } from "viem";
import { AEVUM } from "./chain";

export type LeashConfig = {
  rpcUrl: string;
  chainId: number;
  explorerUrl?: string;
  token: Address;
  registry: Address;
  vault: Address;
};

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): LeashConfig {
  const get = (key: string): string | undefined => env[key]?.trim() || undefined;

  const missing = ["INVOICE_REGISTRY_ADDRESS", "AGENT_VAULT_ADDRESS"].filter((k) => !get(k));
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}. Fill them in .env after deploying`);
  }

  const chainId = Number(get("AEVUM_CHAIN_ID") ?? AEVUM.chainId);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("AEVUM_CHAIN_ID must be a positive integer");
  }

  const addr = (key: string, fallback?: string): Address => {
    const v = get(key) ?? fallback;
    if (!v || !isAddress(v)) throw new Error(`${key} is not a valid address: ${String(v)}`);
    return v;
  };

  return {
    rpcUrl: get("AEVUM_RPC_URL") ?? AEVUM.rpcUrl,
    chainId,
    explorerUrl: get("AEVUM_EXPLORER_URL") ?? AEVUM.explorerUrl,
    token: addr("TUSD8_ADDRESS", AEVUM.tusd8),
    registry: addr("INVOICE_REGISTRY_ADDRESS"),
    vault: addr("AGENT_VAULT_ADDRESS"),
  };
}
