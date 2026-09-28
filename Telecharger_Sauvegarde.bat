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
echo.CANCELED [admin builder 4/4] RUN npm run build                        30.1s
 => [backend builder 6/7] RUN npx prisma generate --schema=prisma/schema  17.4s
 => ERROR [backend builder 7/7] RUN npm run build                         11.8s
------
 > [backend builder 7/7] RUN npm run build:
1.752
1.752 > backend@1.0.0 build
1.752 > tsc
1.752
11.43 src/modules/products/products.controller.ts(86,122): error TS2353: Object literal may only specify known properties, and 'misEnAvantSousCat' does not exist in type '{ nom: string; reference: string; description?: string; expirationDate?: Date; prix: number; prixAchat?: number; tva?: number; remise?: number; stock?: number; images?: string[]; video?: string; motsCles?: string[]; ... 4 more ...; marqueId: number; }'.
------
[+] up 0/3
 ⠙ Image rzmedical-web     Building                                        32.1s
 ⠙ Image rzmedical-backend Building                                        32.1s
 ⠙ Image rzmedical-admin   Building                                        32.1s
Dockerfile:15

--------------------

  13 |     ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

  14 |     RUN npx prisma generate --schema=prisma/schema.prisma

  15 | >>> RUN npm run build

  16 |

  17 |     # Production image

--------------------

target backend: failed to solve: process "/bin/sh -c npm run build" did not complete successfully: exit code: 2

ubuntu@vps-b2b92c9
pause
