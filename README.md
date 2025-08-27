<div align="center">
    <img src="/screenshots/logo.svg">
</div>

# Vibe Term

A terminal multiplexer interface for Claude Code built with React and Electron.

> [!WARNING]  
> This was mostly Vibe Coded to create a quick protype, so the source code is currently quite messy!

## Usage

Vibe Term provides a visual interface for managing multiple Claude Code sessions:

- **Terminal Sessions**: Each claude instance runs in its own tmux session
- **Visual Status**: See when Claude is working, ready, or completed
- **Git Integration**: View and manage git changes directly in the interface
- **Code Editor**: Edit files directly in the interface
- **Desktop Notifications** Get notified when Claude finishes a task

## Remote Access

The entire app also hosts itself as a web app on port `1337` when it starts, so you can easily access it from other devices on your network, or even externally via TailScale. Everything stays in sync between all devices.

## Screenshots

> [!NOTE]  
> The apps design may have changed since these were taken

<img src="/screenshots/1.png"/>
<details>
    <summary>View More</summary>
    <img src="/screenshots/2.png"/>
    <img src="/screenshots/3.png"/>
    <img src="/screenshots/4.png"/>
</details>

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
