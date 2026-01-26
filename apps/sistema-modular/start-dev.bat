@echo off
echo ========================================
echo   AGS Sistema Modular - Iniciando
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Iniciando servidor Vite...
start "Vite Dev Server" cmd /k "npm run dev"

echo.
echo Esperando 8 segundos para que Vite compile...
timeout /t 8 /nobreak >nul

echo.
echo [2/2] Iniciando Electron...
start "Electron" cmd /k "npm run electron:dev"

echo.
echo ========================================
echo   Procesos iniciados:
echo   - Vite: Primera ventana
echo   - Electron: Segunda ventana
echo ========================================
echo.
echo Presiona cualquier tecla para cerrar este script...
pause >nul
