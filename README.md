<div align="center">
    <img width="100" src="/public/icon.png" alt="Logo"/>
</div>
<div align="center">
    A terminal multiplexer interface for Claude Code built with React and Electron.
</div>

## Prerequisites 

Vibe Term requires the following dependencies to be installed:

- **tmux** - Terminal multiplexer for session management
  ```bash
  # macOS
  brew install tmux
  
  # Ubuntu/Debian  
  sudo apt-get install tmux
  ```

- **claude** - Claude Code CLI tool
  ```bash
  curl -fsSL https://claude.ai/install.sh | sh
  ```

## Usage

Vibe Term provides a visual interface for managing multiple Claude Code sessions:

- **Project Management**: Add and organize your coding projects
- **Terminal Sessions**: Each project runs in its own tmux session
- **Visual Status**: See when Claude is working, ready, or completed
- **Git Integration**: View and manage git changes directly in the interface
- **Web Interface**: Access your projects remotely via the built-in web server

## Getting Started

To run the project locally run the following command:

```bash
yarn dev
```

And to create a release build run the following command:

```bash
# Mac
yarn build --mac

# Linux
yarn build --linux
```