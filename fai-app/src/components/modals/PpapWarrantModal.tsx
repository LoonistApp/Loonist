import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardCheck, X, AlertTriangle } from 'lucide-react';
import type { ProjectProperties } from '../../types/characteristics';
import {
  type PpapSubmissionLevel,
  type PpapSubmissionReason,
  type PpapElementStatus,
  type PpapWarrantData,
  PPAP_ELEMENTS,
  PPAP_SUBMISSION_LEVELS,
  PPAP_SUBMISSION_LEVEL_LABELS,
  PPAP_SUBMISSION_REASONS,
  createDefaultPpapWarrant,
  defaultElementStatusesForLevel
} from '../../types/ppap';
import { getPersistentSetting, setPersistentSetting } from '../../utils/persistentSettings';

const ORG_DEFAULTS_KEY = 'loonist_ppap_org_defaults';

interface OrgDefaults {
  organizationName: string;
  organizationAddress: string;
  authorizedSignatureName: string;
  authorizedSignatureTitle: string;
  authorizedSignaturePhone: string;
  authorizedSignatureEmail: string;
}

interface PpapWarrantModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectProps: ProjectProperties;
  characteristicsCount: number;
  onExport: (warrant: PpapWarrantData) => void;
}

const fieldLabel = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1';
const inputClass =
  'w-full h-8 bg-white border border-slate-300 hover:border-slate-400 focus:border-slate-800 rounded px-2 text-xs text-slate-900 outline-none transition';
const sectionTitle = 'text-[11px] font-bold text-slate-700 tracking-wider uppercase';

