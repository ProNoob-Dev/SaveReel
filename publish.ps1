#!/usr/bin/env pwsh
# publish.ps1 - Create/push the SaveReel repo to GitHub and print the Cloudflare deploy URL.
#
# Requires the GitHub CLI (gh):  https://cli.github.com
# Authenticate once with:       gh auth login
#
# Because PowerShell script execution is usually disabled, run it as:
#   powershell -ExecutionPolicy Bypass -File ./publish.ps1
# or (in a terminal already on this repo):
#   Set-ExecutionPolicy -Scope Process Bypass; ./publish.ps1
#
# Options:
#   -RepoName   default "savereel"
#   -Visibility default "public"   (alternates: "private")

[CmdletBinding()]
param(
    [string]$RepoName = "savereel",
    [ValidateSet("public", "private")]
    [string]$Visibility = "public"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# --- Preconditions ---------------------------------------------------------
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "[fail] GitHub CLI 'gh' is not installed." -ForegroundColor Red
    Write-Host "       Install it from https://cli.github.com then run:  gh auth login"
    exit 1
}

try { $login = gh api user -q .login } catch { $login = "" }
if (-not $login) {
    Write-Host "[fail] Not authenticated with GitHub. Run:  gh auth login" -ForegroundColor Red
    exit 1
}

if (-not (git config user.name)) {
    Write-Host "[warn] git user.name is unset - commits will use the default identity. Consider setting git config user.name / user.email." -ForegroundColor Yellow
}

# --- Fix the deploy-button placeholder in the README (idempotent) -----------
$readme = Join-Path $root "README.md"
$readmeChanged = $false
if (Test-Path $readme) {
    $content = Get-Content $readme -Raw
    if ($content -match "YOUR_USERNAME") {
        $content = $content -replace "YOUR_USERNAME", $login
        Set-Content -Path $readme -Value $content -NoNewline -Encoding utf8
        $readmeChanged = $true
        Write-Host "[*] Updated 'YOUR_USERNAME' -> '$login' in README.md"
    }
}
if ($readmeChanged) {
    git add README.md
    git commit -m "Point README deploy button at the live repository" --no-gpg-sign
}

# --- Repo ------------------------------------------------------------------
Write-Host "[*] Using GitHub account '$login'. Repo: '$login/$RepoName'."
$full = "$login/$RepoName"

$existing = gh repo view $full --json name -q .name 2>$null
if ($existing) {
    Write-Host "[*] Repo '$full' already exists - skipping creation."
}
else {
    Write-Host "[*] Creating $Visibility repo '$full'..."
    gh repo create $full --$Visibility
}

# --- Remote -----------------------------------------------------------------
$remoteUrl = ("https://github.com/{0}.git" -f $full)
if (-not (git remote get-url origin 2>$null)) {
    Write-Host "[*] Adding remote 'origin' -> $remoteUrl"
    git remote add origin $remoteUrl
}
else {
    Write-Host "[*] Remote 'origin' already set; updating to $remoteUrl"
    git remote set-url origin $remoteUrl
}

# --- Push -------------------------------------------------------------------
Write-Host "[*] Pushing 'main' to origin..."
git push -u origin main

# --- Result ----------------------------------------------------------------
$deployUrl = "https://deploy.workers.cloudflare.com/?url=https://github.com/$full"
Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  Repository : https://github.com/$full" -ForegroundColor Green
Write-Host "  Deploy btn: $deployUrl" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
