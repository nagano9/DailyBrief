import { DOMAIN_LABELS, DOMAIN_SHORT, type Edition, type Lang, type Signal } from "../brief/types";
import { STRINGS } from "./strings";
import { esc, html, jsonLdScript, raw, type Html } from "./html";

/**
 * Static site renderer.
 *
 * No framework, no build step, no external assets — consistent with the
 * project's standing rule that output is self-contained HTML. That is also
 * what lets the published archive outlive any particular host: these pages
 * work off a filesystem, a CDN, GitHub Pages, or an object store unchanged.
 *
 * Every interpolation goes through the `html` tag, which escapes by default.
 * See lib/site/html.ts for why that is a structural decision rather than a
 * stylistic one.
 *
 * Every page carries the metadata a reference product needs: canonical URL,
 * hreflang pairing between language editions, OpenGraph, and JSON-LD
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
   * When only one composes — a routine failure mode, since each language is a
   * separate model call — the site must not advertise the other. Emitting a
   * nav link and an hreflang alternate to a tree that was never written gives
   * readers a 404 and search engines an invalid alternate.
   */
  languages: Lang[];
  /** Privacy policy URL. Required before the subscribe form will render. */
  privacyUrl: string;
  /**
   * Absolute or root-relative URL of a social preview image.
   *
   * Deliberately configuration rather than something the build generates: a
   * fabricated card would be worse than none, and most platforms do not
   * render SVG here, so a generated vector would silently produce a broken
   * preview.
   */
  ogImage: string;
}

export { esc };

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

