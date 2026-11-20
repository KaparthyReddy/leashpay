import { formatUnits, type Address, type Hash } from "viem";
import { web } from "./env";

export const money = (v: bigint, decimals: number, symbol: string): string => {
  const n = formatUnits(v, decimals);
  const [whole, frac = ""] = n.split(".");
  const trimmed = frac.replace(/0+$/, "");
  return `${Number(whole).toLocaleString()}${trimmed ? `.${trimmed}` : ""} ${symbol}`;
};

export const short = (a: string): string => `${a.slice(0, 6)}...${a.slice(-4)}`;

export const txLink = (hash: Hash | string): string => `${web.explorerUrl}/tx/${hash}`;
export const addrLink = (a: Address | string): string => `${web.explorerUrl}/address/${a}`;

export const dateTime = (sec: bigint): string =>
  new Date(Number(sec) * 1000).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const same = (a?: string, b?: string): boolean => !!a && !!b && a.toLowerCase() === b.toLowerCase();
