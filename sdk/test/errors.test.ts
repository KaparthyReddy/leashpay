import assert from "node:assert/strict";
import { test } from "node:test";
import { describeRevert } from "../src/errors";

test("PayeeNotAllowed names the payee", () => {
  const msg = describeRevert("PayeeNotAllowed", ["0xabc"]);
  assert.match(msg, /0xabc/);
  assert.match(msg, /allowlist/);
});

test("caps use the formatter", () => {
  const fmt = (v: bigint) => `${Number(v) / 1e6} tUSD8`;
  const msg = describeRevert("PerTxCapExceeded", [250_000_000n, 200_000_000n], fmt);
  assert.match(msg, /250 tUSD8/);
  assert.match(msg, /200 tUSD8/);
});

test("daily cap message", () => {
  const msg = describeRevert("DailyCapExceeded", [350n, 300n]);
  assert.match(msg, /350/);
  assert.match(msg, /300/);
});

test("unknown error falls back to its name", () => {
  assert.equal(describeRevert("Mystery"), "Contract reverted: Mystery");
});