export function aboutPath(lang: Lang): string {
  return lang === "id" ? "/tentang/" : "/en/about/";
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

/**
 * Content Security Policy.
 *
 * The site ships zero JavaScript, so `script-src 'none'` costs nothing and
 * would have neutralised the JSON-LD injection outright rather than merely
 * escaping it. Defence in depth is cheap when there is nothing to defend.
 *
 * `form-action` is narrowed to the configured subscribe endpoint, so an
 * injected form cannot exfiltrate anywhere else. `frame-ancestors` is
 * deliberately omitted: browsers ignore it in a meta tag and log a warning.
 */
function csp(cfg: SiteConfig): string {
  const formAction = cfg.subscribeEndpoint && cfg.privacyUrl ? cfg.subscribeEndpoint : "'none'";
  return [
    "default-src 'none'",
    "script-src 'none'",
    "style-src 'unsafe-inline'",
    "img-src 'self' data:",
    `form-action ${formAction}`,
    "base-uri 'none'",
  ].join("; ");
}

const CSS = `
/* ---------------------------------------------------------------------------
   Colour is reserved for evidence.
   ---------------------------------------------------------------------------
   Everything here is greyscale except one thing: whether a claim is backed by
   a primary source. Domain, strength and trend are set in weight and tracking
   instead. On a product whose whole pitch is that you can check it, a colour
   meaning "trust this" earns its place; a colour meaning "this one is about
   energy" does not, and would compete with it.
   ------------------------------------------------------------------------- */
:root{color-scheme:light dark;
--paper:#f6f7f6;--ink:#191c1b;--muted:#5d6663;--faint:#66706d;
--rule:#dde1df;--rule-strong:#b9c1be;--card:#fdfdfd;
--backed:#0f5c4d;--unbacked:#9c4221;
--measure:44rem;--wide:56rem;
--rail-l:10rem;--rail-r:15.5rem;--rail-gap:2rem;--spine-pad:1.15rem;
--serif:Charter,"Bitstream Charter","Sitka Text",Cambria,Georgia,serif;
--mono:ui-monospace,"SF Mono","Cascadia Mono","Segoe UI Mono",Consolas,monospace;
--sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
@media (prefers-color-scheme:dark){:root{
--paper:#101312;--ink:#e6e9e7;--muted:#949d9a;--faint:#7d8683;
--rule:#252a28;--rule-strong:#39413e;--card:#171b1a;
--backed:#5cbfa8;--unbacked:#e08a63}}

*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);
font:1.0625rem/1.62 var(--serif);
font-feature-settings:"kern","liga";text-rendering:optimizeLegibility}
a{color:inherit}
:focus-visible{outline:2px solid var(--backed);outline-offset:2px}
.wrap{max-width:var(--measure);margin:0 auto;padding:0 1.5rem}
.wrap-wide{max-width:var(--wide);margin:0 auto;padding:0 1.5rem}

.skip{position:absolute;left:-9999px;top:0;background:var(--ink);color:var(--paper);
padding:.6rem 1rem;z-index:10;text-decoration:none;font-family:var(--sans);font-size:.85rem}
.skip:focus{left:0}

header.site{border-bottom:1px solid var(--rule-strong);padding:1rem 0;margin-bottom:2.75rem}
header.site .row{display:flex;align-items:baseline;justify-content:space-between;
gap:1rem;flex-wrap:wrap}
.brand{font-family:var(--serif);font-size:1.1rem;font-weight:600;text-decoration:none}
nav.site{display:flex;gap:1.1rem;font-family:var(--mono);font-size:.72rem;
text-transform:uppercase;letter-spacing:.09em;color:var(--muted)}
nav.site a{text-decoration:none;padding-bottom:1px;border-bottom:1px solid transparent}
nav.site a:hover,nav.site a:focus-visible{color:var(--ink);border-bottom-color:var(--ink)}

h1{font-family:var(--serif);font-size:2rem;font-weight:600;line-height:1.2;
letter-spacing:-.012em;margin:0}
h2{font-family:var(--mono);font-size:.7rem;font-weight:500;text-transform:uppercase;
letter-spacing:.14em;color:var(--muted);margin:3rem 0 1.1rem;
padding-bottom:.5rem;border-bottom:1px solid var(--rule)}
h3{font-family:var(--serif);font-size:1.1rem;font-weight:600;line-height:1.3;margin:0}
p{margin:0 0 1.05rem}
.dek{font-size:1.12rem;line-height:1.5;color:var(--muted);margin:.8rem 0 0}

/* The funnel: what the radar actually did today. Four hundred candidates in,
   five signals out. That ratio is the product, so it opens the page. */
.funnel{font-family:var(--mono);font-size:.72rem;letter-spacing:.05em;
color:var(--muted);margin:.5rem 0 0;display:flex;flex-wrap:wrap;gap:.5rem;
align-items:baseline}
.funnel b{font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}
.funnel .arrow,.meta .arrow{color:var(--faint)}

.meta{font-family:var(--mono);font-size:.72rem;color:var(--muted);display:flex;
gap:.55rem;align-items:center;flex-wrap:wrap;margin-top:1rem;letter-spacing:.04em}

.tag{font-family:var(--mono);font-size:.66rem;text-transform:uppercase;
letter-spacing:.12em;color:var(--muted);white-space:nowrap}
.tag.strong{color:var(--ink);font-weight:600}
.tag.rule{border:1px solid var(--rule-strong);padding:.15rem .45rem}

/* ---------------------------------------------------------------------------
   The signal, and its evidence spine.
   ---------------------------------------------------------------------------
   One vertical rule runs down each signal: SOLID beside the rung carrying
   sourced fact, DASHED beside the rungs carrying our reading. A reader sees,
   rather than infers, where evidence stops and interpretation starts — the
   distinction this whole product rests on, and the one the previous design
   erased by rendering all four rungs identically.
   ------------------------------------------------------------------------- */
.rung.act dd{font-weight:600}
.corrob .backed{color:var(--backed);font-weight:600}
.corrob .unbacked{color:var(--unbacked);font-weight:600}
.cites a{color:var(--muted);text-decoration:none;margin-right:.4rem;
font-variant-numeric:tabular-nums}
.cites a:hover,.cites a:focus-visible{color:var(--ink);text-decoration:underline}

ul.plain{padding-left:1.15rem;margin:0}
ul.plain li{margin-bottom:.6rem}

.trend-row{display:grid;grid-template-columns:7.5rem 1fr;gap:1rem;padding:.7rem 0;
border-top:1px solid var(--rule)}
.trend-row:first-of-type{border-top:0}
.trend-row .n{font-family:var(--mono);font-size:.7rem;color:var(--faint);
letter-spacing:.04em;margin-top:.2rem}

.btn{display:inline-block;background:var(--ink);color:var(--paper);text-decoration:none;
font-family:var(--mono);font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;
font-weight:500;padding:.65rem 1.15rem;border:0;cursor:pointer}
.btn:hover{background:var(--backed)}

ol.sources{padding-left:1.7rem;margin:0;font-size:.94rem}
ol.sources li{margin-bottom:.7rem;padding-left:.2rem}
ol.sources li::marker{font-family:var(--mono);font-size:.78rem;color:var(--faint)}
ol.sources a{color:inherit;text-decoration:none;border-bottom:1px solid var(--rule-strong)}
ol.sources a:hover,ol.sources a:focus-visible{border-bottom-color:var(--ink)}
ol.sources .pub{font-family:var(--mono);font-size:.7rem;color:var(--muted);letter-spacing:.04em}
.note{font-size:.9rem;color:var(--muted);margin-bottom:1.1rem}

.lede{border-bottom:1px solid var(--rule-strong);padding-bottom:2.25rem;margin-bottom:2.25rem}
.lede h1 a{text-decoration:none}
.lede h1 a:hover,.lede h1 a:focus-visible{color:var(--backed)}
.cards{border-top:1px solid var(--rule)}
.card{padding:1.15rem 0;border-bottom:1px solid var(--rule)}
.card a{text-decoration:none}
.card h3{margin-bottom:.3rem;font-size:1rem}
.card h3 a:hover,.card h3 a:focus-visible{color:var(--backed)}
.card .d{font-family:var(--mono);font-size:.7rem;color:var(--faint);letter-spacing:.05em}
.card p{font-size:.94rem;color:var(--muted);margin:.35rem 0 0}

.sub{border-top:1px solid var(--rule-strong);border-bottom:1px solid var(--rule-strong);
padding:1.75rem 0;margin:3.5rem 0}
.sub h3{margin-bottom:.35rem}
.sub p{color:var(--muted);font-size:.94rem;margin-bottom:1.1rem}
.sub form{display:flex;gap:.5rem;flex-wrap:wrap}
.sub input[type=email]{flex:1 1 16rem;padding:.65rem .8rem;border:1px solid var(--rule-strong);
background:var(--card);color:var(--ink);font-size:.94rem;font-family:var(--serif)}
.consent{flex:1 1 100%;display:flex;gap:.55rem;align-items:flex-start;
font-family:var(--sans);font-size:.8rem;color:var(--muted);margin-top:.35rem;line-height:1.5}
.consent input{flex:none;width:auto;margin-top:.2rem}

table.arch{width:100%;border-collapse:collapse;font-size:.96rem}
table.arch td{padding:.85rem 0;border-bottom:1px solid var(--rule);vertical-align:top}
table.arch td.d{font-family:var(--mono);font-size:.7rem;letter-spacing:.05em;
white-space:nowrap;color:var(--faint);width:9rem;padding-right:1rem;padding-top:1rem}
table.arch a{text-decoration:none}
table.arch a:hover,table.arch a:focus-visible{color:var(--backed)}

.tierlist{margin:0;padding:0;list-style:none;counter-reset:tier}
.tierlist li{counter-increment:tier;display:grid;grid-template-columns:2.5rem 1fr;
gap:1rem;padding:.9rem 0;border-top:1px solid var(--rule)}
.tierlist li:first-child{border-top:0}
.tierlist li::before{content:counter(tier,decimal-leading-zero);font-family:var(--mono);
font-size:.72rem;color:var(--faint);padding-top:.3rem;letter-spacing:.05em}
.tierlist strong{display:block;margin-bottom:.2rem}
.tierlist span{color:var(--muted);font-size:.96rem}

footer.site{border-top:1px solid var(--rule-strong);margin-top:4.5rem;padding:2rem 0 3.5rem;
font-family:var(--sans);font-size:.8rem;color:var(--muted);line-height:1.6}
footer.site p{margin:0 0 .7rem}
footer.site a{color:var(--ink)}

@media(max-width:38rem){
h1{font-size:1.65rem}
.wrap,.wrap-wide{padding:0 1.15rem}
.trend-row{grid-template-columns:1fr;gap:.25rem}
.tierlist li{grid-template-columns:1fr}
.tierlist li::before{padding-top:0}
}
/* ---------------------------------------------------------------------------
   The three-column document.
   ---------------------------------------------------------------------------
   The prose column stays at its reading measure — widening it past roughly 75
   characters a line would make the page worse, not fuller. So the margins are
   given a job instead of being filled.

   Left margin  : structure. The rung labels hang out of the text, so the
                  prose runs uninterrupted and the ladder is legible as a
                  ladder from across the room.
   Right margin : evidence. The sources behind a signal sit beside it, so
                  checking a claim costs no navigation — which is the whole
                  proposition of the product.
   ------------------------------------------------------------------------- */

/* box-sizing is border-box, so max-width has to carry the outer padding too —
   without it the padding eats the reading measure, and the prose column
   measured 656px against a 704px target. */
.doc{max-width:calc(var(--measure) + var(--rail-l) + var(--rail-r) + var(--rail-gap) * 2 + 3rem);
margin:0 auto;padding:0 1.5rem;
padding-left:calc(1.5rem + var(--rail-l) + var(--rail-gap));
padding-right:calc(1.5rem + var(--rail-r) + var(--rail-gap))}
.doc > *{max-width:var(--measure)}

/* Labels hang into the left margin. The shift is exactly label + gap + the
   spine's own padding, so the prose still starts on the column edge. */
dl.ladder{margin:0;padding-left:0}
.rung{display:grid;
grid-template-columns:var(--rail-l) 1fr;column-gap:var(--rail-gap);
margin-left:calc(-1 * (var(--rail-l) + var(--rail-gap)));
padding:.55rem 0;border-left:0}
.rung dt{font-family:var(--mono);font-size:.66rem;font-weight:500;
text-transform:uppercase;letter-spacing:.11em;color:var(--muted);
padding-top:.3rem;text-align:right}
.rung.sourced dt{color:var(--ink)}
.rung dd{margin:0;padding-left:var(--spine-pad);
border-left:2px dashed var(--rule-strong)}
.rung.sourced dd{border-left-style:solid;border-left-color:var(--ink)}

.signal-doc{position:relative}
.signal{position:relative;padding:2rem 0 1.75rem;border-top:1px solid var(--rule)}
.signal:first-of-type{border-top:0;padding-top:.75rem}
.signal .head{display:flex;gap:.9rem;align-items:baseline;margin-bottom:.6rem;
margin-left:calc(-1 * (var(--rail-l) + var(--rail-gap)))}
.signal .rank{font-family:var(--mono);font-size:.8rem;color:var(--faint);
flex:0 0 var(--rail-l);text-align:right;padding-top:.35rem;
font-variant-numeric:tabular-nums}
.signal .tags{display:flex;gap:.9rem;flex-wrap:wrap;margin:.6rem 0 1.2rem;
padding-left:0}
.corrob{font-family:var(--mono);font-size:.72rem;margin:1.1rem 0 0;
display:flex;gap:.55rem;align-items:baseline;flex-wrap:wrap;
letter-spacing:.04em;padding-left:var(--spine-pad)}

/* The evidence aside sits in the right margin, level with its signal. */
.aside{position:absolute;left:100%;top:2rem;width:var(--rail-r);
margin-left:var(--rail-gap);font-family:var(--sans);font-size:.76rem;
line-height:1.5;color:var(--muted)}
.signal:first-of-type .aside{top:.75rem}
.aside h4{font-family:var(--mono);font-size:.62rem;font-weight:500;
text-transform:uppercase;letter-spacing:.13em;color:var(--faint);
margin:0 0 .5rem;padding-bottom:.35rem;border-bottom:1px solid var(--rule)}
.aside h4 + h4{margin-top:1.4rem}
.aside ol{margin:0;padding-left:1.2rem}
.aside li{margin-bottom:.55rem}
.aside li::marker{font-family:var(--mono);font-size:.7rem;color:var(--faint)}
.aside a{color:inherit;text-decoration:none;border-bottom:1px solid var(--rule)}
.aside a:hover,.aside a:focus-visible{color:var(--ink);border-bottom-color:var(--ink)}
.aside .who{display:block;font-family:var(--mono);font-size:.62rem;
letter-spacing:.05em;color:var(--faint);margin-top:.15rem}
.aside .who .primary{color:var(--backed);font-weight:600}
.ents{display:flex;flex-wrap:wrap;gap:.3rem .5rem;margin:0;padding:0;list-style:none}
.ents li{font-family:var(--mono);font-size:.66rem;letter-spacing:.04em;
color:var(--muted);border:1px solid var(--rule);padding:.12rem .4rem}

/* The longitudinal panel rides the right margin at the top of the article. */
.rail-trend{position:absolute;left:100%;top:0;width:var(--rail-r);
margin-left:var(--rail-gap);font-family:var(--sans);font-size:.76rem;
line-height:1.5;color:var(--muted)}
.rail-trend h4{font-family:var(--mono);font-size:.62rem;font-weight:500;
text-transform:uppercase;letter-spacing:.13em;color:var(--faint);
margin:0 0 .5rem;padding-bottom:.35rem;border-bottom:1px solid var(--rule)}
.rail-trend ul{margin:0;padding:0;list-style:none}
.rail-trend li{margin-bottom:.7rem;padding-left:.7rem;
border-left:2px solid var(--rule-strong)}
.rail-trend li.structural{border-left-color:var(--unbacked)}
.rail-trend .n{display:block;font-family:var(--mono);font-size:.62rem;
letter-spacing:.05em;color:var(--faint);margin-top:.1rem}

/* ---------------------------------------------------------------------------
   Below the point where three columns stop fitting, everything folds back into
   one. The rails reflow rather than disappear: on a phone the sources beside a
   claim become the sources beneath it, and nothing is lost.
   ------------------------------------------------------------------------- */
@media(max-width:70rem){
.doc{padding-left:1.5rem;padding-right:1.5rem;max-width:var(--measure)}
.rung{margin-left:0}
.signal .head{margin-left:0}
.signal .rank{flex:none;min-width:1.5rem;text-align:left}
.aside,.rail-trend{position:static;width:auto;margin:1.4rem 0 0;
padding-top:1rem;border-top:1px solid var(--rule)}
.rail-trend{margin-bottom:2rem}
}
@media(max-width:38rem){
.doc{padding-left:1.15rem;padding-right:1.15rem}
.rung{grid-template-columns:1fr;gap:.25rem}
.rung dt{text-align:left}
.rung dd{padding-left:.9rem}
.corrob{padding-left:.9rem}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
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
  /** Use the three-column document shell (edition pages only). */
  doc?: boolean;
  body: Html;
}

function page(o: PageOpts): string {
  const { cfg, lang } = o;
  const s = STRINGS[lang];
  const other: Lang = lang === "id" ? "en" : "id";
  const canonical = absUrl(cfg, o.path);
  const hasOther = cfg.languages.includes(other);
  const alt = o.altPath ? absUrl(cfg, o.altPath) : absUrl(cfg, homePath(other));
  const wrap = o.doc ? "doc" : o.wide ? "wrap-wide" : "wrap";
  const ogImage = o.cfg.ogImage
    ? o.cfg.ogImage.startsWith("http")
      ? o.cfg.ogImage
      : absUrl(cfg, o.cfg.ogImage)
    : "";

  return html`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp(cfg)}">
