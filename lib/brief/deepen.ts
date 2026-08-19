import { curlFetch } from "../sources/curl-fetch";
import type { FeedItem } from "./types";

/**
 * Read the body of primary sources.
 *
 * The candidate pool carries titles and a short excerpt. That was enough
 * until the first real edition showed what it costs: OpenAI's own post
 * announced that an upcoming model "may meet the Critical cybersecurity
 * capability threshold under our Preparedness Framework" — a frontier lab
 * publicly flagging that its next model may cross a Critical threshold, and
 * the single most consequential fact available that day. It sat in the body.
 * The engine could not see it, so the briefing led with the incident story
 * instead and never mentioned it.
 *
 * No prompt change fixes that. The model cannot weigh a fact it was never
 * shown.
 *
 * Scope is deliberately narrow:
 *
 * - **Tier 1 direct feeds only.** These are institutions publishing about
 *   themselves — a lab's announcement, a regulator's decision. That is where
 *   a buried fact is most likely to matter and least likely to be
 *   third-party content.
 * - **Never index redirects.** A Google News URL resolves through a
 *   JavaScript interstitial, so there is nothing to read, and the
 *   destination is somebody else's article.
 * - **Never published.** Bodies are reasoning input. They live in `.cache/`
 *   with the excerpts and never reach `editions/` or the site. The product
 *   still states its own analysis and links out.
 */

const BODY_CHARS = Number(process.env.BRIEF_BODY_CHARS ?? 2500);
const DEEPEN_TIMEOUT_MS = Number(process.env.BRIEF_DEEPEN_TIMEOUT_MS ?? 15_000);
/** How many primary sources to read per run. */
const DEEPEN_LIMIT = Number(process.env.BRIEF_DEEPEN_LIMIT ?? 20);

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
};

/**
 * Pull readable prose out of a page without a DOM library.
 *
 * Deliberately crude: strip the non-content elements, drop tags, collapse
 * whitespace. A real extractor would be better, but it would also be a
 * dependency and a maintenance surface, and the model only needs enough
 * context to notice a buried fact — not a faithful reproduction.
 */
export function extractText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|header|footer|form)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Which items are worth reading in full. */
export function isDeepenable(item: FeedItem): boolean {
  return item.tier === 1 && item.primary && !item.via && item.url.startsWith("http");
}

/**
 * Drop the page furniture that precedes the article.
 *
 * A publisher's page repeats its own title two or three times before the
 * first sentence — tab title, masthead, headline — plus a date line and a
 * share widget. Measured on one OpenAI post that came to 118 characters of
 * the budget before any prose. Cutting to the last repetition of the title
 * spends the budget on content instead.
 */
export function trimBoilerplate(text: string, title: string): string {
  const needle = title.slice(0, 40).trim();
  if (needle.length < 12) return text;
  const head = text.slice(0, 600);
  const last = head.lastIndexOf(needle);
  if (last <= 0) return text;
  // Advance past the WHOLE title, not just the 40-character needle used to
  // find it — otherwise the cut lands mid-word and leaves the title's tail
  // glued to the first sentence.
  const cut = last + (text.startsWith(title, last) ? title.length : needle.length);
  return text.slice(cut).replace(/^[\s|·—-]+/, "").trim() || text;
}

async function readBody(url: string, title: string): Promise<string | undefined> {
  const html = await curlFetch(url, HEADERS, Math.ceil(DEEPEN_TIMEOUT_MS / 1000));
  const text = trimBoilerplate(extractText(html), title);
  // Below a few hundred characters we got a cookie wall or a JS shell, not an
  // article. Passing that to the model adds noise and no signal.
  return text.length > 400 ? text.slice(0, BODY_CHARS) : undefined;
}

export interface DeepenReport {
  read: number;
  skipped: number;
  failed: number;
}

/**
 * Attach `body` to the primary-source items in `items`, in place.
 *
 * Failures are non-fatal by design: a briefing built from titles is worse
 * than one built from bodies, but far better than no briefing.
 */
export async function deepenPrimarySources(items: FeedItem[]): Promise<DeepenReport> {
  const targets = items.filter(isDeepenable).slice(0, DEEPEN_LIMIT);
  if (targets.length === 0) return { read: 0, skipped: items.length, failed: 0 };

  console.log(`[deepen] reading ${targets.length} primary sources…`);
  const results = await Promise.allSettled(targets.map((it) => readBody(it.url, it.title)));

  let read = 0;
  let failed = 0;
  results.forEach((res, i) => {
    if (res.status === "fulfilled" && res.value) {
      targets[i].body = res.value;
      read++;
    } else {
      failed++;
    }
  });

  console.log(`[deepen] ${read} read, ${failed} unavailable`);
  return { read, skipped: items.length - targets.length, failed };
}
