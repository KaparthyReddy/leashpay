import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReview } from "../src/review";

test("parses valid JSON", () => {
  const r = parseReview('{"decision":"pay","reason":"looks fine","risk":"low"}');
  assert.equal(r.decision, "pay");
  assert.equal(r.risk, "low");
});

test("extracts JSON wrapped in text", () => {
  const r = parseReview('Sure! {"decision":"reject","reason":"suspicious","risk":"high"} done');
  assert.equal(r.decision, "reject");
});

test("fails closed on garbage", () => {
  assert.equal(parseReview("not json").decision, "reject");
  assert.equal(parseReview('{"decision":"maybe"}').decision, "reject");
  assert.equal(parseReview("").decision, "reject");
});

test("unknown risk defaults to high", () => {
  assert.equal(parseReview('{"decision":"pay","reason":"x","risk":"nope"}').risk, "high");
});