<title>${o.title}</title>
<meta name="description" content="${o.description}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="${lang}" href="${canonical}">
${hasOther && html`<link rel="alternate" hreflang="${other}" href="${alt}">`}
<link rel="alternate" type="application/rss+xml" title="${cfg.siteName}" href="${url(cfg, feedPath(lang))}">
<meta property="og:type" content="${o.jsonLd ? "article" : "website"}">
<meta property="og:site_name" content="${cfg.siteName}">
<meta property="og:title" content="${o.title}">
<meta property="og:description" content="${o.description}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${lang === "id" ? "id_ID" : "en_US"}">
${ogImage && html`<meta property="og:image" content="${ogImage}">`}
<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${o.title}">
<meta name="twitter:description" content="${o.description}">
${o.jsonLd ? jsonLdScript(o.jsonLd) : ""}
<style>${raw(CSS)}</style>
</head>
<body>
<a class="skip" href="#main">${s.skipToContent}</a>
<header class="site"><div class="${wrap}"><div class="row">
<a class="brand" href="${url(cfg, homePath(lang))}">${cfg.siteName}<span>.</span></a>
<nav class="site" aria-label="${s.about}">
<a href="${url(cfg, archivePath(lang))}">${s.archive}</a>
<a href="${url(cfg, aboutPath(lang))}">${s.about}</a>
<a href="${url(cfg, feedPath(lang))}">RSS</a>
${hasOther && html`<a href="${url(cfg, o.altPath ?? homePath(other))}">${s.otherLang}</a>`}
</nav></div></div></header>
<main id="main" class="${wrap}">
${o.body}
</main>
<footer class="site"><div class="${wrap}">
<p><strong>${s.methodology}.</strong> ${s.methodologyBody}</p>
<p>${s.disclaimer}</p>
<p>&copy; ${new Date().getFullYear()} ${cfg.siteName} · <a href="${url(cfg, aboutPath(lang))}">${s.about}</a></p>
</div></footer>
</body>
</html>`.value;
}

function subscribeBlock(cfg: SiteConfig, lang: Lang): Html {
  const s = STRINGS[lang];
  // No endpoint, or no privacy policy, means no form. Collecting an address
  // without recorded consent and a stated purpose is not something to ship
  // and fix later — UU PDP treats consent as a precondition, not a nicety.
  const canCollect = cfg.subscribeEndpoint && cfg.privacyUrl;
  const form = canCollect
    ? html`<form method="post" action="${cfg.subscribeEndpoint}">
