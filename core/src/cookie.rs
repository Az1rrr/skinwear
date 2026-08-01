use anyhow::{Context, Result};
use headless_chrome::{Browser, LaunchOptions};
use std::ffi::OsStr;
use std::time::Duration;

use crate::browser::find_browser_path;
use crate::types::CookieJson;

/// Launch a browser for manual BUFF login (non-headless).
/// Auto-detects Edge (Windows) or Chrome based on the platform.
/// Returns the Browser handle — the caller must keep it alive until cookies are extracted.
pub fn launch_browser(url: &str) -> Result<Browser> {
    let browser_path = find_browser_path().context("未找到可用浏览器")?;

    // Flags to skip first-run wizards (important for Edge)
    let extra_args: Vec<&OsStr> = vec![
        OsStr::new("--no-first-run"),
        OsStr::new("--no-default-browser-check"),
    ];

    let launch_opts = LaunchOptions::default_builder()
        .headless(false)
        .sandbox(false)
        .path(Some(browser_path))
        .args(extra_args)
        .window_size(Some((1280, 800)))
        .idle_browser_timeout(Duration::from_secs(120))
        .build()
        .context("构建启动选项失败")?;

    let browser = Browser::new(launch_opts).context("启动浏览器失败")?;

    // Close the default blank tab and open one pointing to BUFF
    let tab = browser.new_tab().context("打开新标签页失败")?;
    let our_id = tab
        .get_target_info()
        .map(|info| info.target_id)
        .context("获取标签页信息失败")?;

    {
        let tabs = browser
            .get_tabs()
            .lock()
            .map_err(|e| anyhow::anyhow!("获取标签页锁失败: {e}"))?;
        for t in tabs.iter() {
            if let Ok(info) = t.get_target_info() {
                if info.target_id != our_id {
                    let _ = t.close_target();
                }
            }
        }
    }

    // Navigate to BUFF — do not wait, user drives the browser manually
    tab.navigate_to(url)
        .context("跳转到目标 URL 失败")?;

    // Give the browser a moment to start loading before returning
    std::thread::sleep(Duration::from_millis(500));

    Ok(browser)
}

/// Extract cookies from an already-open Browser (user must have logged in).
pub fn extract_cookies(browser: &Browser) -> Result<Vec<CookieJson>> {
    let tabs = browser
        .get_tabs()
        .lock()
        .map_err(|e| anyhow::anyhow!("获取标签页锁失败: {e}"))?;

    let mut cookies = Vec::new();
    for t in tabs.iter() {
        if let Ok(info) = t.get_target_info() {
            if info.url != "about:blank" && !info.url.is_empty() {
                let raw = t.get_cookies().context("获取 Cookie 失败")?;
                cookies = raw
                    .into_iter()
                    .map(|c| CookieJson {
                        name: c.name,
                        value: c.value,
                        domain: c.domain,
                        path: c.path,
                    })
                    .collect();
                break;
            }
        }
    }

    if cookies.is_empty() {
        anyhow::bail!("未找到已登录的标签页，请确保已在浏览器中登录 BUFF");
    }

    Ok(cookies)
}
