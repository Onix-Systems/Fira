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

Opens http://localhost:8080 automatically. Admin login uses the password from `FIRA_ADMIN_PASSWORD` (or the temporary one printed in the server log).

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

Copy `users.example.json` to `users.json` and set your own users and passwords.
`users.json` is git-ignored so credentials never end up in the repository.

Environment variables:
```bash
FIRA_PORT=8080              # Server port
FIRA_REQUIRE_LOGIN=true     # Force authentication
FIRA_PROJECTS_DIR=./projects # Projects directory
```

`FIRA_ADMIN_PASSWORD` sets the admin password. If it is not set, the server generates a temporary one on every start and prints it to the log, so set it explicitly for production (e.g. `docker run -e FIRA_ADMIN_PASSWORD=... ...`).

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