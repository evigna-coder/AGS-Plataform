"""Genera PDF de comparación Odoo vs Sistema-Modular en el escritorio del usuario."""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, HRFlowable,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
import os

# --- Theme ---
TEAL = HexColor("#0D6E6E")
TEAL_LIGHT = HexColor("#E6F2F2")
TEAL_DARK = HexColor("#0A5959")
SLATE_900 = HexColor("#0F172A")
SLATE_700 = HexColor("#334155")
SLATE_500 = HexColor("#64748B")
SLATE_300 = HexColor("#CBD5E1")
SLATE_100 = HexColor("#F1F5F9")
SLATE_50 = HexColor("#F8FAFC")
EMERALD_700 = HexColor("#047857")
EMERALD_50 = HexColor("#ECFDF5")
RED_700 = HexColor("#B91C1C")
RED_50 = HexColor("#FEF2F2")
AMBER_700 = HexColor("#B45309")
AMBER_50 = HexColor("#FFFBEB")

styles = getSampleStyleSheet()

H1 = ParagraphStyle('H1', parent=styles['Heading1'], fontSize=22, leading=26,
                   textColor=SLATE_900, spaceAfter=4, fontName='Helvetica-Bold')
H2 = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=14, leading=18,
                   textColor=TEAL_DARK, spaceBefore=12, spaceAfter=6, fontName='Helvetica-Bold')
H3 = ParagraphStyle('H3', parent=styles['Heading3'], fontSize=11, leading=14,
                   textColor=SLATE_900, spaceBefore=8, spaceAfter=2, fontName='Helvetica-Bold')
LABEL = ParagraphStyle('LABEL', parent=styles['Normal'], fontSize=7.5, leading=10,
                       textColor=SLATE_500, fontName='Courier-Bold', spaceAfter=2)
BODY = ParagraphStyle('BODY', parent=styles['Normal'], fontSize=9.5, leading=14,
                      textColor=SLATE_700, alignment=TA_JUSTIFY, spaceAfter=6)
BULLET = ParagraphStyle('BULLET', parent=styles['Normal'], fontSize=9.5, leading=13,
                        textColor=SLATE_700, leftIndent=12, bulletIndent=2, spaceAfter=2)
SMALL = ParagraphStyle('SMALL', parent=styles['Normal'], fontSize=8, leading=11,
                       textColor=SLATE_500)
COVER_TITLE = ParagraphStyle('COVER_TITLE', parent=styles['Title'], fontSize=32, leading=38,
                             textColor=TEAL_DARK, fontName='Helvetica-Bold',
                             alignment=TA_LEFT, spaceAfter=8)
COVER_SUB = ParagraphStyle('COVER_SUB', parent=styles['Normal'], fontSize=14, leading=18,
                           textColor=SLATE_700, alignment=TA_LEFT, spaceAfter=4)
TABLE_TXT = ParagraphStyle('TABLE_TXT', parent=styles['Normal'], fontSize=8.5, leading=11,
                           textColor=SLATE_700)
TABLE_TXT_BOLD = ParagraphStyle('TABLE_TXT_BOLD', parent=TABLE_TXT, fontName='Helvetica-Bold',
                                textColor=SLATE_900)
TABLE_HEAD = ParagraphStyle('TABLE_HEAD', parent=styles['Normal'], fontSize=7.5, leading=10,
                            textColor=colors.white, fontName='Courier-Bold', alignment=TA_LEFT)
EXAMPLE = ParagraphStyle('EXAMPLE', parent=styles['Normal'], fontSize=8.5, leading=12,
                         textColor=SLATE_700, leftIndent=10, rightIndent=10,
                         spaceBefore=2, spaceAfter=2, fontName='Helvetica-Oblique')


def page_header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    # Top stripe
    canvas.setFillColor(TEAL)
    canvas.rect(0, height - 6 * mm, width, 6 * mm, stroke=0, fill=1)
    # Footer
    canvas.setFont('Courier-Bold', 7)
    canvas.setFillColor(SLATE_500)
    canvas.drawString(15 * mm, 10 * mm, "AGS ANALÍTICA  ·  COMPARACIÓN ODOO VS SISTEMA-MODULAR  ·  MAYO 2026")
    canvas.drawRightString(width - 15 * mm, 10 * mm, f"Página {doc.page}")
    canvas.restoreState()


