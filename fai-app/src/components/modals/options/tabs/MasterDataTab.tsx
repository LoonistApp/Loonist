import React, { useState } from 'react';
import type { 
  MasterDataSettings, 
  InspectionMethodItem, 
  ManufacturingOperationItem, 
  ClassificationItem,
  CustomFieldDefinition
} from '../../../../types/applicationOptions';
import { 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Wrench, 
  Factory, 
  Tag, 
  ListOrdered
} from 'lucide-react';

interface MasterDataTabProps {
  settings: MasterDataSettings;
  onChange: (patch: Partial<MasterDataSettings>) => void;
}

export const MasterDataTab: React.FC<MasterDataTabProps> = ({
  settings,
  onChange
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'methods' | 'operations' | 'classifications' | 'customFields'>('methods');

  // Input states for adding new items
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodCategory, setNewMethodCategory] = useState<InspectionMethodItem['category']>('Manual');

  const [newOpName, setNewOpName] = useState('');
  const [newOpDepartment, setNewOpDepartment] = useState('Machining');

  // --- INSPECTION METHODS HANDLERS ---
  const handleAddMethod = () => {
    if (!newMethodName.trim()) return;
    const item: InspectionMethodItem = {
      id: `m-${Date.now()}`,
      name: newMethodName.trim(),
      category: newMethodCategory
    };
    onChange({
      inspectionMethods: [...settings.inspectionMethods, item]
    });
    setNewMethodName('');
  };

  const handleDeleteMethod = (id: string) => {
    onChange({
      inspectionMethods: settings.inspectionMethods.filter((m: InspectionMethodItem) => m.id !== id)
    });
  };

  const handleMoveMethod = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= settings.inspectionMethods.length) return;

    const list = [...settings.inspectionMethods];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    onChange({ inspectionMethods: list });
  };

  // --- OPERATIONS HANDLERS ---
  const handleAddOperation = () => {
    if (!newOpName.trim()) return;
    const item: ManufacturingOperationItem = {
      id: `op-${Date.now()}`,
      name: newOpName.trim(),
      department: newOpDepartment.trim() || 'General'
    };
    onChange({
      manufacturingOperations: [...settings.manufacturingOperations, item]
    });
    setNewOpName('');
  };

  const handleDeleteOperation = (id: string) => {
    onChange({
      manufacturingOperations: settings.manufacturingOperations.filter((op: ManufacturingOperationItem) => op.id !== id)
    });
  };

  return (
    <div className="flex flex-col gap-4 text-xs text-slate-800">
      
      {/* Sub-Nav Pills */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSubTab('methods')}
          className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-md font-medium text-xs transition cursor-pointer ${
            activeSubTab === 'methods'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 '
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          Methods & Tools ({settings.inspectionMethods.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('operations')}
          className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-md font-medium text-xs transition cursor-pointer ${
            activeSubTab === 'operations'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 '
          }`}
        >
          <Factory className="w-3.5 h-3.5" />
          Operations ({settings.manufacturingOperations.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('classifications')}
          className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-md font-medium text-xs transition cursor-pointer ${
            activeSubTab === 'classifications'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 '
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          Classifications ({settings.classifications.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('customFields')}
          className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-md font-medium text-xs transition cursor-pointer ${
            activeSubTab === 'customFields'
              ? 'bg-white text-blue-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 '
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          Custom Fields ({settings.customFields.length})
        </button>
      </div>

      {/* --- TAB 1: INSPECTION METHODS --- */}
      {activeSubTab === 'methods' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-row gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <input
              type="text"
              placeholder="e.g., Zeiss Prismo CMM or Mitutoyo 12in Caliper"
              value={newMethodName}
              onChange={(e) => setNewMethodName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMethod()}
              className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-600"
            />
            <select
              value={newMethodCategory}
              onChange={(e) => setNewMethodCategory(e.target.value as any)}
              className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-600"
            >
              <option value="Manual">Manual Tool</option>
              <option value="CMM / Automated">CMM / Automated</option>
              <option value="Optical">Optical / Laser</option>
              <option value="Gages">Gages / Pins</option>
              <option value="Other">Other</option>
            </select>
            <button
              type="button"
              onClick={handleAddMethod}
              disabled={!newMethodName.trim()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-1.5 rounded font-medium transition cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Add Tool
            </button>
          </div>

          <div className="border border-slate-200 rounded bg-white overflow-hidden max-h-[360px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-1.5 px-3 w-10 text-center font-semibold text-[11px] text-slate-600">#</th>
                  <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600">Tool / Method Name</th>
                  <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600">Category</th>
                  <th className="py-1.5 px-3 w-28 text-center font-semibold text-[11px] text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settings.inspectionMethods.map((m: InspectionMethodItem, idx: number) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition">
                    <td className="py-1.5 px-3 text-center font-mono text-[10px] text-slate-400">{idx + 1}</td>
                    <td className="py-1.5 px-3 font-medium text-slate-900">
                      {m.name}
                      {m.isDefault && (
                        <span className="ml-2 text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded">
                          Standard
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                        {m.category}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveMethod(idx, 'up')}
                          className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === settings.inspectionMethods.length - 1}
                          onClick={() => handleMoveMethod(idx, 'down')}
                          className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMethod(m.id)}
                          className="p-1 rounded hover:bg-slate-200 text-red-600 ml-1"
                          title="Delete tool"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 2: MANUFACTURING OPERATIONS --- */}
      {activeSubTab === 'operations' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-row gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <input
              type="text"
              placeholder="e.g., CNC 5-Axis Milling or Anodize Type II"
              value={newOpName}
              onChange={(e) => setNewOpName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddOperation()}
              className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-600"
            />
            <input
              type="text"
              placeholder="Department (e.g., Machining)"
              value={newOpDepartment}
              onChange={(e) => setNewOpDepartment(e.target.value)}
              className="w-40 bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-600"
            />
            <button
              type="button"
              onClick={handleAddOperation}
              disabled={!newOpName.trim()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-1.5 rounded font-medium transition cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Add Operation
            </button>
          </div>

          <div className="border border-slate-200 rounded bg-white overflow-hidden max-h-[360px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-1.5 px-3 w-10 text-center font-semibold text-[11px] text-slate-600">#</th>
                  <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600">Operation Name</th>
                  <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600">Department</th>
                  <th className="py-1.5 px-3 w-16 text-center font-semibold text-[11px] text-slate-600">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settings.manufacturingOperations.map((op: ManufacturingOperationItem, idx: number) => (
                  <tr key={op.id} className="hover:bg-slate-50 transition">
                    <td className="py-1.5 px-3 text-center font-mono text-[10px] text-slate-400">{idx + 1}</td>
                    <td className="py-1.5 px-3 font-medium text-slate-900">{op.name}</td>
                    <td className="py-1.5 px-3 text-slate-600">{op.department}</td>
                    <td className="py-1.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteOperation(op.id)}
                        className="p-1 rounded hover:bg-slate-200 text-red-600"
                        title="Delete operation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 3: CLASSIFICATIONS --- */}
      {activeSubTab === 'classifications' && (
        <div className="border border-slate-200 rounded bg-white overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600">Classification Level</th>
                <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600">Display Label</th>
                <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600">Badge Color</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settings.classifications.map((cls: ClassificationItem) => (
                <tr key={cls.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono uppercase text-[10px] text-slate-500 font-semibold">{cls.level}</td>
                  <td className="py-2 px-3 font-medium text-slate-900">{cls.name}</td>
                  <td className="py-2 px-3 flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border border-slate-200" style={{ backgroundColor: cls.color }} />
                    <span className="font-mono text-[10px] text-slate-500">{cls.color}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- TAB 4: CUSTOM FIELDS --- */}
      {activeSubTab === 'customFields' && (
        <div className="border border-slate-200 rounded bg-white overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="py-1.5 px-3 w-16 font-semibold text-[11px] text-slate-600">Slot</th>
                <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600">Field Key</th>
                <th className="py-1.5 px-3 font-semibold text-[11px] text-slate-600">Human-Readable Label</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settings.customFields.map((cf: CustomFieldDefinition) => (
                <tr key={cf.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono text-[10px] text-blue-600 font-semibold">
                    Slot {cf.netInspectSlot}
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-600">{cf.key}</td>
                  <td className="py-2 px-3 font-medium text-slate-900">{cf.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
