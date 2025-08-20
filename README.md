<div align="center">
    <img width="100" src="/public/icon.png" alt="Logo"/>
</div>
<div align="center">
    A terminal multiplexer interface for Claude Code built with React and Electron.
</div>

> [!WARN]  
> This was mostly Vibe Coded to create a quick protype, so the source code is currently quite messy.

## Usage

Vibe Term provides a visual interface for managing multiple Claude Code sessions:

- **Terminal Sessions**: Each claude instance runs in its own tmux session
- **Visual Status**: See when Claude is working, ready, or completed
- **Git Integration**: View and manage git changes directly in the interface
- **Code Editor**: Edit files directly in the interface
- **Web Access**: Access your projects from anywhere
- **Web Interface**: Access your projects remotely via the built-in web server

## Getting Started

To run the project locally run the following command:

```bash
pnpm dev
```

And to create a release build run the following command:

```bash
# Mac
pnpm build --mac

# Linux
pnpm build --linux
```