def cover_page(canvas, doc):
    canvas.saveState()
    width, height = A4
    # Big teal band on left
    canvas.setFillColor(TEAL)
    canvas.rect(0, 0, 14 * mm, height, stroke=0, fill=1)
    # AGS brand top
    canvas.setFont('Helvetica-Bold', 14)
    canvas.setFillColor(TEAL_DARK)
    canvas.drawString(28 * mm, height - 28 * mm, "AGS")
    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(SLATE_500)
    canvas.drawString(40 * mm, height - 28 * mm, "ANALÍTICA")
    canvas.restoreState()


def chip(text, bg, fg, font_size=8):
    """Pequeño rectángulo de color con texto, como una table de 1x1."""
    para = Paragraph(f"<font color='{fg.hexval()}'>{text}</font>", ParagraphStyle(
        'chip', parent=BODY, fontSize=font_size, leading=font_size + 2,
        alignment=TA_CENTER, fontName='Helvetica-Bold'
    ))
    t = Table([[para]], colWidths=[2.6 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('BOX', (0, 0), (-1, -1), 0.5, bg),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('ROUNDEDCORNERS', [3, 3, 3, 3]),
    ]))
    return t


def section_banner(title, subtitle=None):
    """Banner verde teal para iniciar una sección."""
    rows = [[Paragraph(f"<font color='white'><b>{title}</b></font>",
                       ParagraphStyle('banner', parent=H2, textColor=colors.white, fontSize=12))]]
    if subtitle:
        rows.append([Paragraph(f"<font color='#E6F2F2'>{subtitle}</font>",
                               ParagraphStyle('bannersub', parent=BODY, textColor=TEAL_LIGHT, fontSize=8.5, leading=11))])
    t = Table(rows, colWidths=[17 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), TEAL),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('BOX', (0, 0), (-1, -1), 0, colors.transparent),
    ]))
    return t


def comparison_table(rows, col_widths=None):
    """Tabla de comparación 3 columnas: Aspecto | Sistema-Modular | Odoo.

    rows: lista de (aspecto, sm_text, odoo_text, sm_tone, odoo_tone).
    tone: 'positive' | 'neutral' | 'warning' | 'danger'.
    """
    if col_widths is None:
        col_widths = [5 * cm, 6 * cm, 6 * cm]

    tone_bg = {
        'positive': EMERALD_50,
        'neutral': SLATE_50,
        'warning': AMBER_50,
        'danger': RED_50,
        None: colors.white,
    }
    tone_fg = {
        'positive': EMERALD_700,
        'neutral': SLATE_700,
        'warning': AMBER_700,
        'danger': RED_700,
        None: SLATE_700,
    }

    header = [
        Paragraph("ASPECTO", TABLE_HEAD),
        Paragraph("SISTEMA-MODULAR", TABLE_HEAD),
        Paragraph("ODOO", TABLE_HEAD),
    ]
    data = [header]
    styles_extra = []

    for i, (aspecto, sm_text, odoo_text, sm_tone, odoo_tone) in enumerate(rows, start=1):
        data.append([
            Paragraph(aspecto, TABLE_TXT_BOLD),
            Paragraph(sm_text, ParagraphStyle(f'sm{i}', parent=TABLE_TXT, textColor=tone_fg.get(sm_tone))),
            Paragraph(odoo_text, ParagraphStyle(f'od{i}', parent=TABLE_TXT, textColor=tone_fg.get(odoo_tone))),
        ])
        styles_extra.append(('BACKGROUND', (1, i), (1, i), tone_bg.get(sm_tone, colors.white)))
        styles_extra.append(('BACKGROUND', (2, i), (2, i), tone_bg.get(odoo_tone, colors.white)))

    t = Table(data, colWidths=col_widths, repeatRows=1)
    base = [
        ('BACKGROUND', (0, 0), (-1, 0), TEAL),
        ('LINEBELOW', (0, 0), (-1, 0), 1, TEAL_DARK),
        ('GRID', (0, 1), (-1, -1), 0.4, SLATE_300),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    t.setStyle(TableStyle(base + styles_extra))
    return t


def example_box(label, text):
    """Cuadro destacado con un ejemplo concreto."""
    inner = [
        [Paragraph(f"<font color='{TEAL_DARK.hexval()}'><b>EJEMPLO — {label}</b></font>",
                   ParagraphStyle('ex_label', parent=LABEL, textColor=TEAL_DARK, fontSize=7.5))],
        [Paragraph(text, ParagraphStyle('ex_text', parent=BODY, fontSize=9, leading=12.5))],
    ]
    t = Table(inner, colWidths=[17 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), TEAL_LIGHT),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LINEBEFORE', (0, 0), (0, -1), 3, TEAL),
    ]))
    return t


