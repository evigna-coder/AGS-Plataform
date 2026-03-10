import type { WorkOrder } from '@ags/shared';

declare const html2pdf: {
  (): {
    set(opts: Record<string, unknown>): unknown;
    from(el: HTMLElement): { save(): Promise<void> };
  };
};

function fmt(d?: string) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-AR'); } catch { return d; }
}

function buildTemplate(ot: WorkOrder & { problemaFallaInicial?: string; materialesParaServicio?: string }): string {
  const partsRows = (ot.articulos || []).map(p =>
    `<tr><td>${p.codigo || '—'}</td><td>${p.descripcion || '—'}</td><td style="text-align:center">${p.cantidad}</td><td>${p.origen || '—'}</td></tr>`
  ).join('');

  return `
<div style="font-family:Arial,sans-serif;font-size:11px;color:#1e293b;max-width:780px;margin:0 auto;padding:24px">
  <!-- Header -->
  <table style="width:100%;margin-bottom:16px">
    <tr>
      <td><span style="font-size:20px;font-weight:700;color:#4f46e5">AGS Analítica</span><br/><span style="font-size:11px;color:#64748b">Reporte de Servicio Técnico</span></td>
      <td style="text-align:right">
        <span style="font-size:16px;font-weight:700">OT-${ot.otNumber}</span><br/>
        <span style="font-size:10px;color:#64748b">Estado: ${ot.status === 'FINALIZADO' ? 'Finalizado' : 'Borrador'}</span>
      </td>
    </tr>
  </table>
  <hr style="border:none;border-top:2px solid #e2e8f0;margin:0 0 16px"/>

  <!-- Client / Equipment -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tr style="background:#f8fafc"><th colspan="4" style="padding:6px 8px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Datos del Cliente / Equipo</th></tr>
    <tr>
      <td style="padding:4px 8px;width:25%;color:#64748b">Razón Social</td><td style="padding:4px 8px;font-weight:600">${ot.razonSocial || '—'}</td>
      <td style="padding:4px 8px;width:25%;color:#64748b">Contacto</td><td style="padding:4px 8px">${ot.contacto || '—'}</td>
    </tr>
    <tr style="background:#f8fafc">
      <td style="padding:4px 8px;color:#64748b">Sistema</td><td style="padding:4px 8px">${ot.sistema || '—'}</td>
      <td style="padding:4px 8px;color:#64748b">Módulo</td><td style="padding:4px 8px">${ot.moduloModelo || '—'}</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;color:#64748b">Tipo Servicio</td><td style="padding:4px 8px">${ot.tipoServicio || '—'}</td>
      <td style="padding:4px 8px;color:#64748b">Dirección</td><td style="padding:4px 8px">${ot.direccion || '—'}${ot.localidad ? `, ${ot.localidad}` : ''}</td>
    </tr>
    <tr style="background:#f8fafc">
      <td style="padding:4px 8px;color:#64748b">Fecha Inicio</td><td style="padding:4px 8px">${fmt(ot.fechaInicio)}</td>
      <td style="padding:4px 8px;color:#64748b">Fecha Fin</td><td style="padding:4px 8px">${fmt(ot.fechaFin)}</td>
    </tr>
    <tr>
      <td style="padding:4px 8px;color:#64748b">Horas Trabajadas</td><td style="padding:4px 8px">${ot.horasTrabajadas || '—'} hs</td>
      <td style="padding:4px 8px;color:#64748b">Tiempo Viaje</td><td style="padding:4px 8px">${ot.tiempoViaje || '—'} hs</td>
    </tr>
  </table>

  <!-- Report -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tr style="background:#f8fafc"><th colspan="1" style="padding:6px 8px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Informe Técnico</th></tr>
    ${ot.problemaFallaInicial ? `<tr><td style="padding:6px 8px"><b>Problema inicial:</b><br/>${ot.problemaFallaInicial.replace(/\n/g,'<br/>')}</td></tr>` : ''}
    <tr style="background:#f8fafc"><td style="padding:6px 8px"><b>Trabajo realizado:</b><br/>${(ot.reporteTecnico || '—').replace(/\n/g,'<br/>')}</td></tr>
    ${ot.materialesParaServicio ? `<tr><td style="padding:6px 8px"><b>Materiales utilizados:</b><br/>${ot.materialesParaServicio.replace(/\n/g,'<br/>')}</td></tr>` : ''}
    ${ot.accionesTomar ? `<tr style="background:#f8fafc"><td style="padding:6px 8px"><b>Acciones a tomar:</b><br/>${ot.accionesTomar.replace(/\n/g,'<br/>')}</td></tr>` : ''}
  </table>

  <!-- Parts -->
  ${(ot.articulos || []).length > 0 ? `
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <tr style="background:#f8fafc"><th colspan="4" style="padding:6px 8px;text-align:left;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Partes / Repuestos</th></tr>
    <tr style="background:#e2e8f0;font-weight:600"><td style="padding:4px 8px">Código</td><td style="padding:4px 8px">Descripción</td><td style="padding:4px 8px;text-align:center">Cant.</td><td style="padding:4px 8px">Origen</td></tr>
    ${partsRows}
  </table>` : ''}

  <!-- Signatures -->
  <table style="width:100%;border-collapse:collapse;margin-top:24px">
    <tr>
      <td style="width:50%;padding:8px;text-align:center;border:1px solid #e2e8f0;border-radius:8px">
        ${ot.signatureEngineer ? `<img src="${ot.signatureEngineer}" style="height:60px;max-width:200px"/>` : '<div style="height:60px"></div>'}
        <hr style="border:none;border-top:1px solid #94a3b8;margin:4px 0"/>
        <p style="margin:0;font-size:10px;color:#64748b">${ot.aclaracionEspecialista || 'Firma del Especialista'}</p>
        <p style="margin:0;font-size:9px;color:#94a3b8">AGS Analítica</p>
      </td>
      <td style="width:4%"></td>
      <td style="width:50%;padding:8px;text-align:center;border:1px solid #e2e8f0;border-radius:8px">
        ${ot.signatureClient ? `<img src="${ot.signatureClient}" style="height:60px;max-width:200px"/>` : '<div style="height:60px"></div>'}
        <hr style="border:none;border-top:1px solid #94a3b8;margin:4px 0"/>
        <p style="margin:0;font-size:10px;color:#64748b">${ot.aclaracionCliente || 'Firma del Cliente'}</p>
        <p style="margin:0;font-size:9px;color:#94a3b8">${ot.razonSocial || ''}</p>
      </td>
    </tr>
  </table>

  <p style="margin-top:16px;font-size:9px;color:#94a3b8;text-align:center">
    AGS Analítica · soporte@agsanalitica.com · Generado ${new Date().toLocaleString('es-AR')}
  </p>
</div>`;
}

export async function generateOTPdf(
  ot: WorkOrder & { problemaFallaInicial?: string; materialesParaServicio?: string },
): Promise<void> {
  if (typeof html2pdf === 'undefined') {
    alert('El generador de PDF no está disponible. Verificá tu conexión a internet.');
    return;
  }

  const container = document.createElement('div');
  container.innerHTML = buildTemplate(ot);
  document.body.appendChild(container);

  try {
    await (html2pdf() as ReturnType<typeof html2pdf>)
      .set({
        margin: [8, 8, 8, 8],
        filename: `OT-${ot.otNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
