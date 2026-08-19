# Security

## Reporting

Report a vulnerability through GitHub's private advisory form on this
repository (Security → Report a vulnerability). Please do not open a public
issue for anything exploitable.

Include what you did, what happened, and — if you have one — a page or an
edition JSON that reproduces it. A URL is usually enough.

## What this project's threat model actually is

The published site is static HTML with **no JavaScript and no backend**. There
is no session, no login, and no user data stored in the page. That removes most
of the usual web attack surface, and leaves one that matters:

**Third-party text reaches the page.** Source titles come from feeds and from
a news index that surfaces arbitrary domains. That text is attacker-influenced
by construction — anyone who can publish a headline can choose its bytes.

That is not hypothetical. A source title containing `</script><script>…`
closed the JSON-LD block and executed in a browser, because `JSON.stringify`
does not escape `<`. It is fixed, and the fix is structural rather than
local:

- **Escape by construction.** `lib/site/html.ts` exports an `html` tagged
  template that escapes every interpolated value. Emitting raw markup requires
  saying `raw()`, which is greppable and reviewable. Nothing depends on a
  developer remembering to call an escape function at forty call sites.
- **A serialiser for script contexts.** `jsonLdScript()` escapes `<`, `>`,
  `&`, U+2028 and U+2029 to their `\u` forms. The JSON is semantically
  unchanged — a parser reads back the identical string — but tag-breakout is
  impossible.
- **Content Security Policy.** Every page ships `script-src 'none'`. The site
  has no JavaScript, so this costs nothing and would have neutralised the
  original defect outright. `form-action` is narrowed to the configured
  subscribe endpoint, so an injected form cannot exfiltrate elsewhere.
- **A structural check in CI.** `scripts/check-site.ts` fails the build if any
  page contains a `<script>` that is not the JSON-LD data block, or is missing
  its CSP. Both rules are exercised against a deliberately poisoned build.

## Reader data

The subscribe form is **withheld entirely** unless both `SUBSCRIBE_ENDPOINT`
and `PRIVACY_URL` are configured, and it requires an explicit consent
checkbox. Under Indonesia's PDP law consent is a precondition, not something
to add later, so the failure mode is "no form" rather than "a form that
quietly collects addresses".

No reader data is stored in this repository or in the published site.

## Secrets

The only secret this project needs is an LLM API key, supplied through the
environment (see `.env.example`). `.env*` is gitignored except the example.
`profile.json` — the reader profile sent to the model — is gitignored too, so
a fork never inherits someone else's.

If you find a key committed anywhere in the history, please report it
privately rather than opening an issue.

## Scope

In scope: anything that lets third-party content execute in a reader's
browser, escape its context, or reach a destination the site did not intend.

Out of scope: the content of any linked source, availability of upstream
feeds, and the accuracy of a briefing — accuracy is an editorial matter, and
[docs/EDITORIAL.md](docs/EDITORIAL.md) explains how corrections work.
