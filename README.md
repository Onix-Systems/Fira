
[![Landing Site](https://img.shields.io/badge/Website-Landing%20Page-blue?logo=web)](https://onix-systems-android-tasks.dev.onix.team/landing/index.html)
[![Wiki](https://img.shields.io/badge/Wiki-GitHub%20Wiki-green?logo=tools)](https://github.com/Onix-Systems/Fira/wiki)

# Fira - Project Management Platform

Visual Kanban project management with task tracking and team collaboration.

Fira offers three deployment modes:
- **Web Mode** - Server-based with user authentication and team collaboration
- **Local Mode** - Offline file-based project management for personal use
- **Docker Deploy** - Production deployment with Nginx reverse proxy and containerization

## Supported Platforms

**Browser Support:**
- **Web Mode**: All modern browsers with ES6+ support (Chrome, Firefox, Safari, Edge)
- **Local Mode**: Chrome 86+, Edge 86+ (requires File System Access API)
- **Mobile**: Responsive design works on tablets and mobile browsers

**Operating Systems:**
- **Server**: Linux, macOS, Windows (Python 3.6+)
- **Docker**: Linux (any Docker-compatible system)
- **Client**: Any OS with a supported browser

## Features

- **Kanban Boards** - Organize tasks across workflow columns (Backlog → Progress → Review → Testing → Done)
- **Project Dashboard** - All projects overview with search and filtering
- **Task Management** - Drag-and-drop tasks with time tracking and comments
- **Team Collaboration** - Developer-specific task assignments and workflows
- **Dual Architecture** - Choose between server-based or local file-based operation

## Quick Start

Choose your deployment mode:

### Local Mode (Personal Use)

Perfect for offline project management with direct file system access.

```bash
# 1. Download and extract
wget https://github.com/Onix-Systems/Fira/releases/download/v1.0.2/fira-v1.0.2.zip
unzip fira-v1.0.2.zip
cd fira-v1.0.2/fira/local

# 2. Open index.html in Chrome/Edge 86+

# 3. Click "Choose Folder" and select your projects directory
```

**Requirements:** Chrome/Edge 86+ (File System Access API)

---

### Web Mode (Local Server)

Server-based for local development without authentication.

```bash
# 1. Download and extract
wget https://github.com/Onix-Systems/Fira/releases/download/v1.0.2/fira-v1.0.2.zip
unzip fira-v1.0.2.zip
cd fira-v1.0.2/fira/web

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start server
./start.sh      # Linux/Mac
start.bat       # Windows

# 4. Browser opens automatically at http://localhost:8080
```

**Requirements:** Python 3.6+, modern browser

**Detailed guide:** [Start Localhost Server](https://github.com/Onix-Systems/Fira/wiki/Start-Localhost-Server)

---

### Docker Deployment (Production)

Containerized deployment with Nginx reverse proxy.

```bash
# 1. Download and extract
wget https://github.com/Onix-Systems/Fira/releases/download/v1.0.2/fira-v1.0.2.zip
unzip fira-v1.0.2.zip
cd fira-v1.0.2/fira/docker-deploy

# 2. Build and run
docker build -t fira-web .
docker run -p 8080:80 fira-web

# 3. Access at http://localhost:8080
```

**Requirements:** Docker

**Detailed guide:** [Deployment](https://github.com/Onix-Systems/Fira/wiki/Deployment) (includes Kubernetes and CI/CD setup)


## Support
- Contact: denys.kramar@onix-systems.com
