# AGENTS.md: blockchainlab-api

Instructions for AI coding agents (Grok, Cursor, Claude Code, Codex, Copilot and others) working **in** this repo or **using it as a building block**. Humans: see [README.md](README.md).

## What this is

Free, static, CORS-enabled JSON API of 20 blockchain datasets rebuilt nightly from public sources (chainid.network, DefiLlama, L2BEAT, OFAC via 0xB10C, ethereum/EIPs, bitcoin/bips, Blockchain Lab corpus). No key, no backend.

- Kind: http-api, dataset · stability: `stable` · licence: MIT
- Machine-readable manifest: [`blocks.json`](blocks.json) (schema: [BLOCKS-SCHEMA](https://github.com/Blockchains/.github/blob/main/docs/BLOCKS-SCHEMA.md))
- How it fits with the other Blockchains repos: [Build with Blocks](https://github.com/Blockchains/.github/blob/main/docs/BUILD-WITH-BLOCKS.md)

## Setup

```bash
node --version   # Node 20, zero npm dependencies
pip install jsonschema==4.23.0 pyyaml
```

## Build and test

```bash
node scripts/build.mjs          # fetch all sources, write v1/*.json (network)
python3 scripts/validate.py     # every dataset validates against its schema
python3 scripts/openapi.py && git diff --exit-code openapi.json
```

Tests hit **live** public networks/APIs (the org rule is no mocks). A failure can be an upstream outage: re-run before changing code.

## Structure

| Path | What |
|---|---|
| `scripts/build.mjs` | nightly builder: fetch, normalise, write `v1/<dataset>.json` |
| `scripts/schemas.py` | JSON Schemas per dataset |
| `scripts/validate.py` | schema validation |
| `scripts/openapi.py` | generates openapi.json/yaml |
| `v1/` | published datasets + `index.json` + `schemas/` |
| `data/grants.json` | curated grants input |
| `index.html, swagger.html` | docs pages |

## Conventions

- Same envelope for every dataset; never change field meaning within a schema major.
- Sources must be public and attributed (`source`, `source_url`).
- Unknown values are `null`, never invented.

## Extension points

- New dataset: add a builder in `scripts/build.mjs`, a schema in `scripts/schemas.py`, regenerate OpenAPI, then run `python3 scripts/gen.py` in blockchainlab-sdk.
- Self-host: copy `v1/` anywhere static and point SDK `baseUrl` / MCP `BLOCKCHAINLAB_API` at it.

## Do

- Read `v1/index.json` first to discover datasets and freshness.
- Respect each source's terms; keep attribution.

## Don't

- Hand-edit files in `v1/`; they are regenerated nightly.
- Invent data, mock network responses in shipped code, or hard-code values that should come from the live source; every repo here is 'no mocks, real data'.
- Commit secrets, keys or `.env` files. Run `gitleaks` before pushing; CI and the org policy reject leaks.

## Using it from another project

- **GET /v1/{dataset}.json** (http): `curl -s https://blockchains.github.io/blockchainlab-api/v1/chains.json`
- **GET /v1/index.json** (http): `catalogue: dataset, url, schema, count, generated_at, stale`
- **GET /v1/schemas/{dataset}.schema.json** (http): `JSON Schema per dataset`
- **openapi.yaml** (file): `https://blockchains.github.io/blockchainlab-api/openapi.yaml`

See the README section [Use as a building block](README.md#use-as-a-building-block) for a copy-paste example.

## Related blocks

- [Blockchains/blockchainlab-sdk](https://github.com/Blockchains/blockchainlab-sdk): typed TS/Python client generated from these schemas
- [Blockchains/blockchainlab-mcp](https://github.com/Blockchains/blockchainlab-mcp): 43 MCP tools, many backed by these datasets
- [Blockchains/blockchainlab-tools](https://github.com/Blockchains/blockchainlab-tools): browser tools read chains and EIP/ERC/BIP data from here
- [Blockchains/blockchains.github.io](https://github.com/Blockchains/blockchains.github.io): hub pages and AI briefs are built on it
- [Blockchains/blockchainlab-feeds](https://github.com/Blockchains/blockchainlab-feeds): source of the hackathons and events datasets
