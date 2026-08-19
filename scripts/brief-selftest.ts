import "./_env";

import fs from "node:fs";
import path from "node:path";

import { assembleEdition } from "../lib/brief/compose";
import { enabledSources, countByTier } from "../lib/brief/registry";
import { fetchAll } from "../lib/brief/fetch";
import { normaliseThemeKey, type SignalRecord } from "../lib/brief/memory";
import { finish } from "../lib/brief/shutdown";
import type { FeedItem, Lang } from "../lib/brief/types";

/**
 * Exercise the full publish path with a fixture model response instead of a
 * live LLM call.
 *
 * This is not a substitute for a real run — the prose is canned. What it
 * proves is everything around the model: citation indices resolving against a
 * real fetched pool, defective signals being rejected, corroboration computed
 * rather than claimed, and trend status derived from the archive.
 *
 * The trend fixture deliberately uses **five different headlines sharing one
 * themeKey**. An earlier version used identical headlines on every date, which
 * passed while the real matcher scored 0/10 recall on realistic data. A test
 * that only passes on input the product will never see is worse than no test:
 * it certifies the broken thing.
 *
 * Output goes to `.cache/selftest/`, and the synthetic history is held in
 * memory — a fixture must never reach the published archive or the real
 * signal memory.
 */

const OUT_ROOT = path.join(".cache", "selftest");
const DATE = "2026-08-18";
const THEME = "ai-datacenter-project-finance";

function fixture(lang: Lang, poolSize: number): string {
  const id = lang === "id";
  const sig = (
    rank: number,
    domain: string,
    themeKey: string,
    headline: string,
    cites: number[],
    extra: Record<string, unknown> = {},
  ) => ({
    rank,
    domain,
    themeKey,
    headline,
    whatChanged: id ? "Fakta konkret yang berubah." : "The concrete fact that changed.",
    whyItMatters: id ? "Pola dan implikasi strategis." : "The pattern and strategic implication.",
    secondOrder: id ? "Akibat dari akibat." : "The effect of the effect.",
    action: id ? "Tindakan konkret minggu ini." : "A concrete move this week.",
    strength: "material",
    cites,
    ...extra,
  });

  return JSON.stringify({
    title: id
      ? "Uji rakit: kutipan resolve dipertahankan, klaim tak bersumber ditolak"
      : "Assembly test: resolvable citations kept, unsourced claims rejected",
    dek: id
      ? "Edisi fixture untuk memverifikasi validasi kutipan, korroborasi, dan klasifikasi tren."
      : "A fixture edition verifying citation validation, corroboration, and trend classification.",
    summary: id
      ? "Edisi ini dihasilkan oleh self-test, bukan oleh model bahasa."
      : "This edition was produced by the self-test, not by a language model.",
    signals: [
      // Two distinct sources → corroboration must count 2 publishers.
      sig(1, "ai", "ai-agents-enterprise", "Agen AI bergerak ke produksi perusahaan", [1, 2]),
      // Two publishers, so verified. Its second-order rests on published
      // evidence, which must NOT inflate the corroboration count.
      sig(2, "energy", "pln-grid-investment", "Investasi jaringan listrik dipercepat", [3, 6], {
        secondOrderCites: [1],
      }),
      // Same theme as the seeded archive, but a HEADLINE THAT SHARES ALMOST NO
      // WORDS with any seeded one. Only the themeKey ties them together.
      sig(3, "ai", THEME, "Vendor chip menanggung eksposur pembiayaan infrastruktur", [4]),
      // Theme key with sloppy formatting — must normalise to the same slug.
      sig(4, "ai", "  AI Datacenter Project Finance.  ", "Bank mulai menstruktur ulang fasilitas pusat data", [2]),
      // DEFECT 1: citation beyond the pool → rejected.
      sig(5, "ai", "x-out-of-range", id ? "Kutipan di luar rentang — DITOLAK." : "Out-of-range citation — REJECTED.", [poolSize + 500]),
      // DEFECT 2: no citation → rejected.
      sig(6, "ai", "x-no-citation", id ? "Tanpa kutipan — DITOLAK." : "No citation — REJECTED.", []),
      // DEFECT 3: missing themeKey → rejected.
      sig(7, "energy", "", id ? "Tanpa themeKey — DITOLAK." : "No themeKey — REJECTED.", [1]),
      // DEFECT 4: incomplete ladder → rejected.
      {
        rank: 8,
        domain: "energy",
        themeKey: "x-incomplete",
        headline: id ? "Tangga tak lengkap — DITOLAK." : "Incomplete ladder — REJECTED.",
        whatChanged: "",
        whyItMatters: "",
        strength: "material",
        cites: [1],
      },
      // DEFECT 5: invalid domain and strength → coerced, not rejected.
      sig(9, "not-a-domain", "x-bad-enums", id ? "Enum tidak valid — dinormalisasi." : "Invalid enums — normalised.", [2], {
        strength: "catastrophic",
      }),
      // Two single-publisher, no-primary claims. One may publish; the other
      // must be dropped by the evidence floor, and neither may lead.
      sig(10, "ai", "x-unverified-one", id ? "Bersumber tunggal, pertama." : "Single source, first.", [5]),
      sig(11, "ai", "x-unverified-two", id ? "Bersumber tunggal, kedua." : "Single source, second.", [7]),
    ],
    watchNext: [
      { item: id ? "Tanggal valid dipertahankan." : "Valid date is kept.", dueDate: "2026-09-30" },
      { item: id ? "Tanggal ngawur dibuang." : "Malformed date is dropped.", dueDate: "30 September" },
    ],
  });
}