<input type="email" name="email" required placeholder="${s.subscribePlaceholder}" aria-label="Email">
<input type="hidden" name="lang" value="${lang}">
<button class="btn" type="submit">${s.subscribeButton}</button>
<label class="consent"><input type="checkbox" name="consent" value="yes" required>
<span>${s.consentLabel} <a href="${cfg.privacyUrl}" rel="noopener">${s.privacyPolicy}</a>.</span></label>
</form>`
    : html`<p class="note">${s.subscribeSoon}</p>`;

  return html`<section class="sub">
<h3>${s.subscribeTitle}</h3>
<p>${s.subscribeBlurb}</p>
${form}
</section>`;
}

/**
 * Sources are listed once, numbered, and each signal links into that list.
 * Printing URLs beside every signal would triple the visual weight of the
 * citations and make the page read like a bibliography.
 */
function citationLinks(e: Edition, urls: string[]): Html {
  const idx = new Map(e.sources.map((src, i) => [src.url, i + 1]));
  const nums = [...new Set(urls.map((u) => idx.get(u)).filter((n): n is number => !!n))].sort(
    (a, b) => a - b,
  );
  if (nums.length === 0) return html``;
  // "link, 1" is what a screen reader announces without a label. WCAG 2.4.4.
  const label = STRINGS[e.lang].citationLabel;
  return html`<span class="cites">${nums.map(
    (n) => html`<a href="#s${n}" aria-label="${label(n)}">[${n}]</a>`,
  )}</span>`;
}

/**
 * The right margin of a signal: what backs it, and who it is about.
 *
 * These are the same citations the numbers point at, lifted out of the
 * footnote list and set beside the claim. A reader checking a claim should
 * not have to leave the sentence to do it.
 */
function signalAside(e: Edition, sig: Signal): Html {
  const s = STRINGS[e.lang];
  const byUrl = new Map(e.sources.map((src) => [src.url, src]));
  const cited = [...new Set([...sig.sourceUrls, ...sig.secondOrderUrls])]
    .map((u) => byUrl.get(u))
    .filter((src): src is NonNullable<typeof src> => !!src);

  if (cited.length === 0 && sig.entities.length === 0) return html``;

  return html`<aside class="aside">
