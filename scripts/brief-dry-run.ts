import "./_env";

import { countByDomain, countByTier, enabledSources } from "../lib/brief/registry";
import { fetchAll } from "../lib/brief/fetch";
import { buildCandidates } from "../lib/brief/compose";
import { publisherTier } from "../lib/brief/publishers";
import { loadHistory, summariseTrends } from "../lib/brief/memory";
import { finish } from "../lib/brief/shutdown";
import { todayKey } from "../lib/utils";
import { DOMAINS, type SourceTier } from "../lib/brief/types";

/**
 * Fetch every source and report what the model WOULD see — no LLM call.
 *
 * The candidate pool is the whole ball game: a registry change that adds
 * volume without improving the pool has made things worse. This prints the
 * pool's tier, publisher and domain mix so that is measurable rather than
 * assumed.
 */

async function main() {
  const sources = enabledSources();
  const tiers = countByTier(sources);
  const domains = countByDomain(sources);
  console.log(
    `[dry-run] ${sources.length} sources — T1=${tiers[1]} T2=${tiers[2]} T3=${tiers[3]} · ` +
      `ai=${domains.ai} energy=${domains.energy} corporate=${domains.corporate}\n`,
  );

  const { items, ok, failed } = await fetchAll(sources);
  console.log(`\n[dry-run] ok=${ok.length} failed=${failed.length} unique items=${items.length}`);
  if (failed.length > 0) {
    console.log(`\n[dry-run] failures:`);
    for (const f of failed) console.log(`  T${f.tier} ${f.id}: ${f.error}`);
  }

  const { pool } = buildCandidates(items);

  const poolTiers = ([1, 2, 3] as SourceTier[]).map((t) => pool.filter((i) => i.tier === t).length);
  const poolDomains = DOMAINS.map((d) => pool.filter((i) => i.domain === d).length);
  const poolPub = [1, 2, 3].map((t) => pool.filter((i) => publisherTier(i.publisher) === t).length);

  console.log(`\n[dry-run] candidate pool: ${pool.length} of ${items.length}`);
  console.log(`  source tier     T1=${poolTiers[0]} T2=${poolTiers[1]} T3=${poolTiers[2]}`);
  console.log(`  publisher tier  P1=${poolPub[0]} P2=${poolPub[1]} P3=${poolPub[2]}`);
  console.log(
    `  domain          ai=${poolDomains[0]} energy=${poolDomains[1]} corporate=${poolDomains[2]}`,
  );

  const missing = DOMAINS.filter((_, i) => poolDomains[i] === 0);
  if (missing.length > 0) {
    console.warn(`\n[dry-run] WARNING: no candidates at all for domain(s): ${missing.join(", ")}`);
  }

  console.log(`\n[dry-run] first 15 candidates the model would see:`);
  for (const i of pool.slice(0, 15)) {
    console.log(
      `  T${i.tier} P${publisherTier(i.publisher)} ${i.domain.padEnd(9)} [${i.publisher}] ${i.title.slice(0, 60)}`,
    );
  }

  const history = loadHistory();
  const trends = summariseTrends(history, todayKey(), 5);
  console.log(`\n[dry-run] signal memory: ${history.length} records`);
  if (trends.length === 0) {
    console.log(`  no recurring theme yet — tier 6 needs a few days of archive`);
  } else {
    for (const t of trends) {
      console.log(`  [${t.status}] ${t.occurrences}x since ${t.firstSeen}: ${t.theme.slice(0, 70)}`);
    }
  }
}

main()
  .then(() => finish(0))
  .catch((e) => {
    console.error(e);
    void finish(1);
  });
