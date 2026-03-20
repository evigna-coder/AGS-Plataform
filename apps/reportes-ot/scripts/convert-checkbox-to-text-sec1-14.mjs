/**
 * Convierte celdas type "checkbox" a type "text" con value "" solo en secciones sec_1..sec_14.
 * Uso: node scripts/convert-checkbox-to-text-sec1-14.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(__dirname, '../data/calif-operacion-hplc.json');

const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

const sections = data.template?.sections ?? [];
let count = 0;

for (const section of sections) {
  const match = section.id?.match(/^sec_(\d+)$/);
  const num = match ? parseInt(match[1], 10) : null;
  if (num == null || num > 14) continue;

  for (const row of section.rows ?? []) {
    for (const cell of row.cells ?? []) {
      if (cell.type === 'checkbox') {
        cell.type = 'text';
        cell.value = '';
        count++;
      }
    }
  }
}

fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Convertidas ${count} celdas de checkbox a text en sec_1..sec_14.`);
