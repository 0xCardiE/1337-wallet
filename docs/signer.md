# 1337 is a signer, not a lab

This is the product guideline for features, Tools, and the confirmation sheet.

1337 is a **wallet you sign with**. The job is: understand the request, judge the risk, sign or reject, then live with the result. It is not Foundry, Hardhat, Etherscan, or a general EVM workbench.

If a power user would open `cast`, a deploy script, or an explorer instead of this extension, **do not add it as a Tool**.

## What belongs in the wallet

These are daily signer jobs. Prefer the confirm sheet, History, or a small Inspect peek — not a new top-level tab.

| Surface | Job |
|---------|-----|
| **Confirm sheet** | Human summary, local simulate (pass / fail / revert / gas), contract danger flags, readable approvals and permits |
| **Approvals** | ERC-20, NFT `setApprovalForAll`, and Permit2 — scan and revoke from the same place you approved |
| **Inspect** | Paste an address, token, ENS name, or tx hash. Peek enough to decide whether to send, approve, or open the explorer |
| **History** | *Your* transactions in plain language. Random hashes belong on the explorer |
| **Action tools** | Swap, Multisend, Gas Station, ENS — things you do *with* the signer, not instead of a dapp you already have |

Default Tools (on unless the user hides them): Inspect, Approvals, Swap, ENS, Multisend, Gas Station.

## What does not belong in Tools

Do not ship these as wallet tabs. They are a lab. Add only if users ask, and then as **opt-in** modules.

- Calldata / ABI encode-decode, selector and event lookup
- Read / Write Contract (Etherscan or `cast call` / `cast send`)
- Storage slot / storage layout (`cast storage`)
- CREATE / CREATE2, keccak, unit converters, block/time converters
- Standalone signature r/s/v tools
- RPC tester / compare / chain-id lookup (Networks + Doctor already cover this)
- Standalone paste-a-hash decoder (History + explorer link)
- Tenderly-style asset-diff simulation (needs a sim API; public RPCs cannot do it)
- Other people’s multichain portfolios (DeBank)
- NFT collection browsers (marketplaces)

## How to decide

Ask: **would someone open this wallet to do it?**

- Yes, while signing, sending, revoking, or checking “what is this address?” → build it into the signer.
- Yes, but they would rather use Foundry or Etherscan → do not force it into Tools.
- Niche / once-a-year → backlog until someone asks.

## Implementation rules

1. **Confirm sheet first.** Decode, simulate, and contract hints run on every `eth_sendTransaction` / typed-data request. They are not optional Tools.
2. **No fourth nav tab.** Assets / History / Tools stay. Inspect is a search box on Tools.
3. **Do not grow the tab strip.** New utilities default **off**. Settings → Tools is the only place to enable them.
4. **Local-first.** `eth_call`, `eth_estimateGas`, `eth_getCode`, optional explorer key. No 1337 server. No DeBank/Tenderly as a default dependency.
5. **Honest simulation.** Success, revert reason, and gas are enough. Do not promise balance diffs the RPC cannot provide.
6. **Human line, then details.** “Allow Uniswap to spend unlimited USDC” above the developer sections — not instead of them.

## Related

- [wallet-security.md](./wallet-security.md) — consent, Instant gates, LavaMoat
- [TODO.md](../TODO.md) — backlog, including later-if-asked lab items