def build_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Comparación Odoo vs Sistema-Modular",
        author="AGS Analítica",
    )

    story = []

    # ──────────────── COVER PAGE ────────────────
    story.append(Spacer(1, 6 * cm))
    story.append(Paragraph("Comparación", COVER_TITLE))
    story.append(Paragraph("<font color='#64748B'>Odoo vs Sistema-Modular AGS</font>", COVER_TITLE))
    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width=6 * cm, thickness=2, color=TEAL))
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Evaluación previa a decisión de migración", COVER_SUB))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("<font color='#64748B'>Excluye módulo de facturación — aún no planificado en sistema-modular.</font>",
                            ParagraphStyle('cs2', parent=COVER_SUB, fontSize=10, textColor=SLATE_500)))
    story.append(Spacer(1, 4 * cm))
    story.append(Paragraph("<font color='#0D6E6E'><b>AGS ANALÍTICA</b></font>",
                            ParagraphStyle('cs3', parent=LABEL, fontSize=10, textColor=TEAL_DARK)))
    story.append(Paragraph("Esteban Vigna  ·  18 de mayo de 2026", SMALL))
    story.append(PageBreak())

    # ──────────────── RESUMEN EJECUTIVO ────────────────
    story.append(Paragraph("Resumen ejecutivo", H1))
    story.append(HRFlowable(width="100%", thickness=1.5, color=TEAL, spaceBefore=4, spaceAfter=10))

    story.append(Paragraph("Tesis", H2))
    story.append(Paragraph(
        "Odoo da cobertura horizontal grande (HR, BI ejecutivo, Compras, Project Management), pero el "
        "<b>core del negocio de AGS — calibración de instrumental analítico — no entra en su modelo de "
        "datos genérico</b>. Migrar significa rehacer de cero, como módulo custom de Odoo, todo el código "
        "de dominio que hoy funciona en producción y que técnicos, coordinación e ingeniería usan diariamente.",
        BODY,
    ))
    story.append(Paragraph(
        "El gap no es vertical (el negocio): es horizontal (cobertura de funciones administrativas auxiliares). "
        "Y ese gap se cierra <b>más barato sobre sistema-modular que migrando</b>.",
        BODY,
    ))

    # 3-column quick summary
    story.append(Spacer(1, 4 * mm))
    three_col = Table(
        [[
            Paragraph("<b>YA CUBRIMOS</b>", ParagraphStyle('q1', parent=LABEL, fontSize=8, textColor=EMERALD_700, alignment=TA_CENTER)),
            Paragraph("<b>GAP REAL</b>", ParagraphStyle('q2', parent=LABEL, fontSize=8, textColor=AMBER_700, alignment=TA_CENTER)),
            Paragraph("<b>RECOMENDACIÓN</b>", ParagraphStyle('q3', parent=LABEL, fontSize=8, textColor=TEAL_DARK, alignment=TA_CENTER)),
        ], [
            Paragraph(
                "• OT (3 fases) + reportes técnicos PDF<br/>"
                "• Biblioteca de tablas / protocolos<br/>"
                "• Presupuestos contrato MIXTA<br/>"
                "• Tickets multi-área con derivación<br/>"
                "• Equipos + QR + identidad digital<br/>"
                "• RBAC híbrido<br/>"
                "• Notificaciones FCM (con caveats iOS)<br/>"
                "• Auto-update Electron por GH Releases",
                ParagraphStyle('qb1', parent=TABLE_TXT, fontSize=8.5, leading=12)),
            Paragraph(
                "• Dashboard ejecutivo / BI<br/>"
                "• Stock formal (multi-depósito, barcode)<br/>"
                "• Compras / Proveedores con PO<br/>"
                "• HR / RRHH (timesheets, ausencias)<br/>"
                "• Documents / DMS con OCR<br/>"
                "• E-signature workflow<br/>"
                "• Project management<br/>"
                "• Mobile app nativa",
                ParagraphStyle('qb2', parent=TABLE_TXT, fontSize=8.5, leading=12)),
            Paragraph(
                "<b>No migrar el core a Odoo.</b><br/><br/>"
                "Cerrar gaps horizontales sobre sistema-modular en orden:<br/>"
                "1. Dashboard ejecutivo (~4 días)<br/>"
                "2. Stock v2 (en curso)<br/>"
                "3. Compras / Proveedores<br/>"
                "4. Facturación (planificación pendiente)<br/>"
                "5. DMS + E-sign<br/>"
                "6. HR (si el negocio lo pide)",
                ParagraphStyle('qb3', parent=TABLE_TXT, fontSize=8.5, leading=12)),
        ]],
        colWidths=[5.8 * cm, 5.8 * cm, 5.8 * cm],
    )
    three_col.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), EMERALD_50),
        ('BACKGROUND', (1, 0), (1, 0), AMBER_50),
        ('BACKGROUND', (2, 0), (2, 0), TEAL_LIGHT),
        ('BACKGROUND', (0, 1), (0, 1), HexColor("#FAFEFB")),
        ('BACKGROUND', (1, 1), (1, 1), HexColor("#FEFCF6")),
        ('BACKGROUND', (2, 1), (2, 1), HexColor("#FAFCFC")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LINEABOVE', (0, 1), (-1, 1), 0.5, SLATE_300),
        ('BOX', (0, 0), (0, -1), 0.4, EMERALD_700),
        ('BOX', (1, 0), (1, -1), 0.4, AMBER_700),
        ('BOX', (2, 0), (2, -1), 0.4, TEAL),
    ]))
    story.append(three_col)
    story.append(PageBreak())

    # ──────────────── SECCIÓN 1: REPORTES OT ────────────────
    story.append(section_banner(
        "1. Pipeline de Reportes Técnicos (reportes-ot)",
        "El activo más caro — producción validada en campo, tablet, sin supervisión técnica."
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(comparison_table([
        ("Plataforma técnico en campo",
         "PWA offline-tolerant en tablet con Google login (popup workaround mobile incluido).",
         "Field Service module con app móvil — no offline real, requiere conectividad.",
         "positive", "neutral"),
        ("Generador PDF informe",
         "Pipeline 4 etapas: Hoja 1 (html2pdf) → Protocolos (html2canvas per-page) → Fotos → Merge pdf-lib.",
         "Sin generador de informe técnico con esta complejidad. Reports module es genérico.",
         "positive", "danger"),
        ("Workarounds frágiles ya resueltos",
         "Bug html2canvas overflow+border-radius / RichTextEditor font-size / Glue chain overflow paginador.",
         "Empezamos de cero — esos mismos bugs reaparecen en cualquier rebuild HTML→PDF.",
         "positive", "danger"),
        ("Split en 2 archivos",
         "Automático cuando hay protocolo adjunto. PDFs separables para envío al cliente.",
         "Requiere lógica custom.",
         "positive", "neutral"),
        ("Trazabilidad de patrones",
         "Scope-limitado a instrumentos, con ordering específico (cert → trazab inmediato).",
         "No existe. Maintenance Equipment trata equipos como objetos planos.",
         "positive", "danger"),
        ("Firma del cliente",
         "Captura en tablet con ingeniero asignado, embebida en el PDF.",
         "Sign module hace firma de documentos genéricos, no integrado al flujo en campo.",
         "positive", "warning"),
        ("Tickets desde 'Acciones a tomar'",
         "Auto-creados en colección leads al finalizar reporte.",
         "Requiere automatización custom.",
         "positive", "neutral"),
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(example_box(
        "Generación de un informe técnico real",
        "Un técnico calibra un HPLC 1260 en sede del cliente con tablet. Selecciona el protocolo de la "
        "biblioteca, ingresa valores en celdas con sub-índices Unicode (H₂O, m², 10⁻³), agrega fotos del "
        "servicio, firma el cliente. El sistema genera 2 PDFs separados (informe + protocolo adjunto), "
        "los une o no según configuración, y deja todo en Storage listo para enviar. "
        "<b>Tiempo total desde 'finalizar' a 'PDF en mano': &lt; 8 segundos</b>. "
        "Reproducir esto en Odoo es un proyecto de 3-4 meses de desarrollo Python/QWeb más meses de "
        "encontrar las mismas regresiones que este código ya resolvió."
    ))
    story.append(PageBreak())

    # ──────────────── SECCIÓN 2: BIBLIOTECA DE TABLAS ────────────────
    story.append(section_banner(
        "2. Biblioteca de Tablas / Protocolos",
        "Único en su clase. Esto no existe en Odoo."
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(comparison_table([
        ("Catálogo de protocolos",
         "/tableCatalog con publicación gated (status: 'published'). Versión activa por equipo.",
         "No existe. Habría que modelarlo como Product Template + Custom Fields.",
         "positive", "danger"),
        ("Sub-índices y supraíndices Unicode",
         "H₂O, m², 10⁻³ integrados en celdas. Copy-paste desde catálogo de referencia.",
         "Editor de texto rich text estándar — sin sub/sup Unicode en celdas de tabla.",
         "positive", "danger"),
        ("Sub-tablas en headers multiSelect",
         "Divisor de sub-tablas independientes según selección del técnico.",
         "Imposible sin desarrollo custom muy específico.",
         "positive", "danger"),
        ("GC Ports",
         "Componente GCPortsGrid.tsx para sistemas gaseosos. Auto-activa según nombre del sistema.",
         "No existe modelo de equipo cromatográfico con puertos.",
         "positive", "danger"),
        ("Plantillas por tipo equipo",
         "Matcheo automático por substring de longitud descendente ('HPLC 1260 Infinity' antes que 'HPLC 1260').",
         "Product variants + manual matching.",
         "positive", "warning"),
        ("Híbrido módulos reales / plantilla",
         "Si el sistema del cliente tiene módulos reales los usa; si no, cae a la plantilla.",
         "Requiere lógica condicional custom.",
         "positive", "warning"),
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(example_box(
        "Calibración de un GC con puertos",
        "Cliente: laboratorio con un GC Agilent 6890 (sistema gaseoso). Al abrir el reporte, el técnico ve "
        "automáticamente la grilla de GC Ports porque el nombre del sistema contiene 'gaseoso'. La biblioteca "
        "trae el protocolo HPLC-GC con sub-índices en las celdas: <i>η (viscosidad), σ (desviación), 10⁻⁶ s⁻¹ "
        "(velocidad de flujo)</i>. El técnico completa, firma, finaliza. <b>Cero configuración manual.</b> En "
        "Odoo: el catálogo de productos no soporta esto. Habría que armar un add-on Python con vistas QWeb y "
        "modelos personalizados — meses de trabajo replicando lo que en sistema-modular ya está."
    ))
    story.append(PageBreak())

    # ──────────────── SECCIÓN 3: PRESUPUESTOS CONTRATO ────────────────
    story.append(section_banner(
        "3. Presupuestos tipo Contrato",
        "Cerrado end-to-end en abril 2026. Lógica MIXTA específica del negocio."
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(comparison_table([
        ("Editor jerárquico",
         "Sector → Sistema → Servicios con auto-generación desde plantilla por tipo de equipo.",
         "Sales Order tiene secciones, pero no la jerarquía 3 niveles propia del servicio analítico.",
         "positive", "warning"),
        ("Moneda MIXTA",
         "USD/ARS con cuotas asimétricas (ej: 12 cuotas USD + 10 cuotas ARS en el mismo contrato).",
         "Subscriptions module es mono-moneda. Multi-currency es por documento, no por cuota.",
         "positive", "danger"),
        ("PDF moderno teal",
         "Cuotas, grupos/subgrupos (G.S), bonificaciones, ítems sin cargo, notas inline por ítem.",
         "PDF template estándar — requiere QWeb dev para llegar a este nivel.",
         "positive", "warning"),
        ("Plantillas tipoEquipoPlantillas",
         "Componentes (S/L) + servicios con precio default. Catálogo administrable.",
         "Product BoM funciona, pero el modelo S/L específico de instrumental analítico no se mapea directo.",
         "positive", "warning"),
        ("Cosecha Items → OT",
         "Modelo otsVinculadasNumbers[] diseñado. Plan implementación en .claude/plans.",
         "Manual o developer-custom.",
         "neutral", "neutral"),
        ("Facturación trigger",
         "OTs cerradas se acumulan en otsListasParaFacturar — admin las agrupa manualmente.",
         "Subscriptions auto-factura por período. No respeta el modelo 'agrupar OTs cerradas'.",
         "positive", "warning"),
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(example_box(
        "Contrato anual con cuotas asimétricas USD + ARS",
        "Cliente: cadena de laboratorios con 15 equipos distribuidos en 4 sectores (Control de Calidad, "
        "I+D, Estabilidad, Microbiología). Contrato de mantenimiento anual: servicios facturados en USD "
        "(visitas, calibraciones), insumos en ARS (consumibles locales). El sistema permite armar "
        "<b>12 cuotas USD + 10 cuotas ARS</b> en el mismo contrato, con grupos G.S por sector, ítems "
        "bonificados sin cargo, y proyecta el PDF con notas inline por ítem. <b>Esto no se puede en Odoo "
        "Subscriptions sin desarrollo custom significativo.</b>"
    ))
    story.append(PageBreak())

    # ──────────────── SECCIÓN 4: FLUJO OT + TICKETS ────────────────
    story.append(section_banner(
        "4. Flujo OT (3 fases) + Tickets refactor",
        "Modelo de coordinación intermedia entre venta y ejecución."
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(comparison_table([
        ("3 fases de OT",
         "Creación administrativa → reporte técnico → cierre administrativo. Transiciones validadas.",
         "Project + Field Service modela tareas — no este flow específico de 3 fases con coordinación.",
         "positive", "warning"),
        ("Aceptar ppto → ticket coordinación",
         "Crea ticket en_coordinacion, no OT directa. Coordinadora arma 0, 1 o N OTs manualmente.",
         "Auto-crea Sales Order → Project — no contempla el paso intermedio de coordinación humana.",
         "positive", "danger"),
        ("Ingeniero asignado por sector/sistema",
         "Asignación granular: ingenieroAsignadoId, sectorId, sistemaId. Filtros permisivos para legacy.",
         "Equipo de Field Service por skill, no por sector/sistema/cliente.",
         "positive", "warning"),
        ("Áreas configurables (tickets)",
         "admin_soporte, ing_soporte, administracion, ventas, sistema. Cada una con responsable.",
         "Helpdesk Teams — comparable, sin la granularidad de 'responsable por área' auto-asignado.",
         "positive", "warning"),
        ("Auto-asignación al derivar",
         "Si un ticket cambia de área sin persona, se asigna automáticamente al responsable de esa área.",
         "Requiere automatización custom.",
         "positive", "neutral"),
        ("Configuración en UI admin",
         "/admin/config-flujos administrable por admin sin tocar código.",
         "Studio (low-code) — sí lo permite, pero hay que armar todo desde cero.",
         "positive", "warning"),
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(example_box(
        "Ciclo completo de venta → coordinación → ejecución",
        "Ventas acepta un presupuesto. El sistema crea automáticamente un ticket "
        "en_coordinacion en la cola de la coordinadora — <i>no</i> una OT. La coordinadora analiza: el "
        "ppto cubre 3 servicios en 2 sectores distintos. Arma <b>2 OTs separadas</b> (una por sector, "
        "agrupando los servicios de cada sector), asigna ingenieros distintos a cada una. El sistema "
        "valida las transiciones, sincroniza el estado del ticket origen, y al finalizar cada OT crea "
        "tickets de 'Acciones a tomar' si corresponde. <b>Este flujo en 3 partes — venta, coordinación "
        "humana, ejecución técnica — es propio del negocio y no es cómo Odoo modela field service.</b>"
    ))
    story.append(PageBreak())

    # ──────────────── SECCIÓN 5: STACK + RELEASE PIPELINE ────────────────
    story.append(section_banner(
        "5. Stack técnico + Release pipeline",
        "Infraestructura que ya está funcionando en producción."
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(comparison_table([
        ("Distribución a usuarios",
         "sistema-modular como .exe instalado, auto-update via electron-updater + GH Releases.",
         "Web — cada usuario abre browser. Requiere retraining + cambio de hábitos.",
         "positive", "warning"),
        ("Releases en producción",
         "17+ versiones distribuidas vía pnpm release:patch/minor/major + tag GH Action.",
         "N/A — los users acceden a la misma instancia.",
         "positive", "neutral"),
        ("RBAC",
         "Híbrido: 6 roles + per-user overrides. Admin = acceso total no restringible.",
         "Groups + Record Rules — más maduro, pero migrar el modelo híbrido requiere remapping.",
         "positive", "warning"),
        ("Push notifications PWA",
         "FCM en portal-ingeniero. Conocimiento operativo: iOS revoca subs cada semanas, re-toggle restaura.",
         "No nativo. Requiere addon comunitario o desarrollo.",
         "positive", "danger"),
        ("Sincronización Firestore",
         "Tiempo real bidireccional. Multi-app: sistema-modular + portal-ingeniero + reportes-ot.",
         "BD relacional propia. No hay sync tiempo real entre instancias sin extra config.",
         "positive", "neutral"),
        ("Conocimiento operativo capturado",
         "Workarounds documentados en CLAUDE.md, .claude/rules, memory/. Auditable.",
         "Empezamos de cero — el conocimiento de ediciones pasadas se pierde.",
         "positive", "danger"),
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(example_box(
        "Cada release distribuido a las PCs en minutos",
        "Bug crítico detectado un viernes a las 17:00 — supongamos que falla la creación de tickets desde "
        "OT cerrada. Fix local, validación, <code>pnpm --filter @ags/sistema-modular release:patch</code>, "
        "push tag. <b>La GH Action buildea, publica el .exe, y las PCs instaladas reciben el popup "
        "'Reiniciar ahora' en ~5 minutos.</b> En Odoo: requiere acceso al servidor, ventana de "
        "mantenimiento, restart del worker — todos los usuarios pierden sesión activa."
    ))
    story.append(PageBreak())

    # ──────────────── SECCIÓN 6: GAPS REALES vs ODOO ────────────────
    story.append(section_banner(
        "6. Donde Odoo nos saca ventaja",
        "Cobertura horizontal — esto sí es real y vale la pena cerrarlo."
    ))
    story.append(Spacer(1, 4 * mm))
    story.append(comparison_table([
        ("Dashboard ejecutivo / BI",
         "No había vista consolidada. Implementación en curso (~4 días, fase actual).",
         "Pivot tables, KPIs, gráficos out-of-the-box en cada módulo.",
         "warning", "positive"),
        ("Stock avanzado",
         "Stock v2 en progreso (Phase 13). Multi-depósito formal pendiente.",
         "Multi-warehouse, lots/serial nativo, transferencias, barcode app, reposición automática.",
         "warning", "positive"),
        ("Compras / Proveedores",
         "No existe módulo formal. Phase 13 menciona compra → uso pero no PO formal.",
         "Purchase Orders, RFQ, vendor pricelist, recepción ligada a stock.",
         "danger", "positive"),
        ("HR / RRHH",
         "No existe.",
         "Empleados, ausencias, timesheets, recruitment, expense reports.",
         "danger", "positive"),
        ("Documents / DMS",
         "QF Documentos parcial — versionado sí, OCR y workflows no.",
         "Documents module — versionado, OCR, workflows de aprobación.",
         "warning", "positive"),
        ("E-signature workflow",
         "Firma cliente en reporte técnico. No hay flow firma presupuesto/contrato.",
         "Sign module nativo: contratos, presupuestos firmados con tracking.",
         "warning", "positive"),
        ("Project management",
         "No existe.",
         "Tareas, kanban, timesheets, planning, dependencias entre tareas.",
         "danger", "positive"),
        ("Mobile app nativa",
         "PWAs (reportes-ot, portal-ingeniero). iOS push frágil — re-toggle periódico.",
         "Apps iOS/Android oficiales para casi todo.",
         "warning", "positive"),
        ("Calendar avanzado",
         "Agenda básica.",
         "Sincronización bidireccional Google/Outlook, invitaciones automáticas.",
         "warning", "positive"),
        ("Multi-company",
         "No.",
         "Built-in.",
         "neutral", "positive"),
        ("Studio (low-code)",
         "N/A — somos el equipo de dev.",
         "Custom fields/views sin código (útil para admins no-dev).",
         "neutral", "positive"),
    ]))
    story.append(PageBreak())

    # ──────────────── DECISIÓN FINAL ────────────────
    story.append(section_banner(
        "7. Matriz de decisión",
        "Vista comparativa final, dimensiones de impacto."
    ))
    story.append(Spacer(1, 4 * mm))

    decision_rows = [
        ("Tiempo de implementación de lo que ya tenemos", "✅ Hecho. 1-2 años de código de dominio.",
         "❌ 6-9 meses de custom development.", "positive", "danger"),
        ("Conocimiento operativo en el código", "✅ Workarounds, edge cases, flujos validados en campo.",
         "❌ Cero — empezamos de cero, las regresiones aparecen.", "positive", "danger"),
        ("Riesgo de regresión en migración", "N/A — no migramos.",
         "⚠️ Alto — mes 1-3 son bugs en campo de técnicos.", "positive", "danger"),
        ("Cobertura horizontal (HR, BI, Compras)", "⚠️ Gap real — falta cerrarlo.",
         "✅ Tienen todo built-in.", "warning", "positive"),
        ("Costo de licencias", "$0 (código propio).",
         "$$ Por usuario/módulo/año.", "positive", "warning"),
        ("Mantenimiento futuro", "✅ Equipo interno conoce todo el código.",
         "Odoo Partner o horas custom — dependencia externa.", "positive", "warning"),
        ("Velocidad de fix en producción", "✅ Release tag → auto-update en minutos.",
         "Restart server, ventana mantenimiento.", "positive", "warning"),
        ("Branding y UX propio", "✅ Editorial Teal, fuentes propias, layouts custom.",
         "UI Odoo estándar — branding limitado.", "positive", "neutral"),
        ("Curva de aprendizaje para users", "✅ Ya saben usarlo.",
         "❌ Retraining masivo.", "positive", "danger"),
    ]
    story.append(comparison_table(decision_rows, col_widths=[5.5 * cm, 6 * cm, 5.5 * cm]))
    story.append(Spacer(1, 6 * mm))

    # Conclusion box
    story.append(Spacer(1, 4 * mm))
    concl_rows = [[Paragraph(
        "<font color='white'><b>RECOMENDACIÓN FINAL</b></font>",
        ParagraphStyle('c1', parent=LABEL, fontSize=10, textColor=colors.white, alignment=TA_CENTER)
    )], [Paragraph(
        "<b>No migrar el core a Odoo.</b> Cerrar los gaps horizontales sobre sistema-modular en orden de prioridad:<br/><br/>"
        "<b>1.</b> Dashboard ejecutivo — <i>en curso, ~4 días</i><br/>"
        "<b>2.</b> Stock v2 fases pendientes — multi-depósito, barcode, reposición automática<br/>"
        "<b>3.</b> Compras / Proveedores — módulo nuevo ligado a stock y a contratos<br/>"
        "<b>4.</b> Facturación — pendiente de planificación (fuera de alcance de este documento)<br/>"
        "<b>5.</b> DMS + E-sign workflow — sobre lo que ya existe (QF Documentos + firma cliente)<br/>"
        "<b>6.</b> HR / RRHH — solo si el negocio lo demanda explícitamente<br/><br/>"
        "El argumento de fondo: <b>migrar tira a la basura 1-2 años de código de dominio validado en campo</b>, "
        "y los gaps horizontales que justifican Odoo se cierran con desarrollo incremental sobre lo que ya hay.",
        ParagraphStyle('c2', parent=BODY, fontSize=10, leading=14, textColor=SLATE_900, alignment=TA_LEFT)
    )]]
    concl = Table(concl_rows, colWidths=[17 * cm])
    concl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL),
        ('BACKGROUND', (0, 1), (-1, 1), TEAL_LIGHT),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 1), (-1, 1), 12),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 12),
        ('BOX', (0, 0), (-1, -1), 1, TEAL_DARK),
    ]))
    story.append(concl)

    # Build with custom first-page handler for cover
    def first_page(canvas, doc):
        cover_page(canvas, doc)

    def later_pages(canvas, doc):
        page_header_footer(canvas, doc)

    doc.build(story, onFirstPage=first_page, onLaterPages=later_pages)
    print(f"PDF generado: {output_path}")


if __name__ == "__main__":
    out = os.path.expanduser("~/Desktop/Comparacion-Odoo-vs-SistemaModular.pdf")
    build_pdf(out)
