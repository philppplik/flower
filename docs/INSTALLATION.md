# Installation

## Choose your edition

| Edition | Requirements | Capabilities |
| --- | --- | --- |
| [Browser studio](https://philppplik.github.io/flower/studio.html) | A current desktop or mobile browser | Manual selection, all appearance controls, exports; no installation |
| Local Flower | Node.js 22+ | The same studio, offline after obtaining the source |
| Local Flower with AI | Node.js 22+, Python 3.11–3.13, optional dependencies/model | Adds automatic foreground selection |

The hosted studio never calls a local API. Install the local edition to use automatic selection. Manual selection and exports work in both editions.

## Local quick start

Download and extract `flower-v1.0.0.zip` from [Releases](https://github.com/philppplik/flower/releases), or clone:

```sh
git clone https://github.com/philppplik/flower.git
cd flower
node server.mjs
```

Open [the local studio](http://127.0.0.1:5173/studio.html). The local landing page is at [the root](http://127.0.0.1:5173/). No package installation or build step is necessary for normal use.

On Windows, double-click **Start Flower.cmd** to start the server and open the studio. Keep that terminal open while editing; Ctrl+C stops the server. The launcher reuses an already-running local instance.

Do not open the HTML files using `file://`: modules and workers need an HTTP origin. Run the local server instead.

## Optional local AI

Create an isolated virtual environment:

```sh
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-ai.lock.txt
```

macOS/Linux:

```sh
.venv/bin/python -m pip install -r requirements-ai.lock.txt
```

The lockfile records the versions validated with Python 3.13 on Windows. If a locked wheel is unavailable on your platform, use `requirements-ai.txt` for compatible version ranges. The editor itself has no Python dependency.

Restart Flower, open **Protect**, and click **Select subject**. First use downloads U²-Net (about 176 MB). The first Python import may also compile numerical kernels, so this can take several minutes. Models are cached beneath `.cache/models/` and excluded from Git. Subsequent use works offline.

For a preflight check, initialize the model explicitly, then run the smoke test:

```powershell
$env:U2NET_HOME = Join-Path (Get-Location) '.cache/models'
.\.venv\Scripts\python.exe -c "from rembg import new_session; new_session('u2net')"
node scripts/ai-smoke.mjs
```

On macOS/Linux, prefix the Python command with `U2NET_HOME="$PWD/.cache/models"` and use `.venv/bin/python`.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5173` | Local server port |
| `ASCII_PYTHON` | Project `.venv`, then `python` | Compatibility name for the Python executable override |
| `U2NET_HOME` | `.cache/models` | Model cache root |
| `PLAYWRIGHT_PATH` | Local `playwright` package | Optional existing Playwright entry point for development |
| `BROWSER_CHANNEL` | Playwright Chromium | Optional browser test channel, such as `msedge` |
| `TEST_AI` | Off | Set to `1` to exercise the real AI button in browser tests |

Example custom port in PowerShell: `$env:PORT = '5180'`, then `node server.mjs`. In a POSIX shell: `PORT=5180 node server.mjs`.

## Troubleshooting

- **Node command not found:** install a supported Node.js version, then reopen your terminal.
- **Port already in use:** close the old server or choose another `PORT`.
- **AI button unavailable locally:** install the Python requirements and restart. Check that the selected Python can import `rembg` and `onnxruntime`.
- **AI download fails or times out:** check connectivity to GitHub model releases and available disk space. The first download needs about 176 MB; the Python environment needs additional space. Manual tools remain available.
- **Export too large:** lower the output scale or increase glyph size. Inputs are capped at 12 MP/6,000 px per side/30 MB; raster output at 24 MP/10,000 px per side.
- **Tour reappears in a private window:** welcome completion is stored locally; browsers that block storage cannot remember it. Skip remains available.
- **Your session disappeared after reload:** sessions are in memory. Download your output, mask, and JSON look before closing the page.

## GitHub Pages

`node scripts/build-pages.mjs` creates an allowlisted `dist/` containing the landing page, browser studio, shared assets/modules, and license. It marks the studio as static so AI is presented as a local-only capability. All browser module and asset paths work beneath `/flower/`.

The `Verify and publish` workflow deploys `dist/` only from `main`, after unit and browser jobs succeed. In a fork, enable GitHub Pages with **GitHub Actions** as its source and update the repository/site links before deployment. The workflow does not publish `.venv`, `.cache`, tests, server code, or user images to Pages.
