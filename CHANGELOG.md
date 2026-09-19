# Changelog

All notable changes are recorded here. Flower uses semantic versioning.

## [1.0.0] - 2026-09-19

### Added

- Flower identity, original botanical artwork, and separate interactive landing page.
- Guided five-step onboarding with spotlight popovers, skip/restart, keyboard focus management, and local completion preference.
- Browser-only studio on GitHub Pages; optional local AI subject selection through U²-Net.
- Deterministic ASCII rendering, four looks, six character-set choices including custom, edge-aware glyph selection, color and finishing controls.
- Manual brush, eraser, rectangle, connected region selection, feathering, morphology, mask import/export and undo/redo.
- Original/split/result comparison and full-resolution PNG, JPEG, WebP, editable-text SVG and TXT exports.
- Responsive studio with progressive disclosure and a persistent mobile preview.
- Unit/server tests, desktop/mobile browser regression, real optional AI smoke test, and GitHub Pages subpath regression.
- Reproducible development dependencies, CI-gated Pages deployment, contribution and security documentation, and MIT license by Philipp Paulik.

### Scope

This release handles still images. Depth estimation, video tracking, named multi-object detection, and GPU/batch rendering are not included. SVG effects and fonts can differ from raster output; see the [reference](docs/REFERENCE.md).

[1.0.0]: https://github.com/philppplik/flower/releases/tag/v1.0.0
