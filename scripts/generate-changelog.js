#!/usr/bin/env bun

/**
 * Regenerate CHANGELOG.md from git history (Keep a Changelog style).
 * Called by `bun run release` — not intended for everyday commits.
 */

const REPO_URL = "https://github.com/motoish/eatsha";
const VERSION = JSON.parse(await Bun.file("package.json").text()).version ?? "0.0.0";
const RELEASE_DATE = (
  await Bun.$`git log -1 --format=%ad --date=short`.text()
).trim();

const log = await Bun.$`git log --reverse --format=%s`.text();
const messages = log
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const added = [];
const changed = [];
const fixed = [];
const other = [];

for (const message of messages) {
  const lower = message.toLowerCase();

  if (
    lower.startsWith("feat:") ||
    lower.startsWith("feat(") ||
    /\badd\b/.test(lower)
  ) {
    added.push(message);
    continue;
  }

  if (
    lower.startsWith("fix:") &&
    (/\bremove\b/.test(lower) || /\bfit\b/.test(lower) || /\bbug\b/.test(lower))
  ) {
    fixed.push(message);
    continue;
  }

  if (
    lower.startsWith("fix:") ||
    lower.startsWith("chore:") ||
    lower.startsWith("refactor:") ||
    lower.startsWith("style:") ||
    lower.startsWith("docs:")
  ) {
    changed.push(message);
    continue;
  }

  other.push(message);
}

function section(title, items) {
  if (items.length === 0) return "";
  return `### ${title}\n\n${items.map((item) => `- ${item}`).join("\n")}\n\n`;
}

const body = [
  section("Added", added),
  section("Changed", changed),
  section("Fixed", fixed),
  section("Other", other),
]
  .filter(Boolean)
  .join("");

const changelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries below use the original git commit messages.

## [Unreleased]

## [${VERSION}] - ${RELEASE_DATE}

${body}[unreleased]: ${REPO_URL}/compare/v${VERSION}...HEAD
[${VERSION}]: ${REPO_URL}/releases/tag/v${VERSION}
`;

await Bun.write("CHANGELOG.md", changelog);
console.log(`Updated CHANGELOG.md from ${messages.length} commits → v${VERSION}`);
