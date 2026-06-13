import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../types";

function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    source: "bing",
    country: "us",
    interval_minutes: 60,
    auto_refresh: false,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    console.log(`[Settings] loading current settings`);
    invoke<AppSettings>("get_settings")
      .then((s) => {
        console.log(`[Settings] loaded:`, s);
        setSettings(s);
      })
      .catch((e) => console.error(`[Settings] failed to load:`, e));
  }, []);

  const handleSave = async () => {
    console.log(`[Settings] saving:`, settings);
    try {
      await invoke("save_settings", { settings });
      console.log(`[Settings] saved successfully`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(`[Settings] save failed:`, e);
    }
  };

  console.log(`[Settings] render:`, settings);

  return (
    <div className="settings">
      <h2>Settings</h2>

      <div className="settings-section">
        <h3>Wallpaper Source</h3>
        <label className="setting-row">
          <span>Source</span>
          <select
            value={settings.source}
            onChange={(e) => {
              const newSource = e.target.value;
              console.log(`[Settings] source changed: ${newSource}`);
              setSettings({ ...settings, source: newSource });
            }}
            className="select"
          >
            <option value="bing">Bing Daily</option>
            <option value="spotlight">Windows Spotlight</option>
          </select>
        </label>

        {settings.source === "bing" && (
          <label className="setting-row">
            <span>Country / Region</span>
            <select
              value={settings.country}
              onChange={(e) => {
                const newCountry = e.target.value;
                console.log(`[Settings] country changed: ${newCountry}`);
                setSettings({ ...settings, country: newCountry });
              }}
              className="select"
            >
              <option value="us">United States</option>
              <option value="jp">Japan</option>
              <option value="cn">China</option>
              <option value="de">Germany</option>
              <option value="fr">France</option>
              <option value="gb">United Kingdom</option>
              <option value="au">Australia</option>
              <option value="br">Brazil</option>
              <option value="ca">Canada</option>
              <option value="in">India</option>
              <option value="it">Italy</option>
              <option value="es">Spain</option>
            </select>
          </label>
        )}
      </div>

      <div className="settings-section">
        <h3>Auto Refresh</h3>
        <label className="setting-row">
          <span>Enable auto-refresh</span>
          <input
            type="checkbox"
            checked={settings.auto_refresh}
            onChange={(e) => {
              console.log(`[Settings] auto_refresh: ${e.target.checked}`);
              setSettings({ ...settings, auto_refresh: e.target.checked });
            }}
          />
        </label>
        <label className="setting-row">
          <span>Interval (minutes)</span>
          <input
            type="number"
            min={5}
            max={1440}
            value={settings.interval_minutes}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 60;
              console.log(`[Settings] interval changed: ${val}`);
              setSettings({ ...settings, interval_minutes: val });
            }}
            className="input"
          />
        </label>
      </div>

      <button className="btn btn-primary" onClick={handleSave}>
        {saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  );
}

export default Settings;
