"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processMailQueue = void 0;
/**
 * Cloud Function: procesa la colección mailQueue para enviar emails.
 *
 * Configuración necesaria (Firebase environment config):
 *   firebase functions:config:set smtp.host="smtp.gmail.com" smtp.port="587"
 *     smtp.user="soporte@agsanalitica.com" smtp.pass="app-password"
 *     smtp.admin_email="administracion@agsanalitica.com"
 *
 * O usar variables de entorno en .env (Firebase Functions Gen2):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ADMIN_EMAIL
 */
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions/v2"));
// Lazy-load nodemailer para no romper si no está instalado aún
let nodemailer = null;
async function getTransporter() {
    if (!nodemailer) {
        nodemailer = await Promise.resolve().then(() => __importStar(require('nodemailer')));
    }
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}
function buildCierreAdminEmail(data) {
    const subject = `[AGS] Cierre administrativo OT-${data.otNumber} — ${data.razonSocial}`;
    const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e293b; border-bottom: 2px solid #06b6d4; padding-bottom: 8px;">
        Cierre Administrativo — OT-${data.otNumber}
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 6px 12px; color: #64748b; font-size: 13px;">Cliente</td>
          <td style="padding: 6px 12px; font-weight: 600; font-size: 13px;">${data.razonSocial}</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="padding: 6px 12px; color: #64748b; font-size: 13px;">Tipo de servicio</td>
          <td style="padding: 6px 12px; font-size: 13px;">${data.tipoServicio || '-'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; color: #64748b; font-size: 13px;">Ingeniero</td>
          <td style="padding: 6px 12px; font-size: 13px;">${data.ingeniero || 'Sin asignar'}</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="padding: 6px 12px; color: #64748b; font-size: 13px;">Horas laboratorio</td>
          <td style="padding: 6px 12px; font-size: 13px;">${data.horasLaboratorio}h</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; color: #64748b; font-size: 13px;">Horas viaje</td>
          <td style="padding: 6px 12px; font-size: 13px;">${data.horasViaje}h</td>
        </tr>
        <tr style="background: #ecfeff;">
          <td style="padding: 6px 12px; color: #64748b; font-size: 13px; font-weight: 600;">Total horas</td>
          <td style="padding: 6px 12px; font-weight: 700; font-size: 14px; color: #0e7490;">${data.horasTotal}h</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; color: #64748b; font-size: 13px;">Partes usadas</td>
          <td style="padding: 6px 12px; font-size: 13px;">${data.partesUsadas} item(s)</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="padding: 6px 12px; color: #64748b; font-size: 13px;">Stock deducido</td>
          <td style="padding: 6px 12px; font-size: 13px;">${data.stockDeducido ? 'Si' : 'No'}</td>
        </tr>
      </table>
      ${data.notas ? `
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin: 12px 0;">
          <p style="margin: 0 0 4px; font-size: 11px; color: #92400e; font-weight: 600;">NOTAS DE CIERRE</p>
          <p style="margin: 0; font-size: 13px; color: #78350f;">${data.notas}</p>
        </div>
      ` : ''}
      <p style="color: #94a3b8; font-size: 11px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
        Este aviso fue generado automaticamente por AGS Plataform al confirmar el cierre administrativo de soporte tecnico.
        La facturacion debe procesarse en Bejerman.
      </p>
    </div>
  `;
    return { subject, html };
}
/**
 * Firestore trigger: cuando se crea un documento en mailQueue,
 * se procesa y se envía el mail correspondiente.
 */
exports.processMailQueue = functions.firestore.onDocumentCreated('mailQueue/{mailId}', async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const mailData = snap.data();
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'administracion@agsanalitica.com';
        const smtpUser = process.env.SMTP_USER || '';
        if (!smtpUser) {
            console.warn('SMTP no configurado — mail encolado pero no enviado:', snap.id);
            await snap.ref.update({ status: 'no_smtp', processedAt: firestore_1.FieldValue.serverTimestamp() });
            return;
        }
        let subject = '';
        let html = '';
        if (mailData.type === 'cierre_admin_ot') {
            const result = buildCierreAdminEmail(mailData.data);
            subject = result.subject;
            html = result.html;
        }
        else {
            console.warn('Tipo de mail desconocido:', mailData.type);
            await snap.ref.update({ status: 'unknown_type', processedAt: firestore_1.FieldValue.serverTimestamp() });
            return;
        }
        const transporter = await getTransporter();
        await transporter.sendMail({
            from: `"AGS Plataform" <${smtpUser}>`,
            to: adminEmail,
            subject,
            html,
        });
        await snap.ref.update({ status: 'sent', processedAt: firestore_1.FieldValue.serverTimestamp() });
        console.log(`Mail enviado: ${subject} → ${adminEmail}`);
    }
    catch (err) {
        console.error('Error enviando mail:', err);
        await snap.ref.update({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
            processedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
});
