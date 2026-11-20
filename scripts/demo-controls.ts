import { addr, agent, attempt, createInvoiceWithMemo, fmt, grantAgentPolicy, merchant, owner, showTx, title, usd } from "./lib";

async function invoice(amount: string, subject: string): Promise<bigint> {
  return createInvoiceWithMemo(merchant, {
    amount: usd(amount),
    payer: owner.addresses.vault,
    memo: { from: "billing@acme.studio", subject, body: subject },
  });
}

async function main() {
  const vaultBefore = await owner.vaultBalance();
  console.log(`vault balance before: ${fmt(vaultBefore)}`);

  title("1. Per-transaction cap");
  const big = await invoice("1.5", "Oversized invoice above the per-tx cap");
  await attempt("agent pays oversized invoice", agent, big);

  title("2. Owner pauses the vault");
  const small = await invoice("0.1", "Small invoice while paused");
  showTx("setPaused(true)", await owner.setPaused(true));
  await attempt("agent pays while paused", agent, small);
  showTx("setPaused(false)", await owner.setPaused(false));

  title("3. Owner revokes the agent");
  showTx("revokeAgent", await owner.revokeAgent(addr(agent)));
  await attempt("revoked agent pays", agent, small);

  title("4. Owner restores the agent");
  await grantAgentPolicy();

  title("Outcome");
  console.log(`vault balance: ${fmt(vaultBefore)} -> ${fmt(await owner.vaultBalance())} (unchanged: every attempt was blocked)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
