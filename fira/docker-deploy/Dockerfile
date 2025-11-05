FROM python:3.11-slim AS base
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy web application files
COPY . .

# Debug: List files to verify web app structure
RUN echo "=== Verifying file structure ===" && \
    ls -la . && \
    echo "=== Admin directory ===" && \
    ls -la ./admin/ && \
    echo "=== Users JSON file ===" && \
    ls -la ./users.json || echo "Users JSON file not found - will create default"

# Install Python dependencies if requirements.txt exists
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

# Verify basic Python dependencies
RUN python3 -c "import flask; print('✅ Flask installed')" && \
    python3 -c "import json; print('✅ JSON support ready')"

# Create resources directory if it doesn't exist
RUN mkdir -p resources

# Setup nginx
FROM nginx:stable-alpine AS deploy

# Install basic Alpine packages with --break-system-packages approach
RUN apk add --no-cache python3 py3-pip supervisor curl

# Copy nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy web application
COPY --from=base /app /app

# Install Python dependencies using --break-system-packages
WORKDIR /app
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt || \
    pip install --no-cache-dir --break-system-packages flask flask-cors pyyaml

# Verify JSON-based authentication is ready
RUN python3 -c "import json; print('✅ JSON module ready')" && \
    python3 -c "import flask; print('✅ Flask installed successfully')" && \
    (ls -la users.json && echo "✅ Users JSON file found" || \
     echo "⚠️ No users.json file found - will use default users")

# Create supervisor configuration
RUN echo '[supervisord]' > /etc/supervisord.conf && \
    echo 'nodaemon=true' >> /etc/supervisord.conf && \
    echo 'user=root' >> /etc/supervisord.conf && \
    echo '' >> /etc/supervisord.conf && \
    echo '[program:nginx]' >> /etc/supervisord.conf && \
    echo 'command=nginx -g "daemon off;"' >> /etc/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisord.conf && \
    echo '' >> /etc/supervisord.conf && \
    echo '[program:api]' >> /etc/supervisord.conf && \
    echo 'command=python3 /app/mini-server.py' >> /etc/supervisord.conf && \
    echo 'directory=/app' >> /etc/supervisord.conf && \
    echo 'environment=FIRA_REQUIRE_LOGIN="true",FIRA_PORT="8001"' >> /etc/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisord.conf && \
    echo 'stdout_logfile=/dev/stdout' >> /etc/supervisord.conf && \
    echo 'stdout_logfile_maxbytes=0' >> /etc/supervisord.conf && \
    echo 'stderr_logfile=/dev/stderr' >> /etc/supervisord.conf && \
    echo 'stderr_logfile_maxbytes=0' >> /etc/supervisord.conf

# Final configuration
WORKDIR /app
EXPOSE 80
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]