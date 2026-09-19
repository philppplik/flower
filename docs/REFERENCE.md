# Flower

A local-first image editor that turns selected areas into editable characters while preserving the source pixels in protected regions. English interface, deterministic rendering, no accounts, API keys, CDN assets, telemetry, or JavaScript package dependencies.

## Run

Requires Node.js 22 or newer. Double-click **Start Flower.cmd** on Windows, or run:

```sh
node server.mjs
```

Open http://127.0.0.1:5173/studio.html. Set `PORT` to change the port. Keep the server running while editing. No build or npm install is required. The included alpine illustration is an original bundled SVG, so the editor works without internet.

## Included

- PNG, JPEG, WebP, AVIF and BMP import, drag-and-drop, a bundled demo.
- Six character sets, custom Unicode characters, measured glyph-density ordering, independent spacing and size, density, rotation, edge-aware glyph selection.
- Original, monochrome, gradient and quantized color; contrast, brightness, gamma and saturation.
- Glow with highlight threshold, grain, scanlines and vignette; original underlay, glyph opacity, replacement amount and transparent background.
- Brush, eraser, rectangle and connected color-region selection; Shift to subtract. Protect selected regions, affect only selected regions, or ignore the mask.
- Invert, feather, expand/contract, bounded undo/redo, grayscale mask import/export.
- Original/ASCII/split comparison; hold Space for a temporary original view.
- Local AI foreground selection through the optional Python adapter below.
- Full-resolution PNG/JPEG/WebP, SVG with editable text glyphs, plain-text grid export, portable JSON looks.
- Responsive keyboard-accessible controls, background-worker analysis and stale-render cancellation.

## Optional local AI setup

The editor runs fully without Python. For automatic subject selection, use Python 3.11–3.13 and install the isolated environment:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-ai.txt
```

On macOS/Linux use `.venv/bin/python` for the second command. Restart the server and click **Protect → Select subject**. The server detects the local environment automatically; `ASCII_PYTHON` can override its executable path. First use downloads the U²-Net model (approximately 176 MB) into `.cache/models`; subsequent runs use the cached model. Images go only to the loopback server and are processed in memory. AI calls time out after five minutes and only one runs at a time.

`requirements-ai.lock.txt` records the exact validated Python environment. Use it instead of `requirements-ai.txt` to reproduce the tested versions. After installing and caching the model, `node scripts/ai-smoke.mjs` verifies the complete local HTTP → model → PNG mask pipeline.

The adapter uses the documented [rembg Python API](https://github.com/danielgatis/rembg), `new_session("u2net")`, and `remove(..., only_mask=True)`. It provides a single foreground mask, not named object detection or SAM click-to-segment. Color region is a deterministic connected color selection. Review and refine AI masks manually; model boundaries are not guaranteed to follow individual hairs.

## Editing and export details

Controls operate in preview pixels. Preview is limited to 1,400 pixels on the longest side. Exports rescale the grid to retain the same appearance and sample the full-resolution original. Source images are limited to 12 MP, 6,000 pixels per side and 30 MB; output is limited to 24 MP and 10,000 pixels per side. The engine limits a render to 650,000 grid cells. These bounds prevent accidental memory exhaustion.

Mask strokes use preview resolution and are expanded with nearest-neighbor sampling for export. Feather and expansion are applied before resizing. Fully protected pixels at original-size PNG export are copied from the decoded source RGBA buffer; partially selected edges are deliberately blended. JPEG is lossy. A resized output necessarily resamples original pixels. Browser decoding/color management can differ from a source file's encoded color profile.

SVG retains editable glyph text and embeds source/mask PNGs, so mixed photograph/vector exports are not entirely vector and may be large. It uses SVG glow rather than Canvas shadow blur; film grain is raster-only. Font rendering can vary between SVG applications. TXT exports the complete grid, without compositing, masks, color or effects. At 0% replacement, raster output is exactly the decoded original regardless of other appearance settings.

Looks store appearance settings only, not the image or painted mask. Save masks separately. Your current editing session lives in memory and is cleared when the page closes or reloads.

This release is a complete still-image editor. The specification's future ideas—depth estimation, named multi-object segmentation, video tracking, GPU rendering, batch processing and plugins—are not implemented.

## Tests

```sh
node --test tests/*.test.mjs
node scripts/check.mjs
```

Unit tests cover rendering, alpha-preserving compositing, connected regions, morphology, undo/redo, preset validation and SVG escaping. Integration tests exercise the actual local server, asset isolation, host/origin validation and segmentation input rejection.

The optional browser regression script uses Playwright. Install Playwright in a development environment, then run `node scripts/browser-test.mjs`, or set `PLAYWRIGHT_PATH` to an existing Playwright entry point. It launches its own test server and validates interactive rendering, masking, all export formats and a mobile layout.

## Architecture

| Module | Responsibility |
| --- | --- |
| `src/core/engine.js` | Pure cell analysis, tone/color mapping, deterministic density, premultiplied-alpha compositing |
| `src/core/mask.js` | Painting, connected selection, linear-time morphology, mask history |
| `src/core/settings.js` | Defaults, presets, bounded untrusted look import |
| `src/core/svg.js` | Self-contained editable vector export |
| `src/worker.js` | Image analysis away from the UI thread |
| `src/render.js` | Canvas glyph drawing, effects, exports |
| `src/app.js` | Editor state and interaction orchestration |
| `server.mjs` | Loopback-only static server and optional bounded AI bridge |
| `python/segment.py` | Replaceable foreground segmentation adapter |

The renderer and mask engine have no AI dependency. No network or third-party service is needed for manual editing. The server binds only to `127.0.0.1`; it is intentionally not an internet deployment server.
