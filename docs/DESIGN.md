# Flower design and interaction decisions

## References

The redesign used the public [Inspo MCP](https://inspomcp.dev/mcp) through its documented `https://inspomcp.dev/api/mcp` endpoint. The `recommend` tool was given a warm, editorial, open-source image-editor brief with the `specimen` macrostructure. `search_screens` identified [Glyphs](https://glyphsapp.com) (`glyphsapp-com`) and [Arweave](https://arweave.org) (`arweave-org`) as typography/specimen references. The recommendation also surfaced Lookback and Netlify pages.

The useful principles were a complete first-viewport hero, generous section rhythm, a real specimen instead of a decorative app mockup, and a clear type hierarchy. Flower uses its own layout, botanical SVG artwork, mark, code, and copy. No reference screenshots, third-party logos, or proprietary fonts are redistributed.

## Identity

- Warm paper `#f6f3eb` for the public page and onboarding; deep botanical green `#28352c` for the wordmark and studio.
- Poppy coral `#c94f36` for expressive accents, with warm peach as the studio interaction color.
- Georgia for expressive headings and the wordmark, familiar system sans-serif faces for controls, monospace for metadata. No remote font requests.
- A specimen-led landing page, three-step workflow, four working examples, privacy/ownership explanation, FAQ, and one consistent studio call to action.

## Flow

The first visit offers an optional tour or immediate image upload. The tour introduces image import → looks → protection → comparison → export. It never requires account creation or forces completion. A local preference stores only that the welcome was dismissed. Help can restart the tour at any time.

Create contains the common controls. Character fine-tuning, texture and compositing live in native expandable sections to reduce initial decision load. Protect is optional and visually separated. A sticky mobile preview keeps the result visible while adjusting settings.

The landing comparison and example cards use the actual deterministic engine. Preset links open the studio with the chosen look. Hosted mode explains the local-only AI feature without attempting requests to an unavailable server.

## Accessibility and quality

Native modal dialogs contain focus and make the surrounding page inert. Tour cards are positioned within the viewport and can be skipped or closed with Escape. Buttons and sliders have names, tabs expose selection, status messages use live regions, reduced-motion preferences are honored, and color is supplemented by text and selected states.

Canvas masking still requires a pointing device; it is not a fully keyboard-equivalent drawing surface. Existing masks can be imported without drawing. The current accessibility checks are interaction tests and manual inspection, not a claim of formal WCAG certification.