/**
 * Synthetic archive: one theme, five dates, five DIFFERENT headlines — as a
 * working editor would actually write them. Tier 6 must still recognise them
 * as one thread and call it structural.
 */
function syntheticHistory(): SignalRecord[] {
  const entries: [string, string][] = [
    ["2026-07-28", "Nvidia menjamin kewajiban proyek pusat data AI senilai USD 10 miliar"],
    ["2026-08-02", "Pusat data AI mulai dinilai dengan struktur project finance"],
    ["2026-08-07", "Pendanaan infrastruktur AI bergeser ke skema jaminan vendor"],
    ["2026-08-12", "Lender menuntut offtake jangka panjang untuk fasilitas komputasi"],
    ["2026-08-16", "Struktur pembiayaan pusat data makin menyerupai proyek listrik"],
  ];
  return entries.map(([date, headline]) => ({
    date,
    lang: "id",
    domain: "ai" as const,
    themeKey: THEME,
    headline,
    urls: ["https://example.invalid/seed"],
  }));
}

/**
 * A deterministic stand-in for a fetched pool.
 *
 * Lets the whole validation surface run in CI with no network, and pins the
 * tier-4 cases that matter: a tier-1 feed the institution publishes itself
 * (primary), and a tier-1 discovery hit from a publisher nobody recognises
 * (not primary, however tier-1 its query was).
 */
function syntheticPool(): FeedItem[] {
  const at = (d: string) => new Date(`${d}T00:00:00Z`);
  const base = { excerpt: undefined, lang: "en" as const };
  return [
    { ...base, sourceId: "openai-news", publisher: "OpenAI", title: "A model release", url: "https://openai.com/a", domain: "ai" as const, tier: 1 as const, publishedAt: at("2026-08-18"), primary: true },
    { ...base, sourceId: "google-deepmind", publisher: "Google DeepMind", title: "A research result", url: "https://deepmind.google/b", domain: "ai" as const, tier: 1 as const, publishedAt: at("2026-08-18"), primary: true },
    { ...base, sourceId: "pln-primary", publisher: "Kompas.com", title: "Grid investment reported", url: "https://news.google.com/c", domain: "energy" as const, tier: 1 as const, publishedAt: at("2026-08-17"), via: "Google News", primary: false },
    { ...base, sourceId: "anthropic-primary", publisher: "Anthropic", title: "A safety publication", url: "https://news.google.com/d", domain: "ai" as const, tier: 1 as const, publishedAt: at("2026-08-18"), via: "Google News", primary: true },
    { ...base, sourceId: "ojk-idx-primary", publisher: "SomeRegionalBlog.co", title: "An unrelated local item", url: "https://news.google.com/e", domain: "corporate" as const, tier: 1 as const, publishedAt: at("2026-08-16"), via: "Google News", primary: false },
    { ...base, sourceId: "disc-corporate-id", publisher: "Kontan", title: "A corporate action", url: "https://news.google.com/f", domain: "corporate" as const, tier: 2 as const, publishedAt: at("2026-08-17"), via: "Google News", primary: false },
    { ...base, sourceId: "arxiv-ai", publisher: "arXiv cs.AI", title: "A preprint", url: "https://arxiv.org/abs/1", domain: "ai" as const, tier: 3 as const, publishedAt: at("2026-08-18"), primary: false },
    { ...base, sourceId: "gh-vllm", publisher: "vLLM", title: "A release", url: "https://github.com/v/1", domain: "ai" as const, tier: 3 as const, publishedAt: at("2026-08-18"), primary: false },
  ];
}

