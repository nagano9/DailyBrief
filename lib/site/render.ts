import { DOMAIN_LABELS, type Edition, type Lang, type Signal } from "../brief/types";
import { STRINGS } from "./strings";

/**
 * Static site renderer.
 *
 * No framework, no build step, no external assets — consistent with the
 * project's standing rule that output is self-contained HTML. That is also
 * what lets the published archive outlive any particular host: these pages
 * work off a filesystem, a CDN, GitHub Pages, or an object store unchanged.
 *
 * Every page carries the metadata a reference product needs: canonical URL,
 * hreflang pairing between the two language editions, OpenGraph, and JSON-LD
 * `NewsArticle` whose `citation` array holds the real source URLs. That last
 * part is what makes an edition machine-verifiable rather than merely
 * readable.
 */

export interface SiteConfig {
  /** Absolute origin, no trailing slash. e.g. https://radar.example.com */
  siteUrl: string;
  /** Sub-path when not hosted at origin root, e.g. "/DailyBrief". No trailing slash. */
  basePath: string;
  siteName: string;
  /** POST target for the subscribe form. Empty disables the form. */
  subscribeEndpoint: string;
  /**
   * Languages actually present in this build.
   *
   * When only one composes — a normal failure mode, since each language is a
   * separate model call — the site must not advertise the other. Emitting a
   * nav link and an hreflang alternate to a tree that was never written gives
   * readers a 404 and search engines an invalid alternate.
   */
  languages: Lang[];
  /** Privacy policy URL. Required before the subscribe form will render. */
  privacyUrl: string;
}

/**
 * Serialise a value for embedding inside a `<script type="application/ld+json">`
 * block.
 *
 * `JSON.stringify` does not escape `<` or `>`, so a source title containing
 * `</script><script>…` closes our tag and opens the attacker's. Verified
 * executing in a browser before this fix: a feed title is third-party input,
 * and discovery surfaces arbitrary domains, so this was reachable in normal
 * operation rather than only under a crafted attack.
 *
 * Escaping the angle brackets to their \u escape form keeps the JSON
 * semantically identical — a parser reads back the same string — while making
 * tag-breakout impossible. U+2028 and U+2029 are escaped too: valid in JSON,
 * but line terminators in JavaScript.
 */
function jsonLdScript(value: unknown): string {
  const json = JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
  return `<script type="application/ld+json">${json}</script>`;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Root-relative URL honouring basePath, so project-scoped hosting works. */
export function url(cfg: SiteConfig, p: string): string {
  const clean = p.startsWith("/") ? p : `/${p}`;
  return `${cfg.basePath}${clean}`;
}

export function absUrl(cfg: SiteConfig, p: string): string {
  return `${cfg.siteUrl}${url(cfg, p)}`;
}

export function editionPath(lang: Lang, date: string): string {
  return lang === "id" ? `/edisi/${date}/` : `/en/edition/${date}/`;
}

export function homePath(lang: Lang): string {
  return lang === "id" ? "/" : "/en/";
}

export function archivePath(lang: Lang): string {
  return lang === "id" ? "/arsip/" : "/en/archive/";
}

export function feedPath(lang: Lang): string {
  return lang === "id" ? "/feed.xml" : "/en/feed.xml";
}

const MONTHS: Record<Lang, string[]> = {
  id: ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"],
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
};

export function formatDate(date: string, lang: Lang): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return lang === "id" ? `${d} ${MONTHS.id[m - 1]} ${y}` : `${d} ${MONTHS.en[m - 1]} ${y}`;
}