${cited.length > 0 &&
  html`<h4>${s.evidenceFor}</h4>
<ol>
${cited.map(
  (src) => html`<li><a href="${src.url}" rel="nofollow noopener" target="_blank">${src.title}</a>
<span class="who">${src.primary ? html`<span class="primary">${src.publisher}</span>` : src.publisher}${
    src.via && html` · via ${src.via}`
  }</span></li>`,
)}
</ol>`}
${sig.entities.length > 0 &&
  html`<h4>${s.entitiesLabel}</h4>
<ul class="ents">${sig.entities.map((n) => html`<li>${n}</li>`)}</ul>`}
</aside>`;
}

function renderSignal(e: Edition, sig: Signal): Html {
  const s = STRINGS[e.lang];
  const t = sig.trend;
  // Trend badge only when the archive has something to say. A "New" badge on
  // every signal would be noise on day one and meaningless later.
  const trendBadge =
    t.status !== "new" &&
    html`<span class="tag rule">${s.trendStatus[t.status]} · ${s.trendSince(
      t.occurrences,
      t.firstSeen,
    )}</span>`;

  // Citations belong under the rung they support. `whatChanged` is the fact
  // and carries the evidence; the rungs below it are our reading, and showing
  // them uncited is the honest signal that they are.
  // `sourced` draws the spine solid. Everything without it draws dashed, so
  // the eye can follow where evidence ends and our reading begins without
  // reading a word.
  const rung = (label: string, value: string, cls = "", cites?: string[]) => {
    const sourced = !!cites && cites.length > 0;
    const classes = ["rung", cls, sourced ? "sourced" : ""].filter(Boolean).join(" ");
    return (
      value &&
      html`<div class="${classes}"><dt>${label}</dt><dd>${value}${
        sourced ? html` ${citationLinks(e, cites)}` : ""
      }</dd></div>`
    );
  };

  const c = sig.corroboration;
  // The previous caveat required a single-publisher claim with no primary
  // source, and fired on 0 of 5 signals in the first real edition — while the
  // day's lead story, hundreds of trillions of rupiah of state debt, rested
  // on six press citations and no primary source at all. The reader saw
  // "5 penerbit", which reads as strength.
  //
  // Five outlets carrying one statement is correlation, not corroboration.
  // So the absence of a primary source is now stated outright, whatever the
  // publisher count.

  return html`<article class="signal">
