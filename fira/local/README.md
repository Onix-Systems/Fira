# Fira Local

> File-based project management system for offline use with direct file system access.

## Quick Start

1. Open `index.html` in Chrome or Edge (86+)
2. Click "Choose Folder" and select your projects directory
3. Browse projects and manage tasks

## Project Structure

```
your-projects-folder/
├── project-name/
│   ├── README.md
│   ├── backlog/
│   ├── progress/dev-name/
│   ├── review/
│   ├── testing/
│   └── done/
```

## Features

- Project dashboard with statistics
- Kanban board with drag & drop
- Date calculator for release planning
- Works offline with Chrome/Edge File System API

## Alternative Setup

```bash
# If you need a local server
python -m http.server 8080
```

## Task Format

```markdown
---
title: Task Title
estimate: 4h
developer: dev-name
---

# Description
Task details...
```