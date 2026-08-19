import { test } from "node:test";
import assert from "node:assert/strict";

import { extractText, isDeepenable, trimBoilerplate } from "../lib/brief/deepen";
import { buildCandidates } from "../lib/brief/compose";
import type { FeedItem } from "../lib/brief/types";

/**
 * The evidence layer: which sources reach the model, and how much of them.
 *
 * Both rules here exist because the first real edition got them wrong — a
 * price-comparison site supplied the most dramatic sentence in the briefing,
 * and the day's most consequential fact sat unread in a primary source's
 * body.
 */

function item(over: Partial<FeedItem> & { publisher: string }): FeedItem {
  return {
    sourceId: "s",
    title: "t",
    url: "https://example.invalid/a",
    domain: "ai",
    tier: 2,
    lang: "en",
    primary: false,
    ...over,
  };
}

test("only primary sources on direct feeds are read in full", () => {
  assert.equal(
    isDeepenable(item({ publisher: "OpenAI", tier: 1, primary: true })),
    true,
    "a tier-1 direct feed is the institution publishing about itself",
  );
  assert.equal(
    isDeepenable(item({ publisher: "OpenAI", tier: 1, primary: true, via: "Google News" })),
    false,
    "an index redirect resolves through JavaScript; there is nothing to read",
  );
  assert.equal(
    isDeepenable(item({ publisher: "Reuters", tier: 2, primary: false })),
    false,
    "third-party articles are linked, not read",
  );
  assert.equal(
    isDeepenable(item({ publisher: "OpenAI", tier: 1, primary: false })),
    false,
  );
});

test("extractText drops scripts, styles and chrome", () => {
  const html = `
    <html><head><style>.a{color:red}</style><script>alert(1)</script></head>
    <body><nav>Home About</nav><p>The actual sentence.</p><footer>legal</footer></body></html>`;
  const text = extractText(html);
  assert.ok(text.includes("The actual sentence."));
  assert.ok(!text.includes("alert(1)"));
  assert.ok(!text.includes("color:red"));
  assert.ok(!text.includes("Home About"));
});

test("extractText decodes entities and collapses whitespace", () => {
  assert.equal(extractText("<p>a &amp; b &lt;c&gt;\n\n   d</p>"), "a & b <c> d");
});

test("known publishers fill the candidate pool ahead of the long tail", () => {
  // 120 known-publisher items, plus one content farm.
  const known = Array.from({ length: 120 }, (_, i) =>
    item({ publisher: "Reuters", url: `https://r.invalid/${i}` }),
  );
  const farm = item({ publisher: "finance.biggo.com", url: "https://farm.invalid/1" });
  const { pool } = buildCandidates([farm, ...known]);
  assert.ok(pool.length > 0);
  assert.ok(
    !pool.some((p) => p.publisher === "finance.biggo.com"),
    "an unrecognised publisher must not displace a known one",
  );
});

test("the long tail is held back, not banned — a thin day still gets a pool", () => {
  const few = Array.from({ length: 3 }, (_, i) =>
    item({ publisher: "Reuters", url: `https://r.invalid/${i}` }),
  );
  const tail = Array.from({ length: 5 }, (_, i) =>
    item({ publisher: "SomeBlog.co", url: `https://b.invalid/${i}` }),
  );
  const { pool } = buildCandidates([...few, ...tail]);
  assert.equal(pool.length, 8, "a smaller pool would hurt more than a weaker one");
  assert.equal(pool[0].publisher, "Reuters", "known publishers still come first");
});

test("candidate lines carry the body only where one was read", () => {
  const withBody = item({ publisher: "OpenAI", tier: 1, primary: true, body: "buried fact" });
  const without = item({ publisher: "Reuters", excerpt: "a summary" });
  const { lines } = buildCandidates([withBody, without]);
  assert.equal(lines[0].body, "buried fact");
  assert.equal(lines[1].body, undefined);
  assert.equal(lines[1].excerpt, "a summary");
});

test("trimBoilerplate spends the character budget on prose, not page furniture", () => {
  const title = "Pacing model development in an era of cyber-critical capabilities";
  // A publisher repeats its own title two or three times before the article.
  const text = `${title} | OpenAI OpenAI August 18, 2026 Company Publication ${title} Loading Share Over the past several weeks, two developments have underscored the growing risks.`;
  const out = trimBoilerplate(text, title);
  assert.ok(out.startsWith("Loading Share Over the past") || out.startsWith("Over the past"));
  assert.ok(!out.includes("August 18, 2026"), "the date line sat before the article");
  assert.ok(out.length < text.length);
});

test("trimBoilerplate leaves text alone when the title does not repeat", () => {
  const title = "A perfectly ordinary headline";
  const text = "A body that never restates its own headline anywhere at all.";
  assert.equal(trimBoilerplate(text, title), text);
});

test("trimBoilerplate refuses to gut a page it cannot parse", () => {
  const title = "Short";
  const text = "Short body.";
  assert.equal(trimBoilerplate(text, title), text, "a title too short to match is not a needle");
});

test("primary sources read in full lead the candidate pool", () => {
  // Round-robin across sources once pushed a full-text primary to position 73
  // of 110, where it competed with 72 headlines ahead of it.
  const filler = Array.from({ length: 40 }, (_, i) =>
    item({ publisher: "Reuters", url: `https://r.invalid/${i}` }),
  );
  const deep = item({
    publisher: "OpenAI",
    tier: 1,
    primary: true,
    url: "https://openai.com/x",
    body: "the buried fact",
  });
  const { pool } = buildCandidates([...filler, deep]);
  assert.equal(pool[0].url, "https://openai.com/x", "the read source must lead");
  assert.equal(pool.length, 41, "ordering must not drop anything");
});
