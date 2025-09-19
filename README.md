
[![Landing Site](https://img.shields.io/badge/Website-Landing%20Page-blue?logo=web)](https://onix-systems-android-tasks.dev.onix.team/landing/index.html)
[![Wiki](https://img.shields.io/badge/Wiki-GitHub%20Wiki-green?logo=tools)](https://github.com/Onix-Systems/Fira/wiki)

# Fira - Project Management Platform

Visual Kanban project management with task tracking and team collaboration.

Fira offers two deployment modes:
- **🌐 Web Mode** - Server-based with user authentication and team collaboration
- **📁 Local Mode** - Offline file-based project management for personal use

## Features

- **Kanban Boards** - Organize tasks across workflow columns (Backlog → Progress → Review → Testing → Done)
- **Project Dashboard** - All projects overview with search and filtering
- **Task Management** - Drag-and-drop tasks with time tracking and comments
- **Team Collaboration** - Developer-specific task assignments and workflows
- **Dual Architecture** - Choose between server-based or local file-based operation

## Quick Start

### 📁 Local Mode (Offline, No Server Required)

Perfect for personal project management with direct file system access.

```bash
# 1. Clone repository
git clone https://github.com/Onix-Systems/Fira.git
cd Fira

# 2. Open local version
cd fira/local
# Option A: Open index.html directly in Chrome/Edge 86+
# Option B: Serve via Python
python -m http.server 8080
# Then visit http://localhost:8080
```

**Requirements:** Chrome/Edge 86+ (uses File System Access API)

**How it works:**
- Click "Choose Folder" to select your projects directory
- Projects stored as folders with markdown task files
- Works completely offline, no server needed
- Direct file system access for easy backup/sync

### 🌐 Web Mode (Server-based with Authentication)

Full-featured server for team collaboration and multi-user access.

```bash
# 1. Clone repository
git clone https://github.com/Onix-Systems/Fira.git
cd Fira

# 2. Start web server
cd fira/web
./start.sh    # Linux/Mac
start.bat     # Windows

# 3. Open browser at http://localhost:8080
```

**Requirements:** Python 3.7+ (auto-detected)

**How it works:**
- Python HTTP server with REST API
- User authentication and role management
- Projects stored in `fira/web/projects/` directory
- Team collaboration features

### 🐳 Docker Deployment

**[📖 Complete Docker Deployment Guide](fira/docker-deploy/README.md)**

Quick Docker setup:

```bash
# 1. Clone repository
git clone https://github.com/Onix-Systems/Fira.git
cd Fira

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


## CI/CD and Deployment

### GitLab CI/CD Setup

Configure `.gitlab-ci.yml` variables in your GitLab project:

```yaml
# Required Variables
BUILD_DOCKER_IMAGE: "docker:20.10.16"
DEPLOY_DOCKER_IMAGE: "your-deploy-image"
DOCKER_REPOSITORY_IMAGE: "your-registry/fira:latest"
K8S_NAMESPACE: "your-namespace"
K8S_HOSTNAME: "fira.yourdomain.com"
CONTAINER_PORT: "8080"
```

### Kubernetes Deployment

1. **Configure environment secrets:**
   ```bash
   kubectl create secret generic env-secrets \
     --from-literal=FIRA_REQUIRE_LOGIN=true \
     --from-literal=FIRA_PORT=8001 \
     -n your-namespace
   ```

2. **Setup Docker registry access:**
   ```bash
   kubectl create secret docker-registry gitlab-registry \
     --docker-server=your-registry.com \
     --docker-username=your-username \
     --docker-password=your-token \
     -n your-namespace
   ```

3. **Deploy:**
   ```bash
   # Apply deployment configuration
   envsubst < deployment.yml | kubectl apply -f -
   
   # Check status
   kubectl get pods -n your-namespace
   kubectl get ingress -n your-namespace
   ```

## Project Structure

```
fira/
├── web/                    # 🌐 Web Mode - Server-based application
│   ├── mini-server.py     # Python HTTP server with REST API
│   ├── index.html         # Main web application
│   ├── login-screen.html  # Authentication interface
│   ├── users.json         # User authentication storage
│   ├── projects/          # Project data storage
│   ├── start.sh/.bat      # Server startup scripts
│   ├── stop.sh/.bat       # Server shutdown scripts
│   └── *.js, *.css       # Frontend assets
├── local/                  # 📁 Local Mode - File-based application
│   ├── index.html         # Simplified local application
│   ├── projects-data.js   # Local project management
│   └── *.js, *.css       # Shared frontend assets
├── .gitlab-ci.yml         # CI/CD pipeline configuration
├── deployment.yml         # Kubernetes deployment template
├── docker-compose.yml     # Development Docker setup
└── docker-compose.prod.yml # Production Docker setup
```

## Mode Comparison

| Feature | 📁 Local Mode | 🌐 Web Mode |
|---------|---------------|-------------|
| **Setup** | Open HTML file | Start Python server |
| **Authentication** | None | User accounts & roles |
| **Storage** | Direct file system | Server-managed files |
| **Collaboration** | File sharing only | Real-time team features |
| **Internet Required** | No | Yes (for server) |
| **Best for** | Personal projects | Team projects |
| **Browser Support** | Chrome/Edge 86+ | All modern browsers |


## Support

- Create an issue in this repository
- Contact: denys.kramar@onix-systems.com
