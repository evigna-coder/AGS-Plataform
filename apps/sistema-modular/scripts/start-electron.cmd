@echo off
echo Esperando a que Vite esté listo...
timeout /t 3 /nobreak >nul
:wait
curl -s http://localhost:3001 >nul 2>&1
if errorlevel 1 (
  echo Esperando servidor Vite...
  timeout /t 2 /nobreak >nul
  goto wait
)
echo Servidor Vite listo, iniciando Electron...
electron . --dev
