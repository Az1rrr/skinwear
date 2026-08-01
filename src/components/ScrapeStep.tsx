import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CookieJson {
  name: string;
  value: string;
  domain: string;
  path: string;
}

interface ScrapeStepProps {
  onDone: () => void;
  hasWear: boolean;
  disabled: boolean;
  onBack: () => void;
}

export default function ScrapeStep({ onDone, hasWear, disabled, onBack }: ScrapeStepProps) {
  const [url, setUrl] = useState("");
  const [pages, setPages] = useState("3");
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState("");

  const handleScrape = async () => {
    if (!url.trim() || !pages.trim()) {
      setError("请填写商品 URL 和爬取页数");
      return;
    }

    const pageCount = parseInt(pages, 10);
    if (isNaN(pageCount) || pageCount < 1) {
      setError("页数必须是正整数");
      return;
    }

    setScraping(true);
    setError("");

    try {
      const cookies = await invoke<CookieJson[]>("load_cookies_cmd");
      await invoke<number>("start_scrape", {
        cookies,
        url: url.trim(),
        pages: pageCount,
      });
      onDone();
    } catch (e) {
      setError(String(e));
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🕷️</span>
          <div>
            <h2 className="text-xl font-semibold">步骤 2：爬取磨损数据</h2>
            <p className="text-gray-400 text-sm mt-1">
              从 BUFF 市场 API 爬取指定商品的磨损值
            </p>
          </div>
        </div>
        <button
          onClick={onBack}
          disabled={scraping}
          className="btn-secondary text-sm py-1.5 px-3"
        >
          ← 返回上一步
        </button>
      </div>

      {disabled && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 text-yellow-300 text-sm">
          ⚠️ 需要先完成「获取 Cookie」步骤
        </div>
      )}

      {hasWear && (
        <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4 text-green-300 text-sm">
          ✅ 已有 wear.txt，你可以直接进行下一步计算。
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            BUFF 商品 URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://buff.163.com/goods/871801?min_paintwear=0.15&max_paintwear=0.38"
            className="input-field"
            disabled={scraping}
          />
        </div>

        <div className="flex items-end gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">爬取页数</label>
            <input
              type="number"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              min="1"
              max="50"
              className="input-field w-28"
              disabled={scraping}
            />
          </div>
          <button
            onClick={handleScrape}
            disabled={disabled || scraping || !url.trim()}
            className="btn-primary"
          >
            {scraping ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                爬取中...
              </span>
            ) : (
              "🕷️ 开始爬取"
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4">
          <p className="text-red-300 text-sm">❌ {error}</p>
        </div>
      )}
    </div>
  );
}
