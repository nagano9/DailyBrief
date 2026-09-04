import {
  DOMAIN_LABELS,
  DOMAIN_SHORT,
  type Domain,
  type Edition,
  type Lang,
  type Signal,
} from "../brief/types";
import { STRINGS } from "./strings";
import { esc, html, jsonLdScript, raw, type Html } from "./html";

/**
 * Static site renderer.
 *
 * No framework, no build step, no external assets; consistent with the
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
   * When only one composes, a routine failure mode since each language is a
   * separate model call, the site must not advertise the other. Emitting a
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
  /**
   * WhatsApp contact, digits only in international form (no +, no leading 0).
   *
   * Configuration rather than a literal in the source: this repository is
   * public, and a fork should not inherit someone else's phone number; the
   * same reason profile.json is not committed.
   */
  contactWhatsapp: string;
}

/**
 * Normalise an Indonesian number into the form wa.me accepts.
 *
 * People write the same number four ways: +62813…, 62813…, 0813…, with
 * spaces or dashes, and wa.me silently fails on all but one of them, so the
 * link would look fine and go nowhere.
 */
export function whatsappUrl(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  const international = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
  return `https://wa.me/${international}`;
}

/** The same number, formatted for reading rather than dialling. */
export function whatsappLabel(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  const international = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
  return "+" + international;
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

/** Every domain the archive can be narrowed to, in display order. */
export const ARCHIVE_DOMAINS: Domain[] = ["ai", "energy", "corporate"];

/** URL slug per domain. Kept ASCII and identical across languages so a link
 *  survives translation and neither tree invents its own vocabulary. */
const DOMAIN_SLUG: Record<Domain, string> = {
  ai: "ai",
  energy: "energi",
  corporate: "korporasi",
};

export function archivePath(lang: Lang, domain?: Domain): string {
  const root = lang === "id" ? "/arsip/" : "/en/archive/";
  return domain ? `${root}${DOMAIN_SLUG[domain]}/` : root;
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
--measure:40rem;--wide:56rem;
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

/* The homepage opening is not a standfirst.
   A standfirst is defined by the headline above it, and takes its muted
   colour from being subordinate to one. At the top of the homepage there is
   no headline, so the same treatment read as an orphaned caption: grey,
   slightly oversized, floating. It is also the worst place for that, being
   the one sentence a first-time reader uses to decide whether this is for
   them. It gets the weight of a statement instead. */
.standfirst{font-size:1.32rem;line-height:1.42;letter-spacing:-.008em;
font-weight:400;color:var(--ink);max-width:34rem;margin:.25rem 0 0}

/* The lead edition keeps the visual weight of a headline while giving up the
   h1: a homepage heading should describe the page, and the page is the
   publication, not whichever story ran today. */
.lede h2.lead{font-family:var(--serif);font-size:2rem;font-weight:600;
line-height:1.2;letter-spacing:-.012em;color:var(--ink);text-transform:none;
margin:0;padding:0;border:0}

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
   rather than infers, where evidence stops and interpretation starts; the
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

/* The cover shows the spine. A reader who has not clicked through has no way
   to see the one thing that separates this from a summary feed: the solid
   rule under sourced fact, the dashed rule under our reading. So the lead
   signal runs in full on the homepage. The ladder is flattened there: the
   cover has no rails to hang the labels in, so the negative margin that
   pulls them out of the column has to be cancelled or they fall off the
   left edge. */
.cover-signal{margin:1.7rem 0 1.4rem;padding-top:1.3rem;
border-top:1px solid var(--rule);
max-width:calc(var(--rail-l) + var(--rail-gap) + var(--measure))}
.cover-h{font-family:var(--serif);font-size:1.25rem;font-weight:600;
line-height:1.3;margin:0 0 .1rem}
.ladder-flat .rung{margin-left:0}
.lede h2.lead a{text-decoration:none}
.lede h2.lead a:hover,.lede h2.lead a:focus-visible{color:var(--backed)}
/* Twelve full-width cards ran 1,865px, 47% of the homepage, restating what
   the archive says more compactly. Six in two columns say the same thing in a
   quarter of the height, and the archive link below carries the rest. */
.cards{border-top:1px solid var(--rule);display:grid;
grid-template-columns:repeat(2,minmax(0,1fr));column-gap:2.5rem}
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

/* An edition had no way out but the header. A reader who arrived from search
   or a shared link could not step to the day before without going back to the
   archive and finding their place again. */
.ed-nav{display:flex;justify-content:space-between;gap:1.5rem;flex-wrap:wrap;
margin:3rem 0 0;padding-top:1.4rem;border-top:1px solid var(--rule-strong);
font-family:var(--sans);font-size:.86rem;line-height:1.4}
.ed-nav a{color:var(--muted);text-decoration:none;max-width:19rem;
border-bottom:1px solid transparent}
.ed-nav a:hover,.ed-nav a:focus-visible{color:var(--ink);border-bottom-color:var(--ink)}
.ed-nav .lbl{display:block;font-family:var(--mono);font-size:.62rem;
text-transform:uppercase;letter-spacing:.13em;color:var(--faint);margin-bottom:.3rem}
.ed-nav .next{margin-left:auto;text-align:right}

/* The site ships no JavaScript, so the domain filter is not a control; each
   domain is its own static page. That also gives a crawler three real URLs
   instead of one page it would have to run script to see. */
.arch-filter{display:flex;flex-wrap:wrap;gap:1.1rem;margin:1.2rem 0 0;
font-family:var(--mono);font-size:.68rem;text-transform:uppercase;
letter-spacing:.1em}
.arch-filter a{color:var(--muted);text-decoration:none;padding-bottom:2px;
border-bottom:1px solid transparent}
.arch-filter a:hover,.arch-filter a:focus-visible{color:var(--ink);border-bottom-color:var(--ink)}
.arch-filter a[aria-current]{color:var(--ink);border-bottom-color:var(--backed)}

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

@media(max-width:48rem){.cards{grid-template-columns:1fr;column-gap:0}}
@media(max-width:38rem){
h1{font-size:1.65rem}
.wrap,.wrap-wide{padding:0 1.15rem}
.ed-nav{flex-direction:column;gap:1.2rem}
.ed-nav .next{margin-left:0;text-align:left}
.trend-row{grid-template-columns:1fr;gap:.25rem}
.tierlist li{grid-template-columns:1fr}
.tierlist li::before{padding-top:0}
}
/* ---------------------------------------------------------------------------
   The three-column document.
   ---------------------------------------------------------------------------
   The prose column stays at its reading measure; widening it past roughly 75
   characters a line would make the page worse, not fuller. So the margins are
   given a job instead of being filled.

   Left margin  : structure. The rung labels hang out of the text, so the
                  prose runs uninterrupted and the ladder is legible as a
                  ladder from across the room.
   Right margin : evidence. The sources behind a signal sit beside it, so
                  checking a claim costs no navigation, which is the whole
                  proposition of the product.
   ------------------------------------------------------------------------- */

/* box-sizing is border-box, so max-width has to carry the outer padding too;
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

/* The signal headline was 1.1rem against 1.0625rem body: six tenths of a
   pixel apart, with weight alone carrying the rank. On a page whose premise
   is five signals in order, the order has to be legible before the prose is
   read. Scoped to the signal; the generic h3 also sets the subscribe block,
   which should not compete with it. */
.signal .head h3{font-size:1.4rem;line-height:1.25;letter-spacing:-.008em}
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
.rail-trend .rail-h{font-family:var(--mono);font-size:.62rem;font-weight:500;
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
.doc{max-width:calc(var(--measure) + var(--rail-l) + var(--rail-gap) + 3rem);
padding-right:1.5rem}
.aside,.rail-trend{position:static;width:auto;margin:1.4rem 0 0;
padding-top:1rem;border-top:1px solid var(--rule)}
.rail-trend{margin-bottom:2rem}
}

/* The left rail costs 10rem; the right costs 15.5rem. Folding both at the
   same breakpoint threw away the cheaper one for nothing; a tablet in
   landscape, or a half-screen window, lost the ladder while still having
   room for it. The labels now hang until the column itself stops fitting:
   measure + rail + gap + padding = 55rem, so 58rem with room to breathe. */
@media(max-width:58rem){
.doc{padding-left:1.5rem;max-width:var(--measure)}
.rung{margin-left:0}
.signal .head{margin-left:0}
.signal .rank{flex:none;min-width:1.5rem;text-align:left}
}
@media(max-width:38rem){
.doc{padding-left:1.15rem;padding-right:1.15rem}
.rung{grid-template-columns:1fr;gap:.25rem}
.rung dt{text-align:left}
.rung dd{padding-left:.9rem}
.corrob{padding-left:.9rem}
}
/* ---------------------------------------------------------------------------
   Print.
   ---------------------------------------------------------------------------
   A briefing read before a meeting is the archetypal thing someone prints or
   saves as PDF, and the three-column layout is exactly wrong on paper: the
   rails are positioned against the viewport edge and would fall off it.

   On paper the document folds back to one column, the evidence follows the
   claim it supports, and everything that only makes sense on screen, the
   navigation, the skip link, the subscribe form, is dropped. Source URLs are
   printed after their titles, because a citation you cannot follow on paper
   is not a citation.
   ------------------------------------------------------------------------- */
@media print{
:root{--paper:#fff;--ink:#000;--muted:#333;--faint:#555;
--rule:#ccc;--rule-strong:#999;--backed:#000;--unbacked:#000}
body{font-size:10.5pt;line-height:1.45}
.skip,nav.site,.sub,.rail-trend{display:none}
header.site{border-bottom:1pt solid #999;margin-bottom:1.5rem}
.doc,.wrap,.wrap-wide{max-width:none;padding:0}
.rung{margin-left:0;grid-template-columns:6.5rem 1fr;column-gap:1rem}
.signal .head{margin-left:0}
.signal .rank{flex:none;min-width:1.2rem;text-align:left}
.aside{position:static;width:auto;margin:.8rem 0 0;padding-top:.6rem;
border-top:1pt solid #ccc}

/* Keep a signal and its evidence on one sheet where the paper allows. */
.signal{break-inside:avoid;page-break-inside:avoid}
h1,h2,h3,h4{break-after:avoid;page-break-after:avoid}

/* A printed link is only useful if its destination is printed with it. */
.aside a::after,ol.sources a::after{content:" (" attr(href) ")";
font-family:var(--mono);font-size:8pt;color:#555;word-break:break-all}
.corrob .backed::before{content:"[+] "}
.corrob .unbacked::before{content:"[!] "}
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
<link rel="icon" href="${url(cfg, "/favicon.svg")}" type="image/svg+xml">
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
<p>&copy; ${new Date().getFullYear()} ${cfg.siteName}
· <a href="${url(cfg, aboutPath(lang))}">${s.about}</a>${
  cfg.contactWhatsapp
    ? html`
· <a href="${whatsappUrl(cfg.contactWhatsapp)}" rel="noopener" target="_blank">${s.contact}</a>`
    : ""
}</p>
</div></footer>
</body>
</html>`.value;
}

function subscribeBlock(cfg: SiteConfig, lang: Lang): Html {
  const s = STRINGS[lang];
  // No endpoint, or no privacy policy, means no form. Collecting an address
  // without recorded consent and a stated purpose is not something to ship
  // and fix later; UU PDP treats consent as a precondition, not a nicety.
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

/**
 * The reasoning ladder, and the evidence spine that runs down it.
 *
 * Citations belong under the rung they support. `whatChanged` is the fact and
 * carries the evidence; the rungs below it are our reading, and showing them
 * uncited is the honest signal that they are. `sourced` draws the spine
 * solid; everything without it draws dashed, so the eye can follow where
 * evidence ends and our reading begins without reading a word.
 *
 * `flat` drops the hanging labels for contexts with no left rail to hang them
 * in, which today means the homepage cover.
 */
function ladder(e: Edition, sig: Signal, flat = false): Html {
  const s = STRINGS[e.lang];
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
  return html`<dl class="ladder${flat ? " ladder-flat" : ""}">
${rung(s.whatChanged, sig.whatChanged, "", sig.sourceUrls)}
${rung(s.whyItMatters, sig.whyItMatters)}
${rung(s.secondOrder, sig.secondOrder, "", sig.secondOrderUrls)}
${rung(s.action, sig.action, "act")}
</dl>`;
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

  const c = sig.corroboration;
  // The previous caveat required a single-publisher claim with no primary
  // source, and fired on 0 of 5 signals in the first real edition, while the
  // day's lead story, hundreds of trillions of rupiah of state debt, rested
  // on six press citations and no primary source at all. The reader saw
  // "5 penerbit", which reads as strength.
  //
  // Five outlets carrying one statement is correlation, not corroboration.
  // So the absence of a primary source is now stated outright, whatever the
  // publisher count.

  // The aside is placed AFTER the signal in the DOM and positioned back
  // beside it with CSS. Put first, as it was for convenience, its heading
  // preceded the signal's own, so a screen-reader user navigating by heading
  // heard "Dasar" before the signal it was the basis for, and skipped a level
  // getting there.
  return html`<article class="signal">
<div class="head"><span class="rank" aria-hidden="true">${sig.rank}</span><h3>${sig.headline}</h3></div>
<div class="tags">
<span class="tag strong">${DOMAIN_SHORT[e.lang][sig.domain]}</span>
<span class="tag">${s.strength[sig.strength]}</span>
${trendBadge}
</div>
${ladder(e, sig)}
<div class="corrob">
<span class="${c.hasPrimary ? "backed" : "unbacked"}">${
    c.hasPrimary ? s.hasPrimarySource : s.noPrimarySource
  }</span>
<span>${s.publisherCount(c.publishers)}</span>
</div>
${signalAside(e, sig)}
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

/** The editions either side of this one, newest-first order: `newer` ran the
 *  day after, `older` the day before. Either may be absent at the ends. */
export interface EditionNeighbours {
  newer?: Edition;
  older?: Edition;
}

export function renderEdition(
  cfg: SiteConfig,
  e: Edition,
  hasAlt: boolean,
  neighbours: EditionNeighbours = {},
): string {
  const s = STRINGS[e.lang];

  // The longitudinal view rides the right margin rather than sitting at the
  // foot of the page. What has been building for three weeks is context for
  // reading today, not an appendix to it.
  const trendRail =
    e.trends.length > 0 &&
    html`<aside class="rail-trend" aria-labelledby="tren">
<h2 id="tren" class="rail-h">${s.trends}</h2>
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
        html`<li>${w.item}${w.dueDate && html` <span class="n">· ${formatDate(w.dueDate, e.lang)}</span>`}</li>`,
    )}</ul>`;

  const body = html`<article class="signal-doc">
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
<span class="arrow">·</span> <b>${e.meta.poolSize}</b> ${s.funnelRead}
<span class="arrow">·</span> <b>${e.signals.length}</b> ${s.funnelSignals}
<span class="arrow">·</span> <b>${e.sources.length}</b> ${s.funnelCited}
</p>

${e.summary && html`<h2>${s.summary}</h2>
<p>${e.summary}</p>`}

${trendRail}
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

${
    (neighbours.older || neighbours.newer) &&
    html`<nav class="ed-nav" aria-label="${s.archiveTitle}">
${
      neighbours.older &&
      html`<a class="prev" href="${url(cfg, editionPath(neighbours.older.lang, neighbours.older.slug))}"><span class="lbl">${
        s.prevEdition
      }</span>${formatDate(neighbours.older.date, neighbours.older.lang)}</a>`
    }
${
      neighbours.newer &&
      html`<a class="next" href="${url(cfg, editionPath(neighbours.newer.lang, neighbours.newer.slug))}"><span class="lbl">${
        s.nextEdition
      }</span>${formatDate(neighbours.newer.date, neighbours.newer.lang)}</a>`
    }
</nav>`
  }

${subscribeBlock(cfg, e.lang)}`;

  const other: Lang = e.lang === "id" ? "en" : "id";
  return page({
    cfg,
    lang: e.lang,
    title: `${e.title} | ${cfg.siteName}`,
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
      body: html`<h1 class="standfirst">${s.homeIntro}</h1>
<p>${s.noEditions}</p>
${subscribeBlock(cfg, lang)}`,
    });
  }

  const [latest, ...rest] = editions;
  // The lead signal is shown in full on the cover, spine and citations
  // included. Claiming traceability and then hiding every trace behind a
  // click was the cover's one real failure.
  //
  // It replaces the edition summary rather than following it. The two said
  // much the same thing back to back, and of the pair only the ladder shows
  // its sources. Nothing is lost: the summary still opens the edition itself
  // under its own heading.
  const lead = latest.signals?.[0];
  const cards = rest.slice(0, 6).map(
    (e) => html`<div class="card">
<div class="d">${formatDate(e.date, e.lang)}</div>
<h3><a href="${url(cfg, editionPath(e.lang, e.slug))}">${e.title}</a></h3>
${e.dek && html`<p>${e.dek}</p>`}
</div>`,
  );

  // The first ten seconds have to answer "what is this, for whom, how often".
  // Leading straight into the latest headline assumed a reader who already
  // knew, which is every reader except the ones worth converting.
  const body = html`<h1 class="standfirst">${s.homeIntro}</h1>
<p class="meta" style="margin-top:1rem"><span class="tag strong">${s.cadence}</span>
<span class="arrow">·</span>
<a href="${url(cfg, aboutPath(lang))}">${s.aboutTitle}</a></p>

<div class="lede" style="margin-top:2rem">
<div class="meta" style="margin:0 0 .8rem">
<span>${formatDate(latest.date, latest.lang)}</span>
<span>·</span><span>${s.latestEdition}</span>
</div>
<h2 class="lead"><a href="${url(cfg, editionPath(latest.lang, latest.slug))}">${latest.title}</a></h2>
${latest.dek && html`<p class="dek">${latest.dek}</p>`}
${lead &&
    html`<div class="cover-signal">
<h3 class="cover-h">${lead.headline}</h3>
${ladder(latest, lead, true)}
</div>`}
<p><a class="btn" href="${url(cfg, editionPath(latest.lang, latest.slug))}">${s.readEdition}</a></p>
</div>

${subscribeBlock(cfg, lang)}

${cards.length > 0 && html`<h2>${s.allEditions}</h2>
<div class="cards">${cards}</div>`}
<p style="margin-top:1.5rem"><a href="${url(cfg, archivePath(lang))}">${s.archive}</a></p>`;

  return page({
    cfg,
    lang,
    title: `${cfg.siteName} | ${s.siteTagline.slice(0, 90)}`,
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
 * it, how, and under what rules, before subscribing, not after. Burying that
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

${
  cfg.contactWhatsapp &&
  html`<h2>${s.contactTitle}</h2>
<p>${s.contactBody}</p>
<p><a class="btn" href="${whatsappUrl(cfg.contactWhatsapp)}" rel="noopener" target="_blank">${s.contactCta} ${whatsappLabel(
    cfg.contactWhatsapp,
  )}</a></p>`
}

${subscribeBlock(cfg, lang)}`;

  return page({
    cfg,
    lang,
    title: `${s.aboutTitle} | ${cfg.siteName}`,
    description: s.aboutLede,
    path: aboutPath(lang),
    altPath: aboutPath(lang === "id" ? "en" : "id"),
    body,
  });
}

/**
 * The archive.
 *
 * This is the product's spine: the about page promises every edition is
 * permanent and citable, so this page carries the most weight over time and
 * had the least structure: a flat table that reads fine at thirty rows and
 * becomes unusable at three hundred.
 *
 * Two changes. Editions group under the month they belong to, so a reader
 * scanning for "sometime in July" has somewhere to land. And because the site
 * ships no JavaScript, narrowing by domain is not a control but three more
 * static pages, each a real URL a crawler and a bookmark can both hold.
 */
export function renderArchive(
  cfg: SiteConfig,
  editions: Edition[],
  lang: Lang,
  domain?: Domain,
): string {
  const s = STRINGS[lang];
  const shown = domain ? editions.filter((e) => e.domains.includes(domain)) : editions;

  // Editions arrive newest first and stay that way; grouping must not reorder
  // them, only insert a heading when the month changes.
  const months: { key: string; label: string; rows: Edition[] }[] = [];
  for (const e of shown) {
    const key = e.date.slice(0, 7);
    if (months.at(-1)?.key !== key) {
      const [y, m] = key.split("-").map(Number);
      months.push({ key, label: `${MONTHS[lang][m - 1]} ${y}`, rows: [] });
    }
    months.at(-1)!.rows.push(e);
  }

  const table = (rows: Edition[]) => html`<table class="arch">${rows.map(
    (e) => html`<tr>
<td class="d">${formatDate(e.date, e.lang)}</td>
<td><a href="${url(cfg, editionPath(e.lang, e.slug))}">${e.title}</a>
<div class="d">${e.domains.map((x) => DOMAIN_SHORT[e.lang][x]).join(" · ")} · ${s.citedSources(
      e.sources.length,
    )}</div></td>
</tr>`,
  )}</table>`;

  const filter = html`<nav class="arch-filter" aria-label="${s.archiveTitle}">
<a href="${url(cfg, archivePath(lang))}"${!domain && raw(' aria-current="page"')}>${
    s.archiveAllDomains
  }</a>
${ARCHIVE_DOMAINS.map(
  (d) => html`<a href="${url(cfg, archivePath(lang, d))}"${
    domain === d && raw(' aria-current="page"')
  }>${DOMAIN_SHORT[lang][d]}</a>`,
)}
</nav>`;

  const label = DOMAIN_LABELS[lang][domain ?? "ai"];
  const title = domain ? s.archiveDomainTitle(label) : s.archiveTitle;
  const intro = domain ? s.archiveDomainIntro(label) : s.archiveIntro;

  const body = html`<h1>${title}</h1>
<p class="dek">${intro}</p>
${filter}
<p class="meta">${s.editionsCount(shown.length)}</p>
${
    shown.length > 0
      ? months.map((m) => html`<h2>${m.label}</h2>
${table(m.rows)}`)
      : html`<p>${s.noEditions}</p>`
  }`;

  return page({
    cfg,
    lang,
    title: `${title} | ${cfg.siteName}`,
    description: intro,
    path: archivePath(lang, domain),
    altPath: archivePath(lang === "id" ? "en" : "id", domain),
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
    for (const d of ARCHIVE_DOMAINS) {
      entries.push({ loc: absUrl(cfg, archivePath(lang, d)), lastmod: newest });
    }
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
