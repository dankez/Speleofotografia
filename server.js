import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const distPath = path.join(__dirname, "dist");
  const UPLOADS_DIR = path.join(__dirname, "uploads");
  const DATA_DIR = path.join(__dirname, "data");

  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // Serve static files from production build
  app.use(express.static(distPath));

  // Example API route placeholder - in production these would typically be
  // implemented in this file or imported from a shared logic file.
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy for uploads (standard pattern for this app)
  app.get("/api/photo/:id", (req, res) => {
    const { id } = req.params;
    const filename = id.includes(".") ? id : `${id}.webp`;
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(filePath);
    }
    res.status(404).send("Not found");
  });

  // Handle SPA routing
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Frontend build not found. Please run 'npm run build' first.");
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Production server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL SERVER ERROR:", err);
  process.exit(1);
});
