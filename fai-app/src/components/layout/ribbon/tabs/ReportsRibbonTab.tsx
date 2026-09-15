import React from 'react';
import { 
  FileSpreadsheet, 
  FileDown, 
  Save, 
  FolderOpen, 
  SlidersHorizontal, 
  ShieldCheck 
} from 'lucide-react';
import { RibbonGroup } from '../RibbonGroup';
import { RibbonButton } from '../RibbonButton';

interface ReportsRibbonTabProps {
  hasDrawing: boolean;
  characteristicsCount: number;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onSaveProject?: () => void;
  onOpenProject?: () => void;
  onToggleDrawer?: () => void;
}

export const ReportsRibbonTab: React.FC<ReportsRibbonTabProps> = ({
  hasDrawing,
  characteristicsCount,
  onExportExcel,
  onExportPdf,
  onSaveProject,
  onOpenProject,
  onToggleDrawer
}) => {
  return (
    <div className="flex items-center h-full overflow-x-auto select-none no-scrollbar">
      {/* 1. AS9102 DELIVERABLES */}
      <RibbonGroup title="AS9102 DELIVERABLES">
        <RibbonButton
          variant="large"
          accent="emerald"
          icon={<FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          label="AS9102 Excel"
          subLabel="Forms 1, 2, 3"
          disabled={characteristicsCount === 0}
          title="Export Certified SAE AS9102 Form 1, Form 2, and Form 3 Multi-Sheet Excel Workbook"
          onClick={onExportExcel}
        />

        <RibbonButton
          variant="large"
          accent="red"
          icon={<FileDown className="w-5 h-5 text-red-600 dark:text-red-400" />}
          label="Marked PDF"
          subLabel="Vector Stamped"
          disabled={!hasDrawing || characteristicsCount === 0}
          title="Export Marked Vector Blueprint PDF with permanent balloons and leader lines"
          onClick={onExportPdf}
        />
      </RibbonGroup>

      {/* 2. PROJECT ARCHIVE */}
      <RibbonGroup title="PROJECT ARCHIVE">
        <RibbonButton
          variant="large"
          accent="blue"
          icon={<Save className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          label="Save Package"
          subLabel=".loonist"
          disabled={!hasDrawing && characteristicsCount === 0}
          title="Archive complete self-contained inspection package (.loonist) [Ctrl+S]"
          onClick={onSaveProject}
        />

        <div className="flex flex-col justify-center">
          <RibbonButton
            variant="small"
            icon={<FolderOpen className="w-3.5 h-3.5 text-amber-500" />}
            label="Open Package"
            hotkey="Ctrl+O"
            title="Load existing LOONIST project package"
            onClick={onOpenProject}
          />
          {onToggleDrawer && (
            <RibbonButton
              variant="small"
              icon={<SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />}
              label="Preview Drawer"
              disabled={characteristicsCount === 0}
              title="Preview characteristics in review drawer before exporting"
              onClick={onToggleDrawer}
            />
          )}
        </div>
      </RibbonGroup>

      {/* 3. QUALITY SIGNOFF READINESS */}
      <RibbonGroup title="QUALITY SIGNOFF" noSeparator>
        <div className="flex flex-col justify-center px-2 py-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>SAE AS9102 Certified Exporters</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 max-w-[200px] leading-tight">
            Output files comply with Form 1 (Part), Form 2 (Materials), and Form 3 (Characteristics).
          </p>
        </div>
      </RibbonGroup>
    </div>
  );
};
