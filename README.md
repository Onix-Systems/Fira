
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

1. **Download Fira**
   ```bash
   # Download the latest release and extract it
   wget https://github.com/Onix-Systems/Fira/releases/download/v1.0.2/fira-v1.0.2.zip
   unzip fira-v1.0.2.zip
   cd fira-v1.0.2
   ```

2. **Open Fira in your browser**
   ```bash
   cd fira/local
   # Simply double-click index.html to open it in your web browser
   # Alternative: Right-click on index.html → "Open with" → Choose your preferred browser
   ```

3. **Choose your projects folder**
   - Click the "Choose Folder" button in Fira
   - Select where you want to store your projects
   - Uses modern File System Access API - works directly with your local files!

**Requirements:** Chrome/Edge 86+ (uses File System Access API)

**How it works:**
- Direct file access - no server needed
- Projects stored as folders with markdown task files
- Works completely offline
- Direct file system access for easy backup/sync

### Docker Deployment

Quick Docker setup:

```bash
# 1. Download latest release
wget https://github.com/Onix-Systems/Fira/releases/download/v1.0.2/fira-v1.0.2.zip
unzip fira-v1.0.2.zip
cd fira-v1.0.2

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
- Contact: denys.kramar@onix-systems.com
