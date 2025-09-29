
[![Landing Site](https://img.shields.io/badge/Website-Landing%20Page-blue?logo=web)](https://onix-systems-android-tasks.dev.onix.team/landing/index.html)
[![Wiki](https://img.shields.io/badge/Wiki-GitHub%20Wiki-green?logo=tools)](https://github.com/Onix-Systems/Fira/wiki)

# Fira - Project Management Platform

Visual Kanban project management with task tracking and team collaboration.

Fira offers three deployment modes:
- **Web Mode** - Server-based with user authentication and team collaboration
- **Local Mode** - Offline file-based project management for personal use
- **Docker Deploy** - Production deployment with Nginx reverse proxy and containerization

## Features

- **Kanban Boards** - Organize tasks across workflow columns (Backlog → Progress → Review → Testing → Done)
- **Project Dashboard** - All projects overview with search and filtering
- **Task Management** - Drag-and-drop tasks with time tracking and comments
- **Team Collaboration** - Developer-specific task assignments and workflows
- **Dual Architecture** - Choose between server-based or local file-based operation

## Quick Start

### Local Mode

Perfect for personal project management with direct file system access.

```bash
# 1. Download latest release
wget https://github.com/Onix-Systems/Fira/releases/download/v1.0.1/fira-v1.0.1.zip
unzip fira-v1.0.1.zip
cd fira-v1.0.1

# 2. Choose startup method:

# Option A: Direct file access (fira/local)
cd fira/local
# Open index.html directly in Chrome/Edge 86+

# Option B: Simple server (fira/local)
cd fira/local
./start.sh    # Linux/Mac
start.bat     # Windows
# Then visit http://localhost:8080
```

**Requirements:** Chrome/Edge 86+ (uses File System Access API)

**How it works:**
- **Option A**: Direct file access - open index.html in browser, click "Choose Folder" to select projects directory
- **Option B**: Simple server - starts local HTTP server, works with any modern browser
- Projects stored as folders with markdown task files
- Works completely offline, no server needed
- Direct file system access for easy backup/sync

**Requirements:** Python 3.7+

**How it works:**
- Python HTTP server with REST API
- User authentication and role management
- Projects stored in `fira/web/projects/` directory
- Team collaboration features

### Docker Deployment

Quick Docker setup:

```bash
# 1. Download latest release
wget https://github.com/Onix-Systems/Fira/releases/download/v1.0.1/fira-v1.0.1.zip
unzip fira-v1.0.1.zip
cd fira-v1.0.1

# 2. Build and run
cd fira/docker-deploy
docker build -t fira-web .
docker run -p 8080:80 fira-web

# 3. Access at http://localhost:8080
```

The Docker deployment includes:
- **Nginx**: Reverse proxy + static file serving
- **Python Backend**: API server on port 8001
- **Supervisor**: Process management
- **Production optimizations**: Caching, compression, health checks

For production deployment, Kubernetes, CI/CD pipelines, and troubleshooting, see the [Docker Deployment Guide](fira/docker-deploy/README.md).


## Support

- Create an issue in this repository
- Contact: denys.kramar@onix-systems.com
