# Fira Docker Deploy

Production Docker deployment with Nginx reverse proxy and containerization.

## Project Structure for Deployment

For proper deployment, your project structure should be:
```
project-root/
├── cicd/                   # CI/CD pipeline configurations
├── docker-deployment/      # Docker deployment files
├── web/                   # All Fira application code
│   ├── mini-server.py
│   ├── index.html
│   ├── project-board.js
│   ├── api-client.js
│   ├── projects/
│   └── ...all other Fira files
└── README.md
```

All Fira application code must be moved to the `web/` folder before deployment.

## Quick Start

```bash
# Build Docker image
docker build -t fira-web .

# Run container
docker run -p 8080:80 fira-web

# Access application
# URL: http://localhost:8080 (or http://your-server-ip:8080)
```

## CI/CD Pipeline

### GitLab CI/CD Configuration

Create `.gitlab-ci.yml` in your project root:

```yaml
stages:
  - build
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

before_script:
  - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY

build:
  stage: build
  image: docker:20.10.16
  services:
    - docker:20.10.16-dind
  script:
    - cd docker-deployment
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA $CI_REGISTRY_IMAGE:latest
    - docker push $CI_REGISTRY_IMAGE:latest
  only:
    - master
    - main

deploy:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
  script:
    - ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_HOST "
        docker pull $CI_REGISTRY_IMAGE:latest &&
        docker stop fira-web || true &&
        docker rm fira-web || true &&
        docker run -d --name fira-web -p 8080:80
        -e FIRA_REQUIRE_LOGIN=true
        -e FIRA_PORT=8001
        $CI_REGISTRY_IMAGE:latest"
  only:
    - master
    - main
```

### Required GitLab CI/CD Variables

Set these variables in GitLab Project Settings > CI/CD > Variables:

```bash
CI_REGISTRY_IMAGE          # GitLab registry image path
SSH_PRIVATE_KEY            # SSH private key for server access
SERVER_HOST                # Your server IP or domain
SERVER_USER                # SSH username for server
```

## Docker Deployment

### Dockerfile Structure

The deployment uses multi-stage Docker build:

1. **Base Stage**: Python environment setup
2. **Web Stage**: Nginx configuration and static files
3. **Production Stage**: Supervisor process management

### Build Process

```bash
# Navigate to docker-deployment directory
cd docker-deployment

# Build with custom tag
docker build -t fira-web:v1.0 .

# Build with latest tag
docker build -t fira-web:latest .
```

### Container Management

```bash
# Start container with custom configuration
docker run -d --name fira-web \
  -p 8080:80 \
  -e FIRA_REQUIRE_LOGIN=true \
  -e FIRA_PORT=8001 \
  -e FIRA_PROJECTS_DIR=/app/projects \
  -v /path/to/projects:/app/projects \
  fira-web:latest

# View container logs
docker logs fira-web

# Stop container
docker stop fira-web

# Remove container
docker rm fira-web

# Restart container
docker restart fira-web
```

### Installation on Ubuntu Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose (optional)
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again to apply docker group changes
```

### Firewall Configuration

```bash
# Allow HTTP traffic
sudo ufw allow 8080/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw --force enable
```

### SSL/HTTPS Setup with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Update Nginx configuration to use SSL
# Edit nginx.conf to include SSL directives
```

## URL Formation and Access

### Default Access URLs

```bash
# Local development
http://localhost:8080

# Server deployment
http://your-server-ip:8080
http://your-domain.com:8080

# With SSL (port 443)
https://your-domain.com
```

### Nginx Reverse Proxy Configuration

The Docker container exposes:
- **Port 80**: Nginx frontend (mapped to host port 8080)
- **Port 8001**: Python backend (internal)

URL routing through Nginx:
```
Client Request → Nginx (Port 80) → Python Backend (Port 8001)
```

### Custom Domain Setup

1. **DNS Configuration**: Point your domain to server IP
2. **Nginx Virtual Host**: Configure domain in nginx.conf
3. **SSL Certificate**: Use Let's Encrypt for HTTPS
4. **Port Mapping**: Map container port 80 to host port 80/443

## Environment Configuration

### Production Environment Variables

```bash
# Required variables
FIRA_PORT=8001                    # Backend server port
FIRA_REQUIRE_LOGIN=true           # Enable authentication
FIRA_PROJECTS_DIR=/app/projects   # Projects storage path

# Optional variables
FIRA_DEBUG=false                  # Disable debug mode
FIRA_LOG_LEVEL=INFO              # Logging level
FIRA_SESSION_TIMEOUT=3600        # Session timeout in seconds
```

### Volume Mounting for Persistence

```bash
# Mount projects directory for data persistence
docker run -d --name fira-web \
  -p 8080:80 \
  -v /host/path/projects:/app/projects \
  -v /host/path/users.json:/app/users.json \
  fira-web:latest
```

## Health Checks and Monitoring

### Container Health Check

```bash
# Check container health
docker exec fira-web curl -f http://localhost:80/health || exit 1

# View health status
docker inspect --format='{{.State.Health.Status}}' fira-web
```

### Log Monitoring

```bash
# View real-time logs
docker logs -f fira-web

# View last 100 lines
docker logs --tail 100 fira-web

# Filter logs by service
docker logs fira-web 2>&1 | grep nginx
docker logs fira-web 2>&1 | grep python
```

## Features

- Nginx reverse proxy with static file serving
- Python backend API server on port 8001
- Supervisor process management
- Production optimizations with caching and compression
- Health checks and monitoring
- SSL/HTTPS support ready
- Auto-restart on failure
- Volume mounting for data persistence

## Troubleshooting

### Common Issues

1. **Port already in use**: Change host port mapping
2. **Permission denied**: Check Docker group membership
3. **SSL certificate issues**: Verify domain DNS configuration
4. **Container won't start**: Check environment variables and volumes