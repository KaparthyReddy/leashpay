import { processInvoice } from "../agent/src/agent";
import { ensureOllama } from "../agent/src/ollama";
import { addr, agent, config, createInvoiceWithMemo, fmt, merchant, owner, title, usd } from "./lib";

async function main() {
  await ensureOllama(config.ollama);

  title("Happy path: merchant invoices, agent pays");
  const amount = usd(process.env.AMOUNT ?? "0.5");
  const id = await createInvoiceWithMemo(merchant, {
    amount,
    payer: owner.addresses.vault,
    memo: {
      from: "billing@acme.studio",
      subject: "Invoice INV-0142: logo design, 50% deposit",
      body: "Hello, this is the deposit invoice for the logo design project agreed on 12 November. Thank you!",
    },
  });

  const before = await owner.tokenBalance(addr(merchant));
  const outcome = await processInvoice(
    { client: agent, ollama: config.ollama, inboxDir: config.inboxDir, log: (l) => console.log(`  ${l}`) },
    id,
  );

  title("Outcome");
  console.log(`${outcome.action}: ${outcome.detail}`);
  if (outcome.txHash) console.log(`tx: ${outcome.txHash}\n${outcome.url ?? ""}`);
  const after = await owner.tokenBalance(addr(merchant));
  console.log(`merchant balance: ${fmt(before)} -> ${fmt(after)}`);
  console.log(`vault balance:    ${fmt(await owner.vaultBalance())}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
