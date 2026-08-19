# AGENTS.md

Operational knowledge for any AI coding agent working on this repo (Claude Code, Codex, Cursor, Continue.dev, Aider, etc.). Claude Code users get a richer SKILL.md auto-loaded; this file is the universal subset everyone reads.

## What this project is

This repository now carries **two pipelines**. Know which one you are in.

### 1. The strategic intelligence radar (the product) — `lib/brief/`, `lib/site/`

A daily briefing across three domains (AI / energy / corporate-BUMN),
published as a bilingual (id/en) website. **Not an RSS summariser.** Six
tiers: must-monitor sources, open discovery, emerging signal (arXiv, GitHub
releases, HN), verification, strategic reasoning, longitudinal signal memory.

Read [docs/EDITORIAL.md](docs/EDITORIAL.md) before changing anything in
`lib/brief/`. Most rules there are enforced by code, and weakening one
silently is the worst thing you can do to this repo.

Non-negotiables:

- **Never publish an uncited signal.** `compose.ts` `resolveSignals()` drops
  signals whose indices do not resolve; `assembleEdition` throws below
  `BRIEF_MIN_SIGNALS`. Do not "repair" a bad index by dropping it and keeping
  the claim.
- **Corroboration and trend status are computed, never model-asserted.** If
  you find yourself adding a `corroboration` or `trend` field to the prompt
  schema, stop — a model that grades its own evidence grades it generously.
- **`signals/history.jsonl` is append-only.** Duplicates from re-runs are
  collapsed on read (`loadHistory`). Never rewrite or prune it: a trend that
  can be silently revised is not evidence.
- **`primary` is decided at fetch time, not from source tier.** A tier-1 RSS
  feed is the institution itself; a tier-1 *discovery* query returns whoever
  the index surfaced. Conflating them graded 14% of tier-1 items as primary
  when they were not.
- **Trend matching uses `themeKey`, never headline similarity.** Lexical
  fingerprinting measured 0/10 recall on realistic same-theme headlines. If a
  test for tier 6 passes using identical headlines across dates, the test is
  wrong, not the feature.
- **Build markup with the `html` tag from `lib/site/html.ts`.** It escapes
  every interpolation; `raw()` is the only way out and is meant to be
  greppable. Do not reintroduce hand-called `esc()` at interpolation points —
  that pattern shipped a browser-executing XSS once, and one missed call is
  all it takes.
- **Never emit untrusted strings into a `<script>` block.** Use
  `jsonLdScript()`. `JSON.stringify` does not escape `<`.
- **`npm test` must stay offline.** Typecheck, unit tests, the offline
  self-test, and the site structure check all run with no network and no API
  key. A CI that fails because a feed was slow stops being read.
- **Never write source excerpts into `editions/`.** Excerpts live in `.cache/`
  (gitignored) — inputs, not output.
- **`sources.radar.json` is the only place radar sources live.** The registry
  validator refuses to load if any domain has no enabled tier-1 source.
- **`editions/` and `signals/` are committed.** `site/` is disposable.

Commands: `npm run brief` (run the radar), `npm run site` (build),
`npm run brief:dry-run` (fetch + pool composition report, no LLM),
`npm run brief:selftest` (full validation surface against fixtures, no LLM).

Adding a source: append to `sources.radar.json` with `type` one of
`rss | gnews | arxiv | github-releases | hn`, then run
`npm run brief:dry-run` and check the pool mix actually improved. Volume is
not improvement.

### 2. The upstream digest — `lib/sources/`, `lib/output/`, `scripts/daily.ts`

`daily-brief` is a local-first pipeline that fetches 23 RSS / API news sources daily (22 in en mode after locale filtering), runs LLM enrichment, and renders a single self-contained HTML report. It runs on the user's machine via the OS scheduler, OR in GitHub Actions publishing to GitHub Pages. No web framework, no DB, no servers.

The repo's `CLAUDE.md` includes this file via `@AGENTS.md`. Don't add stack-specific lore (Next.js, etc.) — there's none in this codebase, and the brief engine's site layer is deliberately plain TypeScript templating for the same reason.

The two pipelines share only `lib/ai/` (the LLM backend switch) and
`curlFetch`. Keep it that way: the separation is what lets upstream merges
stay clean.

## Project layout (essentials)

```
lib/
  ai/           # LLM dispatcher + 5 backend implementations + prompts
  sources/      # fetcher dispatch + per-source TS modules
  trading/      # Yahoo finance + technical indicators + watchlist
  output/       # render.ts (HTML+MD generation), all CSS inlined
  utils.ts      # tiny shared helpers (todayKey, getReportTz)
scripts/
  _env.ts             # dotenv preload — imported FIRST by every entry script
  daily.ts            # main pipeline (5-8 min, ~6 LLM calls)
  dry-run.ts          # fetch-only validation (~30s, no LLM)
  render.ts           # re-render HTML/MD from cached sidecar (~1s)
  regen-trading.ts    # rerun just the trading commentary
  regen-enrich.ts     # top up missing summaries for a subgroup
  build-site.mjs      # generate index.html + archive.html for static hosting
  deploy.mjs          # scp HTML to a remote nginx host (opt-in)
  sources.ts          # `npm run sources` — list/validate sources.config.json
  install.mjs         # cross-platform OS scheduler registration
  run-daily.mjs       # scheduler wrapper (daily + log + deploy + open)
  open-report.mjs     # cross-platform "open latest report" helper
  uninstall.mjs       # tear down scheduler + ~/.claude/ links
  quota-report.ts     # LLM call usage summary
sources.config.json   # SINGLE SOURCE OF TRUTH for the source registry
```

