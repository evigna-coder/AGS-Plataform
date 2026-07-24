import { useState, useEffect } from 'react';
import { tiposServicioService } from '../../services/firebaseService';
import type { TipoServicio } from '@ags/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { TIPOS_SERVICIO_ESTANDAR } from '../../utils/tiposServicioEstandar';

const normalizar = (s: string) => s.trim().toLowerCase();

export const TiposServicio = () => {
  const goBack = useNavigateBack();
  const confirm = useConfirm();
  const [tipos, setTipos] = useState<TipoServicio[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TipoServicio | null>(null);
  const [formData, setFormData] = useState({ nombre: '', generaRecurrenciaAnual: false });
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await tiposServicioService.getAll();
      setTipos(data);
    } catch (error) {
      console.error('Error cargando tipos de servicio:', error);
      alert('Error al cargar tipos de servicio');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      alert('El nombre del tipo de servicio es obligatorio');
      return;
    }

    try {
      if (editing) {
        await tiposServicioService.update(editing.id, {
          nombre: formData.nombre.trim(),
          activo: editing.activo,
          generaRecurrenciaAnual: formData.generaRecurrenciaAnual,
        });
      } else {
        await tiposServicioService.create({
          nombre: formData.nombre.trim(),
          activo: true,
          requiresProtocol: false,
          generaRecurrenciaAnual: formData.generaRecurrenciaAnual,
        });
      }
      await loadData();
      setShowModal(false);
      setEditing(null);
      setFormData({ nombre: '', generaRecurrenciaAnual: false });
    } catch (error) {
      console.error('Error guardando tipo de servicio:', error);
      alert('Error al guardar el tipo de servicio');
    }
  };

  const handleSeedDefaults = async () => {
    const existentes = new Set(tipos.map(t => normalizar(t.nombre)));
    const faltantes = TIPOS_SERVICIO_ESTANDAR.filter(n => !existentes.has(normalizar(n)));
    if (faltantes.length === 0) {
      alert('Ya están cargados todos los tipos estándar.');
      return;
    }
    if (!await confirm(`Se crearán ${faltantes.length} tipo(s) de servicio faltante(s):\n\n${faltantes.join('\n')}`)) return;
    try {
      setSeeding(true);
      for (const nombre of faltantes) {
        await tiposServicioService.create({ nombre, activo: true, requiresProtocol: false, generaRecurrenciaAnual: false });
      }
      await loadData();
    } catch (error) {
      console.error('Error cargando tipos estándar:', error);
      alert('Error al cargar los tipos estándar');
    } finally {
      setSeeding(false);
    }
  };

  const handleEdit = (tipo: TipoServicio) => {
    setEditing(tipo);
    setFormData({ nombre: tipo.nombre, generaRecurrenciaAnual: tipo.generaRecurrenciaAnual ?? false });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!await confirm('¿Está seguro de eliminar este tipo de servicio?')) return;
    try {
      await tiposServicioService.delete(id);
      await loadData();
    } catch (error) {
      console.error('Error eliminando tipo de servicio:', error);
      alert('Error al eliminar el tipo de servicio');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-400">Cargando tipos de servicio...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Tipos de Servicio</h2>
          <p className="text-sm text-slate-500 mt-1">Gestionar tipos de servicio para OTs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => goBack()}>
            Volver a OTs
          </Button>
          <Button variant="outline" onClick={handleSeedDefaults} disabled={seeding}>
            {seeding ? 'Cargando...' : 'Cargar tipos estándar'}
          </Button>
          <Button onClick={() => { setEditing(null); setFormData({ nombre: '', generaRecurrenciaAnual: false }); setShowModal(true); }}>
            + Nuevo Tipo
          </Button>
        </div>
      </div>

      {tipos.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-slate-400 mb-4">No hay tipos de servicio registrados</p>
            <Button onClick={() => { setEditing(null); setFormData({ nombre: '', generaRecurrenciaAnual: false }); setShowModal(true); }}>
              Crear primer tipo de servicio
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {tipos.map((tipo) => (
            <Card key={tipo.id}>
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">
                    {tipo.nombre}
                    {tipo.generaRecurrenciaAnual && (
                      <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 align-middle">
                        Recurrencia anual
                      </span>
                    )}
                  </h3>
                  {!tipo.activo && (
                    <span className="text-xs text-slate-400 italic">(Inactivo)</span>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(tipo)}
                    className="text-blue-600 hover:underline text-xs font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(tipo.id)}
                    className="text-red-600 hover:underline text-xs font-medium"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditing(null); setFormData({ nombre: '', generaRecurrenciaAnual: false }); }}
        title={editing ? 'Editar Tipo de Servicio' : 'Nuevo Tipo de Servicio'}
        maxWidth="sm"
        minimizable={false}
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowModal(false); setEditing(null); setFormData({ nombre: '', generaRecurrenciaAnual: false }); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Nombre del Tipo de Servicio *
            </label>
            <Input
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej: Mantenimiento preventivo, Calificacion de operacion..."
              required
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" className="rounded border-slate-300 mt-0.5"
              checked={formData.generaRecurrenciaAnual}
              onChange={(e) => setFormData({ ...formData, generaRecurrenciaAnual: e.target.checked })} />
            <span>
              Recurrencia anual
              <span className="block text-[11px] text-slate-400">
                Servicio regulatorio con vigencia de 1 año: al completarse en la agenda reserva
                el mismo lugar del año siguiente como previsión (sin abrir OT).
              </span>
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
};
