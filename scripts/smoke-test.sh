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
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
  if [ "$code" != "$expected" ]; then
    echo "FAIL: $name - $url -> $code (expected $expected)"
    FAIL=$((FAIL + 1))
  else
    echo "PASS: $name ($code)"
  fi
}

# 1. 前端首页能访问
check "$FRONTEND/" "Frontend Home" "200"

# 2. 后端健康检查通过
check "$BACKEND/health" "Backend Health" "200"

# 3. 未登录访问受保护接口应返回 401
check "$BACKEND/api/v1/regions" "Auth Guard" "401"

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: $FAIL test(s) failed!"
  exit 1
fi

echo "RESULT: All smoke tests passed."
