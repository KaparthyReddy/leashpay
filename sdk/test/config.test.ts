import assert from "node:assert/strict";
import { test } from "node:test";
import { AEVUM } from "../src/chain";
import { loadConfig } from "../src/config";

const REGISTRY = "0x00000000000000000000000000000000000000aa";
const VAULT = "0x00000000000000000000000000000000000000bb";

test("defaults to Aevum testnet values", () => {
  const cfg = loadConfig({ INVOICE_REGISTRY_ADDRESS: REGISTRY, AGENT_VAULT_ADDRESS: VAULT });
  assert.equal(cfg.chainId, 44005);
  assert.equal(cfg.rpcUrl, AEVUM.rpcUrl);
  assert.equal(cfg.token, AEVUM.tusd8);
  assert.equal(cfg.explorerUrl, AEVUM.explorerUrl);
});

test("empty strings fall back to defaults", () => {
  const cfg = loadConfig({
    AEVUM_RPC_URL: "",
    AEVUM_CHAIN_ID: "",
    TUSD8_ADDRESS: "",
    INVOICE_REGISTRY_ADDRESS: REGISTRY,
    AGENT_VAULT_ADDRESS: VAULT,
  });
  assert.equal(cfg.chainId, 44005);
});

test("requires deployed addresses", () => {
  assert.throws(() => loadConfig({}), /INVOICE_REGISTRY_ADDRESS, AGENT_VAULT_ADDRESS/);
});

test("rejects bad addresses and chain ids", () => {
  assert.throws(() => loadConfig({ INVOICE_REGISTRY_ADDRESS: "nope", AGENT_VAULT_ADDRESS: VAULT }), /valid address/);
  assert.throws(
    () => loadConfig({ AEVUM_CHAIN_ID: "abc", INVOICE_REGISTRY_ADDRESS: REGISTRY, AGENT_VAULT_ADDRESS: VAULT }),
    /positive integer/,
  );
});
