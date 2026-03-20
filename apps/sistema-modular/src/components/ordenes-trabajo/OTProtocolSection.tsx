import { Card } from '../ui/Card';

const sec = 'text-xs font-semibold text-slate-500 tracking-wider uppercase mb-3';
const textareaCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none bg-white focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400';

export interface OTProtocolSectionProps {
  readOnly: boolean;
  problemaFallaInicial: string;
  reporteTecnico: string;
  materialesParaServicio: string;
  accionesTomar: string;
  onFieldChange: (field: string, value: string) => void;
}

export const OTProtocolSection: React.FC<OTProtocolSectionProps> = ({
  readOnly, problemaFallaInicial, reporteTecnico,
  materialesParaServicio, accionesTomar, onFieldChange,
}) => {
  return (
    <div className="space-y-4">
      {/* Problema / Falla Inicial */}
      <Card compact>
        <p className={sec}>Problema / Falla Inicial</p>
        <textarea
          value={problemaFallaInicial}
          onChange={e => onFieldChange('problemaFallaInicial', e.target.value)}
          rows={3}
          disabled={readOnly}
          placeholder="Describa el problema o falla inicial que dio origen a esta OT..."
          className={textareaCls}
        />
      </Card>

      {/* Informe Tecnico */}
      <Card compact>
        <p className={sec}>Informe Tecnico</p>
        <textarea
          value={reporteTecnico}
          onChange={e => onFieldChange('reporteTecnico', e.target.value)}
          rows={5}
          disabled={readOnly}
          placeholder="Describa detalladamente el servicio tecnico realizado..."
          className={textareaCls}
        />
      </Card>

      {/* Materiales para el Servicio */}
      <Card compact>
        <p className={sec}>Materiales para el Servicio</p>
        <textarea
          value={materialesParaServicio}
          onChange={e => onFieldChange('materialesParaServicio', e.target.value)}
          rows={3}
          disabled={readOnly}
          placeholder="Describa los materiales necesarios para realizar el servicio..."
          className={textareaCls}
        />
      </Card>

      {/* Observaciones / Acciones a Tomar */}
      <Card compact>
        <p className={sec}>Observaciones / Acciones a Tomar</p>
        <textarea
          value={accionesTomar}
          onChange={e => onFieldChange('accionesTomar', e.target.value)}
          rows={4}
          disabled={readOnly}
          placeholder="Recomendaciones o trabajos pendientes..."
          className={textareaCls}
        />
      </Card>
    </div>
  );
};
