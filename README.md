# Fira - Modern Project Management Platform

Professional project management platform with Kanban boards, team collaboration, and flexible deployment options. Built for software development teams who need visual task management and seamless workflow integration.

**Landing Page:** [https://onix-systems-android-tasks.dev.onix.team/landing/index.html](https://onix-systems-android-tasks.dev.onix.team/landing/index.html)

## Features

### Core Functionality
- **Visual Kanban Boards** - Organize tasks across customizable workflow columns (Backlog, Progress, Review, Testing, Done)
- **Project Dashboard** - Overview of all projects with search, filtering, and quick project creation
- **Task Management** - Complete task lifecycle with drag-and-drop, comments, time tracking, and metadata
- **Team Collaboration** - Multi-developer workflows with developer-specific task assignments
- **Analytics & Reporting** - Project progress tracking, team performance metrics, and task distribution charts

### Technical Features
- **Dual Deployment Mode** - Local development server and production web application
- **File System Integration** - Direct folder access via Browser File System API (Chrome/Edge)
- **Git Integration** - Automatic version control for task state changes
- **Authentication System** - Secure user management with role-based access control
- **REST API** - Comprehensive API for task and project management operations

## Quick Start

### Option 1: Local Development

```bash
# Clone repository
git clone https://github.com/your-org/fira.git
cd fira

# Start local server
cd web
./start.sh    # Linux/Mac
start.bat     # Windows

# Open browser
open http://localhost:8080
```

### Option 2: Docker Deployment

```bash
# Clone repository
git clone https://github.com/your-org/fira.git
cd fira

# Development
docker-compose up -d

# Production (requires users.json configuration)
cp web/users.json.example web/users.json  # Configure users
docker-compose -f docker-compose.prod.yml up -d

# Access application
open http://localhost:8080
```

### Option 3: Kubernetes Deployment

```bash
# Clone repository
git clone https://github.com/your-org/fira.git
cd fira

# Configure users and SSH keys in k8s-deployment.yml
# Edit k8s-deployment.yml:
# 1. Update users.json ConfigMap with your admin credentials
# 2. Add base64-encoded SSH keys to fira-ssh-keys Secret
# 3. Update image registry to your Docker registry

# Deploy to cluster
kubectl apply -f k8s-deployment.yml

# Configure port forwarding
kubectl port-forward service/fira-service 8080:80

# Access application
open http://localhost:8080
```

## Architecture

### Application Structure
```
fira/
├── web/                    # Production web application
│   ├── mini-server.py     # Lightweight Python HTTP server with API
│   ├── pages/             # HTML templates
│   ├── *.js               # Frontend JavaScript modules
│   └── style.css          # Application styles
├── fira/code/             # Local development version
│   ├── server.py          # Flask API server
│   └── sources/           # Local-specific components
└── k8s-deployment.yml     # Kubernetes configuration
```

### Task Management System

Tasks are managed using a folder-based workflow system:

```
project-name/
├── backlog/              # New tasks awaiting assignment
├── progress/dev-name/    # Tasks in active development
├── review/dev-name/      # Tasks under code review
├── testing/dev-name/     # Tasks in QA/testing phase
└── done/dev-name/        # Completed tasks
```

Tasks are stored as Markdown files with YAML frontmatter:

```markdown
---
title: Implement user authentication
estimate: 4h
spent_time: 2h
status: progress
developer: john-doe
created_at: 2024-01-01T00:00:00Z
---

## Description
Implement secure user authentication system...

## Acceptance Criteria
- [ ] User registration
- [ ] Password validation
- [ ] Session management
```

## API Reference

### Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password"
}
```

### Project Management
```http
# List projects
GET /api/projects

# Create project
POST /api/projects
Content-Type: application/json

{
  "name": "project-name",
  "description": "Project description"
}

# Get project tasks
GET /api/projects/{project_id}/tasks
```

### Task Operations
```http
# Create task
POST /api/tasks
Content-Type: application/json

{
  "title": "Task title",
  "description": "Task description",
  "project": "project-name",
  "status": "backlog"
}

# Update task
PUT /api/tasks/{task_id}

# Move task
POST /api/tasks/{task_id}/move
Content-Type: application/json

{
  "status": "progress",
  "developer": "john-doe"
}
```

## Configuration

### Environment Variables
```bash
# Server configuration
FIRA_PORT=8080                    # Server port
FIRA_REQUIRE_LOGIN=true          # Enable authentication

# Git integration
GIT_AUTHOR_NAME="Fira System"    # Git commit author
GIT_AUTHOR_EMAIL="system@fira"   # Git commit email

# Firebase integration (optional)
FIREBASE_PROJECT_ID=your-project
```

### User Management
Configure users in `web/users.json`:
```json
{
  "users": [
    {
      "id": "1",
      "username": "admin",
      "password": "secure_password",
      "role": "admin",
      "email": "admin@company.com",
      "git_name": "Admin User",
      "git_email": "admin@company.com"
    }
  ]
}
```

## Deployment Options

### Local Development
- **Target**: Development and testing
- **Requirements**: Python 3.7+, modern web browser
- **Features**: File system integration, hot reload, no authentication

### Production Web Server
- **Target**: Team collaboration and production use
- **Requirements**: Python 3.7+, Docker (optional)
- **Features**: User authentication, API endpoints, Git integration

### Kubernetes Cluster
- **Target**: Enterprise deployment and scaling
- **Requirements**: Kubernetes cluster, persistent storage
- **Features**: Auto-scaling, high availability, load balancing

## System Requirements

- **Browser**: Chrome, Firefox, Safari, Edge (modern versions)
- **Python**: 3.7+ (for server deployment)
- **Storage**: ~10MB disk space
- **Network**: Internet connection required for team collaboration features

## Development

### Prerequisites
```bash
# Install Python dependencies
pip install -r web/requirements.txt

# Flask==2.3.3
# Flask-CORS==4.0.0 
# PyYAML==6.0.1
```

### Running Tests
```bash
# Task management tests
python test-task-creation.py
python test-task-deletion.py

# Authentication tests  
python test-admin-login.py

# Git integration tests
python test-git-integration.py
python test-git-config.py
```

### Project Structure
- **Frontend**: Vanilla JavaScript, modern ES6+ features
- **Backend**: Python with Flask framework for API server
- **Storage**: File system based with Git version control
- **Authentication**: JWT-style session management
- **API**: RESTful endpoints with JSON responses

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Make changes and test thoroughly
4. Commit changes (`git commit -am 'Add new feature'`)
5. Push to branch (`git push origin feature/new-feature`)
6. Create Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in this repository
- Contact: sales@onix-systems.com
- Documentation: [Landing Page](https://onix-systems-android-tasks.dev.onix.team/landing/index.html)

---

Built with modern web technologies for efficient project management and team collaboration.