/**
 * Repackage a web export so Cloudflare Pages can actually serve it.
 *
 * Metro emits every asset that lives inside a dependency under
 * `dist/assets/node_modules/…` — the icon font, Bloom's four `.woff2` faces,
 * expo-router's chrome, and `wa-sqlite.wasm`, which IS the storage engine on
 * web. Wrangler's Pages upload walks the directory and skips any `node_modules`
 * segment outright: measured on this project, 27 of 45 files never left the
 * machine, and a control file in a sibling directory did.
 *
 * Nothing errors when that happens. The SPA rewrite in `public/_redirects`
 * catches every one of those paths and answers `200 text/html`, so the fonts
 * silently fall back, the wasm fetch gets an HTML body, and the deployment
 * looks perfect from the outside.
 *
 * So the tree moves to `assets/vendor/…` — a name the uploader has no opinion
 * about — and `_redirects` rewrites `/assets/node_modules/*` onto it, which
 * leaves the emitted bundles untouched. Then this script proves the result:
 * nothing under a `node_modules` path survives in the output, and every asset
 * path the bundles reference resolves to a real file.
 *
 * Run after `expo export`, on the deploy path only. The Electron build serves
 * the export straight off disk through its own `app://` protocol, with no
 * rewrite engine in front of it, so it must keep the paths Metro emitted.
 */

import { existsSync, readFileSync, renameSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

const REFERENCE_PATTERN = /assets\/node_modules\/([A-Za-z0-9@._/-]+)/g;
const SCANNED_EXTENSIONS = [".js", ".css", ".html", ".json"];

const distDir = resolve(process.argv[2] ?? "dist");
const vendored = join(distDir, "assets", "vendor");
const emitted = join(distDir, "assets", "node_modules");

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await filesUnder(path)));
    } else {
      found.push(path);
    }
  }
  return found;
}

function fail(message: string): never {
  console.error(`pack-pages: ${message}`);
  process.exit(1);
}

if (!existsSync(join(distDir, "index.html"))) {
  fail(`${distDir} holds no index.html — run \`expo export --platform web\` first.`);
}

if (existsSync(emitted)) {
  if (existsSync(vendored)) {
    fail(
      `both ${emitted} and ${vendored} exist — a previous run was interrupted, ` +
        "so delete the export and rebuild rather than merging two trees.",
    );
  }
  renameSync(emitted, vendored);
} else if (!existsSync(vendored)) {
  fail(
    "the export carries no dependency assets at all, under either name — the " +
      "asset layout changed, and this script's assumption with it.",
  );
}

const files = await filesUnder(distDir);

const stragglers = files.filter((file) =>
  file.slice(distDir.length).split(sep).includes("node_modules"),
);
if (stragglers.length > 0) {
  fail(
    `${stragglers.length} file(s) still sit under a node_modules path and would ` +
      `never be uploaded, starting with ${stragglers[0]}`,
  );
}

const referenced = new Set<string>();
for (const file of files) {
  if (!SCANNED_EXTENSIONS.some((extension) => file.endsWith(extension))) continue;
  const contents = readFileSync(file, "utf8");
  for (const match of contents.matchAll(REFERENCE_PATTERN)) {
    referenced.add(match[1]);
  }
}

if (referenced.size === 0) {
  fail(
    "no bundle references an `assets/node_modules/` path — either the export " +
      "stopped emitting them (making this step and the rewrite rule dead) or the " +
      "reference format changed, which would make this check vacuous.",
  );
}

const unresolved = [...referenced].filter((relative) => {
  const target = join(vendored, relative);
  return !existsSync(target) || !statSync(target).isFile();
});
if (unresolved.length > 0) {
  fail(
    `${unresolved.length} referenced asset(s) have no file under assets/vendor, ` +
      `starting with ${unresolved[0]}`,
  );
}

const redirects = join(distDir, "_redirects");
if (!existsSync(redirects)) {
  fail("_redirects is missing from the export — the rewrite cannot be in force.");
}
const rules = readFileSync(redirects, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"));
const rewriteIndex = rules.findIndex((rule) =>
  /^\/assets\/node_modules\/\*\s+\/assets\/vendor\/:splat\s+200$/.test(rule),
);
const catchAllIndex = rules.findIndex((rule) =>
  /^\/\*\s+\/index\.html\s+200$/.test(rule),
);
if (rewriteIndex === -1) {
  fail("_redirects carries no /assets/node_modules/* -> /assets/vendor/:splat rewrite.");
}
if (catchAllIndex !== -1 && catchAllIndex < rewriteIndex) {
  fail(
    "the SPA catch-all precedes the asset rewrite in _redirects, so it wins and " +
      "every dependency asset answers with index.html.",
  );
}

console.log(
  `pack-pages: ${referenced.size} referenced dependency assets resolve under ` +
    `assets/vendor, across ${files.length} files.`,
);
