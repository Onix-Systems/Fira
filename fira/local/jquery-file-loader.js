// jQuery-based file loader for client-only mode
// Provides alternative to File System Access API when server is not available

class JQueryFileLoader {
    constructor() {
        this.projects = [];
        this.projectFiles = {};
        this.isEnabled = typeof $ !== 'undefined';
        this.protocolSupported = window.location.protocol !== 'file:';
    }

    async initialize() {
        console.log('🔍 jQuery File Loader: Starting initialization...');
        
        // Check protocol first - jQuery loader only works with HTTP protocols
        if (!this.protocolSupported) {
            console.log('🚫 jQuery File Loader: Disabled for file:// protocol due to CORS restrictions');
            console.log('💡 To use dynamic file loading, run HTTP server: python -m http.server 8000');
            return false;
        }
        
        if (!this.isEnabled) {
            console.warn('jQuery not loaded or not available, fallback file loader disabled');
            return false;
        }

        try {
            await this.loadProjectsFromDirectory();
            console.log(`🔍 jQuery File Loader: Found ${this.projects.length} projects after loading`);
            
            if (this.projects.length > 0) {
                console.log('✅ jQuery File Loader: Initialization successful');
                return true;
            } else {
                console.log('⚠️ jQuery File Loader: No projects found, initialization failed');
                return false;
            }
        } catch (error) {
            console.error('❌ jQuery File Loader: Failed to initialize:', error);
            return false;
        }
    }

    async loadProjectsFromDirectory() {
        try {
            // Try to load directory listing
            const response = await $.get('.', { dataType: 'html' });
            const fileList = this.parseDirectoryListing(response);
            
            // Look for projects folder
            if (fileList.includes('projects/')) {
                await this.loadFromProjectsFolder();
            } else {
                // Scan current directory for project folders
                await this.scanCurrentDirectory(fileList);
            }
            
        } catch (error) {
            if (window.location.protocol === 'file:') {
                console.warn('jQuery file loader not available with file:// protocol due to CORS restrictions. Use HTTP server (python -m http.server 8000) or open via http://localhost:8000');
            } else {
                console.warn('Directory listing not available, using static approach');
            }
            await this.loadStaticProjectStructure();
        }
    }

    parseDirectoryListing(html) {
        const files = [];
        const $html = $(html);
        
        // Try to extract file/folder names from various server directory listing formats
        $html.find('a[href]').each(function() {
            const href = $(this).attr('href');
            const text = $(this).text();
            
            // Skip parent directory links and common non-project files
            if (href && !href.startsWith('..') && !href.startsWith('/') && 
                !href.includes('index.html') && !href.includes('.js') && !href.includes('.css')) {
                // Decode URL-encoded characters (e.g., %D1%81enik -> сenik)
                const decodedHref = decodeURIComponent(href);
                files.push(decodedHref);
            }
        });
        
        return files;
    }

    async loadFromProjectsFolder() {
        try {
            const projectsResponse = await $.get('projects/', { dataType: 'html' });
            const projectFolders = this.parseDirectoryListing(projectsResponse);
            
            console.log('Found project folders:', projectFolders);
            
            for (const folder of projectFolders) {
                if (folder.endsWith('/')) {
                    const projectId = folder.slice(0, -1);
                    // Use URL-encoded folder name for path, but decoded for project ID
                    const encodedFolder = encodeURIComponent(projectId) + '/';
                    await this.loadProject(projectId, 'projects/' + encodedFolder);
                }
            }
            
        } catch (error) {
            console.error('Failed to load from projects folder:', error);
        }
    }

    async scanCurrentDirectory(fileList) {
        // Look for potential project folders in current directory
        for (const item of fileList) {
            if (item.endsWith('/') && !item.startsWith('.')) {
                // Try to load as project
                await this.loadProject(item.slice(0, -1), item);
            }
        }
    }

    async loadProject(projectId, projectPath) {
        try {
            const project = {
                id: projectId,
                name: this.formatProjectName(projectId),
                description: 'No description available',
                stats: {
                    backlog: { count: 0, detail: '0 tasks' },
                    inProgress: { count: 0, detail: '0 tasks' },
                    done: { count: 0, detail: '0 tasks' }
                }
            };

            // Try to load README.md for description
            try {
                const readmeResponse = await $.get(projectPath + 'README.md', { dataType: 'text' });
                const description = this.extractDescriptionFromReadme(readmeResponse);
                if (description) {
                    project.description = description;
                }
            } catch (error) {
                // README.md doesn't exist, use default description
            }

            // Load project structure and count tasks
            await this.loadProjectStructure(project, projectPath);
            
            this.projects.push(project);
            console.log(`Loaded project: ${projectId}`);
            
        } catch (error) {
            console.warn(`Failed to load project ${projectId}:`, error);
        }
    }

    async loadProjectStructure(project, projectPath) {
        const taskCounts = {
            backlog: 0,
            progress: 0,
            done: 0
        };

        const columns = ['backlog', 'progress', 'review', 'testing', 'done'];
        
        for (const column of columns) {
            try {
                const columnResponse = await $.get(projectPath + column + '/', { dataType: 'html' });
                const files = this.parseDirectoryListing(columnResponse);
                
                // Count .md files (excluding README.md)
                const mdFiles = files.filter(file => 
                    file.endsWith('.md') && 
                    !file.toLowerCase().includes('readme')
                );
                
                const count = mdFiles.length;
                
                // Map column names to stats
                if (column === 'backlog') {
                    taskCounts.backlog = count;
                } else if (['progress', 'review', 'testing'].includes(column)) {
                    taskCounts.progress += count;
                } else if (column === 'done') {
                    taskCounts.done = count;
                }
                
            } catch (error) {
                // Column folder doesn't exist, skip
            }
        }

        // Update project stats
        project.stats = {
            backlog: { 
                count: taskCounts.backlog, 
                detail: `${taskCounts.backlog} task${taskCounts.backlog !== 1 ? 's' : ''}` 
            },
            inProgress: { 
                count: taskCounts.progress, 
                detail: `${taskCounts.progress} task${taskCounts.progress !== 1 ? 's' : ''}` 
            },
            done: { 
                count: taskCounts.done, 
                detail: `${taskCounts.done} task${taskCounts.done !== 1 ? 's' : ''}` 
            }
        };
    }

    async loadStaticProjectStructure() {
        // Don't use hardcoded project list - instead fail gracefully
        console.log('Could not scan projects directory, no projects loaded');
        
        // Let the system fall back to static data from projects-data.js
        // instead of creating fake projects here
    }

    formatProjectName(projectId) {
        return projectId
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    extractDescriptionFromReadme(readmeContent) {
        if (!readmeContent) return null;
        
        // Extract first paragraph after title
        const lines = readmeContent.split('\n');
        let description = '';
        let foundTitle = false;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('#')) {
                foundTitle = true;
                continue;
            }
            
            if (foundTitle && trimmed.length > 0 && !trimmed.startsWith('#')) {
                description = trimmed;
                break;
            }
        }
        
        return description || null;
    }

    // Public API
    getProjects() {
        return this.projects;
    }

    async loadTasksForProject(projectId) {
        // For now, return empty tasks - could be expanded to load actual task files
        return [];
    }
}

// Initialize global jQuery file loader
window.jQueryFileLoader = new JQueryFileLoader();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JQueryFileLoader;
}