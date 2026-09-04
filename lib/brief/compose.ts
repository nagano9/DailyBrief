import fs from "node:fs";
import path from "node:path";

import { jsonrepair } from "jsonrepair";
import { runLlm, getModelTag } from "../ai/llm";
import { extractJson } from "../ai/json-util";
import { systemPrompt, userPrompt, type CandidateLine } from "./prompt";
import { loadProfile } from "./profile";
import { publisherTier } from "./publishers";
import {
  classifySignal,
  loadHistory,
  normaliseThemeKey,
  summariseTrends,
  trendContext,
  type SignalRecord,
} from "./memory";
import {
  DOMAINS,
  ENGINE_VERSION,
  type Corroboration,
  type Domain,
  type Edition,
  type EditionMeta,
  type FeedItem,
  type Lang,
  type Signal,
  type SignalStrength,
  type SourceRef,
  type SourceTier,
  type WatchItem,
} from "./types";

/**
 * Tier 4 (verification) + Tier 5 (reasoning) + Tier 6 (memory), assembled.
 *
 * The contract that makes this citable: **the model cites candidate indices,
 * and this module resolves them.** A signal whose indices do not resolve is
 * dropped, not repaired. Nothing reaches a reader that is not anchored to a
 * URL actually fetched today.
 *
 * Corroboration and trend status are computed here, never asserted by the
 * model — a model that grades its own evidence grades it generously.
 */

const CANDIDATE_LIMIT = Number(process.env.BRIEF_CANDIDATE_LIMIT ?? 110);
/**
 * How many single-source, no-primary signals an edition may carry.
 *
 * Measured across five published editions, the evidence gradient collapses at
 * the bottom of the ranking: rank 5 fell to a single publisher in four of
 * them, and rank 3 did so in two. Nothing prevented it, because ranking was
 * the model's alone and a model grading its own evidence grades it
 * generously.
 *
 * One such signal is defensible — a genuine scoop reaches one outlet first.
 * Several is a briefing whose claims cannot be checked, on a product whose
 * whole proposition is that they can.
 */
const MAX_UNVERIFIED = Number(process.env.BRIEF_MAX_UNVERIFIED ?? 1);
const REQUIRED_SIGNALS = 5;
/** Publish with fewer than this many valid signals and the briefing is thin. */
const MIN_SIGNALS = Number(process.env.BRIEF_MIN_SIGNALS ?? 3);
const MAX_COMPOSE_ATTEMPTS = 2;

export interface ComposeResult {
  edition: Edition;
  rejected: { statement: string; reason: string }[];
}

function fmtDate(d?: Date): string {
  if (!d || Number.isNaN(d.getTime())) return "n/a";
  return d.toISOString().slice(0, 10);
}

/**
 * Publisher-tier-3 items are held back unless the pool would otherwise run
 * short.
 *
 * Ranking already pushed the long tail down the ordering, but the cap still
 * admitted some — and once an item is in the pool the model treats every
 * candidate as equal. That is how a price-comparison site with an
 * auto-generated news section ended up cited beside Bloomberg and OpenAI,
 * supplying the most dramatic sentence in the edition.
 *
 * Held back, not banned: if a thin day leaves too few known publishers, a
 * smaller pool would hurt more than a weaker one.
 */
function preferKnownPublishers(items: FeedItem[], cap: number): FeedItem[] {
  const known = items.filter((i) => publisherTier(i.publisher) <= 2);
  if (known.length >= cap) return known.slice(0, cap);
  const rest = items.filter((i) => publisherTier(i.publisher) === 3);
  return [...known, ...rest].slice(0, cap);
}

/**
 * Put the primary sources we read in full at the front.
 *
 * Round-robin across sources spreads any one source's items across many
 * rounds, so OpenAI's third item landed at position 73 of 110 — carrying, in
 * its body, the most consequential fact available that day. The model saw it
 * and weighed it against 72 headlines ahead of it.
 *
 * These are the highest-value candidates by construction: an institution
 * publishing about itself, read to the end. Ordering is stable, so the
 * existing credibility ranking still decides everything within each group.
 */
function fullTextFirst(items: FeedItem[]): FeedItem[] {
  return [...items.filter((i) => i.body), ...items.filter((i) => !i.body)];
}

