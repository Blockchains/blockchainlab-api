// Blockchain Lab Open Data API builder. Built by Blockchain Lab — https://blockchainlab.com
// Pulls only public sources, writes static JSON to ./v1. Run: node scripts/build.mjs
import { writeFileSync, readFileSync, mkdirSync, readdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const OUT = "v1";
const NOW = new Date().toISOString();
const SCHEMA_VERSION = "1.1.0"; // semver: additive fields = minor, breaking = new /v2 path
const SITE = "https://blockchainlab.com";
const UTM = "?utm_source=github&utm_medium=open-data-api&utm_campaign=blockchainlab-api";
mkdirSync(OUT, { recursive: true });
const index = [];
const errors = [];

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "blockchainlab-api (+https://github.com/Blockchains/blockchainlab-api)" } });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) { if (i === tries - 1) throw e; await new Promise(s => setTimeout(s, 1500 * (i + 1))); }
  }
}
function write(name, { source, source_url, description, data, extra = {} }) {
  const body = { dataset: name, api_version: "v1", schema_version: SCHEMA_VERSION, schema_url: `https://blockchains.github.io/blockchainlab-api/v1/schemas/${name}.schema.json`, description, generated_at: NOW, source, source_url, built_by: "Blockchain Lab — https://blockchainlab.com", licence_note: "Data belongs to the named source; check its terms before reuse. Attribute the source and Blockchain Lab.", count: Array.isArray(data) ? data.length : undefined, ...extra, data };
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(body));
  index.push({ dataset: name, url: `https://blockchains.github.io/blockchainlab-api/v1/${name}.json`, schema: `https://blockchains.github.io/blockchainlab-api/v1/schemas/${name}.schema.json`, description, source, source_url, count: body.count, generated_at: NOW });
  console.log(`wrote ${name} (${body.count ?? "obj"})`);
}
async function step(name, fn) {
  try { await fn(); } catch (e) {
    errors.push({ dataset: name, error: String(e.message || e) });
    console.error(`FAILED ${name}: ${e.message}`);
    // keep previous file if present so the API never goes blank
    const prev = join(OUT, `${name}.json`);
    if (existsSync(prev)) { const p = JSON.parse(readFileSync(prev, "utf8")); index.push({ dataset: name, url: `https://blockchains.github.io/blockchainlab-api/v1/${name}.json`, description: p.description, source: p.source, source_url: p.source_url, count: p.count, generated_at: p.generated_at, stale: true }); }
  }
}

// 1. Chains (chainid.network, the dataset behind chainlist.org)
await step("chains", async () => {
  const raw = await getJSON("https://chainid.network/chains.json");
  const clean = (rpc) => (rpc || []).filter(u => typeof u === "string" && !u.includes("${") && /^https?:|^wss?:/.test(u));
  const data = raw.map(c => ({ chainId: c.chainId, name: c.name, shortName: c.shortName, chain: c.chain, nativeCurrency: c.nativeCurrency, rpc: clean(c.rpc), explorers: (c.explorers || []).map(e => ({ name: e.name, url: e.url, standard: e.standard })), infoURL: c.infoURL, testnet: /test|sepolia|goerli|holesky|devnet/i.test(`${c.name} ${c.network || ""}`), status: c.status || "active" })).sort((a, b) => a.chainId - b.chainId);
  write("chains", { description: "EVM chain registry: chain IDs, native currency, public RPC endpoints and explorers.", source: "chainid.network (ethereum-lists/chains)", source_url: "https://chainid.network/chains.json", data });
});

