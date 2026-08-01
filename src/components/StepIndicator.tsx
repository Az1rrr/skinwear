interface StepIndicatorProps {
  currentStep: number;
  steps: { label: string; done: boolean }[];
  onStepClick?: (step: number) => void;
}

export default function StepIndicator({ currentStep, steps, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, i) => {
        const clickable = !!onStepClick;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <button
                onClick={() => onStepClick?.(i)}
                disabled={!onStepClick}
                className={`step-indicator ${
                  step.done
                    ? "step-done"
                    : i === currentStep
                    ? "step-active"
                    : "step-pending"
                } ${
                  clickable
                    ? "cursor-pointer hover:scale-110"
                    : "cursor-default"
                }`}
                title={clickable ? `跳转到「${step.label}」` : undefined}
              >
                {step.done ? "✓" : i + 1}
              </button>
              <span
                className={`text-xs mt-2 whitespace-nowrap ${
                  i === currentStep
                    ? "text-brand-400"
                    : step.done
                    ? "text-green-400"
                    : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-2 mt-[-20px] transition-colors duration-300 ${
                  step.done ? "bg-green-600" : "bg-gray-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
