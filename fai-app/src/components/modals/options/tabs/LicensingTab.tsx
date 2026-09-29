import React, { useEffect, useState } from 'react';
import type { LicensingSettings } from '../../../../types/applicationOptions';
import { applicationOptionsActions } from '../../../../stores/useApplicationOptionsStore';
import { CloudflareLicenseClient } from '../../../../services/license/licenseClient';
import { 
  Clock, 
  Download, 
  RotateCw, 
  LogOut, 
  Server, 
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
    <div className="flex flex-col gap-5 text-xs text-slate-800">
      
      {/* 1. CLOUDFLARE LICENSE STATUS CARD */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex flex-row items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div>
              <h3 className="font-semibold text-sm text-slate-900">
                {settings.tenantName || 'Not activated'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Cloudflare D1 Ledger & Ed25519 Cryptographic Control Plane
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {settings.status === 'ACTIVE' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-700 border border-emerald-500/40">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ACTIVE (Verified Offline)
              </span>
            ) : settings.status === 'OFFLINE_LEASE' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-400">
                <Clock className="w-3.5 h-3.5" />
                OFFLINE LEASE (Cleanroom)
              </span>
            ) : settings.status === 'EXPIRED' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-500/50">
                <Clock className="w-3.5 h-3.5" />
                EXPIRED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-red-700 border border-red-500">
                <AlertTriangle className="w-3.5 h-3.5" />
                UNLICENSED / TRIAL
              </span>
            )}
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded border border-slate-200 text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Bound Hardware Device ID</span>
            <span className="font-mono font-medium text-slate-800 select-all truncate block">
              {settings.deviceId || 'Unregistered Workstation'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Lease Expiration / Air-Gap Window</span>
            <span className={`font-medium block ${expiryCheck.isExpired ? 'text-red-600 font-bold' : 'text-slate-800 '}`}>
              {settings.expiresAt ? new Date(settings.expiresAt).toLocaleDateString() : 'N/A'} 
              {' '}({expiryCheck.message})
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Cloudflare Tenant ID</span>
            <span className="font-mono text-slate-700 select-all">
              {settings.tenantId || '—'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Licensed Features</span>
            <span className="text-blue-600 font-mono text-[10px]">
              {settings.features.join(', ') || '—'}
            </span>
          </div>
        </div>

        {settings.statusDetail && (
          <p className={`mt-2 text-[11px] ${settings.status === 'ACTIVE' ? 'text-emerald-700 ' : 'text-amber-700 '}`}>
            {settings.statusDetail}
          </p>
        )}
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div className={`p-2.5 rounded border text-xs flex items-center gap-2 ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-500/40'
            : feedback.type === 'error'
            ? 'bg-red-50 text-red-800 border-red-500'
            : 'bg-blue-50 text-blue-700 border-blue-400'
        }`}>
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 2. ACTIVATE NEW SEAT */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
            Activate Seat via Single-Use Token
          </h3>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          Exchange an enterprise single-use token generated by your quality director. The Cloudflare Worker will bind your device public key in D1.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Paste token: e.g. tok_sec_9f8b2c41-89e4-4d2a..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="flex-1 bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-600 font-mono"
          />
          <button
            type="button"
            onClick={handleActivate}
            disabled={isActivating || !tokenInput.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-4 py-1.5 rounded transition cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            {isActivating ? 'Verifying with Cloudflare...' : 'Activate Seat'}
          </button>
        </div>
      </div>

      {/* 3. AIR-GAPPED CLEANROOM / SCIF CONTROLS */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
            Air-Gapped Cleanroom Transport & Seat Actions
          </h3>
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          For classified manufacturing cells with no network access, export a cryptographically signed license file for USB installation.
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportAirGapCert}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded border border-slate-300 font-medium transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Offline License (.lic)
          </button>

          <button
            type="button"
            onClick={handleRenew}
            disabled={isRenewing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded border border-slate-300 font-medium transition cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRenewing ? 'animate-spin' : ''}`} />
            Refresh License
          </button>

          <button
            type="button"
            onClick={handleDeactivate}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-200 text-red-500 rounded border border-red-500 font-medium transition cursor-pointer ml-auto"
          >
            <LogOut className="w-3.5 h-3.5" />
            Release Seat
          </button>
        </div>
      </div>

      {/* 4. EDGE API ENDPOINT CONFIGURATION */}
      <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-500">
        <Server className="w-3.5 h-3.5 text-slate-400" />
        <span>Cloudflare Worker Edge URL:</span>
        <input
          type="text"
          value={settings.apiUrl}
          onChange={(e) => onChange({ apiUrl: e.target.value })}
          className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] text-slate-700 font-mono flex-1 max-w-[320px]"
        />
        <span className="text-[10px] text-slate-400">(e.g. http://localhost:8787 for local testing)</span>
      </div>

    </div>
  );
};
