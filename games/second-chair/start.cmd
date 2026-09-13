@echo off
setlocal
cd /d "%~dp0"
set "GAME_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "GAME_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not "%GAME_NODE%"=="node" if not exist "%GAME_NODE%" (
    echo Node.js is required. See README.md.
    pause
    exit /b 1
)
echo Open http://127.0.0.1:4173 in your browser.
"%GAME_NODE%" scripts\serve.mjs
pause
