import { createServer } from "node:http";
import { GET } from "../api/status.mjs";

createServer(async (req, res) => {
  if (req.url === "/health") { res.writeHead(200); res.end("ok"); return; }
  if (req.url?.split("?")[0] !== "/api/status") { res.writeHead(404); res.end(); return; }
  if (req.method !== "GET") { res.writeHead(405, { Allow: "GET" }); res.end(); return; }
  try {
    const response = await GET();
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("Status server error", error.message);
    res.writeHead(500); res.end();
  }
}).listen(3000, "0.0.0.0");
