# EduGlass LMS — Cloudflare Workers 24/7 Deployment Script (Windows PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "=== EduGlass LMS — Cloudflare Workers + D1 + R2 Deploy ===" -ForegroundColor Cyan

Write-Host "[1/6] Installing Wrangler CLI..." -ForegroundColor Yellow
npm install

Write-Host "[2/6] Logging in to Cloudflare (opens browser)..." -ForegroundColor Yellow
npx wrangler login

Write-Host "[3/6] Creating D1 Database & R2 Bucket (skip if already created)..." -ForegroundColor Yellow
Write-Host " -> Run: npx wrangler d1 create eduglass-lms-db" -ForegroundColor Gray
Write-Host " -> Copy the returned database_id into wrangler.toml!" -ForegroundColor Gray
Write-Host " -> Run: npx wrangler r2 bucket create eduglass-lms-videos" -ForegroundColor Gray

$confirm = Read-Host "Have you pasted your D1 database_id into wrangler.toml and created the R2 bucket? (y/n)"
if ($confirm -ne "y") {
    Write-Host "Please update wrangler.toml first, then re-run this script." -ForegroundColor Yellow
    exit 0
}

Write-Host "[4/6] Setting production JWT secret (EDUGLASS_SECRET_KEY)..." -ForegroundColor Yellow
npx wrangler secret put EDUGLASS_SECRET_KEY

Write-Host "[5/6] Applying D1 migrations & seed data..." -ForegroundColor Yellow
npm run db:migrate:remote
npm run db:seed:remote

Write-Host "[6/6] Deploying EduGlass LMS to Cloudflare Workers (24/7)..." -ForegroundColor Green
npm run deploy

Write-Host "`nDone! Your EduGlass LMS is now live 24/7 on Cloudflare Workers!" -ForegroundColor Green