export function buildCandidates(items: FeedItem[]): {
  lines: CandidateLine[];
  pool: FeedItem[];
} {
  const pool = fullTextFirst(preferKnownPublishers(items, CANDIDATE_LIMIT));
  const lines = pool.map((it, i) => ({
    index: i + 1,
    publisher: it.publisher,
    title: it.title,
    date: fmtDate(it.publishedAt),
    tier: it.tier,
    domain: it.domain,
    excerpt: it.excerpt?.slice(0, 180),
    body: it.body,
  }));
  return { lines, pool };
}

function parseLlmJson(raw: string): Record<string, unknown> {
  const text = extractJson(raw);
  // extractJson returns its input unchanged when it finds no braces, and
  // jsonrepair will happily "repair" a bare sentence into an object keyed by
  // character index — turning a plain-English backend error into a baffling
  // one about missing fields.
  if (!text.startsWith("{")) {
    throw new Error(
      `model did not return JSON. First 200 chars of the response: ${raw.trim().slice(0, 200)}`,
    );
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return JSON.parse(jsonrepair(text)) as Record<string, unknown>;
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

class StyleViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StyleViolationError";
  }
}

const STYLE_RULES: { name: string; pattern: RegExp; fix: string }[] = [
  {
    name: "em dash",
    pattern: /—/,
    fix: "replace em dashes with commas, colons, semicolons, or separate sentences",
  },
  { name: "arrow", pattern: /[→←]/, fix: "write the causal chain as a sentence" },
  {
    name: "not-just frame",
    pattern: /\b(?:bukan|tidak)\s+(?:sekadar|hanya)\b.{0,90}\b(?:tetapi|melainkan|namun)\b/i,
    fix: "state the claim directly without the not-just/but frame",
  },
  {
    name: "not-just/not-only frame",
    pattern: /\bnot\s+(?:just|only)\b.{0,90}\bbut(?:\s+also)?\b/i,
    fix: "state the claim directly without the not-only/but frame",
  },
  {
    name: "generic opening",
    pattern: /\b(?:di tengah dinamika|dalam lanskap|di era|seiring dengan perkembangan)\b/i,
    fix: "open with the concrete development, entity, or decision",
  },
  {
    name: "generic opening",
    pattern: /\b(?:amid|in an evolving landscape|in an era|as developments continue)\b/i,
    fix: "open with the concrete development, entity, or decision",
  },
  {
    name: "boilerplate label",
    pattern: /\b(?:apa artinya|mengapa penting|ke depan|implikasinya jelas)\b/i,
    fix: "remove boilerplate labels and write the substance",
  },
  {
    name: "boilerplate label",
    pattern: /\b(?:what this means|why it matters|going forward|the implication is clear)\b/i,
    fix: "remove boilerplate labels and write the substance",
  },
];

function assertCleanProse(value: string, where: string): void {
  for (const rule of STYLE_RULES) {
    if (rule.pattern.test(value)) {
      throw new StyleViolationError(`${where} contains ${rule.name}; ${rule.fix}`);
    }
  }
}

function assertCleanProseFields(fields: [string, string][]): void {
  for (const [where, value] of fields) {
    if (value) assertCleanProse(value, where);
  }
}

function styleRetryHint(lang: Lang, reason: string): string {
  if (lang === "en") {
    return `\n\nSTYLE REPAIR REQUIRED:\nThe previous draft failed validation: ${reason}.\nRewrite the entire JSON object. Do not use em dashes, arrows, generic openings, not-just/not-only frames, or boilerplate labels. Keep every field concrete and source-grounded.`;
  }
  return `\n\nPERBAIKAN GAYA WAJIB:\nDraft sebelumnya gagal validasi: ${reason}.\nTulis ulang seluruh objek JSON. Jangan memakai em dash, tanda panah, pembuka generik, pola bukan-sekadar/tidak-hanya, atau label boilerplate. Pastikan setiap field konkret dan berbasis sumber.`;
}

