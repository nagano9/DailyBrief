import fs from "node:fs";
import path from "node:path";
import type { Domain, TrendInfo, TrendStatus, TrendSummary } from "./types";

/**
 * Tier 6 — longitudinal signal memory.
 *
 * Every other tier answers "what happened today". This one answers the
 * question that changes decisions: *has this been happening?*
 *
 *   "This theme has appeared six times in thirty days. It is no longer a
 *    weak signal; it is a structural trend."
 *
 * ## Why theme keys, not headline fingerprints
 *
 * The first implementation clustered by lexical overlap between headlines.
 * Measured against five realistic headlines a working editor would write for
 * the same theme on different days, it matched **0 of 10 pairs** — the words
 * simply do not repeat. Lowering the threshold did not rescue it (jaccard
 * @0.20 reached 2/10, overlap @0.30 reached 3/10 and began merging unrelated
 * themes). The approach was wrong, not the constant.
 *
 * So the model emits a canonical slug per signal — `ai-datacenter-project-
 * finance` — and matching is done on that. The judgement "is this the same
 * story?" moves to the layer that can actually make it, while the matching
 * itself stays deterministic and inspectable in code. Slug drift is absorbed
 * by token overlap between slugs, which is a far smaller space than free
 * prose.
 *
 * Storage is append-only JSONL, one record per published signal. Append-only
 * because rewriting history is precisely what a memory layer must never do:
 * a trend that can be silently revised is not evidence.
 */

/**
 * Editions are the only record of what was published, so they are the only
 * honest source for what recurred.
 *
 * The first design kept a separate append-only log written on every compose.
 * Running a date more than once — which happens while iterating, and happened
 * three times on the first published day — left the log holding 20 records
 * for a day that published 5 signals. Thirteen of those themes were never
 * published at all, and would have counted as prior occurrences the next
 * morning, marking fresh signals as recurring.
 *
 * Deriving from `editions/` removes the failure mode rather than patching it:
 * re-running a date overwrites its edition file, so the memory corrects
 * itself. It also removes an artifact that had to be kept consistent with
 * another one.
 */
/** Read at call time, not module load: a value fixed at import cannot be varied by a test. */
function editionsDir(): string {
  return process.env.EDITIONS_DIR ?? "editions";
}

/** Days of history considered when classifying a theme. */
export const WINDOW_DAYS = Number(process.env.TREND_WINDOW_DAYS ?? 30);

/** Appearances within the window before a theme is called structural. */
export const STRUCTURAL_THRESHOLD = Number(process.env.TREND_STRUCTURAL_MIN ?? 4);

/**
 * Slug-token overlap above which two theme keys are treated as one theme.
 *
 * Slugs are short and deliberate, so this operates on 3-5 tokens rather than
 * a dozen words of prose. `ai-datacenter-project-finance` and
 * `ai-datacenter-financing` share 2 of 4 — enough to be the same thread.
 */
const SAME_THEME_SIMILARITY = 0.5;

export interface SignalRecord {
  date: string;
  lang: string;
  domain: Domain;
  themeKey: string;
  headline: string;
  urls: string[];
}

/**
 * Normalise a model-supplied theme key into a stable slug.
 *
 * The model is asked for kebab-case, but asking is not enforcing: it will
 * occasionally return spaces, capitals, or a trailing period. Normalising
 * here means a formatting wobble never splits one theme into two.
 */
export function normaliseThemeKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter(Boolean)
    .slice(0, 6)
    .join("-");
}

function tokens(themeKey: string): string[] {
  // Single-character fragments carry no meaning and inflate the denominator.
  return themeKey.split("-").filter((t) => t.length > 1);
}

/** Overlap relative to the smaller slug, so a longer slug is not penalised. */
function slugSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  let shared = 0;
  for (const t of ta) if (setB.has(t)) shared++;
  return shared / Math.min(ta.length, tb.length);
}

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(b).getTime() - new Date(a).getTime());
  return Math.round(ms / 86_400_000);
}

/**
 * Read the published signals within the lookback window of `referenceDate`.
 *
 * Directory names are filtered before any file is opened, so the cost stays
 * flat as the archive grows rather than rising with it.
 */
export function loadHistory(referenceDate: string): SignalRecord[] {
  const root = editionsDir();
  if (!fs.existsSync(root)) return [];

  const out: SignalRecord[] = [];
  const dates = fs
    .readdirSync(root)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .filter((d) => d < referenceDate && daysBetween(d, referenceDate) <= WINDOW_DAYS);

  for (const date of dates) {
    const dir = path.join(root, date);
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const lang = file.replace(/\.json$/, "");
      try {
        const edition = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as {
          signals?: { themeKey?: string; headline?: string; domain?: Domain; sourceUrls?: string[] }[];
        };
        for (const sig of edition.signals ?? []) {
          // Editions written before themeKey existed carry no theme to match on.
          if (!sig.themeKey || !sig.headline || !sig.domain) continue;
          out.push({
            date,
            lang,
            domain: sig.domain,
            themeKey: sig.themeKey,
            headline: sig.headline,
            urls: sig.sourceUrls ?? [],
          });
        }
      } catch {
        console.warn(`[memory] skipping unreadable edition ${date}/${file}`);
      }
    }
  }
  return out;
}

