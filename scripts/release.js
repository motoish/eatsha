#!/usr/bin/env bun

/**
 * Bump version, regenerate CHANGELOG.md, then you tag + push for GitHub Release.
 *
 * Usage:
 *   bun run release 1.1.0
 *
 * Then:
 *   git add package.json CHANGELOG.md
 *   git commit -m "chore: release v1.1.0"
 *   git tag v1.1.0
 *   git push origin HEAD --tags
 */

const version = Bun.argv[2]?.replace(/^v/, "");

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: bun run release 1.1.0");
  process.exit(1);
}

const pkgPath = "package.json";
const pkg = JSON.parse(await Bun.file(pkgPath).text());
const previous = pkg.version;
pkg.version = version;
await Bun.write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

await Bun.$`bun scripts/generate-changelog.js`;

console.log(`
Version bumped: ${previous} → ${version}
CHANGELOG.md regenerated.

Next steps:
  git add package.json CHANGELOG.md
  git commit -m "chore: release v${version}"
  git tag v${version}
  git push origin HEAD --tags

Pushing the tag triggers .github/workflows/release.yml to create the GitHub Release.
`);
