@echo off
setlocal
chcp 65001 >nul
rem ============================================================
rem  subir_wmap.bat  -  Sube TODO el contenido de esta carpeta al repositorio GitHub WMAP
rem  y deja la app lista: https://jamanteiga.github.io/WMAP/
rem  Uso: doble clic. La primera vez Git Credential Manager abrira el navegador para iniciar sesion.
rem ============================================================
set "CARPETA=C:\Users\jaman\Documents\PROYECTOS\WMAP"
set "REPO=https://github.com/jamanteiga/WMAP.git"
set "RAMA=main"

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git no esta instalado o no esta en el PATH. Instalalo desde https://git-scm.com
  pause & exit /b 1
)

cd /d "%CARPETA%" || (echo [ERROR] No existe la carpeta %CARPETA% & pause & exit /b 1)

if not exist ".git" (
  echo Inicializando repositorio local...
  git init -b %RAMA% || goto :error
  git remote add origin %REPO% || goto :error
  git fetch origin %RAMA% || goto :error
  rem Alinea el historial con el remoto SIN tocar tus ficheros locales
  git reset origin/%RAMA% >nul 2>&1
)

git remote set-url origin %REPO%
git config user.name  >nul 2>&1 || git config user.name  "jamanteiga"
git config user.email >nul 2>&1 || git config user.email "jamanteiga@users.noreply.github.com"

echo Sincronizando con GitHub...
git add -A || goto :error
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "WMAP: actualizacion %date% %time:~0,8%" || goto :error
) else (
  echo No hay cambios locales que subir.
)

git pull --rebase --autostash origin %RAMA% || goto :error
git push -u origin %RAMA% || goto :error

rem --- Activa GitHub Pages (solo si tienes GitHub CLI; si ya esta activo, lo ignora) ---
where gh >nul 2>&1
if not errorlevel 1 (
  gh api -X POST repos/jamanteiga/WMAP/pages -f "source[branch]=%RAMA%" -f "source[path]=/" >nul 2>&1
)

echo.
echo [OK] Subido a %REPO%
echo App lista en: https://jamanteiga.github.io/WMAP/
echo (Si da 404, activa Pages una vez: GitHub ^> WMAP ^> Settings ^> Pages ^> Deploy from branch ^> main ^> / root)
pause
exit /b 0

:error
echo.
echo [ERROR] Algo ha fallado (ver mensajes arriba). Si hay conflictos: git status
pause
exit /b 1
