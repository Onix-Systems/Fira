#!/usr/bin/env python3
"""
Auto-generate projects-data.js from real file system
Run this script to scan projects/ folder and create JavaScript data file
"""

import os
import json
import re
from pathlib import Path

def scan_projects():
    """Scan projects directory and return project data"""
    projects_dir = Path('projects')
    projects = []
    
    if not projects_dir.exists():
        print(f"❌ Projects directory not found: {projects_dir}")
        return projects
    
    print(f"🔍 Scanning projects directory: {projects_dir}")
    
    for project_path in projects_dir.iterdir():
        if project_path.is_dir() and not project_path.name.startswith('.'):
            project = scan_project(project_path)
            if project:
                projects.append(project)
                print(f"✅ Found project: {project['id']} ({project['stats']['backlog']['count'] + project['stats']['inProgress']['count'] + project['stats']['done']['count']} tasks)")
    
    return projects

def scan_project(project_path):
    """Scan individual project directory"""
    project_id = project_path.name
    project_name = format_project_name(project_id)
    
    # Get description from README.md
    description = get_project_description(project_path)
    
    # Get project stats
    stats = get_project_stats(project_path)
    
    return {
        'id': project_id,
        'name': project_name,
        'description': description,
        'stats': stats
    }

def format_project_name(project_id):
    """Convert project ID to readable name"""
    return project_id.replace('-', ' ').replace('_', ' ').title()

def get_project_description(project_path):
    """Extract description from README.md"""
    readme_path = project_path / 'README.md'
    
    if readme_path.exists():
        try:
            with open(readme_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract first non-header paragraph
            lines = content.split('\n')
            for line in lines:
                line = line.strip()
                if line and not line.startswith('#') and not line.startswith('```'):
                    return line
                    
        except Exception as e:
            print(f"⚠️  Could not read README for {project_path.name}: {e}")
    
    return f"Project: {format_project_name(project_path.name)}"

def get_project_stats(project_path):
    """Calculate project statistics by counting tasks in each column"""
    stats = {
        'backlog': {'count': 0, 'detail': '0 tasks'},
        'inProgress': {'count': 0, 'detail': '0 tasks'}, 
        'done': {'count': 0, 'detail': '0 tasks'}
    }
    
    # Define column mappings
    column_mappings = {
        'backlog': 'backlog',
        'progress': 'inProgress',
        'inprogress': 'inProgress',
        'review': 'inProgress',
        'testing': 'inProgress',
        'done': 'done'
    }
    
    for column_name, stat_key in column_mappings.items():
        column_path = project_path / column_name
        if column_path.exists() and column_path.is_dir():
            task_count = count_tasks_in_column(column_path)
            stats[stat_key]['count'] += task_count
    
    # Update detail strings
    for key in stats:
        count = stats[key]['count']
        stats[key]['detail'] = f"{count} task{'s' if count != 1 else ''}"
    
    return stats

def count_tasks_in_column(column_path):
    """Count .md files in a column directory"""
    count = 0
    
    for item in column_path.iterdir():
        if item.is_file() and item.suffix == '.md' and item.name.lower() != 'readme.md':
            count += 1
        elif item.is_dir():
            # Count tasks in developer subdirectories
            for subitem in item.iterdir():
                if subitem.is_file() and subitem.suffix == '.md' and subitem.name.lower() != 'readme.md':
                    count += 1
    
    return count

def generate_js_file(projects):
    """Generate projects-data.js file"""
    timestamp = __import__('datetime').datetime.now().isoformat()
    
    js_content = f"""// Auto-generated project data from real file system
// Generated at: {timestamp}
// DO NOT EDIT MANUALLY - run generate-projects-data.py to regenerate

window.PROJECTS_DATA = {json.dumps(projects, indent=4, ensure_ascii=False)};

console.log('📊 Loaded {{}} real projects from generated data'.replace('{{}}', window.PROJECTS_DATA.length));
"""
    
    output_path = Path('projects-data.js')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"✅ Generated: {output_path}")
    return output_path

def main():
    print("🚀 Auto-generating projects data from file system...")
    
    # Scan projects
    projects = scan_projects()
    
    if not projects:
        print("⚠️  No projects found, creating empty data file")
    
    # Generate JavaScript file
    output_path = generate_js_file(projects)
    
    print(f"\n📊 Summary:")
    print(f"  - Found {len(projects)} projects")
    print(f"  - Generated: {output_path}")
    print(f"  - Total tasks: {sum(p['stats']['backlog']['count'] + p['stats']['inProgress']['count'] + p['stats']['done']['count'] for p in projects)}")
    
    print(f"\n💡 Usage:")
    print(f"  - Run this script whenever you add/remove projects or tasks")
    print(f"  - The generated file will be automatically loaded by index.html")
    print(f"  - No user interaction needed - projects load automatically!")

if __name__ == '__main__':
    main()