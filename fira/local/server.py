#!/usr/bin/env python3
"""
Fira Project Management Server
Flask server for file-based task management with CRUD operations
"""

import sys
import os

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from flask import Flask, jsonify, request, send_from_directory
    from flask_cors import CORS
    import yaml
except ImportError as e:
    print(f"❌ Missing required Python package: {e}")
    print("🔧 Install dependencies:")
    print("   pip3 install flask flask-cors PyYAML")
    print("   or run: ./start-macos.sh")
    sys.exit(1)

import json
import re
from datetime import datetime
from pathlib import Path
import logging
import signal
import socket

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration with environment variable support
PROJECTS_BASE_DIR = os.environ.get('FIRA_PROJECTS_DIR', os.path.join(os.getcwd(), 'projects'))
PORT = int(os.environ.get('FIRA_PORT', 8080))

# Graceful shutdown handler
def signal_handler(sig, frame):
    logger.info('🛑 Gracefully shutting down server...')
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# Ensure projects directory exists
os.makedirs(PROJECTS_BASE_DIR, exist_ok=True)

class ProjectManager:
    def __init__(self, base_dir):
        self.base_dir = Path(base_dir)
        self.ensure_base_dir()
    
    def ensure_base_dir(self):
        """Ensure base projects directory exists"""
        self.base_dir.mkdir(exist_ok=True)
    
    def get_projects(self):
        """Get list of all projects"""
        projects = []
        if not self.base_dir.exists():
            return projects
            
        for project_dir in self.base_dir.iterdir():
            if project_dir.is_dir() and not project_dir.name.startswith('.'):
                project_info = self.get_project_info(project_dir.name)
                if project_info:
                    projects.append(project_info)
        
        return projects
    
    def get_project_info(self, project_id):
        """Get project information including stats"""
        project_path = self.base_dir / project_id
        if not project_path.exists():
            return None
        
        # Read README.md if exists
        readme_path = project_path / 'README.md'
        description = ''
        if readme_path.exists():
            try:
                description = readme_path.read_text(encoding='utf-8').strip()
                # Extract first line as description
                description = description.split('\n')[0].replace('#', '').strip()
            except Exception as e:
                logger.warning(f"Could not read README for {project_id}: {e}")
        
        # Calculate task statistics
        stats = self.calculate_project_stats(project_id)
        
        return {
            'id': project_id,
            'name': project_id,
            'description': description or f'Project {project_id}',
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
        
        if not project_path.exists():
            return stats
        
        # Count tasks in each folder, supporting both naming conventions
        folder_mappings = [
            (['backlog'], 'backlog'),
            (['progress', 'inprogress'], 'inProgress'),  # Check both possible names
            (['done'], 'done')
        ]
        
        for folders, stat_key in folder_mappings:
            total_tasks = 0
            total_time = 0
            developers = set()
            
            for folder in folders:
                folder_path = project_path / folder
                if folder_path.exists():
                    task_files = [f for f in folder_path.glob('*.md') if f.name.lower() != 'readme.md']
                    total_tasks += len(task_files)
                    
                    # Calculate time estimates for this folder
                    for task_file in task_files:
                        task_data = self.parse_task_file(task_file)
                        if task_data.get('timeEstimate'):
                            total_time += self.parse_time_to_minutes(task_data['timeEstimate'])
                        if task_data.get('developer'):
                            developers.add(task_data['developer'])
                    
                    # Check developer subfolders for progress/inprogress
                    if folder in ['progress', 'inprogress']:
                        for dev_folder in folder_path.iterdir():
                            if dev_folder.is_dir():
                                dev_tasks = [f for f in dev_folder.glob('*.md') if f.name.lower() != 'readme.md']
                                total_tasks += len(dev_tasks)
                                developers.add(dev_folder.name)
                                
                                for task_file in dev_tasks:
                                    task_data = self.parse_task_file(task_file)
                                    if task_data.get('timeEstimate'):
                                        total_time += self.parse_time_to_minutes(task_data['timeEstimate'])
            
            # Update stats for this category
            stats[stat_key]['count'] = total_tasks
            if stat_key == 'inProgress':
                stats[stat_key]['detail'] = f'({len(developers)} devs)'
            else:
                stats[stat_key]['detail'] = f'({self.format_time_from_minutes(total_time)})'
        
        return stats
    
    def get_project_tasks(self, project_id):
        """Get all tasks for a project"""
        project_path = self.base_dir / project_id
        if not project_path.exists():
            return []
        
        tasks = []
        
        # Define status folders and their mappings
        status_folders = {
            'backlog': 'backlog',
            'progress': 'progress',
            'inprogress': 'progress',  # Support both naming conventions
            'review': 'review',
            'testing': 'testing',
            'done': 'done'
        }
        
        for folder_name, status in status_folders.items():
            folder_path = project_path / folder_name
            if folder_path.exists():
                # Check for developer subfolders in progress/inprogress
                if folder_name in ['progress', 'inprogress']:
                    for item in folder_path.iterdir():
                        if item.is_dir():  # Developer subfolder
                            developer = item.name
                            for task_file in item.glob('*.md'):
                                if task_file.name.lower() != 'readme.md':
                                    task = self.parse_task_file(task_file)
                                    if task:
                                        task['column'] = status
                                        task['developer'] = developer
                                        task['projectId'] = project_id
                                        tasks.append(task)
                        elif item.suffix == '.md' and item.name.lower() != 'readme.md':  # Direct task file (not README)
                            task = self.parse_task_file(item)
                            if task:
                                task['column'] = status
                                task['projectId'] = project_id
                                tasks.append(task)
                else:
                    # Other folders
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
            
            # Parse YAML frontmatter
            metadata = {}
            if yaml_content:
                try:
                    metadata = yaml.safe_load(yaml_content) or {}
                except yaml.YAMLError as e:
                    logger.warning(f"Could not parse YAML in {file_path}: {e}")
            
            # Extract task ID from filename
            task_id = file_path.stem
            
            # Build task object - support both 'original_estimate' and 'estimate' for backward compatibility
            time_estimate = metadata.get('original_estimate') or metadata.get('estimate', '0h')
            
            # Also check for "Original estimate:" in markdown content if not found in YAML
            if time_estimate == '0h' and markdown_content:
                import re
                # Look for "Original estimate: 2h" pattern in markdown
                original_match = re.search(r'\*\*Original estimate:\s*([^*\n]+)\*\*', markdown_content)
                if original_match:
                    time_estimate = original_match.group(1).strip()
                else:
                    # Look for "Estimate: 7h" pattern in markdown  
                    estimate_match = re.search(r'\*\*Estimate:\s*([^*\n]+)\*\*', markdown_content)
                    if estimate_match:
                        time_estimate = estimate_match.group(1).strip()
            
            task = {
                'id': task_id,
                'title': metadata.get('title', task_id.replace('-', ' ').title()),
                'content': markdown_content,
                'fullContent': content,
                'timeEstimate': time_estimate,
                'timeSpent': metadata.get('spent_time', '0h'),
                'priority': metadata.get('priority', 'medium'),
                'developer': metadata.get('developer'),
                'assignee': metadata.get('assignee', metadata.get('developer', '')),
                'created': metadata.get('created', datetime.now().isoformat()[:10])
            }
            
            return task
            
        except Exception as e:
            logger.error(f"Error parsing task file {file_path}: {e}")
            return None
    
    def save_task(self, project_id, task_data):
        """Save or update a task"""
        project_path = self.base_dir / project_id
        project_path.mkdir(exist_ok=True)
        
        # Determine target folder based on task status
        status_folder_map = {
            'backlog': 'backlog',
            'progress': 'progress',
            'inprogress': 'inprogress',
            'review': 'review', 
            'testing': 'testing',
            'done': 'done'
        }
        
        target_folder = status_folder_map.get(task_data.get('column', 'backlog'), 'backlog')
        target_path = project_path / target_folder
        
        # Handle developer subfolder for progress/inprogress tasks
        if target_folder in ['progress', 'inprogress'] and task_data.get('developer'):
            target_path = target_path / task_data['developer']
        
        target_path.mkdir(parents=True, exist_ok=True)
        
        # Create task file
        task_file = target_path / f"{task_data['id']}.md"
        
        # Build YAML frontmatter
        frontmatter = {
            'title': task_data.get('title', ''),
            'original_estimate': task_data.get('timeEstimate', '0h'),
            'spent_time': task_data.get('timeSpent', '0h'),
            'priority': task_data.get('priority', 'medium'),
            'developer': task_data.get('developer'),
            'created': task_data.get('created', datetime.now().isoformat()[:10])
        }
        
        # Remove None values
        frontmatter = {k: v for k, v in frontmatter.items() if v is not None}
        
        # Build file content
        yaml_content = yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True)
        markdown_content = task_data.get('content', task_data.get('fullContent', ''))
        
        file_content = f"---\n{yaml_content}---\n\n{markdown_content}"
        
        # Write file
        task_file.write_text(file_content, encoding='utf-8')
        
        return True

    def update_task_file(self, project_id, task_data):
        """Update existing task file content and potentially move it to new status"""
        project_path = self.base_dir / project_id
        if not project_path.exists():
            return False

        task_id = task_data['id']
        
        # Find current task file location
        current_file = None
        current_path = None
        
        for folder in ['backlog', 'progress', 'inprogress', 'review', 'testing', 'done']:
            folder_path = project_path / folder
            if folder_path.exists():
                # Check direct files
                task_file = folder_path / f"{task_id}.md"
                if task_file.exists():
                    current_file = task_file
                    current_path = folder
                    break
                
                # Check developer subfolders
                if folder in ['progress', 'inprogress']:
                    for dev_folder in folder_path.iterdir():
                        if dev_folder.is_dir():
                            task_file = dev_folder / f"{task_id}.md"
                            if task_file.exists():
                                current_file = task_file
                                current_path = folder
                                break
                    if current_file:
                        break
        
        # Read current file content for comparison
        old_content = ""
        if current_file and current_file.exists():
            try:
                old_content = current_file.read_text(encoding='utf-8')
            except Exception as e:
                logger.warning(f"Could not read current file content: {e}")
        
        if not current_file:
            # Task doesn't exist, create new one
            return self.save_task(project_id, task_data)
        
        # Determine new location based on task status
        new_status = task_data.get('column', 'backlog')
        new_developer = task_data.get('developer')
        
        # Calculate new path
        new_folder_path = project_path / new_status
        if new_status in ['progress', 'inprogress'] and new_developer:
            new_folder_path = new_folder_path / new_developer
        
        new_folder_path.mkdir(parents=True, exist_ok=True)
        new_task_file = new_folder_path / f"{task_id}.md"
        
        # Build updated file content
        frontmatter = {
            'title': task_data.get('title', ''),
            'original_estimate': task_data.get('timeEstimate', '0h'),
            'spent_time': task_data.get('timeSpent', '0h'),
            'priority': task_data.get('priority', 'medium'),
            'developer': task_data.get('developer'),
            'created': task_data.get('created', datetime.now().isoformat()[:10])
        }
        
        # Remove None values
        frontmatter = {k: v for k, v in frontmatter.items() if v is not None}
        
        # Build file content
        import yaml
        yaml_content = yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True)
        markdown_content = task_data.get('content', task_data.get('fullContent', ''))
        
        # Add change log entry
        change_author = task_data.get('changeAuthor', 'User')
        change_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Generate change summary
        change_summary = self.generate_change_summary(old_content, task_data, current_path, new_status)
        
        # Append change log to markdown content
        if change_summary:
            if not markdown_content.strip().endswith('\n'):
                markdown_content += '\n'
            markdown_content += f"\n---\n**Змінено:** {change_timestamp} користувачем {change_author}\n{change_summary}\n"
        
        file_content = f"---\n{yaml_content}---\n\n{markdown_content}"
        
        # If location changed, move the file
        if str(new_task_file) != str(current_file):
            # Remove old file
            current_file.unlink()
            logger.info(f"Moved task {task_id} from {current_path} to {new_status}")
        
        # Write updated content to new location
        new_task_file.write_text(file_content, encoding='utf-8')
        logger.info(f"Updated task file: {new_task_file}")
        
        return True
    
    def generate_change_summary(self, old_content, task_data, old_status, new_status):
        """Generate a summary of changes made to the task"""
        changes = []
        
        # Parse old content if exists
        old_task_data = {}
        if old_content:
            try:
                if old_content.startswith('---'):
                    parts = old_content.split('---', 2)
                    if len(parts) >= 3:
                        yaml_content = parts[1].strip()
                        if yaml_content:
                            old_task_data = yaml.safe_load(yaml_content) or {}
            except Exception as e:
                logger.warning(f"Could not parse old task data: {e}")
        
        # Check for status change
        if old_status and new_status and old_status != new_status:
            changes.append(f"Статус змінено: {old_status} → {new_status}")
        
        # Check for title change
        old_title = old_task_data.get('title', '')
        new_title = task_data.get('title', '')
        if old_title != new_title:
            changes.append(f"Назва змінена: \"{old_title}\" → \"{new_title}\"")
        
        # Check for estimate change
        old_estimate = old_task_data.get('estimate', '0h')
        new_estimate = task_data.get('timeEstimate', '0h')
        if old_estimate != new_estimate:
            changes.append(f"Оцінка часу змінена: {old_estimate} → {new_estimate}")
        
        # Check for spent time change
        old_spent = old_task_data.get('spent_time', '0h')
        new_spent = task_data.get('timeSpent', '0h')
        if old_spent != new_spent:
            changes.append(f"Витрачений час змінено: {old_spent} → {new_spent}")
        
        # Check for priority change
        old_priority = old_task_data.get('priority', 'medium')
        new_priority = task_data.get('priority', 'medium')
        if old_priority != new_priority:
            changes.append(f"Пріоритет змінено: {old_priority} → {new_priority}")
        
        # Check for developer change
        old_developer = old_task_data.get('developer', '')
        new_developer = task_data.get('developer', '')
        if old_developer != new_developer:
            if new_developer:
                changes.append(f"Призначено розробника: {new_developer}")
            elif old_developer:
                changes.append(f"Розробника видалено: {old_developer}")
        
        if changes:
            return "- " + "\n- ".join(changes)
        else:
            return "Оновлено зміст завдання"
    
    def delete_task(self, project_id, task_id):
        """Delete a task from the project"""
        project_path = self.base_dir / project_id
        if not project_path.exists():
            return False
        
        # Search for task file in all folders
        for folder in ['backlog', 'progress', 'inprogress', 'review', 'testing', 'done']:
            folder_path = project_path / folder
            if folder_path.exists():
                # Check direct files
                task_file = folder_path / f"{task_id}.md"
                if task_file.exists():
                    task_file.unlink()
                    return True
                
                # Check developer subfolders
                if folder in ['progress', 'inprogress']:
                    for dev_folder in folder_path.iterdir():
                        if dev_folder.is_dir():
                            task_file = dev_folder / f"{task_id}.md"
                            if task_file.exists():
                                task_file.unlink()
                                return True
        
        return False
    
    def parse_time_to_minutes(self, time_str):
        """Parse time string to minutes"""
        if not time_str:
            return 0
        
        # Match patterns like "2h", "30m", "1.5h"
        pattern = r'(\d+\.?\d*)\s*([hm])'
        matches = re.findall(pattern, time_str.lower())
        
        total_minutes = 0
        for value, unit in matches:
            value = float(value)
            if unit == 'h':
                total_minutes += value * 60
            else:  # minutes
                total_minutes += value
        
        return int(total_minutes)
    
    def format_time_from_minutes(self, minutes):
        """Format minutes back to time string"""
        if minutes < 60:
            return f"{minutes}m" if minutes > 0 else "0h"
        else:
            hours = minutes // 60
            remaining_minutes = minutes % 60
            if remaining_minutes == 0:
                return f"{hours}h"
            else:
                return f"{hours}h {remaining_minutes}m"

