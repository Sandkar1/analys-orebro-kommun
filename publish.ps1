param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

git status --short

git add -A

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "Update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "No changes to commit."
  git push
  exit $LASTEXITCODE
}
if ($LASTEXITCODE -ne 1) {
  throw "Could not check staged changes."
}

git commit -m $Message
git push
