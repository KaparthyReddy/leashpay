import { useState } from "react";
import { isAddress, parseUnits, type Address } from "viem";
import type { VaultData } from "./useVault";

type Props = {
  data: VaultData;
  agent: Address | undefined;
  busy: boolean;
  ownerAddress: Address;
  actions: {
    grant: (perTx: bigint, daily: bigint, days: number) => void;
    revoke: () => void;
    setPayee: (payee: Address, allowed: boolean) => void;
    deposit: (amount: bigint) => void;
    withdraw: (to: Address, amount: bigint) => void;
  };
};

export function Controls({ data, agent, busy, ownerAddress, actions }: Props) {
  const [perTx, setPerTx] = useState("1");
  const [daily, setDaily] = useState("2");
  const [days, setDays] = useState("7");
  const [payee, setPayee] = useState("");
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawTo, setWithdrawTo] = useState<string>(ownerAddress);

  const amount = (s: string): bigint | null => {
    try {
      const v = parseUnits(s, data.decimals);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  };
  const perTxV = amount(perTx);
  const dailyV = amount(daily);
  const daysV = Number(days);
  const grantOk = !!agent && !!perTxV && !!dailyV && dailyV >= perTxV && Number.isFinite(daysV) && daysV > 0;
  const payeeOk = isAddress(payee);

  return (
    <section className="block" aria-labelledby="controls-title">
      <h2 id="controls-title">Owner controls</h2>

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (grantOk) actions.grant(perTxV!, dailyV!, daysV);
        }}
      >
        <h3>Give the agent a new session</h3>
        <div className="row">
          <label className="field">
            <span>Per payment ({data.symbol})</span>
            <input value={perTx} onChange={(e) => setPerTx(e.target.value)} inputMode="decimal" />
          </label>
          <label className="field">
            <span>Per day ({data.symbol})</span>
            <input value={daily} onChange={(e) => setDaily(e.target.value)} inputMode="decimal" />
          </label>
          <label className="field">
            <span>Days valid</span>
            <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
          </label>
        </div>
        {!!dailyV && !!perTxV && dailyV < perTxV && (
          <p className="hint hint-error">The daily limit must be at least the per-payment limit.</p>
        )}
        <div className="row actions">
          <button className="btn" disabled={busy || !grantOk}>
            Save session
          </button>
          <button type="button" className="btn btn-quiet btn-stop-text" disabled={busy || !agent} onClick={actions.revoke}>
            Revoke agent now
          </button>
        </div>
      </form>

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (payeeOk) actions.setPayee(payee as Address, true);
        }}
      >
        <h3>Who the agent may pay</h3>
        <label className="field">
          <span>Payee address</span>
          <input value={payee} onChange={(e) => setPayee(e.target.value.trim())} placeholder="0x..." spellCheck={false} />
        </label>
        <div className="row actions">
          <button className="btn" disabled={busy || !payeeOk}>
            Allow payee
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            disabled={busy || !payeeOk}
            onClick={() => actions.setPayee(payee as Address, false)}
          >
            Remove payee
          </button>
        </div>
      </form>

      <div className="split">
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const v = amount(depositAmt);
            if (v) actions.deposit(v);
          }}
        >
          <h3>Add funds</h3>
          <label className="field">
            <span>Amount ({data.symbol})</span>
            <input value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} inputMode="decimal" />
          </label>
          <button className="btn" disabled={busy || !amount(depositAmt)}>
            Deposit
          </button>
        </form>

        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const v = amount(withdrawAmt);
            if (v && isAddress(withdrawTo)) actions.withdraw(withdrawTo, v);
          }}
        >
          <h3>Take funds out</h3>
          <label className="field">
            <span>Amount ({data.symbol})</span>
            <input value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)} inputMode="decimal" />
          </label>
          <label className="field">
            <span>Send to</span>
            <input value={withdrawTo} onChange={(e) => setWithdrawTo(e.target.value.trim())} spellCheck={false} />
          </label>
          <button className="btn" disabled={busy || !amount(withdrawAmt) || !isAddress(withdrawTo)}>
            Withdraw
          </button>
        </form>
      </div>
    </section>
  );
}
