const { spawn } = require('child_process');
const waitOn = require('wait-on');
const path = require('path');

const options = {
  resources: ['http://localhost:3001'],
  timeout: 60000, // Aumentado a 60 segundos
  interval: 1000,
  delay: 2000, // Esperar 2 segundos antes de empezar a verificar
  verbose: true, // Mostrar más información
};

console.log('⏳ Esperando a que Vite esté listo en http://localhost:3001...');
console.log('   (Esto puede tomar unos segundos mientras Vite compila)');

waitOn(options)
  .then(() => {
    console.log('✅ Servidor Vite listo, iniciando Electron...');
    
    const appDir = path.join(__dirname, '..');
    
    // Usar npx para asegurar que electron esté disponible
    const electronPath = path.join(appDir, 'node_modules', '.bin', 'electron');
    const electronCmd = process.platform === 'win32' ? `${electronPath}.cmd` : electronPath;
    
    // En Windows, usar la ruta completa entre comillas para manejar espacios
    const electronExec = process.platform === 'win32' 
      ? `"${electronCmd}"` 
      : electronCmd;
    
    const electron = spawn(electronExec, ['.', '--dev'], {
      stdio: 'inherit',
      shell: true,
      cwd: appDir,
      env: { ...process.env }
    });
    
    electron.on('error', (err) => {
      console.error('❌ Error al iniciar Electron:', err);
      console.error('   Intentando con npx electron...');
      
      // Fallback: usar npx
      const fallback = spawn('npx', ['electron', '.', '--dev'], {
        stdio: 'inherit',
        shell: true,
        cwd: appDir,
        env: { ...process.env }
      });
      
      fallback.on('error', (err2) => {
        console.error('❌ Error también con npx:', err2);
        process.exit(1);
      });
    });
    
    electron.on('exit', (code) => {
      if (code !== 0) {
        console.error(`❌ Electron salió con código ${code}`);
      }
      process.exit(code || 0);
    });
  })
  .catch((err) => {
    console.error('❌ Error esperando servidor Vite:', err.message);
    console.error('   Asegúrate de que Vite esté corriendo en el puerto 3001');
    process.exit(1);
  });
