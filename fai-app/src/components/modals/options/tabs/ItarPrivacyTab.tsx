import React, { useEffect, useState } from 'react';
import type { ItarPrivacySettings } from '../../../../types/applicationOptions';
import type { AppInfo } from '../../../../types/electron';
import { useApplicationOptions } from '../../../../stores/useApplicationOptionsStore';

interface ItarPrivacyTabProps {
  settings: ItarPrivacySettings;
  onChange: (patch: Partial<ItarPrivacySettings>) => void;
}

const LICENSE_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  OFFLINE_LEASE: 'Offline lease',
  REVOKED: 'Released',
  UNLICENSED: 'Not activated'
};

export const ItarPrivacyTab: React.FC<ItarPrivacyTabProps> = () => {
  const [appOptions] = useApplicationOptions();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.api?.getAppInfo?.()
      .then(info => {
        if (!cancelled) setAppInfo(info);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: Array<[string, string]> = [
    ['Version', appInfo ? `${appInfo.version}${appInfo.packaged ? '' : ' (development build)'}` : '—'],
    ['Electron', appInfo?.electron ?? '—'],
    ['Chromium', appInfo?.chrome ?? '—'],
    ['Node.js', appInfo?.node ?? '—'],
    ['Platform', appInfo?.platform ?? '—'],
    ['License', LICENSE_LABELS[appOptions.licensing.status] ?? appOptions.licensing.status]
  ];

  return (
    <div className="flex flex-col gap-6 text-xs text-slate-800">

      {/* 1. DATA & PRIVACY (statement of fact, not a setting) */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider mb-2">
          Data & Privacy
        </h3>
        <p className="text-[11px] text-slate-600">
          Drawings, measurements and reports are processed and stored only on this computer.
          LOONIST connects to the internet only to activate or refresh its license.
        </p>
      </div>

      {/* 2. ABOUT */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider mb-3">
          About LOONIST
        </h3>

        <div className="rounded border border-slate-200 bg-white overflow-hidden">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-slate-100">
              <span className="text-slate-500">{label}</span>
              <span className="font-mono text-[11px] text-slate-800 select-all">{value}</span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          Support: <a href="mailto:support@loonist.com" className="text-blue-600 font-medium">support@loonist.com</a>
        </p>
      </div>

    </div>
  );
};
