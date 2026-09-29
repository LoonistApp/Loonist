import React, { useState } from 'react';
import type { LicensingSettings } from '../../../../types/applicationOptions';
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

  // Handle Cloudflare Token Activation
  const handleActivate = async () => {
    if (!tokenInput.trim()) {
      setFeedback({ type: 'error', text: 'Please enter a valid single-use license token.' });
      return;
    }

    setIsActivating(true);
    setFeedback({ type: 'info', text: 'Connecting to Cloudflare edge licensing worker...' });

    let pubKey = settings.devicePublicKey;
    let privKey = settings.devicePrivateKeyHex;
    if (!pubKey) {
      const generated = CloudflareLicenseClient.generateDeviceKeyPair();
      pubKey = generated.publicKeyHex;
      privKey = generated.privateKeyHex;
    }

    const res = await CloudflareLicenseClient.activateToken(
      settings.apiUrl,
      tokenInput,
      pubKey
    );

    setIsActivating(false);

    if (res.success && res.payload) {
      onChange({
        status: res.status,
        tokenInput: '',
        tenantId: res.payload.tenantId,
        tenantName: res.tenantName || 'Defense Aerospace Contractor',
        deviceId: res.payload.deviceId,
        licenseId: res.payload.licenseId,
        expiresAt: res.payload.expiresAt,
        features: res.payload.features,
        signature: res.signature || '',
        devicePublicKey: pubKey,
        devicePrivateKeyHex: privKey,
        lastValidatedAt: new Date().toISOString()
      });
      setFeedback({ type: 'success', text: res.message });
      setTokenInput('');
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  // Handle Cloudflare 30-Day Lease Extension
  const handleRenew = async () => {
    setIsRenewing(true);
    setFeedback({ type: 'info', text: 'Requesting lease extension from Cloudflare D1...' });

    const res = await CloudflareLicenseClient.renewLicense(
      settings.apiUrl,
      settings.deviceId
    );

    setIsRenewing(false);

    if (res.success) {
      const newExpiry = res.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      onChange({
        expiresAt: newExpiry,
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
    if (!settings.deviceId) {
      setFeedback({ type: 'error', text: 'No active device license to export.' });
      return;
    }
    const payload = {
      licenseId: settings.licenseId,
      deviceId: settings.deviceId,
      tenantId: settings.tenantId,
      expiresAt: settings.expiresAt || new Date().toISOString(),
      features: settings.features
    };
    CloudflareLicenseClient.exportOfflineCertificate(payload, settings.signature, settings.tenantName);
    setFeedback({ type: 'success', text: 'Offline certificate (.lic) exported for cleanroom USB installation.' });
  };

  // Deactivate Seat in Cloudflare D1
  const handleDeactivate = async () => {
    if (!confirm('Are you sure you want to release this seat? LOONIST will return to trial mode.')) return;

    await CloudflareLicenseClient.revokeLicense(settings.apiUrl, settings.deviceId);

    onChange({
      status: 'UNLICENSED',
      expiresAt: null,
      licenseId: '',
      signature: ''
    });

    setFeedback({ type: 'info', text: 'Seat has been released back to the tenant pool.' });
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
                {settings.tenantName || 'Enterprise Defense Aerospace'}
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
                ACTIVE (Ed25519 Verified)
              </span>
            ) : settings.status === 'OFFLINE_LEASE' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                <Clock className="w-3.5 h-3.5" />
                OFFLINE LEASE (Cleanroom)
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
              {settings.tenantId || 'tenant_default'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Licensed Features</span>
            <span className="text-sky-600 dark:text-sky-400 font-mono text-[10px]">
              {settings.features.join(', ') || 'CORE_ENGINE'}
            </span>
          </div>
        </div>
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
            Renew 30-Day Lease
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
