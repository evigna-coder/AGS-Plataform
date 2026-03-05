import { useState, useEffect } from 'react';
import type { UsuarioAGS, PostaCategoria, PostaTipoEntidad, PostaPrioridad } from '@ags/shared';
import { POSTA_CATEGORIA_LABELS, POSTA_PRIORIDAD_LABELS } from '@ags/shared';
import { postasService, usuariosService } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface CrearPostaModalProps {
  tipoEntidad: PostaTipoEntidad;
  entidadId: string;
  entidadNumero: string;
  entidadDescripcion: string;
  categoriaDefault: PostaCategoria;
  onClose: () => void;
  onCreated?: (postaId: string) => void;
}

export const CrearPostaModal = ({
  tipoEntidad, entidadId, entidadNumero, entidadDescripcion, categoriaDefault, onClose, onCreated,
}: CrearPostaModalProps) => {
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAGS[]>([]);
  const [responsableId, setResponsableId] = useState('');
  const [categoria, setCategoria] = useState<PostaCategoria>(categoriaDefault);
  const [accionRequerida, setAccionRequerida] = useState('');
  const [prioridad, setPrioridad] = useState<PostaPrioridad>('normal');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { usuariosService.getAll().then(u => setUsuarios(u.filter(x => x.status === 'activo'))); }, []);

  const responsable = usuarios.find(u => u.id === responsableId);

  const handleSubmit = async () => {
    if (!responsableId || !accionRequerida.trim() || !usuario || !responsable) return;
    setSaving(true);
    try {
      const postaId = await postasService.create({
        tipoEntidad,
        entidadId,
        entidadNumero,
        entidadDescripcion,
        categoria,
        responsableId,
        responsableNombre: responsable.displayName,
        creadoPorId: usuario.id,
        creadoPorNombre: usuario.displayName,
        estado: 'pendiente',
        prioridad,
        accionRequerida: accionRequerida.trim(),
        historial: [{
          fecha: new Date().toISOString(),
          deUsuarioId: usuario.id,
          deUsuarioNombre: usuario.displayName,
          aUsuarioId: responsableId,
          aUsuarioNombre: responsable.displayName,
          accion: 'Crear',
          comentario: comentario.trim() || null,
        }],
        comentario: comentario.trim() || null,
        fechaCreacion: new Date().toISOString(),
        fechaVencimiento: fechaVencimiento || null,
        fechaCompletada: null,
      });
      onCreated?.(postaId);
      onClose();
    } catch {
      alert('Error al crear la posta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title="Crear posta" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Entidad</label>
          <p className="text-xs text-slate-700 font-medium">{entidadNumero}</p>
          <p className="text-[10px] text-slate-500">{entidadDescripcion}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-1 block">Categoria</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value as PostaCategoria)}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {Object.entries(POSTA_CATEGORIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400 mb-1 block">Prioridad</label>
            <select value={prioridad} onChange={e => setPrioridad(e.target.value as PostaPrioridad)}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {Object.entries(POSTA_PRIORIDAD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Responsable *</label>
          <select value={responsableId} onChange={e => setResponsableId(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Seleccionar usuario...</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.displayName} ({u.role})</option>)}
          </select>
        </div>

        <Input
          label="Accion requerida *"
          inputSize="sm"
          value={accionRequerida}
          onChange={e => setAccionRequerida(e.target.value)}
          placeholder="Que debe hacer el responsable..."
        />

        <Input
          label="Fecha vencimiento (opcional)"
          inputSize="sm"
          type="date"
          value={fechaVencimiento}
          onChange={e => setFechaVencimiento(e.target.value)}
        />

        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">Comentario (opcional)</label>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3}
            className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Informacion adicional..." />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!responsableId || !accionRequerida.trim() || saving}>
            {saving ? 'Creando...' : 'Crear posta'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