const CSS = `
:root{color-scheme:light dark;
--paper:#fbfaf8;--ink:#16181d;--muted:#5c6270;--rule:#e5e2dc;--card:#ffffff;
--accent:#0d5c4d;--accent-soft:#e6f1ee;
--ai:#3b4f9e;--energy:#0d5c4d;--corporate:#7a3f6d;
--structural:#a13224;--recurring:#8a5f18;}
@media (prefers-color-scheme:dark){:root{
--paper:#101215;--ink:#e8e6e1;--muted:#98a0ac;--rule:#262a31;--card:#171a1f;
--accent:#57bda6;--accent-soft:#122b26;
--ai:#8fa2ea;--energy:#57bda6;--corporate:#c78fb8;
--structural:#e08272;--recurring:#d9a441;}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);
font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
font-feature-settings:"kern","liga";}
a{color:inherit}
.wrap{max-width:44rem;margin:0 auto;padding:0 1.5rem}
.wrap-wide{max-width:56rem;margin:0 auto;padding:0 1.5rem}

header.site{border-bottom:1px solid var(--rule);padding:1.1rem 0;margin-bottom:2.5rem}
header.site .row{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.brand{font-family:Georgia,"Iowan Old Style","Times New Roman",serif;font-size:1.18rem;
font-weight:600;letter-spacing:-.01em;text-decoration:none}
.brand span{color:var(--accent)}
nav.site{display:flex;gap:1.25rem;font-size:.85rem;color:var(--muted)}
nav.site a{text-decoration:none}
nav.site a:hover{color:var(--accent)}

h1,h3{font-family:Georgia,"Iowan Old Style","Times New Roman",serif;
letter-spacing:-.015em;line-height:1.24;margin:0}
h1{font-size:2.05rem;font-weight:600}
h2{font-size:.82rem;font-weight:600;text-transform:uppercase;letter-spacing:.09em;
color:var(--muted);margin:2.8rem 0 1rem;padding-bottom:.4rem;
border-bottom:1px solid var(--rule)}
h3{font-size:1.12rem;font-weight:600}
p{margin:0 0 1rem}
.dek{font-size:1.14rem;line-height:1.5;color:var(--muted);margin:.85rem 0 0}
.meta{font-size:.82rem;color:var(--muted);display:flex;gap:.6rem;align-items:center;
flex-wrap:wrap;margin-top:1.1rem}

.badge{display:inline-block;font-size:.68rem;font-weight:600;letter-spacing:.06em;
text-transform:uppercase;padding:.18rem .5rem;border-radius:3px;white-space:nowrap}
.badge.free{background:var(--accent-soft);color:var(--accent)}
.dom{font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;
padding:.18rem .5rem;border-radius:3px;border:1px solid currentColor;white-space:nowrap}
.dom.ai{color:var(--ai)}.dom.energy{color:var(--energy)}.dom.corporate{color:var(--corporate)}
.trend{font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;
padding:.18rem .5rem;border-radius:3px;border:1px solid currentColor;white-space:nowrap;color:var(--muted)}
.trend.structural{color:var(--structural)}
.trend.recurring{color:var(--recurring)}

/* signal cards — the reasoning ladder */
.signal{border-top:1px solid var(--rule);padding:1.6rem 0}
.signal:first-of-type{border-top:0;padding-top:.5rem}
.signal .head{display:flex;gap:.75rem;align-items:baseline;margin-bottom:.5rem}
.signal .rank{font-family:Georgia,serif;font-size:1.6rem;line-height:1;color:var(--muted);
flex:none;min-width:1.4rem}
.signal .tags{display:flex;gap:.4rem;flex-wrap:wrap;margin:.55rem 0 1rem}
.rung{display:grid;grid-template-columns:8.5rem 1fr;gap:.9rem;padding:.55rem 0;
border-top:1px dotted var(--rule)}
.rung:first-of-type{border-top:0}
.rung dt{font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.07em;
color:var(--muted);padding-top:.22rem}
.rung dd{margin:0}
.rung.act dd{font-weight:600}
dl.ladder{margin:0}
.corrob{font-size:.78rem;color:var(--muted);margin-top:.8rem;
display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
.corrob .thin{color:var(--structural)}
.cites a{color:var(--accent);text-decoration:none;margin-right:.45rem;font-size:.78rem}
.cites a:hover{text-decoration:underline}

ul.plain{padding-left:1.15rem;margin:0}
ul.plain li{margin-bottom:.55rem}

/* trends */
.trend-row{display:flex;gap:.75rem;align-items:flex-start;padding:.65rem 0;
border-bottom:1px solid var(--rule)}
.trend-row:last-child{border-bottom:0}
.trend-row .n{font-size:.78rem;color:var(--muted);white-space:nowrap;padding-top:.15rem}

background:var(--card);border-radius:4px;padding:1.25rem 1.4rem;margin-top:1rem}
.btn{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;
font-size:.88rem;font-weight:600;padding:.6rem 1.1rem;border-radius:4px;border:0;cursor:pointer}
.btn:hover{opacity:.9}

ol.sources{padding-left:1.4rem;margin:0;font-size:.9rem}
ol.sources li{margin-bottom:.6rem}
ol.sources a{color:inherit;text-decoration:none}
ol.sources a:hover{color:var(--accent);text-decoration:underline}
ol.sources .pub{color:var(--muted);font-size:.82rem}
.note{font-size:.85rem;color:var(--muted);margin-bottom:1rem}

.lede{border-bottom:1px solid var(--rule);padding-bottom:2rem;margin-bottom:2rem}
.lede h1 a{text-decoration:none}
.lede h1 a:hover{color:var(--accent)}
.cards{display:grid;gap:1px;background:var(--rule);border:1px solid var(--rule);
border-radius:4px;overflow:hidden}
.card{background:var(--paper);padding:1.1rem 1.25rem}
.card a{text-decoration:none}
.card h3{margin-bottom:.35rem;font-size:1rem}
.card h3 a:hover{color:var(--accent)}
.card .d{font-size:.78rem;color:var(--muted)}
.card p{font-size:.9rem;color:var(--muted);margin:.4rem 0 0}

.sub{background:var(--card);border:1px solid var(--rule);border-radius:4px;
padding:1.5rem;margin:3rem 0}
.sub h3{margin-bottom:.4rem}
.sub p{color:var(--muted);font-size:.9rem;margin-bottom:1rem}
.sub form{display:flex;gap:.5rem;flex-wrap:wrap}
.sub input{flex:1 1 15rem;padding:.6rem .8rem;border:1px solid var(--rule);
border-radius:4px;background:var(--paper);color:var(--ink);font-size:.9rem;font-family:inherit}
.sub input:focus{outline:2px solid var(--accent);outline-offset:1px}
.consent{flex:1 1 100%;display:flex;gap:.5rem;align-items:flex-start;
font-size:.8rem;color:var(--muted);margin-top:.2rem}
.consent input{flex:none;width:auto;margin-top:.25rem}
.consent a{color:var(--accent)}

table.arch{width:100%;border-collapse:collapse;font-size:.92rem}
table.arch td{padding:.7rem 0;border-bottom:1px solid var(--rule);vertical-align:top}
table.arch td.d{white-space:nowrap;color:var(--muted);font-size:.82rem;width:8.5rem;padding-right:1rem}
table.arch a{text-decoration:none}
table.arch a:hover{color:var(--accent)}

footer.site{border-top:1px solid var(--rule);margin-top:4rem;padding:2rem 0 3rem;
font-size:.82rem;color:var(--muted)}
footer.site p{margin:0 0 .6rem}
footer.site a{color:var(--accent)}
@media(max-width:34rem){h1{font-size:1.7rem}.wrap,.wrap-wide{padding:0 1.15rem}
.rung{grid-template-columns:1fr;gap:.2rem}}
`.trim();

