#!/usr/bin/env python3
"""
Mini Fira Server - Enhanced with Firebase Admin SDK
Supports both standard library and Firebase features
"""

import http.server
import socketserver
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import re
from datetime import datetime
import shutil
from urllib.parse import unquote
import secrets

# Removed LOCAL_USERS_DB - now using users.json file exclusively

# Firebase integration disabled - using local JSON file
FIREBASE_ENABLED = False
print("Using local users.json file for authentication")

# Local users file management
def load_users():
    """Load users from JSON file"""
    users_file = Path(os.getcwd()) / 'users.json'
    try:
        if users_file.exists():
            with open(users_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('users', [])
        return []
    except Exception as e:
        print(f"Error loading users.json: {e}")
        return []

def save_users(users):
    """Save users to JSON file"""
    users_file = Path(os.getcwd()) / 'users.json'
    try:
        data = {'users': users}
        with open(users_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving users.json: {e}")
        return False

def authenticate_user(email, password):
    """Authenticate user via local JSON file"""
    users = load_users()
    for user in users:
        if (user.get('email') == email or user.get('username') == email) and user.get('password') == password:
            if user.get('active', True):
                return {
                    'id': user['id'],
                    'email': user['email'],
                    'username': user['username'],
                    'role': user['role'],
                    'created_at': user.get('created_at')
                }
    return None

def validate_admin_credentials(username, password):
    """Validate admin credentials from users.json"""
    users = load_users()
    for user in users:
        if (user.get('username') == username or user.get('email') == username):
            if user.get('password') == password and user.get('role') in ['editor', 'admin']:
                return True
    return False

def create_user(email, username, role='viewer', password=None, ip_address=None):
    """Create a new user in users.json"""
    users = load_users()

    # Check if user already exists
    for user in users:
        if user.get('email') == email or user.get('username') == username:
            return False

    # Generate new user ID
    import time
    new_id = str(int(time.time()))

    new_user = {
        'id': new_id,
        'email': email,
        'username': username,
        'password': password,
        'role': role,
        'active': True,
        'created_at': datetime.now().isoformat(),
        'ip_address': ip_address
    }

    users.append(new_user)
    return save_users(users)

def get_user_by_email(email):
    """Get user by email from users.json"""
    users = load_users()
    for user in users:
        if user.get('email') == email:
            return user
    return None

def log_user_activity(user_id, activity, details=None):
    """Log user activity (simplified for JSON storage)"""
    print(f"📝 Activity logged: {activity} for user {user_id}")
    pass  # In a full implementation, this could write to a separate activity log file

# Configuration
# Use user-selected working directory or default to projects/ subfolder
WORKING_DIRECTORY = os.environ.get('FIRA_WORKING_DIR', os.getcwd())
PROJECTS_BASE_DIR = os.path.join(WORKING_DIRECTORY, 'projects')  # Use projects/ subfolder in working directory
PORT = int(os.environ.get('FIRA_PORT', 5000))
REQUIRE_LOGIN = os.environ.get('FIRA_REQUIRE_LOGIN', 'false').lower() == 'true'

# Admin configuration
ADMIN_PASSWORD = '3Bm6iDAY46vK57aj'
active_admin_tokens = set()

# Generate persistent admin token (same every restart for same password)
import hashlib
def generate_persistent_token(password):
    """Generate same token for same password across restarts"""
    return hashlib.sha256(f"{password}-{ADMIN_PASSWORD}".encode()).hexdigest()[:32]

# Local user management functions
def get_all_users():
    """Get all users from users.json"""
    users = load_users()
    for user in users:
        # Add timestamp conversion if needed
        if isinstance(user.get('created_at'), str):
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(user['created_at'].replace('Z', '+00:00'))
                user['created_at'] = int(dt.timestamp() * 1000)
            except:
                user['created_at'] = None
    return users

def update_user(user_id, data):
    """Update user in users.json"""
    users = load_users()
    for user in users:
        if user['id'] == user_id:
            user.update(data)
            return save_users(users)
    return False

def delete_user_by_id(user_id):
    """Delete user from users.json"""
    users = load_users()
    users = [user for user in users if user['id'] != user_id]
    return save_users(users)



class ProjectManager:
    def __init__(self, base_dir):
        self.base_dir = Path(base_dir)

    def create_project(self, project_data):
        """Create a new project folder with standard subfolders and README"""
        project_id = project_data.get('id')
        if not project_id:
            print("Missing project ID")
            return False, "Missing project ID"

        project_path = self.base_dir / project_id
        if project_path.exists():
            print(f"Project already exists: {project_id}")
            return False, f"Project {project_id} already exists"

        try:
            # Створюємо головну папку проекту
            project_path.mkdir(parents=True, exist_ok=False)
            print(f"Created project folder: {project_path}")

            # Створюємо README.md
            description = project_data.get('description', f"Project {project_id}")
            readme_file = project_path / 'README.md'
            readme_file.write_text(f"# {description}\n", encoding='utf-8')
            print(f"📄 Created README.md for project {project_id}")

            # Стандартні колонки
            columns = ['backlog', 'inprogress', 'review', 'done', 'testing']
            default_dev = 'default-dev'

            for col in columns:
                col_path = project_path / col
                col_path.mkdir(parents=True, exist_ok=True)
                # Створюємо папку розробника для всіх колонок включаючи backlog
                # Це виправляє проблему з переміщенням тасок з однаковими іменами
                dev_path = col_path / default_dev
                dev_path.mkdir(parents=True, exist_ok=True)

            print(f"Created standard project folders: {', '.join(columns)}")
            return True, None

        except Exception as e:
            print(f"Error creating project {project_id}: {e}")
            return False, str(e)

    def get_projects(self):
        """Get list of all projects"""
        projects = []
        if not self.base_dir.exists():
            print(f"⚠️  Projects directory not found: {self.base_dir}")
            return projects

        print(f"Scanning projects directory: {self.base_dir}")

        for project_dir in self.base_dir.iterdir():
            if project_dir.is_dir() and not project_dir.name.startswith('.'):
                project_info = self.get_project_info(project_dir.name)
                if project_info:
                    projects.append(project_info)
                    print(f"Added project: {project_dir.name}")

        print(f"Total projects found: {len(projects)}")
        return projects

    def get_project_info(self, project_id):
        """Get project information"""
        project_path = self.base_dir / project_id
        if not project_path.exists():
            return None

        # Read README.md if exists
        readme_path = project_path / 'README.md'
        description = f'Project {project_id}'
        if readme_path.exists():
            try:
                content = readme_path.read_text(encoding='utf-8').strip()
                first_line = content.split('\n')[0].replace('#', '').strip()
                if first_line:
                    description = first_line
            except Exception as e:
                print(f"⚠️  Could not read README for {project_id}: {e}")

        # Calculate task statistics
        stats = self.calculate_project_stats(project_id)
        
        # Get developer list
        developers = self.get_project_developers(project_id)

        return {
            'id': project_id,
            'name': project_id,
            'description': description,
            'stats': stats,
            'developers': developers
        }

    def calculate_project_stats(self, project_id):
        """Calculate task statistics for a project"""
        project_path = self.base_dir / project_id
        stats = {
            'backlog': {'count': 0, 'detail': '(0h)'},
            'inProgress': {'count': 0, 'detail': '(0 devs)'},
            'done': {'count': 0, 'detail': '(0h)'}
        }

        # Count tasks in folders supporting both naming conventions
        folder_mappings = [
            (['backlog'], 'backlog'),
            (['progress', 'inprogress'], 'inProgress'),
            (['done'], 'done')
        ]

        for folders, stat_key in folder_mappings:
            total_tasks = 0
            developers = set()

            for folder in folders:
                folder_path = project_path / folder
                if folder_path.exists():
                    # Count direct .md files (excluding README.md)
                    task_files = [f for f in folder_path.glob('*.md') if f.name.lower() != 'readme.md']
                    total_tasks += len(task_files)

                    # Count files in developer subfolders for all status including backlog
                    for dev_folder in folder_path.iterdir():
                        if dev_folder.is_dir() and not dev_folder.name.lower().startswith('readme'):
                            dev_tasks = [f for f in dev_folder.glob('*.md') if f.name.lower() != 'readme.md']
                            total_tasks += len(dev_tasks)
                            if folder in ['progress', 'inprogress']:
                                developers.add(dev_folder.name)

            stats[stat_key]['count'] = total_tasks
            if stat_key == 'inProgress':
                stats[stat_key]['detail'] = f'({len(developers)} devs)'

        return stats

    def get_project_developers(self, project_id):
        """Get list of developers from project folder structure"""
        project_path = self.base_dir / project_id
        developers = set()
        
        if not project_path.exists():
            return []

        # Check all status folders for developer directories
        status_folders = ['progress', 'inprogress', 'review', 'testing', 'done']
        
        for folder_name in status_folders:
            folder_path = project_path / folder_name
            if folder_path.exists():
                # List all subdirectories in status folder
                for item in folder_path.iterdir():
                    if item.is_dir() and (item.name.startswith('dev-') or item.name.startswith('tech-')):
                        developers.add(item.name)
                        print(f"Found developer folder: {item.name} in {folder_name}")

        developer_list = sorted(list(developers))
        print(f"👥 Found {len(developer_list)} developers for project {project_id}: {developer_list}")
        return developer_list

    def get_project_tasks(self, project_id):
        """Get all tasks for a project"""
        project_path = self.base_dir / project_id
        if not project_path.exists():
            return []

        tasks = []

        # Folder mapping for task status
        folder_mappings = {
            'backlog': 'backlog',
            'progress': 'progress',
            'inprogress': 'progress',  # Alternative naming
            'review': 'review',
            'testing': 'testing',
            'done': 'done'
        }

        for folder_name, status in folder_mappings.items():
            folder_path = project_path / folder_name
            if folder_path.exists():
                # Check for direct .md files first (tasks without assigned developer)
                for task_file in folder_path.glob('*.md'):
                    if task_file.name.lower() != 'readme.md':
                        task = self.parse_task_file(task_file)
                        if task:
                            task['column'] = status
                            task['projectId'] = project_id
                            tasks.append(task)

                # Check developer subfolders (for all statuses)
                for item in folder_path.iterdir():
                    if item.is_dir() and not item.name.startswith('.'):
                        for task_file in item.glob('*.md'):
                            if task_file.name.lower() != 'readme.md':
                                task = self.parse_task_file(task_file)
                                if task:
                                    task['column'] = status
                                    task['projectId'] = project_id
                                    task['developer'] = item.name
                                    tasks.append(task)

        return tasks

    def parse_task_file(self, file_path):
        """Parse a task markdown file with YAML frontmatter"""
        try:
            content = file_path.read_text(encoding='utf-8')

            # Check for YAML frontmatter
            if content.startswith('---'):
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    yaml_content = parts[1].strip()
                    markdown_content = parts[2].strip()
                else:
                    yaml_content = ''
                    markdown_content = content
            else:
                yaml_content = ''
                markdown_content = content

            # Simple YAML parsing (avoiding PyYAML dependency)
            metadata = {}
            if yaml_content:
                for line in yaml_content.split('\n'):
                    line = line.strip()
                    if ':' in line:
                        key, value = line.split(':', 1)
                        key = key.strip()
                        value = value.strip().strip('\'"')
                        metadata[key] = value

            # Extract task ID from filename
            task_id = file_path.stem

            # Build task object
            task = {
                'id': task_id,
                'title': metadata.get('title', task_id.replace('-', ' ').title()),
                'content': markdown_content,
                'fullContent': content,
                'timeEstimate': metadata.get('estimate', '0h'),
                'timeSpent': metadata.get('spent_time', '0h'),
                'priority': metadata.get('priority', 'medium'),
                'developer': metadata.get('developer'),
                'assignee': metadata.get('developer'),  # Alias
                'status': metadata.get('status', 'backlog'),
                'created': metadata.get('created', ''),
                'file_path': str(file_path)
            }

            return task

        except Exception as e:
            print(f"Error parsing task file {file_path}: {e}")
            return None
            
    def update_project_info(self, project_id, project_data):
        """Update project information"""
        try:
            project_path = self.base_dir / project_id
            if not project_path.exists():
                print(f"Project {project_id} does not exist")
                return False
                
            # Update project description in README.md if provided
            if 'description' in project_data:
                readme_path = project_path / 'README.md'
                
                # Create or update README.md with project description
                description = project_data['description'].strip()
                if description:
                    # Create a simple README format
                    readme_content = f"# {project_id}\n\n{description}\n"
                    
                    readme_path.write_text(readme_content, encoding='utf-8')
                    print(f"Updated README.md for project {project_id}")
                
            return True
            
        except Exception as e:
            print(f"Error updating project {project_id}: {e}")
            return False

class FiraRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.project_manager = ProjectManager(PROJECTS_BASE_DIR)
        super().__init__(*args, **kwargs)


    def get_client_ip(self):
        """Get client IP address from request headers"""
        # Try X-Forwarded-For first (for reverse proxy)
        forwarded = self.headers.get('X-Forwarded-For')
        if forwarded:
            return forwarded.split(',')[0].strip()

        # Try X-Real-IP (nginx)
        real_ip = self.headers.get('X-Real-IP')
        if real_ip:
            return real_ip.strip()

        # Fallback to client address
        return self.client_address[0]

    def do_DELETE(self):
        """Handle DELETE requests for deleting a project"""
        parsed_path = urlparse(self.path)
        path_parts = parsed_path.path.strip('/').split('/')

        # Очікуваний формат: /api/projects/{project_id}
        if len(path_parts) == 3 and path_parts[0] == 'api' and path_parts[1] == 'projects':
            try:
                project_id = unquote(path_parts[2])
                project_path = self.project_manager.base_dir / project_id

                if not project_path.exists():
                    self.send_json_response({
                        'success': False,
                        'error': f'Project {project_id} not found'
                    }, 404)
                    return

                # Видалення папки проекту
                shutil.rmtree(project_path)
                print(f"🗑️ Deleted project: {project_id}")

                self.send_json_response({
                    'success': True,
                    'message': f'Project {project_id} deleted'
                }, 200)

            except Exception as e:
                print(f"Error deleting project: {e}")
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
        else:
            self.send_response(404)
            self.end_headers()

    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()



    def do_GET(self):
        parsed_path = urlparse(self.path)

        # API endpoints
        if parsed_path.path == '/api/status':
            users = load_users()
            self.send_json_response({
                'status': 'ok',
                'message': 'Mini Fira server is running',
                'version': '1.0.0-mini',
                'projects_dir': str(self.project_manager.base_dir),
                'require_login': REQUIRE_LOGIN,
                'firebase_enabled': FIREBASE_ENABLED,
                'firebase_available': False,
                'firebase_status': 'disabled - using local JSON',
                'users_count': len(users)
            })
            return

        elif parsed_path.path == '/api/working-directory':
            self.send_json_response({
                'success': True,
                'working_directory': WORKING_DIRECTORY,
                'projects_base_dir': str(self.project_manager.base_dir)
            })
            return

        elif parsed_path.path == '/api/get-stored-email':
            # Simplified - no email storage in JSON mode
            self.send_json_response({
                'success': False,
                'email': None,
                'method': 'local_json'
            })
            return

        elif parsed_path.path == '/api/projects':
            try:
                projects = self.project_manager.get_projects()
                self.send_json_response({
                    'success': True,
                    'projects': projects
                })
                print(f"📤 Served {len(projects)} projects via API")
            except Exception as e:
                print(f"API Error: {e}")
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
            return

        elif parsed_path.path.startswith('/api/projects/') and '/tasks/' in parsed_path.path:
            # Get single task for a project
            # Expected format: /api/projects/{project_id}/tasks/{task_id}
            path_parts = parsed_path.path.strip('/').split('/')
            if len(path_parts) == 5 and path_parts[3] == 'tasks':
                try:
                    from urllib.parse import unquote
                    project_id = unquote(path_parts[2])
                    task_id = unquote(path_parts[4])

                    # Get all tasks and find the specific one
                    tasks = self.project_manager.get_project_tasks(project_id)
                    task = next((t for t in tasks if t['id'] == task_id), None)

                    if task:
                        self.send_json_response({
                            'success': True,
                            'task': task
                        })
                        print(f"📤 Served task {task_id} from project {project_id}")
                    else:
                        self.send_json_response({
                            'success': False,
                            'error': f'Task {task_id} not found in project {project_id}'
                        }, 404)
                        print(f"Task {task_id} not found in project {project_id}")
                except Exception as e:
                    print(f"API Error getting task: {e}")
                    self.send_json_response({
                        'success': False,
                        'error': str(e)
                    }, 500)
            return

        elif parsed_path.path.startswith('/api/projects/') and parsed_path.path.endswith('/tasks'):
            # Get tasks for a specific project
            # Expected format: /api/projects/{project_id}/tasks
            path_parts = parsed_path.path.strip('/').split('/')
            if len(path_parts) == 4 and path_parts[3] == 'tasks':
                try:
                    from urllib.parse import unquote
                    project_id = unquote(path_parts[2])
                    tasks = self.project_manager.get_project_tasks(project_id)
                    self.send_json_response({
                        'success': True,
                        'tasks': tasks
                    })
                    print(f"📤 Served {len(tasks)} tasks for project {project_id}")
                except Exception as e:
                    print(f"API Error getting tasks: {e}")
                    self.send_json_response({
                        'success': False,
                        'error': str(e)
                    }, 500)
            else:
                self.send_error(404, "Invalid tasks API endpoint")
            return

        # Admin data endpoint
        elif parsed_path.path == '/api/admin/data':
            # Check admin token
            token = self.headers.get('x-admin-token')
            if not token or token not in active_admin_tokens:
                self.send_json_response({
                    'success': False,
                    'error': 'Unauthorized'
                }, 401)
                return

            try:
                users = get_all_users()
                self.send_json_response({
                    'success': True,
                    'apps': users,  # Keep 'apps' key for compatibility with admin panel
                    'users': users,  # Also provide 'users' key for clarity
                    'method': 'local_json'
                })
                print(f"📤 Served {len(users)} users from JSON file to admin")
            except Exception as e:
                print(f"Error loading users: {e}")
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
            return

        # Check if it's an image serving endpoint
        # Expected format: /api/projects/{project_id}/images/{filename}
        path_parts = parsed_path.path.strip('/').split('/')
        if (len(path_parts) == 5 and
            path_parts[0] == 'api' and
            path_parts[1] == 'projects' and
            path_parts[3] == 'images'):

            try:
                from urllib.parse import unquote
                project_id = unquote(path_parts[2])
                filename = unquote(path_parts[4])

                # Find project directory
                project_path = Path(PROJECTS_BASE_DIR) / project_id
                if not project_path.exists():
                    self.send_error(404, f'Project "{project_id}" not found')
                    return

                images_dir = project_path / 'images'
                if not images_dir.exists():
                    self.send_error(404, 'Images directory not found')
                    return

                image_path = images_dir / filename
                if not image_path.exists():
                    self.send_error(404, f'Image "{filename}" not found')
                    return

                # Serve the image file
                import mimetypes
                mime_type, _ = mimetypes.guess_type(str(image_path))
                if not mime_type:
                    mime_type = 'application/octet-stream'

                with open(image_path, 'rb') as f:
                    content = f.read()

                self.send_response(200)
                self.send_header('Content-Type', mime_type)
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                print(f"🖼️ Served image: {image_path}")
                return

            except Exception as e:
                print(f"Error serving image: {e}")
                self.send_error(500, f'Error serving image: {str(e)}')
                return

        elif parsed_path.path.startswith('/project/') or parsed_path.path.startswith('/analytics'):
            # Serve index.html for client-side routing (simplified version)
            try:
                with open('index.html', 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                print(f"📄 Served index.html for SPA route: {parsed_path.path}")
            except FileNotFoundError:
                self.send_error(404, "index.html not found")
            return

        # Handle root path - serve login only if required
        elif parsed_path.path == '/' or parsed_path.path == '/index.html':
            if REQUIRE_LOGIN:
                # Serve login screen for Docker/nginx deployment
                print(f"Root path accessed - serving login screen (login required)")
                try:
                    with open('login-screen.html', 'rb') as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html')
                    self.send_header('Content-Length', str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                    print(f"📄 Served login screen for root path")
                except FileNotFoundError:
                    self.send_error(404, "login-screen.html not found")
                return
            else:
                # For local development - serve main app directly
                print(f"📄 Root path accessed - serving main app (no login required)")
                try:
                    with open('index.html', 'rb') as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html')
                    self.send_header('Content-Length', str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                    print(f"📄 Served main app directly")
                except FileNotFoundError:
                    self.send_error(404, "index.html not found")
                return

        # Handle direct access to main app (after login)
        elif parsed_path.path == '/app.html' or parsed_path.path == '/main.html':
            # Serve the main application (what used to be index.html)
            try:
                with open('index.html', 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                print(f"📄 Served main app after login")
            except FileNotFoundError:
                self.send_error(404, "index.html not found")
            return

        # Firebase authentication endpoints
        elif parsed_path.path == '/api/auth/validate':
            # For admin panel authentication
            try:
                query_params = parse_qs(parsed_path.query)
                username = query_params.get('username', [''])[0]
                password = query_params.get('password', [''])[0]

                is_valid = validate_admin_credentials(username, password)
                self.send_json_response({
                    'success': True,
                    'valid': is_valid,
                    'method': 'local_json'
                })

                print(f"Auth validation for {username}: {'OK' if is_valid else 'FAILED'}")

            except Exception as e:
                print(f"Auth validation error: {e}")
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
            return

        elif parsed_path.path == '/api/auth/user':
            # Get user info by email
            try:
                query_params = parse_qs(parsed_path.query)
                email = query_params.get('email', [''])[0]

                user_data = get_user_by_email(email)
                if user_data:
                    self.send_json_response({
                        'success': True,
                        'user': user_data,
                        'method': 'local_json'
                    })
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'User not found',
                        'method': 'local_json'
                    }, 404)

            except Exception as e:
                print(f"User lookup error: {e}")
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
            return

        elif parsed_path.path == '/api/users/list':
            # Get all users list for admin panel from JSON
            try:
                users_data = get_all_users()

                self.send_json_response({
                    'success': True,
                    'users': users_data,
                    'method': 'local_json',
                    'count': len(users_data)
                })
                print(f"Served {len(users_data)} users from JSON file")

            except Exception as e:
                print(f"Users list error: {e}")
                self.send_json_response({
                    'success': False,
                    'error': str(e),
                    'users': [],
                    'method': 'error'
                }, 500)
            return

        # Serve static files with SPA fallback support
        parsed_path = urlparse(self.path)
        file_path = self.translate_path(parsed_path.path)
        
        # Check if this is a SPA route (starts with /project, /analytics, etc.)
        spa_routes = ['/project/', '/analytics', '/dashboard']
        is_spa_route = any(parsed_path.path.startswith(route) for route in spa_routes)
        
        # If it's a SPA route and file doesn't exist, serve index.html
        if is_spa_route and not os.path.isfile(file_path):
            print(f"SPA route detected: {parsed_path.path}, serving index.html")
            index_path = os.path.join(self.directory, "index.html")
            if os.path.isfile(index_path):
                self.send_response(200)
                self.send_header("Content-type", "text/html; charset=utf-8")
                self.send_header("Cache-Control", "no-cache")
                with open(index_path, 'rb') as f:
                    fs = os.fstat(f.fileno())
                    self.send_header("Content-Length", str(fs.st_size))
                    self.end_headers()
                    return self.copyfile(f, self.wfile)
            else:
                self.send_error(404, "index.html not found")
                return
        
        # Otherwise, serve normally
        super().do_GET()

    def do_PUT(self):
        """Handle PUT requests for updating tasks and projects"""
        parsed_path = urlparse(self.path)
        path_parts = parsed_path.path.strip('/').split('/')

        # Check if it's a project update endpoint
        # Expected format: /api/projects/{project_id}
        if (len(path_parts) == 3 and
            path_parts[0] == 'api' and
            path_parts[1] == 'projects'):
            
            try:
                # Extract project_id from URL
                from urllib.parse import unquote
                project_id = unquote(path_parts[2])

                # Read request body
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    project_data = json.loads(body.decode('utf-8'))

                    # Update project - for now just update the README.md description
                    success = self.project_manager.update_project_info(project_id, project_data)

                    if success:
                        self.send_json_response({
                            'success': True,
                            'message': 'Project updated successfully'
                        })
                        print(f"Updated project {project_id}")
                    else:
                        self.send_json_response({
                            'success': False,
                            'error': 'Failed to update project'
                        }, 500)
                        print(f"Failed to update project {project_id}")
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No request body'
                    }, 400)

            except Exception as e:
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
                print(f"Error updating project: {e}")
                
        # Check if it's a task update endpoint
        # Expected format: /api/projects/{project_id}/tasks/{task_id}
        elif (len(path_parts) == 5 and
            path_parts[0] == 'api' and
            path_parts[1] == 'projects' and
            path_parts[3] == 'tasks'):

            try:
                # Extract project_id and task_id from URL
                from urllib.parse import unquote
                project_id = unquote(path_parts[2])
                task_id = unquote(path_parts[4])

                # Read request body
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    task_data = json.loads(body.decode('utf-8'))

                    # Ensure task ID matches URL
                    task_data['id'] = task_id

                    # Update task file
                    success = self.update_task_file(project_id, task_data)

                    if success:
                        self.send_json_response({
                            'success': True,
                            'message': 'Task updated successfully'
                        })
                        print(f"Updated task {task_id} in project {project_id}")
                    else:
                        self.send_json_response({
                            'success': False,
                            'error': 'Failed to update task'
                        }, 500)
                        print(f"Failed to update task {task_id}")
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No request body'
                    }, 400)

            except Exception as e:
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
                print(f"Error updating task: {e}")
        else:
            # Not a task update endpoint
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urlparse(self.path)

        # Admin login endpoint
        if parsed_path.path == '/api/admin/login':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    login_data = json.loads(body.decode('utf-8'))

                    password = login_data.get('password', '').strip()
                    email = login_data.get('email', '').strip()

                    login_successful = False
                    login_method = ''

                    # Try email/username + password login first (from JSON users)
                    if email and password:
                        print(f"Trying JSON admin login: {email}")

                        users = load_users()
                        for user in users:
                            if (user.get('username') == email or user.get('email') == email) and user.get('password') == password:
                                if user.get('role') in ['editor', 'viewer'] and user.get('active', True):
                                    login_successful = True
                                    login_method = f'json_admin_{user["role"]}'
                                    print(f"JSON admin login successful: {email} (role: {user['role']})")
                                    break

                        if not login_successful:
                            print(f"JSON admin login failed: {email} - invalid credentials or not editor/viewer")

                    # If JSON login didn't work, skip to fallback admin password

                    # Fallback to admin password login
                    elif password and password == ADMIN_PASSWORD:
                        login_successful = True
                        login_method = 'admin_password'
                        print("Admin password login successful")

                    if login_successful:
                        # Generate persistent token that survives server restarts
                        token = generate_persistent_token(password if not email else f"{email}-{password}")
                        active_admin_tokens.add(token)

                        # Extract user role from login_method
                        user_role = 'viewer'  # Default role
                        if 'editor' in login_method:
                            user_role = 'editor'
                        elif 'viewer' in login_method:
                            user_role = 'viewer'
                        elif login_method == 'admin_password':
                            user_role = 'admin'  # Full admin rights for admin password

                        self.send_json_response({
                            'success': True,
                            'token': token,
                            'method': login_method,
                            'role': user_role
                        })
                        print(f"Admin login successful via {login_method}, role: {user_role}, token: {token[:8]}...")
                    else:
                        self.send_json_response({
                            'success': False,
                            'error': 'Invalid credentials'
                        }, 401)
                        print("Admin login failed: invalid credentials")
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No data provided'
                    }, 400)

            except Exception as e:
                print(f"Admin login error: {e}")
                self.send_json_response({
                    'success': False,
                    'error': 'Login failed'
                }, 500)
            return

        elif parsed_path.path == '/api/auth/login':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    login_data = json.loads(body.decode('utf-8'))

                    identifier = login_data.get('identifier', '').strip()
                    password = login_data.get('password', '').strip()

                    if not identifier or not password:
                        self.send_json_response({
                            'success': False,
                            'error': 'Identifier (username or email) and password are required'
                        }, 400)
                        return

                    # Визначаємо: email чи username
                    if '@' in identifier:
                        email = identifier
                        username = identifier.split('@')[0]
                    else:
                        username = identifier
                        email = f"{username}@example.com"  # fallback для Firebase

                    # Try JSON authentication
                    user_data = authenticate_user(identifier, password)
                    if user_data:
                        log_user_activity(user_data['id'], 'login', {
                            'method': 'local_json',
                            'username': username
                        })

                        self.send_json_response({
                            'success': True,
                            'user': user_data,
                            'method': 'local_json',
                            'message': 'Login successful'
                        })
                        print(f"JSON login successful: {identifier}")
                        return

                    # Login failed
                    self.send_json_response({
                        'success': False,
                        'error': 'Invalid credentials',
                        'method': 'local_json'
                    }, 401)
                    print(f"Login failed: {identifier}")
                    return

                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No request body'
                    }, 400)
                    return

            except json.JSONDecodeError:
                self.send_json_response({
                    'success': False,
                    'error': 'Invalid JSON in request body'
                }, 400)
                return
            except Exception as e:
                print(f"Login endpoint error: {e}")
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
                return


        # Store email endpoint - simplified for JSON mode
        elif parsed_path.path == '/api/store-email':
            self.send_json_response({
                'success': True,
                'message': 'Email storage not implemented in JSON mode',
                'method': 'local_json'
            })
            return

        # Get stored email endpoint
        elif parsed_path.path == '/api/get-stored-email':
            # Simplified - no email storage in JSON mode
            self.send_json_response({
                'success': False,
                'email': None,
                'method': 'local_json'
            })
            return

        elif parsed_path.path == '/api/git-config':
            # Get git configuration
            try:
                import subprocess
                
                # Get git user name and email
                git_name = None
                git_email = None
                
                try:
                    git_name = subprocess.check_output(['git', 'config', 'user.name'], 
                                                     stderr=subprocess.DEVNULL).decode('utf-8').strip()
                except:
                    pass
                    
                try:
                    git_email = subprocess.check_output(['git', 'config', 'user.email'], 
                                                      stderr=subprocess.DEVNULL).decode('utf-8').strip()
                except:
                    pass
                
                self.send_json_response({
                    'success': True,
                    'name': git_name,
                    'email': git_email
                })
                
            except Exception as e:
                self.send_json_response({
                    'success': False,
                    'error': str(e),
                    'name': None,
                    'email': None
                })
            return

        # Create project endpoint
        elif parsed_path.path == '/api/projects':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    project_data = json.loads(body.decode('utf-8'))
                    
                    project_name = project_data.get('name', '').strip()
                    project_id = project_data.get('id', '').strip()
                    project_description = project_data.get('description', '').strip()
                    
                    if not project_name or not project_id:
                        self.send_json_response({
                            'success': False,
                            'error': 'Project name and ID are required'
                        }, 400)
                        return
                    
                    # Create project using project manager
                    success, message = self.project_manager.create_project({
                        'id': project_id,
                        'name': project_name,
                        'description': project_description
                    })
                    
                    if success:
                        self.send_json_response({
                            'success': True,
                            'message': message,
                            'project': {
                                'id': project_id,
                                'name': project_name,
                                'description': project_description
                            }
                        })
                        print(f"Project created: {project_id} - {project_name}")
                    else:
                        self.send_json_response({
                            'success': False,
                            'error': message
                        }, 400)
                        print(f"Failed to create project: {message}")
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No project data provided'
                    }, 400)
                    
            except json.JSONDecodeError:
                self.send_json_response({
                    'success': False,
                    'error': 'Invalid JSON in request body'
                }, 400)
            except Exception as e:
                print(f"Project creation error: {e}")
                self.send_json_response({
                    'success': False,
                    'error': f'Project creation failed: {str(e)}'
                }, 500)
            return

        # Create user endpoint
        elif parsed_path.path == '/api/auth/create-user':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    user_data = json.loads(body.decode('utf-8'))

                    username = user_data.get('username', '').strip()
                    email = user_data.get('email', '').strip()
                    password = user_data.get('password', '').strip()
                    role = user_data.get('role', 'viewer').strip()

                    if not username or not email or not password:
                        self.send_json_response({
                            'success': False,
                            'error': 'Username, email and password are required'
                        }, 400)
                        return

                    # Get client IP address
                    client_ip = self.get_client_ip()

                    # Create user in JSON file
                    success = create_user(email, username, role, password, client_ip)
                    if success:
                        self.send_json_response({
                            'success': True,
                            'method': 'local_json',
                            'message': 'User created successfully in JSON file'
                        })
                        print(f"Created user in JSON: {username} ({email})")
                        return
                    else:
                        self.send_json_response({
                            'success': False,
                            'error': 'Failed to create user - user may already exist',
                            'method': 'local_json'
                        }, 400)
                        print(f"Failed to create user in JSON: {username}")
                        return

                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No request body'
                    }, 400)
                    return

            except json.JSONDecodeError:
                self.send_json_response({
                    'success': False,
                    'error': 'Invalid JSON in request body'
                }, 400)
                return
            except Exception as e:
                print(f"Create user error: {e}")
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
                return

        # Update user role endpoint
        elif parsed_path.path == '/api/auth/update-user-role':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    data = json.loads(body.decode('utf-8'))

                    user_id = data.get('user_id', '').strip()
                    new_role = data.get('role', 'viewer').strip()

                    if not user_id:
                        self.send_json_response({
                            'success': False,
                            'error': 'User ID is required'
                        }, 400)
                        return

                    # Update user role in JSON file
                    success = update_user(user_id, {'role': new_role})
                    if success:
                        self.send_json_response({
                            'success': True,
                            'message': f'Role updated to {new_role}',
                            'method': 'local_json'
                        })
                        print(f"Updated user {user_id} role to {new_role} in JSON")
                        return
                    else:
                        self.send_json_response({
                            'success': False,
                            'error': f'Failed to update user {user_id} role',
                            'method': 'local_json'
                        }, 500)
                        print(f"Failed to update user {user_id} role in JSON")
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No request body'
                    }, 400)

            except Exception as e:
                print(f"Update user role error: {e}")
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
            return

        # Toggle user status endpoint
        elif parsed_path.path == '/api/auth/toggle-user-status':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    data = json.loads(body.decode('utf-8'))

                    user_id = data.get('user_id', '').strip()
                    active = data.get('active', True)

                    if not user_id:
                        self.send_json_response({
                            'success': False,
                            'error': 'User ID is required'
                        }, 400)
                        return

                    # Toggle user status in JSON file
                    success = update_user(user_id, {'active': active})
                    if success:
                        status_text = 'активний' if active else 'неактивний'
                        self.send_json_response({
                            'success': True,
                            'message': f'Статус змінено на {status_text}',
                            'method': 'local_json'
                        })
                        print(f"Updated user {user_id} status to {status_text} in JSON")
                        return
                    else:
                        self.send_json_response({
                            'success': False,
                            'error': f'Failed to update user {user_id} status',
                            'method': 'local_json'
                        }, 500)
                        print(f"Failed to update user {user_id} status in JSON")
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No request body'
                    }, 400)

            except Exception as e:
                print(f"Toggle user status error: {e}")
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
            return

        # Delete user endpoint
        elif parsed_path.path == '/api/auth/delete-user':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    data = json.loads(body.decode('utf-8'))

                    user_id = data.get('user_id', '').strip()

                    if not user_id:
                        self.send_json_response({
                            'success': False,
                            'error': 'User ID is required'
                        }, 400)
                        return

                    # Delete user from JSON file
                    success = delete_user_by_id(user_id)
                    if success:
                        self.send_json_response({
                            'success': True,
                            'message': 'Користувач видалений',
                            'method': 'local_json'
                        })
                        print(f"Deleted user {user_id} from JSON file")
                        return
                    else:
                        self.send_json_response({
                            'success': False,
                            'error': f'Failed to delete user {user_id}',
                            'method': 'local_json'
                        }, 500)
                        print(f"Failed to delete user {user_id} from JSON file")
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No request body'
                    }, 400)

            except Exception as e:
                print(f"Delete user error: {e}")
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
            return

        # Original POST method logic continues...
        print(f"📡 POST request received: {self.path}")

        # Check if it's a task creation endpoint
        # Expected format: /api/projects/{project_id}/tasks
        path_parts = parsed_path.path.strip('/').split('/')
        if (len(path_parts) == 4 and
            path_parts[0] == 'api' and
            path_parts[1] == 'projects' and
            path_parts[3] == 'tasks'):

            try:
                # Get content length and read the body
                content_length = int(self.headers['Content-Length'])
                if content_length > 0:
                    post_data = self.rfile.read(content_length)
                    task_data = json.loads(post_data.decode('utf-8'))

                    from urllib.parse import unquote
                    project_id = unquote(path_parts[2])

                    # Create the task file
                    print(f"Attempting to create task in project: {project_id}")
                    print(f"Task data: {task_data}")
                    success = self.create_task_file(project_id, task_data)

                    if success:
                        self.send_json_response({
                            'success': True,
                            'message': f'Task {task_data["id"]} created successfully'
                        })
                        print(f"Created task {task_data['id']} in project {project_id}")
                    else:
                        self.send_json_response({
                            'success': False,
                            'error': 'Failed to create task file'
                        }, 500)
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No request body'
                    }, 400)

            except Exception as e:
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
                print(f"Error creating task: {e}")

        # Check if it's an image upload endpoint
        # Expected format: /api/projects/{project_id}/upload-image
        elif (len(path_parts) == 4 and
              path_parts[0] == 'api' and
              path_parts[1] == 'projects' and
              path_parts[3] == 'upload-image'):

            try:
                from urllib.parse import unquote
                project_id = unquote(path_parts[2])
                print(f"🖼️ Image upload request for project: {project_id}")

                # Handle multipart form data upload
                self.handle_image_upload(project_id)

            except Exception as e:
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
                print(f"Error uploading image: {e}")

        # Select working directory endpoint
        elif parsed_path.path == '/api/select-directory':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    data = json.loads(body.decode('utf-8'))
                    
                    directory_path = data.get('path')
                    if not directory_path:
                        self.send_json_response({
                            'success': False,
                            'error': 'Path is required'
                        }, 400)
                        return
                    
                    if not os.path.exists(directory_path):
                        self.send_json_response({
                            'success': False,
                            'error': f'Directory does not exist: {directory_path}'
                        }, 400)
                        return
                    
                    if not os.path.isdir(directory_path):
                        self.send_json_response({
                            'success': False,
                            'error': f'Path is not a directory: {directory_path}'
                        }, 400)
                        return
                    
                    # Update the global working directory
                    global PROJECTS_BASE_DIR, WORKING_DIRECTORY
                    WORKING_DIRECTORY = directory_path
                    PROJECTS_BASE_DIR = os.path.join(directory_path, 'projects')
                    
                    # Create projects directory if it doesn't exist
                    os.makedirs(PROJECTS_BASE_DIR, exist_ok=True)
                    
                    # Update project manager
                    self.project_manager = ProjectManager(PROJECTS_BASE_DIR)
                    
                    self.send_json_response({
                        'success': True,
                        'message': f'Working directory set to: {directory_path}',
                        'working_directory': directory_path
                    })
                    print(f"Working directory updated to: {directory_path}")
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No request body'
                    }, 400)
            except Exception as e:
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
                print(f"Error setting working directory: {e}")

        # Admin update endpoint
        elif parsed_path.path == '/api/admin/update':
            # Check admin token
            token = self.headers.get('x-admin-token')
            if not token or token not in active_admin_tokens:
                self.send_json_response({
                    'success': False,
                    'error': 'Unauthorized'
                }, 401)
                return

            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    update_data = json.loads(body.decode('utf-8'))

                    app_id = update_data.get('id')
                    new_status = update_data.get('status')

                    if not app_id:
                        self.send_json_response({
                            'success': False,
                            'error': 'Missing app ID'
                        }, 400)
                        return

                    # Update in JSON (not implemented for apps)
                    success = False  # Apps not stored in JSON file

                    if success:
                        self.send_json_response({
                            'success': True
                        })
                        print(f"Updated app {app_id} status to {new_status}")
                    else:
                        self.send_json_response({
                            'success': False,
                            'error': 'Failed to update app'
                        }, 500)
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No data provided'
                    }, 400)

            except Exception as e:
                print(f"Admin update error: {e}")
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
            return

        # Admin delete endpoint
        elif parsed_path.path == '/api/admin/delete':
            # Check admin token
            token = self.headers.get('x-admin-token')
            if not token or token not in active_admin_tokens:
                self.send_json_response({
                    'success': False,
                    'error': 'Unauthorized'
                }, 401)
                return

            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    delete_data = json.loads(body.decode('utf-8'))

                    app_id = delete_data.get('id')

                    if not app_id:
                        self.send_json_response({
                            'success': False,
                            'error': 'Missing app ID'
                        }, 400)
                        return

                    # Delete from JSON (not implemented for apps)
                    success = False  # Apps not stored in JSON file

                    if success:
                        self.send_json_response({
                            'success': True
                        })
                        print(f"🗑️ Deleted app {app_id}")
                    else:
                        self.send_json_response({
                            'success': False,
                            'error': 'Failed to delete app'
                        }, 500)
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No data provided'
                    }, 400)

            except Exception as e:
                print(f"Admin delete error: {e}")
                self.send_json_response({
                    'success': False,
                    'error': str(e)
                }, 500)
            return

        elif parsed_path.path == '/api/create-directory':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    data = json.loads(body.decode('utf-8'))
                    
                    project_id = data.get('project_id', '').strip()
                    parent_dir = data.get('parent_dir', '').strip()  # e.g., 'progress'
                    dir_name = data.get('dir_name', '').strip()  # e.g., 'dev-john'
                    
                    if not all([project_id, parent_dir, dir_name]):
                        self.send_json_response({
                            'success': False,
                            'error': 'Missing required parameters: project_id, parent_dir, dir_name'
                        }, 400)
                        return
                    
                    # Create directory path
                    project_path = self.project_manager.base_dir / project_id
                    if not project_path.exists():
                        self.send_json_response({
                            'success': False,
                            'error': f'Project {project_id} does not exist'
                        }, 404)
                        return
                    
                    # Create parent directory if it doesn't exist
                    parent_path = project_path / parent_dir
                    parent_path.mkdir(exist_ok=True)
                    
                    # Create the target directory
                    target_path = parent_path / dir_name
                    target_path.mkdir(exist_ok=True)
                    
                    # Create a README.md file in the directory
                    readme_path = target_path / 'README.md'
                    if not readme_path.exists():
                        readme_content = f"# {dir_name}\n\nTasks assigned to {dir_name}\n\n## In Progress\n\n*No tasks currently in progress*\n"
                        with open(readme_path, 'w', encoding='utf-8') as f:
                            f.write(readme_content)
                    
                    self.send_json_response({
                        'success': True,
                        'message': f'Directory created: {project_id}/{parent_dir}/{dir_name}',
                        'path': str(target_path)
                    })
                    print(f"Created directory: {target_path}")
                    
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'No request body provided'
                    }, 400)
                    
            except Exception as e:
                self.send_json_response({
                    'success': False,
                    'error': f'Error creating directory: {str(e)}'
                }, 500)
                print(f"Error creating directory: {e}")
            return

        else:
            # Not a supported endpoint
            self.send_response(404)
            self.end_headers()

    def update_task_file(self, project_id, task_data):
        """Update existing task file content and potentially move it"""
        project_path = self.project_manager.base_dir / project_id
        if not project_path.exists():
            return False

        task_id = task_data['id']
        print(f"🔄 update_task_file: Processing task {task_id} for project {project_id}")

        # Find current task file location
        current_file = None
        current_folder = None
        current_developer = None

        # КРИТИЧНО: шукати ТІЛЬКИ файл з правильним ID і змістом
        print(f"🔍 Шукаємо файл для task_id: {task_id}")

        for folder in ['backlog', 'progress', 'inprogress', 'review', 'testing', 'done']:
            folder_path = project_path / folder
            if folder_path.exists():
                # Check direct files
                task_file = folder_path / f"{task_id}.md"
                if task_file.exists():
                    # ПЕРЕВІРЯЄМО ЧИ ЦЕЙ ФАЙЛ ДІЙСНо МАЄ ПРАВИЛЬНИЙ ID
                    try:
                        file_content = task_file.read_text(encoding='utf-8')
                        if task_id in file_content or task_id in str(task_file.name):
                            current_file = task_file
                            current_folder = folder
                            current_developer = None  # Файл в головній папці, без розробника
                            print(f"📍 Found VERIFIED task file in direct folder: {task_file}")
                            break
                        else:
                            print(f"⚠️ Файл {task_file} існує але НЕ МІСТИТЬ task_id {task_id}")
                    except Exception as e:
                        print(f"⚠️ Помилка читання файлу {task_file}: {e}")

                # Check developer subfolders (for all folders)
                for dev_folder in folder_path.iterdir():
                    if dev_folder.is_dir() and not dev_folder.name.startswith('.'):
                        task_file = dev_folder / f"{task_id}.md"
                        if task_file.exists():
                            # ПЕРЕВІРЯЄМО ЧИ ЦЕЙ ФАЙЛ ДІЙСНо МАЄ ПРАВИЛЬНИЙ ID
                            try:
                                file_content = task_file.read_text(encoding='utf-8')
                                if task_id in file_content or task_id in str(task_file.name):
                                    current_file = task_file
                                    current_folder = folder
                                    current_developer = dev_folder.name
                                    print(f"📍 Found VERIFIED task file in developer subfolder: {task_file}")
                                    print(f"   Current developer: {current_developer}")
                                    break
                                else:
                                    print(f"⚠️ Файл {task_file} існує але НЕ МІСТИТЬ task_id {task_id}")
                            except Exception as e:
                                print(f"⚠️ Помилка читання файлу {task_file}: {e}")
                    if current_file:
                        break
                if current_file:
                    break

        if not current_file:
            print(f"❌ Task file not found: {task_id}")
            return False

        # Determine new location based on task status
        new_status = task_data.get('status', task_data.get('column', 'backlog'))
        new_developer = task_data.get('developer')

        # КРИТИЧНО: Якщо розробник не вказано, спробуємо визначити з поточного розташування
        if not new_developer and current_developer:
            new_developer = current_developer
            print(f"🔍 АВТОМАТИЧНО збережено поточного розробника: {new_developer}")
        elif not new_developer:
            # Спробуємо визначити з assignee поля
            assignee = task_data.get('assignee')
            if assignee and (assignee.startswith('dev-') or assignee.startswith('tech-')):
                new_developer = assignee
                print(f"🔍 АВТОМАТИЧНО визначено розробника з assignee: {new_developer}")

        print(f"📋 Task movement: {task_id} from {current_folder} to {new_status} (dev: {new_developer})")
        print(f"🔍 ДЕТАЛІ ПЕРЕМІЩЕННЯ:")
        print(f"  Current file: {current_file}")
        print(f"  Task data keys: {list(task_data.keys())}")
        print(f"  Developer from task_data: {repr(task_data.get('developer'))}")
        print(f"  Assignee from task_data: {repr(task_data.get('assignee'))}")
        print(f"  Final new_developer: {repr(new_developer)}")

        # Calculate new path
        new_folder_path = project_path / new_status
        # Додаємо підтримку папок девелоперів для всіх статусів включаючи backlog
        if new_developer and new_status in ['backlog', 'progress', 'inprogress', 'review', 'testing', 'done']:
            new_folder_path = new_folder_path / new_developer

        new_folder_path.mkdir(parents=True, exist_ok=True)
        new_task_file = new_folder_path / f"{task_id}.md"

        # CRITICAL FIX: Verify that we're only working with the specific task file
        # Check if the new file path would overwrite a different task
        if new_task_file.exists() and str(new_task_file) != str(current_file):
            # Read existing file to check if it's the same task
            try:
                existing_content = new_task_file.read_text(encoding='utf-8')
                # Simple check: if it contains the same task ID in title or content
                if f"{task_id}" not in existing_content and task_id not in str(new_task_file.name):
                    print(f"⚠️ WARNING: Destination file {new_task_file} exists but appears to be a different task!")
                    print(f"⚠️ Aborting update to prevent overwriting other tasks")
                    return False
            except Exception as e:
                print(f"⚠️ Could not verify destination file safety: {e}")
                return False

        # Build updated file content (simplified YAML)
        def simple_yaml_dump(data):
            lines = []
            for key, value in data.items():
                if value is not None:
                    if isinstance(value, str) and any(c in value for c in ['\n', ':', '#']):
                        lines.append(f"{key}: '{value}'")
                    else:
                        lines.append(f"{key}: {value}")
            return '\n'.join(lines)

        print(f"🔍 mini-server update_task_file: Received task_data for {task_id}:")
        print(f"  timeEstimate: {repr(task_data.get('timeEstimate'))}")
        print(f"  timeSpent: {repr(task_data.get('timeSpent'))}")
        print(f"  task_data keys: {list(task_data.keys())}")
        
        frontmatter = {
            'title': task_data.get('title', ''),
            'estimate': task_data.get('timeEstimate', '0h'),
            'spent_time': task_data.get('timeSpent', '0h'),
            'priority': task_data.get('priority', 'medium'),
            'developer': task_data.get('developer'),
            'status': new_status,
            'created': task_data.get('created', datetime.now().isoformat()[:10])
        }
        
        print(f"mini-server: Writing frontmatter:")
        print(f"  estimate: {repr(frontmatter['estimate'])}")
        print(f"  spent_time: {repr(frontmatter['spent_time'])}")

        # Remove None values
        frontmatter = {k: v for k, v in frontmatter.items() if v is not None}

        yaml_content = simple_yaml_dump(frontmatter)
        markdown_content = task_data.get('content', task_data.get('fullContent', ''))

        file_content = f"---\n{yaml_content}\n---\n\n{markdown_content}"

        # If location changed, move the file
        if str(new_task_file) != str(current_file):
            # Double-check file paths before proceeding
            print(f"🔍 File movement verification:")
            print(f"  Current file: {current_file}")
            print(f"  New file: {new_task_file}")
            print(f"  Task ID: {task_id}")

            # CRITICAL SAFETY CHECK: Ensure we're only deleting the correct file
            if current_file.exists():
                try:
                    # Verify the current file actually contains this task ID
                    current_content = current_file.read_text(encoding='utf-8')
                    if task_id not in current_content and task_id not in str(current_file.name):
                        print(f"❌ SAFETY ABORT: Current file doesn't contain task {task_id}")
                        return False

                    # Remove old file ONLY after verification
                    current_file.unlink()
                    print(f"✅ Safely removed old file: {current_file}")
                    print(f"🚚 Moved task {task_id} from {current_folder} to {new_status}")
                except Exception as e:
                    print(f"❌ Error during file movement verification: {e}")
                    return False
            else:
                print(f"⚠️ Current file {current_file} no longer exists")

        # Write updated content to new location
        try:
            print(f"📝 Writing content to: {new_task_file}")
            print(f"📊 Content size: {len(file_content)} characters")
            new_task_file.write_text(file_content, encoding='utf-8')
            print(f"✅ Successfully updated task file: {new_task_file}")
        except Exception as e:
            print(f"❌ Error writing task file: {e}")
            return False

        return True

    def create_task_file(self, project_id, task_data):
        """Create a new task file"""
        project_path = self.project_manager.base_dir / project_id
        if not project_path.exists():
            print(f"⚠️ Project directory not found, creating: {project_path}")
            # Auto-create the project with basic structure
            project_data = {
                'id': project_id,
                'name': project_id,
                'description': f"Auto-created project {project_id}"
            }
            success, error = self.project_manager.create_project(project_data)
            if not success:
                print(f"Failed to create project {project_id}: {error}")
                return False

        task_id = task_data['id']

        # Determine target folder based on task data
        target_folder = task_data.get('folder', 'backlog')  # Default to backlog

        # Create folder path
        folder_path = project_path / target_folder

        # Create nested directories if needed (e.g., progress/dev-name)
        folder_path.mkdir(parents=True, exist_ok=True)

        # Create the task file
        task_file = folder_path / f"{task_id}.md"

        # Check if task file already exists
        if task_file.exists():
            print(f"Task file already exists: {task_file}")
            return False

        # Simple YAML dump function
        def simple_yaml_dump(data):
            lines = []
            for key, value in data.items():
                if value is not None:
                    lines.append(f"{key}: {value}")
            return '\n'.join(lines)

        # Prepare frontmatter
        frontmatter = {
            'title': task_data.get('title', ''),
            'estimate': task_data.get('timeEstimate', '2h'),
            'spent_time': task_data.get('timeSpent', '0h'),
            'priority': task_data.get('priority', 'medium'),
            'developer': task_data.get('developer') or task_data.get('assignee'),
            'status': task_data.get('status', target_folder),
            'created': task_data.get('created', datetime.now().isoformat()[:10])
        }

        # Remove None values
        frontmatter = {k: v for k, v in frontmatter.items() if v is not None}

        yaml_content = simple_yaml_dump(frontmatter)
        markdown_content = task_data.get('content', task_data.get('fullContent', ''))

        file_content = f"---\n{yaml_content}\n---\n\n{markdown_content}"

        # Write file content
        try:
            task_file.write_text(file_content, encoding='utf-8')
            print(f"Created task file: {task_file}")
            return True
        except Exception as e:
            print(f"Error writing task file {task_file}: {e}")
            return False
    
    def handle_image_upload(self, project_id):
        """Handle multipart image upload"""
        import cgi
        import uuid
        import os
        from pathlib import Path
        
        # Find project directory
        project_path = Path(PROJECTS_BASE_DIR) / project_id
        if not project_path.exists():
            self.send_json_response({
                'success': False,
                'error': f'Project "{project_id}" not found'
            }, 404)
            return
        
        # Create images directory
        images_dir = project_path / 'images'
        images_dir.mkdir(exist_ok=True)
        
        # Parse multipart form data
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                'REQUEST_METHOD': 'POST',
                'CONTENT_TYPE': self.headers['Content-Type'],
            }
        )
        
        if 'image' not in form:
            self.send_json_response({
                'success': False,
                'error': 'No image file provided'
            }, 400)
            return
        
        file_item = form['image']
        if not file_item.filename:
            self.send_json_response({
                'success': False,
                'error': 'No file selected'
            }, 400)
            return
        
        # Check file extension
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}
        if not ('.' in file_item.filename and 
                file_item.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            self.send_json_response({
                'success': False,
                'error': 'File must be an image (png, jpg, jpeg, gif, webp, svg)'
            }, 400)
            return
        
        # Generate unique filename
        file_extension = file_item.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex[:8]}_{file_item.filename}"
        file_path = images_dir / unique_filename
        
        # Save file
        try:
            with open(file_path, 'wb') as f:
                f.write(file_item.file.read())
            
            # Generate API path for markdown (accessible via web)
            api_path = f"/api/projects/{project_id}/images/{unique_filename}"
            
            print(f"Image uploaded: {file_path}")
            
            self.send_json_response({
                'success': True,
                'message': 'Image uploaded successfully',
                'filename': unique_filename,
                'path': api_path,
                'markdown': f"![{file_item.filename}]({api_path})"
            })
            
        except Exception as e:
            print(f"Error saving image: {e}")
            self.send_json_response({
                'success': False,
                'error': f'Failed to save image: {str(e)}'
            }, 500)

    def send_json_response(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8'))

def check_port_available(port):
    """Check if port is available"""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) != 0