/** History entries strictly before `date` and within the lookback window. */
export function historyWindow(history: SignalRecord[], date: string): SignalRecord[] {
  return history.filter((r) => r.date < date && daysBetween(r.date, date) <= WINDOW_DAYS);
}

function classify(occurrences: number, spanDays: number): TrendStatus {
  if (occurrences >= STRUCTURAL_THRESHOLD && spanDays >= 7) return "structural";
  if (occurrences >= 2) return "recurring";
  return "new";
}

/**
 * Classify one signal against the archive.
 *
 * `occurrences` counts today plus every prior DATE whose theme key matches.
 * Counting dates rather than records means the same theme carried in both
 * language editions, or by three publishers, is one occurrence — not three.
 */
export function classifySignal(
  themeKey: string,
  history: SignalRecord[],
  date: string,
): TrendInfo {
  const key = normaliseThemeKey(themeKey);
  const matchedDates = new Set<string>();

  for (const record of historyWindow(history, date)) {
    if (slugSimilarity(key, record.themeKey) >= SAME_THEME_SIMILARITY) {
      matchedDates.add(record.date);
    }
  }

  const dates = [...matchedDates].sort();
  const occurrences = dates.length + 1;
  const firstSeen = dates[0] ?? date;
  const spanDays = dates.length > 0 ? daysBetween(firstSeen, date) : 0;

  return { themeKey: key, status: classify(occurrences, spanDays), occurrences, firstSeen, spanDays };
}

/**
 * Themes recurring across the archive, most persistent first.
 *
 * Computed only from what was actually published — never asserted. This is
 * the view that shows a reader what has been building underneath the daily
 * noise.
 */
export function summariseTrends(
  history: SignalRecord[],
  date: string,
  limit = 5,
): TrendSummary[] {
  const window = [...historyWindow(history, date)].sort((a, b) => a.date.localeCompare(b.date));
  const clusters: { key: string; records: SignalRecord[] }[] = [];

  for (const record of window) {
    const hit = clusters.find((c) => slugSimilarity(c.key, record.themeKey) >= SAME_THEME_SIMILARITY);
    if (hit) hit.records.push(record);
    else clusters.push({ key: record.themeKey, records: [record] });
  }

  return clusters
    .map((c) => {
      const dates = [...new Set(c.records.map((r) => r.date))].sort();
      const firstSeen = dates[0];
      const lastSeen = dates[dates.length - 1];
      const latest = c.records[c.records.length - 1];
      return {
        themeKey: c.key,
        // The most recent headline reads better than a slug and is the one a
        // reader can recognise.
        theme: latest.headline,
        occurrences: dates.length,
        firstSeen,
        lastSeen,
        status: classify(dates.length, daysBetween(firstSeen, lastSeen)),
        domain: latest.domain,
      };
    })
    .filter((t) => t.occurrences >= 2)
    .sort((a, b) => b.occurrences - a.occurrences || b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, limit);
}

/**
 * Recurring themes rendered for the prompt.
 *
 * This is what lets the model say "this is now structural" instead of
 * reporting each day as if it were the first, and — just as important — it
 * shows the model which slugs already exist so it reuses them rather than
 * inventing a new one for the same thread.
 */
export function trendContext(history: SignalRecord[], date: string, lang: string): string {
  const trends = summariseTrends(history, date, 10);
  if (trends.length === 0) {
    return lang === "en"
      ? `TREND CONTEXT: the archive holds no recurring theme yet. Treat every signal as new and coin a fresh themeKey for each.`
      : `KONTEKS TREN: arsip belum punya tema berulang. Perlakukan semua sinyal sebagai baru dan buat themeKey baru untuk masing-masing.`;
  }
  const lines = trends
    .map((t) => `- ${t.themeKey}  [${t.status}, ${t.occurrences}x since ${t.firstSeen}] ${t.theme.slice(0, 90)}`)
    .join("\n");

  return lang === "en"
    ? `TREND CONTEXT — themes already in the archive over the last ${WINDOW_DAYS} days:
${lines}

If today's development continues one of these, REUSE ITS EXACT themeKey — that is what lets the archive recognise it as the same thread. Say explicitly that it continues, and state what the accumulation now implies. A theme at "structural" is no longer news; it is a condition to plan around.`
    : `KONTEKS TREN — tema yang sudah ada di arsip selama ${WINDOW_DAYS} hari terakhir:
${lines}

Bila perkembangan hari ini melanjutkan salah satunya, GUNAKAN ULANG themeKey-nya PERSIS — itu yang membuat arsip mengenalinya sebagai benang yang sama. Nyatakan secara eksplisit bahwa ia melanjutkan, dan jelaskan apa implikasi akumulasinya. Tema berstatus "structural" bukan lagi berita, melainkan kondisi yang harus diperhitungkan.`;
}

export { slugSimilarity, SAME_THEME_SIMILARITY };
