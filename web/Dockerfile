# ========== 构建阶段 ==========
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ========== 运行阶段 ==========
# 用 nginx:alpine 托管静态文件，体积仅约 20MB
FROM nginx:alpine

# 安装 envsubst 工具（用于运行时替换环境变量到配置文件）
RUN apk add --no-cache gettext

# 拷贝构建产物到 nginx 默认目录
COPY --from=build /app/dist /usr/share/nginx/html

# 拷贝运行时配置模板（容器启动时由 entrypoint.sh 替换为真实值）
COPY public/config.template.js /usr/share/nginx/html/config.template.js
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# 拷贝启动脚本
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
