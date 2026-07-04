import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import type { Plugin } from 'vite';

// 动态 AI 代理插件 — 解决浏览器 CORS 跨域问题
// 前端请求 /api/ai-proxy，服务器读取 X-Target-URL 头转发到实际 API
function aiProxyPlugin(): Plugin {
  return {
    name: 'ai-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai-proxy', async (req, res) => {
        // 收集请求体
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const body = Buffer.concat(chunks);

        // 从头部获取实际目标 URL
        const targetUrl = req.headers['x-target-url'] as string;
        if (!targetUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing X-Target-URL header' }));
          return;
        }

        try {
          // 服务器端转发请求（无 CORS 限制）
          const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': req.headers['authorization'] as string,
            },
            body: body.toString(),
          });

          const responseText = await response.text();

          res.writeHead(response.status, {
            'Content-Type': response.headers.get('content-type') || 'application/json',
          });
          res.end(responseText);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Proxy error: ${message}` }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: 'hidden',
  },
  server: {
    proxy: {
      '/api/supabase': {
        target: 'https://imemwbgtxnkfodncfgal.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/supabase/, ''),
      },
      // Yahoo Finance 历史行情代理（解决浏览器 CORS）
      // 用法: /api/yahoo/v8/finance/chart/EURUSD=X?interval=1d&range=6mo
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Joel-TradingJournal/1.0)',
          'Accept': 'application/json',
        },
      },
    }
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths(),
    aiProxyPlugin(),
  ],
})
