import "./_env";

import fs from "node:fs";
import path from "node:path";

import { countByDomain, countByTier, enabledSources } from "../lib/brief/registry";
import { fetchAll } from "../lib/brief/fetch";
import { deepenPrimarySources } from "../lib/brief/deepen";
import { composeEdition } from "../lib/brief/compose";
import { recordSignals } from "../lib/brief/memory";
import { finish } from "../lib/brief/shutdown";
import { validateBackendCredentials, getModelTag } from "../lib/ai/llm";
import { todayKey } from "../lib/utils";
import type { Edition, FeedItem, Lang } from "../lib/brief/types";

/**
 * Run the radar for one day.
 *
 *   editions/<date>/id.json     published Indonesian edition
 *   editions/<date>/en.json     published English edition
 *   signals/history.jsonl       appended signal memory (tier 6)
 *   .cache/<date>-items.json    raw fetched items (NOT published)
 *
 * `editions/` and `signals/` are committed. The editions are the archive;
 * the signal history is what makes tomorrow's briefing able to say "this is
 * the fourth time in three weeks". Lose the history and tier 6 restarts from
 * zero, so it belongs in version control as much as the editions do.
 *
 * `.cache/` holds source excerpts that are never republished, so it stays local.
 *
 * Sources are fetched ONCE and both language editions are composed from the
 * same item set. Two fetches would give the two editions different evidence
 * and let them contradict each other — a credibility problem, not a cost one.
 */

const EDITIONS_DIR = "editions";
const CACHE_DIR = ".cache";

/**
 * Languages to compose. Defaults to Indonesian only.
 *
 * Publishing both from day one doubles the model spend and the editorial
 * surface that can go wrong, and splits SEO attention — for a product with no
 * readers yet. Add the second language when there is demand for it, by
 * setting BRIEF_LANGS=id,en.
 */
function parseLangs(): Lang[] {
  const raw = (process.env.BRIEF_LANGS ?? "id").split(",").map((s) => s.trim());
  const langs = raw.filter((l): l is Lang => l === "id" || l === "en");
  if (langs.length === 0) throw new Error(`BRIEF_LANGS must list "id" and/or "en"`);
  return [...new Set(langs)];
}

function reviveItems(json: string): FeedItem[] {
  const parsed = JSON.parse(json) as {
    items: (Omit<FeedItem, "publishedAt"> & { publishedAt?: string })[];
  };
  return parsed.items.map((it) => ({
    ...it,
    publishedAt: it.publishedAt ? new Date(it.publishedAt) : undefined,
  }));
}

async function main() {
  validateBackendCredentials();

  const argDate = process.argv[2];
  const date = argDate && /^\d{4}-\d{2}-\d{2}$/.test(argDate) ? argDate : todayKey();
  const langs = parseLangs();
  const sources = enabledSources();
  const tierCounts = countByTier(sources);
  const domainCounts = countByDomain(sources);

  const cachePath = path.join(CACHE_DIR, `${date}-items.json`);
  const reuseCache = process.env.BRIEF_REUSE_CACHE === "true" && fs.existsSync(cachePath);

  let items: FeedItem[];

  if (reuseCache) {
    console.log(`[brief] ${date} — reusing cached items from ${cachePath}`);
    items = reviveItems(fs.readFileSync(cachePath, "utf8"));
  } else {
    console.log(
      `[brief] ${date} — fetching ${sources.length} sources ` +
        `(T1=${tierCounts[1]} T2=${tierCounts[2]} T3=${tierCounts[3]} · ` +
        `ai=${domainCounts.ai} energy=${domainCounts.energy} corporate=${domainCounts.corporate})\n`,
    );
    const report = await fetchAll(sources);
    items = report.items;
    console.log(
      `\n[brief] ${report.ok.length} ok, ${report.failed.length} failed, ${items.length} unique items`,
    );
    if (items.length === 0) throw new Error("no items fetched — aborting");

    // Tier-1 sources are must-monitor by definition. Losing most of them and
    // publishing anyway would mean shipping a briefing built almost entirely
    // on discovery and emerging signal, under a masthead that promises
    // primary sourcing.
    const tier1Failed = report.failed.filter((f) => f.tier === 1).length;
    if (tier1Failed > tierCounts[1] / 2) {
      throw new Error(
        `${tier1Failed}/${tierCounts[1]} tier-1 must-monitor sources failed — ` +
          `refusing to publish without primary sourcing`,
      );
    }
    if (report.failed.length > sources.length / 2) {
      throw new Error(
        `${report.failed.length}/${sources.length} sources failed — ` +
          `refusing to publish on this little evidence`,
      );
    }

    // Read the primary sources in full before composing. Non-fatal: a
    // briefing from titles beats no briefing.
    await deepenPrimarySources(items);

    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify({ date, items }, null, 2), "utf8");
  }

  const outDir = path.join(EDITIONS_DIR, date);
  fs.mkdirSync(outDir, { recursive: true });

  const written: Edition[] = [];
  for (const lang of langs) {
    console.log(`\n[brief] composing ${lang} edition with ${getModelTag()}…`);
    const t0 = Date.now();
    const { edition, rejected } = await composeEdition(items, lang, date, tierCounts);

    const trendNote = edition.signals
      .filter((s) => s.trend.status !== "new")
      .map((s) => `${s.trend.status}(${s.trend.occurrences}x)`)
      .join(" ");
    console.log(
      `[brief] ${lang} ready in ${((Date.now() - t0) / 1000).toFixed(1)}s — ` +
        `${edition.signals.length} signals, ${edition.sources.length} cited sources` +
        `${trendNote ? ` · trends: ${trendNote}` : ""}`,
    );
    if (rejected.length > 0) {
      console.warn(`[brief] ${lang}: ${rejected.length} signal(s) failed validation:`);
      for (const r of rejected) console.warn(`   - ${r.reason}: ${r.statement.slice(0, 90)}`);
    }

    fs.writeFileSync(path.join(outDir, `${lang}.json`), JSON.stringify(edition, null, 2), "utf8");
    recordSignals(edition.signals, date, lang);
    written.push(edition);
  }

  console.log(
    `\n[brief] wrote ${written.length} edition(s) to ${outDir}/ — run \`npm run site\` to publish.`,
  );
}

main()
  .then(() => finish(0))
  .catch((e) => {
    console.error(`[brief] FAILED:`, e);
    void finish(1);
  });
