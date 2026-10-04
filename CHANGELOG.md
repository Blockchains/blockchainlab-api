# Changelog — Blockchain Lab Open Data API

Versioning: the URL path carries the major version (`/v1/`). Every dataset envelope carries `api_version` and a semver `schema_version`; additive fields bump the minor version, breaking changes would ship under `/v2/` with `/v1/` kept for at least 90 days. JSON Schemas live at `/v1/schemas/<dataset>.schema.json` and the nightly job refuses to publish data that fails them.

## 1.1.0 — 2026-10-04
- New datasets: `stablecoins`, `yields`, `bridges`, `dex-volumes`, `fees` (DefiLlama), `l2-metrics` (L2BEAT), `security-incidents` (DefiLlama hacks), `sanctioned-addresses` (OFAC SDN via 0xB10C), `rpc-health` (live probe of free public RPCs).
- Envelope gains `api_version`, `schema_version`, `schema_url`; catalogue entries gain `schema`.
- JSON Schema per dataset + CI validation; OpenAPI regenerated nightly and references the schemas.
- Typed SDKs: TypeScript + Python in [Blockchains/blockchainlab-sdk](https://github.com/Blockchains/blockchainlab-sdk).

## 1.0.0 — 2026-10-03
- First release: chains, protocols, chains-tvl, hackathons, events, whitepapers, glossary, grants, eips, ercs, bips.
