<img width="1536" height="1024" alt="fira-hero" src="https://github.com/user-attachments/assets/46f2677f-3810-49ac-bdf5-46600ecec25f" />


<div align="center">
  
[![Landing Site](https://img.shields.io/badge/Website-Landing%20Page-blue?logo=web)](https://onix-systems-android-tasks.dev.onix.team/landing/index.html)
[![YouTube](https://img.shields.io/badge/YouTube-Video-FF0000?logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=OsAko7621MM)
[![Wiki](https://img.shields.io/badge/Wiki-GitHub%20Wiki-green?logo=tools)](https://github.com/Onix-Systems/Fira/wiki)
[![Docker](https://img.shields.io/badge/Docker-Container-2496ED?logo=docker&logoColor=white)](https://github.com/Onix-Systems/Fira)
[![Releases](https://img.shields.io/badge/GitHub-Releases-orange?logo=github)](https://github.com/Onix-Systems/Fira/releases)
[![Reddit](https://img.shields.io/badge/Reddit-Community-FF4500?logo=reddit&logoColor=white)](https://reddit.com/r/FiraDashboard)

</div>

# Fira - Project Management Platform

Visual Kanban project management with task tracking and team collaboration.

Fira offers three deployment modes:
- **Web Mode** - Server-based for local development and team collaboration
- **Local Mode** - Offline file-based project management for personal use
- **Docker Deploy** - Production deployment with Nginx reverse proxy and containerization

## Supported Platforms

**Browser Support:**
- **Web Mode**: All modern browsers with ES6+ support (Chrome, Firefox, Safari, Edge)
- **Local Mode**: Chrome 86+, Edge 86+ (requires File System Access API)

**Operating Systems:**
- **Server**: Linux, macOS, Windows (Python 3.6+)
- **Docker**: Linux (any Docker-compatible system)

## Features

- **Kanban Boards** - Organize tasks across workflow columns (Backlog → Progress → Review → Testing → Done)
- **Project Dashboard** - All projects overview with search and filtering
- **Task Management** - Drag-and-drop tasks with time tracking and comments
- **Team Collaboration** - Developer-specific task assignments and workflows
- **Dual Architecture** - Choose between server-based or local file-based operation
- **AI-Friendly Format** - Tasks are stored as Markdown files, making it easy to generate task descriptions with AI tools and seamlessly import them into Fira

## Quick Start

Choose your deployment mode:

### Local Mode (Personal Use)

Perfect for offline project management with direct file system access.
```bash
# 1. Download and extract
wget https://github.com/Onix-Systems/Fira/releases/download/v1.0.4-local/fira-local_v1.0.4.zip
unzip fira.zip
cd fira/local

# 2. Open index.html in Chrome/Edge 86+

# 3. Click "Choose Folder" and select your projects directory
```

**Requirements:** Chrome/Edge 86+ (File System Access API)

---

### Web Mode (Local Server)

Server-based for local development without authentication.

```bash
# 1. Download and extract
wget https://github.com/Onix-Systems/Fira/releases/download/v1.0.4-with-server/fira-web_v1.0.4.zip
unzip fira.zip
cd fira/web

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start server
./start.sh      # Linux/Mac
start.bat       # Windows

# 4. Browser opens automatically at http://localhost:8080
```

**Requirements:** Python 3.6+, modern browser

**Detailed guide:** https://github.com/Onix-Systems/Fira/wiki/Start-Localhost-Server

---

### Docker Deployment (Production)

Containerized deployment with Nginx reverse proxy.

```bash
# 1. Download and extract
wget https://github.com/Onix-Systems/Fira/releases/download/v1.0.4-docker-deploy/docker-deploy_v1.0.4.zip
unzip fira.zip
cd fira/docker-deploy

# 2. Build and run
docker build -t fira-web .
docker run -p 8080:80 fira-web

# 3. Access at http://localhost:8080
```

**Requirements:** Docker

**Detailed guide:** https://github.com/Onix-Systems/Fira/wiki/Deployment (includes Kubernetes and CI/CD setup)

---

## AI-Powered Task Generation

Fira's Markdown-based format enables seamless integration with AI tools for task creation:

1. **Generate tasks with AI** - Use any AI tool (ChatGPT, Claude, etc.) to generate task descriptions in Markdown format with YAML frontmatter
2. **Save to project directory** - Place the generated `.md` files directly into your project's workflow folders (`backlog/`, `progress/`, etc.)
3. **Instant visibility** - Tasks appear immediately in Fira's Kanban board without any import process

**Example workflow:**
```bash
# Generate task with AI and save to backlog
echo "---
title: Implement user authentication
estimate: 8h
priority: high
status: backlog
---

# Task Description
Implement JWT-based authentication..." > projects/my-project/backlog/AUTH-001.md
```

The file-based architecture means any tool that can write Markdown files can create tasks for Fira.

## Support
- Contact: denys.kramar@onix-systems.com
