# ========== GitHub Secrets 批量设置脚本 ==========
# 用法：
#   1. 把本文件和 secrets.local.ps1 放在同一目录
#   2. 编辑 secrets.local.ps1，填入你的真实值
#   3. 在 PowerShell 中运行：.\setup-secrets.ps1
#   4. 脚本会读取 secrets.local.ps1 并上传到 GitHub Secrets
#
# 注意：secrets.local.ps1 已加入 .gitignore，不会被提交

$ErrorActionPreference = "Stop"

# 检查 gh 是否已登录
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误：GitHub CLI 未登录，请先运行 gh auth login" -ForegroundColor Red
    exit 1
}

# 加载本地配置
$configFile = Join-Path $PSScriptRoot "secrets.local.ps1"
if (-not (Test-Path $configFile)) {
    Write-Host "错误：找不到 $configFile" -ForegroundColor Red
    Write-Host "请先复制 secrets.example.ps1 为 secrets.local.ps1 并填入值"
    exit 1
}

. $configFile

# 验证必填项
$required = @("SERVER_HOST", "SERVER_USERNAME", "SSH_PRIVATE_KEY")
foreach ($key in $required) {
    $val = Get-Variable -Name $key -ValueOnly -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($val)) {
        Write-Host "错误：$key 未配置" -ForegroundColor Red
        exit 1
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  设置 GitHub Secrets"
Write-Host "  仓库: xspace0/splitter"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 要设置的 secrets 列表
$secrets = @{
    "SERVER_HOST"      = $SERVER_HOST
    "SERVER_USERNAME"  = $SERVER_USERNAME
    "SSH_PRIVATE_KEY"  = $SSH_PRIVATE_KEY
}

foreach ($entry in $secrets.GetEnumerator()) {
    $name = $entry.Key
    $value = $entry.Value

    Write-Host "设置 $name ... " -NoNewline

    # 通过管道传递值，避免出现在命令行参数中
    $value | gh secret set $name --repo xspace0/splitter 2>&1 | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK" -ForegroundColor Green
    } else {
        Write-Host "失败" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "全部 Secrets 设置完成！" -ForegroundColor Green
Write-Host ""
Write-Host "验证：gh secret list --repo xspace0/splitter"
gh secret list --repo xspace0/splitter
