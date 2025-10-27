# Docker Deployment

Production deployment with Nginx reverse proxy and containerization.

## Quick Start

```bash
# 1. Download and extract
wget https://github.com/Onix-Systems/Fira/releases/latest/download/fira.zip
unzip fira.zip
cd fira/docker-deploy

# 2. Build and run
docker build -t fira-web .
docker run -p 8080:80 fira-web

# 3. Access at http://localhost:8080
```

**Includes:** Nginx (port 80), Python backend (port 8001), Supervisor, caching, compression

## Configuration

**Custom port:**
```bash
docker run -p 3000:80 fira-web
```

**With environment variables:**
```bash
docker run -p 8080:80 \
  -e FIRA_REQUIRE_LOGIN=true \
  -e FIRA_PORT=8001 \
  fira-web
```

**With projects volume:**
```bash
docker run -p 8080:80 \
  -v /path/to/projects:/app/projects \
  fira-web
```

## Kubernetes Deployment

```bash
# Create secrets
kubectl create secret generic env-secrets \
  --from-literal=FIRA_REQUIRE_LOGIN=true \
  --from-literal=FIRA_PORT=8001 \
  -n your-namespace

# Deploy
envsubst < deployment.yml | kubectl apply -f -
```

## CI/CD Pipeline

GitLab CI auto-deploys on `fira` branch pushes.

**Required variables:** `BUILD_DOCKER_IMAGE`, `DEPLOY_DOCKER_IMAGE`, `DOCKER_REPOSITORY_IMAGE`, `K8S_NAMESPACE`, `K8S_HOSTNAME`, `CONTAINER_PORT`
