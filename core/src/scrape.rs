use anyhow::{Context, Result};
use headless_chrome::protocol::cdp::Network::CookieParam;
use headless_chrome::{Browser, LaunchOptions};
use regex::Regex;

use crate::browser::find_browser_path;
use crate::types::{CookieJson, GoodsInfo, ScrapeProgress};

/// Parse a BUFF goods URL to extract goods_id and optional wear filters.
pub fn parse_goods_url(url: &str) -> Result<GoodsInfo> {
    let goods_re = Regex::new(r"/goods/(\d+)")?;
    let min_re = Regex::new(r"min_paintwear=(\d+\.\d+)")?;
    let max_re = Regex::new(r"max_paintwear=(\d+\.\d+)")?;

    let goods_id = goods_re
        .captures(url)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
        .context("无法从 URL 中提取 goods_id")?;

    let min_pw = min_re
        .captures(url)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse().ok());

    let max_pw = max_re
        .captures(url)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse().ok());

    Ok(GoodsInfo {
        goods_id,
        min_paintwear: min_pw,
        max_paintwear: max_pw,
    })
}

/// Build the BUFF API URL from goods info.
pub fn build_api_url(info: &GoodsInfo) -> String {
    let mut url = format!(
        "https://buff.163.com/api/market/goods/sell_order?game=csgo&goods_id={}&sort_by=default&mode=&allow_tradable_cooldown=1",
        info.goods_id
    );
    if let (Some(ref min_m), Some(ref max_m)) = (info.min_paintwear, info.max_paintwear) {
        url.push_str(&format!(
            "&min_paintwear={}&max_paintwear={}",
            min_m, max_m
        ));
    }
    url
}

/// Convert CookieJson to headless_chrome CookieParam for injection.
fn to_cookie_params(cookies: &[CookieJson]) -> Vec<CookieParam> {
    cookies
        .iter()
        .map(|c| CookieParam {
            name: c.name.clone(),
            value: c.value.clone(),
            url: None,
            domain: Some(c.domain.clone()),
            path: Some(c.path.clone()),
            secure: None,
            http_only: None,
            same_site: None,
            expires: None,
            priority: None,
            same_party: None,
            source_scheme: None,
            source_port: None,
            partition_key: None,
        })
        .collect()
}

/// Scrape wear data from BUFF market API using headless Chrome.
/// `on_progress` is called after each page with (current_page, total_pages, wears_collected).
pub fn scrape<F>(
    cookies: &[CookieJson],
    info: &GoodsInfo,
    pages: usize,
    mut on_progress: F,
) -> Result<Vec<String>>
where
    F: FnMut(ScrapeProgress),
{
    let base_url = build_api_url(info);

    let browser_path = find_browser_path().context("未找到可用浏览器")?;

    let launch_opts = LaunchOptions::default_builder()
        .headless(true)
        .sandbox(false)
        .path(Some(browser_path))
        .window_size(Some((1280, 800)))
        .build()
        .context("构建启动选项失败")?;

    let browser = Browser::new(launch_opts).context("启动浏览器失败")?;
    let tab = browser.new_tab().context("打开新标签页失败")?;

    // Navigate to buff.163.com first to establish domain context
    tab.navigate_to("https://buff.163.com/")
        .context("跳转到 buff.163.com 失败")?;
    tab.wait_until_navigated()
        .context("等待页面加载失败")?;

    // Inject cookies
    let cookie_params = to_cookie_params(cookies);
    tab.set_cookies(cookie_params)
        .context("注入 Cookie 失败")?;

    let wear_re = Regex::new(r#""paintwear":"(\d+\.\d+)""#)?;
    let mut all_wears: Vec<String> = Vec::new();

    for page_num in 1..=pages {
        let page_url = format!("{}&page_num={}", base_url, page_num);

        tab.navigate_to(&page_url)
            .with_context(|| format!("跳转到第 {page_num} 页失败"))?;
        tab.wait_until_navigated()
            .with_context(|| format!("等待第 {page_num} 页加载失败"))?;

        let content = tab
            .get_content()
            .with_context(|| format!("获取第 {page_num} 页内容失败"))?;

        for cap in wear_re.captures_iter(&content) {
            all_wears.push(cap[1].to_string());
        }

        on_progress(ScrapeProgress {
            current_page: page_num,
            total_pages: pages,
            wears_collected: all_wears.len(),
        });

        // Rate limiting
        if page_num < pages {
            std::thread::sleep(std::time::Duration::from_secs(1));
        }
    }

    // Close blank default tabs
    {
        let tabs = browser.get_tabs();
        if let Ok(locked) = tabs.lock() {
            for t in locked.iter() {
                if let Ok(info) = t.get_target_info() {
                    if info.url == "about:blank" || info.url.is_empty() {
                        let _ = t.close_target();
                    }
                }
            }
        }
    }

    Ok(all_wears)
}
