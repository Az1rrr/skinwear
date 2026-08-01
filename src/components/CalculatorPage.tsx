import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface TargetWearResult {
  target_avg_t: number;
  target_avg_actual: number;
  target_total: number;
  input_range: number;
  output_range: number;
}

interface CalcInput {
  input_max: number;
  input_min: number;
  output_max: number;
  output_min: number;
  target_wear: number;
  top_n: number;
}

export default function CalculatorPage() {
  const [inputMax, setInputMax] = useState("");
  const [inputMin, setInputMin] = useState("");
  const [outputMax, setOutputMax] = useState("");
  const [outputMin, setOutputMin] = useState("");
  const [targetWear, setTargetWear] = useState("");
  const [result, setResult] = useState<TargetWearResult | null>(null);
  const [error, setError] = useState("");
  const [calculating, setCalculating] = useState(false);

  const handleCalculate = async () => {
    setError("");
    setResult(null);

    const input: CalcInput = {
      input_max: parseFloat(inputMax),
      input_min: parseFloat(inputMin),
      output_max: parseFloat(outputMax),
      output_min: parseFloat(outputMin),
      target_wear: parseFloat(targetWear),
      top_n: 10, // unused for target calc
    };

    if (
      isNaN(input.input_max) ||
      isNaN(input.input_min) ||
      isNaN(input.output_max) ||
      isNaN(input.output_min) ||
      isNaN(input.target_wear)
    ) {
      setError("请填写所有磨损范围参数");
      return;
    }

    if (input.input_max <= input.input_min) {
      setError("素材最高磨损必须大于最低磨损");
      return;
    }
    if (input.output_max <= input.output_min) {
      setError("产物最高磨损必须大于最低磨损");
      return;
    }

    setCalculating(true);
    try {
      const res = await invoke<TargetWearResult>("calculate_target_cmd", { input });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold text-gray-100">🔢 磨损计算器</h1>
        <p className="text-gray-500 text-sm mt-1">
          输入皮肤磨损范围，反推材料目标平均磨损值
        </p>
      </div>

      <div className="card space-y-6">
        <p className="text-sm text-gray-400">
          此计算器可独立使用，无需 Cookie 或爬取数据。
          <br />
          输入材料和产物的磨损范围，即可计算目标材料平均磨损。
        </p>

        <div className="grid grid-cols-2 gap-4">
          <fieldset className="space-y-3 p-4 bg-surface-400 rounded-lg">
            <legend className="text-sm font-medium text-gray-300 px-2">
              素材皮肤范围
            </legend>
            <CalcInputRow label="最高磨损上限 (h.cap)" value={inputMax} onChange={setInputMax} />
            <CalcInputRow label="最低磨损上限 (l.cap)" value={inputMin} onChange={setInputMin} />
          </fieldset>

          <fieldset className="space-y-3 p-4 bg-surface-400 rounded-lg">
            <legend className="text-sm font-medium text-gray-300 px-2">
              产物皮肤范围
            </legend>
            <CalcInputRow label="最高磨损上限" value={outputMax} onChange={setOutputMax} />
            <CalcInputRow label="最低磨损上限" value={outputMin} onChange={setOutputMin} />
            <CalcInputRow label="期望成品磨损" value={targetWear} onChange={setTargetWear} />
          </fieldset>
        </div>

        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="btn-primary w-full"
        >
          {calculating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              计算中...
            </span>
          ) : (
            "🔢 计算目标磨损"
          )}
        </button>

        {result && (
          <div className="bg-surface-400 border border-brand-700/50 rounded-lg p-5 space-y-4">
            <h3 className="text-lg font-semibold text-brand-400">📐 计算结果</h3>

            <div className="text-center py-4">
              <p className="text-xs text-gray-500 mb-2">目标材料平均磨损</p>
              <p className="text-4xl font-bold text-brand-400 font-mono">
                {result.target_avg_actual.toString()}
              </p>
            </div>

            <div className="bg-surface-300 rounded-lg p-3 space-y-1 text-xs text-gray-500">
              <p>
                公式：成品 = avg(t.float) × (output_max − output_min) + output_min
              </p>
              <p>
                t.float = {result.target_avg_t.toString()} ｜ ×10 总和 = {result.target_total.toString()}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4">
            <p className="text-red-300 text-sm">❌ {error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CalcInputRow({
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

