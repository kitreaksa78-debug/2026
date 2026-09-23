import http from "http";
import { spawn } from "child_process";
import express from "express";
import { createServer as createViteServer } from "vite";
const app = express();
const PORT = 3e3;
const BACKEND_PORT = 8001;
function ensureBackendRunning() {
  const checkReq = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
  });
  checkReq.on("error", () => {
    console.log("[Proxy] Starting FastAPI backend on port", BACKEND_PORT);
    const backendProcess = spawn(
      "/usr/bin/python3",
      ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
      {
        cwd: "/app/applet/video-translator/backend",
        env: {
          ...process.env,
          PYTHONPATH: "/app/applet/video-translator/backend",
          STORAGE_PATH: "/data",
          TEMP_PATH: "/data/temp",
          REDIS_URL: "redis://127.0.0.1:6379/0",
          LIBRETRANSLATE_URL: "http://127.0.0.1:5000"
        },
        stdio: "inherit"
      }
    );
    backendProcess.on("exit", (code) => {
      console.log("[Proxy] Backend process exited with code", code);
    });
  });
}
app.use("/api", (req, res) => {
  const options = {
    hostname: "127.0.0.1",
    port: BACKEND_PORT,
    path: req.originalUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${BACKEND_PORT}`
    }
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", (err) => {
    console.error("[Proxy Error]:", err.message);
    if (!res.headersSent) {
      res.status(502).json({
        detail: "FastAPI backend connection error",
        error: err.message
      });
    }
  });
  req.pipe(proxyReq);
});
async function startServer() {
  ensureBackendRunning();
  if (process.env.NODE_ENV === "production") {
    app.use(express.static("dist"));
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Video Translator] Server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer();
