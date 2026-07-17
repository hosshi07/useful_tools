@echo off
chcp 65001 > nul
echo ===================================================
echo   MP4 to MP3 コンバーター (Audioify) を起動しています...
echo   ブラウザが自動的に開くまでしばらくお待ちください。
echo ===================================================
echo.
call npm run dev -- --open
pause
