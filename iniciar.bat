@echo off
REM Sobe o Postgres (Docker) e o servidor de desenvolvimento na porta 3100.
cd /d "%~dp0"
docker compose up -d db
echo.
echo Painel: http://painel.localhost:3100
echo Blogs:  http://bolsoemdia.localhost:3100  (cliquecerto, larpratico, stackwise, leafycorner)
echo.
start "" http://painel.localhost:3100
npm run dev
