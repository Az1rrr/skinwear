import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CookieJson {
  name: string;
  value: string;
  domain: string;
  path: string;
}

interface CookieStepProps {
  onDone: () => void;
  hasCookie: boolean;
}

export default function CookieStep({ onDone, hasCookie }: CookieStepProps) {
  const [launched, setLaunched] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [cookies, setCookies] = useState<CookieJson[]>([]);
  const [error, setError] = useState("");

  const handleLaunch = async () => {
    setError("");
    try {
      await invoke("launch_browser_cmd");
      setLaunched(true);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleExtract = async () => {
    setExtracting(true);
    setError("");
    try {
      const result = await invoke<CookieJson[]>("extract_cookies_cmd");
      setCookies(result);
      onDone();
    } catch (e) {
      setError(String(e));
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🍪</span>
        <div>
          <h2 className="text-xl font-semibold">步骤 1：获取 Cookie</h2>
          <p className="text-gray-400 text-sm mt-1">
            打开 Chrome 浏览器，手动登录 BUFF 后保存 Cookie
          </p>
        </div>
      </div>

      {hasCookie && (
        <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4 text-green-300 text-sm">
          ✅ 已有 cookie.json，你可以直接进行下一步爬取。
        </div>
      )}

      <div className="bg-surface-400 rounded-lg p-4 space-y-3">
        <p className="text-sm text-gray-300">
          1. 点击「打开浏览器」启动 Chrome
          <br />
          2. 在浏览器中手动登录 BUFF 账号
          <br />
          3. 登录完成后，回到此处点击「我已登录，提取 Cookie」
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleLaunch}
            className="btn-primary"
          >
            {launched ? "🔄 重新打开浏览器" : "🚀 打开浏览器"}
          </button>

          <button
            onClick={handleExtract}
            disabled={!launched || extracting}
            className="btn-secondary"
          >
            {extracting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                提取中...
              </span>
            ) : (
              "我已登录，提取 Cookie"
            )}
          </button>
        </div>
      </div>

      {cookies.length > 0 && (
        <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4">
          <p className="text-green-300 text-sm">
            ✅ 成功提取 {cookies.length} 条 Cookie
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4">
          <p className="text-red-300 text-sm">❌ {error}</p>
        </div>
      )}
    </div>
  );
}
