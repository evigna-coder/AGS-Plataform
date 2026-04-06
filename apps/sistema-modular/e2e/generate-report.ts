/**
 * Script para generar un informe legible a partir de los resultados de Playwright.
 *
 * Uso: npx tsx e2e/generate-report.ts
 * Requiere: haber corrido los tests antes (npx playwright test)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestResult {
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  error?: { message: string };
}

interface Suite {
  title: string;
  specs: TestResult[];
  suites?: Suite[];
}

interface PlaywrightReport {
  suites: Suite[];
  stats: {
    startTime: string;
    duration: number;
    expected: number;
    unexpected: number;
    flaky: number;
    skipped: number;
  };
}

function flattenSpecs(suite: Suite, prefix = ''): TestResult[] {
  const results: TestResult[] = [];
  const fullPrefix = prefix ? `${prefix} > ${suite.title}` : suite.title;

  for (const spec of suite.specs || []) {
    results.push({ ...spec, title: `${fullPrefix} > ${spec.title}` });
  }

  for (const child of suite.suites || []) {
    results.push(...flattenSpecs(child, fullPrefix));
  }

  return results;
}

function generateReport() {
  const reportPath = path.join(__dirname, '..', 'e2e-report', 'results.json');

  if (!fs.existsSync(reportPath)) {
    console.error('❌ No se encontró results.json. Correr primero: npx playwright test');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

  // Playwright JSON reporter format
  const allSpecs: TestResult[] = [];
  for (const suite of raw.suites || []) {
    allSpecs.push(...flattenSpecs(suite));
  }

  const passed = allSpecs.filter(s => s.status === 'passed');
  const failed = allSpecs.filter(s => s.status === 'failed');
  const skipped = allSpecs.filter(s => s.status === 'skipped');
  const timedOut = allSpecs.filter(s => s.status === 'timedOut');

  const totalDuration = allSpecs.reduce((acc, s) => acc + (s.duration || 0), 0);

  // Agrupar por circuito
  const circuits = new Map<string, TestResult[]>();
  for (const spec of allSpecs) {
    const match = spec.title.match(/Circuito \d+[^>]*/);
    const circuit = match ? match[0].trim() : 'Otros';
    if (!circuits.has(circuit)) circuits.set(circuit, []);
    circuits.get(circuit)!.push(spec);
  }

  // Generar markdown
  const lines: string[] = [];
  const now = new Date().toISOString().split('T')[0];

  lines.push(`# Informe E2E — Sistema Modular AGS`);
  lines.push(`**Fecha:** ${now}`);
  lines.push(`**Duración total:** ${(totalDuration / 1000).toFixed(1)}s`);
  lines.push('');

  lines.push('## Resumen');
  lines.push('');
  lines.push(`| Métrica | Valor |`);
  lines.push(`|---------|-------|`);
  lines.push(`| Total tests | ${allSpecs.length} |`);
  lines.push(`| ✅ Pasaron | ${passed.length} |`);
  lines.push(`| ❌ Fallaron | ${failed.length} |`);
  lines.push(`| ⏭ Skipped | ${skipped.length} |`);
  lines.push(`| ⏱ Timeout | ${timedOut.length} |`);
  lines.push(`| **Tasa de éxito** | **${allSpecs.length > 0 ? ((passed.length / allSpecs.length) * 100).toFixed(1) : 0}%** |`);
  lines.push('');

  // Detalle por circuito
  lines.push('## Detalle por Circuito');
  lines.push('');

  for (const [circuit, specs] of circuits) {
    const circPassed = specs.filter(s => s.status === 'passed').length;
    const circFailed = specs.filter(s => s.status === 'failed').length;
    const icon = circFailed === 0 ? '✅' : '⚠️';

    lines.push(`### ${icon} ${circuit}`);
    lines.push('');
    lines.push(`| Test | Estado | Duración |`);
    lines.push(`|------|--------|----------|`);

    for (const spec of specs) {
      const statusIcon = spec.status === 'passed' ? '✅' :
                         spec.status === 'failed' ? '❌' :
                         spec.status === 'timedOut' ? '⏱' : '⏭';
      const shortTitle = spec.title.split(' > ').pop() || spec.title;
      const dur = `${(spec.duration / 1000).toFixed(1)}s`;
      lines.push(`| ${shortTitle} | ${statusIcon} ${spec.status} | ${dur} |`);
    }

    lines.push('');

    // Si hay errores, listarlos
    const failedSpecs = specs.filter(s => s.status === 'failed');
    if (failedSpecs.length > 0) {
      lines.push(`**Errores:**`);
      for (const spec of failedSpecs) {
        const shortTitle = spec.title.split(' > ').pop() || spec.title;
        lines.push(`- **${shortTitle}**: ${spec.error?.message || 'Sin detalle'}`);
      }
      lines.push('');
    }
  }

  // Recomendaciones
  lines.push('## Observaciones');
  lines.push('');
  if (failed.length === 0) {
    lines.push('✅ Todos los tests pasaron. El sistema se comporta correctamente en los flujos testeados.');
  } else {
    lines.push(`⚠️ ${failed.length} test(s) fallaron. Revisar los detalles arriba.`);
    lines.push('');
    lines.push('**Posibles causas comunes:**');
    lines.push('- Selectores que no coinciden con la UI actual (actualizar locators)');
    lines.push('- Datos de prueba no disponibles (crear datos prerequisito)');
    lines.push('- Timing issues (aumentar waitForTimeout)');
    lines.push('- Permisos del usuario logueado (verificar rol tiene acceso a todos los módulos)');
  }

  const reportContent = lines.join('\n');
  const outputPath = path.join(__dirname, '..', 'e2e-report', 'INFORME.md');

  // Crear directorio si no existe
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(outputPath, reportContent, 'utf-8');
  console.log(`\n📋 Informe generado en: ${outputPath}\n`);
  console.log(reportContent);
}

generateReport();
