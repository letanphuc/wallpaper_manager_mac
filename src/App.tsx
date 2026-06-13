import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
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
  type ToastInfo = { message: string; type: "loading" | "success" | "error" } | null;
  const [toast, setToast] = useState<ToastInfo>(null);

  console.log(`[App] render: activeTab=${activeTab}, hasPreview=${!!previewWallpaper || !!previewPath}`);

  const handleSetWallpaper = async (url: string, title: string) => {
    console.log(`[App] handleSetWallpaper: title="${title}", url=${url.slice(0, 60)}...`);
    setToast({ message: "Downloading...", type: "loading" });
    try {
      const path = await invoke<string>("download_wallpaper", { url, title });
      console.log(`[App] downloaded to: ${path}`);
      setToast({ message: "Setting wallpaper...", type: "loading" });
      await invoke("set_wallpaper", { path });
      console.log(`[App] wallpaper set successfully`);
      setToast({ message: "Wallpaper set!", type: "success" });
    } catch (e) {
      console.error(`[App] download/set failed:`, e);
      setToast({ message: `Error: ${e}`, type: "error" });
    }
  };

  const handlePreviewLocal = async (path: string) => {
    console.log(`[App] preview local: ${path}`);
    setPreviewPath(path);
    setPreviewWallpaper(null);
  };

  const handleDownloadAll = async (wallpapers: Wallpaper[]) => {
    console.log(`[App] handleDownloadAll: ${wallpapers.length} wallpapers`);
    setToast({ message: `Downloading 0/${wallpapers.length}...`, type: "loading" });
    const results: { path: string; title: string }[] = [];
    for (let i = 0; i < wallpapers.length; i++) {
      const w = wallpapers[i];
      const url = w.uhd_url || w.image_url || w.full_url;
      const title = w.title || "wallpaper";
      if (!url) continue;
      setToast({ message: `Downloading ${i + 1}/${wallpapers.length}...`, type: "loading" });
      try {
        const path = await invoke<string>("download_wallpaper", { url, title });
        results.push({ path, title });
      } catch (e) {
        console.error(`[App] failed to download "${title}":`, e);
      }
    }
    if (results.length === 0) {
      setToast({ message: "No wallpapers could be downloaded.", type: "error" });
      return;
    }
    const picked = results[Math.floor(Math.random() * results.length)];
    console.log(`[App] picked random: "${picked.title}"`);
    setToast({ message: `Setting "${picked.title}"...`, type: "loading" });
    try {
      await invoke("set_wallpaper", { path: picked.path });
      setToast({ message: `Wallpaper set to "${picked.title}"!`, type: "success" });
    } catch (e) {
      console.error(`[App] set wallpaper failed:`, e);
      setToast({ message: `Error: ${e}`, type: "error" });
    }
  };

  const handleSetLocalWallpaper = async (path: string) => {
    console.log(`[App] set local wallpaper: ${path}`);
    setToast({ message: "Setting wallpaper...", type: "loading" });
    try {
      await invoke("set_wallpaper", { path });
      console.log(`[App] local wallpaper set successfully`);
      setToast({ message: "Wallpaper set!", type: "success" });
    } catch (e) {
      console.error(`[App] set local wallpaper failed:`, e);
      setToast({ message: `Error: ${e}`, type: "error" });
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
            onDownloadAll={handleDownloadAll}
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

      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function Toast({ toast, onDismiss }: {
  toast: { message: string; type: "loading" | "success" | "error" };
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (toast.type !== "error") {
      const timer = setTimeout(onDismiss, 2000);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  return (
    <div className={`toast toast-${toast.type}`} onClick={onDismiss}>
      <span className="toast-icon">
        {toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "⏳"}
      </span>
      <span className="toast-message">{toast.message}</span>
    </div>
  );
}

function LocalWallpaperThumb({ path, onClick }: { path: string; onClick: () => void }) {
  const [error, setError] = useState(false);
  const src = convertFileSrc(path);

  if (error) return <div className="wallpaper-card-img-placeholder" style={{ background: "#500" }} onClick={onClick} />;
  return <img src={src} alt="" onClick={onClick} onError={() => setError(true)} />;
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

  useEffect(() => {
    loadLocal();
  }, []);

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
            <LocalWallpaperThumb path={path} onClick={() => onPreview(path)} />
            <div className="wallpaper-card-actions">
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
