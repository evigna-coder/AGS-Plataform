import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  async optimizeTechnicalReport(currentText: string): Promise<string> {
    if (!currentText) return "";
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Como experto en servicio técnico de laboratorio, mejora la redacción del siguiente reporte técnico para que sea más profesional, preciso y claro, manteniendo los detalles técnicos originales: "${currentText}"`,
        config: {
          temperature: 0.7,
        }
      });
      return response.text || currentText;
    } catch (error) {
      console.error("Error optimizing report:", error);
      return currentText;
    }
  }

  async suggestActions(technicalReport: string): Promise<string> {
    if (!technicalReport) return "";
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Basado en este reporte de servicio técnico de laboratorio: "${technicalReport}", sugiere una lista breve de 2 o 3 acciones a tomar o recomendaciones preventivas futuras.`,
        config: {
          temperature: 0.7,
        }
      });
      return response.text || "";
    } catch (error) {
      console.error("Error suggesting actions:", error);
      return "";
    }
  }

  async generateEmailSummary(customerName: string, otNumber: string, reportSummary: string): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Genera un cuerpo de correo electrónico muy breve y sumamente profesional para enviar un reporte de servicio técnico. 
        Cliente: ${customerName}
        OT: ${otNumber}
        Resumen del trabajo: ${reportSummary}
        Debe invitar al cliente a revisar el PDF adjunto. No incluyas asunto, solo el cuerpo.`,
        config: {
          temperature: 0.5,
        }
      });
      return response.text || "Adjunto encontrará el reporte de servicio técnico correspondiente.";
    } catch (error) {
      return "Adjunto encontrará el reporte de servicio técnico correspondiente.";
    }
  }
}