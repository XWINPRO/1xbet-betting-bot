// Repère les textes d'interface non traduits (hors t(), tn(), msg()).
// Usage : node scripts/i18n-scan.mjs [fichiers ou dossiers…]
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../src/", import.meta.url).pathname;
const args = process.argv.slice(2);
const files = [];
function walk(p) {
  if (statSync(p).isDirectory()) for (const n of readdirSync(p)) walk(join(p, n));
  else if (/\.(ts|tsx)$/.test(p) && !p.includes("/i18n/") && !p.includes("/types/")) files.push(p);
}
(args.length ? args.map((a) => (a.startsWith("/") ? a : join(process.cwd(), a))) : [root]).forEach(walk);

const SKIP_ATTRS = new Set(["className", "key", "href", "src", "type", "id", "name", "variant", "size", "tone", "role", "htmlFor", "target", "rel", "autoComplete", "inputMode", "method", "action", "lang", "dir", "accept", "pattern", "form", "icon", "align", "side", "fill", "stroke", "d", "viewBox", "xmlns", "strokeWidth", "strokeLinecap", "strokeLinejoin", "transform", "points", "mode", "param", "value", "defaultValue", "position", "data-state", "kind", "status", "preload", "loading", "decoding", "sizes", "crossOrigin", "as", "content", "property", "media", "rx", "cx", "cy", "r", "x", "y", "width", "height", "tabIndex", "aria-hidden", "aria-current", "aria-live", "enterKeyHint", "capture", "colSpan", "rowSpan", "scope", "datetime", "dateTime", "step", "min", "max", "maxLength", "minLength", "fallback", "storageKey", "bucket", "folder", "path", "next"]);
const SKIP_CALLS = new Set(["t", "tn", "msg", "require", "import", "cn", "cva", "clsx", "redirect", "revalidatePath", "from", "rpc", "select", "eq", "neq", "in", "order", "or", "is", "not", "ilike", "like", "gte", "lte", "gt", "lt", "range", "limit", "channel", "on", "storage", "get", "set", "has", "delete", "getItem", "setItem", "removeItem", "querySelector", "addEventListener", "removeEventListener", "createElement", "push", "replace", "startsWith", "endsWith", "includes", "split", "join", "padStart", "toLocaleString", "Error", "useState", "cookies", "headers", "fetch", "encodeURIComponent", "URL", "URLSearchParams", "searchParams", "append", "matchMedia", "getContext", "toDataURL", "toBlob", "upload", "createSignedUrl", "getPublicUrl", "dynamic", "z.enum", "enum", "literal", "safeParse", "parse", "match", "test", "filter", "Intl", "DateTimeFormat", "NumberFormat", "warn", "log", "info", "debug", "assert", "setAttribute", "getAttribute", "postMessage", "rpcAction", "textSearch", "contains", "update", "insert", "upsert", "single", "maybeSingle", "useForm", "router.push", "toast.promise"]);
const natural = (s) => {
  const v = s.trim();
  if (v.length < 2 || !/[A-Za-zÀ-ÿ]{2,}/.test(v)) return false;
  if (/^(https?:|\/|#|@|\.|mailto:|tel:|data:|[a-z0-9_.-]+(\/[a-z0-9_.\-[\]]+)+$)/.test(v)) return false;
  if (/^[a-z0-9_.:-]+$/.test(v)) return false; // identifiants, codes, classes
  if (/^[A-Z0-9_]+$/.test(v)) return false;
  if (/^[\w-]+(\s+[\w:/[\]().%#,-]+)*$/.test(v) && /(^|\s)(flex|grid|text-|bg-|border|px-|py-|h-|w-|size-|rounded|font-|mt-|mb-|gap-|items-|justify-|inline|hidden|block|shadow|ring|absolute|relative)/.test(v)) return false;
  return /[a-zà-ÿ]/.test(v) && (/\s/.test(v) || /^[A-ZÀ-Ý]/.test(v) || /[à-ÿ]/.test(v));
};

let total = 0;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hits = [];
  const report = (node, text) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
    hits.push(`${line + 1}: ${text.trim().replace(/\s+/g, " ").slice(0, 110)}`);
  };
  const calleeName = (call) => {
    const e = call.expression;
    if (ts.isIdentifier(e)) return e.text;
    if (ts.isPropertyAccessExpression(e)) return ts.isIdentifier(e.expression) ? `${e.expression.text}.${e.name.text}` : e.name.text;
    return "";
  };
  const skipped = (node) => {
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isCallExpression(p)) {
        const n = calleeName(p);
        const short = n.split(".").pop();
        if (SKIP_CALLS.has(n) || SKIP_CALLS.has(short)) return true;
        return false;
      }
      if (ts.isJsxAttribute(p)) return SKIP_ATTRS.has(p.name.getText());
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isTypeNode(p) || ts.isLiteralTypeNode?.(p)) return true;
      if (ts.isPropertyAssignment(p) && ["className", "key", "href", "path", "icon", "tone", "kind", "status", "value", "id", "type", "method", "variant"].includes(p.name.getText())) return true;
      if (ts.isElementAccessExpression(p) || ts.isCaseClause(p)) return true;
      if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(p.operatorToken.kind)) return true;
      if (ts.isBlock(p) || ts.isSourceFile(p)) return false;
    }
    return false;
  };
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      if (natural(node.getText())) report(node, node.getText());
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (natural(node.text) && !skipped(node) && !(node.parent && ts.isExpressionStatement(node.parent))) report(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(" … ");
      if (natural(parts.replace(/…/g, "")) && /[a-zà-ÿ]{3,}\s/.test(parts) && !skipped(node)) report(node, "`" + parts + "`");
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (hits.length) {
    total += hits.length;
    console.log(`\n${relative(root, file)}`);
    for (const h of hits) console.log("  " + h);
  }
}
console.log(`\n${total} textes non traduits`);
