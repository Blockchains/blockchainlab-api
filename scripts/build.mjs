// Blockchain Lab Open Data API builder. Built by Blockchain Lab — https://blockchainlab.com
// Pulls only public sources, writes static JSON to ./v1. Run: node scripts/build.mjs
import { writeFileSync, readFileSync, mkdirSync, readdirSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const OUT = "v1";
const NOW = new Date().toISOString();
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
  const body = { dataset: name, description, generated_at: NOW, source, source_url, built_by: "Blockchain Lab — https://blockchainlab.com", licence_note: "Data belongs to the named source; check its terms before reuse. Attribute the source and Blockchain Lab.", count: Array.isArray(data) ? data.length : undefined, ...extra, data };
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(body));
  index.push({ dataset: name, url: `https://blockchains.github.io/blockchainlab-api/v1/${name}.json`, description, source, source_url, count: body.count, generated_at: NOW });
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
  const data = (raw.papers || []).map(p => ({ id: p.document_id, slug: p.slug, title: p.title, authors: p.authors, year: p.year, category: p.category, paper_type: p.paper_type, topics: p.topics, original_source_url: p.source_url, blockchainlab_url: `${SITE}/whitepaper/${p.slug}${UTM}` }));
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

index.sort((a, b) => a.dataset.localeCompare(b.dataset));
writeFileSync(join(OUT, "index.json"), JSON.stringify({ name: "Blockchain Lab Open Data API", version: "v1", generated_at: NOW, docs: "https://blockchains.github.io/blockchainlab-api/", openapi: "https://blockchains.github.io/blockchainlab-api/openapi.yaml", built_by: "Blockchain Lab — https://blockchainlab.com" + UTM, errors, datasets: index }, null, 1));
console.log(`done; ${errors.length} errors`);
if (index.length === 0) process.exit(1);
