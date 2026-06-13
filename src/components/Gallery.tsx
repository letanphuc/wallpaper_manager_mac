import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Wallpaper, AppSettings } from "../types";

const COUNTRIES: Record<string, string> = {
  us: "United States",
  jp: "Japan",
  cn: "China",
  de: "Germany",
  fr: "France",
  gb: "United Kingdom",
  au: "Australia",
  br: "Brazil",
  ca: "Canada",
  in: "India",
  it: "Italy",
  es: "Spain",
};

interface Props {
  onPreview: (w: Wallpaper) => void;
  onSetWallpaper: (url: string, title: string) => void;
}

function Gallery({ onPreview, onSetWallpaper }: Props) {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState("bing");
  const [country, setCountry] = useState("us");
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const fetchWallpapers = useCallback(async () => {
    console.log(`[Gallery] fetching wallpapers: source=${source}, country=${country}, n=20`);
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<Wallpaper[]>("fetch_wallpapers", {
        source,
        country,
        n: 20,
      });
      console.log(`[Gallery] received ${result.length} wallpapers`);
      if (result.length > 0) {
        console.log(`[Gallery] first wallpaper (raw):`, JSON.parse(JSON.stringify(result[0])));
      }
      setWallpapers(result);
    } catch (e) {
      console.error(`[Gallery] fetch failed:`, e);
      setError(String(e));
    }
    setLoading(false);
  }, [source, country]);

  useEffect(() => {
    console.log(`[Gallery] loading settings`);
    invoke<AppSettings>("get_settings")
      .then((s) => {
        console.log(`[Gallery] loaded settings:`, s);
        if (s.source) setSource(s.source);
        if (s.country) setCountry(s.country);
      })
      .catch((e) => console.error(`[Gallery] failed to load settings:`, e))
      .finally(() => setInitialized(true));
  }, []);

  useEffect(() => {
    if (initialized) fetchWallpapers();
  }, [fetchWallpapers, initialized]);

  console.log(`[Gallery] render: ${wallpapers.length} wallpapers, loading=${loading}`);

  return (
    <div className="gallery">
      <div className="gallery-header">
        <h2>Wallpaper Gallery</h2>
        <div className="gallery-controls">
          <select
            value={source}
            onChange={(e) => {
              console.log(`[Gallery] source changed: ${e.target.value}`);
              setSource(e.target.value);
            }}
            className="select"
          >
            <option value="bing">Bing Daily</option>
            <option value="spotlight">Windows Spotlight</option>
          </select>
          {source === "bing" && (
            <select
              value={country}
              onChange={(e) => {
                console.log(`[Gallery] country changed: ${e.target.value}`);
                setCountry(e.target.value);
              }}
              className="select"
            >
              {Object.entries(COUNTRIES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <button
            className="btn btn-primary"
            onClick={() => {
              console.log(`[Gallery] refresh clicked`);
              fetchWallpapers();
            }}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {wallpapers.length === 0 && !loading && (
        <div className="gallery-empty">
          <p>No wallpapers found. Try a different source or country.</p>
        </div>
      )}

      <div className="wallpaper-grid">
        {wallpapers.map((w, i) => (
          <div key={i} className="wallpaper-card">
            <img
              src={w.thumb_url || w.image_url}
              alt={w.title || "Wallpaper"}
              loading="lazy"
              onClick={() => {
                console.log(`[Gallery] wallpaper clicked: "${w.title}"`);
                onPreview(w);
              }}
            />
            <div className="wallpaper-card-info">
              <span className="wallpaper-title">{w.title || "Untitled"}</span>
            </div>
            <div className="wallpaper-card-actions">
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  const url = w.uhd_url || w.image_url || w.full_url || "";
                  const title = w.title || "wallpaper";
                  console.log(`[Gallery] download & set: title="${title}", url=${url.slice(0, 60)}...`);
                  onSetWallpaper(url, title);
                }}
              >
                Download & Set
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Gallery;
