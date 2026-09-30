import React, { useMemo } from 'react';
import { 
  FileCheck, 
  Search, 
  ShieldCheck, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock 
} from 'lucide-react';
import { RibbonGroup } from '../RibbonGroup';
import { RibbonButton } from '../RibbonButton';
import { MeasurementEngine } from '../../../../services/compliance/measurementEngine';
import { AuditLedgerService } from '../../../../services/compliance/auditLedgerService';
import type { EngineeringCharacteristic } from '../../../../types/characteristics';

interface InspectionRibbonTabProps {
  characteristics: EngineeringCharacteristic[];
  isDrawerOpen?: boolean;
  onToggleDrawer?: () => void;
  onSelectFormTab?: (form: 'form1' | 'form2' | 'form3') => void;
  onSetTableFilter?: (filter: 'all' | 'critical' | 'review') => void;
}

export const InspectionRibbonTab: React.FC<InspectionRibbonTabProps> = ({
  characteristics,
  isDrawerOpen = false,
  onToggleDrawer,
  onSelectFormTab,
  onSetTableFilter
}) => {
  const stats = useMemo(() => {
    return MeasurementEngine.computeLotStatistics(characteristics);
  }, [characteristics]);

  const auditStatus = useMemo(() => {
    void characteristics;
    return AuditLedgerService.verifyIntegrity();
  }, [characteristics]);

  return (
    <div className="flex items-center h-full overflow-x-auto select-none no-scrollbar">
      {/* 1. AS9102 FORMS */}
      <RibbonGroup title="AS9102 FORMS">
        <RibbonButton
          variant="large"
          icon={<FileCheck className="w-5 h-5 text-slate-700" />}
          label="Form 1"
          subLabel="Part Header"
          title="Switch to AS9102 Form 1 (Part Number Accountability)"
          onClick={() => onSelectFormTab?.('form1')}
        />

        <div className="flex flex-col gap-0.5 justify-center">
          <RibbonButton
            variant="small"
            icon={<Layers className="w-3.5 h-3.5 text-slate-600" />}
            label="Form 2: Materials & BOM"
            title="Switch to AS9102 Form 2 (Product Process Accountability)"
            onClick={() => onSelectFormTab?.('form2')}
          />
          <RibbonButton
            variant="small"
            icon={<FileCheck className="w-3.5 h-3.5 text-slate-700" />}
            label="Form 3: Characteristics"
            title="Switch to AS9102 Form 3 (Characteristic Accountability & Verification)"
            onClick={() => onSelectFormTab?.('form3')}
          />
        </div>
      </RibbonGroup>

      {/* 2. INSPECTION REVIEW */}
      <RibbonGroup title="REVIEW & FILTER">
        {onToggleDrawer && (
          <RibbonButton
            variant="large"
            icon={<Search className="w-5 h-5 text-slate-700" />}
            label="Inspections"
            active={isDrawerOpen}
            disabled={characteristics.length === 0}
            title="Open Inspections Results Workspace"
            onClick={onToggleDrawer}
          />
        )}

        <div className="flex flex-col gap-0.5 justify-center">
          <RibbonButton
            variant="small"
            icon={<CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />}
            label="All Features"
            onClick={() => onSetTableFilter?.('all')}
          />
          <RibbonButton
            variant="small"
            icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
            label="Critical GD&T"
            onClick={() => onSetTableFilter?.('critical')}
          />
        </div>
      </RibbonGroup>

      {/* 3. PHYSICAL CONFORMANCE METRICS */}
      <RibbonGroup title="LOT CONFORMANCE">
        <div className="flex flex-col justify-center px-2 py-0.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-slate-500 font-semibold uppercase">Conformance:</span>
            <span className={`text-xs font-mono font-bold ${
              stats.failCount > 0
                ? 'text-red-600'
                : stats.conformanceRatePercent === 100 && stats.measuredCount > 0
                ? 'text-emerald-600'
                : 'text-slate-700'
            }`}>
              {stats.conformanceRatePercent}%
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="flex items-center gap-0.5 text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>{stats.passCount} Pass</span>
            </span>
            <span className="flex items-center gap-0.5 text-amber-600 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>{stats.marginalCount} Marg</span>
            </span>
            <span className="flex items-center gap-0.5 text-red-600 bg-red-50 px-1 py-0.2 rounded border border-red-200">
              <XCircle className="w-2.5 h-2.5" />
              <span>{stats.failCount} Fail</span>
            </span>
            <span className="flex items-center gap-0.5 text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
              <Clock className="w-2.5 h-2.5" />
              <span>{stats.unmeasuredCount} Unm</span>
            </span>
          </div>
        </div>
      </RibbonGroup>

      {/* 4. AUDIT INTEGRITY */}
      <RibbonGroup title="SECURITY AUDIT" noSeparator>
        <div className="flex flex-col justify-center px-1">
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold text-[10px] leading-tight">
                {auditStatus.isValid ? 'Audit Chain Valid' : 'Audit Anomaly'}
              </div>
              <div className="text-[9px] text-emerald-700 font-mono">
                SHA-256 Chained
              </div>
            </div>
          </div>
        </div>
      </RibbonGroup>
    </div>
  );
};