interface PageOpts {
  cfg: SiteConfig;
  lang: Lang;
  title: string;
  description: string;
  path: string;
  altPath?: string;
  jsonLd?: unknown;
  wide?: boolean;
  body: string;
}

function page(o: PageOpts): string {
  const { cfg, lang } = o;
  const s = STRINGS[lang];
  const other: Lang = lang === "id" ? "en" : "id";
  const canonical = absUrl(cfg, o.path);
  const hasOther = cfg.languages.includes(other);
  const alt = o.altPath ? absUrl(cfg, o.altPath) : absUrl(cfg, homePath(other));

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="alternate" hreflang="${lang}" href="${esc(canonical)}">
${hasOther ? `<link rel="alternate" hreflang="${other}" href="${esc(alt)}">` : ""}
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.siteName)}" href="${esc(url(cfg, feedPath(lang)))}">
<meta property="og:type" content="${o.jsonLd ? "article" : "website"}">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="${lang === "id" ? "id_ID" : "en_US"}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.description)}">
${o.jsonLd ? jsonLdScript(o.jsonLd) : ""}
<style>${CSS}</style>
</head>
<body>
<header class="site"><div class="${o.wide ? "wrap-wide" : "wrap"}"><div class="row">
<a class="brand" href="${esc(url(cfg, homePath(lang)))}">${esc(cfg.siteName)}<span>.</span></a>
<nav class="site">
<a href="${esc(url(cfg, archivePath(lang)))}">${esc(s.archive)}</a>
<a href="${esc(url(cfg, feedPath(lang)))}">RSS</a>
${hasOther ? `<a href="${esc(url(cfg, o.altPath ?? homePath(other)))}">${esc(s.otherLang)}</a>` : ""}
</nav></div></div></header>
<main class="${o.wide ? "wrap-wide" : "wrap"}">
${o.body}
</main>
<footer class="site"><div class="${o.wide ? "wrap-wide" : "wrap"}">
<p><strong>${esc(s.methodology)}.</strong> ${esc(s.methodologyBody)}</p>
<p>${esc(s.disclaimer)}</p>
<p>&copy; ${new Date().getFullYear()} ${esc(cfg.siteName)}</p>
</div></footer>
</body>
</html>`;
}

function subscribeBlock(cfg: SiteConfig, lang: Lang): string {
  const s = STRINGS[lang];
  // No endpoint, or no privacy policy, means no form. Collecting an address
  // without recorded consent and a stated purpose is not something to ship
  // and fix later — UU PDP treats consent as a precondition, not a nicety.
  const canCollect = cfg.subscribeEndpoint && cfg.privacyUrl;
  const form = canCollect
    ? `<form method="post" action="${esc(cfg.subscribeEndpoint)}">
