// Crea demo/index.html: l'intera app in un unico file da aprire con doppio clic.
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "rolldown";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = await mkdtemp(path.join(tmpdir(), "scadenziario-demo-"));

await build({
  input: path.join(root, "demo/src/main.tsx"),
  resolve: { alias: { "@": path.join(root, "src") } },
  transform: { jsx: { runtime: "automatic" }, define: { "process.env.NODE_ENV": '"production"' } },
  output: { file: path.join(out, "app.js"), format: "iife", minify: true },
  onwarn: (w, def) => { if (w.code !== "MODULE_LEVEL_DIRECTIVE") def(w); },
});
const js = await readFile(path.join(out, "app.js"), "utf8");
await rm(out, { recursive: true, force: true });

const cssFile = path.join(root, "demo/src/styles.css");
const css = (await postcss([tailwind({ base: root, optimize: { minify: true } })]).process(await readFile(cssFile, "utf8"), { from: cssFile })).css;
const icon = Buffer.from(await readFile(path.join(root, "public/icon.svg"))).toString("base64");

const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#1d4ed8">
<title>Scadenziario Pro – versione locale</title>
<link rel="icon" href="data:image/svg+xml;base64,${icon}">
<style>${css}</style>
</head>
<body class="min-h-screen antialiased">
<div id="root"></div>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>
</body>
</html>
`;
await writeFile(path.join(root, "demo/index.html"), html);
console.log(`demo/index.html creato (${Math.round(html.length / 1024)} KB)`);