export const PpapWarrantModal: React.FC<PpapWarrantModalProps> = ({
  isOpen,
  onClose,
  projectProps,
  characteristicsCount,
  onExport
}) => {
  const [warrant, setWarrant] = useState<PpapWarrantData>(createDefaultPpapWarrant());
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      let cancelled = false;
      (async () => {
        const raw = await getPersistentSetting(ORG_DEFAULTS_KEY);
        const base = createDefaultPpapWarrant();
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<OrgDefaults>;
            Object.assign(base, parsed);
          } catch {
            // ignore malformed persisted defaults
          }
        }
        if (!cancelled) setWarrant(base);
      })();
      return () => {
        cancelled = true;
      };
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const update = <K extends keyof PpapWarrantData>(field: K, value: PpapWarrantData[K]) => {
    setWarrant((prev) => ({ ...prev, [field]: value }));
  };

  const toggleReason = (reason: PpapSubmissionReason) => {
    setWarrant((prev) => {
      const has = prev.reasonsForSubmission.includes(reason);
      const next = has
        ? prev.reasonsForSubmission.filter((r) => r !== reason)
        : [...prev.reasonsForSubmission, reason];
      return { ...prev, reasonsForSubmission: next.length > 0 ? next : prev.reasonsForSubmission };
    });
  };

  const setLevel = (level: PpapSubmissionLevel) => {
    setWarrant((prev) => ({ ...prev, submissionLevel: level, elementStatuses: defaultElementStatusesForLevel(level) }));
  };

  const setElementStatus = (elementNumber: number, status: PpapElementStatus) => {
    setWarrant((prev) => ({ ...prev, elementStatuses: { ...prev.elementStatuses, [elementNumber]: status } }));
  };

  const handleExport = () => {
    const orgDefaults: OrgDefaults = {
      organizationName: warrant.organizationName,
      organizationAddress: warrant.organizationAddress,
      authorizedSignatureName: warrant.authorizedSignatureName,
      authorizedSignatureTitle: warrant.authorizedSignatureTitle,
      authorizedSignaturePhone: warrant.authorizedSignaturePhone,
      authorizedSignatureEmail: warrant.authorizedSignatureEmail
    };
    setPersistentSetting(ORG_DEFAULTS_KEY, JSON.stringify(orgDefaults));
    onExport(warrant);
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white border border-slate-300 shadow-2xl flex flex-col overflow-hidden text-slate-800 rounded-lg"
        style={{ width: '760px', maxWidth: '95vw', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="h-10 bg-slate-100 text-slate-800 px-4 flex items-center justify-between border-b border-slate-200 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-slate-700" />
            <h2 className="text-xs font-bold text-slate-900 tracking-wider uppercase">
              AIAG PPAP Package: Part Submission Warrant
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition cursor-pointer"
            title="Close [ESC]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 flex flex-col gap-5 bg-white overflow-y-auto">
          <div className="border border-slate-200 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <span className="font-semibold text-slate-900">{projectProps.partName || 'Unnamed Part'}</span>
            {' · '}P/N {projectProps.partNumber || '--'} Rev {projectProps.partRevision || '--'}
            {' · '}DWG {projectProps.drawingNumber || '--'} Rev {projectProps.drawingRevision || '--'}
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Part identification above is pulled from this project's Drawing Specification. Dimensional Results and
            the Dimensional Measurements result below are computed automatically from your {characteristicsCount} verified
            characteristic{characteristicsCount === 1 ? '' : 's'}.
          </p>

          <div className="border border-amber-300 bg-amber-50 rounded-lg px-3 py-2.5 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900 leading-relaxed">
              <span className="font-semibold">This package only contains Element 9 (Dimensional Results) and Element 18 (PSW)</span>,
              the two elements LOONIST can generate from your inspection data. The 16 elements below (Design Records, FMEA, Process
              Flow, Control Plan, MSA, Material Certs, etc.) are not created by LOONIST. Marking one "Submitted" below only records
              that you're including it. You must still attach that actual document yourself before this is a complete package for
              the customer.
            </p>
          </div>

          {/* ORGANIZATION & CUSTOMER */}
          <div className="flex flex-col gap-2">
            <span className={sectionTitle}>Organization &amp; Customer</span>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={fieldLabel}>Organization Name</label>
                <input className={inputClass} value={warrant.organizationName} onChange={(e) => update('organizationName', e.target.value)} placeholder="Your company name" />
              </div>
              <div>
                <label className={fieldLabel}>Organization Address</label>
                <input className={inputClass} value={warrant.organizationAddress} onChange={(e) => update('organizationAddress', e.target.value)} placeholder="Manufacturing site address" />
              </div>
              <div>
                <label className={fieldLabel}>Customer Name / Division</label>
                <input className={inputClass} value={warrant.customerName} onChange={(e) => update('customerName', e.target.value)} placeholder="e.g. Acme Corp" />
              </div>
              <div>
                <label className={fieldLabel}>Buyer Name / Code</label>
                <input className={inputClass} value={warrant.buyerName} onChange={(e) => update('buyerName', e.target.value)} placeholder="Buyer or purchasing contact" />
              </div>
              <div className="col-span-2">
                <label className={fieldLabel}>Application</label>
                <input className={inputClass} value={warrant.application} onChange={(e) => update('application', e.target.value)} placeholder="Where/how the part is used" />
              </div>
            </div>
          </div>

          {/* PART DETAILS */}
          <div className="flex flex-col gap-2">
            <span className={sectionTitle}>Part Details</span>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className={fieldLabel}>Part Weight (kg)</label>
                <input className={inputClass} value={warrant.partWeightKg} onChange={(e) => update('partWeightKg', e.target.value)} placeholder="0.0000" />
              </div>
              <div>
                <label className={fieldLabel}>Purchase Order Number</label>
                <input className={inputClass} value={warrant.purchaseOrderNumber} onChange={(e) => update('purchaseOrderNumber', e.target.value)} />
              </div>
              <div>
                <label className={fieldLabel}>Safety / Gov't Regulated Part</label>
                <select className={inputClass} value={warrant.safetyOrGovernmentRegulated ? 'yes' : 'no'} onChange={(e) => update('safetyOrGovernmentRegulated', e.target.value === 'yes')}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div>
                <label className={fieldLabel}>Checking Aid Number</label>
                <input className={inputClass} value={warrant.checkingAidNumber} onChange={(e) => update('checkingAidNumber', e.target.value)} placeholder="If applicable" />
              </div>
              <div>
                <label className={fieldLabel}>Checking Aid Change Level</label>
                <input className={inputClass} value={warrant.checkingAidEngineeringLevel} onChange={(e) => update('checkingAidEngineeringLevel', e.target.value)} />
              </div>
              <div>
                <label className={fieldLabel}>Checking Aid Date</label>
                <input className={inputClass} value={warrant.checkingAidDate} onChange={(e) => update('checkingAidDate', e.target.value)} placeholder="MM/DD/YYYY" />
              </div>
            </div>
          </div>

          {/* REASON FOR SUBMISSION */}
          <div className="flex flex-col gap-2">
            <span className={sectionTitle}>Reason for Submission</span>
            <div className="grid grid-cols-2 gap-1.5">
              {PPAP_SUBMISSION_REASONS.map((reason) => (
                <label key={reason} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={warrant.reasonsForSubmission.includes(reason)}
                    onChange={() => toggleReason(reason)}
                    className="cursor-pointer"
                  />
                  {reason}
                </label>
              ))}
            </div>
            {warrant.reasonsForSubmission.includes('Other') && (
              <input
                className={inputClass}
                value={warrant.otherReasonExplanation}
                onChange={(e) => update('otherReasonExplanation', e.target.value)}
                placeholder="Explain the other reason for submission"
              />
            )}
          </div>

          {/* SUBMISSION LEVEL */}
          <div className="flex flex-col gap-2">
            <span className={sectionTitle}>Requested Submission Level</span>
            <div className="flex flex-col gap-1.5">
              {PPAP_SUBMISSION_LEVELS.map((level) => (
                <label key={level} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="ppap-submission-level"
                    checked={warrant.submissionLevel === level}
                    onChange={() => setLevel(level)}
                    className="mt-0.5 cursor-pointer"
                  />
                  <span>{PPAP_SUBMISSION_LEVEL_LABELS[level]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* SUBMISSION RESULTS */}
          <div className="flex flex-col gap-2">
            <span className={sectionTitle}>Submission Results</span>
            <div className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 bg-slate-50">
              Dimensional Measurements: computed automatically from verified characteristic data at export time.
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={warrant.materialFunctionalApplicable} onChange={(e) => update('materialFunctionalApplicable', e.target.checked)} className="cursor-pointer" />
                <span className="text-xs text-slate-700">Material / Functional Tests apply</span>
              </div>
              {warrant.materialFunctionalApplicable && (
                <select className={inputClass} value={warrant.materialFunctionalMeetsRequirements ? 'yes' : 'no'} onChange={(e) => update('materialFunctionalMeetsRequirements', e.target.value === 'yes')}>
                  <option value="yes">Meets Requirements</option>
                  <option value="no">Does Not Meet Requirements</option>
                </select>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={warrant.appearanceApplicable} onChange={(e) => update('appearanceApplicable', e.target.checked)} className="cursor-pointer" />
                <span className="text-xs text-slate-700">Appearance Criteria apply</span>
              </div>
              {warrant.appearanceApplicable && (
                <select className={inputClass} value={warrant.appearanceMeetsRequirements ? 'yes' : 'no'} onChange={(e) => update('appearanceMeetsRequirements', e.target.value === 'yes')}>
                  <option value="yes">Meets Requirements</option>
                  <option value="no">Does Not Meet Requirements</option>
                </select>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={warrant.statisticalPackageApplicable} onChange={(e) => update('statisticalPackageApplicable', e.target.checked)} className="cursor-pointer" />
                <span className="text-xs text-slate-700">Statistical Process Package applies</span>
              </div>
              {warrant.statisticalPackageApplicable && (
                <select className={inputClass} value={warrant.statisticalPackageMeetsRequirements ? 'yes' : 'no'} onChange={(e) => update('statisticalPackageMeetsRequirements', e.target.value === 'yes')}>
                  <option value="yes">Meets Requirements</option>
                  <option value="no">Does Not Meet Requirements</option>
                </select>
              )}
            </div>
            <div>
              <label className={fieldLabel}>Mold / Cavity / Production Process</label>
              <input className={inputClass} value={warrant.moldCavityProductionProcess} onChange={(e) => update('moldCavityProductionProcess', e.target.value)} />
            </div>
          </div>

          {/* DECLARATION */}
          <div className="flex flex-col gap-2">
            <span className={sectionTitle}>Declaration</span>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={fieldLabel}>Production Rate (Qty)</label>
                <input className={inputClass} value={warrant.productionRateQty} onChange={(e) => update('productionRateQty', e.target.value)} placeholder="pcs" />
              </div>
              <div>
                <label className={fieldLabel}>Production Rate (Hours)</label>
                <input className={inputClass} value={warrant.productionRateHours} onChange={(e) => update('productionRateHours', e.target.value)} placeholder="hrs" />
              </div>
              <div className="col-span-2">
                <label className={fieldLabel}>Explanation / Comments</label>
                <textarea
                  className="w-full h-16 bg-white border border-slate-300 hover:border-slate-400 focus:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-900 outline-none transition resize-none"
                  value={warrant.explanationComments}
                  onChange={(e) => update('explanationComments', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* DISPOSITION & SIGNATURE */}
          <div className="flex flex-col gap-2">
            <span className={sectionTitle}>Disposition &amp; Authorized Signature</span>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={fieldLabel}>Part Warrant Disposition</label>
                <select className={inputClass} value={warrant.warrantDisposition} onChange={(e) => update('warrantDisposition', e.target.value as PpapWarrantData['warrantDisposition'])}>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {warrant.warrantDisposition === 'Other' && (
                <div>
                  <label className={fieldLabel}>Disposition Explanation</label>
                  <input className={inputClass} value={warrant.dispositionExplanation} onChange={(e) => update('dispositionExplanation', e.target.value)} />
                </div>
              )}
              <div>
                <label className={fieldLabel}>Authorized Signature (Name)</label>
                <input className={inputClass} value={warrant.authorizedSignatureName} onChange={(e) => update('authorizedSignatureName', e.target.value)} />
              </div>
              <div>
                <label className={fieldLabel}>Title</label>
                <input className={inputClass} value={warrant.authorizedSignatureTitle} onChange={(e) => update('authorizedSignatureTitle', e.target.value)} />
              </div>
              <div>
                <label className={fieldLabel}>Phone</label>
                <input className={inputClass} value={warrant.authorizedSignaturePhone} onChange={(e) => update('authorizedSignaturePhone', e.target.value)} />
              </div>
              <div>
                <label className={fieldLabel}>Email</label>
                <input className={inputClass} value={warrant.authorizedSignatureEmail} onChange={(e) => update('authorizedSignatureEmail', e.target.value)} />
              </div>
              <div>
                <label className={fieldLabel}>Date</label>
                <input className={inputClass} value={warrant.authorizedSignatureDate} onChange={(e) => update('authorizedSignatureDate', e.target.value)} />
              </div>
            </div>
          </div>

          {/* PPAP ELEMENT SUBMISSION STATUS */}
          <div className="flex flex-col gap-2">
            <span className={sectionTitle}>PPAP Element Submission Status (18 Elements)</span>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="text-left px-2 py-1.5 w-8">#</th>
                    <th className="text-left px-2 py-1.5">Element</th>
                    <th className="text-left px-2 py-1.5 w-36">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {PPAP_ELEMENTS.map((el) => (
                    <tr key={el.number} className="border-t border-slate-100">
                      <td className="px-2 py-1 text-slate-500">{el.number}</td>
                      <td className="px-2 py-1 text-slate-800">{el.name}</td>
                      <td className="px-2 py-1">
                        <select
                          className="w-full h-7 bg-white border border-slate-300 rounded px-1.5 text-[11px] outline-none cursor-pointer"
                          value={warrant.elementStatuses[el.number] || 'Retained'}
                          onChange={(e) => setElementStatus(el.number, e.target.value as PpapElementStatus)}
                        >
                          <option value="Submitted">Submitted</option>
                          <option value="Retained">Retained</option>
                          <option value="Not Applicable">Not Applicable</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FOOTER */}
          <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 inline-flex items-center justify-center text-xs font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={characteristicsCount === 0}
              className={`h-8 px-5 inline-flex items-center justify-center text-xs font-semibold tracking-wide rounded-md transition ${
                characteristicsCount === 0
                  ? 'bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed opacity-60 shadow-none'
                  : 'bg-slate-800 hover:bg-slate-900 border border-slate-700 text-white cursor-pointer shadow-2xs'
              }`}
            >
              Export PPAP Package (.xlsx)
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, window.document.body);
};
