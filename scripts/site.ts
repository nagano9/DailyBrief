import "./_env";

import fs from "node:fs";
import path from "node:path";

import {
  archivePath,
  editionPath,
  feedPath,
  homePath,
  aboutPath,
  renderAbout,
  renderArchive,
  renderEdition,
  renderFeed,
  renderHome,
  renderRobots,
  renderSitemap,
  type SiteConfig,
} from "../lib/site/render";
import type { Edition, Lang } from "../lib/brief/types";

/**
 * Build the published site from `editions/` into `site/`.
 *
 * Pure function of the editions directory: delete `site/` and re-run and you
 * get the same bytes back. That is what makes the archive durable — the
 * published HTML is disposable, the JSON is the asset.
 */

/**
 * Input and output are overridable so a fixture archive can be rendered to a
 * scratch directory without touching the real site.
 *
 * Both a CLI flag and an env var: npm scripts run through sh on POSIX and cmd
 * on Windows, and `VAR=x cmd` only works on the former.
 */
function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const EDITIONS_DIR = arg("--editions") ?? process.env.EDITIONS_DIR ?? "editions";
const OUT_DIR = arg("--out") ?? process.env.SITE_OUT ?? "site";
const LANGS: Lang[] = ["id", "en"];

function config(languages: Lang[]): SiteConfig {
  const siteUrl = (arg("--site-url") ?? process.env.SITE_URL ?? "http://localhost:8080").replace(/\/$/, "");
  const basePath = (process.env.BASE_PATH ?? "").replace(/\/$/, "");
  return {
    siteUrl,
    basePath,
    siteName: process.env.SITE_NAME ?? "Daily Strategic Briefing",
    subscribeEndpoint: process.env.SUBSCRIBE_ENDPOINT ?? "",
    privacyUrl: process.env.PRIVACY_URL ?? "",
    ogImage: process.env.OG_IMAGE ?? "",
    languages,
  };
}

function loadEditions(): Map<Lang, Edition[]> {
  const out = new Map<Lang, Edition[]>(LANGS.map((l) => [l, []]));
  if (!fs.existsSync(EDITIONS_DIR)) return out;

  const dates = fs
    .readdirSync(EDITIONS_DIR)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort((a, b) => b.localeCompare(a));

  for (const date of dates) {
    for (const lang of LANGS) {
      const file = path.join(EDITIONS_DIR, date, `${lang}.json`);
      if (!fs.existsSync(file)) continue;
      try {
        const edition = JSON.parse(fs.readFileSync(file, "utf8")) as Edition;
        if (edition.slug !== date) {
          console.warn(`[site] ${file}: slug '${edition.slug}' != directory '${date}' — using directory`);
          edition.slug = date;
        }
        out.get(lang)!.push(edition);
      } catch (e) {
        console.error(`[site] SKIP ${file} — ${(e as Error).message}`);
      }
    }
  }
  return out;
}

function write(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
}

/** Map a site path like "/edisi/2026-08-18/" to "site/edisi/2026-08-18/index.html". */
function outFile(sitePath: string): string {
  const clean = sitePath.replace(/^\//, "");
  return clean.endsWith("/") || clean === ""
    ? path.join(OUT_DIR, clean, "index.html")
    : path.join(OUT_DIR, clean);
}

function main() {
  const byLang = loadEditions();
  // Only advertise languages that were actually built. Composing one language
  // and not the other is a routine failure mode, and linking to the missing
  // tree hands readers a 404 and search engines a dead hreflang alternate.
  const built = LANGS.filter((l) => byLang.get(l)!.length > 0);
  const cfg = config(built);
  const total = LANGS.reduce((n, l) => n + byLang.get(l)!.length, 0);

  if (total === 0) {
    console.error(`[site] no editions found in ${EDITIONS_DIR}/ — run \`npm run brief\` first.`);
    process.exit(1);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  let pages = 0;
  for (const lang of LANGS) {
    const editions = byLang.get(lang)!;
    if (editions.length === 0) continue;
    const other: Lang = lang === "id" ? "en" : "id";
    const otherDates = new Set(byLang.get(other)!.map((e) => e.slug));

    for (const e of editions) {
      write(outFile(editionPath(lang, e.slug)), renderEdition(cfg, e, otherDates.has(e.slug)));
      pages++;
    }
    write(outFile(homePath(lang)), renderHome(cfg, editions, lang));
    write(outFile(archivePath(lang)), renderArchive(cfg, editions, lang));
    write(outFile(aboutPath(lang)), renderAbout(cfg, lang));
    write(outFile(feedPath(lang)), renderFeed(cfg, editions, lang));
    pages += 4;
    console.log(`[site] ${lang}: ${editions.length} editions + home + archive + about + feed`);
  }

  const all = LANGS.flatMap((l) => byLang.get(l)!);
  write(path.join(OUT_DIR, "sitemap.xml"), renderSitemap(cfg, all));
  write(path.join(OUT_DIR, "robots.txt"), renderRobots(cfg));
  // GitHub Pages runs Jekyll by default, which drops paths beginning "_".
  write(path.join(OUT_DIR, ".nojekyll"), "");

  console.log(`[site] ${pages} pages → ${OUT_DIR}/  (base=${cfg.basePath || "/"}, url=${cfg.siteUrl})`);
  if (cfg.subscribeEndpoint && !cfg.privacyUrl) {
    console.warn(
      `[site] SUBSCRIBE_ENDPOINT is set but PRIVACY_URL is not — the subscribe form is disabled. ` +
        `Collecting an address needs a stated purpose and a policy to point at.`,
    );
  }
  // Check the resolved value, not the env var: a warning that fires when the
  // setting was supplied another way trains people to ignore warnings.
  if (!arg("--site-url") && !process.env.SITE_URL) {
    console.warn(`[site] SITE_URL is unset — canonical/OG/sitemap URLs point at localhost. Set it before publishing.`);
  }
}

main();
