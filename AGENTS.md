# AGENTS.md — wallpaper-mac

## Commands

| Command | What it does |
|---------|-------------|
| `pnpm tauri dev` | Start dev (Vite on :1420 + Rust hot-reload) |
| `pnpm tauri build --bundles app` | Build .app only (skips DMG, which often fails) |
| `pnpm build` | TypeScript check + Vite production build |
| `RUST_LOG=debug pnpm tauri dev` | Verbose Rust logs |
| `RUST_LOG=trace pnpm tauri dev` | Full Rust trace logs |

Port 1420 must be free. Kill stale processes with `lsof -ti:1420 | xargs kill`.

## Architecture

- **Frontend** `src/` — React 19 + TypeScript, Vite 7
- **Backend** `src-tauri/src/lib.rs` — Tauri v2 Rust commands
- **API** `doc/apis.md` — Peapix feeds for Bing/Spotlight wallpapers

## Key gotchas

**JSON field naming mismatch** — Peapix API returns camelCase (`fullUrl`), but the frontend TypeScript type uses snake_case (`full_url`). The Rust struct bridges this with `#[serde(rename(deserialize = "fullUrl"))]` on each field. Serialization to the frontend outputs snake_case.

**4K URL derivation** — `uhd_url` is derived in Rust's `fetch_wallpapers` by replacing `_1920.jpg` → `_3840.jpg` in `full_url`. Only populated after a fresh fetch (not in cached frontend state).

**Multi-country fetch** — `country="all"` in `fetch_wallpapers` fetches from all 12 regions in parallel, deduplicates by `full_url` in Rust, returns unique results.

**Fetch count** — Configurable via Settings (`fetch_count`), stored in-memory with `AppSettings`, passed as `n` to Peapix API.

**Download flow** prefers `uhd_url` → `image_url` → `full_url` (Gallery.tsx:148, App.tsx:130).

**Skip-existing download** — `download_wallpaper` (lib.rs:127) checks `path.exists()` before fetching; returns existing path immediately if the file is already on disk. Both "Download & Set" (per-card) and "Download All & Set Random" skip re-downloading already-saved wallpapers.

**Wallpapers stored at** `~/Pictures/Wallpapers/`.

**macOS wallpaper set** via `osascript` (System Events). Only works on macOS.

**Local wallpaper thumbnails** are read as base64 data URLs via the `read_image_base64` Rust command (not file:// or asset protocol).

**Debugging** — Open webview DevTools with `Cmd+Option+I`. Rust logs print to the terminal running `tauri dev`.

## Frontend components

- `Gallery.tsx` — Fetches wallpapers from Peapix, grid display, country/source selectors
- `Preview.tsx` — Modal overlay, shows full image, offers "Download & Set" or "Set as Wallpaper"
- `Settings.tsx` — Source (bing/spotlight), country, auto-refresh interval, fetch count

## Settings

Only stored in-memory (`Mutex<AppSettings>`). Not persisted between app restarts.

Fields: `source`, `country`, `interval_minutes`, `auto_refresh`, `fetch_count`

## Constraints

- macOS only (osascript for wallpaper, no cross-platform abstraction)
- CSP is null (no security restrictions)
- `tsconfig.json`: `strict`, `noUnusedLocals`, `noUnusedParameters`
- Bundle DMG step requires `create-dmg` tool and often fails — use `--bundles app`
