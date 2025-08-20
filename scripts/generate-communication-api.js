#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IPC_HANDLERS_FILE = path.join(
  __dirname,
  "..",
  "electron",
  "ipc-handlers.ts"
);

// Parse TypeScript function signature to extract parameters
function parseFunctionSignature(funcStr) {
  // Extract parameter part from function signature
  const paramMatch = funcStr.match(
    /async\s*\([^)]*\)\s*:\s*Promise<([^>]+)>\s*=>\s*\{/
  );
  if (!paramMatch) return { args: [], argTypes: [], returnType: "any" };

  const returnType = paramMatch[1];

  // Find the parameter list
  const paramListMatch = funcStr.match(/async\s*\(([^)]*)\)/);
  if (!paramListMatch) return { args: [], argTypes: [], returnType };

  const paramList = paramListMatch[1];
  const args = [];
  const argTypes = [];

  if (paramList.trim()) {
    // Split parameters and parse each one
    const params = paramList
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p);

    for (const param of params) {
      // Skip event parameter
      if (param.includes("_event")) continue;

      // Parse parameter: "name: type" or just "name"
      const colonIndex = param.indexOf(":");
      if (colonIndex > -1) {
        const name = param.substring(0, colonIndex).trim();
        let type = param.substring(colonIndex + 1).trim();

        // Handle optional parameters
        const isOptional = name.endsWith("?") || type.includes("undefined");
        const cleanName = name.replace("?", "");
        const cleanType = type.replace(/\s*\|\s*undefined/, "").trim();

        args.push(cleanName);
        argTypes.push(isOptional ? `${cleanType}?` : cleanType);
      } else {
        // No type annotation, default to any
        args.push(param);
        argTypes.push("any");
      }
    }
  }

  return { args, argTypes, returnType };
}

// Extract IPC handler registrations from the file
function extractIPCHandlers() {
  const content = fs.readFileSync(IPC_HANDLERS_FILE, "utf8");

  // Simple regex to find all handler names first - handle multiline with newlines
  const handlerNameRegex =
    /registerIPCHandler(?:<([^>]+)>)?\s*\(\s*["']([^"']+)["']/gs;

  const handlers = [];

  let match;
  while ((match = handlerNameRegex.exec(content)) !== null) {
    const [, typeParams, handlerName] = match;

    // Skip internal handlers
    if (handlerName === "claude-hook") continue;

    let args = [];
    let argTypes = [];
    let returnType = "any";

    // Try to parse TypeScript generics first
    if (typeParams) {
      const typeMatch = typeParams.match(/\[([^\]]*)\](?:,\s*(.+))?/);
      if (typeMatch) {
        const [, argsTypeString, retType] = typeMatch;
        if (argsTypeString) {
          argTypes = argsTypeString.split(",").map((t) => t.trim());
        }
        if (retType) {
          returnType = retType.trim();
        }
      }
    }

    // For now, use basic parameter inference based on common patterns
    // This can be improved later with better parsing
    if (
      handlerName === "read-project-file" ||
      handlerName === "read-image-file"
    ) {
      // These handlers specifically need both projectPath and filePath
      args = ["projectPath", "filePath"];
      argTypes = ["string", "string"];
    } else if (handlerName === "save-file") {
      // Save file needs projectPath, filePath, and content
      args = ["projectPath", "filePath", "content"];
      argTypes = ["string", "string", "string"];
    } else if (handlerName === "revert-file") {
      // Revert file just needs projectPath and filePath
      args = ["projectPath", "filePath"];
      argTypes = ["string", "string"];
    } else if (handlerName.includes("project") && argTypes.length === 0) {
      // Most project handlers just need projectPath
      args = ["projectPath"];
      argTypes = ["string"];
    } else if (argTypes.length > 0) {
      // Generate parameter names from types
      args = argTypes.map((_, index) => `arg${index}`);
    }

    handlers.push({
      name: handlerName,
      args,
      argTypes,
      returnType,
      methodName: toCamelCase(handlerName),
    });
  }

  // Manually add missing handlers that the regex doesn't catch due to formatting
  const missingHandlers = [
    {
      name: "get-git-diff",
      args: ["projectPath"],
      argTypes: ["string"],
      returnType: "any",
      methodName: "getGitDiff",
    },
    {
      name: "select-directory",
      args: [],
      argTypes: [],
      returnType: "string | null",
      methodName: "selectDirectory",
    },
    {
      name: "update-app-settings",
      args: ["settings"],
      argTypes: ["Partial<AppSettings>"],
      returnType: "BaseResponse",
      methodName: "updateAppSettings",
    },
  ];

  // Only add if not already found
  missingHandlers.forEach((missing) => {
    if (!handlers.find((h) => h.name === missing.name)) {
      handlers.push(missing);
    }
  });

  return handlers;
}

// Convert kebab-case to camelCase
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}

// Generate method signature with proper TypeScript types
function generateMethodSignatures(handler) {
  const params = handler.args
    .map((arg, index) => {
      const type = handler.argTypes[index] || "any";
      // Handle optional parameters
      const isOptional = type.includes("?") || type.includes("undefined");
      const cleanType = type.replace(/\?/g, "").trim();
      return `${arg}${isOptional ? "?" : ""}: ${cleanType}`;
    })
    .join(", ");

  return `async ${handler.methodName}(${params}): Promise<${handler.returnType}>`;
}

