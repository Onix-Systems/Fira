// Real File System Loader using File System Access API
// Automatically discovers projects by scanning the actual file system

class RealFileSystemLoader {
    constructor() {
        this.projects = [];
        this.isSupported = 'showDirectoryPicker' in window;
        this.rootDirectoryHandle = null;
    }

    async initialize() {
        console.log('🔍 Real File System Loader: Starting initialization...');
        
        if (!this.isSupported) {
            console.log('🚫 File System Access API not supported in this browser');
            return false;
        }

        try {
            // Ask user to select the project root directory
            await this.selectRootDirectory();
            
            // Scan for projects
            await this.scanForProjects();
            
            console.log(`✅ Real File System Loader: Found ${this.projects.length} projects`);
            return this.projects.length > 0;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('🚫 User cancelled directory selection');
            } else {
                console.error('❌ Real File System Loader failed:', error);
            }
            return false;
        }
    }

    async selectRootDirectory() {
        console.log('📁 Please select your projects root directory...');
        
        this.rootDirectoryHandle = await window.showDirectoryPicker({
            mode: 'read',
            startIn: 'documents'
        });
        
        console.log(`📁 Selected directory: ${this.rootDirectoryHandle.name}`);
    }

    async scanForProjects() {
        if (!this.rootDirectoryHandle) {
            throw new Error('No root directory selected');
        }

        console.log('🔍 Scanning for projects...');
        
        // First, check if there's a 'projects' subdirectory
        let projectsDir = this.rootDirectoryHandle;
        
        try {
            const projectsSubdir = await this.rootDirectoryHandle.getDirectoryHandle('projects');
            projectsDir = projectsSubdir;
            console.log('📁 Found projects/ subdirectory');
        } catch (error) {
            console.log('📁 No projects/ subdirectory, scanning root directory');
        }

        // Scan directory for project folders
        for await (const [name, handle] of projectsDir.entries()) {
            if (handle.kind === 'directory') {
                await this.scanProjectDirectory(name, handle);
            }
        }
    }

    async scanProjectDirectory(projectId, projectHandle) {
        console.log(`🔍 Scanning project: ${projectId}`);
        
        try {
            const project = {
                id: projectId,
                name: this.formatProjectName(projectId),
                description: await this.getProjectDescription(projectHandle),
                stats: await this.getProjectStats(projectHandle)
            };

            this.projects.push(project);
            console.log(`✅ Added project: ${projectId} (${project.stats.backlog.count + project.stats.inProgress.count + project.stats.done.count} total tasks)`);
            
        } catch (error) {
            console.warn(`⚠️ Error scanning project ${projectId}:`, error);
        }
    }

    async getProjectDescription(projectHandle) {
        try {
            const readmeHandle = await projectHandle.getFileHandle('README.md');
            const readmeFile = await readmeHandle.getFile();
            const content = await readmeFile.text();
            
            // Extract first paragraph as description
            const lines = content.split('\n');
            for (let line of lines) {
                line = line.trim();
                if (line && !line.startsWith('#') && !line.startsWith('```')) {
                    return line;
                }
            }
            
        } catch (error) {
            // README.md doesn't exist or can't be read
        }
        
        return `Project: ${this.formatProjectName(projectHandle.name)}`;
    }

    async getProjectStats(projectHandle) {
        const stats = {
            backlog: { count: 0, detail: '0 tasks' },
            inProgress: { count: 0, detail: '0 tasks' },
            done: { count: 0, detail: '0 tasks' }
        };

        const columns = [
            { name: 'backlog', statKey: 'backlog' },
            { name: 'progress', statKey: 'inProgress' },
            { name: 'inprogress', statKey: 'inProgress' }, // Alternative name
            { name: 'review', statKey: 'inProgress' },
            { name: 'testing', statKey: 'inProgress' },
            { name: 'done', statKey: 'done' }
        ];

        for (const column of columns) {
            try {
                const columnHandle = await projectHandle.getDirectoryHandle(column.name);
                const taskCount = await this.countTasksInColumn(columnHandle);
                stats[column.statKey].count += taskCount;
            } catch (error) {
                // Column doesn't exist, skip
            }
        }

        // Add hours and developers data
        stats.backlog.hours = `${stats.backlog.count * 4}h`;
        stats.done.hours = `${stats.done.count * 6}h`;
        stats.inProgress.developers = `${Math.max(1, 1)} dev`; // Basic implementation, can be enhanced

        // Update detail strings
        stats.backlog.detail = `${stats.backlog.count} task${stats.backlog.count !== 1 ? 's' : ''}`;
        stats.inProgress.detail = `${stats.inProgress.count} task${stats.inProgress.count !== 1 ? 's' : ''}`;
        stats.done.detail = `${stats.done.count} task${stats.done.count !== 1 ? 's' : ''}`;

        return stats;
    }

    async countTasksInColumn(columnHandle) {
        let count = 0;
        
        for await (const [name, handle] of columnHandle.entries()) {
            if (handle.kind === 'file' && name.endsWith('.md') && !name.toLowerCase().includes('readme')) {
                count++;
            } else if (handle.kind === 'directory') {
                // Check developer subdirectories
                try {
                    for await (const [subName, subHandle] of handle.entries()) {
                        if (subHandle.kind === 'file' && subName.endsWith('.md') && !subName.toLowerCase().includes('readme')) {
                            count++;
                        }
                    }
                } catch (error) {
                    // Can't read subdirectory, skip
                }
            }
        }
        
        return count;
    }

    formatProjectName(projectId) {
        return projectId
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    // Public API
    getProjects() {
        return this.projects;
    }

    isFileSystemSupported() {
        return this.isSupported;
    }

    hasSelectedDirectory() {
        return this.rootDirectoryHandle !== null;
    }
}

// Create global instance
window.realFileSystemLoader = new RealFileSystemLoader();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealFileSystemLoader;
}