param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

git status --short

git add .

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "Update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

$hasStagedChanges = git diff --cached --quiet; $LASTEXITCODE -ne 0
if (-not $hasStagedChanges) {
  Write-Host "No changes to commit."
  exit 0
}

git commit -m $Message
git push
