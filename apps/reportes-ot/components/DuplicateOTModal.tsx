import React, { useState, useEffect } from 'react';
import { FirebaseService } from '../services/firebaseService';
import { findNextAvailableOT } from '../services/utils';

export interface DuplicateOptions {
  copyClientEquipment: boolean;
  copyBudgets: boolean;
  copyObservations: boolean;
  copyReportTecnico: boolean;
  newOtSuffix: string;
}

interface DuplicateOTModalProps {
  isOpen: boolean;
  onClose: () => void;
  otNumber: string;
  incrementSuffix: (ot: string) => string;
  firebase: FirebaseService;
  onDuplicate: (options: DuplicateOptions) => void;
}

export const DuplicateOTModal: React.FC<DuplicateOTModalProps> = ({ isOpen, onClose, otNumber, incrementSuffix, firebase, onDuplicate }) => {
  const [copyClientEquipment, setCopyClientEquipment] = useState(true);
  const [copyBudgets, setCopyBudgets] = useState(true);
  const [copyObservations, setCopyObservations] = useState(false);
  const [copyReportTecnico, setCopyReportTecnico] = useState(false);
  const [newOtSuffix, setNewOtSuffix] = useState('');
  const [isFindingOT, setIsFindingOT] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Buscar la siguiente OT disponible (que no exista o que esté en BORRADOR)
      setIsFindingOT(true);
      findNextAvailableOT(otNumber, firebase)
        .then((availableOT) => {
          setNewOtSuffix(availableOT);
          setIsFindingOT(false);
        })
        .catch((error) => {
          console.error("Error buscando OT disponible:", error);
          // Fallback a incrementSuffix si hay error
          setNewOtSuffix(incrementSuffix(otNumber));
          setIsFindingOT(false);
        });
    }
  }, [isOpen, otNumber, incrementSuffix, firebase]);

  const handleDuplicate = () => {
    onDuplicate({
      copyClientEquipment,
      copyBudgets,
      copyObservations,
      copyReportTecnico,
      newOtSuffix: newOtSuffix || incrementSuffix(otNumber)
    });
  };

  return (
    <div
      className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print transition-all duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
      onClick={onClose}
    >
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-4">Duplicar OT</h3>
        <p className="text-xs text-slate-600 mb-6">Seleccione qué datos copiar a la nueva OT:</p>

        <div className="space-y-4 mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={copyClientEquipment}
              onChange={(e) => setCopyClientEquipment(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-slate-700">Cliente y Equipo</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={copyBudgets}
              onChange={(e) => setCopyBudgets(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-slate-700">Presupuestos</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={copyObservations}
              onChange={(e) => setCopyObservations(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-slate-700">Observaciones / Acciones a tomar</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={copyReportTecnico}
              onChange={(e) => setCopyReportTecnico(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-slate-700">Reporte técnico</span>
          </label>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nueva OT:
          </label>
          <input
            type="text"
            value={newOtSuffix}
            onChange={(e) => setNewOtSuffix(e.target.value)}
            disabled={isFindingOT}
            className={`w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono ${isFindingOT ? 'bg-slate-100 text-slate-400' : ''}`}
            placeholder={isFindingOT ? 'Buscando OT disponible...' : incrementSuffix(otNumber)}
          />
          {isFindingOT && (
            <p className="text-xs text-slate-500 mt-1">Verificando OT disponible...</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-200 text-slate-700 font-black px-6 py-3 rounded-xl uppercase tracking-widest text-xs transition-all hover:bg-slate-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleDuplicate}
            disabled={isFindingOT}
            className={`flex-1 bg-purple-600 text-white font-black px-6 py-3 rounded-xl uppercase tracking-widest text-xs transition-all hover:bg-purple-700 shadow-lg ${isFindingOT ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isFindingOT ? 'Buscando OT...' : 'Crear OT'}
          </button>
        </div>
      </div>
    </div>
  );
};
