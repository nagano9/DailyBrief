/**
 * Domain types for the Hybrid Strategic Intelligence Radar.
 *
 * The product is a daily strategic briefing across three domains. The
 * architecture is deliberately NOT "RSS → summarize" — that model has a
 * source-selection bias it cannot see past: a development that matters but
 * appears outside the feed list is invisible.
 *
 * Instead, six tiers:
 *   1  must-monitor    curated primary/official sources, checked every run
 *   2  open discovery  query-driven, so the source universe can change daily
 *   3  emerging signal arXiv, GitHub releases, technical communities
 *   4  verification    corroboration count + primary-source presence
 *   5  reasoning       fact → pattern → implication → action
 *   6  memory          the same theme across days: weak signal → structural
 *
 * Tiers 1-3 are fetching. Tier 4 is computed deterministically in
 * `compose.ts`. Tier 5 is the model. Tier 6 lives in `memory.ts` and is the
 * layer that separates this from a very good news digest.
 */

export const ENGINE_VERSION = "2.1.0";

export type Lang = "id" | "en";

/** The three briefing domains. */
export type Domain = "ai" | "energy" | "corporate";

export const DOMAINS: Domain[] = ["ai", "energy", "corporate"];

export const DOMAIN_LABELS: Record<Lang, Record<Domain, string>> = {
  id: {
    ai: "AI, Agen & Model Frontier",
    energy: "Energi, Terbarukan & Kelistrikan",
    corporate: "Strategi Korporasi, Tata Kelola & BUMN",
  },
  en: {
    ai: "AI, Agents & Frontier Models",
    energy: "Energy, Renewables & Electricity",
    corporate: "Corporate Strategy, Governance & BUMN",
  },
};

/**
 * Where a source sits in the discovery architecture.
 *   1 — must-monitor. Primary and official sources. Missing one is a defect.
 *   2 — open-web discovery. Query-driven; catches what tier 1 cannot see.
 *   3 — emerging signal. Papers, releases, technical communities. Early and
 *       noisy by construction; weighted accordingly.
 */
/**
 * Short forms, for use as labels.
 *
 * The full names read correctly in prose and in structured data, but three of
 * them in a row — each containing its own comma — collapse into an unreadable
 * run. A label has to survive being set at 11px in uppercase beside two
 * others.
 */
export const DOMAIN_SHORT: Record<Lang, Record<Domain, string>> = {
  id: { ai: "AI & Model Frontier", energy: "Energi & Kelistrikan", corporate: "Korporasi & BUMN" },
  en: { ai: "AI & Frontier Models", energy: "Energy & Power", corporate: "Corporate & SOE" },
};

export type SourceTier = 1 | 2 | 3;

export type SourceType = "rss" | "gnews" | "arxiv" | "github-releases" | "hn";

/**
 * How load-bearing a signal is. Mirrors the three buckets the briefing
 * ranks into before selecting the top five.
 */
export type SignalStrength = "material" | "emerging" | "actionable";

/** Where a signal sits on the weak-signal → structural-trend axis. */
export type TrendStatus = "new" | "recurring" | "structural";

export interface TrendInfo {
  /** Canonical slug for the theme, emitted by the model and matched across days. */
  themeKey: string;
  status: TrendStatus;
  /** Times this theme has been published in the lookback window, including today. */
  occurrences: number;
  /** ISO date this theme first appeared in the archive. */
  firstSeen: string;
  /** Days spanned between first and latest appearance. */
  spanDays: number;
}

/**
 * Tier 4 output. Computed from the fetched set, never asserted by the model.
 *
 * `publishers` is the count of DISTINCT publishers behind a signal's
 * citations — not the count of citations, because three wire pickups of one
 * press release is one publisher's worth of evidence dressed as three.
 * `hasPrimary` says whether at least one citation is genuinely primary (see
 * FeedItem.primary). A single-publisher claim with no primary source is
 * exactly the kind of thing that should carry a visible caveat.
 */
export interface Corroboration {
  publishers: number;
  hasPrimary: boolean;
}

