@echo off
setlocal
cd /d "%~dp0.."
echo [trackifyr] Installing Python tracking dependencies into the interpreter used by Electron (py -3^)...
py -3 -m pip install -r requirements.txt
if errorlevel 1 (
  echo [trackifyr] pip install failed.
  exit /b 1
)
echo [trackifyr] Done. Optional: set TRACKIFYR_PYTHON to a venv python.exe if you use a virtual environment.
endlocal
