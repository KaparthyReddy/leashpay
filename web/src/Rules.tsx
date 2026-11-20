import type { Address } from "viem";
import { addrLink, dateTime, money, short } from "./format";
import type { VaultData } from "./useVault";

type Props = {
  data: VaultData;
  agent: Address | undefined;
  agentInput: string;
  onAgentInput: (v: string) => void;
};

export function Rules({ data, agent, agentInput, onAgentInput }: Props) {
  const { policy, decimals, symbol } = data;
  const fmt = (v: bigint) => money(v, decimals, symbol);
  const windowEnds = policy ? policy.windowStart + 86_400n : 0n;
  const windowLive = !!policy && data.nowSec < windowEnds;

  return (
    <section className="block" aria-labelledby="rules-title">
      <h2 id="rules-title">What the agent is allowed to do</h2>
      <label className="field">
        <span>Agent address</span>
        <input
          value={agentInput}
          onChange={(e) => onAgentInput(e.target.value.trim())}
          placeholder="0x..."
          spellCheck={false}
          aria-invalid={agentInput !== "" && !agent}
        />
      </label>
      {agentInput !== "" && !agent && <p className="hint hint-error">That is not a valid address.</p>}

      {policy && agent ? (
        <dl className="rules">
          <div>
            <dt>Max per payment</dt>
            <dd>{fmt(policy.perTxCap)}</dd>
          </div>
          <div>
            <dt>Max per day</dt>
            <dd>{fmt(policy.dailyCap)}</dd>
          </div>
          <div>
            <dt>Spent in this 24h window</dt>
            <dd>{windowLive ? fmt(policy.spentInWindow) : fmt(0n)}</dd>
          </div>
          <div>
            <dt>Session ends</dt>
            <dd>{policy.expiresAt > 0n ? dateTime(policy.expiresAt) : "Never granted"}</dd>
          </div>
          <div>
            <dt>Can pay only these payees</dt>
            <dd>
              {data.allowlist.length === 0 ? (
                "Nobody yet"
              ) : (
                <ul className="plain">
                  {data.allowlist.map((a) => (
                    <li key={a}>
                      <a href={addrLink(a)} target="_blank" rel="noreferrer">
                        {short(a)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
