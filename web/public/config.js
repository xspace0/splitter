// 本地开发占位配置。
// 生产镜像由 entrypoint.sh 从 config.template.js 生成带真实地址的 config.js。
// 这里保持空串，request.ts 会回退到 '/api'，由 vite.config.ts 的 devServer proxy 转发到 localhost:3000。
window.__CONFIG__ = {
  API_BASE_URL: '',
};
