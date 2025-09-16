# Fira Web

> Production project management system with authentication and server API.

## Quick Start

**Windows:**
```bash
start.bat
```

**Linux/macOS:**
```bash
./start.sh
```

Opens http://localhost:8080 automatically. Login: admin/admin123

## Manual Start

```bash
# No dependencies required
python mini-server.py

# With dependencies
pip install -r requirements.txt
python mini-server.py
```

## Features

- User authentication and sessions
- Project management with file system
- Kanban board with full CRUD
- Analytics dashboard
- Release date calculator
- Admin panel at `/admin/`

## Configuration

Edit `users.json`:
```json
{
    "admin": {"password": "admin123", "role": "admin"},
    "user": {"password": "user123", "role": "user"}
}
```

Environment variables:
```bash
FIRA_PORT=8080              # Server port
FIRA_REQUIRE_LOGIN=true     # Force authentication
FIRA_PROJECTS_DIR=./projects # Projects directory
```

## Project Structure

```
projects/
├── project-name/
│   ├── README.md
│   ├── backlog/
│   ├── progress/dev-name/
│   ├── review/
│   ├── testing/
│   └── done/dev-name/
```

## Docker

```bash
docker build -t fira-web .
docker run -p 8080:8080 fira-web
```