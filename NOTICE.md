# NOTICE

This product is a derivative work.

## Upstream

Portions of this repository — the multi-source fetch layer, the pluggable LLM
backend abstraction (`lib/ai/backends/`), the trading/indicator modules, and the
original `daily-brief` report renderer — originate from:

    daily-brief
    Copyright (c) 2026 Eric
    https://github.com/leiting-eric/DailyBrief
    Licensed under the MIT License (see LICENSE)

The MIT License text is retained in full in [LICENSE](LICENSE). The upstream
copyright notice above must be preserved in all copies and substantial portions
of the software, including in any commercial distribution of this derivative.

## What is original to this repository

The following are original work and are **not** part of the upstream project:

- `lib/brief/` — the Indonesia energy & infrastructure editorial engine:
  domain taxonomy, structured briefing schema, evidence-linked composition,
  and the bilingual (id/en) strategic-brief prompts.
- `lib/site/` and `scripts/build-brief-site.ts` — the published website layer:
  per-edition permalinks, SEO metadata, JSON-LD, sitemap, and per-locale feeds.
- `sources.energy.json` — the curated Indonesia energy/infrastructure source
  registry.
- The editorial standards in `docs/EDITORIAL.md`.

## Source content

This product does not republish source articles. Each briefing states its own
analysis and links out to the original publisher. See `docs/EDITORIAL.md` for
the sourcing and attribution rules the engine enforces.
