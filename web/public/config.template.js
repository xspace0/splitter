// 运行时配置模板 —— 容器启动时 entrypoint.sh 会把 ${API_BASE_URL} 替换为真实值
// 这个文件会在容器启动后变成 config.js，前端通过 window.__APP_CONFIG__ 读取
window.__APP_CONFIG__ = {
  API_BASE_URL: "${API_BASE_URL}",
};
