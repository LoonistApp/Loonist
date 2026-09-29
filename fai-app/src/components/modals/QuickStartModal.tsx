import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Sparkles, 
  Table, 
  FileSpreadsheet, 
  ArrowRight, 
  ArrowLeft, 
  Play, 
  CheckCircle2 
} from 'lucide-react';
import { QUICK_START_WORKFLOW } from '../../data/helpData';

interface QuickStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSample?: () => void;
}

const STEP_ICONS = [
  FileText,
  Sparkles,
  Table,
  FileSpreadsheet
];

export const QuickStartModal: React.FC<QuickStartModalProps> = ({
  isOpen,
  onClose,
  onLoadSample
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const stepData = QUICK_START_WORKFLOW[currentStep];
  const StepIcon = STEP_ICONS[currentStep];

  return (
    <div 
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-white border border-slate-300 rounded-xl shadow-2xl flex flex-col text-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                LOONIST Quick Start Guide
              </h3>
              <p className="text-[11px] text-slate-500">
                Aerospace First Article Inspection (SAE AS9102 Rev B/C) Workflow
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
            title="Close [ESC]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2">
            {QUICK_START_WORKFLOW.map((s, idx) => {
              const isPast = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`flex-1 flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-left transition cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-200 border border-slate-300 text-slate-900 font-bold'
                      : isPast
                      ? 'text-emerald-700 hover:bg-slate-100 '
                      : 'text-slate-400 hover:bg-slate-100 '
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                    isCurrent
                      ? 'bg-slate-900 text-white font-bold'
                      : isPast
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600 '
                  }`}>
                    {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.step}
                  </span>
                  <span className="text-[11px] truncate hidden inline">
                    Step {s.step}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Content Body */}
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 shrink-0 shadow-xs">
              <StepIcon className="w-6 h-6" />
            </div>

            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-mono font-bold text-[10px]">
                  STEP {stepData.step} OF 4
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600">
                  {stepData.badge}
                </span>
              </div>

              <h4 className="text-base font-bold text-slate-900">
                {stepData.title}
              </h4>

              <p className="text-xs text-slate-600 leading-relaxed">
                {stepData.description}
              </p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{stepData.keyAction}</span>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {onLoadSample && (
              <button
                type="button"
                onClick={() => {
                  onLoadSample();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Try with Sample Blueprint</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            {currentStep < QUICK_START_WORKFLOW.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(QUICK_START_WORKFLOW.length - 1, prev + 1))}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <span>Get Started</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
