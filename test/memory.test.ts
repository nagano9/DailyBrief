import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifySignal,
  historyWindow,
  normaliseThemeKey,
  slugSimilarity,
  summariseTrends,
  trendContext,
  type SignalRecord,
} from "../lib/brief/memory";

/**
 * Tier 6 is the layer that most easily passes a bad test.
 *
 * The first implementation clustered headlines lexically and scored 0/10
 * recall on realistic same-theme headlines, while its test passed because the
 * fixture reused one headline verbatim. So every test here uses headlines
 * that share almost no words — if theme matching ever regresses to lexical
 * similarity, these fail.
 */

const THEME = "ai-datacenter-project-finance";

function seed(dates: string[], headlines: string[], key = THEME): SignalRecord[] {
  return dates.map((date, i) => ({
    date,
    lang: "id",
    domain: "ai" as const,
    themeKey: key,
    headline: headlines[i] ?? headlines[0],
    urls: [],
  }));
}

// Five ways a working editor would headline one theme on five days.
const VARIED = [
  "Nvidia menjamin kewajiban proyek pusat data AI senilai USD 10 miliar",
  "Pusat data AI mulai dinilai dengan struktur project finance",
  "Pendanaan infrastruktur AI bergeser ke skema jaminan vendor",
  "Lender menuntut offtake jangka panjang untuk fasilitas komputasi",
  "Struktur pembiayaan pusat data makin menyerupai proyek listrik",
];
const DATES = ["2026-07-28", "2026-08-02", "2026-08-07", "2026-08-12", "2026-08-16"];
const TODAY = "2026-08-18";

test("normaliseThemeKey turns sloppy model output into one stable slug", () => {
  const expected = "ai-datacenter-project-finance";
  assert.equal(normaliseThemeKey("  AI Datacenter Project Finance.  "), expected);
  assert.equal(normaliseThemeKey("AI_datacenter--project_finance"), expected);
  assert.equal(normaliseThemeKey(expected), expected);
});

test("normaliseThemeKey caps slug length so a sentence cannot become a key", () => {
  const key = normaliseThemeKey("one two three four five six seven eight nine");
  assert.equal(key.split("-").length, 6);
});

test("normaliseThemeKey returns empty for input with nothing usable", () => {
  assert.equal(normaliseThemeKey("   ...   "), "");
  assert.equal(normaliseThemeKey(""), "");
});

test("slugSimilarity is 1 for identical keys and 0 for unrelated ones", () => {
  assert.equal(slugSimilarity(THEME, THEME), 1);
  assert.equal(slugSimilarity(THEME, "pln-grid-investment"), 0);
});

test("slugSimilarity tolerates drift without merging unrelated themes", () => {
  assert.ok(slugSimilarity(THEME, "ai-datacenter-financing") >= 0.5);
  assert.ok(slugSimilarity(THEME, "esdm-tariff-regulation") < 0.5);
});

test("a theme is recognised across days despite headlines sharing no words", () => {
  const t = classifySignal(THEME, seed(DATES, VARIED), TODAY);
  assert.equal(t.status, "structural");
  assert.equal(t.occurrences, 6, "five archived dates plus today");
  assert.equal(t.firstSeen, "2026-07-28");
  assert.equal(t.spanDays, 21);
});

test("an unseen theme is new, not accidentally matched", () => {
  const t = classifySignal("pln-grid-investment", seed(DATES, VARIED), TODAY);
  assert.equal(t.status, "new");
  assert.equal(t.occurrences, 1);
});

test("two appearances make a theme recurring, not yet structural", () => {
  const t = classifySignal(THEME, seed(["2026-08-16"], VARIED), TODAY);
  assert.equal(t.status, "recurring");
  assert.equal(t.occurrences, 2);
});

test("structural needs both enough appearances and enough elapsed time", () => {
  // Four appearances, but all within three days: a burst, not a trend.
  const burst = seed(["2026-08-15", "2026-08-16", "2026-08-17"], VARIED);
  const t = classifySignal(THEME, burst, TODAY);
  assert.equal(t.occurrences, 4);
  assert.equal(t.status, "recurring", "a three-day burst is not structural");
});

test("the same theme in two language editions counts once per date", () => {
  const both: SignalRecord[] = [
    ...seed(["2026-08-16"], VARIED),
    { ...seed(["2026-08-16"], VARIED)[0], lang: "en" },
  ];
  assert.equal(classifySignal(THEME, both, TODAY).occurrences, 2, "one archived date plus today");
});

test("today's own records never inflate today's count", () => {
  const withToday = seed([...DATES, TODAY], [...VARIED, "Sinyal hari ini"]);
  assert.equal(classifySignal(THEME, withToday, TODAY).occurrences, 6);
});

test("historyWindow excludes anything older than the lookback", () => {
  const old = seed(["2026-01-01", "2026-08-16"], VARIED);
  const kept = historyWindow(old, TODAY);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].date, "2026-08-16");
});

test("summariseTrends reports only themes that actually recurred", () => {
  const mixed = [...seed(DATES, VARIED), ...seed(["2026-08-15"], ["Satu-satunya"], "one-off-theme")];
  const trends = summariseTrends(mixed, TODAY, 5);
  assert.equal(trends.length, 1, "a single appearance is not a trend");
  assert.equal(trends[0].themeKey, THEME);
  assert.equal(trends[0].occurrences, 5);
  assert.equal(trends[0].theme, VARIED[4], "labelled by its most recent headline");
});

test("trendContext gives the model the existing slugs so it reuses them", () => {
  const ctx = trendContext(seed(DATES, VARIED), TODAY, "en");
  assert.ok(ctx.includes(THEME), "the slug itself must appear");
  assert.ok(/REUSE ITS EXACT themeKey/i.test(ctx));
});

test("trendContext on an empty archive tells the model to coin fresh keys", () => {
  const ctx = trendContext([], TODAY, "en");
  assert.ok(/no recurring theme yet/i.test(ctx));
});
