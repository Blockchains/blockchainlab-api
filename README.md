# Blockchain Lab Open Data API

![Blockchain Lab Open Data API](social-preview.png)

**Free, static, CORS-enabled JSON datasets for blockchain builders, rebuilt nightly from public sources.** No API key, no backend, no rate limit beyond GitHub Pages.

> Built by **Blockchain Lab — [blockchainlab.com](https://blockchainlab.com/?utm_source=github&utm_medium=readme&utm_campaign=blockchainlab-api)**

- Docs: https://blockchains.github.io/blockchainlab-api/
- Catalogue: https://blockchains.github.io/blockchainlab-api/v1/index.json
- OpenAPI 3.1: [`openapi.yaml`](https://blockchains.github.io/blockchainlab-api/openapi.yaml) · [interactive](https://blockchains.github.io/blockchainlab-api/swagger.html)

## Datasets (counts as of first build, 2026-10-03)

| Endpoint | Rows | What | Source |
|---|---|---|---|
| [`bips`](https://blockchains.github.io/blockchainlab-api/v1/bips.json) | 213 | Bitcoin Improvement Proposals index parsed from bitcoin/bips. | [github.com/bitcoin/bips](https://github.com/bitcoin/bips) |
| [`chains`](https://blockchains.github.io/blockchainlab-api/v1/chains.json) | 2783 | EVM chain registry: chain IDs, native currency, public RPC endpoints and explorers. | [chainid.network (ethereum-lists/chains)](https://chainid.network/chains.json) |
| [`chains-tvl`](https://blockchains.github.io/blockchainlab-api/v1/chains-tvl.json) | 329 | DeFi TVL by chain (USD). Snapshot from DefiLlama. | [DefiLlama](https://api.llama.fi/v2/chains) |
| [`eips`](https://blockchains.github.io/blockchainlab-api/v1/eips.json) | 593 | EIPS index (number, title, status, type, category) parsed from ethereum/EIPs. | [github.com/ethereum/EIPs](https://github.com/ethereum/EIPs/tree/master/EIPS) |
| [`ercs`](https://blockchains.github.io/blockchainlab-api/v1/ercs.json) | 617 | ERCS index (number, title, status, type, category) parsed from ethereum/ERCs. | [github.com/ethereum/ERCs](https://github.com/ethereum/ERCs/tree/master/ERCS) |
| [`events`](https://blockchains.github.io/blockchainlab-api/v1/events.json) | 6 | Upcoming blockchain events from the Blockchain Lab feeds. | [Blockchains/blockchainlab-feeds (ethglobal.com/events; devpost.com (blockchain hackathons))](https://raw.githubusercontent.com/Blockchains/blockchainlab-feeds/main/feeds/events/latest.json) |
| [`glossary`](https://blockchains.github.io/blockchainlab-api/v1/glossary.json) | 80 | Plain-language blockchain glossary from blockchainlab.com (concepts, protocol profiles, failure classes, stack layers). | [blockchainlab.com/learn/glossary](https://blockchainlab.com/learn/glossary) |
| [`grants`](https://blockchains.github.io/blockchainlab-api/v1/grants.json) | 22 | Directory of blockchain ecosystem grant / funding programmes with official links. Curated by Blockchain Lab; link status re-checked nightly. No amounts are listed — read each programme's own page. | [Official programme pages (curated)](https://github.com/Blockchains/blockchainlab-api/blob/main/data/grants.json) |
| [`hackathons`](https://blockchains.github.io/blockchainlab-api/v1/hackathons.json) | 3 | Open and upcoming blockchain hackathons (Devpost, ETHGlobal). | [Blockchains/blockchainlab-feeds (devpost.com/api/hackathons (theme Blockchain, open+upcoming); ethglobal.com/events (future hackathons); X posts (leads only))](https://raw.githubusercontent.com/Blockchains/blockchainlab-feeds/main/feeds/hackathons/latest.json) |
| [`protocols`](https://blockchains.github.io/blockchainlab-api/v1/protocols.json) | 500 | Top 500 DeFi protocols by TVL (USD), excluding CEXs. Snapshot from DefiLlama; not investment advice. | [DefiLlama](https://api.llama.fi/protocols) |
| [`whitepapers`](https://blockchains.github.io/blockchainlab-api/v1/whitepapers.json) | 607 | Blockchain Lab research corpus — whitepaper metadata (no paper text). Original sources linked. | [Blockchain Lab /api/v1/papers](https://blockchainlab.com/api/v1/papers) |

Every file uses the same envelope:

```json
{ "dataset": "chains", "generated_at": "ISO-8601", "source": "...", "source_url": "https://...", "count": 0, "data": [ ... ] }
```

## Quick start

```bash
# Base mainnet RPCs + explorer
curl -s https://blockchains.github.io/blockchainlab-api/v1/chains.json | jq '.data[] | select(.chainId==8453)'
# Top 10 DeFi protocols by TVL (DefiLlama snapshot)
curl -s https://blockchains.github.io/blockchainlab-api/v1/protocols.json | jq '.data[:10][] | {name, tvl_usd}'
# Final ERCs
curl -s https://blockchains.github.io/blockchainlab-api/v1/ercs.json | jq '.data[] | select(.status=="Final") | "ERC-\(.number) \(.title)"'
```

```js
const { data } = await (await fetch("https://blockchains.github.io/blockchainlab-api/v1/whitepapers.json")).json();
console.log(data.filter(p => p.topics?.includes("Proof of stake")).map(p => p.title));
```

## How it works

`scripts/build.mjs` (Node 20, zero dependencies) runs nightly in [GitHub Actions](.github/workflows/nightly.yml), fetches each public source, normalises it and commits `v1/*.json`. If a source fails, the previous file is kept and flagged `stale` in `index.json`.

- **chains** — [chainid.network](https://chainid.network/chains.json) (ethereum-lists/chains, the data behind chainlist.org); RPCs with `${API_KEY}` placeholders removed.
- **protocols / chains-tvl** — [DefiLlama public API](https://api-docs.defillama.com/). CEXs excluded from protocols. Snapshot, not advice.
- **hackathons / events** — reused from [Blockchains/blockchainlab-feeds](https://github.com/Blockchains/blockchainlab-feeds) (Devpost, ETHGlobal), not re-scraped.
- **whitepapers** — metadata from Blockchain Lab's [research corpus API](https://blockchainlab.com/api/v1/papers); each row links to the original source and to the [Blockchain Lab whitepaper page](https://blockchainlab.com/whitepaper?utm_source=github&utm_medium=readme&utm_campaign=blockchainlab-api).
- **glossary** — Blockchain Lab's concept, protocol, failure-class and stack-layer pages ([/learn/glossary](https://blockchainlab.com/learn/glossary?utm_source=github&utm_medium=readme&utm_campaign=blockchainlab-api)).
- **grants** — curated list of official programme pages ([`data/grants.json`](data/grants.json)); link status re-checked on every build. No amounts are listed — they change; read the programme page.
- **eips / ercs / bips** — parsed from front-matter in [ethereum/EIPs](https://github.com/ethereum/EIPs), [ethereum/ERCs](https://github.com/ethereum/ERCs) and [bitcoin/bips](https://github.com/bitcoin/bips).

Run locally: `node scripts/build.mjs && python3 scripts/openapi.py`

## Part of the Blockchain Lab open toolkit

| | |
|---|---|
| [blockchainlab-tools](https://blockchains.github.io/blockchainlab-tools/) | Client-side dev tools: gas, units, ABI, tx decoder, ENS, merkle, storage slots |
| [blockchainlab-mcp](https://github.com/Blockchains/blockchainlab-mcp) | MCP server + JS SDK for AI agents over this API |
| [blockchainlab-lens](https://github.com/Blockchains/blockchainlab-lens) | Explain any Etherscan address / tx with the tools |
| [blockchainlab-labs](https://github.com/Blockchains/blockchainlab-labs) | 30 hands-on Foundry labs with CI |
| [blockchain-dev-roadmap](https://github.com/Blockchains/blockchain-dev-roadmap) | Curated developer roadmap |
| [blockchain-interview-questions](https://github.com/Blockchains/blockchain-interview-questions) | Interview question bank |
| [blockchainlab-feeds](https://github.com/Blockchains/blockchainlab-feeds) | Hackathon / event / X-intel feeds |

## Licence

Code: MIT. Data: belongs to each named source — check its terms. Glossary text © Blockchain Lab; please attribute and link [blockchainlab.com](https://blockchainlab.com/?utm_source=github&utm_medium=readme&utm_campaign=blockchainlab-api).

---
Built by Blockchain Lab — [blockchainlab.com](https://blockchainlab.com/?utm_source=github&utm_medium=readme&utm_campaign=blockchainlab-api)
