@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Run vnlh_migracija_pk_fk_unsigned.sql through mysql.exe (correct DELIMITER handling).
REM Edit MYSQL_EXE and DB_NAME if your paths differ. ASCII-only file for cmd.exe.

set "MYSQL_EXE=C:\xampp\mysql\bin\mysql.exe"
set "DB_NAME=vnlh"
set "SQLFILE=%~dp0vnlh_migracija_pk_fk_unsigned.sql"

if not exist "!MYSQL_EXE!" (
  echo [ERROR] mysql.exe not found:
  echo   !MYSQL_EXE!
  echo Edit MYSQL_EXE in this .bat file.
  pause
  exit /b 1
)

if not exist "!SQLFILE!" (
  echo [ERROR] Script not found:
  echo   !SQLFILE!
  pause
  exit /b 1
)

echo Database: !DB_NAME!
echo Script:   !SQLFILE!
echo You will be prompted for MySQL password (e.g. root user).
echo.

"!MYSQL_EXE!" -u root -p --default-character-set=utf8mb4 "!DB_NAME!" < "!SQLFILE!"
set "RC=!ERRORLEVEL!"

echo.
if not "!RC!"=="0" (
  echo [ERROR] mysql exited with code !RC!.
  pause
  exit /b !RC!
)

echo OK - no error code from mysql. Verify schema and app.
pause
endlocal