const STRENGTHS = new Set<SignalStrength>(["material", "emerging", "actionable"]);
const VALID_DOMAINS = new Set<string>(DOMAINS);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseWatch(v: unknown): WatchItem[] {
  if (!Array.isArray(v)) return [];
  const out: WatchItem[] = [];
  for (const raw of v) {
    if (typeof raw === "string") {
      if (raw.trim()) out.push({ item: raw.trim() });
      continue;
    }
    if (!raw || typeof raw !== "object") continue;
    const w = raw as Record<string, unknown>;
    const item = str(w.item);
    if (!item) continue;
    const dueDate =
      typeof w.dueDate === "string" && ISO_DATE.test(w.dueDate) ? w.dueDate : undefined;
    out.push({ item, dueDate });
  }
  return out.slice(0, 6);
}

/**
 * Tier 4 — corroboration, computed from the citations themselves.
 *
 * Counts DISTINCT publishers, not citations: three wire pickups of one press
 * release is one publisher's worth of evidence dressed as three. `hasPrimary`
 * says whether any citation came from a must-monitor source, which is the
 * difference between "the lab announced it" and "someone says the lab
 * announced it".
 */
/**
 * Keep only the entities the signal actually mentions.
 *
 * A model asked for an entity index will supply a helpful one — including
 * names it inferred rather than wrote. An index is a navigation promise: click
 * PLN, get signals about PLN. One entry the text never mentions breaks that
 * promise silently, so membership is checked against the prose rather than
 * trusted.
 */