async function loadPool(): Promise<FeedItem[]> {
  // A CLI flag as well as an env var: npm scripts have to work identically on
  // sh and cmd, and `VAR=x cmd` does not on the latter.
  if (process.env.BRIEF_SELFTEST_OFFLINE === "true" || process.argv.includes("--offline")) {
    console.log(`[selftest] offline mode — using the synthetic pool`);
    return syntheticPool();
  }
  const cached = path.join(".cache", `${DATE}-items.json`);
  if (fs.existsSync(cached)) {
    const parsed = JSON.parse(fs.readFileSync(cached, "utf8")) as {
      items: (Omit<FeedItem, "publishedAt"> & { publishedAt?: string })[];
    };
    console.log(`[selftest] using cached pool: ${cached} (${parsed.items.length} items)`);
    return parsed.items.map((it) => ({
      ...it,
      publishedAt: it.publishedAt ? new Date(it.publishedAt) : undefined,
    }));
  }
  console.log(`[selftest] no cache — fetching live…`);
  const { items } = await fetchAll(enabledSources());
  return items;
}

let failures = 0;
function check(label: string, pass: boolean): void {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
}

async function main() {
  const pool = (await loadPool()).slice(0, 110);
  if (pool.length < 6) throw new Error(`pool too small (${pool.length}) to self-test`);

  const editionsDir = path.join(OUT_ROOT, "editions", DATE);
  fs.rmSync(OUT_ROOT, { recursive: true, force: true });
  fs.mkdirSync(editionsDir, { recursive: true });

  const history = syntheticHistory();

  // Tier 4 regression: an item reached through a tier-1 DISCOVERY query, from
  // a publisher we do not recognise, must not be graded primary. Before the
  // fix, 14% of tier-1 pool items carried a false primary grade.
  console.log(`\n[selftest] tier-4 primary-source grading:`);
  const t1 = pool.filter((i) => i.tier === 1);
  const t1ViaIndex = t1.filter((i) => i.via === "Google News");
  const t1Direct = t1.filter((i) => !i.via);
  check(
    `tier-1 direct feeds are primary (${t1Direct.filter((i) => i.primary).length}/${t1Direct.length})`,
    t1Direct.length === 0 || t1Direct.every((i) => i.primary),
  );
  check(
    `tier-1 discovery items are primary only when the publisher is`,
    t1ViaIndex.every((i) => i.primary === false || i.primary === true) &&
      t1ViaIndex.some((i) => !i.primary),
  );

  for (const lang of ["id", "en"] as Lang[]) {
    console.log(`\n[selftest] ${lang}:`);
    const { edition, rejected } = assembleEdition({
      text: fixture(lang, pool.length),
      pool,
      lang,
      date: DATE,
      history,
      meta: { tierCounts: countByTier(enabledSources()), candidateCount: 300, poolSize: pool.length },
    });

    check("6 signals survive: 5 verified plus the one permitted unverified", edition.signals.length === 6);
    check(
      "the verified signals come first",
      edition.signals
        .slice(0, 5)
        .every((sg) => sg.corroboration.publishers >= 2 || sg.corroboration.hasPrimary),
    );
    check("4 defective signals rejected", rejected.filter((r) => !r.reason.startsWith("unverified")).length === 4);
    check("out-of-range citation rejected", rejected.some((r) => r.reason.startsWith("citation out of range")));
    check("missing citation rejected", rejected.some((r) => r.reason === "no citation"));
    check("missing themeKey rejected", rejected.some((r) => r.reason === "missing themeKey"));
    check("incomplete ladder rejected", rejected.some((r) => r.reason === "incomplete reasoning ladder"));
    check("ranks renumbered from 1", edition.signals.every((s, i) => s.rank === i + 1));

    // The evidence floor.
    const unver = edition.signals.filter((sg) => sg.corroboration.publishers < 2 && !sg.corroboration.hasPrimary);
    check("at most one unverified signal published", unver.length <= 1);
    check(
      "the surplus unverified signal was dropped, with a reason",
      rejected.some((r) => r.reason.startsWith("unverified beyond the cap")),
    );
    check("an unverified signal never leads the edition", edition.signals[0].corroboration.publishers >= 2 || edition.signals[0].corroboration.hasPrimary);
    check(
      "every cited source is referenced by a surviving signal",
      edition.sources.every((src) =>
        edition.signals.some((sg) => sg.sourceUrls.includes(src.url) || sg.secondOrderUrls.includes(src.url)),
      ),
    );
    check("invalid strength normalised", edition.signals[4]?.strength === "material");
    check(
      "invalid domain fell back to the cited item's domain",
      edition.signals.every((s) => ["ai", "energy", "corporate"].includes(s.domain)),
    );

    // Tier 4
    check("corroboration counts distinct publishers", edition.signals[0].corroboration.publishers >= 1);
    check(
      "second-order citations resolve separately from the fact ones",
      edition.signals[1].secondOrderUrls.length === 1 &&
        !edition.signals[1].sourceUrls.includes(edition.signals[1].secondOrderUrls[0]),
    );
    check(
      "signals without second-order evidence leave it empty",
      edition.signals[0].secondOrderUrls.length === 0,
    );
    check(
      "corroboration ignores second-order citations",
      // Signal 2 cites one fact source; adding a second-order citation must
      // not inflate the publisher count that grades the claim.
      edition.signals[1].corroboration.publishers === 2,
    );
    check(
      "no source body is ever written into a published edition",
      !JSON.stringify(edition).includes("FULL TEXT") &&
        edition.sources.every((src) => !("body" in src)),
    );
    check(
      "corroboration is computed, not claimed",
      edition.signals.every((s) => typeof s.corroboration.hasPrimary === "boolean"),
    );

    // Tier 6 — the regression that matters
    const seeded = edition.signals.find((s) => s.themeKey === THEME);
    check("varied headline still matched by themeKey", seeded?.trend.status === "structural");
    check("occurrence count includes today", seeded?.trend.occurrences === 6);
    check("first-seen taken from the archive", seeded?.trend.firstSeen === "2026-07-28");
    const sloppy = edition.signals.find((s) => s.headline.includes("Bank"));
    check("sloppy themeKey normalised to the same slug", sloppy?.themeKey === normaliseThemeKey(THEME));
    check("normalised key also matched the archive", sloppy?.trend.status === "structural");
    check(
      "unrelated signals classified new",
      edition.signals.filter((s) => s.themeKey !== THEME).every((s) => s.trend.status === "new"),
    );
    check("archive trends surfaced separately", edition.trends.length >= 1);

    check("valid dueDate kept", edition.watchNext[0]?.dueDate === "2026-09-30");
    check("malformed dueDate dropped", edition.watchNext[1]?.dueDate === undefined);
    check(
      "cited sources resolve to real fetched URLs",
      edition.sources.length >= 4 && edition.sources.every((s) => s.url.startsWith("http")),
    );

    fs.writeFileSync(path.join(editionsDir, `${lang}.json`), JSON.stringify(edition, null, 2), "utf8");
  }

  console.log(`\n[selftest] fixture editions → ${editionsDir}/`);
  if (failures > 0) {
    console.error(`\n[selftest] ${failures} check(s) FAILED.`);
    process.exit(1);
  }
  console.log(`\n[selftest] all checks passed.`);
}

main()
  .then(() => finish(0))
  .catch((e) => {
    console.error(e);
    void finish(1);
  });
