import Parser from "rss-parser";
import { curlFetch } from "../sources/curl-fetch";
import { byCredibilityThenRecency, publisherTier } from "./publishers";
import type { FeedItem, Lang, RadarSource, SourceTier } from "./types";

/**
 * Tier 1-3 retrieval.
 *
 * Six source types, because a radar restricted to what publishes RSS has a
 * blind spot it cannot detect. Anthropic, the IEA, IRENA, Reuters, IDX and
 * the BUMN ministry all publish no usable feed — verified, not assumed — and
 * between them they account for a large share of what a strategic reader
 * needs to know.
 *
 *   rss              a publisher's own feed
 *   gnews            topic-scoped discovery through a news index
 *   arxiv            preprints, via the official Atom API
 *   github-releases  release notes, via GitHub's per-repo Atom feed
 *   hn               Hacker News above a points threshold
 *
 * There is no live open-web search here. Tier-2 discovery runs on
 * topic-scoped index queries, which is a real limitation and is documented as
 * one — rather than carried as a source type that only ever throws.
 */

const parser = new Parser<Record<string, unknown>, Record<string, unknown>>({
  timeout: 20_000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; StrategicRadarBot/2.0)" },
  customFields: {
    // Google News encodes the originating publisher here. Without it every
    // discovered item would be attributed to "Google News", which is useless
    // attribution and would undermine the citation model.
    item: [["source", "gnewsSource", { keepArray: false }]],
  },
});

const CURL_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "application/atom+xml, application/rss+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
};

const GNEWS_LOCALE: Record<"id" | "en", string> = {
  id: "hl=id&gl=ID&ceid=ID:id",
  en: "hl=en-US&gl=US&ceid=US:en",
};

export const SOURCE_TIMEOUT_MS = Number(process.env.BRIEF_SOURCE_TIMEOUT_MS ?? 25_000);

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(v: unknown): Date | undefined {
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  // Feeds routinely emit unparseable dates. An Invalid Date propagates
  // silently until something calls toISOString on it.
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function gnewsUrl(query: string, lang: Lang): string {
  const loc = GNEWS_LOCALE[lang === "en" ? "en" : "id"];
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${loc}`;
}

export function arxivUrl(category: string, limit: number): string {
  const q = encodeURIComponent(`cat:${category}`);
  return `http://export.arxiv.org/api/query?search_query=${q}&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`;
}

export function githubReleasesUrl(repo: string): string {
  return `https://github.com/${repo}/releases.atom`;
}

export function hnUrl(query: string, minPoints: number): string {
  const q = query.trim();
  return q
    ? `https://hnrss.org/newest?q=${encodeURIComponent(q)}&points=${minPoints}`
    : `https://hnrss.org/frontpage?points=${minPoints}`;
}

/** Google News titles are "Real headline - Publisher". */
function splitGnewsTitle(title: string): { title: string; publisher?: string } {
  const idx = title.lastIndexOf(" - ");
  if (idx < 20) return { title };
  return { title: title.slice(0, idx).trim(), publisher: title.slice(idx + 3).trim() };
}

function readGnewsPublisher(item: Record<string, unknown>): string | undefined {
  const raw = item.gnewsSource;
  if (typeof raw === "string") return raw.trim() || undefined;
  if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    const text = rec._ ?? rec["#text"];
    if (typeof text === "string") return text.trim() || undefined;
  }
  return undefined;
}

function matchesKeywords(item: FeedItem, keywords?: string[]): boolean {
  if (!keywords || keywords.length === 0) return true;
  const hay = `${item.title} ${item.excerpt ?? ""}`.toLowerCase();
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}

/**
 * Hard per-source deadline. rss-parser's own timeout covers the HTTP request
 * but not DNS stalls or a host that trickles bytes forever, and a scheduled
 * job that can hang indefinitely is a job that silently stops publishing.
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms (${label})`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function parseFeed(url: string, useCurl?: boolean) {
  if (useCurl) return parser.parseString(await curlFetch(url, CURL_HEADERS, 25));
  return parser.parseURL(url);
}

function resolveUrl(source: RadarSource): string {
  switch (source.type) {
    case "gnews":
      return gnewsUrl(source.url, source.lang === "en" ? "en" : "id");
    case "arxiv":
      return arxivUrl(source.url, source.limit ?? 12);
    case "github-releases":
      return githubReleasesUrl(source.url);
    case "hn":
      return hnUrl(source.url, source.minPoints ?? 50);
    default:
      return source.url;
  }
}

/**
 * arXiv wraps titles and abstracts at ~80 columns, so an unprocessed title
 * reaches the model as three fragments. Collapse the wrapping.
 */
function unwrap(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").trim();
}

/**
 * Is this item genuinely from a primary source?
 *
 * A tier-1 RSS/arXiv/GitHub source IS the institution publishing about
 * itself, so anything it returns is primary. A tier-1 *discovery* source is
 * a query against an index: it returns whoever the index surfaced, so only
 * the publisher can decide. Conflating the two graded a district police
 * site as a primary source for a capital-markets claim.
 */
