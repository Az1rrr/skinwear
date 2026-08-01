/// Set HTTP/HTTPS proxy environment variables.
/// Matches the shell `proxy` function behavior.
pub fn setup_proxy() {
    let proxy_url = "http://127.0.0.1:10808";
    std::env::set_var("http_proxy", proxy_url);
    std::env::set_var("https_proxy", proxy_url);
    std::env::set_var("all_proxy", proxy_url);
    std::env::set_var("HTTP_PROXY", proxy_url);
    std::env::set_var("HTTPS_PROXY", proxy_url);
    std::env::set_var("ALL_PROXY", proxy_url);
}

/// Clear proxy environment variables
pub fn clear_proxy() {
    std::env::remove_var("http_proxy");
    std::env::remove_var("https_proxy");
    std::env::remove_var("all_proxy");
    std::env::remove_var("HTTP_PROXY");
    std::env::remove_var("HTTPS_PROXY");
    std::env::remove_var("ALL_PROXY");
}
