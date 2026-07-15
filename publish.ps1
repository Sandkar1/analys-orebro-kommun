param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git is not installed or is not available in PATH."
}

$repoResult = & git -C $PSScriptRoot rev-parse --show-toplevel 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "publish.ps1 is not inside a Git repository.`n$($repoResult -join "`n")"
}
$RepoRoot = ([string]($repoResult | Select-Object -First 1)).Trim()

function Invoke-GitCapture {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & git -C $RepoRoot @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousPreference
  }

  $text = ($output | ForEach-Object { [string]$_ }) -join "`n"
  if ($exitCode -ne 0) {
    $command = "git " + ($Arguments -join " ")
    throw "$command failed with exit code $exitCode.`n$text"
  }
  return $text.Trim()
}

$branch = Invoke-GitCapture -Arguments @("branch", "--show-current")
if ([string]::IsNullOrWhiteSpace($branch)) {
  throw "Cannot publish from a detached HEAD. Check out a branch first."
}

$changes = Invoke-GitCapture -Arguments @("status", "--porcelain=v1", "--untracked-files=all")
$changeCount = @($changes -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count

if ($changeCount -gt 0) {
  Write-Host "Staging all $changeCount changed path(s)..."
  $null = Invoke-GitCapture -Arguments @("add", "--all", "--", ".")

  $staged = Invoke-GitCapture -Arguments @("diff", "--cached", "--name-only")
  if ([string]::IsNullOrWhiteSpace($staged)) {
    throw "Git found changes, but none could be staged. Check .gitignore and submodule state."
  }

  if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = "Update $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  }

  $null = Invoke-GitCapture -Arguments @("commit", "-m", $Message)
  $commit = Invoke-GitCapture -Arguments @("rev-parse", "--short", "HEAD")
  Write-Host "Created commit $commit with all staged changes."

  $remaining = Invoke-GitCapture -Arguments @("status", "--porcelain=v1", "--untracked-files=all")
  if (-not [string]::IsNullOrWhiteSpace($remaining)) {
    throw "Files changed during the commit and were not included. Review git status before publishing."
  }
}
else {
  Write-Host "No local changes to commit."
}

$upstream = Invoke-GitCapture -Arguments @("for-each-ref", "--format=%(upstream:short)", "refs/heads/$branch")
if ([string]::IsNullOrWhiteSpace($upstream)) {
  $remote = "origin"
  $null = Invoke-GitCapture -Arguments @("remote", "get-url", $remote)
  $null = Invoke-GitCapture -Arguments @("push", "--porcelain", "--set-upstream", $remote, $branch)
  Write-Host "Pushed $branch and set upstream to $remote/$branch."
}
else {
  $null = Invoke-GitCapture -Arguments @("push", "--porcelain")
  Write-Host "Pushed $branch to $upstream."
}
