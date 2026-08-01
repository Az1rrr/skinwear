use anyhow::Result;
use std::path::PathBuf;

/// Detect the best available browser on this system.
///
/// Logic:
/// - **Windows**: prefer Edge, fall back to Chrome.
/// - **macOS / Linux**: use Chrome (or Chromium on Linux).
///
/// Returns an error if no supported browser is found, asking the user to install Chrome.
pub fn find_browser_path() -> Result<PathBuf> {
    if cfg!(target_os = "windows") {
        // 1) Edge (preferred on Windows)
        for p in edge_paths_windows() {
            if p.exists() {
                return Ok(p);
            }
        }
        // 2) Chrome fallback
        for p in chrome_paths_windows() {
            if p.exists() {
                return Ok(p);
            }
        }
    } else if cfg!(target_os = "macos") {
        // Chrome on macOS
        for p in chrome_paths_macos() {
            if p.exists() {
                return Ok(p);
            }
        }
    } else {
        // Linux / other Unix
        for p in chrome_paths_linux() {
            if p.exists() {
                return Ok(p);
            }
        }
    }

    anyhow::bail!(
        "未找到 Chrome 浏览器。\n\
         请前往 https://www.google.com/chrome/ 下载并安装 Chrome 后重试。"
    )
}

// ── Windows ──────────────────────────────────────────────────────────

fn edge_paths_windows() -> Vec<PathBuf> {
    let mut paths = vec![
        PathBuf::from(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        PathBuf::from(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
    ];
    // Also check LOCALAPPDATA (user install)
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        paths.push(
            PathBuf::from(local)
                .join(r"Microsoft\Edge\Application\msedge.exe"),
        );
    }
    paths
}

fn chrome_paths_windows() -> Vec<PathBuf> {
    let mut paths = vec![
        PathBuf::from(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        PathBuf::from(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    ];
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        paths.push(
            PathBuf::from(local)
                .join(r"Google\Chrome\Application\chrome.exe"),
        );
    }
    paths
}

// ── macOS ────────────────────────────────────────────────────────────

fn chrome_paths_macos() -> Vec<PathBuf> {
    vec![
        PathBuf::from("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    ]
}

// ── Linux ────────────────────────────────────────────────────────────

fn chrome_paths_linux() -> Vec<PathBuf> {
    vec![
        PathBuf::from("/usr/bin/google-chrome-stable"),
        PathBuf::from("/usr/bin/google-chrome"),
        PathBuf::from("/usr/bin/chromium"),
        PathBuf::from("/usr/bin/chromium-browser"),
        PathBuf::from("/snap/bin/chromium"),
    ]
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_browser_does_not_panic() {
        // Just make sure it returns either Ok or the expected error message
        match find_browser_path() {
            Ok(path) => {
                assert!(path.is_absolute() || path.to_string_lossy().contains("Chrome"));
            }
            Err(e) => {
                let msg = e.to_string();
                assert!(msg.contains("未找到 Chrome 浏览器") || msg.contains("Chrome"));
            }
        }
    }
}
