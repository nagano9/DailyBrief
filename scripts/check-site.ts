import fs from "node:fs";
import path from "node:path";

/**
 * Structural checks over a built site.
 *
 * These live in a script rather than in CI YAML for two reasons: shell
 * one-liners differ across platforms (a `grep -P` assertion silently returned
 * zero on Windows, so it passed while doing nothing), and a check that cannot
 * be run locally will not be trusted or maintained.
 *
 *   npm run check:site            checks site/
 *   npm run check:site -- <dir>   checks somewhere else
 *
 * Every rule here corresponds to a defect that actually shipped.
 */

const SITE = process.argv[2] ?? process.env.SITE_OUT ?? "site";

interface Failure {
  rule: string;
  detail: string;
}

const failures: Failure[] = [];
function fail(rule: string, detail: string): void {
  failures.push({ rule, detail });
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Site-absolute path a page lives at, e.g. "site/en/index.html" -> "/en/". */
function routeOf(file: string): string {
  const rel = path.relative(SITE, file).split(path.sep).join("/");
  return rel.endsWith("index.html") ? "/" + rel.slice(0, -"index.html".length) : "/" + rel;
}

/**
 * Work out the sub-path the site is served from, by comparing a page's
 * canonical URL with where that page sits on disk.
 */
function inferBasePath(pages: string[]): string {
  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    const m = /<link rel="canonical" href="([^"]*)"/.exec(html);
    if (!m) continue;
    let pathname: string;
    try {
      pathname = new URL(m[1]).pathname;
    } catch {
      continue;
    }
    const route = routeOf(file);
    if (pathname.endsWith(route)) {
      return pathname.slice(0, pathname.length - route.length);
    }
  }
  return "";
}

function main(): void {
  if (!fs.existsSync(SITE)) {
    console.error(`[check-site] ${SITE}/ does not exist — build it first.`);
    process.exit(1);
  }

  const files = walk(SITE);
  const pages = files.filter((f) => f.endsWith(".html"));
  if (pages.length === 0) {
    console.error(`[check-site] no HTML in ${SITE}/`);
    process.exit(1);
  }

  // The site may be hosted under a sub-path, in which case internal links
  // carry a prefix the filesystem does not. Infer it from a page's own
  // canonical URL rather than accepting it as a second copy of the config:
  // a checker configured separately from the builder eventually disagrees
  // with it, and then it is checking the wrong thing.
  const basePath = inferBasePath(pages);
  if (basePath) console.log(`[check-site] base path detected: ${basePath}`);

  const routes = new Set(files.map(routeOf));
  // A directory route resolves through its index.html.
  for (const f of files) {
    if (f.endsWith("index.html")) routes.add(routeOf(f));
  }

  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    const where = routeOf(file);

    // 1. The site ships no JavaScript. The only <script> permitted is the
    //    JSON-LD data block, which browsers do not execute. Anything else
    //    means markup reached a live script context — the XSS that shipped.
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    for (const tag of scripts) {
      if (!tag.includes('type="application/ld+json"')) {
        fail("no-executable-script", `${where} contains ${tag}`);
      }
    }

    // 2. Defence in depth for the same defect.
    if (!html.includes("Content-Security-Policy")) {
      fail("csp-required", `${where} has no Content-Security-Policy`);
    }

    // 3. Every internal link must resolve to something that was built.
    //    A single-language build once advertised a language tree it never
    //    wrote, giving readers a 404 and crawlers a dead hreflang.
    const hrefs = [...html.matchAll(/(?:href|content)="(\/[^"#?]*)"/g)].map((m) => m[1]);
    for (const raw of new Set(hrefs)) {
      if (raw.startsWith("//")) continue; // protocol-relative, external
      const href = basePath && raw.startsWith(basePath) ? raw.slice(basePath.length) || "/" : raw;
      if (!routes.has(href) && !routes.has(href.replace(/\/$/, ""))) {
        fail("dead-internal-link", `${where} links to ${raw}, which was not built`);
      }
    }

    // 4. Absolute URLs must actually be absolute URLs.
    //
    //    A mangled BASE_PATH once produced
    //    `https://host.exampleC:/Program Files/...` on every canonical, and
    //    every other rule here still passed because the links were
    //    internally consistent — consistently wrong.
    //
    //    Parse rather than pattern-match: the first attempt used a regex for
    //    a drive letter and matched the `s:` in `https:`, flagging correct
    //    builds. A check that cries wolf gets switched off.
    for (const [, value] of html.matchAll(/(?:href|content)="(https?:[^"]*)"/g)) {
      let parsed: URL;
      try {
        parsed = new URL(value);
      } catch {
        fail("malformed-url", `${where} emits an unparseable URL: ${value}`);
        continue;
      }
      if (/^\/[A-Za-z]:/.test(parsed.pathname) || parsed.pathname.includes("\\")) {
        fail("mangled-url", `${where} emits a filesystem path in a URL: ${value}`);
      }
    }

    // 5. A page without a canonical is a page search engines may duplicate.
    if (!/<link rel="canonical"/.test(html)) {
      fail("canonical-required", `${where} has no canonical URL`);
    }

    // 6. Heading levels may not skip.
    //
    //    Placing the evidence aside first in the markup — for the CSS
    //    positioning — put its h4 before the signal's own h3 and jumped
    //    straight from h2. A screen-reader user navigating by heading heard
    //    "Dasar" before the signal it was the basis for. Nothing caught it,
    //    so it is a rule now.
    const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) {
        fail("heading-skip", `${where} jumps h${levels[i - 1]} to h${levels[i]}`);
      }
    }

    // 7. Accessibility floor: one h1, a skip link, and a main landmark.
    const h1s = (html.match(/<h1\b/g) ?? []).length;
    if (h1s !== 1) fail("single-h1", `${where} has ${h1s} <h1> elements`);
    if (!html.includes('class="skip"')) fail("skip-link", `${where} has no skip link`);
    if (!html.includes('id="main"')) fail("main-landmark", `${where} has no main landmark`);
  }

  console.log(`[check-site] ${pages.length} pages checked in ${SITE}/`);

  if (failures.length > 0) {
    console.error(`\n[check-site] ${failures.length} failure(s):`);
    for (const f of failures) console.error(`  ${f.rule}: ${f.detail}`);
    process.exit(1);
  }
  console.log(`[check-site] all structural checks passed.`);
}

main();
