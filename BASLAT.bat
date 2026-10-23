@echo off
title PFAS-Sentinel - Xylem Vue Smart Water Engine
cd /d "%~dp0"
echo ===============================================================================
echo   PFAS-Sentinel (Xylem Global Student Innovation Challenge 2026) Baslatiliyor...
echo   Tarayicinizda http://localhost:5173/ adresi otomatik acilacaktir.
echo ===============================================================================
start "" "http://localhost:5173/"
call npm.cmd run dev -- --port 5173
pause
