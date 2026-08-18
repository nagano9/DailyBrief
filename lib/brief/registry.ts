import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOMAINS, type Domain, type RadarSource, type SourceTier } from "./types";

/**
 * Loader + validator for sources.radar.json — the tiered source registry.
 *
 * Separate from lib/sources/registry.ts (the upstream tech/finance/politics
 * registry) so upstream merges never fight our taxonomy, and our tiers never
 * have to pretend to be someone else's categories.
 *
 * Validation is strict and throws at load. A registry that silently drops a
 * malformed tier-1 entry would publish a briefing missing a primary source
 * and report success — the worst available outcome.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, "../..", "sources.radar.json");

const VALID_TYPES = new Set(["rss", "gnews", "arxiv", "github-releases", "hn", "search"]);
const VALID_LANGS = new Set(["id", "en", "other"]);
const VALID_DOMAINS = new Set<string>(DOMAINS);
const VALID_TIERS = new Set([1, 2, 3]);

function validate(parsed: unknown): RadarSource[] {
  if (!Array.isArray(parsed)) {
    throw new Error(`${CONFIG_PATH}: top-level must be an array of sources`);
  }
  const seen = new Set<string>();
  parsed.forEach((raw, i) => {
    const s = raw as Record<string, unknown>;
    const at = `sources.radar.json[${i}]`;
    if (typeof s.id !== "string" || !s.id) throw new Error(`${at}: missing string 'id'`);
    if (seen.has(s.id)) throw new Error(`${at}: duplicate id '${s.id}'`);
    seen.add(s.id);
    const who = `${at} (${s.id})`;

    if (typeof s.name !== "string" || !s.name) {
      throw new Error(`${who}: missing 'name' — this is the publisher shown in attribution`);
    }
    if (!VALID_TYPES.has(s.type as string)) {
      throw new Error(`${who}: 'type' must be one of ${[...VALID_TYPES].join(" | ")}, got '${String(s.type)}'`);
    }
    // An empty url is meaningful for "hn": it selects the front page rather
    // than a search query. Everywhere else it is a missing field.
    if (typeof s.url !== "string" || (!s.url && s.type !== "hn")) {
      throw new Error(
        `${who}: missing 'url' (feed URL for rss; query for gnews/search; empty or query for hn; category for arxiv; owner/repo for github-releases)`,
      );
    }
    if (!VALID_DOMAINS.has(s.domain as string)) {
      throw new Error(`${who}: 'domain' must be one of ${DOMAINS.join(" | ")}, got '${String(s.domain)}'`);
    }
    if (!VALID_TIERS.has(s.tier as number)) {
      throw new Error(`${who}: 'tier' must be 1, 2, or 3, got '${String(s.tier)}'`);
    }
    if (!VALID_LANGS.has(s.lang as string)) {
      throw new Error(`${who}: 'lang' must be "id" | "en" | "other", got '${String(s.lang)}'`);
    }
    if (s.type === "github-releases" && !/^[\w.-]+\/[\w.-]+$/.test(s.url as string)) {
      throw new Error(`${who}: github-releases 'url' must be "owner/repo", got '${String(s.url)}'`);
    }
    if (s.type === "arxiv" && !/^[a-z-]+\.[A-Z]{2}$/.test(s.url as string)) {
      throw new Error(`${who}: arxiv 'url' must be a category like "cs.AI", got '${String(s.url)}'`);
    }
    if (s.keywords !== undefined) {
      if (!Array.isArray(s.keywords) || s.keywords.some((k) => typeof k !== "string")) {
        throw new Error(`${who}: 'keywords' must be an array of strings`);
      }
    }
    if (s.limit !== undefined && (typeof s.limit !== "number" || s.limit < 1)) {
      throw new Error(`${who}: 'limit' must be a positive number`);
    }
    if (s.minPoints !== undefined && (typeof s.minPoints !== "number" || s.minPoints < 0)) {
      throw new Error(`${who}: 'minPoints' must be a non-negative number`);
    }
  });

  const sources = parsed as RadarSource[];

  // A radar with no tier-1 source in a domain is not a radar for that domain,
  // it is a rumour mill. Catch that at load rather than in the output.
  for (const domain of DOMAINS) {
    const active = sources.filter((s) => s.enabled !== false && s.domain === domain);
    if (active.length === 0) {
      throw new Error(`sources.radar.json: no enabled source for domain '${domain}'`);
    }
    if (!active.some((s) => s.tier === 1)) {
      throw new Error(
        `sources.radar.json: domain '${domain}' has no enabled tier-1 (must-monitor) source`,
      );
    }
  }
  return sources;
}

export function loadRadarSources(): RadarSource[] {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Source registry missing: ${CONFIG_PATH}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (e) {
    throw new Error(`Invalid JSON in ${CONFIG_PATH}: ${(e as Error).message}`);
  }
  return validate(parsed);
}

export function enabledSources(): RadarSource[] {
  return loadRadarSources().filter((s) => s.enabled !== false);
}

/** Ids of tier-1 must-monitor sources — used by the corroboration check. */
export function primarySourceIds(): Set<string> {
  return new Set(enabledSources().filter((s) => s.tier === 1).map((s) => s.id));
}

export function countByTier(sources: RadarSource[]): Record<SourceTier, number> {
  const out: Record<SourceTier, number> = { 1: 0, 2: 0, 3: 0 };
  for (const s of sources) out[s.tier]++;
  return out;
}

export function countByDomain(sources: RadarSource[]): Record<Domain, number> {
  const out = {} as Record<Domain, number>;
  for (const d of DOMAINS) out[d] = 0;
  for (const s of sources) out[s.domain]++;
  return out;
}
