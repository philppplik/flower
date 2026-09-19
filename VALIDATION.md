# Validation record

Validated on Windows with Node.js 24.14.0, Python 3.13 and Microsoft Edge through Playwright.

- **32 / 32 unit and server integration tests passed**, including onboarding persistence, viewport positioning and separate landing/studio routes.
- **All JavaScript modules passed syntax checks.**
- **Desktop and mobile browser regression passed:** interactive landing, the complete five-step popover tour, welcome persistence, demo loading, look changes, split-view dragging, rectangle masks, undo/redo, local file upload, mask reset on new images, all five export formats, SVG decoding and no horizontal overflow at 390 px.
- **Pixel preservation verified:** zero-replacement PNG matches every decoded source channel; zero-replacement SVG retains sampled original colors; a fully protected mask retains source pixels at full replacement.
- **Local AI passed:** installed the isolated Python environment, downloaded/cached U²-Net, verified the real HTTP/model pipeline returns a non-uniform grayscale PNG mask with correct dimensions, and exercised the actual Select subject UI in the browser regression.
- **No browser runtime errors** during regression.
- **GitHub Pages subpath regression passed:** the generated `/flower/` site loads the landing page, chosen-look deep links, worker-based studio and PNG export, while making no API calls or missing-asset requests.

Run `node --test tests/*.test.mjs` and `node scripts/check.mjs` for the dependency-free checks. Run the optional browser and AI checks described in README.md for full integration coverage. Browser screenshots and sample exports from this run are in `test-results/` in the working project, excluded from the source archive.

Known scope and limits are documented in README.md. AI accuracy was smoke-tested on a synthetic foreground fixture, not benchmarked on a segmentation dataset. The browser validation used Edge; other browsers and external SVG editing applications have not been exhaustively tested.
