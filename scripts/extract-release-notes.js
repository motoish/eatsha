#!/usr/bin/env bun

/**
 * Extract one version section from CHANGELOG.md for GitHub Releases.
 * Usage: bun scripts/extract-release-notes.js v1.0.0
 */

const tag = Bun.argv[2] ?? "";
const version = tag.replace(/^v/, "");

if (!version) {
  console.error("Usage: bun scripts/extract-release-notes.js v1.0.0");
  process.exit(1);
}

const changelog = await Bun.file("CHANGELOG.md").text();
const heading = `## [${version}]`;
const start = changelog.indexOf(heading);

if (start === -1) {
  console.log(`Release ${tag}\n\nSee CHANGELOG.md for details.`);
  process.exit(0);
}

const afterHeading = changelog.slice(start);
const nextHeading = afterHeading.search(/\n## \[/);
const section =
  nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading);

// Drop the trailing compare-link block if this is the last section before links.
const body = section
  .replace(/^## \[[^\]]+\][^\n]*\n+/, "")
  .replace(/\n\[[^\]]+\]:[\s\S]*$/, "")
  .trim();

console.log(body || `Release ${tag}`);
