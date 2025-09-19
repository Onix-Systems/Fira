// Automatic project scanner that always scans on page load
// Works for both file:// and http:// protocols

class AutoProjectsScanner {
    constructor() {
        this.projects = [];
    }

    async scanProjects() {
        console.log('🔍 AutoProjectsScanner: Starting automatic scan...');
        
        // For HTTP protocols, try to scan dynamically
        if (window.location.protocol.startsWith('http')) {
            return await this.scanViaHTTP();
        }
        
        // For file:// protocol, show user-friendly message about limitations
        console.log('⚠️ File:// protocol detected - dynamic scanning not possible');
        console.log('💡 For real-time updates, either:');
        console.log('   1. Use HTTP server: python -m http.server 8000');
        console.log('   2. Use File System Access API (Chrome/Edge only)');
        console.log('   3. Run update-projects.bat manually when projects change');
        
        return false;
    }

    async scanViaHTTP() {
        try {
            console.log('🔄 Scanning projects via HTTP...');
            
            // Try to load projects directory listing
            const response = await fetch('projects/');
            if (!response.ok) {
                console.log('📁 No projects/ directory found, scanning root...');
                return await this.scanRootDirectory();
            }
            
            const html = await response.text();
            return await this.parseProjectsFromHTML(html, 'projects/');
            
        } catch (error) {
            console.warn('❌ HTTP scanning failed:', error.message);
            return false;
        }
    }

    async scanRootDirectory() {
        try {
            const response = await fetch('./');
            const html = await response.text();
            return await this.parseProjectsFromHTML(html, './');
        } catch (error) {
            console.warn('❌ Root directory scanning failed:', error.message);
            return false;
        }
    }

    async parseProjectsFromHTML(html, basePath) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('a[href]');
        
        this.projects = [];
        
        for (const link of links) {
            const href = link.getAttribute('href');
            
            // Skip parent directories and files
            if (href.startsWith('..') || href.startsWith('/') || !href.endsWith('/')) {
                continue;
            }
            
            // Skip common non-project directories
            if (href.startsWith('.') || href.includes('node_modules') || href.includes('.git')) {
                continue;
            }
            
            const projectId = decodeURIComponent(href.slice(0, -1));
            
            // Skip if it's a known non-project folder
            const nonProjectFolders = ['images', 'res', 'pages', 'web', 'venv', '__pycache__'];
            if (nonProjectFolders.includes(projectId)) {
                continue;
            }
            
            console.log(`🔍 Found potential project: ${projectId}`);
            const project = await this.scanProject(projectId, basePath + href);
            
            if (project) {
                this.projects.push(project);
                console.log(`✅ Added project: ${projectId} (${this.getTotalTasks(project)} tasks)`);
            }
        }
        
        console.log(`✅ AutoProjectsScanner: Found ${this.projects.length} projects`);
        return this.projects.length > 0;
    }

    async scanProject(projectId, projectPath) {
        try {
            const project = {
                id: projectId,
                name: this.formatProjectName(projectId),
                description: await this.getProjectDescription(projectPath),
                stats: await this.getProjectStats(projectPath)
            };

            return project;
            
        } catch (error) {
            console.warn(`⚠️ Could not scan project ${projectId}:`, error.message);
            return null;
        }
    }

    async getProjectDescription(projectPath) {
        try {
            const response = await fetch(projectPath + 'README.md');
            if (response.ok) {
                const content = await response.text();
                
                // Extract first meaningful line
                const lines = content.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```')) {
                        return trimmed;
                    }
                }
            }
        } catch (error) {
            // README doesn't exist
        }
        
        return `Project: ${this.formatProjectName(projectPath)}`;
    }

    async getProjectStats(projectPath) {
        const stats = {
            backlog: { count: 0, detail: '0 tasks' },
            inProgress: { count: 0, detail: '0 tasks' },
            done: { count: 0, detail: '0 tasks' }
        };

        const columnMappings = {
            'backlog': 'backlog',
            'progress': 'inProgress',
            'inprogress': 'inProgress',
            'review': 'inProgress', 
            'testing': 'inProgress',
            'done': 'done'
        };

        for (const [columnName, statKey] of Object.entries(columnMappings)) {
            try {
                const count = await this.countTasksInColumn(projectPath + columnName + '/');
                stats[statKey].count += count;
            } catch (error) {
                // Column doesn't exist
            }
        }

        // Add hours and developers data
        stats.backlog.hours = `${stats.backlog.count * 4}h`;
        stats.done.hours = `${stats.done.count * 6}h`;
        stats.inProgress.developers = `${Math.max(1, 1)} dev`; // Basic implementation, can be enhanced

        // Update detail strings
        for (const key of Object.keys(stats)) {
            const count = stats[key].count;
            stats[key].detail = `${count} task${count !== 1 ? 's' : ''}`;
        }

        return stats;
    }

    async countTasksInColumn(columnPath) {
        try {
            const response = await fetch(columnPath);
            if (!response.ok) return 0;
            
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = doc.querySelectorAll('a[href]');
            
            let count = 0;
            
            for (const link of links) {
                const href = link.getAttribute('href');
                if (href && href.endsWith('.md') && !href.toLowerCase().includes('readme')) {
                    count++;
                }
            }
            
            return count;
            
        } catch (error) {
            return 0;
        }
    }

    formatProjectName(projectId) {
        return projectId.replace(/[/_-]/g, ' ')
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
    }

    getTotalTasks(project) {
        return project.stats.backlog.count + 
               project.stats.inProgress.count + 
               project.stats.done.count;
    }

    getProjects() {
        return this.projects;
    }
}

// Create global instance
window.autoProjectsScanner = new AutoProjectsScanner();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutoProjectsScanner;
}