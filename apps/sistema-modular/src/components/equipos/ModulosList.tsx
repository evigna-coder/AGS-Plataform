import { useState } from 'react';
import type { ModuloSistema, CategoriaModulo } from '@ags/shared';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ModuloModal } from './ModuloModal';
import { MoveModuloModal } from './MoveModuloModal';

interface ModulosListProps {
  sistemaId: string;
  modulos: ModuloSistema[];
  categoriasModulos: CategoriaModulo[];
  onSave: (data: ModuloFormData, editingId?: string) => Promise<void>;
  onDelete: (moduloId: string) => Promise<void>;
  onMove?: (moduloId: string, targetSistemaId: string) => Promise<void>;
}

export interface ModuloFormData {
  categoriaModuloId: string;
  modeloCodigo: string;
  nombre: string;
  marca: string;
  descripcion: string;
  serie: string;
  firmware: string;
  observaciones: string;
}

const emptyForm: ModuloFormData = {
  categoriaModuloId: '', modeloCodigo: '', nombre: '', marca: '',
  descripcion: '', serie: '', firmware: '', observaciones: '',
};

export const ModulosList: React.FC<ModulosListProps> = ({
  sistemaId, modulos, categoriasModulos, onSave, onDelete, onMove,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingModulo, setEditingModulo] = useState<ModuloSistema | null>(null);
  const [form, setForm] = useState<ModuloFormData>({ ...emptyForm });
  const [movingModulo, setMovingModulo] = useState<ModuloSistema | null>(null);

  const openNew = () => {
    setEditingModulo(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (modulo: ModuloSistema) => {
    setEditingModulo(modulo);
    let categoriaId = '';
    let modeloCodigo = '';
    for (const cat of categoriasModulos) {
      const modelo = cat.modelos.find(m => m.codigo === modulo.nombre);
      if (modelo) { categoriaId = cat.id; modeloCodigo = modelo.codigo; break; }
    }
    setForm({
      categoriaModuloId: categoriaId, modeloCodigo,
      nombre: modulo.nombre, marca: modulo.marca || '',
      descripcion: modulo.descripcion || '', serie: modulo.serie || '',
      firmware: modulo.firmware || '', observaciones: modulo.observaciones || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    await onSave(form, editingModulo?.id);
    setShowModal(false); setEditingModulo(null); setForm({ ...emptyForm });
  };

  return (
    <>
      <Card compact>
        <div className="flex justify-between items-center mb-3">
          <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
            Modulos del Sistema
          </p>
          <Button size="sm" onClick={openNew}>+ Agregar</Button>
        </div>

        {modulos.length > 0 ? (
          <div className="space-y-2">
            {modulos.map((modulo) => (
              <ModuloRow
                key={modulo.id} modulo={modulo}
                onEdit={() => openEdit(modulo)}
                onDelete={() => onDelete(modulo.id)}
                onMove={onMove ? () => setMovingModulo(modulo) : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <p className="text-slate-400 text-xs mb-2">No hay modulos registrados</p>
            <Button variant="outline" size="sm" onClick={openNew}>
              + Agregar Primer Modulo
            </Button>
          </div>
        )}
      </Card>

      {showModal && (
        <ModuloModal
          form={form} setForm={setForm} categoriasModulos={categoriasModulos}
          editingModulo={editingModulo} onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingModulo(null); }}
        />
      )}

      {movingModulo && onMove && (
        <MoveModuloModal
          modulo={movingModulo} currentSistemaId={sistemaId}
          onMove={async (targetId) => { await onMove(movingModulo.id, targetId); setMovingModulo(null); }}
          onClose={() => setMovingModulo(null)}
        />
      )}
    </>
  );
};

const ModuloRow: React.FC<{
  modulo: ModuloSistema; onEdit: () => void; onDelete: () => void; onMove?: () => void;
}> = ({ modulo, onEdit, onDelete, onMove }) => (
  <div className="flex justify-between items-start p-3 bg-white rounded-lg border border-slate-200 hover:border-teal-200 transition-colors">
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-slate-900 tracking-tight">{modulo.nombre}</p>
      {modulo.descripcion && <p className="text-[11px] text-slate-500 mt-0.5">{modulo.descripcion}</p>}
      <div className="flex gap-3 mt-1 text-[11px] text-slate-400">
        {modulo.marca && <span>Marca: <span className="font-medium text-slate-500">{modulo.marca}</span></span>}
        {modulo.serie && <span>Serie: <span className="font-medium text-slate-500">{modulo.serie}</span></span>}
        {modulo.firmware && <span>FW: <span className="font-medium text-slate-500">{modulo.firmware}</span></span>}
      </div>
      {modulo.observaciones && <p className="text-[11px] text-slate-400 italic mt-1">{modulo.observaciones}</p>}
    </div>
    <div className="flex gap-1 ml-2 shrink-0">
      {onMove && <button onClick={onMove} className="text-amber-600 hover:bg-amber-50 text-[11px] font-medium px-1.5 py-0.5 rounded">Mover</button>}
      <button onClick={onEdit} className="text-teal-600 hover:bg-teal-50 text-[11px] font-medium px-1.5 py-0.5 rounded">Editar</button>
      <button onClick={onDelete} className="text-red-500 hover:bg-red-50 text-[11px] font-medium px-1.5 py-0.5 rounded">Eliminar</button>
    </div>
  </div>
);
