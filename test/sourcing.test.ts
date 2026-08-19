import { test } from "node:test";
import assert from "node:assert/strict";

import { byCredibilityThenRecency, publisherTier } from "../lib/brief/publishers";
import { arxivUrl, githubReleasesUrl, gnewsUrl, hnUrl } from "../lib/brief/fetch";
import { enabledSources, countByTier, countByDomain, loadRadarSources } from "../lib/brief/registry";
import {
  aboutPath,
  archivePath,
  editionPath,
  feedPath,
  formatDate,
  homePath,
  whatsappLabel,
  whatsappUrl,
} from "../lib/site/render";
import { DOMAINS } from "../lib/brief/types";

/** Publisher tiering, URL construction, registry invariants, routing. */

test("publisherTier recognises institutions publishing about themselves", () => {
  assert.equal(publisherTier("OpenAI"), 1);
  assert.equal(publisherTier("Kementerian ESDM"), 1);
  assert.equal(publisherTier("IESR"), 1);
});

test("publisherTier recognises established outlets", () => {
  assert.equal(publisherTier("Reuters"), 2);
  assert.equal(publisherTier("Kompas.com"), 2);
  assert.equal(publisherTier("CNBC Indonesia"), 2);
});

test("publisherTier leaves the long tail last rather than banning it", () => {
  // The exact domains a discovery query surfaced on a real run.
  assert.equal(publisherTier("tribratanews.sumsel.polri.go.id"), 3);
  assert.equal(publisherTier("PusaranMedia.com"), 3);
});

test("publisher matching is case-insensitive and substring-based", () => {
  assert.equal(publisherTier("KOMPAS TV"), publisherTier("Kompas.com"));
});

test("ordering puts source tier first, then publisher, then recency", () => {
  const older = new Date("2026-08-01");
  const newer = new Date("2026-08-18");
  const t1Old = { publisher: "OpenAI", tier: 1, publishedAt: older };
  const t2New = { publisher: "Reuters", tier: 2, publishedAt: newer };
  assert.ok(
    byCredibilityThenRecency(t1Old, t2New) < 0,
    "a must-monitor source outranks a newer discovery item",
  );

  const knownPub = { publisher: "Reuters", tier: 2, publishedAt: older };
  const unknownPub = { publisher: "SomeBlog.co", tier: 2, publishedAt: newer };
  assert.ok(
    byCredibilityThenRecency(knownPub, unknownPub) < 0,
    "within a tier, an established publisher outranks a newer unknown one",
  );

  const a = { publisher: "Reuters", tier: 2, publishedAt: newer };
  const b = { publisher: "Reuters", tier: 2, publishedAt: older };
  assert.ok(byCredibilityThenRecency(a, b) < 0, "recency breaks the remaining tie");
});

test("gnewsUrl encodes the query and scopes it to the locale", () => {
  const u = gnewsUrl(`"PLN" OR RUPTL`, "id");
  assert.ok(u.startsWith("https://news.google.com/rss/search?q="));
  assert.ok(u.includes("hl=id&gl=ID&ceid=ID:id"));
  assert.ok(!u.includes('"'), "the query must be percent-encoded");
  assert.ok(gnewsUrl("x", "en").includes("hl=en-US"));
});

test("arxivUrl requests the newest entries for a category", () => {
  const u = arxivUrl("cs.AI", 12);
  assert.ok(u.includes("search_query=cat%3Acs.AI"));
  assert.ok(u.includes("sortBy=submittedDate"));
  assert.ok(u.includes("max_results=12"));
});

test("githubReleasesUrl targets the per-repo atom feed", () => {
  assert.equal(githubReleasesUrl("vllm-project/vllm"), "https://github.com/vllm-project/vllm/releases.atom");
});

test("hnUrl falls back to the front page when there is no query", () => {
  // hnrss search proxies Algolia and 502s under sustained use; the front page
  // is the reliable endpoint, so an empty query must route there.
  assert.ok(hnUrl("", 100).startsWith("https://hnrss.org/frontpage?"));
  assert.ok(hnUrl("", 100).includes("points=100"));
  assert.ok(hnUrl("ai agent", 80).includes("/newest?q=ai%20agent"));
});

test("the shipped registry loads and satisfies its own invariants", () => {
  const all = loadRadarSources();
  assert.ok(all.length > 0);
  const ids = all.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "source ids must be unique");
});

test("every domain has an enabled must-monitor source", () => {
  const active = enabledSources();
  for (const domain of DOMAINS) {
    const inDomain = active.filter((s) => s.domain === domain);
    assert.ok(inDomain.length > 0, `${domain} has no enabled source`);
    assert.ok(inDomain.some((s) => s.tier === 1), `${domain} has no tier-1 source`);
  }
});

test("the registry spans all three tiers", () => {
  const t = countByTier(enabledSources());
  assert.ok(t[1] > 0 && t[2] > 0 && t[3] > 0, `tiers unbalanced: ${JSON.stringify(t)}`);
});

test("domain counts sum to the enabled source count", () => {
  const active = enabledSources();
  const d = countByDomain(active);
  assert.equal(d.ai + d.energy + d.corporate, active.length);
});

test("routes differ per language and never collide", () => {
  const paths = [
    editionPath("id", "2026-08-18"),
    editionPath("en", "2026-08-18"),
    homePath("id"),
    homePath("en"),
    archivePath("id"),
    archivePath("en"),
    aboutPath("id"),
    aboutPath("en"),
    feedPath("id"),
    feedPath("en"),
  ];
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.filter((p) => p !== "/").every((p) => p.startsWith("/")));
});

test("formatDate is localised and degrades to the raw string when malformed", () => {
  assert.equal(formatDate("2026-08-18", "id"), "18 Agustus 2026");
  assert.equal(formatDate("2026-08-18", "en"), "18 August 2026");
  assert.equal(formatDate("not-a-date", "id"), "not-a-date");
});

test("whatsappUrl accepts every way a number gets written", () => {
  // wa.me takes international digits only, and fails silently on the rest —
  // the link would look right and go nowhere.
  const expected = "https://wa.me/6281393000399";
  for (const written of [
    "6281393000399",
    "+6281393000399",
    "+62 813 9300 0399",
    "0813-9300-0399",
    "62 813-9300-0399",
  ]) {
    assert.equal(whatsappUrl(written), expected, `failed for ${written}`);
  }
});

test("whatsappLabel shows the number as a person would read it", () => {
  assert.equal(whatsappLabel("0813-9300-0399"), "+6281393000399");
  assert.equal(whatsappLabel("+6281393000399"), "+6281393000399");
});

test("an unset contact yields no link rather than a broken one", () => {
  assert.equal(whatsappUrl(""), "");
  assert.equal(whatsappUrl("not a number"), "");
  assert.equal(whatsappLabel(""), "");
});
