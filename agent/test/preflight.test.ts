import assert from "node:assert/strict";
import { test } from "node:test";
import { InvoiceStatus, type Invoice, type Policy } from "@leashpay/sdk";
import { preflight } from "../src/preflight";

const VAULT = "0x00000000000000000000000000000000000000aa" as const;
const MERCHANT = "0x00000000000000000000000000000000000000bb" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const NOW = 1_000_000n;

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  merchant: MERCHANT,
  payer: ZERO,
  amount: 100n,
  expiresAt: NOW + 1000n,
  status: InvoiceStatus.Open,
  ref: "0x00",
  ...over,
});

const policy = (over: Partial<Policy> = {}): Policy => ({
  active: true,
  expiresAt: NOW + 10_000n,
  perTxCap: 200n,
  dailyCap: 300n,
  spentInWindow: 0n,
  windowStart: NOW - 10n,
  ...over,
});

const base = { payeeAllowed: true, paused: false, nowSec: NOW, vault: VAULT };

test("clean invoice passes", () => {
  const r = preflight({ ...base, invoice: invoice(), policy: policy() });
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
});

test("unlisted payee is flagged", () => {
  const r = preflight({ ...base, payeeAllowed: false, invoice: invoice(), policy: policy() });
  assert.equal(r.ok, false);
  assert.match(r.problems.join(" "), /allowlist/);
});

test("per-tx and daily caps", () => {
  const big = preflight({ ...base, invoice: invoice({ amount: 250n }), policy: policy() });
  assert.match(big.problems.join(" "), /per-transaction/);
  const daily = preflight({
    ...base,
    invoice: invoice({ amount: 150n }),
    policy: policy({ spentInWindow: 200n }),
  });
  assert.match(daily.problems.join(" "), /daily cap/);
});

test("daily window resets after 24h", () => {
  const r = preflight({
    ...base,
    invoice: invoice({ amount: 150n }),
    policy: policy({ spentInWindow: 200n, windowStart: NOW - 86_401n }),
  });
  assert.equal(r.ok, true);
});

test("paused, revoked, expired", () => {
  assert.equal(preflight({ ...base, paused: true, invoice: invoice(), policy: policy() }).ok, false);
  assert.equal(preflight({ ...base, invoice: invoice(), policy: policy({ active: false }) }).ok, false);
  assert.equal(
    preflight({ ...base, invoice: invoice(), policy: policy({ expiresAt: NOW }) }).ok,
    false,
  );
});

test("invoice state and payer restriction", () => {
  assert.equal(
    preflight({ ...base, invoice: invoice({ status: InvoiceStatus.Paid }), policy: policy() }).ok,
    false,
  );
  assert.equal(
    preflight({ ...base, invoice: invoice({ expiresAt: NOW - 1n }), policy: policy() }).ok,
    false,
  );
  assert.equal(
    preflight({ ...base, invoice: invoice({ payer: MERCHANT }), policy: policy() }).ok,
    false,
  );
  assert.equal(preflight({ ...base, invoice: invoice({ payer: VAULT }), policy: policy() }).ok, true);
});
