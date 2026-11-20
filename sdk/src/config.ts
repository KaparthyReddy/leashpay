import { isAddress, type Address } from "viem";

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
  const required = [
    "AEVUM_RPC_URL",
    "AEVUM_CHAIN_ID",
    "TUSD8_ADDRESS",
    "INVOICE_REGISTRY_ADDRESS",
    "AGENT_VAULT_ADDRESS",
  ];
  const missing = required.filter((k) => !env[k]?.trim());
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}. Fill them in .env`);
  }

  const chainId = Number(env.AEVUM_CHAIN_ID);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("AEVUM_CHAIN_ID must be a positive integer");
  }

  const addr = (key: string): Address => {
    const v = env[key]!.trim();
    if (!isAddress(v)) throw new Error(`${key} is not a valid address: ${v}`);
    return v;
  };

  return {
    rpcUrl: env.AEVUM_RPC_URL!.trim(),
    chainId,
    explorerUrl: env.AEVUM_EXPLORER_URL?.trim() || undefined,
    token: addr("TUSD8_ADDRESS"),
    registry: addr("INVOICE_REGISTRY_ADDRESS"),
    vault: addr("AGENT_VAULT_ADDRESS"),
  };
}
