use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallpaper {
    pub title: Option<String>,
    pub copyright: Option<String>,
    #[serde(rename(deserialize = "fullUrl"))]
    pub full_url: Option<String>,
    #[serde(rename(deserialize = "thumbUrl"))]
    pub thumb_url: Option<String>,
    #[serde(rename(deserialize = "imageUrl"))]
    pub image_url: Option<String>,
    #[serde(rename(deserialize = "pageUrl"))]
    pub page_url: Option<String>,
    pub date: Option<String>,
    #[serde(skip)]
    pub uhd_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub source: String,
    pub country: String,
    pub interval_minutes: u64,
    pub auto_refresh: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            source: "bing".to_string(),
            country: "us".to_string(),
            interval_minutes: 60,
            auto_refresh: false,
        }
    }
}

pub struct AppState {
    pub settings: Mutex<AppSettings>,
}

fn wallpapers_dir() -> PathBuf {
    let base = dirs::picture_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("Wallpapers");
    log::debug!("wallpapers dir resolved: {:?}", dir);
    dir
}

#[tauri::command]
async fn fetch_wallpapers(source: String, country: String, n: i32) -> Result<Vec<Wallpaper>, String> {
    let url = if source == "spotlight" {
        format!("https://peapix.com/spotlight/feed?n={}", n)
    } else {
        format!("https://peapix.com/bing/feed?country={}&n={}", country, n)
    };

    log::info!("fetching wallpapers: source={}, country={}, n={}, url={}", source, country, n, url);

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "wallpaper-mac/1.0")
        .send()
        .await
        .map_err(|e| {
            log::error!("HTTP request failed: {}", e);
            format!("HTTP error: {}", e)
        })?;

    log::debug!("HTTP response status: {}", resp.status());

    let wallpapers: Vec<Wallpaper> = resp
        .json()
        .await
        .map_err(|e| {
            log::error!("JSON parse failed: {}", e);
            format!("Parse error: {}", e)
        })?;

    let wallpapers: Vec<Wallpaper> = wallpapers.into_iter().map(|mut w| {
        w.uhd_url = w.full_url.as_ref().map(|u| u.replace("_1920.jpg", "_3840.jpg"));
        w
    }).collect();

    log::info!("fetched {} wallpapers", wallpapers.len());
    Ok(wallpapers)
}

#[tauri::command]
async fn download_wallpaper(url: String, title: String) -> Result<String, String> {
    log::info!("downloading wallpaper: title=\"{}\", url={}", title, url);

    let dir = wallpapers_dir();
    fs::create_dir_all(&dir).map_err(|e| {
        log::error!("failed to create wallpapers dir {:?}: {}", dir, e);
        format!("Failed to create dir: {}", e)
    })?;

    let filename = sanitize_filename(&title) + ".jpg";
    let path = dir.join(&filename);

    log::debug!("download target path: {:?}", path);

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "wallpaper-mac/1.0")
        .send()
        .await
        .map_err(|e| {
            log::error!("download HTTP request failed: {}", e);
            format!("Download error: {}", e)
        })?;

    let content_length = resp.content_length();
    log::debug!("download response status: {}, content-length: {:?}", resp.status(), content_length);

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| {
            log::error!("failed to read response body: {}", e);
            format!("Read error: {}", e)
        })?;

    log::debug!("downloaded {} bytes", bytes.len());

    fs::write(&path, &bytes).map_err(|e| {
        log::error!("failed to write file {:?}: {}", path, e);
        format!("Write error: {}", e)
    })?;

    log::info!("wallpaper saved to {:?}", path);
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn set_wallpaper(path: String) -> Result<(), String> {
    log::info!("setting wallpaper from path: {}", path);

    if !std::path::Path::new(&path).exists() {
        log::error!("wallpaper file does not exist: {}", path);
        return Err(format!("File not found: {}", path));
    }

    let escaped_path = path.replace("\"", "\\\"");
    let script = format!(
        "tell application \"System Events\" to set picture of every desktop to \"{}\"",
        escaped_path
    );

    log::debug!("osascript command: osascript -e '{}'", script);

    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| {
            log::error!("failed to spawn osascript: {}", e);
            format!("Failed to run osascript: {}", e)
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        log::error!("osascript failed: {}", stderr);
        return Err(format!("osascript error: {}", stderr));
    }

    log::info!("wallpaper set successfully");
    Ok(())
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> AppSettings {
    let settings = state.settings.lock().unwrap().clone();
    log::debug!("get_settings: {:?}", settings);
    settings
}

#[tauri::command]
fn save_settings(state: State<AppState>, settings: AppSettings) {
    log::info!("save_settings: {:?}", settings);
    let mut s = state.settings.lock().unwrap();
    *s = settings;
}

#[tauri::command]
fn get_local_wallpapers() -> Result<Vec<String>, String> {
    let dir = wallpapers_dir();
    log::info!("listing local wallpapers in {:?}", dir);

    if !dir.exists() {
        log::debug!("wallpapers dir does not exist, returning empty");
        return Ok(vec![]);
    }

    let mut files: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| {
            log::error!("failed to read dir {:?}: {}", dir, e);
            format!("Read dir error: {}", e)
        })?
        .filter_map(|entry| {
            let e = entry.ok()?;
            let ext = e.path().extension()?.to_str()?.to_lowercase();
            if ext == "jpg" || ext == "png" { Some(e.path().to_string_lossy().to_string()) } else { None }
        })
        .collect();

    files.sort_by(|a, b| {
        let a_md = fs::metadata(a).and_then(|m| m.modified()).ok();
        let b_md = fs::metadata(b).and_then(|m| m.modified()).ok();
        b_md.cmp(&a_md)
    });

    log::info!("found {} local wallpapers", files.len());
    for f in &files {
        log::debug!("  local wallpaper: {}", f);
    }

    Ok(files)
}

#[tauri::command]
fn read_image_base64(path: String) -> Result<String, String> {
    log::debug!("reading image as base64: {}", path);

    let bytes = fs::read(&path).map_err(|e| {
        log::error!("failed to read image {:?}: {}", &path, e);
        format!("Read error: {}", e)
    })?;

    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();

    let mime = match ext.as_str() {
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/jpeg",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:{};base64,{}", mime, b64);

    log::debug!("base64 image size: {} bytes encoded -> {} chars", bytes.len(), b64.len());
    Ok(data_url)
}

fn sanitize_filename(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' { c } else { '_' })
        .collect();
    let result = sanitized.trim().to_string();
    log::trace!("sanitized filename: \"{}\" -> \"{}\"", name, result);
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();

    log::info!("starting Wallpaper Manager");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            settings: Mutex::new(AppSettings::default()),
        })
        .invoke_handler(tauri::generate_handler![
            fetch_wallpapers,
            download_wallpaper,
            set_wallpaper,
            get_settings,
            save_settings,
            get_local_wallpapers,
            read_image_base64,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
