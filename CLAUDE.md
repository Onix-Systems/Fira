# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fira is a visual Kanban project management platform with dual deployment modes:
- **Web Mode**: Full-featured server with user authentication and multi-project support
- **Local Mode**: Offline file-based project management using browser File System API
- **Docker Mode**: Production deployment with Nginx and containerization

## Development Commands

### Starting the Server

**Web Version (Production/Development):**
```bash
cd fira/web
./start.sh    # Linux/Mac - auto-detects python3/python, opens browser
start.bat     # Windows
```

**Manual Server Start:**
```bash
cd fira/web
python mini-server.py  # Or python3 mini-server.py
# Server runs on http://localhost:8080 (or FIRA_PORT env var)
```

**Local Version:**
```bash
cd fira/local
# Simply open index.html in Chrome/Edge 86+ (double-click or right-click → Open with)
# Click "Choose Folder" button to select your projects directory
# Uses File System Access API - works directly with local files
```

**Docker Deployment:**
```bash
cd fira/docker-deploy
docker build -t fira-web .
docker run -p 8080:80 fira-web
# Note: Internal Nginx runs on port 80, mapped to host port 8080
```

**Stop Server:**
```bash
cd fira/web
./stop.sh     # Linux/Mac
stop.bat      # Windows
# Or Ctrl+C if running manually
```

### Python Dependencies

Install required packages:
```bash
cd fira/web  # or fira/docker-deploy
pip install -r requirements.txt
```

Requirements: Flask==2.3.3, Flask-CORS==4.0.0, PyYAML==6.0.1

### CI/CD and Deployment

**GitLab CI Pipeline:**
```bash
# Runs automatically on 'fira' branch
# Builds Docker image and deploys to Kubernetes
```

**Manual Docker Build:**
```bash
cd fira/docker-deploy
docker build -t fira-web .
docker run -p 8080:80 fira-web
```

**Kubernetes Deployment:**
```bash
# Setup environment secrets
kubectl create secret generic env-secrets \
  --from-literal=FIRA_REQUIRE_LOGIN=true \
  --from-literal=FIRA_PORT=8001 \
  -n your-namespace

# Deploy using template
envsubst < deployment.yml | kubectl apply -f -
```

## Architecture

### Deployment Modes

