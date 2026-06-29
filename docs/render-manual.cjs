const path = require('path');
const { chromium } = require('c:/Users/Evigna/Desktop/Ags plataform/apps/sistema-modular/node_modules/@playwright/test');

(async () => {
  const htmlPath = 'file:///' + path.resolve(__dirname, 'manual-biblioteca-tablas.html').replace(/\\/g, '/');
  const out = path.resolve(__dirname, 'Manual-Biblioteca-de-Tablas.pdf');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(htmlPath, { waitUntil: 'networkidle' });
  await page.pdf({
    path: out,
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%; font-size:7pt; color:#94a3b8; font-family:monospace; padding:0 16mm; display:flex; justify-content:space-between;">
        <span>Biblioteca de Tablas — Manual operativo</span>
        <span>AGS Analítica · <span class="pageNumber"></span>/<span class="totalPages"></span></span>
      </div>`,
  });
  await browser.close();
  console.log('PDF generado en:', out);
})().catch(e => { console.error(e); process.exit(1); });
