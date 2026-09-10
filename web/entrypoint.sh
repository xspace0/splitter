#!/bin/sh
set -e

# envsubst 把 config.template.js 中的 ${API_BASE_URL} 替换为环境变量值
# 只替换这一个变量，避免误伤 nginx 配置中的其他 $ 变量
envsubst '${API_BASE_URL}' \
  < /usr/share/nginx/html/config.template.js \
  > /usr/share/nginx/html/config.js

echo "Config injected: API_BASE_URL=${API_BASE_URL}"

# 启动 nginx（前台运行，否则容器会立即退出）
exec nginx -g 'daemon off;'
