import { addrLink, money, short } from "./format";
import { statusLabel, type VaultData } from "./useVault";

export function Invoices({ data }: { data: VaultData }) {
  const fmt = (v: bigint) => money(v, data.decimals, data.symbol);
  return (
    <section className="block" aria-labelledby="inv-title">
      <h2 id="inv-title">Recent invoices</h2>
      {data.invoices.length === 0 ? (
        <p className="hint">No invoices yet. When a merchant creates one, it appears here.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>From</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th>On allowlist</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv) => {
                const label = statusLabel(inv, data.nowSec);
                return (
                  <tr key={inv.id.toString()}>
                    <td>{inv.id.toString()}</td>
                    <td>
                      <a href={addrLink(inv.merchant)} target="_blank" rel="noreferrer">
                        {short(inv.merchant)}
                      </a>
                    </td>
                    <td className="num">{fmt(inv.amount)}</td>
                    <td>
                      <span className={`tag tag-${label.toLowerCase()}`}>{label}</span>
                    </td>
                    <td>{inv.allowed ? "Yes" : <strong className="warn">No: the vault will refuse it</strong>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
