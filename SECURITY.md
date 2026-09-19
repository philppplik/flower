# Security policy

## Supported version

Security fixes target the latest 1.x release. Use the latest release and development dependency lockfiles.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/philppplik/flower/security/advisories/new). Include the affected version, a minimal reproduction, and impact. Do not publish credentials, private photos, or exploitable details in public issues while a report is being assessed.

## Security boundaries

- The optional local server listens only on `127.0.0.1`, rejects unexpected hosts/origins, and serves an explicit asset allowlist.
- The static build does not include the server, Python environment, model weights, or user files.
- User images are decoded in-browser. The optional model receives a bounded PNG through the local server and returns a mask.
- JSON looks are parsed and normalized; unknown settings, invalid colors, and out-of-range values are discarded or bounded.
- SVG exports escape glyph text and embed PNG data rather than fetching remote resources.
- Flower does not require credentials and should not be exposed as a public AI API without a separate security design.

Third-party Python packages and model weights have their own release cycles and licenses. Review changes to the lockfile before deploying a new local AI environment.
