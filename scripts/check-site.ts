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
    for (const href of new Set(hrefs)) {
      if (href.startsWith("//")) continue; // protocol-relative, external
      if (!routes.has(href) && !routes.has(href.replace(/\/$/, ""))) {
        fail("dead-internal-link", `${where} links to ${href}, which was not built`);
      }
    }

    // 4. A page without a canonical is a page search engines may duplicate.
    if (!/<link rel="canonical"/.test(html)) {
      fail("canonical-required", `${where} has no canonical URL`);
    }

    // 5. Accessibility floor: one h1, a skip link, and a main landmark.
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
