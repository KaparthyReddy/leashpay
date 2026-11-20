import { explainRevert, vaultAbi, erc20Abi } from "@leashpay/sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isAddress, type Address } from "viem";
import { Controls } from "./Controls";
import { configError, web } from "./env";
import { addrLink, money, same, short, txLink } from "./format";
import { Hero } from "./Hero";
import { Invoices } from "./Invoices";
import { Ledger } from "./Ledger";
import { Rules } from "./Rules";
import { useLeashClient, useVault } from "./useVault";
import { connectWallet, sendTx, type WalletSession } from "./wallet";

type Notice = { kind: "pending" | "ok" | "error"; text: string; hash?: string };

export default function App() {
  const client = useLeashClient();
  const [agentInput, setAgentInput] = useState<string>(web.agent ?? "");
  const agent = useMemo(() => (isAddress(agentInput) ? (agentInput as Address) : undefined), [agentInput]);
  const { data, error, loading, refresh } = useVault(client, agent);
  const [session, setSession] = useState<WalletSession | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    const reset = () => setSession(null);
    eth.on("accountsChanged", reset);
    eth.on("chainChanged", reset);
    return () => {
      eth.removeListener("accountsChanged", reset);
      eth.removeListener("chainChanged", reset);
    };
  }, []);

  const isOwner = !!session && !!data && same(session.address, data.owner);

  const run = useCallback(
    async (label: string, action: () => Promise<string>) => {
      setBusy(true);
      setNotice({ kind: "pending", text: `${label}: confirm in your wallet, then wait for the network.` });
      try {
        const hash = await action();
        setNotice({ kind: "ok", text: `${label}: done.`, hash });
        await refresh();
      } catch (err) {
        const fmt = (v: bigint) => (data ? money(v, data.decimals, data.symbol) : v.toString());
        const rejected = /user rejected|denied/i.test(err instanceof Error ? err.message : "");
        setNotice({
          kind: "error",
          text: rejected ? `${label}: you cancelled the request in your wallet.` : `${label} failed. ${explainRevert(err, fmt)}`,
        });
      } finally {
        setBusy(false);
      }
    },
    [refresh, data],
  );

  const vaultTx = useCallback(
    (functionName: string, args: readonly unknown[]) => () => {
      if (!session || !client) throw new Error("Connect your wallet first.");
      return sendTx(session, client, { address: client.addresses.vault, abi: vaultAbi, functionName, args });
    },
    [session, client],
  );

  const connect = async () => {
    try {
      setSession(await connectWallet());
      setNotice(null);
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    }
  };

  if (configError || !client) {
    return (
      <main className="shell">
        <h1>LeashPay needs two addresses</h1>
        <p>{configError}</p>
      </main>
    );
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>LeashPay</span>
        </div>
        <div className="top-right">
          <a className="link" href={addrLink(client.addresses.vault)} target="_blank" rel="noreferrer">
            Vault {short(client.addresses.vault)}
          </a>
          {session ? (
            <span className="pill pill-idle">{isOwner ? "Owner" : "Viewer"} {short(session.address)}</span>
          ) : (
            <button className="btn btn-quiet" onClick={connect}>
              Connect wallet
            </button>
          )}
        </div>
      </header>

      {notice && (
        <div className={`notice notice-${notice.kind}`} role="status">
          <span>{notice.text}</span>
          {notice.hash && (
            <a href={txLink(notice.hash)} target="_blank" rel="noreferrer">
              View transaction
            </a>
          )}
          <button className="notice-close" aria-label="Dismiss" onClick={() => setNotice(null)}>
            Close
          </button>
        </div>
      )}

      {error && !data && <p className="hint hint-error">Could not load the vault: {error}</p>}
      {!data && !error && <p className="hint">Loading the vault from Aevum...</p>}

      {data && (
        <main>
          <Hero
            data={data}
            agent={agent}
            isOwner={isOwner}
            busy={busy}
            onTogglePause={() => run(data.paused ? "Resume payments" : "Pause payments", vaultTx("setPaused", [!data.paused]))}
          />

          <div className="columns">
            <div className="col">
              <Rules data={data} agent={agent} agentInput={agentInput} onAgentInput={setAgentInput} />
              <Invoices data={data} />
              {isOwner && session && (
                <Controls
                  data={data}
                  agent={agent}
                  busy={busy}
                  ownerAddress={session.address}
                  actions={{
                    grant: (perTx, daily, days) =>
                      run(
                        "Save session",
                        vaultTx("grantAgent", [agent, data.nowSec + BigInt(Math.round(days * 86_400)), perTx, daily]),
                      ),
                    revoke: () => run("Revoke agent", vaultTx("revokeAgent", [agent])),
                    setPayee: (payee, allowed) =>
                      run(allowed ? "Allow payee" : "Remove payee", vaultTx("setPayee", [payee, allowed])),
                    deposit: (amount) =>
                      run("Deposit", async () => {
                        const allowance = (await client.publicClient.readContract({
                          address: client.addresses.token,
                          abi: erc20Abi,
                          functionName: "allowance",
                          args: [session.address, client.addresses.vault],
                        })) as bigint;
                        if (allowance < amount) {
                          await sendTx(session, client, {
                            address: client.addresses.token,
                            abi: erc20Abi,
                            functionName: "approve",
                            args: [client.addresses.vault, amount],
                          });
                        }
                        return vaultTx("deposit", [amount])();
                      }),
                    withdraw: (to, amount) => run("Withdraw", vaultTx("withdraw", [to, amount])),
                  }}
                />
              )}
              {!isOwner && (
                <section className="block">
                  <h2>Owner controls</h2>
                  <p className="hint">
                    {session
                      ? "This wallet is not the vault owner, so it can look but not change anything."
                      : "Connect the owner wallet to change limits, allow payees, pause, or move funds."}
                  </p>
                </section>
              )}
            </div>
            <div className="col">
              <Ledger data={data} vault={client.addresses.vault} />
            </div>
          </div>
        </main>
      )}

      <footer className="foot">
        <span>Aevum testnet, test tokens only.</span>
        <button className="link-button" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh now"}
        </button>
      </footer>
    </div>
  );
}
