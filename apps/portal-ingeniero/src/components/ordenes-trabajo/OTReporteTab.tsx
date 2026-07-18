import type { useOTForm } from '../../hooks/useOTForm';

const ta = 'w-full border border-slate-300 rounded-xl px-3 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none disabled:bg-slate-50 disabled:text-slate-500';
const inp = 'w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500';
const lbl = 'block font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1';

/** Tab "Reporte": campos del informe técnico (sin cambios funcionales del rediseño). */
export default function OTReporteTab({ form }: { form: ReturnType<typeof useOTForm> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Fecha inicio</label><input type="date" className={inp} value={form.fechaInicio} onChange={e => form.setFechaInicio(e.target.value)} disabled={form.readOnly} /></div>
        <div><label className={lbl}>Fecha fin</label><input type="date" className={inp} value={form.fechaFin} onChange={e => form.setFechaFin(e.target.value)} disabled={form.readOnly} /></div>
        <div><label className={lbl}>Horas trabajadas</label><input type="number" min={0} step={0.5} className={inp} value={form.horasTrabajadas} onChange={e => form.setHorasTrabajadas(e.target.value)} disabled={form.readOnly} /></div>
        <div><label className={lbl}>Tiempo viaje (hs)</label><input type="number" min={0} step={0.5} className={inp} value={form.tiempoViaje} onChange={e => form.setTiempoViaje(e.target.value)} disabled={form.readOnly} /></div>
      </div>
      <div><label className={lbl}>Problema / Falla inicial</label><textarea rows={3} className={ta} value={form.problemaFallaInicial} onChange={e => form.setProblemaFallaInicial(e.target.value)} disabled={form.readOnly} placeholder="Descripción del problema reportado por el cliente..." /></div>
      <div><label className={lbl}>Reporte técnico</label><textarea rows={5} className={ta} value={form.reporteTecnico} onChange={e => form.setReporteTecnico(e.target.value)} disabled={form.readOnly} placeholder="Descripción detallada del trabajo realizado..." /></div>
      <div><label className={lbl}>Materiales / Insumos utilizados</label><textarea rows={3} className={ta} value={form.materialesParaServicio} onChange={e => form.setMaterialesParaServicio(e.target.value)} disabled={form.readOnly} placeholder="Materiales utilizados durante el servicio..." /></div>
      <div><label className={lbl}>Acciones a tomar</label><textarea rows={3} className={ta} value={form.accionesTomar} onChange={e => form.setAccionesTomar(e.target.value)} disabled={form.readOnly} placeholder="Próximas acciones o recomendaciones..." /></div>
    </>
  );
}
