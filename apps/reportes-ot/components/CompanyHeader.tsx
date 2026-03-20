import React from 'react';
import { LOGO_SRC } from '../constants/logos';

// Componente para el Logo de la Empresa (PNG transparente)
export const CompanyLogo: React.FC = () => (
  <img
    src={LOGO_SRC}
    alt="Logo AGS"
    style={{
      width: '120px',
      height: 'auto',
      display: 'block',
      flexShrink: 0
    }}
  />
);

export interface HeaderProps {
  companyName: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  web: string;
  logoUrl?: string;
}

export const CompanyHeader: React.FC<HeaderProps> = ({ companyName, address, phone, whatsapp, email, web, logoUrl }) => (
  <div className="flex justify-between items-start border-b pb-3 mb-0 mt-4">
    <div className="flex items-start gap-3">

      {/* Logo de la empresa en PNG */}

      <div>
      <CompanyLogo />
      </div>
      <div className="flex flex-col justify-start">
        <h1 className="text-[15px] text-slate-500 font-medium uppercase tracking-tight leading-none">{companyName}</h1>
        <p className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">{address}</p>
        <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5 items-center">
          <p className="text-[8px] text-slate-500 flex items-center gap-1 font-bold">
            <span className="text-[10px] grayscale opacity-60">📞</span> {phone}

          </p>
          <div className="text-[8px] text-slate-500 flex items-center gap-1 font-bold">
            <svg width="10" height="10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
              <path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            <span className="ml-1">{whatsapp}</span>
          </div>
          <p className="text-[8px] text-slate-500 flex items-center gap-1 font-bold">
            <span className="text-[10px]">✉️</span> {email}
          </p>
        </div>
        <p className="text-[8px] text-slate-500 flex items-center gap-1 font-bold mt-0.5">
          <svg width="10" height="10" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
            <path fill="#64748b" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
          <span className="ml-1">{web}</span>
        </p>
      </div>
    </div>
    <div className="text-right mt-4">
      <h2 className="text-[13px] text-slate-500 font-medium uppercase tracking-tighter leading-none">Reporte de Servicio</h2>
    </div>
  </div>
);
