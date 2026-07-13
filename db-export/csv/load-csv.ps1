# Load the Whistle core test data from CSV into an EXISTING (migrated) `whistle` schema (Windows).
# Usage: ./load-csv.ps1 [-DbHost localhost] [-Port 5432] [-User postgres] [-Db whistle]
param(
  [string]$DbHost = "localhost",
  [int]$Port = 5432,
  [string]$User = "postgres",
  [string]$Db = "whistle"
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
Write-Host "Loading CSVs into database '$Db' @ $DbHost`:$Port (user $User)…"
& psql -h $DbHost -p $Port -U $User -d $Db -f load-csv.sql
Write-Host "Done."