export function resolveEntities(raw: unknown, prose: string): string[] {
  if (!Array.isArray(raw)) return [];
  const haystack = prose.toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const name = value.trim();
    // Single characters and stray punctuation are not entities.
    if (name.length < 2) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    if (!haystack.includes(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.slice(0, 6);
}

/**
 * A claim carried by one publisher, with no primary source behind it.
 *
 * Not false, and not necessarily weak — but nothing in the edition lets a
 * reader cross-check it, so it cannot lead one.
 */
export function isUnverified(c: Corroboration): boolean {
  return c.publishers < 2 && !c.hasPrimary;
}

function corroborate(items: FeedItem[]): Corroboration {
  const publishers = new Set(items.map((i) => i.publisher.toLowerCase()));
  // `primary` is decided at fetch time, where we know whether the item came
  // from an institution's own feed or from an index query that happened to
  // sit at tier 1. Reading source tier here graded 14% of tier-1 items as
  // primary when they were not.
  const hasPrimary = items.some((i) => i.primary);
  return { publishers: publishers.size, hasPrimary };
}

interface ResolvedSignals {
  signals: Omit<Signal, "trend">[];
  cited: Set<number>;
  rejected: { statement: string; reason: string }[];
}

/**
 * Resolve `cites: [3, 7]` against the candidate pool and build each signal.
 *
 * Rejects rather than repairs. A signal citing item 140 when we showed 110 is
 * a model that lost track of the list; dropping the bad index and publishing
 * the claim anyway would defeat the entire design.
 */
function resolveSignals(v: unknown, pool: FeedItem[]): ResolvedSignals {
  const signals: Omit<Signal, "trend">[] = [];
  const cited = new Set<number>();
  const rejected: { statement: string; reason: string }[] = [];
  if (!Array.isArray(v)) return { signals, cited, rejected };

  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const headline = str(s.headline);
    if (!headline) continue;

    const themeKey = normaliseThemeKey(str(s.themeKey));
    if (!themeKey) {
      rejected.push({ statement: headline, reason: "missing themeKey" });
      continue;
    }

    const whatChanged = str(s.whatChanged);
    const whyItMatters = str(s.whyItMatters);
    const secondOrder = str(s.secondOrder);
    const action = str(s.action);
    if (!whatChanged || !whyItMatters) {
      rejected.push({ statement: headline, reason: "incomplete reasoning ladder" });
      continue;
    }
    assertCleanProseFields([
      ["signal.headline", headline],
      ["signal.whatChanged", whatChanged],
      ["signal.whyItMatters", whyItMatters],
      ["signal.secondOrder", secondOrder],
      ["signal.action", action],
    ]);

    const indices = (Array.isArray(s.cites) ? s.cites : [])
      .map((n) => (typeof n === "number" ? n : Number.parseInt(String(n), 10)))
      .filter((n) => Number.isInteger(n));

    if (indices.length === 0) {
      rejected.push({ statement: headline, reason: "no citation" });
      continue;
    }
    const outOfRange = indices.filter((n) => n < 1 || n > pool.length);
    if (outOfRange.length > 0) {
      rejected.push({
        statement: headline,
        reason: `citation out of range: ${outOfRange.join(", ")} (pool is 1..${pool.length})`,
      });
      continue;
    }

    const unique = [...new Set(indices)];
    for (const n of unique) cited.add(n);
    const backing = unique.map((n) => pool[n - 1]);

    // Optional, and usually absent. The second-order read is normally our
    // inference, and leaving it uncited is what tells a reader so.
    const secondOrderCites = (Array.isArray(s.secondOrderCites) ? s.secondOrderCites : [])
      .map((n) => (typeof n === "number" ? n : Number.parseInt(String(n), 10)))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= pool.length);
    for (const n of secondOrderCites) cited.add(n);

    const domainRaw = str(s.domain);
    const domain = VALID_DOMAINS.has(domainRaw) ? (domainRaw as Domain) : backing[0].domain;
    const strength = STRENGTHS.has(s.strength as SignalStrength)
      ? (s.strength as SignalStrength)
      : "material";

    const prose = [
      headline,
      whatChanged,
      whyItMatters,
      str(s.secondOrder),
      str(s.action),
    ].join(" ");

    signals.push({
      rank: typeof s.rank === "number" ? s.rank : signals.length + 1,
      domain,
      themeKey,
      entities: resolveEntities(s.entities, prose),
      headline,
      whatChanged,
      whyItMatters,
      secondOrder,
      action,
      strength,
      sourceUrls: backing.map((b) => b.url),
      secondOrderUrls: [...new Set(secondOrderCites)].map((n) => pool[n - 1].url),
      // Computed from the FACT citations only. Corroboration answers "is this
      // true", and a source cited for a downstream inference says nothing
      // about that.
      corroboration: corroborate(backing),
    });
  }

  signals.sort((a, b) => a.rank - b.rank);

  // An unverified claim may appear, but it may not lead. Sorting is stable,
  // so the model's ordering survives inside each group — this decides only
  // that checkable claims come first, not which of them wins.
  const verified = signals.filter((s) => !isUnverified(s.corroboration));
  const unverified = signals.filter((s) => isUnverified(s.corroboration));

  for (const dropped of unverified.slice(MAX_UNVERIFIED)) {
    rejected.push({
      statement: dropped.headline,
      reason: `unverified beyond the cap of ${MAX_UNVERIFIED} (single publisher, no primary source)`,
    });
  }

  const kept = [...verified, ...unverified.slice(0, MAX_UNVERIFIED)];
  kept.forEach((s, i) => {
    s.rank = i + 1;
  });

  // Rebuild the citation set from what survived. Accumulating it during the
  // loop would leave the source list carrying entries no signal references —
  // a bibliography padded with sources the edition does not actually use,
  // which is the opposite of what the list is for.
  const keptUrls = new Set(kept.flatMap((sig) => [...sig.sourceUrls, ...sig.secondOrderUrls]));
  const stillCited = new Set([...cited].filter((n) => keptUrls.has(pool[n - 1].url)));

  return { signals: kept, cited: stillCited, rejected: rejected.slice(0, 20) };
}

function toSourceRefs(pool: FeedItem[], cited: Set<number>): SourceRef[] {
  return [...cited]
    .sort((a, b) => a - b)
    .map((n) => pool[n - 1])
    .map((it) => ({
      title: it.title,
      publisher: it.publisher,
      url: it.url,
      tier: it.tier,
      via: it.via,
      primary: it.primary,
      publishedAt:
        it.publishedAt && !Number.isNaN(it.publishedAt.getTime())
          ? it.publishedAt.toISOString()
          : undefined,
    }));
}

export interface AssembleInput {
  /** Raw model response text. */
  text: string;
  /** The exact candidate pool the model was shown — citation indices map into this. */
  pool: FeedItem[];
  lang: Lang;
  date: string;
  meta: Omit<EditionMeta, "generatedAt" | "engineVersion" | "model">;
  /** Signal archive for trend classification. Pass [] to disable tier 6. */
  history: SignalRecord[];
}