<input type="email" name="email" required placeholder="${esc(s.subscribePlaceholder)}" aria-label="Email">
<input type="hidden" name="lang" value="${lang}">
<button class="btn" type="submit">${esc(s.subscribeButton)}</button>
<label class="consent"><input type="checkbox" name="consent" value="yes" required>
<span>${esc(s.consentLabel)} <a href="${esc(cfg.privacyUrl)}" rel="noopener">${esc(s.privacyPolicy)}</a>.</span></label>
</form>`
    : `<p class="note">${esc(s.subscribeSoon)}</p>`;
  return `<section class="sub">
<h3>${esc(s.subscribeTitle)}</h3>
<p>${esc(s.subscribeBlurb)}</p>
${form}
</section>`;
}

/**
 * Sources are listed once, numbered, and each signal links into that list.
 * Printing URLs beside every signal would triple the visual weight of the
 * citations and make the page read like a bibliography.
 */
function citationLinks(e: Edition, urls: string[]): string {
  const idx = new Map(e.sources.map((src, i) => [src.url, i + 1]));
  const nums = urls.map((u) => idx.get(u)).filter((n): n is number => !!n);
  if (nums.length === 0) return "";
  // "link, 1" is what a screen reader announces without this. WCAG 2.4.4.
  const label = STRINGS[e.lang].citationLabel;
  return `<span class="cites">${nums
    .map((n) => `<a href="#s${n}" aria-label="${esc(label(n))}">[${n}]</a>`)
    .join("")}</span>`;
}

function renderSignal(e: Edition, sig: Signal): string {
  const s = STRINGS[e.lang];
  const t = sig.trend;
  // Trend badge only when the archive actually has something to say. A "New"
  // badge on every signal would be noise on day one and meaningless later.
  const trendBadge =
    t.status === "new"
      ? ""
      : `<span class="trend ${t.status}">${esc(s.trendStatus[t.status])} · ${esc(s.trendSince(t.occurrences, t.firstSeen))}</span>`;

  const rung = (label: string, value: string, cls = "") =>
    value ? `<div class="rung ${cls}"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>` : "";

  const c = sig.corroboration;
  const thin = c.publishers < 2 && !c.hasPrimary;

  return `<article class="signal">
