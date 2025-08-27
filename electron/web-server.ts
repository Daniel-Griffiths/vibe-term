import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import path from "path";
import { WEB_PORT } from "../shared/settings";

const DEFAULT_WEB_SERVER_PORT = WEB_PORT;

// Web server variables
let webSocketServer: WebSocketServer | null = null;
const webClients = new Set<any>();
let currentServer: any = null;
let serverDependencies: WebServerDependencies | null = null;
let serverPort = DEFAULT_WEB_SERVER_PORT;

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
  app: Electron.App;
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
  const { ipcHandlers, app } = deps;

  // Store dependencies and port for restart functionality
  serverDependencies = deps;
  serverPort = preferredPort;

  const port = await checkPortAvailable(preferredPort);
  const expressApp = express();
  const server = createServer(expressApp);
  currentServer = server;

  // Enable CORS for all routes
  expressApp.use(cors());
  expressApp.use(express.json());

  // Serve static files (both simple interface and React app)
  // Use app.getAppPath() to get the correct path in packaged apps
  const appPath = app.getAppPath();
  const webStaticPath = path.join(appPath, "web");
  const distWebPath = path.join(appPath, "dist-web");
  
  expressApp.use(express.static(webStaticPath));
  
  expressApp.use("/dist", express.static(distWebPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      }
    }
  }));

  // Automatic API endpoint generation from IPC handlers
  expressApp.post("/api/ipc/:handlerName", async (req, res) => {
    const { handlerName } = req.params;
    
    try {
      const args = req.body.args || [];

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


  // Note: Project status, resize, and history endpoints are now handled
  // automatically via the /api/ipc/:handlerName endpoint above

  // List all available IPC handlers
  expressApp.get("/api/ipc", (req, res) => {
    const handlers = Array.from(ipcHandlers.keys());
    res.json({ success: true, handlers });
  });

  // Serve the main React app (both root and /app routes)
  expressApp.get(["/", "/app"], (_, res) => {
    res.sendFile(path.join(webStaticPath, "index.html"));
  });

  // WebSocket setup
  webSocketServer = new WebSocketServer({ server });

  webSocketServer.on("connection", async (ws: any) => {
    webClients.add(ws);

    // Send current projects state using IPC handler
    try {
      const handler = ipcHandlers.get("get-stored-items");
      if (handler) {
        const result = await handler();
        if (result.success) {
          ws.send(
            JSON.stringify({
              type: "projects-state", 
              data: result.data,
            })
          );
        }
      }
    } catch (error) {
      console.error("Error sending initial projects state:", error);
    }

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
        console.log(`Web server started on port ${port}`);
        resolve({ server, port });
      })
      .on("error", (error) => {
        console.error("Failed to start web server:", error);
        reject(error);
      })
      .on("close", () => {
        console.log("Web server closed");
      });

    // Handle server errors that could cause crashes
    server.on("clientError", (err, socket) => {
      console.error("Client error:", err);
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    });

    server.on("error", (err) => {
      console.error("Server error:", err);
      // Let the health check handle restarts
    });
  });
}

export function closeWebServer() {
  if (webSocketServer) {
    webSocketServer.close();
    webSocketServer = null;
  }
  if (currentServer) {
    currentServer.close();
    currentServer = null;
  }
  webClients.clear();
}

// Restart the web server with the same configuration
export async function restartWebServer(): Promise<{ server: any; port: number } | null> {
  if (!serverDependencies) {
    console.error("Cannot restart web server: no dependencies stored");
    return null;
  }

  try {
    // Close existing server
    closeWebServer();
    
    // Wait a moment for the port to be released
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create new server
    const result = await createWebServer(serverDependencies, serverPort);
    return result;
  } catch (error) {
    console.error("Failed to restart web server:", error);
    return null;
  }
}

// Check if web server is running
export function isWebServerRunning(): boolean {
  return currentServer !== null && webSocketServer !== null;
}

export { webSocketServer, webClients, currentServer };
