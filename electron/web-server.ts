import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import path from "path";

const DEFAULT_WEB_SERVER_PORT = 6969;

// Web server variables
let webSocketServer: WebSocketServer | null = null;
const webClients = new Set<any>();

interface WebSocketMessage {
  type: string;
  projectId?: string;
  data?: string;
  timestamp?: number;
  code?: number;
}

interface AppState {
  settings: any;
  storedItems: any[];
}

interface WebServerDependencies {
  ipcHandlers: Map<string, (...args: any[]) => Promise<any>>;
  readStateFile: () => AppState;
  __dirname: string;
}

// Helper function to broadcast messages to all web clients
export function broadcastToWebClients(message: WebSocketMessage) {
  const messageStr = JSON.stringify(message);
  webClients.forEach((client) => {
    if (client.readyState === 1) {
      // WebSocket.OPEN
      try {
        client.send(messageStr);
      } catch (error) {
        console.error("Failed to send message to web client:", error);
        webClients.delete(client);
      }
    }
  });
}

// Web server setup
async function checkPortAvailable(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(port));
    });

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use. Please stop the process using this port or choose a different port.`
          )
        );
      } else {
        reject(err);
      }
    });
  });
}

export async function createWebServer(
  deps: WebServerDependencies,
  preferredPort = DEFAULT_WEB_SERVER_PORT
): Promise<{ server: any; port: number }> {
  const { ipcHandlers, readStateFile, __dirname } = deps;

  const port = await checkPortAvailable(preferredPort);
  const expressApp = express();
  const server = createServer(expressApp);

  // Enable CORS for all routes
  expressApp.use(cors());
  expressApp.use(express.json());

  // Serve static files (we'll create a simple mobile-friendly interface)
  const webStaticPath = path.join(__dirname, "..", "web");
  expressApp.use(express.static(webStaticPath));

  // Automatic API endpoint generation from IPC handlers
  expressApp.post("/api/ipc/:handlerName", async (req, res) => {
    const { handlerName } = req.params;
    const args = req.body.args || [];

    try {
      const handler = ipcHandlers.get(handlerName);
      if (!handler) {
        return res.status(404).json({
          success: false,
          error: `IPC handler '${handlerName}' not found`,
        });
      }

      const result = await handler(...args);
      res.json(result);
    } catch (error: any) {
      console.error(`Error in IPC handler '${handlerName}':`, error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Legacy API endpoints for backward compatibility
  expressApp.get("/api/projects", (req, res) => {
    const state = readStateFile();
    const projects =
      state.storedItems?.filter((item: any) => item.type === "project") || [];
    res.json({ success: true, data: projects });
  });

  // Note: Project status, resize, and history endpoints are now handled
  // automatically via the /api/ipc/:handlerName endpoint above

  // List all available IPC handlers
  expressApp.get("/api/ipc", (req, res) => {
    const handlers = Array.from(ipcHandlers.keys());
    res.json({ success: true, handlers });
  });

  // WebSocket setup
  webSocketServer = new WebSocketServer({ server });

  webSocketServer.on("connection", (ws) => {
    webClients.add(ws);

    // Send current projects state
    const state = readStateFile();
    const projects =
      state.storedItems?.filter((item: any) => item.type === "project") || [];
    ws.send(
      JSON.stringify({
        type: "projects-state",
        data: projects,
      })
    );

    ws.on("close", () => {
      webClients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      webClients.delete(ws);
    });
  });

  return new Promise((resolve, reject) => {
    server
      .listen(port, "0.0.0.0", () => {
        console.log(`Web server started on http://0.0.0.0:${port}`);
        resolve({ server, port });
      })
      .on("error", (error) => {
        console.error("Failed to start web server:", error);
        reject(error);
      });
  });
}

export function closeWebServer() {
  if (webSocketServer) {
    webSocketServer.close();
    webSocketServer = null;
  }
  webClients.clear();
}

export { webSocketServer, webClients };
