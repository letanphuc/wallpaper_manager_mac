import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Gallery from "./components/Gallery";
import Preview from "./components/Preview";
import Settings from "./components/Settings";
import type { Wallpaper } from "./types";
import "./App.css";

type Tab = "gallery" | "local" | "settings";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("gallery");
  const [previewWallpaper, setPreviewWallpaper] = useState<Wallpaper | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);

  console.log(`[App] render: activeTab=${activeTab}, hasPreview=${!!previewWallpaper || !!previewPath}`);

  const handleSetWallpaper = async (url: string, title: string) => {
    console.log(`[App] handleSetWallpaper: title="${title}", url=${url.slice(0, 60)}...`);
    setDownloadProgress("Downloading...");
    try {
      const path = await invoke<string>("download_wallpaper", { url, title });
      console.log(`[App] downloaded to: ${path}`);
      setDownloadProgress("Setting wallpaper...");
      await invoke("set_wallpaper", { path });
      console.log(`[App] wallpaper set successfully`);
      setDownloadProgress("Done!");
      setTimeout(() => {
        console.log(`[App] clearing download progress`);
        setDownloadProgress(null);
      }, 2000);
    } catch (e) {
      console.error(`[App] download/set failed:`, e);
      setDownloadProgress(`Error: ${e}`);
    }
  };

  const handlePreviewLocal = async (path: string) => {
    console.log(`[App] preview local: ${path}`);
    setPreviewPath(path);
    setPreviewWallpaper(null);
  };

  const handleSetLocalWallpaper = async (path: string) => {
    console.log(`[App] set local wallpaper: ${path}`);
    setDownloadProgress("Setting wallpaper...");
    try {
      await invoke("set_wallpaper", { path });
      console.log(`[App] local wallpaper set successfully`);
      setDownloadProgress("Done!");
      setTimeout(() => setDownloadProgress(null), 2000);
    } catch (e) {
      console.error(`[App] set local wallpaper failed:`, e);
      setDownloadProgress(`Error: ${e}`);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Wallpaper Manager</h1>
        <nav className="tabs">
          <button
            className={activeTab === "gallery" ? "tab active" : "tab"}
            onClick={() => {
              console.log(`[App] tab: gallery`);
              setActiveTab("gallery");
            }}
          >
            Gallery
          </button>
          <button
            className={activeTab === "local" ? "tab active" : "tab"}
            onClick={() => {
              console.log(`[App] tab: local`);
              setActiveTab("local");
            }}
          >
            Local
          </button>
          <button
            className={activeTab === "settings" ? "tab active" : "tab"}
            onClick={() => {
              console.log(`[App] tab: settings`);
              setActiveTab("settings");
            }}
          >
            Settings
          </button>
        </nav>
        {downloadProgress && (
          <span className="download-progress">{downloadProgress}</span>
        )}
      </header>

      <main className="main">
        {activeTab === "gallery" && (
          <Gallery
            onPreview={(w) => {
              console.log(`[App] preview from gallery:`, JSON.parse(JSON.stringify(w)));
              setPreviewWallpaper(w);
              setPreviewPath(null);
            }}
            onSetWallpaper={handleSetWallpaper}
          />
        )}
        {activeTab === "local" && (
          <LocalWallpapers
            onPreview={handlePreviewLocal}
            onSetWallpaper={handleSetLocalWallpaper}
          />
        )}
        {activeTab === "settings" && <Settings />}
      </main>

      {(previewWallpaper || previewPath) && (
        <Preview
          wallpaper={previewWallpaper}
          path={previewPath}
          onClose={() => {
            console.log(`[App] closing preview`);
            setPreviewWallpaper(null);
            setPreviewPath(null);
          }}
          onSetWallpaper={
            previewWallpaper
              ? () =>
                  handleSetWallpaper(
                    previewWallpaper.uhd_url || previewWallpaper.image_url || previewWallpaper.full_url || "",
                    previewWallpaper.title || "wallpaper"
                  )
              : undefined
          }
          onSetLocalWallpaper={
            previewPath
              ? () => handleSetLocalWallpaper(previewPath)
              : undefined
          }
        />
      )}
    </div>
  );
}

function LocalWallpaperThumb({ path }: { path: string }) {
  const [src, setSrc] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    console.log(`[LocalThumb] loading image: ${path}`);
    setError(false);
    invoke<string>("read_image_base64", { path })
      .then((dataUrl) => {
        console.log(`[LocalThumb] loaded (${dataUrl.length} chars): ${path}`);
        setSrc(dataUrl);
      })
      .catch((e) => {
        console.error(`[LocalThumb] failed: ${path}`, e);
        setError(true);
      });
  }, [path]);

  if (error) return <div className="wallpaper-card-img-placeholder" style={{ background: "#500" }} />;
  if (!src) return <div className="wallpaper-card-img-placeholder" />;
  return <img src={src} alt="" onClick={() => console.log(`[LocalThumb] clicked: ${path}`)} />;
}

function LocalWallpapers({
  onPreview,
  onSetWallpaper,
}: {
  onPreview: (path: string) => void;
  onSetWallpaper: (path: string) => void;
}) {
  const [wallpapers, setWallpapers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLocal = async () => {
    console.log(`[LocalWallpapers] listing local wallpapers`);
    setLoading(true);
    try {
      const paths = await invoke<string[]>("get_local_wallpapers");
      console.log(`[LocalWallpapers] found ${paths.length} wallpapers:`, paths);
      setWallpapers(paths);
    } catch (e) {
      console.error(`[LocalWallpapers] list failed:`, e);
    }
    setLoading(false);
  };

  console.log(`[LocalWallpapers] render: ${wallpapers.length} items, loading=${loading}`);

  if (wallpapers.length === 0 && !loading) {
    return (
      <div className="local-empty">
        <p>No downloaded wallpapers yet.</p>
        <button className="btn" onClick={loadLocal}>
          Browse local wallpapers
        </button>
      </div>
    );
  }

  return (
    <div className="gallery">
      <div className="gallery-header">
        <h2>Downloaded Wallpapers</h2>
        <button className="btn btn-sm" onClick={loadLocal} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      <div className="wallpaper-grid">
        {wallpapers.map((path, i) => (
          <div key={i} className="wallpaper-card">
            <LocalWallpaperThumb path={path} />
            <div className="wallpaper-card-actions">
              <button className="btn btn-sm" onClick={() => {
                console.log(`[LocalWallpapers] preview: ${path}`);
                onPreview(path);
              }}>
                Preview
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  console.log(`[LocalWallpapers] set: ${path}`);
                  onSetWallpaper(path);
                }}
              >
                Set
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