# Initialize project manager
project_manager = ProjectManager(PROJECTS_BASE_DIR)

# Static file serving
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/favicon.ico')
def serve_favicon():
    return '', 404  # Return 404 for favicon to avoid errors

# SPA routing - catch all routes and serve index.html for client-side routing
@app.route('/project/<path:project_path>')
def serve_spa_project(project_path):
    """Handle SPA project routes"""
    return send_from_directory('.', 'index.html')

@app.route('/dashboard')
def serve_spa_dashboard():
    """Handle SPA dashboard route"""
    return send_from_directory('.', 'index.html')

# Serve static files with proper MIME types  
@app.route('/<path:filename>')
def serve_static(filename):
    # If it's a static file (has extension), serve it normally
    if '.' in filename:
        try:
            # Handle different file types
            if filename.endswith('.js'):
                response = send_from_directory('.', filename)
                response.headers['Content-Type'] = 'application/javascript'
                return response
            elif filename.endswith('.css'):
                response = send_from_directory('.', filename)
                response.headers['Content-Type'] = 'text/css'
                return response
            elif filename.endswith('.html'):
                response = send_from_directory('.', filename)
                response.headers['Content-Type'] = 'text/html'
                return response
            else:
                return send_from_directory('.', filename)
        except FileNotFoundError:
            return f"File {filename} not found", 404
    else:
        # If no extension, treat as SPA route and serve index.html
        return send_from_directory('.', 'index.html')

