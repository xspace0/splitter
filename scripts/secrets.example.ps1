# ========== GitHub Secrets 本地配置模板 ==========
# 使用步骤：
#   1. 把本文件复制一份，改名为 secrets.local.ps1
#   2. 把下面的占位值替换成你自己的真实值
#   3. 运行 .\setup-secrets.ps1 自动上传
#
# 重要：secrets.local.ps1 已加入 .gitignore，不会被提交到仓库
# 千万别把真实密钥提交到 Git！

# 服务器公网 IP（例如 "123.45.67.89"）
$SERVER_HOST = "YOUR_SERVER_IP"

# SSH 登录用户名（一般是 "root"）
$SERVER_USERNAME = "root"

# SSH 私钥内容（完整的，包括 -----BEGIN 和 -----END 行）
# 注意 PowerShell 多行字符串用 @" ... "@
$SSH_PRIVATE_KEY = @"
-----BEGIN OPENSSH PRIVATE KEY-----
把你的私钥内容粘贴在这里
替换掉这几行
保留 BEGIN 和 END 行
-----END OPENSSH PRIVATE KEY-----
"@
