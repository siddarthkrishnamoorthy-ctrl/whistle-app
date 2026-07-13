# Restore the Whistle demo database on Windows.
# Usage: ./restore.ps1 [-User postgres] [-DbHost localhost] [-Port 5432]
# Decompresses the dump, then loads it (drops + recreates the `whistle` database).
param(
  [string]$User = "postgres",
  [string]$DbHost = "localhost",
  [int]$Port = 5432
)
$ErrorActionPreference = "Stop"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$gz  = Join-Path $dir "whistle-demo-db.sql.gz"
$sql = Join-Path $dir "whistle-demo-db.sql"

Write-Host "Decompressing dump…"
$in  = [System.IO.File]::OpenRead($gz)
$out = [System.IO.File]::Create($sql)
$gzs = New-Object System.IO.Compression.GZipStream($in, [System.IO.Compression.CompressionMode]::Decompress)
$gzs.CopyTo($out); $gzs.Dispose(); $out.Dispose(); $in.Dispose()

Write-Host "Loading into postgres://$User@$DbHost`:$Port (database 'whistle')…"
& psql -h $DbHost -p $Port -U $User -f $sql
Remove-Item $sql -Force
Write-Host "Done. Set backend/.env DATABASE_URL to ...@$DbHost`:$Port/whistle and start the backend."
