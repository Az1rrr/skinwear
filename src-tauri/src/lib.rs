use anyhow::Result;
use rust_decimal::Decimal;
use serde::Serialize;
use std::sync::mpsc;
use tauri::{AppHandle, Emitter, Manager};

use skinwear_core::calc;
use skinwear_core::cookie;
use skinwear_core::scrape;
use skinwear_core::types::*;

// ── Cookie Worker Thread ──────────────────────────────────────────────

enum CookieCommand {
    Launch(String),
    ExtractCookies(mpsc::Sender<Result<Vec<CookieJson>, String>>),
    Shutdown,
}

/// Spawns a dedicated OS thread that owns the headless_chrome Browser
/// (which is not Send). Communication via mpsc channels.
fn spawn_cookie_worker() -> mpsc::Sender<CookieCommand> {
    let (tx, rx) = mpsc::channel::<CookieCommand>();

    std::thread::spawn(move || {
        let mut browser: Option<headless_chrome::Browser> = None;

        for cmd in rx {
            match cmd {
                CookieCommand::Launch(url) => {
                    match cookie::launch_browser(&url) {
                        Ok(b) => {
                            browser = Some(b);
                        }
                        Err(e) => {
                            eprintln!("Cookie worker: launch failed: {e}");
                            browser = None;
                        }
                    }
                }
                CookieCommand::ExtractCookies(reply) => {
                    let result = match &browser {
                        Some(b) => cookie::extract_cookies(b).map_err(|e| e.to_string()),
                        None => Err("浏览器未启动，请先点击「打开浏览器」".to_string()),
                    };
                    let _ = reply.send(result);
                }
                CookieCommand::Shutdown => {
                    drop(browser);
                    break;
                }
            }
        }
    });

    tx
}

// ── Managed State ─────────────────────────────────────────────────────

struct CookieWorkerState {
    sender: mpsc::Sender<CookieCommand>,
}

// ── Tauri Commands ────────────────────────────────────────────────────

#[tauri::command]
fn check_status(app: AppHandle) -> StatusResult {
    let data_dir = app.path().app_data_dir().unwrap_or_default();
    StatusResult {
        has_cookie: data_dir.join("cookie.json").exists(),
        has_wear: data_dir.join("wear.txt").exists(),
    }
}

#[tauri::command]
fn clear_data(app: AppHandle) -> Result<(), String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {e}"))?;
    let cookie_path = data_dir.join("cookie.json");
    let wear_path = data_dir.join("wear.txt");
    if cookie_path.exists() {
        std::fs::remove_file(&cookie_path).map_err(|e| format!("删除 cookie.json 失败: {e}"))?;
    }
    if wear_path.exists() {
        std::fs::remove_file(&wear_path).map_err(|e| format!("删除 wear.txt 失败: {e}"))?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
struct StatusResult {
    has_cookie: bool,
    has_wear: bool,
}

#[tauri::command]
fn load_cookies_cmd(app: AppHandle) -> Result<Vec<CookieJson>, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {e}"))?;
    let cookie_path = data_dir.join("cookie.json");
    let data = std::fs::read_to_string(&cookie_path).map_err(|e| format!("读取 cookie.json 失败: {e}"))?;
    serde_json::from_str(&data).map_err(|e| format!("解析 cookie.json 失败: {e}"))
}

#[tauri::command]
fn launch_browser_cmd(state: tauri::State<'_, CookieWorkerState>) -> Result<(), String> {
    let url = "https://buff.163.com/goods/871801#page_num=2".to_string();
    state
        .sender
        .send(CookieCommand::Launch(url))
        .map_err(|e| format!("发送指令失败: {e}"))
}

#[tauri::command]
fn extract_cookies_cmd(
    app: AppHandle,
    state: tauri::State<'_, CookieWorkerState>,
) -> Result<Vec<CookieJson>, String> {
    let (tx, rx) = mpsc::channel();
    state
        .sender
        .send(CookieCommand::ExtractCookies(tx))
        .map_err(|e| format!("发送指令失败: {e}"))?;

    let cookies = rx
        .recv_timeout(std::time::Duration::from_secs(30))
        .map_err(|_| "获取 Cookie 超时，请确认浏览器已打开并登录 BUFF".to_string())??;

    // Save to app data dir
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {e}"))?;
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("创建数据目录失败: {e}"))?;

    let cookie_path = data_dir.join("cookie.json");
    let json =
        serde_json::to_string_pretty(&cookies).map_err(|e| format!("序列化失败: {e}"))?;
    std::fs::write(&cookie_path, &json).map_err(|e| format!("写入失败: {e}"))?;

    Ok(cookies)
}

#[tauri::command]
async fn start_scrape(
    app: AppHandle,
    cookies: Vec<CookieJson>,
    url: String,
    pages: usize,
) -> Result<usize, String> {
    let info = scrape::parse_goods_url(&url).map_err(|e| e.to_string())?;

    let app_handle = app.clone();
    let wears = tauri::async_runtime::spawn_blocking(move || {
        scrape::scrape(&cookies, &info, pages, move |progress| {
            let _ = app_handle.emit("scrape-progress", progress);
        })
    })
    .await
    .map_err(|e| format!("爬取任务失败: {e}"))?
    .map_err(|e| format!("爬取失败: {e}"))?;

    let count = wears.len();

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {e}"))?;
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("创建数据目录失败: {e}"))?;
    let wear_path = data_dir.join("wear.txt");
    std::fs::write(&wear_path, wears.join("\n")).map_err(|e| format!("写入失败: {e}"))?;

    Ok(count)
}

#[tauri::command]
async fn load_wears_cmd(app: AppHandle) -> Result<Vec<Decimal>, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取数据目录失败: {e}"))?;
    let wear_path = data_dir.join("wear.txt");
    let data =
        std::fs::read_to_string(&wear_path).map_err(|e| format!("读取 wear.txt 失败: {e}"))?;
    calc::parse_wears(&data).map_err(|e| e.to_string())
}

#[tauri::command]
async fn calculate_optimal(
    app: AppHandle,
    wears: Vec<Decimal>,
    input: CalcInput,
) -> Result<OptimalResult, String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        calc::find_optimal(&wears, &input, move |progress| {
            let _ = app_handle.emit("calc-progress", progress);
        })
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("计算任务失败: {e}"))?
}

#[tauri::command]
async fn calculate_target_cmd(input: CalcInput) -> Result<TargetWearResult, String> {
    calc::calculate_target(&input).map_err(|e| e.to_string())
}

#[tauri::command]
fn ready_cmd(app: AppHandle) -> Result<(), String> {
    for (_, w) in app.webview_windows() {
        let _ = w.center();
        let _ = w.show();
    }
    Ok(())
}

// ── App Entry Point ───────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cookie_sender = spawn_cookie_worker();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(CookieWorkerState {
            sender: cookie_sender,
        })
        .setup(|app| {
            // Safety net: show window after delay in case frontend invoke fails
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(800));
                for (_, w) in handle.webview_windows() {
                    let _ = w.center();
                    let _ = w.show();
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_status,
            clear_data,
            load_cookies_cmd,
            launch_browser_cmd,
            extract_cookies_cmd,
            start_scrape,
            load_wears_cmd,
            calculate_optimal,
            calculate_target_cmd,
            ready_cmd,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Clean up cookie worker thread
                if let Some(state) = window.try_state::<CookieWorkerState>() {
                    let _ = state.sender.send(CookieCommand::Shutdown);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("启动应用失败");
}
