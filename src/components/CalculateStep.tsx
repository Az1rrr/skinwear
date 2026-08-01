import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface MaterialEntry {
  wear: string;
  page: number;
  row: number;
}

interface OptimalResult {
  output_wear: string;
  deviation: string;
  avg_actual: string;
  avg_t: string;
  materials: MaterialEntry[];
  wear_values: string[];
}

interface CalcInput {
  input_max: string;
  input_min: string;
  output_max: string;
  output_min: string;
  target_wear: string;
  top_n: number;
}

interface CalcProgress {
  current: number;
  total: number;
}

interface CalculateStepProps {
  wears: string[];
  hasWear: boolean;
  onBack: () => void;
  onBackToCookie: () => void;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function CalculateStep({ wears, hasWear, onBack, onBackToCookie }: CalculateStepProps) {
  const [inputMax, setInputMax] = useState("");
  const [inputMin, setInputMin] = useState("");
  const [outputMax, setOutputMax] = useState("");
  const [outputMin, setOutputMin] = useState("");
  const [targetWear, setTargetWear] = useState("");
  const [topN, setTopN] = useState("20");
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<OptimalResult | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<CalcProgress | null>(null);
  const startTime = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      unlistenRef.current?.();
    };
  }, []);

  const handleCalculate = async () => {
    setError("");
    setResult(null);

    const input: CalcInput = {
      input_max: inputMax,
      input_min: inputMin,
      output_max: outputMax,
      output_min: outputMin,
      target_wear: targetWear,
      top_n: parseInt(topN, 10) || 20,
    };

    if (
      isNaN(parseFloat(input.input_max)) ||
      isNaN(parseFloat(input.input_min)) ||
      isNaN(parseFloat(input.output_max)) ||
      isNaN(parseFloat(input.output_min)) ||
      isNaN(parseFloat(input.target_wear))
    ) {
      setError("请填写所有磨损范围参数");
      return;
    }

    if (parseFloat(input.input_max) <= parseFloat(input.input_min)) {
      setError("素材最高磨损必须大于最低磨损");
      return;
    }
    if (parseFloat(input.output_max) <= parseFloat(input.output_min)) {
      setError("产物最高磨损必须大于最低磨损");
      return;
    }
    if (input.top_n < 10) {
      setError("候选数（Top N）至少为 10");
      return;
    }

    setCalculating(true);
    setElapsed(0);
    setProgress(null);
    startTime.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTime.current);
    }, 100);
    try {
      const unlisten = await listen<CalcProgress>("calc-progress", (event) => {
        setProgress(event.payload);
      });
      unlistenRef.current = unlisten;

      let res: OptimalResult;
      if (wears.length > 0) {
        res = await invoke<OptimalResult>("calculate_optimal", {
          wears,
          input,
        });
      } else {
        // Load wears if not already loaded
        const loadedWears = await invoke<string[]>("load_wears_cmd");
        if (loadedWears.length < 10) {
          setError(`磨损数据不足（当前 ${loadedWears.length} 条，需要至少 10 条）`);
          setCalculating(false);
          if (timerRef.current) clearInterval(timerRef.current);
          unlistenRef.current?.();
          unlistenRef.current = null;
          return;
        }
        res = await invoke<OptimalResult>("calculate_optimal", {
          wears: loadedWears,
          input,
        });
      }
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      unlistenRef.current?.();
      unlistenRef.current = null;
      setCalculating(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        setElapsed(Date.now() - startTime.current);
      }
    }
  };

  const combos =
    topN && parseInt(topN, 10) >= 10
      ? numCombinations(parseInt(topN, 10), 10)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <h2 className="text-xl font-semibold">步骤 3：计算最优组合</h2>
            <p className="text-gray-400 text-sm mt-1">
              输入磨损范围，暴力枚举找到最佳 10 把素材组合
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBackToCookie}
            disabled={calculating}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            ← 重新获取 Cookie
          </button>
          <button
            onClick={onBack}
            disabled={calculating}
            className="btn-secondary text-sm py-1.5 px-3"
          >
            ← 返回爬取
          </button>
        </div>
      </div>

      {!hasWear && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 text-yellow-300 text-sm">
          ⚠️ 需要先完成「爬取磨损」步骤来获取 wear.txt
        </div>
      )}

      {wears.length > 0 && (
        <p className="text-sm text-gray-400">已加载 {wears.length} 条磨损数据</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <fieldset className="space-y-3 p-4 bg-surface-400 rounded-lg">
          <legend className="text-sm font-medium text-gray-300 px-2">
            素材皮肤范围
          </legend>
          <InputRow label="最高磨损上限 (h.cap)" value={inputMax} onChange={setInputMax} />
          <InputRow label="最低磨损上限 (l.cap)" value={inputMin} onChange={setInputMin} />
        </fieldset>

        <fieldset className="space-y-3 p-4 bg-surface-400 rounded-lg">
          <legend className="text-sm font-medium text-gray-300 px-2">
            产物皮肤范围
          </legend>
          <InputRow label="最高磨损上限" value={outputMax} onChange={setOutputMax} />
          <InputRow label="最低磨损上限" value={outputMin} onChange={setOutputMin} />
          <InputRow label="期望成品磨损" value={targetWear} onChange={setTargetWear} />
        </fieldset>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            候选组合数 Top N（默认 20）
          </label>
          <input
            type="number"
            value={topN}
            onChange={(e) => setTopN(e.target.value)}
            min="10"
            className="input-field w-24"
          />
        </div>
        {combos !== null && (
          <span className="text-xs text-gray-500 pb-2">
            C({parseInt(topN, 10) || 0}, 10) = {combos.toLocaleString()} 种组合
          </span>
        )}
        <button
          onClick={handleCalculate}
          disabled={calculating || !hasWear}
          className="btn-primary"
        >
          {calculating ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              计算中...
            </span>
          ) : (
            "🎯 寻找最优组合"
          )}
        </button>
      </div>

      {calculating && (
        <div className="bg-surface-400 border border-brand-800/50 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-400 flex items-center gap-2">
              <span className="animate-spin w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full" />
              正在枚举组合...
            </h3>
            <span className="text-sm text-gray-400 font-mono">{formatElapsed(elapsed)}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 rounded-full transition-all duration-300 ease-out shadow-lg shadow-brand-500/30"
              style={{
                width: progress
                  ? `${Math.round((progress.current / progress.total) * 100)}%`
                  : "0%",
              }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-400">
            <span>
              组合{" "}
              <span className="text-brand-400 font-mono font-bold">
                {progress ? progress.current.toLocaleString() : 0}
              </span>{" "}
              / {combos?.toLocaleString() ?? "?"}
            </span>
            <span>
              {progress
                ? `${Math.round((progress.current / progress.total) * 100)}%`
                : "准备中..."}
            </span>
          </div>
        </div>
      )}

      {result && <ResultCard result={result} targetWear={targetWear} />}

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4">
          <p className="text-red-300 text-sm">❌ {error}</p>
        </div>
      )}
    </div>
  );
}

function InputRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-36 shrink-0">{label}</label>
      <input
        type="number"
        step="0.00000001"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field py-1.5 text-sm"
        placeholder="0.0"
      />
    </div>
  );
}

function ResultCard({
  result,
  targetWear,
}: {
  result: OptimalResult;
  targetWear: string;
}) {
  return (
    <div className="bg-surface-400 border border-brand-700/50 rounded-lg p-5 space-y-3">
      <h3 className="text-lg font-semibold text-brand-400">✅ 最优组合</h3>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">期望成品磨损:</span>
          <span className="text-gray-200 font-mono">{targetWear}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">实际成品磨损:</span>
          <span className="text-brand-400 font-mono font-bold">{result.output_wear}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">磨损偏差:</span>
          <span className="text-green-400 font-mono">{result.deviation}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">材料平均磨损:</span>
          <span className="text-gray-200 font-mono">{result.avg_actual}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">材料平均 t.float:</span>
          <span className="text-gray-200 font-mono">{result.avg_t}</span>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">
          素材列表（{result.materials.length} 把）
        </h4>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {result.materials.map((m, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-surface-300 rounded px-3 py-1.5 text-sm"
            >
              <span className="text-gray-400">#{i + 1}</span>
              <span className="font-mono text-gray-200">{m.wear}</span>
              <span className="text-xs text-gray-500">
                第 {m.page} 页, 第 {m.row} 行
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 font-mono break-all">
          磨损值: [{result.wear_values.join(", ")}]
        </p>
      </div>
    </div>
  );
}

function numCombinations(n: number, r: number): number {
  if (r > n) return 0;
  r = Math.min(r, n - r);
  let result = 1;
  for (let i = 0; i < r; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}
