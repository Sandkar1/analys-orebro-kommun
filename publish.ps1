param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

git status --short

git add .

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "Update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "No changes to commit."
  exit 0
}
if ($LASTEXITCODE -ne 1) {
  throw "Could not check staged changes."
}

git commit -m $Message
git push