// 2. DeFi protocols TVL + chain TVL (DefiLlama public API)
await step("protocols", async () => {
  const raw = await getJSON("https://api.llama.fi/protocols");
  const data = raw.filter(p => typeof p.tvl === "number" && p.category !== "CEX").sort((a, b) => b.tvl - a.tvl).slice(0, 500).map((p, i) => ({ rank: i + 1, name: p.name, slug: p.slug, category: p.category, chains: p.chains, tvl_usd: Math.round(p.tvl), change_1d_pct: p.change_1d ?? null, change_7d_pct: p.change_7d ?? null, url: p.url, defillama_url: `https://defillama.com/protocol/${p.slug}` }));
  write("protocols", { description: "Top 500 DeFi protocols by TVL (USD), excluding CEXs. Snapshot from DefiLlama; not investment advice.", source: "DefiLlama", source_url: "https://api.llama.fi/protocols", data });
});
await step("chains-tvl", async () => {
  const raw = await getJSON("https://api.llama.fi/v2/chains");
  const data = raw.filter(c => c.tvl > 0).sort((a, b) => b.tvl - a.tvl).map((c, i) => ({ rank: i + 1, name: c.name, chainId: c.chainId ?? null, token: c.tokenSymbol ?? null, tvl_usd: Math.round(c.tvl), defillama_url: `https://defillama.com/chain/${encodeURIComponent(c.name)}` }));
  write("chains-tvl", { description: "DeFi TVL by chain (USD). Snapshot from DefiLlama.", source: "DefiLlama", source_url: "https://api.llama.fi/v2/chains", data });
});

// 3. Hackathons + events (reused from Blockchains/blockchainlab-feeds, not re-scraped)
for (const [name, path, desc] of [["hackathons", "feeds/hackathons/latest.json", "Open and upcoming blockchain hackathons (Devpost, ETHGlobal)."], ["events", "feeds/events/latest.json", "Upcoming blockchain events from the Blockchain Lab feeds."]]) {
  await step(name, async () => {
    const url = `https://raw.githubusercontent.com/Blockchains/blockchainlab-feeds/main/${path}`;
    const raw = await getJSON(url);
    const data = raw.items || raw.events || raw.data || [];
    write(name, { description: desc, source: `Blockchains/blockchainlab-feeds (${(raw.sources || []).join("; ")})`, source_url: url, data, extra: { upstream_generated_at: raw.generated_at || null, not_covered: raw.not_covered || [] } });
  });
}

// 4. Whitepapers metadata (Blockchain Lab research corpus)
await step("whitepapers", async () => {
  const raw = await getJSON(`${SITE}/api/v1/papers`);
  const data = (raw.papers || []).map(p => ({ id: p.document_id, slug: p.slug, title: p.title, authors: p.authors, year: p.year, category: p.category, paper_type: p.paper_type, topics: p.topics, original_source_url: p.source_url, blockchainlab_url: (p.canonical_url || `${SITE}/research/corpus/papers/${p.slug}`) + UTM }));
  write("whitepapers", { description: "Blockchain Lab research corpus — whitepaper metadata (no paper text). Original sources linked.", source: "Blockchain Lab /api/v1/papers", source_url: `${SITE}/api/v1/papers`, data, extra: { upstream_note: raw.note } });
});

// 5. Glossary (Blockchain Lab concept, protocol, failure and stack-layer pages)
await step("glossary", async () => {
  const data = JSON.parse(readFileSync("data/glossary.json", "utf8")).map(g => ({ ...g, url: g.url + UTM }));
  write("glossary", { description: "Plain-language blockchain glossary from blockchainlab.com (concepts, protocol profiles, failure classes, stack layers).", source: "blockchainlab.com/learn/glossary", source_url: `${SITE}/learn/glossary`, data });
});

