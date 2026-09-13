#!/bin/bash
# ========== GitHub Secrets 批量设置脚本 ==========
# 用法：
#   1. 复制 secrets.example 为 secrets.local
#      cp secrets.example secrets.local
#   2. 编辑 secrets.local，填入真实值
#      vim secrets.local
#   3. 运行脚本
#      bash setup-secrets.sh
#
# 依赖：gh CLI 已登录（gh auth login）
# 注意：secrets.local 已加入 .gitignore，不会被提交

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SECRETS_FILE="$SCRIPT_DIR/secrets.local"

# 检查 gh
if ! command -v gh &>/dev/null; then
  echo "错误：找不到 gh 命令，请先安装 GitHub CLI"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "错误：GitHub CLI 未登录，请先运行 gh auth login"
  exit 1
fi

# 检查配置文件
if [ ! -f "$SECRETS_FILE" ]; then
  echo "错误：找不到 $SECRETS_FILE"
  echo "请先复制 secrets.example 为 secrets.local 并填入值："
  echo "  cp $SCRIPT_DIR/secrets.example $SECRETS_FILE"
  exit 1
fi

# 加载配置（source 进来）
# shellcheck disable=SC1090
source "$SECRETS_FILE"

# 验证必填项
REQUIRED=("SERVER_HOST" "SERVER_USERNAME" "SSH_PRIVATE_KEY")
for KEY in "${REQUIRED[@]}"; do
  VAL="${!KEY:-}"
  if [ -z "$VAL" ]; then
    echo "错误：$KEY 未配置"
    exit 1
  fi
done

echo "========================================"
echo "  设置 GitHub Secrets"
echo "  仓库: xspace0/splitter"
echo "========================================"
echo ""

# 逐个设置
declare -A SECRETS=(
  ["SERVER_HOST"]="$SERVER_HOST"
  ["SERVER_USERNAME"]="$SERVER_USERNAME"
  ["SSH_PRIVATE_KEY"]="$SSH_PRIVATE_KEY"
)

SUCCESS=0
FAILED=0

for NAME in "${!SECRETS[@]}"; do
  VAL="${SECRETS[$NAME]}"
  printf "设置 %-20s " "$NAME ..."

  # 通过 stdin 传递值，避免出现在命令行参数中
  if printf '%s' "$VAL" | gh secret set "$NAME" --repo xspace0/splitter 2>/dev/null; then
    echo "OK"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "失败"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "完成：成功 $SUCCESS 个，失败 $FAILED 个"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi

echo ""
echo "已配置的 Secrets："
gh secret list --repo xspace0/splitter
