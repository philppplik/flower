# Contributing to Flower

Thanks for helping Flower grow. Small, focused improvements are welcome.

## Development

1. Fork the repository and create a descriptive branch, such as `fix/mask-edge`.
2. Use Node.js 22 or 24. Run `npm ci` to install development-only browser tooling.
3. Run `npm start` and open `http://127.0.0.1:5173/studio.html`.
4. Keep rendering and mask algorithms in `src/core/`, free of browser and AI dependencies.
5. Add regression tests for behavioral changes. For interface changes, verify keyboard use, reduced motion, and narrow mobile layouts.

```sh
npm run check
npm test
npx playwright install chromium
npm run test:browser
node scripts/pages-test.mjs
npm audit --audit-level=high
```

Use `npm run test:ai` only after installing the optional Python environment and caching U²-Net. Standard CI intentionally does not download or run the large model.

## Pull requests

- Open an issue first for major features or architectural changes.
- Keep the title concise and describe the final user-visible behavior.
- Use conventional commit prefixes such as `feat:`, `fix:`, `docs:`, or `test:`.
- Include reproduction steps and relevant validation. Add before/after screenshots for visual changes.
- Update `CHANGELOG.md` and the affected documentation.
- Never commit private images, virtual environments, model weights, tokens, or generated release archives.
- Preserve original pixels in fully protected regions. Do not replace deterministic rendering with generative image editing.

Contributions are licensed under the repository's MIT license. Be kind, focus feedback on the work, respect privacy, and make the project welcoming to people with different experience levels.
