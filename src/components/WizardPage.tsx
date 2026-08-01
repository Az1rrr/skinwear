import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import StepIndicator from "./StepIndicator";
import CookieStep from "./CookieStep";
import ScrapeStep from "./ScrapeStep";
import CalculateStep from "./CalculateStep";

interface StatusResult {
  has_cookie: boolean;
  has_wear: boolean;
}

export default function WizardPage() {
  const [status, setStatus] = useState<StatusResult>({ has_cookie: false, has_wear: false });
  const [currentStep, setCurrentStep] = useState(0);
  const [wears, setWears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetConfirm, setResetConfirm] = useState(false);

  // 检查文件状态，仅在初始加载时决定起始步骤
  useEffect(() => {
    (async () => {
      try {
        const s = await invoke<StatusResult>("check_status");
        setStatus(s);
        if (!s.has_cookie) {
          setCurrentStep(0);
        } else if (!s.has_wear) {
          setCurrentStep(1);
        } else {
          setCurrentStep(2);
        }
      } catch (e) {
        console.error("Failed to check status:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 手动跳转步骤：只更新文件状态用于步骤指示器，不自动跳步
  const goToStep = async (step: number) => {
    setCurrentStep(step);
    try {
      const s = await invoke<StatusResult>("check_status");
      setStatus(s);
    } catch (e) {
      console.error("Failed to check status:", e);
    }
  };

  const handleReset = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    try {
      await invoke("clear_data");
    } catch (e) {
      console.error("Failed to clear data:", e);
    }
    setStatus({ has_cookie: false, has_wear: false });
    setWears([]);
    setCurrentStep(0);
    setResetConfirm(false);
  };

  const onCookieDone = () => {
    setStatus((s) => ({ ...s, has_cookie: true }));
    setCurrentStep(1);
  };

  const onScrapeDone = async () => {
    setStatus((s) => ({ ...s, has_wear: true }));
    try {
      const w = await invoke<number[]>("load_wears_cmd");
      setWears(w);
    } catch (e) {
      console.error("Failed to load wears:", e);
    }
    setCurrentStep(2);
  };

  const steps = [
    { label: "获取 Cookie", done: status.has_cookie },
    { label: "爬取磨损", done: status.has_wear },
    { label: "计算最优", done: false },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold text-gray-100">
          CS2 皮肤汰换合同
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          向导式操作：获取 Cookie → 爬取磨损数据 → 计算最优组合
        </p>
        <div className="mt-3">
          <button
            onClick={handleReset}
            onBlur={() => setResetConfirm(false)}
            className={`text-xs py-1 px-3 rounded transition-colors ${
              resetConfirm
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "text-gray-600 hover:text-red-400 hover:bg-surface-400"
            }`}
          >
            {resetConfirm ? "⚠ 确认清除？cookie + 磨损数据将全部删除" : "🗑 清除所有数据"}
          </button>
        </div>
      </div>

      <StepIndicator
        currentStep={currentStep}
        steps={steps}
        onStepClick={(step) => goToStep(step)}
      />

      <div className="card">
        {currentStep === 0 && (
          <CookieStep onDone={onCookieDone} hasCookie={status.has_cookie} />
        )}
        {currentStep === 1 && (
          <ScrapeStep
            onDone={onScrapeDone}
            hasWear={status.has_wear}
            disabled={!status.has_cookie}
            onBack={() => goToStep(0)}
          />
        )}
        {currentStep === 2 && (
          <CalculateStep
            wears={wears}
            hasWear={status.has_wear}
            onBack={() => goToStep(1)}
            onBackToCookie={() => goToStep(0)}
          />
        )}
      </div>
    </div>
  );
}