<div class="head"><span class="rank">${sig.rank}</span><h3>${esc(sig.headline)}</h3></div>
<div class="tags">
<span class="dom ${sig.domain}">${esc(DOMAIN_LABELS[e.lang][sig.domain])}</span>
<span class="trend">${esc(s.strength[sig.strength])}</span>
${trendBadge}
</div>
<dl class="ladder">
${rung(s.whatChanged, sig.whatChanged)}
${rung(s.whyItMatters, sig.whyItMatters)}
${rung(s.secondOrder, sig.secondOrder)}
${rung(s.action, sig.action, "act")}
</dl>
<div class="corrob">
<span>${esc(s.corroboration(c.publishers, c.hasPrimary))}</span>
${thin ? `<span class="thin">· ${esc(s.thinEvidence)}</span>` : ""}
${citationLinks(e, sig.sourceUrls)}
</div>
</article>`;
}

function editionJsonLd(cfg: SiteConfig, e: Edition): unknown {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: e.title,
    description: e.dek || e.summary.slice(0, 200),
    datePublished: e.meta.generatedAt,
    dateModified: e.meta.generatedAt,
    inLanguage: e.lang,
    isAccessibleForFree: true,
    url: absUrl(cfg, editionPath(e.lang, e.slug)),
    mainEntityOfPage: absUrl(cfg, editionPath(e.lang, e.slug)),
    publisher: { "@type": "Organization", name: cfg.siteName },
    about: e.domains.map((d) => ({ "@type": "Thing", name: DOMAIN_LABELS[e.lang][d] })),
    // The load-bearing field: every URL behind today's claims, machine-readable.
    citation: e.sources.map((src) => ({
      "@type": "CreativeWork",
      name: src.title,
      url: src.url,
      publisher: { "@type": "Organization", name: src.publisher },
      ...(src.publishedAt ? { datePublished: src.publishedAt } : {}),
    })),
  };
}

export function renderEdition(cfg: SiteConfig, e: Edition, hasAlt: boolean): string {
  const s = STRINGS[e.lang];

  const domains = e.domains
    .map((d) => `<span class="dom ${d}">${esc(DOMAIN_LABELS[e.lang][d])}</span>`)
    .join(" ");

  const signals = e.signals.map((sig) => renderSignal(e, sig)).join("\n");

  const trends = e.trends.length
    ? `<h2>${esc(s.trends)}</h2>
<p class="note">${esc(s.trendsIntro)}</p>
${e.trends
  .map(
    (t) => `<div class="trend-row">
<span class="trend ${t.status}">${esc(s.trendStatus[t.status])}</span>
<div>${esc(t.theme)}<div class="n">${esc(s.trendSince(t.occurrences, t.firstSeen))} · ${esc(DOMAIN_LABELS[e.lang][t.domain])}</div></div>
</div>`,
  )
  .join("\n")}`
    : "";

  const watch = e.watchNext
    .map(
      (w) =>
        `<li>${esc(w.item)}${w.dueDate ? ` <span class="n">— ${esc(formatDate(w.dueDate, e.lang))}</span>` : ""}</li>`,
    )
    .join("\n");

  const sources = e.sources
    .map(
      (src, i) =>
        `<li id="s${i + 1}"><a href="${esc(src.url)}" rel="nofollow noopener" target="_blank">${esc(src.title)}</a><br><span class="pub">${esc(src.publisher)}${src.via ? ` · via ${esc(src.via)}` : ""}${src.publishedAt ? ` · ${esc(src.publishedAt.slice(0, 10))}` : ""}</span></li>`,
    )
    .join("\n");

  const body = `<article>
<h1>${esc(e.title)}</h1>
${e.dek ? `<p class="dek">${esc(e.dek)}</p>` : ""}
<div class="meta">
${domains}
<span>${esc(formatDate(e.date, e.lang))}</span>
<span>·</span>
<span>${esc(s.citedSources(e.sources.length))}</span>
</div>

${e.summary ? `<h2>${esc(s.summary)}</h2>\n<p>${esc(e.summary)}</p>` : ""}

<h2>${esc(s.signals)}</h2>
${signals}

${trends}

${watch ? `<h2>${esc(s.watchNext)}</h2>\n<ul class="plain">${watch}</ul>` : ""}


<h2>${esc(s.sources)}</h2>
<p class="note">${esc(s.sourcesNote)}</p>
<ol class="sources">
${sources}
</ol>
</article>

<div id="subscribe">${subscribeBlock(cfg, e.lang)}</div>`;

  const other: Lang = e.lang === "id" ? "en" : "id";
  return page({
    cfg,
    lang: e.lang,
    title: `${e.title} — ${cfg.siteName}`,
    description: e.dek || e.summary.slice(0, 180),
    path: editionPath(e.lang, e.slug),
    altPath: hasAlt ? editionPath(other, e.slug) : homePath(other),
    jsonLd: editionJsonLd(cfg, e),
    body,
  });
}

export function renderHome(cfg: SiteConfig, editions: Edition[], lang: Lang): string {
  const s = STRINGS[lang];
  if (editions.length === 0) {
    return page({
      cfg,
      lang,
      title: cfg.siteName,
      description: s.siteTagline,
      path: homePath(lang),
      body: `<p>${esc(s.noEditions)}</p>${subscribeBlock(cfg, lang)}`,
    });
  }

  const [latest, ...rest] = editions;
  const cards = rest
    .slice(0, 12)
    .map(
      (e) => `<div class="card">