**fira/web/** - Server-based mode:
- `mini-server.py` - Standalone Python HTTP server (2,400+ lines, works without Flask)
- `index.html` - Main SPA application with authentication
- `login-screen.html` - Authentication interface
- `users.json` - User authentication storage (JSON-based)
- Role-based permissions: viewer, editor, admin

**fira/local/** - File-based mode:
- `index.html` - Simplified app for direct file system access
- `real-filesystem-loader.js` - Browser File System Access API integration
- No server required - runs entirely in browser
- Chrome/Edge 86+ required for File System API

**fira/docker-deploy/** - Production mode:
- Multi-stage Docker build with Nginx reverse proxy
- `nginx/nginx.conf` - Proxy configuration with caching
- `admin/` - Administrative interface
- `landing/` - Landing page components
- Supervisor process management for Python + Nginx

### Core Components

**Project Structure Convention:**
```
projects/
├── project-name/
│   ├── README.md
│   ├── backlog/           # Unassigned tasks
│   ├── progress/dev-name/ # In-progress tasks by developer
│   ├── review/dev-name/   # Code review tasks
│   ├── testing/dev-name/  # Testing tasks
│   ├── done/dev-name/     # Completed tasks
│   └── images/            # Project assets
```

**Task File Format:**
```markdown
---
title: Task Title
estimate: 4h
spent_time: 2h
priority: high/medium/low
developer: dev-name
status: backlog/progress/review/testing/done
created: 2025-01-15
---

# Task Description
Markdown content...
```

### Key JavaScript Modules

- `router.js` - SPA routing with cross-protocol support (file:// and http://)
- `project-board.js` - Kanban board (9,900+ lines) with drag-and-drop, filtering, Chart.js analytics
- `file-system.js` - File operations abstraction for both server and local modes
- `api-client.js` - Server communication with caching and failover
- `auth-check.js` - Authentication handling with session management
- `projects-data.js` - Project data management and synchronization
- `global-data.js` - Shared application state across modules
- `loading-manager.js` - UI state and error handling
- `analytics.js` - Project metrics and time tracking charts

### Server API Endpoints

**Projects:**
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project

**Tasks:**
- `GET /api/projects/{id}/tasks` - Get project tasks
- `POST /api/projects/{id}/tasks` - Create task
- `PUT /api/projects/{id}/tasks/{taskId}` - Update task
- `DELETE /api/projects/{id}/tasks/{taskId}` - Delete task

**Authentication:**
- `POST /api/auth/login` - User login
- `POST /api/auth/create-user` - Create user account
- `GET /api/auth/validate` - Validate session
- `POST /api/auth/logout` - End session

**File Operations:**
- `GET /api/files/{path}` - Read file content
- `POST /api/files/{path}` - Write file content
- `DELETE /api/files/{path}` - Delete file

### Configuration

**Environment Variables:**
- `FIRA_PORT` - Server port (default: 8080 for start scripts, 5000 for manual)
- `FIRA_REQUIRE_LOGIN` - Enable authentication (default: false)
- `FIRA_PROJECTS_DIR` - Projects base directory (default: ./projects)

**CI/CD Variables (GitLab):**
- `BUILD_DOCKER_IMAGE` - Docker image for build stage
- `DEPLOY_DOCKER_IMAGE` - Docker image for deployment stage
- `DOCKER_REPOSITORY_IMAGE` - Target registry image path
- `K8S_NAMESPACE` - Kubernetes namespace for deployment
- `K8S_HOSTNAME` - Public hostname for ingress
- `CONTAINER_PORT` - Container port for service exposure

**User Management:**
Edit `fira/web/users.json`:
```json
{
  "users": [
    {
      "id": "1",
      "email": "admin@example.com",
      "username": "admin",
      "password": "admin123",
      "role": "admin",
      "active": true
    }
  ]
}
```

**Default Login:** admin/admin123

**User Roles:**
- `viewer` - Read-only access
- `editor` - Create/edit tasks and projects
- `admin` - Full access including user management

## Development Notes

### Architecture Patterns

**File-First Design:**
- Tasks stored as Markdown files with YAML frontmatter
- File location determines task status (workflow state)
- Git-friendly for version control
- Human-readable format for manual editing

**Zero-Dependency Core:**
- Python server works standalone without Flask
- Vanilla JavaScript ES6+ (no framework dependencies)
- Optional CDN libraries (jQuery, Chart.js) for enhancements

**Dual Architecture Strategy:**
- Shared JavaScript codebase between web and local modes
- Runtime environment detection
- Graceful degradation from server to file mode

### Browser Compatibility
- **Web version:** Modern browsers with ES6+ support
- **Local version:** Chrome/Edge 86+ (File System Access API required)
- **Mobile:** Responsive design for tablet/mobile access

### Task Management Flow
1. Tasks created in `backlog/` directory
2. Developer assignment moves to `progress/dev-name/`
3. Review stage moves to `review/dev-name/`
4. Testing stage moves to `testing/dev-name/`
5. Completion moves to `done/dev-name/`
6. Drag-and-drop operations handle file movements

### Development Workflow
1. Start server with `./start.sh` (auto-detects Python version)
2. Server auto-opens browser at http://localhost:8080
3. Changes to JavaScript files reflect immediately (no build)
4. Python server changes require restart
5. Use `./stop.sh` for graceful shutdown

### Testing Approach
- Manual testing through UI interaction
- File system verification for task movements
- API testing via browser DevTools or curl
- Cross-browser testing for compatibility

### Security Considerations
- Authentication bypassed in local mode
- JSON-based user storage (replaceable with database)
- Role-based access control throughout application
- Session timeout and validation in web mode
- No sensitive data in client-side JavaScript

## Additional Development Notes

### Debugging and Troubleshooting
- Check browser console for JavaScript errors
- Python server logs printed to terminal/console
- File system operations visible in browser DevTools Network tab
- Task movements create corresponding file system changes
- Authentication state stored in browser sessionStorage

### Performance Considerations
- Large projects (1000+ tasks) may impact browser performance
- File system operations are synchronous in local mode
- Server mode supports concurrent users
- Chart.js analytics render asynchronously
- Drag-and-drop operations use requestAnimationFrame for smooth UI

### CI/CD Pipeline Details
- **Trigger**: Pushes to 'fira' branch only
- **Build Stage**: Creates Docker image using `fira/docker-deploy/Dockerfile`
- **Deploy Stage**: Updates Kubernetes deployment via `deployment.yml` template
- **Requirements**: GitLab variables must be configured for Kubernetes access

## Important Development Guidelines

**File Creation Policy:**
- NEVER create files unless absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files
- Only create documentation files if explicitly requested by the user

**Task Execution:**
- Do what has been asked; nothing more, nothing less
- Focus on the specific task at hand without adding unnecessary features