${signalAside(e, sig)}
<div class="head"><span class="rank" aria-hidden="true">${sig.rank}</span><h3>${sig.headline}</h3></div>
<div class="tags">
<span class="tag strong">${DOMAIN_SHORT[e.lang][sig.domain]}</span>
<span class="tag">${s.strength[sig.strength]}</span>
${trendBadge}
</div>
<dl class="ladder">
${rung(s.whatChanged, sig.whatChanged, "", sig.sourceUrls)}
${rung(s.whyItMatters, sig.whyItMatters)}
${rung(s.secondOrder, sig.secondOrder, "", sig.secondOrderUrls)}
${rung(s.action, sig.action, "act")}
</dl>
<div class="corrob">
<span class="${c.hasPrimary ? "backed" : "unbacked"}">${
    c.hasPrimary ? s.hasPrimarySource : s.noPrimarySource
  }</span>
<span>${s.publisherCount(c.publishers)}</span>
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

  // The longitudinal view rides the right margin rather than sitting at the
  // foot of the page. What has been building for three weeks is context for
  // reading today, not an appendix to it.
  const trendRail =
    e.trends.length > 0 &&
    html`<aside class="rail-trend">
<h4>${s.trends}</h4>
<ul>
${e.trends.map(
  (t) => html`<li class="${t.status}">${t.theme}<span class="n">${s.trendSince(
    t.occurrences,
    t.firstSeen,
  )} · ${DOMAIN_SHORT[e.lang][t.domain]}</span></li>`,
)}
</ul>
</aside>`;

  const watch =
    e.watchNext.length > 0 &&
    html`<h2>${s.watchNext}</h2>
<ul class="plain">${e.watchNext.map(
      (w) =>
        html`<li>${w.item}${w.dueDate && html` <span class="n">— ${formatDate(w.dueDate, e.lang)}</span>`}</li>`,
    )}</ul>`;

  const body = html`<article class="signal-doc">
${trendRail}
<h1>${e.title}</h1>
${e.dek && html`<p class="dek">${e.dek}</p>`}
<div class="meta">
<span>${formatDate(e.date, e.lang)}</span>
<span>·</span>
${e.domains.map(
  (d, i) =>
    html`${i > 0 ? html`<span class="arrow">·</span>` : ""}<span class="tag">${
      DOMAIN_SHORT[e.lang][d]
    }</span>`,
)}
</div>
<p class="funnel">
<b>${e.meta.candidateCount}</b> ${s.funnelCandidates}
<span class="arrow">→</span> <b>${e.meta.poolSize}</b> ${s.funnelRead}
<span class="arrow">→</span> <b>${e.signals.length}</b> ${s.funnelSignals}
<span class="arrow">·</span> <b>${e.sources.length}</b> ${s.funnelCited}
</p>

${e.summary && html`<h2>${s.summary}</h2>
<p>${e.summary}</p>`}

<h2>${s.signals}</h2>
${e.signals.map((sig) => renderSignal(e, sig))}


${watch}

<h2>${s.sources}</h2>
<p class="note">${s.sourcesNote}</p>
<ol class="sources">
${e.sources.map(
  (src, i) => html`<li id="s${i + 1}"><a href="${src.url}" rel="nofollow noopener" target="_blank">${src.title}</a><br><span class="pub">${src.publisher}${
    src.via && html` · via ${src.via}`
  }${src.publishedAt && html` · ${src.publishedAt.slice(0, 10)}`}</span></li>`,
)}
</ol>
</article>

${subscribeBlock(cfg, e.lang)}`;

  const other: Lang = e.lang === "id" ? "en" : "id";
  return page({
    cfg,
    lang: e.lang,
    title: `${e.title} — ${cfg.siteName}`,
    description: e.dek || e.summary.slice(0, 180),
    path: editionPath(e.lang, e.slug),
    altPath: hasAlt ? editionPath(other, e.slug) : homePath(other),
    jsonLd: editionJsonLd(cfg, e),
    doc: true,
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
      body: html`<p class="dek">${s.homeIntro}</p>
<p>${s.noEditions}</p>
${subscribeBlock(cfg, lang)}`,
    });
  }

  const [latest, ...rest] = editions;
  const cards = rest.slice(0, 12).map(
    (e) => html`<div class="card">
<div class="d">${formatDate(e.date, e.lang)}</div>
<h3><a href="${url(cfg, editionPath(e.lang, e.slug))}">${e.title}</a></h3>
${e.dek && html`<p>${e.dek}</p>`}
</div>`,
  );

  // The first ten seconds have to answer "what is this, for whom, how often".
  // Leading straight into the latest headline assumed a reader who already
  // knew, which is every reader except the ones worth converting.
  const body = html`<p class="dek">${s.homeIntro}</p>
<p class="meta" style="margin-top:.75rem"><span class="tag strong">${s.cadence}</span>
<span class="arrow">·</span>
<a href="${url(cfg, aboutPath(lang))}">${s.aboutTitle} →</a></p>

<div class="lede" style="margin-top:2rem">
<div class="meta" style="margin:0 0 .8rem">
<span>${formatDate(latest.date, latest.lang)}</span>
<span>·</span><span>${s.latestEdition}</span>
</div>
<h1><a href="${url(cfg, editionPath(latest.lang, latest.slug))}">${latest.title}</a></h1>
${latest.dek && html`<p class="dek">${latest.dek}</p>`}
${latest.summary && html`<p style="margin-top:1rem">${latest.summary}</p>`}
<p><a class="btn" href="${url(cfg, editionPath(latest.lang, latest.slug))}">${s.readEdition}</a></p>
</div>

${subscribeBlock(cfg, lang)}

${cards.length > 0 && html`<h2>${s.allEditions}</h2>
<div class="cards">${cards}</div>`}
<p style="margin-top:1.5rem"><a href="${url(cfg, archivePath(lang))}">${s.archive} →</a></p>`;

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

