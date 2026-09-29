import React, { useEffect, useState } from 'react';
import type { LicensingSettings } from '../../../../types/applicationOptions';
import { applicationOptionsActions } from '../../../../stores/useApplicationOptionsStore';
import { CloudflareLicenseClient } from '../../../../services/license/licenseClient';
import { 
  Clock, 
  Download, 
  RotateCw, 
  LogOut, 
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

  const isActive = settings.status === 'ACTIVE';
  const hasSeat = Boolean(settings.deviceId);
  const expiryText = settings.expiresAt
    ? `${new Date(settings.expiresAt).toLocaleDateString()} (${expiryCheck.isExpired ? 'expired' : `${expiryCheck.daysRemaining} days left`})`
    : null;

  return (
    <div className="flex flex-col gap-5 text-xs text-slate-800">

      {/* 1. LICENSE STATUS */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-slate-900">
              {isActive ? 'Licensed' : settings.status === 'EXPIRED' ? 'License expired' : 'Not activated'}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {isActive || settings.status === 'EXPIRED'
                ? [settings.tenantName && settings.tenantName !== settings.tenantId && `Licensed to ${settings.tenantName}`, expiryText && `Valid until ${expiryText}`].filter(Boolean).join(' · ')
                : 'Activate this workstation with the license key from your administrator.'}
            </p>
          </div>

          {isActive ? (
            <span className="shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-500/40 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Active
            </span>
          ) : settings.status === 'EXPIRED' ? (
            <span className="shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-500/50 text-amber-600">
              <Clock className="w-3.5 h-3.5" />
              Expired
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold border border-red-500 text-red-500">
              <AlertTriangle className="w-3.5 h-3.5" />
              Unlicensed
            </span>
          )}
        </div>

        {settings.statusDetail && !isActive && hasSeat && (
          <p className="mt-2 text-[11px] text-amber-600">{settings.statusDetail}</p>
        )}
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div className={`px-3 py-2 rounded border text-[11px] ${
          feedback.type === 'success'
            ? 'border-emerald-500/40 text-emerald-600'
            : feedback.type === 'error'
            ? 'border-red-500 text-red-500'
            : 'border-blue-400 text-blue-600'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* 2. ACTIVATE (only while not licensed) */}
      {!isActive && (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider mb-3">
            Activate
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter license key"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="flex-1 min-w-0 bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-600 font-mono"
            />
            <button
              type="button"
              onClick={handleActivate}
              disabled={isActivating || !tokenInput.trim()}
              className="shrink-0 whitespace-nowrap bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-4 py-1.5 rounded transition cursor-pointer"
            >
              {isActivating ? 'Activating…' : 'Activate'}
            </button>
          </div>
        </div>
      )}

      {/* 3. MANAGE LICENSE (only once a license exists) */}
      {hasSeat && (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider mb-1">
            Manage License
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            For computers without internet access, export an offline license file and copy it over by USB.
          </p>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleRenew}
              disabled={isRenewing}
              className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded border border-slate-300 font-medium transition cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              {isRenewing ? 'Refreshing…' : 'Refresh License'}
            </button>

            <button
              type="button"
              onClick={handleExportAirGapCert}
              className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded border border-slate-300 font-medium transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Offline License
            </button>

            <button
              type="button"
              onClick={handleDeactivate}
              className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 hover:bg-slate-200 text-red-500 rounded border border-red-500 font-medium transition cursor-pointer ml-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              Release Seat
            </button>
          </div>
        </div>
      )}

      {/* Licensing server address: development builds only */}
      {import.meta.env.DEV && (
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="whitespace-nowrap">Licensing server (dev only):</span>
          <input
            type="text"
            value={settings.apiUrl}
            onChange={(e) => onChange({ apiUrl: e.target.value })}
            className="bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] text-slate-700 font-mono flex-1 max-w-[320px]"
          />
        </div>
      )}

    </div>
  );
};
