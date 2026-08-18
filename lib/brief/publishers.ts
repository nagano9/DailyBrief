/**
 * Publisher credibility, and the ordering rule for the candidate pool.
 *
 * Two different things are called "tier" here, deliberately kept apart:
 *
 *   source tier     — where the SOURCE sits in the radar architecture
 *                     (1 must-monitor, 2 discovery, 3 emerging). Declared in
 *                     sources.radar.json; known before fetching.
 *   publisher tier  — how authoritative the PUBLISHER of an individual item
 *                     is. Only knowable after fetching, because discovery
 *                     returns whoever the index happened to surface.
 *
 * A tier-2 discovery query can return a Reuters piece or a regional content
 * farm rewriting one. Source tier cannot tell them apart; publisher tier can.
 *
 * Publisher tiers are about *verifiability*, not editorial agreement:
 *   1 — primary sources and specialist analysis: a lab announcing its own
 *       model, a regulator publishing its own decision, an institution
 *       publishing its own research.
 *   2 — established outlets with a masthead, a corrections policy, and staff
 *       reporters on this beat.
 *   3 — everything else. Not banned, just last in line.
 *
 * A denylist would be the wrong tool: the long tail is effectively infinite
 * and a new domain appears every week. The candidate pool is capped, so
 * ranking pushes the tail below the cut without anyone maintaining one.
 *
 * Matching is case-insensitive substring against the publisher name as it
 * arrives, so "Kompas.com" and "Kompas TV" both match "kompas".
 */

/** Primary sources and specialist analysis. */
const TIER_1 = [
  // AI labs and platforms, publishing about themselves
  "openai",
  "anthropic",
  "google deepmind",
  "deepmind",
  "hugging face",
  "meta ai",
  "microsoft research",
  "nvidia",
  "mistral",
  "allen institute",
  // Technical primary material
  "arxiv",
  "vllm",
  "transformers",
  "langchain",
  "model context protocol",
  // Indonesian government and state entities
  "kementerian esdm",
  "esdm",
  "pln",
  "skk migas",
  "bphmigas",
  "bph migas",
  "kementerian bumn",
  "danantara",
  "otoritas jasa keuangan",
  "bursa efek indonesia",
  "kementerian investasi",
  "bkpm",
  "bappenas",
  "kementerian keuangan",
  "badan pusat statistik",
  "setkab",
  "sekretariat kabinet",
  // Energy and climate institutions
  "iesr",
  "institute for essential services reform",
  "ieefa",
  "institute for energy economics",
  "ember",
  "carbon brief",
  "pv magazine",
  "bloombergnef",
  "international energy agency",
  "us eia",
  "u.s. energy information",
  "irena",
  "world bank",
  "asian development bank",
  "wood mackenzie",
  "rystad",
  "s&p global",
  "petromindo",
  "argus media",
];

/** Established general and business outlets covering these beats. */
const TIER_2 = [
  // Indonesia
  "antara",
  "kompas",
  "tempo",
  "katadata",
  "kontan",
  "cnbc indonesia",
  "cnn indonesia",
  "bisnis.com",
  "bisnis indonesia",
  "detikfinance",
  "detiknews",
  "detikinet",
  "detikcom",
  "investor.id",
  "jakarta post",
  "jakarta globe",
  "media indonesia",
  "republika",
  "mongabay",
  "eco-business",
  "the conversation",
  // International
  "reuters",
  "bloomberg",
  "financial times",
  "wall street journal",
  "the information",
  "nikkei",
  "channel news asia",
  "straits times",
  "associated press",
  "agence france",
  "the economist",
  "the diplomat",
  "bbc",
  "guardian",
  "techcrunch",
  "ars technica",
  "wired",
  "the verge",
  "ieee spectrum",
  "mit technology review",
  "hacker news",
];

export type PublisherTier = 1 | 2 | 3;

function matches(publisher: string, list: string[]): boolean {
  const p = publisher.toLowerCase();
  return list.some((name) => p.includes(name));
}

export function publisherTier(publisher: string): PublisherTier {
  if (matches(publisher, TIER_1)) return 1;
  if (matches(publisher, TIER_2)) return 2;
  return 3;
}

interface Rankable {
  publisher: string;
  publishedAt?: Date;
  /** Source tier from the registry. */
  tier?: number;
}

/**
 * Order for the candidate pool: source tier, then publisher tier, then recency.
 *
 * Source tier leads because a must-monitor source earned its place by
 * editorial decision, whereas publisher tier is a heuristic over a name.
 * Recency only breaks ties — sorting by it first put a same-day rewrite from
 * an unknown domain above a regulator's own announcement that morning.
 */
export function byCredibilityThenRecency(a: Rankable, b: Rankable): number {
  const sourceTierDelta = (a.tier ?? 2) - (b.tier ?? 2);
  if (sourceTierDelta !== 0) return sourceTierDelta;
  const pubTierDelta = publisherTier(a.publisher) - publisherTier(b.publisher);
  if (pubTierDelta !== 0) return pubTierDelta;
  return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
}
