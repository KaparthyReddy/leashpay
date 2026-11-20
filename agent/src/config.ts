import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, type LeashConfig } from "@leashpay/sdk";
import type { Hex } from "viem";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, "../..");

loadEnv({ path: resolve(ROOT, ".env") });

export type OllamaConfig = { host: string; model: string };

export type AgentConfig = {
  leash: LeashConfig;
  agentKey: Hex;
  ollama: OllamaConfig;
  inboxDir: string;
  pollSeconds: number;
};

export function loadAgentConfig(env: Record<string, string | undefined> = process.env): AgentConfig {
  const leash = loadConfig(env);
  const key = env.AGENT_PRIVATE_KEY?.trim();
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("AGENT_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string");
  }
  return {
    leash,
    agentKey: key as Hex,
    ollama: {
      host: (env.OLLAMA_HOST?.trim() || "http://127.0.0.1:11434").replace(/\/$/, ""),
      model: env.OLLAMA_MODEL?.trim() || "llama3.2:3b",
    },
    inboxDir: env.INBOX_DIR ? resolve(ROOT, env.INBOX_DIR) : resolve(ROOT, "inbox"),
    pollSeconds: Number(env.POLL_SECONDS ?? 10),
  };
}
