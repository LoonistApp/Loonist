import React, { useEffect, useState } from 'react';
import type { LicensingSettings } from '../../../../types/applicationOptions';
import { applicationOptionsActions } from '../../../../stores/useApplicationOptionsStore';
import { CloudflareLicenseClient } from '../../../../services/license/licenseClient';
import { 
  Key, 
  ShieldCheck, 
  Clock, 
  Download, 
  RotateCw, 
  LogOut, 
  Server, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle
} from 'lucide-react';

interface LicensingTabProps {
  settings: LicensingSettings;
  onChange: (patch: Partial<LicensingSettings>) => void;
}

export const LicensingTab: React.FC<LicensingTabProps> = ({
  settings,
  onChange
}) => {
  const [tokenInput, setTokenInput] = useState(settings.tokenInput || '');
  const [isActivating, setIsActivating] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Validate expiration offline
  const expiryCheck = CloudflareLicenseClient.validateExpiry(settings.expiresAt);

  // Re-verify the stored license (signature, device binding, expiry) whenever the tab opens
  useEffect(() => {
    let cancelled = false;
    CloudflareLicenseClient.refreshStatus().then(verification => {
      if (cancelled || !verification) return;
      const { status, statusDetail, lastValidatedAt } = applicationOptionsActions.get().licensing;
      onChange({ status, statusDetail, lastValidatedAt });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // License changes are saved immediately: the server has already consumed the token or
  // changed the seat, so the result must survive even if the Options dialog is cancelled.
  const applyLicense = (patch: Partial<LicensingSettings>) => {
    onChange(patch);
    applicationOptionsActions.updateLicensing(patch);
  };

  // Handle Cloudflare Token Activation
  const handleActivate = async () => {
    if (!tokenInput.trim()) {
      setFeedback({ type: 'error', text: 'Please enter a valid single-use license token.' });
      return;
    }

    setIsActivating(true);
    setFeedback({ type: 'info', text: 'Connecting to the licensing server...' });

    const res = await CloudflareLicenseClient.activateToken(settings.apiUrl, tokenInput);

    setIsActivating(false);

    if (res.success && res.payload) {
      applyLicense({
        apiUrl: settings.apiUrl,
        status: 'ACTIVE',
        tokenInput: '',
        tenantId: res.payload.tenantId,
        tenantName: res.payload.tenantId,
        deviceId: res.payload.deviceId,
        licenseId: res.payload.licenseId,
        expiresAt: res.payload.expiresAt,
        features: res.payload.features,
        signature: res.signature || '',
        licensePayload: res.payload,
        statusDetail: res.verification?.message || '',
        devicePublicKey: res.devicePublicKey,
        lastValidatedAt: new Date().toISOString()
      });
      setFeedback({ type: 'success', text: res.message });
      setTokenInput('');
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  // Re-fetch a freshly signed license (picks up expiry extended by an administrator)
  const handleRenew = async () => {
    if (!settings.deviceId) {
      setFeedback({ type: 'error', text: 'Activate this workstation before renewing.' });
      return;
    }
    setIsRenewing(true);
    setFeedback({ type: 'info', text: 'Refreshing license from the server...' });

    const res = await CloudflareLicenseClient.renewLicense(settings.apiUrl, settings.deviceId);

    setIsRenewing(false);

    if (res.success && res.payload) {
      applyLicense({
        expiresAt: res.payload.expiresAt,
        signature: res.signature || '',
        licensePayload: res.payload,
        features: res.payload.features,
        statusDetail: res.verification?.message || '',
        status: 'ACTIVE',
        lastValidatedAt: new Date().toISOString()
      });
      setFeedback({ type: 'success', text: res.message });
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  // Export Offline Certificate (.lic) for USB Air-Gap Transfer
  const handleExportAirGapCert = () => {
    if (!settings.licensePayload || !settings.signature) {
      setFeedback({ type: 'error', text: 'No active device license to export.' });
      return;
    }
    // Export the exact signed payload so the certificate verifies offline
    CloudflareLicenseClient.exportOfflineCertificate(settings.licensePayload, settings.signature, settings.tenantName);
    setFeedback({ type: 'success', text: 'Offline certificate (.lic) exported for cleanroom USB installation.' });
  };

  // Deactivate Seat in Cloudflare D1
  const handleDeactivate = async () => {
    if (!settings.deviceId) {
      setFeedback({ type: 'error', text: 'This workstation has no active seat to release.' });
      return;
    }
    if (!confirm('Are you sure you want to release this seat? LOONIST will return to trial mode.')) return;

    const res = await CloudflareLicenseClient.revokeLicense(settings.apiUrl, settings.deviceId);
    if (!res.success) {
      setFeedback({ type: 'error', text: res.message });
      return;
    }

    applyLicense({
      status: 'UNLICENSED',
      expiresAt: null,
      licenseId: '',
      deviceId: '',
      signature: '',
      licensePayload: null,
      statusDetail: 'Seat released.'
    });

    setFeedback({ type: 'info', text: res.message });
  };

  return (
    <div className="flex flex-col gap-5 text-xs text-slate-800 dark:text-zinc-200">
      
      {/* 1. CLOUDFLARE LICENSE STATUS CARD */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-lg border border-slate-200 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                {settings.tenantName || 'Not activated'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Cloudflare D1 Ledger & Ed25519 Cryptographic Control Plane
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {settings.status === 'ACTIVE' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ACTIVE (Verified Offline)
              </span>
            ) : settings.status === 'OFFLINE_LEASE' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                <Clock className="w-3.5 h-3.5" />
                OFFLINE LEASE (Cleanroom)
              </span>
            ) : settings.status === 'EXPIRED' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <Clock className="w-3.5 h-3.5" />
                EXPIRED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                <AlertTriangle className="w-3.5 h-3.5" />
                UNLICENSED / TRIAL
              </span>
            )}
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-white dark:bg-zinc-950 rounded border border-slate-200 dark:border-zinc-800 text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Bound Hardware Device ID</span>
            <span className="font-mono font-medium text-slate-800 dark:text-zinc-200 select-all truncate block">
              {settings.deviceId || 'Unregistered Workstation'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Lease Expiration / Air-Gap Window</span>
            <span className={`font-medium block ${expiryCheck.isExpired ? 'text-red-600 font-bold' : 'text-slate-800 dark:text-zinc-200'}`}>
              {settings.expiresAt ? new Date(settings.expiresAt).toLocaleDateString() : 'N/A'} 
              {' '}({expiryCheck.message})
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Cloudflare Tenant ID</span>
            <span className="font-mono text-slate-700 dark:text-zinc-300 select-all">
              {settings.tenantId || '—'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Licensed Features</span>
            <span className="text-sky-600 dark:text-sky-400 font-mono text-[10px]">
              {settings.features.join(', ') || '—'}
            </span>
          </div>
        </div>

        {settings.statusDetail && (
          <p className={`mt-2 text-[11px] ${settings.status === 'ACTIVE' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
            {settings.statusDetail}
          </p>
        )}
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div className={`p-2.5 rounded border text-xs flex items-center gap-2 ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300'
            : feedback.type === 'error'
            ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300'
            : 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-300'
        }`}>
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 2. ACTIVATE NEW SEAT */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-lg border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="font-semibold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
            Activate Seat via Single-Use Token
          </h3>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-3">
          Exchange an enterprise single-use token generated by your quality director. The Cloudflare Worker will bind your device public key in D1.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Paste token: e.g. tok_sec_9f8b2c41-89e4-4d2a..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="flex-1 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded px-3 py-1.5 text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-sky-500 font-mono"
          />
          <button
            type="button"
            onClick={handleActivate}
            disabled={isActivating || !tokenInput.trim()}
            className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-medium px-4 py-1.5 rounded transition cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            {isActivating ? 'Verifying with Cloudflare...' : 'Activate Seat'}
          </button>
        </div>
      </div>

      {/* 3. AIR-GAPPED CLEANROOM / SCIF CONTROLS */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-lg border border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="font-semibold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
            Air-Gapped Cleanroom Transport & Seat Actions
          </h3>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-3">
          For classified manufacturing cells with no network access, export a cryptographically signed license file for USB installation.
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportAirGapCert}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded border border-slate-300 dark:border-zinc-700 font-medium transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Offline License (.lic)
          </button>

          <button
            type="button"
            onClick={handleRenew}
            disabled={isRenewing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded border border-slate-300 dark:border-zinc-700 font-medium transition cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRenewing ? 'animate-spin' : ''}`} />
            Refresh License
          </button>

          <button
            type="button"
            onClick={handleDeactivate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-700 dark:text-red-400 rounded border border-red-200 dark:border-red-900/60 font-medium transition cursor-pointer ml-auto"
          >
            <LogOut className="w-3.5 h-3.5" />
            Release Seat
          </button>
        </div>
      </div>

      {/* 4. EDGE API ENDPOINT CONFIGURATION */}
      <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-500 dark:text-zinc-400">
        <Server className="w-3.5 h-3.5 text-slate-400" />
        <span>Cloudflare Worker Edge URL:</span>
        <input
          type="text"
          value={settings.apiUrl}
          onChange={(e) => onChange({ apiUrl: e.target.value })}
          className="bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded px-2 py-0.5 text-[11px] text-slate-700 dark:text-zinc-300 font-mono flex-1 max-w-[320px]"
        />
        <span className="text-[10px] text-slate-400">(e.g. http://localhost:8787 for local testing)</span>
      </div>

    </div>
  );
};
