use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

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
    pub fetch_count: i32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            source: "bing".to_string(),
            country: "all".to_string(),
            interval_minutes: 60,
            auto_refresh: false,
            fetch_count: 20,
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

const ALL_COUNTRIES: [&str; 12] = [
    "us", "jp", "cn", "de", "fr", "gb", "au", "br", "ca", "in", "it", "es",
];

#[tauri::command]
async fn fetch_wallpapers(source: String, country: String, n: i32) -> Result<Vec<Wallpaper>, String> {
    let urls: Vec<String> = if source == "spotlight" {
        vec![format!("https://peapix.com/spotlight/feed?n={}", n)]
    } else if country == "all" {
        ALL_COUNTRIES.iter().map(|c| {
            format!("https://peapix.com/bing/feed?country={}&n={}", c, n)
        }).collect()
    } else {
        vec![format!("https://peapix.com/bing/feed?country={}&n={}", country, n)]
    };

    log::info!("fetching wallpapers: source={}, country={}, n={}, {} url(s)", source, country, n, urls.len());
    for u in &urls {
        log::debug!("  url: {}", u);
    }

    let client = reqwest::Client::new();
    let mut handles = Vec::new();
    for url in urls {
        let c = client.clone();
        handles.push(tokio::spawn(async move {
            c.get(&url)
                .header("User-Agent", "wallpaper-mac/1.0")
                .send()
                .await
                .ok()
        }));
    }

    let mut all_wallpapers: Vec<Wallpaper> = Vec::new();
    for handle in handles {
        if let Ok(Some(resp)) = handle.await {
            if let Ok(wallpapers) = resp.json::<Vec<Wallpaper>>().await {
                all_wallpapers.extend(wallpapers);
            }
        }
    }

    let mut seen = std::collections::HashSet::new();
    all_wallpapers.retain(|w| {
        w.full_url.as_deref().map_or(false, |url| seen.insert(url.to_string()))
    });

    let wallpapers: Vec<Wallpaper> = all_wallpapers.into_iter().map(|mut w| {
        w.uhd_url = w.full_url.as_ref().map(|u| u.replace("_1920.jpg", "_3840.jpg"));
        w
    }).collect();

    log::info!("fetched {} wallpapers (unique)", wallpapers.len());
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

    if path.exists() {
        log::info!("wallpaper already exists, skipping download: {:?}", path);
        return Ok(path.to_string_lossy().to_string());
    }

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

    set_wallpaper_inner(&path)
}

fn set_wallpaper_inner(path: &str) -> Result<(), String> {
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
fn set_wallpaper_by_title(title: String) -> Result<(), String> {
    log::info!("setting wallpaper by title: \"{}\"", title);

    let filename = sanitize_filename(&title) + ".jpg";
    let path = wallpapers_dir().join(&filename);
    let path_str = path.to_string_lossy().to_string();

    log::debug!("resolved path: {:?}", path);

    if !path.exists() {
        log::error!("wallpaper file not found: {:?}", path);
        return Err(format!("Wallpaper not found: {}", filename));
    }

    set_wallpaper_inner(&path_str)
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

    let mut files: Vec<(String, std::time::SystemTime)> = fs::read_dir(&dir)
        .map_err(|e| {
            log::error!("failed to read dir {:?}: {}", dir, e);
            format!("Read dir error: {}", e)
        })?
        .filter_map(|entry| {
            let e = entry.ok()?;
            let ext = e.path().extension()?.to_str()?.to_lowercase();
            if ext == "jpg" || ext == "png" {
                let path = e.path().to_string_lossy().to_string();
                let modified = fs::metadata(&path).ok()?.modified().ok()?;
                Some((path, modified))
            } else {
                None
            }
        })
        .collect();

    files.sort_by(|a, b| b.1.cmp(&a.1));

    let paths: Vec<String> = files.into_iter().map(|(p, _)| p).collect();

    log::info!("found {} local wallpapers", paths.len());
    for f in &paths {
        log::debug!("  local wallpaper: {}", f);
    }

    Ok(paths)
}

#[tauri::command]
fn get_downloaded_titles() -> Result<Vec<String>, String> {
    let dir = wallpapers_dir();
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut titles = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| format!("Read dir error: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
        let path = entry.path();
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext == "jpg" || ext == "png" {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                titles.push(stem.to_string());
            }
        }
    }
    log::info!("get_downloaded_titles: {} files", titles.len());
    Ok(titles)
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
            set_wallpaper_by_title,
            get_settings,
            save_settings,
            get_local_wallpapers,
            get_downloaded_titles,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
