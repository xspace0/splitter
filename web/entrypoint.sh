#!/bin/sh
set -e

# ---------- 1. 生成运行时前端配置 ----------
# envsubst 只替换 ${API_BASE_URL}，避免误伤其他 $ 变量。
# 默认值 /api：浏览器走同源相对路径，由下方 nginx 反代转发到后端容器，
# 这样无需把后端端口暴露到公网，也不会有 HTTPS 混合内容问题。
: "${API_BASE_URL:=/api}"
export API_BASE_URL
envsubst '${API_BASE_URL}' \
  < /usr/share/nginx/html/config.template.js \
  > /usr/share/nginx/html/config.js

# ---------- 2. 生成 nginx 配置（注入后端上游地址） ----------
# 默认 http://backend-test:3000 兼容测试环境；生产用 API_UPSTREAM=http://backend-prod:3000。
# 只替换 ${API_UPSTREAM}，不动 nginx 自身的 $host / $uri 等变量。
: "${API_UPSTREAM:=http://backend-test:3000}"
export API_UPSTREAM
envsubst '${API_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "Config injected: API_BASE_URL=${API_BASE_URL}  API_UPSTREAM=${API_UPSTREAM}"

# 快速自检：配置语法错误时立即失败，避免容器起来但全线 502
nginx -t

# 启动 nginx（前台运行，否则容器会立即退出）
exec nginx -g 'daemon off;'