if __name__ == '__main__':
    # Add persistent admin token on startup
    persistent_token = generate_persistent_token(ADMIN_PASSWORD)
    active_admin_tokens.add(persistent_token)
    print(f"Persistent admin token ready: {persistent_token[:8]}...")
    
    # Check if port is available
    if not check_port_available(PORT):
        print(f"Port {PORT} is already in use!")
        print("Try:")
        print(f"   1. Stop existing process: kill $(lsof -ti:{PORT})")
        print(f"   2. Use different port: FIRA_PORT=8080 python3 mini-server.py")
        sys.exit(1)

    try:
        # Create projects directory if it doesn't exist
        os.makedirs(PROJECTS_BASE_DIR, exist_ok=True)
        print(f"Projects directory ensured: {PROJECTS_BASE_DIR}")
        
        with socketserver.TCPServer(("", PORT), FiraRequestHandler) as httpd:
            print(f"""
Mini Fira Server Starting...
===============================
Projects directory: {PROJECTS_BASE_DIR}
🌐 Server URL: http://localhost:{PORT}
API: http://localhost:{PORT}/api/
Clear cache: http://localhost:{PORT}/clear-cache.html

💡 Open http://localhost:{PORT} in your browser
⏹️  Press Ctrl+C to stop
===============================
            """)
            
            # Test project detection on startup
            manager = ProjectManager(PROJECTS_BASE_DIR)
            projects = manager.get_projects()
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\nServer stopped")
    except Exception as e:
        print(f"Server error: {e}")
        sys.exit(1)