export interface FeedItem {
  sourceId: string;
  publisher: string;
  title: string;
  url: string;
  excerpt?: string;
  publishedAt?: Date;
  domain: Domain;
  tier: SourceTier;
  lang: Lang | "other";
  /**
   * Set when the URL routes through an index rather than the publisher's own
   * address (Google News). Surfaced so a citation never implies a direct
   * link it does not provide.
   */
  via?: string;
  /**
   * True only when this item genuinely comes from a primary source.
   *
   * Source tier alone cannot decide this. A tier-1 RSS feed IS the
   * institution publishing about itself. A tier-1 *discovery* source is a
   * query against an index, which returns whoever the index surfaced — on a
   * measured run, 14% of tier-1 items came from unrecognised publishers,
   * including a district police site surfaced by the OJK/IDX query. Grading
   * those as primary inflates exactly the evidence claim this product sells.
   */
  primary: boolean;
  /**
   * Readable body text, fetched for primary sources only.
   *
   * Reasoning input, never output: bodies live in `.cache/` with the
   * excerpts and are never written to `editions/` or rendered. See
   * lib/brief/deepen.ts.
   */
  body?: string;
}

/**
 * One of the day's five signals, structured as the reasoning ladder.
 *
 * A news summariser stops at `whatChanged`. The value of this product is
 * the three fields after it.
 */
export interface Signal {
  rank: number;
  domain: Domain;
  /**
   * Canonical theme slug, e.g. "ai-datacenter-project-finance".
   *
   * Lexical fingerprinting of headlines was measured at 0/10 recall on
   * realistic same-theme headlines written on different days — the words
   * simply do not repeat. Asking the model for a stable slug moves the
   * judgement ("is this the same story?") to the layer that can make it,
   * while the matching itself stays deterministic in code.
   */
  themeKey: string;
  /** One-line statement of the development. */
  headline: string;
  /** The fact. What is actually different today. */
  whatChanged: string;
  /** The pattern this fits and why it matters strategically. */
  whyItMatters: string;
  /** The effect that follows from the effect — what most coverage misses. */
  secondOrder: string;
  /** What the reader could actually do about it. */
  action: string;
  /**
   * Named entities this signal is about: companies, institutions, regulations.
   *
   * Every entity is checked against the signal's own text before publication
   * and dropped if it does not appear there. An index that lists something
   * the signal never mentions is worse than no index — and it is the kind of
   * thing a model will supply helpfully if nothing stops it.
   */
  entities: string[];
  strength: SignalStrength;
  /**
   * Sources supporting `whatChanged` — the fact.
   *
   * Corroboration is computed from these and only these. Citing a primary
   * source alongside a content farm previously lent the primary source's
   * authority to the whole signal, including a causal chain it never made:
   * a lab said "a two-week pause in RL training", an aggregator said "the AI
   * broke out of its sandbox", and the briefing published both as one claim.
   */
  sourceUrls: string[];
  /**
   * Sources supporting `secondOrder`, when that reasoning rests on published
   * evidence rather than on our own inference. Usually empty — and empty is
   * the honest default, because the second-order read is normally ours.
   */
  secondOrderUrls: string[];
  corroboration: Corroboration;
  trend: TrendInfo;
}

export interface WatchItem {
  item: string;
  dueDate?: string;
}

export interface SourceRef {
  title: string;
  publisher: string;
  url: string;
  publishedAt?: string;
  tier: SourceTier;
  via?: string;
  primary: boolean;
}

/** A theme the archive has seen repeatedly — the longitudinal view. */
export interface TrendSummary {
  themeKey: string;
  theme: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  status: TrendStatus;
  domain: Domain;
}

export interface EditionMeta {
  generatedAt: string;
  engineVersion: string;
  model: string;
  /** Sources fetched, by tier. */
  tierCounts: Record<SourceTier, number>;
  /** Items fetched before the candidate cut. */
  candidateCount: number;
  /** Items actually shown to the model. */
  poolSize: number;
}

export interface Edition {
  slug: string;
  date: string;
  lang: Lang;
  title: string;
  dek: string;
  domains: Domain[];
  summary: string;
  /** Exactly five, ranked. */
  signals: Signal[];
  watchNext: WatchItem[];
  sources: SourceRef[];
  /** Themes recurring across the archive, independent of today's five. */
  trends: TrendSummary[];
  meta: EditionMeta;
}

/** Registry entry in sources.radar.json. */
export interface RadarSource {
  id: string;
  /** Publisher name shown to readers in attribution. */
  name: string;
  type: SourceType;
  /**
   * rss             — feed URL
   * gnews           — search query
   * arxiv           — arXiv category, e.g. "cs.AI"
   * github-releases — "owner/repo"
   * hn              — Hacker News search query (empty for front page)
   */
  url: string;
  domain: Domain;
  tier: SourceTier;
  lang: Lang | "other";
  enabled?: boolean;
  useCurl?: boolean;
  /** Only keep items matching at least one keyword. Essential for broad feeds. */
  keywords?: string[];
  limit?: number;
  /** Minimum Hacker News points, for type "hn". */
  minPoints?: number;
  notes?: string;
}