/**
 * The about page.
 *
 * A reader deciding whether to trust a daily brief needs to know who makes
 * it, how, and under what rules — before subscribing, not after. Burying that
 * in a footer line was the single biggest cold-start gap.
 */
export function renderAbout(cfg: SiteConfig, lang: Lang): string {
  const s = STRINGS[lang];
  const body = html`<h1>${s.aboutTitle}</h1>
<p class="dek">${s.aboutLede}</p>

<h2>${s.aboutWhatTitle}</h2>
<p>${s.aboutWhatBody}</p>

<h2>${s.aboutHowTitle}</h2>
<ul class="tierlist">
${s.aboutTiers.map((t) => html`<li><div><strong>${t.name}</strong><span>${t.body}</span></div></li>`)}
</ul>

<h2>${s.aboutRulesTitle}</h2>
<ul class="plain">${s.aboutRules.map((r) => html`<li>${r}</li>`)}</ul>

<h2>${s.aboutAiTitle}</h2>
<p>${s.aboutAiBody}</p>

<h2>${s.aboutLimitsTitle}</h2>
<p>${s.aboutLimitsBody}</p>

${subscribeBlock(cfg, lang)}`;

  return page({
    cfg,
    lang,
    title: `${s.aboutTitle} — ${cfg.siteName}`,
    description: s.aboutLede,
    path: aboutPath(lang),
    altPath: aboutPath(lang === "id" ? "en" : "id"),
    body,
  });
}

