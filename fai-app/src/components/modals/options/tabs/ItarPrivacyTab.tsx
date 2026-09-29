import React, { useState } from 'react';
import type { ItarPrivacySettings } from '../../../../types/applicationOptions';
import { 
  ExternalLink
} from 'lucide-react';

interface ItarPrivacyTabProps {
  settings: ItarPrivacySettings;
  onChange: (patch: Partial<ItarPrivacySettings>) => void;
}

export const ItarPrivacyTab: React.FC<ItarPrivacyTabProps> = ({
  settings,
  onChange
}) => {
  const [showSystemInfo, setShowSystemInfo] = useState(false);

  return (
    <div className="flex flex-col gap-6 text-xs text-slate-800">
      
      {/* 1. ITAR / CMMC DATA SOVEREIGNTY (DEFENSE AEROSPACE MANDATE) */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
            ITAR & CMMC Level 2 Data Sovereignty Guard
          </h3>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Ensures strict regulatory compliance for defense contractors. All PDF rendering, OCR extraction, measurement evaluations, and database stores are executed 100% on the local workstation.
        </p>

        <label className="flex items-start gap-2.5 p-2 rounded bg-white border border-slate-200 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.localProcessingOnly}
            onChange={(e) => onChange({ localProcessingOnly: e.target.checked })}
            className="mt-0.5 w-4 h-4 rounded text-emerald-600 border-slate-300"
          />
          <div>
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              Enforce Strict Local Isolation Mode
              <span className="px-1.5 py-0.5 rounded text-[9px] text-emerald-700 border border-emerald-500/40 font-mono">
                COMPLIANT
              </span>
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Customer drawings and sensitive IP will never leave the local machine. Outbound network traffic is mathematically restricted to the Cloudflare licensing plane.
            </p>
          </div>
        </label>
      </div>

      {/* 2. DIAGNOSTICS & TELEMETRY */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
            Diagnostics & Hardware Performance
          </h3>
        </div>

        <div className="flex flex-col gap-2.5">
          <label className="flex items-start gap-2.5 p-1.5 rounded hover:bg-slate-100 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.hardwareAcceleration}
              onChange={(e) => onChange({ hardwareAcceleration: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300"
            />
            <div>
              <span className="font-medium text-slate-800">
                GPU Hardware Acceleration & WebGL 2.0 Canvas
              </span>
              <p className="text-[11px] text-slate-500">
                Enables dedicated GPU rendering for smooth 60 FPS pan and zoom on high-resolution 600 DPI engineering drawings.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-1.5 rounded hover:bg-slate-100 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.anonymousTelemetry}
              onChange={(e) => onChange({ anonymousTelemetry: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300"
            />
            <div>
              <span className="font-medium text-slate-800">
                Anonymous Crash Diagnostics & Quality Metrics
              </span>
              <p className="text-[11px] text-slate-500">
                Help improve LOONIST by sending anonymized error stack traces (zero drawing or part data is ever collected).
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-1.5 rounded hover:bg-slate-100 transition cursor-pointer">
            <input
              type="checkbox"
              checked={settings.updateNotifications}
              onChange={(e) => onChange({ updateNotifications: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300"
            />
            <div>
              <span className="font-medium text-slate-800">
                Regulatory Standards & AS9102 Update Notifications
              </span>
              <p className="text-[11px] text-slate-500">
                Receive in-app alerts when SAE updates AS9102 or AIAG updates dimensional inspection formats.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* 3. RESOURCES, ABOUT & SYSTEM INFO */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
              About LOONIST & Online Resources
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowSystemInfo(!showSystemInfo)}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 transition font-medium cursor-pointer"
          >
            {showSystemInfo ? 'Hide System Info' : 'System Info'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="p-3 bg-white rounded border border-slate-200">
            <span className="font-semibold text-slate-900 block mb-0.5">LOONIST Documentation</span>
            <p className="text-[11px] text-slate-500 mb-2">
              Step-by-step guides for AS9102 Rev C ballooning and Net-Inspect integration.
            </p>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 font-medium inline-flex items-center gap-1 text-[11px]"
            >
              Visit Knowledgebase <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="p-3 bg-white rounded border border-slate-200">
            <span className="font-semibold text-slate-900 block mb-0.5">Contact Technical Support</span>
            <p className="text-[11px] text-slate-500 mb-2">
              Priority aerospace support for enterprise deployment and calibration questions.
            </p>
            <a
              href="mailto:support@loonist.com"
              className="text-blue-600 font-medium inline-flex items-center gap-1 text-[11px]"
            >
              Contact Engineering <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* System Info Drawer */}
        {showSystemInfo && (
          <div className="p-3 bg-slate-100 rounded border border-slate-200 font-mono text-[11px] text-slate-600 flex flex-col gap-1">
            <div><strong className="text-slate-800">Software:</strong> LOONIST Quality Control Professional 2026.9.12</div>
            <div><strong className="text-slate-800">Runtime:</strong> Electron 44.0.0 / Chromium 132.0.6834.83</div>
            <div><strong className="text-slate-800">Engine:</strong> React 19.2.8 + Vite 8.2.2</div>
            <div><strong className="text-slate-800">Cryptography:</strong> Ed25519 Hardware Verification Active</div>
            <div><strong className="text-slate-800">Storage:</strong> Local SQLite 3.45 WAL Mode</div>
          </div>
        )}
      </div>

    </div>
  );
};
