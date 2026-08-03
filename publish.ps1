param(
  [string]$Message = "",
  [string]$Remote = "origin"
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

$remoteUrl = Invoke-GitCapture -Arguments @("remote", "get-url", $Remote)
Write-Host "Publishing $branch to $Remote ($remoteUrl)..."
Write-Host "Fetching the latest remote changes..."
$null = Invoke-GitCapture -Arguments @("fetch", "--prune", $Remote)

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

$remoteRef = "$Remote/$branch"
$remoteRefExists = $true
try {
  $null = Invoke-GitCapture -Arguments @("show-ref", "--verify", "--quiet", "refs/remotes/$Remote/$branch")
}
catch {
  $remoteRefExists = $false
}

if ($remoteRefExists) {
  $counts = Invoke-GitCapture -Arguments @("rev-list", "--left-right", "--count", "$remoteRef...HEAD")
  $parts = @($counts -split "\s+" | Where-Object { $_ -ne "" })
  $behind = if ($parts.Count -ge 1) { [int]$parts[0] } else { 0 }
  $ahead = if ($parts.Count -ge 2) { [int]$parts[1] } else { 0 }

  if ($behind -gt 0) {
    Write-Host "The remote branch is $behind commit(s) ahead. Rebasing $ahead local commit(s)..."
    try {
      $null = Invoke-GitCapture -Arguments @("rebase", $remoteRef)
      Write-Host "Local commits were successfully replayed on top of $remoteRef."
    }
    catch {
      $rebaseError = $_.Exception.Message
      $previousPreference = $ErrorActionPreference
      $ErrorActionPreference = "Continue"
      try {
        $null = & git -C $RepoRoot rebase --abort 2>&1
      }
      finally {
        $ErrorActionPreference = $previousPreference
      }
      throw "Automatic synchronization with $remoteRef produced a conflict. The rebase was aborted and local commits were preserved. Resolve the remote changes manually, then run publish.ps1 again.`n$rebaseError"
    }
  }
}

$upstream = Invoke-GitCapture -Arguments @("for-each-ref", "--format=%(upstream:short)", "refs/heads/$branch")
$pushArguments = @("push", "--porcelain")
if ([string]::IsNullOrWhiteSpace($upstream)) {
  $pushArguments += "--set-upstream"
}
$pushArguments += @($Remote, "HEAD:refs/heads/$branch")
$null = Invoke-GitCapture -Arguments $pushArguments

$localCommit = Invoke-GitCapture -Arguments @("rev-parse", "HEAD")
$remoteLine = Invoke-GitCapture -Arguments @("ls-remote", "--heads", $Remote, "refs/heads/$branch")
$remoteCommit = if ([string]::IsNullOrWhiteSpace($remoteLine)) { "" } else { @($remoteLine -split "\s+")[0] }
if ($remoteCommit -ne $localCommit) {
  throw "Push completed without an error, but verification failed. Local HEAD is $localCommit while $Remote/$branch is $remoteCommit."
}

Write-Host "Published and verified commit $($localCommit.Substring(0, 7)) on $Remote/$branch."
