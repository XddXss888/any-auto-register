# Stripe Webhook 空密钥签名伪造漏洞测试靶场

这是一个用于演示和测试 Stripe Webhook 签名伪造漏洞（零元充值漏洞）的完整靶场。包含一个存在漏洞的后端环境、一个安全修复后的后端环境，以及一个现代化的交互式前端测试 UI。

## 漏洞原理 (空密钥 HMAC 伪造)
当服务端的 `StripeWebhookSecret` 环境变量未正确配置或意外为空字符串 `""` 时，攻击者可以利用空字符串对伪造的 JSON Payload 进行 HMAC-SHA256 计算。由于算法特性，这会生成一个“合法”的签名，导致服务器验签通过并错误地执行业务逻辑（如充值发货）。

## 项目结构
- `/backend`: 包含存在漏洞的 Go 服务端 (`server.go`)、安全修复后的服务端 (`server_fixed.go`) 以及 Python CLI 攻击脚本 (`attack.py`)。
- `/frontend`: 包含一个 React + Vite 构建的交互式测试面板，支持跨域 (CORS) 代理，可以一键向本地靶机或外部自定义站点发送伪造请求。

## 如何运行与测试

### 1. 启动后端靶机
确保您已安装 [Go 语言环境](https://go.dev/doc/install)。

**启动漏洞靶机 (端口 8080):**
```bash
cd backend
go run server.go
```

**启动安全靶机 (端口 8081):**
```bash
cd backend
STRIPE_WEBHOOK_SECRET="whsec_real_secret_key_12345" go run server_fixed.go
```

### 2. 启动前端测试 UI
确保您已安装 Node.js。

```bash
cd frontend
npm install
npm run dev
```

启动后，在浏览器中访问 `http://localhost:5173/`。您可以在可视化界面中选择目标、配置伪造参数，并点击“执行攻击”观察实时的攻防反馈。

### 3. CLI 测试方式 (可选)
如果您更喜欢使用命令行：
```bash
cd backend
pip install requests
python3 attack.py
```

## ⚠️ 安全警告
**未经授权对第三方网站进行漏洞探测、扫描或攻击是违法行为。**
本项目提供的代码和工具仅供安全研究、教学以及开发者自查自测使用。请务必在合法合规且获得授权的环境下使用。
