# Fira Docker Deploy

Production Docker deployment with Nginx reverse proxy and containerization.

## Quick Start

```bash
docker build -t fira-web .
docker run -p 8080:80 fira-web
```

## Features

- Nginx reverse proxy with static file serving
- Python backend API server on port 8001
- Supervisor process management
- Production optimizations with caching and compression
- Health checks and monitoring

## Configuration

Environment variables:
```bash
FIRA_PORT=8001              # Backend server port
FIRA_REQUIRE_LOGIN=true     # Force authentication
FIRA_PROJECTS_DIR=/app/projects # Projects directory
```

## Production Setup

1. Build image: `docker build -t fira-web .`
2. Run container: `docker run -p 8080:80 fira-web`
3. Access at http://localhost:8080

For Kubernetes deployment and CI/CD pipelines, see main README.md.