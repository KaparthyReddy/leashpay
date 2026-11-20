import { defineChain, type Chain } from "viem";

export function aevumChain(rpcUrl: string, chainId: number, explorerUrl?: string): Chain {
  return defineChain({
    id: chainId,
    name: "Aevum Testnet",
    nativeCurrency: { name: "Aevum", symbol: "AEV", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: explorerUrl
      ? { default: { name: "Aevum Explorer", url: explorerUrl } }
      : undefined,
  });
}