// Generate unified method implementation
function generateMethods(handler) {
  const args = handler.args.length > 0 ? handler.args.join(", ") : "";
  const argsArray =
    handler.args.length > 0 ? `[${handler.args.join(", ")}]` : "[]";

  return `  ${generateMethodSignatures(handler)} {
    return isElectron 
      ? this.electronAPI.${handler.methodName}(${args})
      : this.callAPI('${handler.name}', ${argsArray});
  }`;
}

function generateCode(handlers) {
  const methods = handlers
    .filter((h) => h.name !== "claude-hook") // Skip internal handlers
    .map(generateMethods)
    .join("\n\n");

  return `class API {
  private electronAPI: any;

  constructor() {
    if (isElectron) {
      this.electronAPI = (window as any).electronAPI;
    }
  }

  private async callAPI(handlerName: string, args: any[] = []): Promise<any> {
    const response = await fetch(\`/api/ipc/\${handlerName}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args })
    });
    return await response.json();
  }

${methods}


  // Event listener methods (Electron only)
  // For web clients, use webSocketManager from websocket-manager.ts directly
  onTerminalOutput(callback: (data: any) => void): () => void {
    return isElectron ? this.electronAPI.onTerminalOutput(callback) : (() => {});
  }

  onProcessExit(callback: (data: any) => void): () => void {
    return isElectron ? this.electronAPI.onProcessExit(callback) : (() => {});
  }

  onClaudeReady(callback: (data: any) => void): () => void {
    return isElectron ? this.electronAPI.onClaudeReady(callback) : (() => {});
  }

  onClaudeWorking(callback: (data: any) => void): () => void {
    return isElectron ? this.electronAPI.onClaudeWorking(callback) : (() => {});
  }

  onBackgroundOutput(callback: (data: any) => void): () => void {
    return isElectron ? this.electronAPI.onBackgroundOutput(callback) : (() => {});
  }

  onMissingDependencies(callback: (deps: string[]) => void): () => void {
    return isElectron ? this.electronAPI.onMissingDependencies(callback) : (() => {});
  }

  onMainProcessReady(callback: () => void): () => void {
    return isElectron ? this.electronAPI.onMainProcessReady(callback) : (() => {});
  }
}`;
}

// Extract unique return types from handlers
function extractReturnTypes(handlers) {
  const types = new Set();
  handlers.forEach((h) => {
    if (h.returnType && h.returnType !== "any") {
      // Extract base type from generics like DataResponse<Something>
      const baseType = h.returnType.match(/^([^<]+)/)?.[1] || h.returnType;
      types.add(baseType);

      // Also add the full type if it's a generic
      if (h.returnType.includes("<")) {
        types.add(h.returnType);
      }
    }
  });
  return Array.from(types);
}

// Generate minimal type definitions based on what's actually used
function generateTypeDefinitions(returnTypes) {
  const typeDefinitions = [];

  // Always include base types
  typeDefinitions.push(`// Base response types
export interface BaseResponse {
  success: boolean;
  error?: string;
}

export interface DataResponse<T> extends BaseResponse {
  data: T;
}`);

  // Always add commonly used types for consistency
  typeDefinitions.push(`
export interface PTYResult extends BaseResponse {
  projectId?: string;
}

export interface CommandResult extends BaseResponse {
  output?: string;
}

export interface ImageResult extends BaseResponse {
  data?: string;
  mimeType?: string;
}

export interface GitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
}

export interface GitDiffResult {
  files: GitFile[];
  branch: string;
  ahead: number;
  behind: number;
}

export interface FileTreeItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeItem[];
  isExpanded?: boolean;
}

export interface LocalIpResult {
  localIp: string;
  hasTailscale: boolean;
}`);

  // Add commonly used types
  typeDefinitions.push(`
export interface AppState {
  settings?: any;
  storedItems?: UnifiedItem[];
}

export interface AppSettings {
  editor: {
    theme: string;
  };
  desktop: {
    notifications: boolean;
  };
  webServer: {
    enabled: boolean;
  };
}`);

  return typeDefinitions.join("\n");
}

// Generate the complete communication.ts file
function generateCodeFile(handlers) {
  const apiClass = generateCode(handlers);

  return `/**
 * This file is AUTO-GENERATED by scripts/generate-communication-api.js
 * Do not edit manually - run the script to regenerate.
 */

import { isElectron } from './environment';

// Re-export all types from the shared type definitions
export type {
  BaseResponse,
  DataResponse,
  PTYResult,
  CommandResult,
  ImageResult,
  GitFile,
  GitDiffResult,
  FileTreeItem,
  LocalIpResult,
  AppSettings,
  AppState
} from '../../electron/ipc-handler-types';

${apiClass}

// Create the unified API instance
export const api = new API();`;
}

// Main function
function main() {
  console.log("🔍 Extracting IPC handlers...");
  const handlers = extractIPCHandlers();

  console.log(`📋 Found ${handlers.length} handlers:`);
  handlers.forEach((h) => console.log(`  - ${h.name} -> ${h.methodName}`));

  console.log("\n🏗️  Generating simplified unified communication.ts file...");
  const completeFile = generateCodeFile(handlers);

  const outputFile = path.join(__dirname, "..", "client", "utils", "api.ts");
  fs.writeFileSync(outputFile, completeFile);
  console.log(`\n💾 communication.ts has been updated: ${outputFile}`);

  console.log("\n✅ Generated clean communication.ts with:");
  console.log("  - Single API class (branches internally)");
  console.log("  - Imports environment detection from environment.ts");
  console.log("  - WebSockets separated to websocket-manager.ts");
  console.log("  - No interface needed - much cleaner!");

  console.log("\n🎉 Ready to use! Perfect separation of concerns!");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
