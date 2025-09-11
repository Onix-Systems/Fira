
[![Landing Site](https://img.shields.io/badge/Website-Gecko%20Bootloader%20Parser%20SDK-blue?logo=web)](https://onix-systems-android-tasks.dev.onix.team/landing/index.html)
[![Wiki](https://img.shields.io/badge/Tool-GBL%20File%20Parser%20%26%20Builder-green?logo=tools)](https://github.com/Onix-Systems/Fira/wiki)

# Fira - Project Management Platform

Visual Kanban project management with task tracking and team collaboration.

## Features

- **Kanban Boards** - Organize tasks across workflow columns (Backlog → Progress → Review → Testing → Done)
- **Project Dashboard** - All projects overview with search and filtering
- **Task Management** - Drag-and-drop tasks with time tracking and comments
- **Team Collaboration** - Developer-specific task assignments and workflows
- **REST API** - Full API for task and project operations

## Quick Start

### Local Development (No Dependencies)

```bash
# 1. Clone repository
git clone https://github.com/Onix-Systems/Fira.git
cd Fira

# 2. Start server
cd web
./start.sh    # Linux/Mac
start.bat     # Windows

# 3. Open browser at http://localhost:8080
```

Requirements: Python 3.7+ (auto-detected)

### Production Deployment

#### Docker Setup

```bash
# 1. Clone repository
git clone https://github.com/Onix-Systems/Fira.git
cd Fira

# 2. Configure users (REQUIRED for production)
cp web/users.json.example web/users.json
# Edit users.json - add your admin credentials

# 3. Deploy
docker-compose -f docker-compose.prod.yml up -d

# 4. Access at http://localhost:8080
```

#### Manual Production Setup

```bash
# 1. Configure users
cp web/users.json.example web/users.json
# Edit users.json with your team credentials

# 2. Start production server
cd web
FIRA_REQUIRE_LOGIN=true python3 mini-server.py

# 3. Setup Nginx (optional)
# Copy web/nginx/nginx.conf to your Nginx config
# Proxy API calls to Python backend on port 8001
```


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

### Directory Structure
```
fira/
├── web/                    # Production web application
│   ├── mini-server.py     # Python HTTP server with API
│   ├── nginx/nginx.conf   # Nginx configuration
│   ├── Dockerfile         # Docker build configuration
│   ├── users.json         # User authentication (production)
│   └── *.js, *.css       # Frontend assets
├── .gitlab-ci.yml         # CI/CD pipeline configuration
├── deployment.yml         # Kubernetes deployment template
├── docker-compose.yml     # Development Docker setup
└── docker-compose.prod.yml # Production Docker setup
```

## Configuration

### User Management

Edit `web/users.json`:
```json
{
  "users": [
    {
      "id": "1",
      "username": "admin",
      "password": "your_secure_password",
      "role": "admin",
      "email": "admin@company.com"
    }
  ]
}
```

### Environment Variables
- `FIRA_PORT=8080` - Server port
- `FIRA_REQUIRE_LOGIN=true` - Enable authentication

## Testing

```bash
# Run tests
python test-task-creation.py
python test-admin-login.py
python test-git-integration.py
```

## Requirements

- **Browser**: Chrome, Firefox, Safari, Edge
- **Python**: 3.7+ (auto-installed by start scripts)
- **Storage**: ~10MB disk space

## Support

- Create an issue in this repository
- Contact: denys.kramar@onix-systems.com
