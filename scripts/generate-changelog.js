#!/usr/bin/env bun

/**
 * Regenerate CHANGELOG.md from git history (Keep a Changelog style).
 * Called by `bun run release`.
 *
 * - New version section = commits since previous version tag
 * - Older version sections are preserved
 * - Conventional Commit type → Keep a Changelog group:
 *     feat  → Added
 *     fix   → Fixed
 *     chore / docs / … → Changed
 */

const REPO_URL = "https://github.com/motoish/eatsha";
const pkg = JSON.parse(await Bun.file("package.json").text());
const VERSION = pkg.version ?? "0.0.0";
const RELEASE_DATE = (
  await Bun.$`git log -1 --format=%ad --date=short`.text()
).trim();

function parseType(message) {
  const match = message.match(/^(\w+)(\(.+\))?!?:\s/);
  return match?.[1]?.toLowerCase() ?? "";
}

function isBreaking(message) {
  return (
    /^(\w+)(\(.+\))?!:\s/.test(message) ||
    /BREAKING CHANGE/i.test(message)
  );
}

function classify(messages) {
  const added = [];
  const changed = [];
  const fixed = [];
  const other = [];

  for (const message of messages) {
    const type = parseType(message);

    if (type === "feat") {
      added.push(message);
      continue;
    }
    if (type === "fix") {
      fixed.push(message);
      continue;
    }
    if (
      ["chore", "refactor", "style", "docs", "perf", "ci", "build", "test"].includes(
        type,
      )
    ) {
      changed.push(message);
      continue;
    }
    other.push(message);
  }

  return { added, changed, fixed, other };
}

function section(title, items) {
  if (items.length === 0) return "";
  return `### ${title}\n\n${items.map((item) => `- ${item}`).join("\n")}\n\n`;
}

function renderVersionBody(messages) {
  const { added, changed, fixed, other } = classify(messages);
  return [
    section("Added", added),
    section("Changed", changed),
    section("Fixed", fixed),
    section("Other", other),
  ]
    .filter(Boolean)
    .join("");
}

async function previousTag(currentVersion) {
  const tags = (await Bun.$`git tag --list "v*" --sort=-v:refname`.text())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((tag) => tag !== `v${currentVersion}`);

  return tags[0] ?? null;
}

async function commitsSince(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const log = await Bun.$`git log ${range} --reverse --format=%s`.text();
  return log
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((message) => !/^chore:\s*release\b/i.test(message));
}

function extractOlderSections(changelog, currentVersion) {
  if (!changelog) return "";

  const parts = changelog.split(/\n(?=## \[)/);
  const older = parts.filter((part) => {
    const heading = part.match(/^## \[([^\]]+)\]/);
    if (!heading) return false;
    const name = heading[1];
    return name !== "Unreleased" && name !== currentVersion;
  });

  return older.length ? `${older.join("\n").trim()}\n\n` : "";
}

function buildCompareLinks(version, olderSections) {
  const versions = [version];
  for (const match of olderSections.matchAll(/## \[(\d+\.\d+\.\d+)\]/g)) {
    versions.push(match[1]);
  }

  const unique = [...new Set(versions)];
  const lines = [
    `[unreleased]: ${REPO_URL}/compare/v${unique[0]}...HEAD`,
  ];

  for (let i = 0; i < unique.length; i += 1) {
    const current = unique[i];
    const previous = unique[i + 1];
    if (previous) {
      lines.push(
        `[${current}]: ${REPO_URL}/compare/v${previous}...v${current}`,
      );
    } else {
      lines.push(`[${current}]: ${REPO_URL}/releases/tag/v${current}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

const tag = await previousTag(VERSION);
const messages = await commitsSince(tag);
const body = renderVersionBody(messages);

let existing = "";
try {
  existing = await Bun.file("CHANGELOG.md").text();
} catch {
  existing = "";
}

const olderSections = extractOlderSections(existing, VERSION);

const changelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Entries use original git commit messages, grouped by Conventional Commit type:
\`feat\` → Added, \`chore\` → Changed, \`fix\` → Fixed.

## [Unreleased]

## [${VERSION}] - ${RELEASE_DATE}

${body || "### Changed\n\n- No user-facing commits since the previous release.\n\n"}${olderSections}${buildCompareLinks(VERSION, olderSections)}`;

await Bun.write("CHANGELOG.md", changelog);

console.log(
  `Updated CHANGELOG.md for v${VERSION} (${messages.length} commits since ${tag ?? "the beginning"})`,
);
