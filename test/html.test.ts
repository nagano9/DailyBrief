import { test } from "node:test";
import assert from "node:assert/strict";

import { esc, html, jsonLdScript, raw, Html } from "../lib/site/html";

/**
 * The escaping layer carries the whole XSS defence, so it is tested against
 * the payload that actually got through before it existed.
 */

test("html escapes interpolated values by default", () => {
  const hostile = `<script>alert(1)</script>`;
  const out = html`<p>${hostile}</p>`.value;
  assert.equal(out, "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  assert.ok(!out.includes("<script>"));
});

test("html escapes attribute-breaking characters", () => {
  const out = html`<a title="${`" onmouseover="alert(1)`}">x</a>`.value;
  assert.ok(!out.includes(`" onmouseover`));
  assert.ok(out.includes("&quot;"));
});

test("raw passes markup through untouched", () => {
  assert.equal(html`${raw("<b>bold</b>")}`.value, "<b>bold</b>");
});

test("nested html results are not double-escaped", () => {
  const inner = html`<em>${"a & b"}</em>`;
  assert.equal(html`<p>${inner}</p>`.value, "<p><em>a &amp; b</em></p>");
});

test("arrays are joined, not comma-separated", () => {
  const items = ["a", "b"].map((x) => html`<li>${x}</li>`);
  assert.equal(html`<ul>${items}</ul>`.value, "<ul><li>a</li><li>b</li></ul>");
});

test("null, undefined and false render as empty so conditionals read naturally", () => {
  assert.equal(html`[${null}${undefined}${false}]`.value, "[]");
});

test("numbers render, and are escaped as strings would be", () => {
  assert.equal(html`<span>${42}</span>`.value, "<span>42</span>");
});

test("html returns an Html marker, so it composes without re-escaping", () => {
  assert.ok(html`x` instanceof Html);
  assert.ok(raw("x") instanceof Html);
});

test("esc covers all five HTML-significant characters", () => {
  assert.equal(esc(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});

test("jsonLdScript prevents script-tag breakout", () => {
  // The exact title that executed in a browser before the fix.
  const hostile = "Laporan Energi</script><script>window.__PWNED__=1</script>";
  const out = jsonLdScript({ headline: hostile }).value;
  assert.ok(!out.includes("</script><script>"), "payload must not close our tag");
  assert.ok(out.includes("\\u003c"), "angle brackets must be \\u-escaped");
});

test("jsonLdScript escaping is lossless — a parser reads the original string back", () => {
  const hostile = "Laporan </script> & <b>markup</b>";
  const out = jsonLdScript({ headline: hostile }).value;
  const json = out.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
  assert.equal((JSON.parse(json) as { headline: string }).headline, hostile);
});

test("jsonLdScript escapes JavaScript line terminators", () => {
  const out = jsonLdScript({ x: "a\u2028b\u2029c" }).value;
  assert.ok(out.includes("\\u2028"));
  assert.ok(out.includes("\\u2029"));
  assert.ok(!out.includes("\u2028"));
});