# API Routes
@app.route('/api/status')
def api_status():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'Fira server is running',
        'version': '1.0.0',
        'projects_dir': str(project_manager.base_dir)
    })

@app.route('/api/projects')
def api_get_projects():
    """Get all projects"""
    try:
        projects = project_manager.get_projects()
        return jsonify({
            'success': True,
            'projects': projects
        })
    except Exception as e:
        logger.error(f"Error getting projects: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/projects/<project_id>/tasks')
def api_get_project_tasks(project_id):
    """Get tasks for a specific project"""
    try:
        # URL decode the project_id to handle Cyrillic characters
        from urllib.parse import unquote
        decoded_project_id = unquote(project_id)
        
        logger.info(f"🔍 Getting tasks for project: '{project_id}' -> decoded: '{decoded_project_id}'")
        
        tasks = project_manager.get_project_tasks(decoded_project_id)
        
        logger.info(f"📝 Found {len(tasks)} tasks for project '{decoded_project_id}'")
        
        return jsonify({
            'success': True,
            'tasks': tasks
        })
    except Exception as e:
        logger.error(f"Error getting tasks for {project_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/projects/<project_id>/tasks/<task_id>')
def api_get_task(project_id, task_id):
    """Get a specific task"""
    try:
        # URL decode the project_id to handle Cyrillic characters
        from urllib.parse import unquote
        decoded_project_id = unquote(project_id)
        
        tasks = project_manager.get_project_tasks(decoded_project_id)
        task = next((t for t in tasks if t['id'] == task_id), None)
        
        if not task:
            return jsonify({
                'success': False,
                'error': 'Task not found'
            }), 404
        
        return jsonify({
            'success': True,
            'task': task
        })
    except Exception as e:
        logger.error(f"Error getting task {task_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/projects/<project_id>/tasks', methods=['POST'])
def api_create_task(project_id):
    """Create a new task"""
    try:
        # URL decode the project_id to handle Cyrillic characters
        from urllib.parse import unquote
        decoded_project_id = unquote(project_id)
        
        task_data = request.json
        if not task_data or not task_data.get('id'):
            return jsonify({
                'success': False,
                'error': 'Task data and ID required'
            }), 400
        
        success = project_manager.save_task(decoded_project_id, task_data)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Task created successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to create task'
            }), 500
            
    except Exception as e:
        logger.error(f"Error creating task: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/projects/<project_id>/tasks/<task_id>', methods=['PUT'])
def api_update_task(project_id, task_id):
    """Update an existing task"""
    try:
        # URL decode the project_id to handle Cyrillic characters
        from urllib.parse import unquote
        decoded_project_id = unquote(project_id)
        
        task_data = request.json
        if not task_data:
            return jsonify({
                'success': False,
                'error': 'Task data required'
            }), 400
        
        # Ensure task ID matches
        task_data['id'] = task_id
        
        # Update task file (handles moving between directories if needed)
        success = project_manager.update_task_file(decoded_project_id, task_data)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Task updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to update task'
            }), 500
            
    except Exception as e:
        logger.error(f"Error updating task {task_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/projects/<project_id>/tasks/<task_id>', methods=['DELETE'])
def api_delete_task(project_id, task_id):
    """Delete a task"""
    try:
        # URL decode the project_id to handle Cyrillic characters
        from urllib.parse import unquote
        decoded_project_id = unquote(project_id)
        
        success = project_manager.delete_task(decoded_project_id, task_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Task deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Task not found'
            }), 404
            
    except Exception as e:
        logger.error(f"Error deleting task {task_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/scan-detailed')
def api_scan_projects_detailed():
    """Detailed scan of all projects and tasks for cache generation"""
    try:
        logger.info("Starting detailed project scan for cache generation...")
        
        # Get basic project data
        projects = project_manager.get_projects()
        
        # Collect all tasks from all projects
        all_tasks = []
        project_tasks = {}
        file_structure = {}
        
        for project in projects:
            project_id = project['id']
            logger.info(f"Scanning project: {project_id}")
            
            # Get tasks for this project
            tasks = project_manager.get_project_tasks(project_id)
            project_tasks[project_id] = tasks
            all_tasks.extend(tasks)
            
            # Build detailed file structure
            project_path = project_manager.base_dir / project_id
            file_structure[project_id] = scan_project_structure(project_path)
        
        # Calculate overall statistics
        total_projects = len(projects)
        total_tasks = len(all_tasks)
        
        # Group tasks by status for summary
        task_summary = {}
        for task in all_tasks:
            status = task.get('column', 'unknown')
            if status not in task_summary:
                task_summary[status] = 0
            task_summary[status] += 1
        
        result = {
            'success': True,
            'timestamp': datetime.now().isoformat(),
            'projects': projects,
            'allTasks': all_tasks,
            'projectTasks': project_tasks,
            'fileStructure': file_structure,
            'summary': {
                'totalProjects': total_projects,
                'totalTasks': total_tasks,
                'tasksByStatus': task_summary,
                'scanDuration': 'completed'
            },
            'metadata': {
                'version': '1.0',
                'generatedBy': 'Fira-Server-Scanner',
                'baseDirectory': str(project_manager.base_dir),
                'scanType': 'detailed'
            }
        }
        
        logger.info(f"✅ Detailed scan completed: {total_projects} projects, {total_tasks} tasks")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error during detailed scan: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def scan_project_structure(project_path):
    """Scan project directory structure for cache"""
    structure = {
        'name': project_path.name,
        'type': 'directory',
        'path': str(project_path),
        'children': []
    }
    
    if not project_path.exists():
        return structure
    
    try:
        for item in sorted(project_path.iterdir()):
            if item.name.startswith('.'):
                continue  # Skip hidden files
                
            if item.is_dir():
                # Recursively scan subdirectories
                child_structure = {
                    'name': item.name,
                    'type': 'directory',
                    'path': str(item),
                    'children': []
                }
                
                # For task directories, scan files
                if item.name in ['backlog', 'progress', 'inprogress', 'review', 'testing', 'done']:
                    child_structure['taskCount'] = 0
                    child_structure['developers'] = []
                    
                    for sub_item in item.iterdir():
                        if sub_item.is_file() and sub_item.suffix == '.md':
                            child_structure['taskCount'] += 1
                            child_structure['children'].append({
                                'name': sub_item.name,
                                'type': 'task',
                                'path': str(sub_item),
                                'size': sub_item.stat().st_size,
                                'modified': datetime.fromtimestamp(sub_item.stat().st_mtime).isoformat()
                            })
                        elif sub_item.is_dir() and item.name in ['progress', 'inprogress']:
                            # Developer folder
                            developer_name = sub_item.name
                            child_structure['developers'].append(developer_name)
                            
                            dev_structure = {
                                'name': developer_name,
                                'type': 'developer',
                                'path': str(sub_item),
                                'taskCount': 0,
                                'children': []
                            }
                            
                            for task_file in sub_item.glob('*.md'):
                                child_structure['taskCount'] += 1
                                dev_structure['taskCount'] += 1
                                dev_structure['children'].append({
                                    'name': task_file.name,
                                    'type': 'task',
                                    'path': str(task_file),
                                    'size': task_file.stat().st_size,
                                    'modified': datetime.fromtimestamp(task_file.stat().st_mtime).isoformat(),
                                    'developer': developer_name
                                })
                            
                            child_structure['children'].append(dev_structure)
                
                structure['children'].append(child_structure)
                
            elif item.is_file():
                # Regular files (README, etc.)
                structure['children'].append({
                    'name': item.name,
                    'type': 'file',
                    'path': str(item),
                    'size': item.stat().st_size,
                    'modified': datetime.fromtimestamp(item.stat().st_mtime).isoformat()
                })
                
    except Exception as e:
        logger.warning(f"Error scanning {project_path}: {e}")
    
    return structure

@app.route('/api/projects/<project_id>/description', methods=['PUT'])
def api_update_project_description(project_id):
    """Update project description by updating README.md file"""
    try:
        # URL decode the project_id to handle Cyrillic characters
        from urllib.parse import unquote
        decoded_project_id = unquote(project_id)
        
        request_data = request.json
        if not request_data or 'description' not in request_data:
            return jsonify({
                'success': False,
                'error': 'Description is required'
            }), 400
        
        new_description = request_data['description']
        change_author = request_data.get('changeAuthor', 'User')
        
        # Path to project README.md
        project_path = project_manager.base_dir / decoded_project_id
        project_path.mkdir(exist_ok=True)
        readme_path = project_path / 'README.md'
        
        # Read current content if exists
        old_description = ""
        if readme_path.exists():
            try:
                old_description = readme_path.read_text(encoding='utf-8').strip()
            except Exception as e:
                logger.warning(f"Could not read current README.md: {e}")
        
        # Add change log entry
        change_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        change_log = f"\n\n---\n**Опис оновлено:** {change_timestamp} користувачем {change_author}"
        
        if old_description and old_description != new_description:
            change_log += f"\n**Попередній опис:** {old_description[:100]}{'...' if len(old_description) > 100 else ''}"
        
        # Write updated content
        updated_content = new_description + change_log
        readme_path.write_text(updated_content, encoding='utf-8')
        
        logger.info(f"Updated project description for {decoded_project_id}")
        
        return jsonify({
            'success': True,
            'message': 'Project description updated successfully'
        })
        
    except Exception as e:
        logger.error(f"Error updating project description: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/save-cache', methods=['POST'])
def api_save_cache():
    """Save cache file to server directory"""
    try:
        cache_data = request.get_json()
        
        if not cache_data:
            return jsonify({
                'success': False,
                'error': 'No cache data provided'
            }), 400
        
        # Define cache file path (same directory as server.py)
        cache_file_path = Path(__file__).parent / 'fira-cache.json'
        
        # Write cache file
        with open(cache_file_path, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Cache file saved to: {cache_file_path}")
        
        return jsonify({
            'success': True,
            'message': 'Cache file saved successfully',
            'path': str(cache_file_path),
            'size': cache_file_path.stat().st_size
        })
        
    except Exception as e:
        logger.error(f"Error saving cache file: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def check_port_available(port):
    """Check if port is available"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) != 0

def get_local_ip():
    """Get local IP address"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except:
        return "127.0.0.1"

if __name__ == '__main__':
    # Check if port is available
    if not check_port_available(PORT):
        logger.error(f"❌ Port {PORT} is already in use!")
        logger.info("🔧 Try:")
        logger.info(f"   1. Stop existing process: lsof -ti:{PORT} | xargs kill")
        logger.info(f"   2. Use different port: FIRA_PORT=8080 python3 server.py")
        logger.info(f"   3. Run stop script: ./stop.sh")
        sys.exit(1)

    local_ip = get_local_ip()
    
    print(f"""
🍎🚀 Fira Project Management Server Starting...
========================================
📁 Projects directory: {PROJECTS_BASE_DIR}
🌐 Local URL:  http://localhost:{PORT}
🌐 Network URL: http://{local_ip}:{PORT}
🔧 API endpoints: http://localhost:{PORT}/api/
📋 Cache endpoint: http://localhost:{PORT}/api/scan-detailed

💡 Usage:
   1. Open http://localhost:{PORT} in your browser
   2. Click 'Start Server Scan' button
   3. Download fira-cache.json when prompted
   4. Place cache file next to index.html for fast loading

⏹️  Press Ctrl+C to stop the server
========================================
    """)
    
    try:
        # Run server with better error handling
        app.run(
            host='127.0.0.1',  # Bind only to localhost for security
            port=PORT, 
            debug=False,  # Disable debug in production
            threaded=True,  # Enable threading for better performance
            use_reloader=False  # Disable reloader to avoid issues
        )
    except KeyboardInterrupt:
        logger.info("🛑 Server stopped by user")
    except Exception as e:
        logger.error(f"❌ Server error: {e}")
        sys.exit(1)