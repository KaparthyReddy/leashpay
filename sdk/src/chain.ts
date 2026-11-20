import { defineChain, type Address, type Chain } from "viem";

export const AEVUM = {
  chainId: 44005,
  rpcUrl: "https://rpc-test.qday.info",
  explorerUrl: "https://explorer-test.qday.info",
  tusd8: "0x456569838f1d43009A91ebA4263147Afd7233483" as Address,
  tusd8Decimals: 6,
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11" as Address,
  maxLogRange: 1000n,
} as const;

export function aevumChain(
  rpcUrl: string = AEVUM.rpcUrl,
  chainId: number = AEVUM.chainId,
  explorerUrl: string | undefined = AEVUM.explorerUrl,
): Chain {
  return defineChain({
    id: chainId,
    name: "QDay Aevum Testnet",
    nativeCurrency: { name: "Test QDAY", symbol: "tQDAY", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: explorerUrl
      ? { default: { name: "Aevum Explorer", url: explorerUrl } }
      : undefined,
    contracts: { multicall3: { address: AEVUM.multicall3 } },
    testnet: true,
  });
}