function isPrimary(source: RadarSource, publisher: string): boolean {
  const viaIndex = source.type === "gnews";
  if (!viaIndex) return source.tier === 1;
  return publisherTier(publisher) === 1;
}

function toFeedItem(raw: Record<string, unknown>, source: RadarSource): FeedItem {
  const rawTitle = String(raw.title ?? "").trim();
  const isGnews = source.type === "gnews";
  const split = isGnews ? splitGnewsTitle(rawTitle) : { title: rawTitle };

  let title = split.title;
  let excerpt = stripHtml(String(raw.contentSnippet ?? raw.content ?? raw.summary ?? ""));

  if (source.type === "arxiv") {
    title = unwrap(title);
    excerpt = unwrap(excerpt);
  }

  const publisher = isGnews
    ? (readGnewsPublisher(raw) ?? split.publisher ?? source.name)
    : source.name;

  return {
    sourceId: source.id,
    publisher,
    title,
    url: String(raw.link ?? raw.id ?? "").trim(),
    excerpt: excerpt.slice(0, 400) || undefined,
    publishedAt: parseDate(raw.isoDate ?? raw.pubDate ?? raw.updated ?? raw.published),
    domain: source.domain,
    tier: source.tier,
    lang: source.lang,
    via: isGnews ? "Google News" : undefined,
    primary: isPrimary(source, publisher),
  };
}

export async function fetchSource(source: RadarSource): Promise<FeedItem[]> {
  const feed = await parseFeed(resolveUrl(source), source.useCurl);
  const limit = source.limit ?? 20;

  return (feed.items ?? [])
    .map((raw) => toFeedItem(raw as Record<string, unknown>, source))
    .filter((it) => it.title && it.url)
    .filter((it) => matchesKeywords(it, source.keywords))
    .slice(0, limit);
}

/**
 * Near-duplicate collapse.
 *
 * The same story reaches us from a publisher feed, a discovery query, and
 * often a second query. Three copies would each consume a context slot and —
 * worse — inflate the apparent number of independent publishers behind a
 * claim, corrupting the corroboration count that tier 4 depends on.
 */
function dedupe(items: FeedItem[]): FeedItem[] {
  const byUrl = new Set<string>();
  const byTitle = new Set<string>();
  const out: FeedItem[] = [];
  for (const it of items) {
    const urlKey = it.url.split("?")[0].replace(/\/$/, "");
    const titleKey = it.title
      .toLowerCase()
      .replace(/[^a-z0-9À-ɏ ]/g, "")
      .split(/\s+/)
      .slice(0, 8)
      .join(" ");
    if (byUrl.has(urlKey) || (titleKey.length > 20 && byTitle.has(titleKey))) continue;
    byUrl.add(urlKey);
    byTitle.add(titleKey);
    out.push(it);
  }
  return out;
}

/**
 * Interleave across sources, best sources first.
 *
 * Straight credibility ordering lets one prolific tier-1 feed own the whole
 * candidate pool — measured on a real run, it filled the top twelve slots
 * with global solar coverage from a single trade publication. Bucketing by
 * source and round-robining gives every source a turn before any source gets
 * a second.
 */
function interleaveBySource(items: FeedItem[]): FeedItem[] {
  const buckets = new Map<string, FeedItem[]>();
  for (const it of items) {
    const arr = buckets.get(it.sourceId) ?? [];
    arr.push(it);
    buckets.set(it.sourceId, arr);
  }
  for (const arr of buckets.values()) arr.sort(byCredibilityThenRecency);
  const ordered = [...buckets.values()].sort((a, b) => byCredibilityThenRecency(a[0], b[0]));

  const out: FeedItem[] = [];
  for (let round = 0; out.length < items.length; round++) {
    let took = false;
    for (const bucket of ordered) {
      if (round < bucket.length) {
        out.push(bucket[round]);
        took = true;
      }
    }
    if (!took) break;
  }
  return out;
}

export interface FetchReport {
  items: FeedItem[];
  ok: string[];
  failed: { id: string; tier: SourceTier; error: string }[];
}

export async function fetchAll(sources: RadarSource[]): Promise<FetchReport> {
  const ok: string[] = [];
  const failed: { id: string; tier: SourceTier; error: string }[] = [];
  const all: FeedItem[] = [];

  const settled = await Promise.allSettled(
    sources.map((s) => withTimeout(fetchSource(s), SOURCE_TIMEOUT_MS, s.id)),
  );

  settled.forEach((res, i) => {
    const source = sources[i];
    const label = `T${source.tier} ${source.id}`.padEnd(28);
    if (res.status === "fulfilled") {
      ok.push(source.id);
      all.push(...res.value);
      console.log(`  ${label} ${String(res.value.length).padStart(3)}`);
    } else {
      const error = res.reason instanceof Error ? res.reason.message : String(res.reason);
      failed.push({ id: source.id, tier: source.tier, error });
      console.error(`  ${label} FAILED — ${error}`);
    }
  });

  return { items: interleaveBySource(dedupe(all)), ok, failed };
}
