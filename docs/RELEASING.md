# Releasing Flower

1. Update `package.json`, its lockfile, and `CHANGELOG.md`. Use semantic versions.
2. Run syntax checks, unit tests, the browser suite, the Pages subpath suite, and `npm audit`. Run optional AI smoke tests when that adapter or its dependency lock changes.
3. Review the staged diff and file list. Exclude environments, model caches, user photos, test outputs, and old archives.
4. Merge the reviewed change to `main`. Wait for **Verify and publish** to succeed on the exact commit being released.
5. Create an annotated `vX.Y.Z` tag on that commit. Create the release ZIP with `git archive`, so only tracked source enters the package.
6. Calculate SHA-256 for the ZIP. Publish a GitHub release with clear changes, installation instructions, compatibility notes, and the ZIP/checksum files.
7. Verify the public Pages site, studio assets, release assets, and repository links after deployment.

GitHub Actions are pinned to immutable commits. Dependabot proposes dependency and action updates. Workflows have read-only permissions by default; only the Pages deployment job receives Pages/OIDC write access. Pull requests run checks but cannot deploy.

The release source archive does not bundle Python packages or model weights. These are installed separately; document their versions and provenance in the release notes when relevant.