/**
 * Validate a model response and assemble a publishable Edition.
 *
 * Separated from the LLM call so the whole validation surface — citation
 * resolution, corroboration, trend classification, premium gating — can be
 * exercised against fixtures without spending a call or needing credentials.
 */
export function assembleEdition({
  text,
  pool,
  lang,
  date,
  meta,
  history,
}: AssembleInput): ComposeResult {
  if (process.env.BRIEF_DEBUG_RAW === "true") {
    fs.mkdirSync(".cache", { recursive: true });
    const file = path.join(".cache", `${date}-${lang}-raw.txt`);
    fs.writeFileSync(file, text, "utf8");
    console.log(`[compose] raw model output → ${file} (${text.length} chars)`);
  }

  const raw = parseLlmJson(text);
  if (!Array.isArray(raw.signals)) {
    throw new Error(
      `model returned no "signals" array (top-level keys: ${Object.keys(raw).join(", ") || "none"}). ` +
        `Re-run with BRIEF_DEBUG_RAW=true to capture the raw output.`,
    );
  }

  const { signals: bare, cited, rejected } = resolveSignals(raw.signals, pool);

  if (bare.length < MIN_SIGNALS) {
    throw new Error(
      `only ${bare.length} signal(s) survived validation, minimum is ${MIN_SIGNALS} ` +
        `(${rejected.length} rejected) — refusing to publish a thin briefing`,
    );
  }
  if (bare.length !== REQUIRED_SIGNALS) {
    console.warn(`[compose] ${lang}: ${bare.length} valid signals, expected ${REQUIRED_SIGNALS}`);
  }

  // Tier 6 — classify each signal against the archive, then surface the
  // archive's recurring themes independently of today's five.
  const signals: Signal[] = bare.map((s) => ({
    ...s,
    trend: classifySignal(s.themeKey, history, date),
  }));
  const trends = summariseTrends(history, date, 5);

  const title = str(raw.title);
  const dek = str(raw.dek);
  const summary = str(raw.summary);
  const watchNext = parseWatch(raw.watchNext);
  assertCleanProseFields([
    ["title", title],
    ["dek", dek],
    ["summary", summary],
    ...watchNext.map((w, i) => [`watchNext[${i}].item`, w.item] as [string, string]),
  ]);
  const edition: Edition = {
    slug: date,
    date,
    lang,
    title:
      title || (lang === "en" ? `Strategic briefing: ${date}` : `Briefing strategis: ${date}`),
    dek,
    domains: [...new Set(signals.map((s) => s.domain))],
    summary,
    signals,
    watchNext,
    sources: toSourceRefs(pool, cited),
    trends,
    meta: {
      ...meta,
      generatedAt: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
      model: getModelTag(),
    },
  };

  return { edition, rejected };
}

export async function composeEdition(
  items: FeedItem[],
  lang: Lang,
  date: string,
  tierCounts: Record<SourceTier, number>,
): Promise<ComposeResult> {
  const { lines, pool } = buildCandidates(items);
  if (pool.length === 0) {
    throw new Error("no candidate items — refusing to compose an empty briefing");
  }

  const history = loadHistory(date);
  const profile = loadProfile();

  const basePrompt = userPrompt(lang, date, lines, trendContext(history, date, lang), profile);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_COMPOSE_ATTEMPTS; attempt++) {
    const prompt = attempt === 1 ? basePrompt : basePrompt + styleRetryHint(lang, String((lastError as Error).message ?? lastError));
    const { text } = await runLlm({
      systemPrompt: systemPrompt(lang),
      userPrompt: prompt,
      timeoutMs: 300_000,
    });

    try {
      return assembleEdition({
        text,
        pool,
        lang,
        date,
        history,
        meta: { tierCounts, candidateCount: items.length, poolSize: pool.length },
      });
    } catch (e) {
      lastError = e;
      if (!(e instanceof StyleViolationError) || attempt === MAX_COMPOSE_ATTEMPTS) throw e;
      console.warn(`[compose] ${lang}: style validation failed, retrying once — ${(e as Error).message}`);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
