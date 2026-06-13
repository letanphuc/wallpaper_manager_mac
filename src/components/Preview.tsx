import { useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Wallpaper } from "../types";

interface Props {
  wallpaper: Wallpaper | null;
  path: string | null;
  onClose: () => void;
  onSetWallpaper?: () => void;
  onSetLocalWallpaper?: () => void;
}

function Preview({ wallpaper, path, onClose, onSetWallpaper, onSetLocalWallpaper }: Props) {
  useEffect(() => {
    console.log(`[Preview] wallpaper prop:`, JSON.parse(JSON.stringify(wallpaper)));
    console.log(`[Preview] path prop:`, path);
  }, [wallpaper, path]);

  const imageUrl = wallpaper
    ? wallpaper.full_url || wallpaper.image_url || ""
    : path
      ? convertFileSrc(path)
      : "";

  console.log(`[Preview] computed imageUrl: "${imageUrl.slice(0, 80)}" (len=${imageUrl.length})`);

  if (!imageUrl) {
    console.warn(`[Preview] no image URL available`);
    return (
      <div className="preview-overlay" onClick={onClose}>
        <div className="preview-modal" onClick={(e) => e.stopPropagation()} style={{ padding: 40, textAlign: "center" }}>
          <button className="preview-close" onClick={onClose}>&times;</button>
          <p>No image URL available</p>
          {wallpaper && (
            <pre style={{ fontSize: 11, color: "#aaa", marginTop: 12, textAlign: "left" }}>
              {JSON.stringify(wallpaper, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="preview-overlay" onClick={() => {
      console.log(`[Preview] overlay clicked, closing`);
      onClose();
    }}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        <button className="preview-close" onClick={() => {
          console.log(`[Preview] close button clicked`);
          onClose();
        }}>
          &times;
        </button>
        <div className="preview-image-container">
          <img
            src={imageUrl}
            alt={wallpaper?.title || "Wallpaper"}
            className="preview-image"
            onLoad={() => console.log(`[Preview] image loaded OK: ${imageUrl.slice(0, 60)}...`)}
            onError={(e) => console.error(`[Preview] image load ERROR: ${imageUrl.slice(0, 60)}...`, e.currentTarget.src)}
          />
        </div>
        <div className="preview-info">
          {wallpaper && (
            <>
              <h3>{wallpaper.title || "Untitled"}</h3>
              {wallpaper.copyright && (
                <p className="preview-copyright">{wallpaper.copyright}</p>
              )}
              {wallpaper.date && (
                <p className="preview-date">{wallpaper.date}</p>
              )}
            </>
          )}
          {path && <h3>{path.split("/").pop()}</h3>}
          <div className="preview-actions">
            {onSetWallpaper && (
              <button className="btn btn-primary" onClick={() => {
                console.log(`[Preview] download & set as wallpaper clicked`);
                onSetWallpaper();
              }}>
                Download & Set as Wallpaper
              </button>
            )}
            {onSetLocalWallpaper && (
              <button className="btn btn-primary" onClick={() => {
                console.log(`[Preview] set local wallpaper clicked`);
                onSetLocalWallpaper();
              }}>
                Set as Wallpaper
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Preview;
