#!/usr/bin/env bun

/**
 * Bump version, regenerate CHANGELOG.md, then you tag + push for GitHub Release.
 *
 * Usage:
 *   bun run release              # auto bump from commits since last tag
 *   bun run release patch|minor|major
 *   bun run release 1.2.3        # explicit version override
 *
 * Then:
 *   git add package.json version.js CHANGELOG.md
 *   git commit -m "chore: release vX.Y.Z"
 *   git tag vX.Y.Z
 *   git push origin HEAD --tags
 */

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

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bump(version, kind) {
  const current = parseVersion(version);
  if (kind === "major") {
    return formatVersion({ major: current.major + 1, minor: 0, patch: 0 });
  }
  if (kind === "minor") {
    return formatVersion({
      major: current.major,
      minor: current.minor + 1,
      patch: 0,
    });
  }
  return formatVersion({
    major: current.major,
    minor: current.minor,
    patch: current.patch + 1,
  });
}

async function previousTag() {
  const tags = (await Bun.$`git tag --list "v*" --sort=-v:refname`.text())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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

function decideBumpKind(messages) {
  let kind = "patch";

  for (const message of messages) {
    if (isBreaking(message)) return "major";
    if (parseType(message) === "feat") kind = "minor";
  }

  return kind;
}

const arg = Bun.argv[2]?.replace(/^v/, "");
const pkgPath = "package.json";
const pkg = JSON.parse(await Bun.file(pkgPath).text());
const previous = pkg.version;
const tag = await previousTag();
const messages = await commitsSince(tag);

let version;
let bumpKind;

if (!arg) {
  bumpKind = decideBumpKind(messages);
  version = bump(previous, bumpKind);
} else if (["patch", "minor", "major"].includes(arg)) {
  bumpKind = arg;
  version = bump(previous, bumpKind);
} else if (/^\d+\.\d+\.\d+$/.test(arg)) {
  bumpKind = "explicit";
  version = arg;
} else {
  console.error(`Usage:
  bun run release
  bun run release patch|minor|major
  bun run release 1.2.3`);
  process.exit(1);
}

if (tag === `v${previous}` && messages.length === 0 && bumpKind !== "explicit") {
  console.error(
    `No commits since ${tag}. Nothing to release (or pass an explicit version).`,
  );
  process.exit(1);
}

pkg.version = version;
await Bun.write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
await Bun.$`bun scripts/write-version.js`;
await Bun.$`bun scripts/generate-changelog.js`;

console.log(`
Release prepared
  previous : ${previous}${tag ? ` (tag ${tag})` : ""}
  commits  : ${messages.length} since ${tag ?? "the beginning"}
  bump     : ${bumpKind}
  next     : ${version}

Next steps:
  git add package.json version.js CHANGELOG.md
  git commit -m "chore: release v${version}"
  git tag v${version}
  git push origin HEAD --tags

Pushing the tag triggers .github/workflows/release.yml to create the GitHub Release.
`);
