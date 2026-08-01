import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface CookieJson {
  name: string;
  value: string;
  domain: string;
  path: string;
}

interface ScrapeProgress {
  current_page: number;
  total_pages: number;
  wears_collected: number;
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
  const [progress, setProgress] = useState<ScrapeProgress | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      unlistenRef.current?.();
    };
  }, []);

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
    setProgress(null);

    try {
      const unlisten = await listen<ScrapeProgress>("scrape-progress", (event) => {
        setProgress(event.payload);
      });
      unlistenRef.current = unlisten;

      const cookies = await invoke<CookieJson[]>("load_cookies_cmd");
      await invoke<number>("start_scrape", {
        cookies,
        url: url.trim(),
        pages: pageCount,
      });

      unlistenRef.current?.();
      unlistenRef.current = null;
      onDone();
    } catch (e) {
      setError(String(e));
    } finally {
      unlistenRef.current?.();
      unlistenRef.current = null;
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

      {scraping && progress && (
        <div className="space-y-3">
          <div className="w-full bg-surface-400 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-brand-500 h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${Math.round(
                  (progress.current_page / progress.total_pages) * 100
                )}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>
              页面 {progress.current_page} / {progress.total_pages}
            </span>
            <span>已收集 {progress.wears_collected} 条磨损数据</span>
          </div>
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
