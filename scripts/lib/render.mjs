// The one markdown+math renderer for tree bodies, shared by build-views.mjs
// (tree panels) and serve-vault.mjs (bridge answers). Two copies of the
// math-placeholder dance drifted once before — the line-wrap fix landed in
// one and not the other — so it lives here exactly once.
import katex from "katex";
import { marked } from "marked";

export const WIKILINK = /\[\[([^\[\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function renderMath(tex, displayMode) {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false, output: "html" });
  } catch {
    return escapeHtml(displayMode ? `$$${tex}$$` : `$${tex}$`);
  }
}

// Protect math from marked, turn wikilinks into panel-opening anchors when
// their target exists (`has(id)`), then let marked do the rest and splice the
// KaTeX back in.
export function renderBody(body, has) {
  const chunks = [];
  const stash = (html) => {
    chunks.push(html);
    return `%%KTX${chunks.length - 1}%%`;
  };
  let text = body.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) =>
    stash(renderMath(tex.trim(), true))
  );
  // Inline math survives a hard line-wrap (digest bodies wrap ~72 cols) —
  // but a blank line still terminates, so an unpaired $ can't eat a paragraph.
  text = text.replace(/(^|[^\\$])\$((?:[^$\n]|\n(?!\n))+?)\$/g, (m, pre, tex) =>
    pre + stash(renderMath(tex.replace(/\n/g, " "), false))
  );
  text = text.replace(WIKILINK, (_, target, label) => {
    target = target.trim();
    const shown = label ?? target;
    if (!has(target)) return escapeHtml(shown);
    return stash(
      `<a href="#" class="treelink" data-open="${escapeHtml(target)}">${escapeHtml(shown)}</a>`
    );
  });
  let html = marked.parse(text, { async: false });
  html = html.replace(/%%KTX(\d+)%%/g, (_, i) => chunks[Number(i)]);
  return html;
}
