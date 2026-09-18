param(
  [bool]$DryRun = $false,
  [int]$BatchSize = 25
)

$FnUrl = 'https://xcaktvlosjsaxcntxbyf.supabase.co/functions/v1/backfill-stuck-onboarding'
$Token = 'PVrH_pUOJ2a3YCmo-b1oI8vs0yiAiYNL'
$IdsJson = Join-Path $PSScriptRoot 'backfill-batches.json'

$ids = Get-Content $IdsJson -Raw | ConvertFrom-Json
Write-Host "Total IDs: $($ids.Count) — batch size: $BatchSize — dry_run: $DryRun"

$tCandidates = 0
$tGeocodeFailed = 0
$tUpdated = 0
$tUpdateFailed = 0

for ($i = 0; $i -lt $ids.Count; $i += $BatchSize) {
  $end = [Math]::Min($i + $BatchSize, $ids.Count)
  $batch = $ids[$i..($end - 1)]
  $body = @{ profile_ids = $batch; dry_run = $DryRun } | ConvertTo-Json -Compress -Depth 5

  $batchNum = [Math]::Floor($i / $BatchSize) + 1
  Write-Host ""
  Write-Host "--- batch $batchNum (ids $i..$($end-1), count $($batch.Count)) ---"

  try {
    $resp = Invoke-RestMethod -Uri $FnUrl -Method POST `
      -Headers @{ 'x-backfill-token' = $Token; 'content-type' = 'application/json' } `
      -Body $body `
      -TimeoutSec 120
    $resp | ConvertTo-Json -Compress | Write-Host
    $tCandidates += [int]$resp.candidates
    $tGeocodeFailed += [int]$resp.geocode_failed
    $tUpdated += [int]$resp.updated
    $tUpdateFailed += [int]$resp.update_failed
  } catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  }
  Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "=========================================="
Write-Host "TOTAL: candidates=$tCandidates updated=$tUpdated geocode_failed=$tGeocodeFailed update_failed=$tUpdateFailed"
