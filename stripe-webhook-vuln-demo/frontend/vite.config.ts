import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/vuln': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/vuln/, '')
      },
      '/api/fixed': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fixed/, '')
      },
      // 通用代理，用于绕过跨域限制发送给自定义站点
      '/api/proxy': {
        target: 'http://localhost', // 这里的 target 会在 proxy.on('proxyReq') 中被动态覆盖
        changeOrigin: true,
        secure: false, // 忽略 HTTPS 证书验证
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // 获取前端传递过来的实际目标 URL（放在 header 中）
            const targetUrlStr = req.headers['x-target-url'] as string;
            
            if (targetUrlStr) {
              try {
                const targetUrl = new URL(targetUrlStr);
                
                // 动态修改代理请求的主机名、端口和路径
                // @ts-ignore
                proxyReq.host = targetUrl.hostname;
                // @ts-ignore
                if (targetUrl.port) proxyReq.port = targetUrl.port;
                // @ts-ignore
                proxyReq.path = targetUrl.pathname + targetUrl.search;
                
                // 动态修改请求头中的 Host 为目标服务器的主机名，这是关键步骤，否则目标服务器可能会拒绝
                proxyReq.setHeader('Host', targetUrl.hostname);
                
                // 打印代理信息用于调试
                console.log(`[Vite Proxy] 转发请求: -> ${targetUrlStr}`);
              } catch (e) {
                console.error('[Vite Proxy] 解析 x-target-url 失败:', e);
              }
            }
          });
        }
      }
    }
  }
})