<div class="d">${esc(formatDate(e.date, e.lang))} · </div>
<h3><a href="${esc(url(cfg, editionPath(e.lang, e.slug)))}">${esc(e.title)}</a></h3>
${e.dek ? `<p>${esc(e.dek)}</p>` : ""}
</div>`,
    )
    .join("\n");

  const body = `<p class="note">${esc(s.siteTagline)}</p>
<div class="lede">
<div class="meta" style="margin:0 0 .8rem">
<span>${esc(formatDate(latest.date, latest.lang))}</span>
<span>·</span><span>${esc(s.latestEdition)}</span>
</div>
<h1><a href="${esc(url(cfg, editionPath(latest.lang, latest.slug)))}">${esc(latest.title)}</a></h1>
${latest.dek ? `<p class="dek">${esc(latest.dek)}</p>` : ""}
${latest.summary ? `<p style="margin-top:1rem">${esc(latest.summary)}</p>` : ""}
<p><a class="btn" href="${esc(url(cfg, editionPath(latest.lang, latest.slug)))}">${esc(s.readEdition)}</a></p>
</div>

${subscribeBlock(cfg, lang)}

${cards ? `<h2>${esc(s.allEditions)}</h2>\n<div class="cards">${cards}</div>` : ""}
<p style="margin-top:1.5rem"><a href="${esc(url(cfg, archivePath(lang)))}">${esc(s.archive)} →</a></p>`;

  return page({
    cfg,
    lang,
    title: `${cfg.siteName} — ${s.siteTagline.slice(0, 90)}`,
    description: s.siteTagline,
    path: homePath(lang),
    altPath: homePath(lang === "id" ? "en" : "id"),
    wide: true,
    body,
  });
}

export function renderArchive(cfg: SiteConfig, editions: Edition[], lang: Lang): string {
  const s = STRINGS[lang];
  const rows = editions
    .map(
      (e) => `<tr>
<td class="d">${esc(formatDate(e.date, e.lang))}</td>
<td><a href="${esc(url(cfg, editionPath(e.lang, e.slug)))}">${esc(e.title)}</a>
<div class="d">${e.domains.map((x) => esc(DOMAIN_LABELS[e.lang][x])).join(" · ")} · ${esc(s.citedSources(e.sources.length))}</div></td>
</tr>`,
    )
    .join("\n");

  const body = `<h1>${esc(s.archiveTitle)}</h1>
<p class="dek">${esc(s.archiveIntro)}</p>
<p class="meta">${esc(s.editionsCount(editions.length))}</p>
${editions.length ? `<table class="arch">${rows}</table>` : `<p>${esc(s.noEditions)}</p>`}`;

  return page({
    cfg,
    lang,
    title: `${s.archiveTitle} — ${cfg.siteName}`,
    description: s.archiveIntro,
    path: archivePath(lang),
    altPath: archivePath(lang === "id" ? "en" : "id"),
    body,
  });
}

export function renderFeed(cfg: SiteConfig, editions: Edition[], lang: Lang): string {
  const s = STRINGS[lang];
  const items = editions
    .slice(0, 30)
    .map((e) => {
      const link = absUrl(cfg, editionPath(e.lang, e.slug));
      return `    <item>
      <title>${esc(e.title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${new Date(e.meta.generatedAt).toUTCString()}</pubDate>
      <description>${esc(e.dek || e.summary)}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(cfg.siteName)}${lang === "en" ? " (English)" : ""}</title>
    <link>${esc(absUrl(cfg, homePath(lang)))}</link>
    <description>${esc(s.siteTagline)}</description>
    <language>${lang}</language>
    <atom:link href="${esc(absUrl(cfg, feedPath(lang)))}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

export function renderSitemap(cfg: SiteConfig, editions: Edition[]): string {
  const urls = new Set<string>();
  for (const lang of ["id", "en"] as Lang[]) {
    urls.add(absUrl(cfg, homePath(lang)));
    urls.add(absUrl(cfg, archivePath(lang)));
  }
  for (const e of editions) urls.add(absUrl(cfg, editionPath(e.lang, e.slug)));

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urls].map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n")}
</urlset>
`;
}

export function renderRobots(cfg: SiteConfig): string {
  return `User-agent: *
Allow: /

Sitemap: ${absUrl(cfg, "/sitemap.xml")}
`;
}
