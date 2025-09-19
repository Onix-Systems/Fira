# Docker Deployment Guide

## Quick Start

```bash
cd fira/docker-deploy
docker build -t fira-web .
docker run -p 8080:80 fira-web
```

Open http://localhost:8080

## Components

### Dockerfile
- **Multi-stage build**: Base Python app + Production Nginx
- **Dependencies**: Auto-installs Flask, Flask-CORS, PyYAML
- **Supervisor**: Manages both Nginx and Python processes
- **Port**: Exposes port 80 (Nginx frontend)

### Nginx (nginx/nginx.conf)
- **Reverse Proxy**: Routes `/api/*` to Python backend (port 8001)
- **Static Files**: Serves JS/CSS/images directly from `/app`
- **SPA Routing**: Handles client-side navigation
- **Caching**: 1-year cache for assets, no-cache for HTML/admin
- **Compression**: Gzip enabled for better performance

### Environment Variables
- `FIRA_REQUIRE_LOGIN=true` - Forces authentication
- `FIRA_PORT=8001` - Python backend port (internal)

## Production Deployment

### Docker Run
```bash
docker run -d \
  --name fira-app \
  -p 80:80 \
  -v /host/projects:/app/projects \
  -v /host/users.json:/app/users.json \
  fira-web
```

### Docker Compose
```yaml
version: '3.8'
services:
  fira:
    build: .
    ports:
      - "80:80"
    volumes:
      - ./projects:/app/projects
      - ./users.json:/app/users.json
    environment:
      - FIRA_REQUIRE_LOGIN=true
    restart: unless-stopped
```

### Kubernetes (deployment.yml)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fira-web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: fira-web
  template:
    metadata:
      labels:
        app: fira-web
    spec:
      containers:
      - name: fira
        image: fira-web:latest
        ports:
        - containerPort: 80
        env:
        - name: FIRA_REQUIRE_LOGIN
          value: "true"
        volumeMounts:
        - name: projects-storage
          mountPath: /app/projects
        - name: users-config
          mountPath: /app/users.json
          subPath: users.json
      volumes:
      - name: projects-storage
        persistentVolumeClaim:
          claimName: fira-projects-pvc
      - name: users-config
        configMap:
          name: fira-users-config
---
apiVersion: v1
kind: Service
metadata:
  name: fira-web-service
spec:
  selector:
    app: fira-web
  ports:
  - port: 80
    targetPort: 80
  type: LoadBalancer
```

## CI/CD Pipeline

### GitHub Actions (.github/workflows/deploy.yml)
```yaml
name: Deploy Fira
on:
  push:
    branches: [main, master]
    paths: ['fira/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Build Docker image
      run: |
        cd fira/docker-deploy
        docker build -t fira-web:${{ github.sha }} .
        docker tag fira-web:${{ github.sha }} fira-web:latest

    - name: Push to registry
      run: |
        echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
        docker push fira-web:${{ github.sha }}
        docker push fira-web:latest

    - name: Deploy to production
      run: |
        docker run -d \
          --name fira-app-${{ github.sha }} \
          -p 80:80 \
          fira-web:${{ github.sha }}
```

## Troubleshooting

### Logs
```bash
docker logs fira-app
```

### Health Check
```bash
curl http://localhost:8080/api/health
```

### User Management
Edit mounted `users.json`:
```json
{
  "users": [
    {
      "username": "admin",
      "password": "secure_password",
      "role": "admin"
    }
  ]
}
```

### Default Login
- Username: `admin`
- Password: `admin123`

Change in production!