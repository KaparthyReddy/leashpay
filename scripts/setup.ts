import { addr, agent, fmt, grantAgentPolicy, merchant, owner, POLICY, showTx, title, usd } from "./lib";

async function main() {
  const target = usd(process.env.DEPOSIT ?? "3");

  title("Vault setup");
  console.log(`owner:    ${addr(owner)}`);
  console.log(`agent:    ${addr(agent)}`);
  console.log(`merchant: ${addr(merchant)}`);
  console.log(`vault:    ${owner.addresses.vault}`);

  const have = await owner.vaultBalance();
  if (have < target) {
    const topUp = target - have;
    const wallet = await owner.tokenBalance(addr(owner));
    if (wallet < topUp) throw new Error(`Owner wallet has ${fmt(wallet)}, needs ${fmt(topUp)}. Use /faucet or lower DEPOSIT`);
    showTx(`deposit ${fmt(topUp)}`, await owner.deposit(topUp));
  } else {
    console.log(`vault already holds ${fmt(have)}`);
  }

  if (!(await owner.isPayeeAllowed(addr(merchant)))) {
    showTx("allowlist merchant", await owner.setPayee(addr(merchant), true));
  } else {
    console.log("merchant already allowlisted");
  }

  await grantAgentPolicy();

  const policy = await owner.getPolicy(addr(agent));
  title("Result");
  console.log(`vault balance: ${fmt(await owner.vaultBalance())}`);
  console.log(`per-tx cap:    ${fmt(policy.perTxCap)}`);
  console.log(`daily cap:     ${fmt(policy.dailyCap)}`);
  console.log(`expires:       ${new Date(Number(policy.expiresAt) * 1000).toISOString()}`);
  console.log(`(default policy: ${fmt(POLICY.perTxCap)} per tx, ${fmt(POLICY.dailyCap)} per day)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
