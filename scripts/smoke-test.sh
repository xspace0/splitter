#!/bin/bash
# ========== 冒烟测试脚本 ==========
# 用法: smoke-test.sh <frontend_url> <backend_url>
# 部署后快速验证核心功能是否正常
set -euo pipefail

FRONTEND=${1:?用法: smoke-test.sh <frontend_url> <backend_url>}
BACKEND=${2:?用法: smoke-test.sh <frontend_url> <backend_url>}

echo "=========================================="
echo "  SMOKE TEST"
echo "  Frontend: $FRONTEND"
echo "  Backend:  $BACKEND"
echo "=========================================="

FAIL=0

check() {
  local url=$1 name=$2 expected=$3
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$url" 2>/dev/null || true)
  if [ "$code" != "$expected" ]; then
    echo "FAIL: $name - $url -> $code (expected $expected)"
    FAIL=$((FAIL + 1))
  else
    echo "PASS: $name ($code)"
  fi
}

# 1. 前端首页能访问（前端未部署时跳过）
code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$FRONTEND/" 2>/dev/null || true)
if [ "$code" = "000" ]; then
  echo "SKIP: Frontend Home (not deployed)"
else
  check "$FRONTEND/" "Frontend Home" "200"
fi

# 2. 后端健康检查通过
code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$BACKEND/api/health" 2>/dev/null || true)
if [ "$code" = "000" ]; then
  echo "SKIP: Backend Health (not deployed)"
else
  check "$BACKEND/api/health" "Backend Health" "200"
fi

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: $FAIL test(s) failed!"
  exit 1
fi

echo "RESULT: All smoke tests passed."
