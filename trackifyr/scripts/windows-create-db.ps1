# Creates database "trackifyr" if missing (Windows + local PostgreSQL).
# Usage:
#   $env:PGPASSWORD = 'your-postgres-password'
#   .\scripts\windows-create-db.ps1

$ErrorActionPreference = 'Stop'
if (-not $env:PGPASSWORD) {
  Write-Host 'Set PGPASSWORD first, e.g.: $env:PGPASSWORD = ''your postgres password'''
  exit 1
}

$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
if (-not (Test-Path $psql)) {
  $alt = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($alt) { $psql = $alt.FullName }
}
if (-not (Test-Path $psql)) {
  Write-Host 'psql.exe not found under C:\Program Files\PostgreSQL\'
  exit 1
}

$exists = & $psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='trackifyr'" 2>&1
if ($exists -match '^\s*1\s*$') {
  Write-Host 'Database trackifyr already exists.'
  exit 0
}

& $psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE trackifyr;'
Write-Host 'Created database trackifyr. Set DATABASE_URL in .env and run npm run dev.'
