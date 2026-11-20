# On-chain evidence (Aevum testnet, chain 44005)

Explorer: https://explorer-test.qday.info

## Deployed contracts

| Contract | Address |
|---|---|
| AgentVault | `0x81faaad38c95ef074f5df51a07c3d875a4540bf2` |
| InvoiceRegistry | `0x25c255b8f752a081c454080e85ba0595ee5b11ca` |
| tUSD8 | `0x456569838f1d43009A91ebA4263147Afd7233483` |

Owner `0x90b2a4400f8164b2Eb486421827046EAB568f531`, agent `0x554cb6f22B0A90EBeEEbfe419cde47cd0754f13A`, merchant `0x175d9B9e0f6c6d26a5cAc2983A6956acB99E9732`.

The successful agent payment of invoice 1 (0.5 tUSD8 to the merchant) is the `AgentPaid` event in block 3638298, visible in the vault's logs and in the web console's ledger.

## Attack: prompt-injected invoice from an unknown payee

An attacker address (`0x2bB52E92A4F2dD257aC87B78be149C3E07B48450`) created invoice 2 for 0.9 tUSD8 with an injection memo. The local model rejected it. Then a compromised agent tried to pay anyway and the vault reverted. Vault balance stayed 2.5 tUSD8 and the attacker received 0.

| Step | Transaction |
|---|---|
| Attacker creates invoice 2 | [0xe3710fbd...3c6d04](https://explorer-test.qday.info/tx/0xe3710fbdeeb2ead58ac29a9d85531812508d6c4db9eb0c7dff921e0d2f3c6d04) |
| Compromised agent tries to pay, reverts with PayeeNotAllowed | [0x8e103c52...a1b5f](https://explorer-test.qday.info/tx/0x8e103c52077ee1f71bc6dba13cd97802e57bd7145c82fcb87ccb0b0da56a1b5f) |

## Controls: caps, pause, revoke

Vault balance was 2.5 tUSD8 before and after: every attempt was blocked.

| Step | Transaction |
|---|---|
| Merchant creates invoice 3 (1.5 tUSD8, above the 1 tUSD8 cap) | [0x617e58dc...8f6d79e](https://explorer-test.qday.info/tx/0x617e58dcce962a74edcee594aa83fbdd9de42bb6a8d0e2d0a18c5a03b8f6d79e) |
| Agent pays invoice 3, reverts with PerTxCapExceeded | [0xded11adb...74d97](https://explorer-test.qday.info/tx/0xded11adb04cbfdb785a40c160216b118da509e741108774ea65dd4b3f2674d97) |
| Merchant creates invoice 4 (0.1 tUSD8) | [0xaa09eb23...d4952](https://explorer-test.qday.info/tx/0xaa09eb231351d4e634609ac78d16b089ad5ccafb8078e986f8e2d1a3901d4952) |
| Owner pauses the vault | [0xe6f90df7...4d872](https://explorer-test.qday.info/tx/0xe6f90df76bd9795c2072b4f3d3c1160e892b5337469f7f1f9a5b058317f4d872) |
| Agent pays while paused, reverts with VaultPaused | [0x52de7738...f49a](https://explorer-test.qday.info/tx/0x52de773803e65ab118da0ee9b4bb37e521a7ee7acdd65d075692e57fe2b8f49a) |
| Owner resumes the vault | [0x8132a3e7...41d59](https://explorer-test.qday.info/tx/0x8132a3e71c7c965442d99d4d1696e2aaefe6079597abdc94900c985b8bb41d59) |
| Owner revokes the agent | [0x1dc8552f...4178b](https://explorer-test.qday.info/tx/0x1dc8552f85b72c8f2e750b56a87d916df7380adbecafb9041470c86c4744178b) |
| Revoked agent pays, reverts with NotActiveAgent | [0xf469ac17...ec966](https://explorer-test.qday.info/tx/0xf469ac174ce4d765bb37fc4b83802dc5645a2949612c5fdb1b901843b88ec966) |
| Owner restores the agent | [0x9ba2fd06...8935b](https://explorer-test.qday.info/tx/0x9ba2fd068d670e3c6361fb58daa4d4790370d988a4aece6e7fd6d7a4e0e8935b) |

Transactions marked "reverts" were sent on purpose with a fixed gas limit so the failure is recorded on-chain.

## Reproduce

```
npx tsx scripts/demo-attack.ts
npx tsx scripts/demo-controls.ts
npx tsx scripts/audit.ts
```
