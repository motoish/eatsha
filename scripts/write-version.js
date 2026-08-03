#!/usr/bin/env bun

/** Write version.js from package.json for the static site footer. */

const pkg = JSON.parse(await Bun.file("package.json").text());
const version = pkg.version ?? "0.0.0";

await Bun.write(
  "version.js",
  `window.__EATSHA_VERSION__ = ${JSON.stringify(version)};\n`,
);

console.log(`Wrote version.js → ${version}`);
