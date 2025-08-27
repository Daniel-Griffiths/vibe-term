# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vibe Term is a terminal multiplexer interface for Claude Code built with React and Electron. It provides a visual interface for managing multiple Claude Code sessions through tmux, with features like Git integration, file editing, and remote access via a web server.

## Core Architecture

### Technology Stack

- **Frontend**: React with TypeScript, Tailwind CSS
- **Desktop**: Electron (main process handles PTY sessions, tmux management)
- **State Management**: Zustand with persistence
- **Terminal**: node-pty for terminal emulation, xterm.js for display
- **Editor**: Monaco Editor for file editing
- **Build Tool**: Vite

### Key Architectural Patterns

1. **Unified Item System**: Projects and panels share a common `UnifiedItem` interface, stored persistently and synced to runtime state
2. **Shared PTY Processes**: Terminal sessions are shared between desktop and web clients via a centralized PTY management system
3. **IPC Communication**: Electron IPC handlers manage all system interactions (process management, file operations, git commands)
4. **State Synchronization**: Zustand store writes state to disk for web server access

## Development Commands

```bash
# Install dependencies
pnpm install

# Run development server (React only)
pnpm dev

# Run with Electron in development
pnpm electron:dev

# Build the application
pnpm build

# Create release build for Mac
pnpm build --mac

# Create release build for Linux
pnpm build --linux

# Run type checking
pnpm tsc

# Run linting
pnpm lint

# Run the built application (Mac)
pnpm electron:run
```

## Project Structure

- `electron/main.ts` - Main Electron process: manages PTY sessions, tmux, IPC handlers, web server
- `client/App.tsx` - Main React component: coordinates UI state and IPC communication
- `client/stores/settings.ts` - Zustand store: manages persistent state and settings
- `client/components/view-*.tsx` - View components for different panels (terminal, git diff, file editor)
- `client/utils/shellUtils.ts` - Shell utilities: tmux session management, command execution

## Code Style Guidelines

### Component Interface Naming

- All component prop interfaces must follow the format `I{ComponentName}Props`
- Example: `ICodeEditorProps`, `ICodeEditorImageViewerProps`, `IViewFileEditorProps`
- This ensures consistent naming across the codebase and easy identification of component interfaces

## Key Implementation Details

### Terminal Session Management

- Each project runs in its own tmux session with a unique name
- PTY processes are created and managed in `electron/main.ts`
- Terminal output is streamed to both desktop and web clients
- Session state is tracked by detecting Claude's status indicators (⏺ for finished, ✳ for working)

### Git Integration

- Git operations use native git commands via `execAsync`
- Git diff view shows file changes with Monaco Editor diff viewer
- Supports commit, push, and file revert operations

### Web Server

- Express server runs on port 1337 by default
- WebSocket connections stream terminal output to web clients
- API endpoints mirror IPC handlers for project management

### State Management

- Persistent state stored in localStorage via Zustand
- Runtime state (status, output) kept separate from stored state
- State file written to disk for web server access

## Common Development Tasks

### Adding a New IPC Handler

1. Add handler in `electron/main.ts` `setupIPCHandlers()` function
2. Add corresponding method in `electron/preload.ts`
3. Use via `window.electronAPI` in React components

### Adding a New View Component

1. Create component in `client/components/view-*.tsx`
2. Add tab in `client/components/view-project.tsx`
3. Handle state updates via Zustand store

### Modifying Terminal Behavior

1. PTY creation logic in `getOrCreateSharedPty()` function
2. Output parsing for status detection in the `onData` handler
3. tmux commands generated via `ShellUtils` class

## Important Considerations

- Always kill tmux sessions when stopping projects to prevent orphaned sessions
- Terminal buffers are limited to 10KB to prevent memory issues
- Power save blocker keeps system awake while app is running
- Missing dependencies (tmux, claude) trigger a modal on startup
