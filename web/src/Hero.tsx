import type { Address } from "viem";
import { dateTime, money } from "./format";
import type { VaultData } from "./useVault";

type Props = {
  data: VaultData;
  agent: Address | undefined;
  isOwner: boolean;
  busy: boolean;
  onTogglePause: () => void;
};

export function Hero({ data, agent, isOwner, busy, onTogglePause }: Props) {
  const { policy, decimals, symbol, nowSec } = data;
  const fmt = (v: bigint) => money(v, decimals, symbol);

  const expired = !!policy && nowSec >= policy.expiresAt;
  const live = !!policy && policy.active && !expired;

  let headline: string;
  let sub: string;
  if (!agent) {
    headline = "No agent selected";
    sub = "Enter an agent address below to see its allowance.";
  } else if (data.paused) {
    headline = "Payments are paused";
    sub = "The agent cannot spend until you resume.";
  } else if (!live) {
    headline = expired ? "The agent's session has ended" : "The agent has no spending rights";
    sub = expired ? "Grant a new session to let it pay again." : "It was never granted access, or you revoked it.";
  } else {
    headline = `${fmt(data.remaining)} left today`;
    sub = `Out of a ${fmt(policy!.dailyCap)} daily limit. Session ends ${dateTime(policy!.expiresAt)}.`;
  }

  const ratio =
    live && policy!.dailyCap > 0n ? Number((data.remaining * 10_000n) / policy!.dailyCap) / 100 : 0;
  const tick =
    live && policy!.dailyCap > 0n ? Math.min(100, Number((policy!.perTxCap * 10_000n) / policy!.dailyCap) / 100) : 0;

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-main">
        <p className="hero-kicker">Vault holds {fmt(data.balance)}</p>
        <h1 id="hero-title" className={data.paused || !live ? "is-stopped" : undefined}>
          {headline}
        </h1>
        <p className="hero-sub">{sub}</p>

        {live && !data.paused && (
          <div className="tether" role="img" aria-label={`${ratio.toFixed(0)} percent of the daily allowance remains`}>
            <div className="tether-track">
              <div className="tether-fill" style={{ width: `${ratio}%` }} />
              <div className="tether-tick" style={{ left: `${tick}%` }} />
            </div>
            <div className="tether-scale">
              <span>0</span>
              <span className="tether-tick-label" style={{ left: `${tick}%` }}>
                {fmt(policy!.perTxCap)} max per payment
              </span>
              <span>{fmt(policy!.dailyCap)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="hero-side">
        <span className={`pill ${data.paused ? "pill-stop" : live ? "pill-ok" : "pill-idle"}`}>
          {data.paused ? "Paused" : live ? "Agent active" : expired ? "Expired" : "No access"}
        </span>
        {isOwner ? (
          <button className={data.paused ? "btn" : "btn btn-stop"} disabled={busy} onClick={onTogglePause}>
            {data.paused ? "Resume payments" : "Pause all payments"}
          </button>
        ) : (
          <p className="hint">Connect the owner wallet to pause or resume.</p>
        )}
      </div>
    </section>
  );
}