## Core invariants

1. **`sources.config.json` is the only place sources live.** `lib/sources/registry.ts` is just a JSON loader + locale filter. Never hardcode a source list in TS.

2. **LLM calls go through `lib/ai/llm.ts` `runLlm()`.** Five backends behind `LLM_BACKEND` env var: `claude-cli` (default), `anthropic`, `openai`, `deepseek`, `minimax`. Never import a specific backend directly — that defeats the switch.

3. **Date keying uses `lib/utils.ts` `todayKey()`.** Honors `REPORT_TZ` env var; defaults to system local TZ. Don't hardcode `Asia/Shanghai` or `UTC` anywhere.

4. **Localization via `REPORT_LOCALE` (`zh` | `en`).** All UI text in render.ts goes through `STR.<key>`; LLM prompts have ZH/EN pairs picked at module-init. When adding strings, add both.

5. **Per-source fetch errors are non-fatal.** `scripts/daily.ts` has a try/catch per source. Never `process.exit()` inside a fetcher.

6. **No agent-specific build steps.** No `next build`, no bundling. `tsx` runs TS directly. The HTML is hand-rendered, CSS is inlined string-templated.

## Commands

| Task | Command | Cost |
|---|---|---|
| Full pipeline | `npm run daily` | ~5-8 min, ~6 LLM calls |
| Fetch-only sanity check | `npm run dry-run` | ~30s, no LLM |
| Re-render from cache | `npm run render [date]` | <1s |
| Re-run trading section | `npm run regen-trading [date]` | ~2 min, 1 LLM call |
| Top up missing summaries | `npm run regen-enrich <cat:sub> [date]` | ~30s, 1 LLM call |
| Static-site generator | `npm run build-site` | <1s |
| List sources by status | `npm run sources` | instant |
| Validate sources.config.json | `npm run sources:check` | instant |

`[date]` defaults to today in `REPORT_TZ`. Output is `daily_reports/<date>/<date>.html` + `<date>.json` + `<date>-articles.json` (note the hyphen in the articles cache filename); add `<date>.md` if `OUTPUT_MARKDOWN=true`.

## Adding a source

1. Edit `sources.config.json` — append an entry. Fields: `id` (unique), `name`, `type` (`rss`/`api`/`scrape`), `url`, `category` (`tech`/`finance`/`politics`), optional `subcategory`, `enabled`, `useCurl`, `lang`, `locales`, `notes`.
2. For non-RSS types: add a fetcher in `lib/sources/<id>.ts` exporting `fetchXxx(sourceId)` returning `RawArticle[]`, then add a branch in `lib/sources/dispatch.ts`.
3. Run `npm run sources:check` to validate the JSON, then `npm run dry-run` to verify the fetch.

## Adding an LLM backend

1. New file `lib/ai/backends/<name>.ts` exporting a function compatible with the existing backends (see `claude-cli.ts` as the minimum reference).
2. Add a branch in `lib/ai/llm.ts` `runLlm()`.
3. Add `<NAME>_API_KEY` + optional `<NAME>_BASE_URL` to `.env.example`.

## Debugging a failed run

1. `logs/daily-<YYYY-MM-DD>.log` — full pipeline output for that day (date in local time, NOT UTC)
2. `logs/llm-calls.jsonl` — every LLM call with input size, latency, success, error category
3. `npm run quota-report` — usage summary by backend
4. If a tab renders wrong but the data is right, `npm run render` (1s) usually fixes display-only bugs without rerunning LLM

## What NOT to do

- Don't add Playwright / Puppeteer for fetching — the project stays light with curl + JSON APIs
- Don't import a specific LLM backend module directly; always go through `runLlm`
- Don't hardcode sources in TS — use `sources.config.json`
- Don't write into `daily_reports/` directly from agent code; let `scripts/daily.ts` or `render.ts` own that
- Don't add a web framework (Next.js, Express, etc.) — the project is intentionally static
- Don't bypass the per-source try/catch — let `daily.ts` aggregate failures

## Where to learn more

- `README.md` — user-facing intro, install, configuration
- `FORKING.md` — common customizations (LLM provider, sources, layout, styling)
- `.claude/skills/daily-brief/SKILL.md` — fuller operational reference (Claude Code auto-loads it; other agents can read it directly)
- `sources.config.json` — see what sources look like in practice
