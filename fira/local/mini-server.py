#!/usr/bin/env python3
"""
Mini Fira Server - No dependencies required
Uses only standard Python library
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

# Configuration
PROJECTS_BASE_DIR = os.path.join(os.getcwd(), 'projects')
PORT = int(os.environ.get('FIRA_PORT', 5000))

class ProjectManager:
    def __init__(self, base_dir):
        self.base_dir = Path(base_dir)
        
    def create_project(self, project_data):
        """Create a new project folder with standard subfolders and README"""
        project_id = project_data.get('id')
        if not project_id:
            print("❌ Missing project ID")
            return False, "Missing project ID"

        project_path = self.base_dir / project_id
        if project_path.exists():
            print(f"❌ Project already exists: {project_id}")
            return False, f"Project {project_id} already exists"

        try:
            # Створюємо головну папку проекту
            project_path.mkdir(parents=True, exist_ok=False)
            print(f"✅ Created project folder: {project_path}")

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
                # Створюємо папку розробника для всіх колонок крім backlog
                if col != 'backlog':
                    dev_path = col_path / default_dev
                    dev_path.mkdir(parents=True, exist_ok=True)
            
            print(f"📁 Created standard project folders: {', '.join(columns)}")
            return True, None

        except Exception as e:
            print(f"❌ Error creating project {project_id}: {e}")
            return False, str(e)

    def get_projects(self):
        """Get list of all projects"""
        projects = []
        if not self.base_dir.exists():
            print(f"⚠️  Projects directory not found: {self.base_dir}")
            return projects
            
        print(f"📁 Scanning projects directory: {self.base_dir}")
        
        for project_dir in self.base_dir.iterdir():
            if project_dir.is_dir() and not project_dir.name.startswith('.'):
                project_info = self.get_project_info(project_dir.name)
                if project_info:
                    projects.append(project_info)
                    print(f"✅ Added project: {project_dir.name}")
        
        print(f"📋 Total projects found: {len(projects)}")
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
        
        return {
            'id': project_id,
            'name': project_id,
            'description': description,
            'stats': stats
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
                    
                    # Count files in developer subfolders
                    if folder in ['progress', 'inprogress']:
                        for dev_folder in folder_path.iterdir():
                            if dev_folder.is_dir() and not dev_folder.name.lower().startswith('readme'):
                                dev_tasks = [f for f in dev_folder.glob('*.md') if f.name.lower() != 'readme.md']
                                total_tasks += len(dev_tasks)
                                developers.add(dev_folder.name)
            
            stats[stat_key]['count'] = total_tasks
            if stat_key == 'inProgress':
                stats[stat_key]['detail'] = f'({len(developers)} devs)'
        
        return stats

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
                # Handle progress folders with developer subfolders
                if folder_name in ['progress', 'inprogress']:
                    # Check for direct .md files first
                    for task_file in folder_path.glob('*.md'):
                        if task_file.name.lower() != 'readme.md':
                            task = self.parse_task_file(task_file)
                            if task:
                                task['column'] = status
                                task['projectId'] = project_id
                                tasks.append(task)
                    
                    # Check developer subfolders
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
                else:
                    # Other folders - direct task files
                    for task_file in folder_path.glob('*.md'):
                        if task_file.name.lower() != 'readme.md':
                            task = self.parse_task_file(task_file)
                            if task:
                                task['column'] = status
                                task['projectId'] = project_id
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
                'created': metadata.get('created', ''),
                'file_path': str(file_path)
            }
            
            return task
            
        except Exception as e:
            print(f"❌ Error parsing task file {file_path}: {e}")
            return None

class FiraRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.project_manager = ProjectManager(PROJECTS_BASE_DIR)
        super().__init__(*args, **kwargs)
    
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
                print(f"❌ Error deleting project: {e}")
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
            self.send_json_response({
                'status': 'ok',
                'message': 'Mini Fira server is running',
                'version': '1.0.0-mini',
                'projects_dir': str(self.project_manager.base_dir)
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
                print(f"❌ API Error: {e}")
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
                    print(f"❌ API Error getting tasks: {e}")
                    self.send_json_response({
                        'success': False,
                        'error': str(e)
                    }, 500)
            else:
                self.send_error(404, "Invalid tasks API endpoint")
            return
        
        # Handle SPA routes - serve index.html for app routes
        elif parsed_path.path.startswith('/project/') or parsed_path.path.startswith('/analytics'):
            # Serve index.html for client-side routing
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
        
        # Serve static files
        super().do_GET()
    
    def do_PUT(self):
        """Handle PUT requests for updating tasks"""
        parsed_path = urlparse(self.path)
        
        # Check if it's a task update endpoint
        # Expected format: /api/projects/{project_id}/tasks/{task_id}
        path_parts = parsed_path.path.strip('/').split('/')
        if (len(path_parts) == 5 and 
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
                        print(f"✅ Updated task {task_id} in project {project_id}")
                    else:
                        self.send_json_response({
                            'success': False,
                            'error': 'Failed to update task'
                        }, 500)
                        print(f"❌ Failed to update task {task_id}")
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
                print(f"❌ Error updating task: {e}")
        else:
            # Not a task update endpoint
            self.send_response(404)
            self.end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_POST(self):
        """Handle POST requests for creating tasks"""
        print(f"📡 POST request received: {self.path}")
        parsed_path = urlparse(self.path)
        
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
                    print(f"🔄 Attempting to create task in project: {project_id}")
                    print(f"🔄 Task data: {task_data}")
                    success = self.create_task_file(project_id, task_data)
                    
                    if success:
                        self.send_json_response({
                            'success': True,
                            'message': f'Task {task_data["id"]} created successfully'
                        })
                        print(f"✅ Created task {task_data['id']} in project {project_id}")
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
                print(f"❌ Error creating task: {e}")
        else:
            # Not a task creation endpoint
            self.send_response(404)
            self.end_headers()
    
    def update_task_file(self, project_id, task_data):
        """Update existing task file content and potentially move it"""
        project_path = self.project_manager.base_dir / project_id
        if not project_path.exists():
            return False

        task_id = task_data['id']
        
        # Find current task file location
        current_file = None
        current_folder = None
        
        for folder in ['backlog', 'progress', 'inprogress', 'review', 'testing', 'done']:
            folder_path = project_path / folder
            if folder_path.exists():
                # Check direct files
                task_file = folder_path / f"{task_id}.md"
                if task_file.exists():
                    current_file = task_file
                    current_folder = folder
                    break
                
                # Check developer subfolders
                if folder in ['progress', 'inprogress']:
                    for dev_folder in folder_path.iterdir():
                        if dev_folder.is_dir() and not dev_folder.name.startswith('.'):
                            task_file = dev_folder / f"{task_id}.md"
                            if task_file.exists():
                                current_file = task_file
                                current_folder = folder
                                break
                    if current_file:
                        break
        
        if not current_file:
            print(f"❌ Task file not found: {task_id}")
            return False
        
        # Determine new location based on task status
        new_status = task_data.get('column', 'backlog')
        new_developer = task_data.get('developer')
        
        # Calculate new path
        new_folder_path = project_path / new_status
        if new_status in ['progress', 'inprogress'] and new_developer:
            new_folder_path = new_folder_path / new_developer
        
        new_folder_path.mkdir(parents=True, exist_ok=True)
        new_task_file = new_folder_path / f"{task_id}.md"
        
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
        
        frontmatter = {
            'title': task_data.get('title', ''),
            'estimate': task_data.get('timeEstimate', '0h'),
            'spent_time': task_data.get('timeSpent', '0h'),
            'priority': task_data.get('priority', 'medium'),
            'developer': task_data.get('developer'),
            'created': task_data.get('created', datetime.now().isoformat()[:10])
        }
        
        # Remove None values
        frontmatter = {k: v for k, v in frontmatter.items() if v is not None}
        
        yaml_content = simple_yaml_dump(frontmatter)
        markdown_content = task_data.get('content', task_data.get('fullContent', ''))
        
        file_content = f"---\n{yaml_content}\n---\n\n{markdown_content}"
        
        # If location changed, move the file
        if str(new_task_file) != str(current_file):
            # Remove old file
            current_file.unlink()
            print(f"🚚 Moved task {task_id} from {current_folder} to {new_status}")
        
        # Write updated content to new location
        new_task_file.write_text(file_content, encoding='utf-8')
        print(f"💾 Updated task file: {new_task_file}")
        
        return True
    
    def create_task_file(self, project_id, task_data):
        """Create a new task file"""
        project_path = self.project_manager.base_dir / project_id
        if not project_path.exists():
            print(f"❌ Project directory not found: {project_path}")
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
            print(f"❌ Task file already exists: {task_file}")
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
            print(f"✅ Created task file: {task_file}")
            return True
        except Exception as e:
            print(f"❌ Error writing task file {task_file}: {e}")
            return False
    
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
    # Check if port is available
    if not check_port_available(PORT):
        print(f"❌ Port {PORT} is already in use!")
        print("🔧 Try:")
        print(f"   1. Stop existing process: kill $(lsof -ti:{PORT})")
        print(f"   2. Use different port: FIRA_PORT=8080 python3 mini-server.py")
        sys.exit(1)

    try:
        with socketserver.TCPServer(("", PORT), FiraRequestHandler) as httpd:
            print(f"""
🚀 Mini Fira Server Starting...
===============================
📁 Projects directory: {PROJECTS_BASE_DIR}
🌐 Server URL: http://localhost:{PORT}
🔧 API: http://localhost:{PORT}/api/
📋 Clear cache: http://localhost:{PORT}/clear-cache.html

💡 Open http://localhost:{PORT} in your browser
⏹️  Press Ctrl+C to stop
===============================
            """)
            
            # Test project detection on startup
            manager = ProjectManager(PROJECTS_BASE_DIR)
            projects = manager.get_projects()
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
    except Exception as e:
        print(f"❌ Server error: {e}")
        sys.exit(1)