// 6. Grants directory (curated; every URL re-checked on each build)
await step("grants", async () => {
  const list = JSON.parse(readFileSync("data/grants.json", "utf8"));
  const data = [];
  for (const g of list) {
    let status = null;
    try { const r = await fetch(g.url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; blockchainlab-api link-check)" } }); status = r.status; } catch { status = 0; }
    data.push({ ...g, link_status: status, link_checked_at: NOW });
  }
  write("grants", { description: "Directory of blockchain ecosystem grant / funding programmes with official links. Curated by Blockchain Lab; link status re-checked nightly. No amounts are listed — read each programme's own page.", source: "Official programme pages (curated)", source_url: "https://github.com/Blockchains/blockchainlab-api/blob/main/data/grants.json", data });
});

// 7. Standards: EIPs, ERCs (ethereum/EIPs + ethereum/ERCs) and BIPs (bitcoin/bips)
function tarball(repo, branch) {
  const dir = mkdtempSync(join(tmpdir(), "bl-"));
  execSync(`curl -sL https://codeload.github.com/${repo}/tar.gz/refs/heads/${branch} | tar -xz -C ${dir}`, { stdio: "inherit" });
  return join(dir, readdirSync(dir)[0]);
}
function frontmatter(txt) {
  const m = txt.match(/^---\s*\n([\s\S]*?)\n---/); if (!m) return null;
  const o = {}; for (const line of m[1].split("\n")) { const i = line.indexOf(":"); if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim(); } return o;
}
for (const [name, repo, folder, prefix, urlBase] of [["eips", "ethereum/EIPs", "EIPS", "eip", "https://eips.ethereum.org/EIPS/eip-"], ["ercs", "ethereum/ERCs", "ERCS", "erc", "https://eips.ethereum.org/EIPS/eip-"]]) {
  await step(name, async () => {
    const root = tarball(repo, "master");
    const data = [];
    for (const f of readdirSync(join(root, folder))) {
      if (!f.endsWith(".md")) continue;
      const fm = frontmatter(readFileSync(join(root, folder, f), "utf8")); if (!fm) continue;
      const n = Number(fm.eip); if (!n) continue;
      if (fm.status === "Moved") continue;
      data.push({ number: n, title: fm.title, status: fm.status, type: fm.type, category: fm.category || null, created: fm.created, requires: fm.requires ? fm.requires.split(",").map(s => Number(s.trim())).filter(Boolean) : [], url: `${urlBase}${n}` });
    }
    data.sort((a, b) => a.number - b.number);
    rmSync(root, { recursive: true, force: true });
    write(name, { description: `${name.toUpperCase()} index (number, title, status, type, category) parsed from ${repo}.`, source: `github.com/${repo}`, source_url: `https://github.com/${repo}/tree/master/${folder}`, data });
  });
}
await step("bips", async () => {
  const root = tarball("bitcoin/bips", "master");
  const data = [];
  for (const f of readdirSync(root)) {
    const m = f.match(/^bip-(\d{4})\.(mediawiki|md)$/); if (!m) continue;
    const head = readFileSync(join(root, f), "utf8").split("\n").slice(0, 40);
    const get = (k) => { const l = head.find(x => new RegExp(`^\\s*${k}:\\s`, "i").test(x)); return l ? l.split(":").slice(1).join(":").trim() : null; };
    const n = Number(m[1]);
    data.push({ number: n, title: get("Title"), status: get("Status"), type: get("Type"), layer: get("Layer"), url: `https://github.com/bitcoin/bips/blob/master/${f}` });
  }
  data.sort((a, b) => a.number - b.number);
  rmSync(root, { recursive: true, force: true });
  write("bips", { description: "Bitcoin Improvement Proposals index parsed from bitcoin/bips.", source: "github.com/bitcoin/bips", source_url: "https://github.com/bitcoin/bips", data });
});

// 8. Stablecoins (DefiLlama stablecoins API)
await step("stablecoins", async () => {
  const raw = await getJSON("https://stablecoins.llama.fi/stablecoins?includePrices=true");
  const data = raw.peggedAssets.map(a => { const peg = a.pegType; const c = a.circulating?.[peg] ?? 0, d = a.circulatingPrevDay?.[peg], w = a.circulatingPrevWeek?.[peg], m = a.circulatingPrevMonth?.[peg]; return { id: a.id, name: a.name, symbol: a.symbol, peg_type: peg, peg_mechanism: a.pegMechanism, price: a.price ?? null, circulating: Math.round(c), change_1d_pct: d ? +((c / d - 1) * 100).toFixed(3) : null, change_7d_pct: w ? +((c / w - 1) * 100).toFixed(3) : null, change_30d_pct: m ? +((c / m - 1) * 100).toFixed(3) : null, chains: a.chains || [], defillama_url: `https://defillama.com/stablecoin/${a.id}` }; }).filter(x => x.circulating > 0).sort((a, b) => b.circulating - a.circulating);
  write("stablecoins", { description: "Stablecoins by circulating supply with price, peg mechanism and 1d/7d/30d supply change. Snapshot from DefiLlama.", source: "DefiLlama stablecoins", source_url: "https://stablecoins.llama.fi/stablecoins?includePrices=true", data });
});
// 9. Yields (DefiLlama yields) — top pools by TVL with TVL >= $10m
await step("yields", async () => {
  const raw = await getJSON("https://yields.llama.fi/pools");
  const data = raw.data.filter(p => p.tvlUsd >= 1e7 && p.apy !== null).sort((a, b) => b.tvlUsd - a.tvlUsd).slice(0, 500).map(p => ({ pool: p.pool, project: p.project, chain: p.chain, symbol: p.symbol, tvl_usd: Math.round(p.tvlUsd), apy: p.apy, apy_base: p.apyBase, apy_reward: p.apyReward, apy_mean_30d: p.apyMean30d ?? null, stablecoin: p.stablecoin, il_risk: p.ilRisk, exposure: p.exposure, defillama_url: `https://defillama.com/yields/pool/${p.pool}` }));
  write("yields", { description: "Top 500 DeFi yield pools by TVL (>= $10m) with APY, base/reward split, IL risk. Snapshot from DefiLlama; APYs change constantly and are not advice.", source: "DefiLlama yields", source_url: "https://yields.llama.fi/pools", data });
});
// 10. Bridges — protocols in DefiLlama's bridge categories (bridges.llama.fi is paywalled, so TVL comes from /protocols)
await step("bridges", async () => {
  const raw = await getJSON("https://api.llama.fi/protocols");
  const cats = new Set(["Bridge", "Cross Chain Bridge", "Canonical Bridge", "Cross Chain"]);
  const data = raw.filter(p => cats.has(p.category) && typeof p.tvl === "number" && p.tvl > 0).sort((a, b) => b.tvl - a.tvl).map((p, i) => ({ rank: i + 1, name: p.name, slug: p.slug, category: p.category, chains: p.chains, tvl_usd: Math.round(p.tvl), change_7d_pct: p.change_7d ?? null, url: p.url, audits: p.audits ?? null, defillama_url: `https://defillama.com/protocol/${p.slug}` }));
  write("bridges", { description: "Cross-chain and canonical bridges ranked by TVL (DefiLlama bridge categories).", source: "DefiLlama protocols (bridge categories)", source_url: "https://api.llama.fi/protocols", data });
});
// 11. DEX volumes + protocol fees (DefiLlama overview)
for (const [name, path, label] of [["dex-volumes", "dexs", "DEX trading volume"], ["fees", "fees", "Protocol fees"]]) {
  await step(name, async () => {
    const raw = await getJSON(`https://api.llama.fi/overview/${path}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`);
    const data = raw.protocols.filter(p => p.total24h > 0).sort((a, b) => b.total24h - a.total24h).slice(0, 300).map((p, i) => ({ rank: i + 1, name: p.displayName || p.name, slug: p.slug, category: p.category, chains: p.chains, total_24h_usd: Math.round(p.total24h), total_7d_usd: p.total7d ? Math.round(p.total7d) : null, total_30d_usd: p.total30d ? Math.round(p.total30d) : null, change_1d_pct: p.change_1d ?? null, change_7d_pct: p.change_7d ?? null, defillama_url: `https://defillama.com/protocol/${p.slug}` }));
    write(name, { description: `${label} by protocol (top 300 by 24h). Snapshot from DefiLlama.`, source: `DefiLlama overview/${path}`, source_url: `https://api.llama.fi/overview/${path}`, data, extra: { totals: { total_24h_usd: Math.round(raw.total24h || 0), total_7d_usd: Math.round(raw.total7d || 0), total_30d_usd: Math.round(raw.total30d || 0), change_1d_pct: raw.change_1d ?? null } } });
  });
}
// 12. L2 metrics (L2BEAT public API): stage, category, stack, TVS breakdown
await step("l2-metrics", async () => {
  const raw = await getJSON("https://l2beat.com/api/scaling/summary");
  const data = Object.values(raw.projects).filter(p => !p.isArchived).map(p => ({ id: p.id, name: p.name, type: p.type, host_chain: p.hostChain, category: p.category, stack: p.providers || [], purposes: p.purposes || [], stage: p.stage, under_review: !!p.isUnderReview, tvs_usd: Math.round(p.tvs?.breakdown?.total || 0), tvs_breakdown: p.tvs?.breakdown ? { native: Math.round(p.tvs.breakdown.native), canonical: Math.round(p.tvs.breakdown.canonical), external: Math.round(p.tvs.breakdown.external), ether: Math.round(p.tvs.breakdown.ether || 0), stablecoin: Math.round(p.tvs.breakdown.stablecoin || 0), btc: Math.round(p.tvs.breakdown.btc || 0) } : null, tvs_change_7d_pct: p.tvs?.change7d !== undefined ? +(p.tvs.change7d * 100).toFixed(3) : null, risks: (p.risks || []).map(r => ({ name: r.name, value: r.value, sentiment: r.sentiment })), l2beat_url: `https://l2beat.com/scaling/projects/${p.slug}` })).sort((a, b) => b.tvs_usd - a.tvs_usd);
  write("l2-metrics", { description: "Ethereum L2/L3 scaling projects: stage, category, stack, risk summary and Total Value Secured breakdown. From L2BEAT.", source: "L2BEAT public API", source_url: "https://l2beat.com/api/scaling/summary", data });
});
// 13. Security incidents (DefiLlama hacks database)
await step("security-incidents", async () => {
  const raw = await getJSON("https://api.llama.fi/hacks");
  const data = raw.map(h => ({ date: new Date(h.date * 1000).toISOString().slice(0, 10), name: h.name, classification: h.classification, technique: h.technique, amount_usd: h.amount ?? null, returned_usd: h.returnedFunds ?? null, chains: h.chain || [], bridge_hack: !!h.bridgeHack, target_type: h.targetType, source: h.source || null, defillama_id: h.defillamaId || null })).sort((a, b) => b.date.localeCompare(a.date));
  write("security-incidents", { description: "Public record of crypto hacks and exploits: date, protocol, technique, classification, amount lost/returned. From DefiLlama's hacks database.", source: "DefiLlama hacks", source_url: "https://api.llama.fi/hacks", data, extra: { total_lost_usd: Math.round(data.reduce((s, x) => s + (x.amount_usd || 0), 0)) } });
});
// 14. Sanctioned addresses (OFAC SDN digital currency addresses, extracted by 0xB10C)
await step("sanctioned-addresses", async () => {
  const chains = ["ETH", "XBT", "USDT", "USDC", "TRX", "ARB", "BSC", "SOL", "LTC", "XMR", "ETC", "BCH", "BSV", "DASH", "ZEC", "XRP", "XVG", "BTG"];
  const data = [];
  for (const c of chains) { try { const l = await getJSON(`https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_${c}.json`, 1); for (const a of l) data.push({ chain: c, address: a }); } catch {} }
  if (data.length < 100) throw new Error("too few addresses: " + data.length);
  write("sanctioned-addresses", { description: "Digital currency addresses on the US Treasury OFAC SDN list, per asset. Extracted daily from the official SDN XML by github.com/0xB10C. Compliance screening aid only — verify against the official list.", source: "OFAC SDN list via 0xB10C/ofac-sanctioned-digital-currency-addresses", source_url: "https://github.com/0xB10C/ofac-sanctioned-digital-currency-addresses/tree/lists", data });
});
// 15. Public RPC health (probed from the GitHub Actions runner at build time)
await step("rpc-health", async () => {
  const RPCS = { ethereum: [1, ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com", "https://rpc.ankr.com/eth", "https://1rpc.io/eth", "https://eth.drpc.org", "https://cloudflare-eth.com"]], base: [8453, ["https://base-rpc.publicnode.com", "https://mainnet.base.org", "https://base.llamarpc.com", "https://1rpc.io/base", "https://base.drpc.org"]], arbitrum: [42161, ["https://arbitrum-one-rpc.publicnode.com", "https://arb1.arbitrum.io/rpc", "https://1rpc.io/arb", "https://arbitrum.drpc.org"]], optimism: [10, ["https://optimism-rpc.publicnode.com", "https://mainnet.optimism.io", "https://1rpc.io/op", "https://optimism.drpc.org"]], polygon: [137, ["https://polygon-bor-rpc.publicnode.com", "https://polygon-rpc.com", "https://1rpc.io/matic", "https://polygon.drpc.org"]], bsc: [56, ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.bnbchain.org", "https://1rpc.io/bnb", "https://bsc.drpc.org"]], avalanche: [43114, ["https://avalanche-c-chain-rpc.publicnode.com", "https://api.avax.network/ext/bc/C/rpc", "https://1rpc.io/avax/c", "https://avalanche.drpc.org"]] };
  const post = async (u, body) => { const t0 = Date.now(); const r = await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }); const j = await r.json(); return { j, ms: Date.now() - t0 }; };
  const data = [];
  for (const [chain, [id, urls]] of Object.entries(RPCS)) {
    const res = await Promise.all(urls.map(async u => { try { const a = await post(u, { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }); const b = await post(u, { jsonrpc: "2.0", id: 2, method: "eth_blockNumber", params: [] }); if (!b.j.result) throw new Error(b.j.error?.message || "no result"); return { chain, chain_id: id, url: u, ok: true, latency_ms: b.ms, block: Number(b.j.result), chain_id_ok: Number(a.j.result) === id }; } catch (e) { return { chain, chain_id: id, url: u, ok: false, error: String(e.message || e).slice(0, 140) }; } }));
    const head = Math.max(0, ...res.filter(r => r.ok).map(r => r.block)); res.forEach(r => { if (r.ok) { r.lag_blocks = head - r.block; r.healthy = r.lag_blocks <= 5 && r.chain_id_ok; } else r.healthy = false; r.checked_at = NOW; }); data.push(...res);
  }
  for (const [chain, u, body, pick] of [["solana", "https://solana-rpc.publicnode.com", { jsonrpc: "2.0", id: 1, method: "getSlot", params: [] }, j => j.result], ["solana", "https://api.mainnet-beta.solana.com", { jsonrpc: "2.0", id: 1, method: "getSlot", params: [] }, j => j.result], ["bitcoin", "https://bitcoin-rpc.publicnode.com", { jsonrpc: "1.0", id: 1, method: "getblockcount", params: [] }, j => j.result]]) {
    try { const a = await post(u, body); const v = pick(a.j); data.push({ chain, url: u, ok: !!v, latency_ms: a.ms, block: v ?? null, healthy: !!v, checked_at: NOW }); } catch (e) { data.push({ chain, url: u, ok: false, healthy: false, error: String(e.message).slice(0, 140), checked_at: NOW }); }
  }
  write("rpc-health", { description: "Health of popular free public RPC endpoints (EVM chains, Solana, Bitcoin): reachability, latency, block lag vs best endpoint, chain-ID check. Probed from a GitHub Actions runner (US) at build time.", source: "Blockchain Lab probe (GitHub Actions)", source_url: "https://github.com/Blockchains/blockchainlab-api/blob/main/scripts/build.mjs", data, extra: { healthy: data.filter(x => x.healthy).length } });
});

index.sort((a, b) => a.dataset.localeCompare(b.dataset));
writeFileSync(join(OUT, "index.json"), JSON.stringify({ name: "Blockchain Lab Open Data API", version: "v1", schema_version: SCHEMA_VERSION, generated_at: NOW, docs: "https://blockchains.github.io/blockchainlab-api/", openapi: "https://blockchains.github.io/blockchainlab-api/openapi.yaml", built_by: "Blockchain Lab — https://blockchainlab.com" + UTM, errors, datasets: index }, null, 1));
console.log(`done; ${errors.length} errors`);
if (index.length === 0) process.exit(1);