export function renderArchive(cfg: SiteConfig, editions: Edition[], lang: Lang): string {
  const s = STRINGS[lang];
  const rows = editions.map(
    (e) => html`<tr>
<td class="d">${formatDate(e.date, e.lang)}</td>
<td><a href="${url(cfg, editionPath(e.lang, e.slug))}">${e.title}</a>
<div class="d">${e.domains.map((x) => DOMAIN_SHORT[e.lang][x]).join(" · ")} · ${s.citedSources(
      e.sources.length,
    )}</div></td>
</tr>`,
  );

  const body = html`<h1>${s.archiveTitle}</h1>
<p class="dek">${s.archiveIntro}</p>
<p class="meta">${s.editionsCount(editions.length)}</p>
${editions.length > 0 ? html`<table class="arch">${rows}</table>` : html`<p>${s.noEditions}</p>`}`;

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
  const items = editions.slice(0, 30).map((e) => {
    const link = absUrl(cfg, editionPath(e.lang, e.slug));
    return html`    <item>
      <title>${e.title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(e.meta.generatedAt).toUTCString()}</pubDate>
      <description>${e.dek || e.summary}</description>
    </item>
`;
  });

  return html`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${cfg.siteName}${lang === "en" ? " (English)" : ""}</title>
    <link>${absUrl(cfg, homePath(lang))}</link>
    <description>${s.siteTagline}</description>
    <language>${lang}</language>
    <atom:link href="${absUrl(cfg, feedPath(lang))}" rel="self" type="application/rss+xml"/>
${items}  </channel>
</rss>
`.value;
}

export function renderSitemap(cfg: SiteConfig, editions: Edition[]): string {
  // lastmod lets a crawler skip pages it already has. Without it every
  // recrawl re-fetches the whole archive, which grows without bound.
  const newest = editions.map((e) => e.date).sort().at(-1);
  const entries: { loc: string; lastmod?: string }[] = [];

  for (const lang of cfg.languages) {
    entries.push({ loc: absUrl(cfg, homePath(lang)), lastmod: newest });
    entries.push({ loc: absUrl(cfg, archivePath(lang)), lastmod: newest });
    entries.push({ loc: absUrl(cfg, aboutPath(lang)) });
  }
  for (const e of editions) {
    entries.push({ loc: absUrl(cfg, editionPath(e.lang, e.slug)), lastmod: e.date });
  }

  const seen = new Set<string>();
  const unique = entries.filter((u) => (seen.has(u.loc) ? false : (seen.add(u.loc), true)));

  return html`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique.map(
  (u) => html`  <url><loc>${u.loc}</loc>${u.lastmod && html`<lastmod>${u.lastmod}</lastmod>`}</url>
`,
)}</urlset>
`.value;
}

export function renderRobots(cfg: SiteConfig): string {
  return `User-agent: *
Allow: /

Sitemap: ${absUrl(cfg, "/sitemap.xml")}
`;
}
