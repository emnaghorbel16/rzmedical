@echo off
echo ==================================================
echo TELECHARGEMENT DE LA SAUVEGARDE RZMEDICAL...
echo ==================================================
echo.

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set DATE_STR=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%h%datetime:~10,2%

set BACKUP_DIR=%USERPROFILE%\Desktop\Sauvegardes_RZMedical\%DATE_STR%
mkdir "%BACKUP_DIR%" 2>nul

echo Attention : Le mot de passe de votre serveur OVH va etre demande.
echo --------------------------------------------------
echo.
echo [1/2] Preparation et telechargement de la base de donnees...
ssh ubuntu@vps-b2b92c92.vps.ovh.net "docker exec rzmedical_db_prod pg_dump -U postgres -d rzmedical_db -F c > /tmp/rzmedical_db.dump"
scp ubuntu@vps-b2b92c92.vps.ovh.net:/tmp/rzmedical_db.dump "%BACKUP_DIR%\rzmedical_db.dump"

echo.
echo [2/2] Telechargement des images (volume Docker)...
ssh ubuntu@vps-b2b92c92.vps.ovh.net "docker cp rzmedical_backend_prod:/app/uploads /tmp/uploads_backup && tar -czf /tmp/uploads.tar.gz -C /tmp uploads_backup && rm -rf /tmp/uploads_backup"
scp ubuntu@vps-b2b92c92.vps.ovh.net:/tmp/uploads.tar.gz "%BACKUP_DIR%\uploads.tar.gz"

echo.
echo ==================================================
echo TERMINE !
echo ==================================================
echo Vos donnees sont sauvees en securite sur votre Bureau dans :
echo %BACKUP_DIR%
echo.
pause
