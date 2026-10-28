@echo off
title PFAS-Sentinel GitHub Yukleyici
cd /d "%~dp0"
echo ===============================================================================
echo   PFAS-Sentinel GitHub'a Hazirlaniyor ve Yukleniyor...
echo   Hedef Repo: https://github.com/YSerhatTemel/pfas-sentinel.git
echo   (Eger GitHub giris penceresi acilirsa "Sign in with your browser" secin)
echo ===============================================================================
git add .
git commit -m "Upgrade PFAS-Sentinel to v2.7: genuine PINN PDE solver, non-circular EIS & literature validation"
git push -u origin main
echo.
echo ===============================================================================
echo   Islem tamamlandi!
echo ===============================================================================
pause
