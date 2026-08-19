/**
 * Escape-by-construction templating.
 *
 * The previous renderer called `esc()` by hand at roughly forty interpolation
 * points. One missed call was a cross-site scripting hole — and one was
 * missed: the JSON-LD block shipped a feed title unescaped and executed in a
 * browser. Fixing that instance left the pattern intact, which guarantees a
 * next instance.
 *
 * So escaping is no longer a thing anyone has to remember. `html` escapes
 * every interpolated value by default; the only way to emit raw markup is to
 * say so explicitly with `raw()`, which is greppable and reviewable.
 *
 * Nested `html` results carry an `Html` marker and pass through untouched, so
 * composing fragments does not double-escape. Arrays are joined, which also
 * removes a pile of `.join("")` noise from the call sites.
 *
 * The escaping is XML-compatible, so the same tag builds the RSS feed and the
 * sitemap. There is no second set of rules to keep in sync.
 */

/** A string that is already safe to emit. Only `raw` and `html` produce it. */
export class Html {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Mark a string as trusted markup.
 *
 * Only for content this codebase authored — the stylesheet, a pre-serialised
 * JSON-LD block. Never for anything that reached us from a feed, a model, or
 * an environment variable.
 */
export function raw(s: string): Html {
  return new Html(s);
}

function interpolate(v: unknown): string {
  if (v instanceof Html) return v.value;
  if (Array.isArray(v)) return v.map(interpolate).join("");
  // Rendering `false`/`null`/`undefined` as empty is what makes
  // `${cond && html`…`}` read naturally in a template.
  if (v === null || v === undefined || v === false || v === true) return "";
  return esc(String(v));
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): Html {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += interpolate(values[i]) + strings[i + 1];
  }
  return new Html(out);
}

/**
 * Serialise a value for embedding inside `<script type="application/ld+json">`.
 *
 * `JSON.stringify` does not escape `<` or `>`, so a source title containing
 * `</script><script>…` closes our tag and opens the attacker's. This was
 * verified executing in a browser: a feed title is third-party input and
 * discovery surfaces arbitrary domains, so it was reachable in normal
 * operation, not only under a crafted attack.
 *
 * Escaping the angle brackets to their \u form keeps the JSON semantically
 * identical — a parser reads back the same string — while making tag-breakout
 * impossible. U+2028 and U+2029 are escaped too: valid in JSON, but line
 * terminators in JavaScript.
 */
export function jsonLdScript(value: unknown): Html {
  const json = JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
  return raw(`<script type="application/ld+json">${json}</script>`);
}
