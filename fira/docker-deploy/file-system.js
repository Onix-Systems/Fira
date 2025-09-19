// File System Access API for Chrome/Edge (without server)
// Prevent double declaration when loaded via server
if (typeof FileSystemProjectLoader === 'undefined') {
class FileSystemProjectLoader {
    constructor() {
        this.directoryHandle = null;
        this.isSupported = 'showDirectoryPicker' in window;
    }

    // Повертає масив імен підпапок (розробників) всередині переданої директорії
    async getDevelopersFromDirectory(dirHandle) {
        const developers = new Set();
        try {
            for await (const [name, handle] of dirHandle.entries()) {
                if (handle.kind === 'directory' && !name.startsWith('.')) {
                    developers.add(name);
                }
            }
        } catch (err) {
            console.warn('getDevelopersFromDirectory error:', err);
        }
        return Array.from(developers);
    }
    
    async selectProjectsDirectory() {
        if (!this.isSupported) {
            throw new Error('File System Access API is not supported by this browser. Use Chrome/Edge 86+ or run a server.');
        }

        try {
            // showDirectoryPicker does not accept "mode" option; request read/write on file handles later
            this.directoryHandle = await window.showDirectoryPicker({
                startIn: 'documents'
            });
            
            return this.directoryHandle;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Directory selection cancelled');
            }
            throw error;
        }
    }
    
    /**
     * Update existing task file on disk.
     * Expects task object to contain a _fileHandle property (set when reading files).
     * Writes Markdown file with basic YAML frontmatter for metadata.
     */
    async updateTask(projectId, task) {
        if (!this.directoryHandle) {
            throw new Error('Projects directory not selected');
        }

        const fileHandle = task._fileHandle;
        if (!fileHandle) {
            throw new Error('No file handle available for this task');
        }

        // Request readwrite permission if not already granted
        let permission = await fileHandle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
            permission = await fileHandle.requestPermission({ mode: 'readwrite' });
        }

        if (permission !== 'granted') {
            throw new Error('Write permission denied for task file');
        }

        // Build frontmatter
        const fm = {
            title: task.title || '',
            developer: task.developer || '',
            estimate: task.timeEstimate || '',
            spent_time: task.timeSpent || '',
            priority: task.priority || ''
        };
        
        console.log(`📝 file-system.js: Building frontmatter for task ${task.id}:`);
        console.log(`  estimate: "${fm.estimate}"`);
        console.log(`  spent_time: "${fm.spent_time}"`);

        const frontmatterLines = ['---'];
        Object.keys(fm).forEach(k => {
            // Ensure value is single-line
            const v = fm[k] ? String(fm[k]).replace(/\r?\n/g, ' ') : '';
            frontmatterLines.push(`${k}: ${v}`);
        });
        frontmatterLines.push('---\n');

        const body = task.fullContent || task.content || '';
        const fileContent = frontmatterLines.join('\n') + (body.startsWith('\n') ? body : '\n' + body);

        // Write file
        const writable = await fileHandle.createWritable();
        await writable.write(fileContent);
        await writable.close();

        console.log(`FileSystemProjectLoader: task ${task.id} written to disk`);
        return true;
    }
    
    async loadProjects() {
        if (!this.directoryHandle) {
            throw new Error('Please select a projects directory first');
        }

        const projects = [];
        
        try {
            // Look for projects folder or use current directory
            let projectsDir = this.directoryHandle;
            
            try {
                projectsDir = await this.directoryHandle.getDirectoryHandle('projects');
                console.log('📁 Found projects subfolder, using it');
            } catch (e) {
                // If no projects folder, use current directory
                console.log('📁 Projects folder not found, using current directory');
            }

            console.log('🔍 Scanning directory for projects...');
            let foundDirectories = 0;
            let processedProjects = 0;
            
            for await (const [name, handle] of projectsDir.entries()) {
                if (handle.kind === 'directory') {
                    foundDirectories++;
                    console.log(`📂 Found directory: ${name}`);
                    
                    if (!name.startsWith('.') && name !== 'src') {
                        console.log(`✅ Processing project: ${name}`);
                        try {
                            const projectData = await this.loadProjectData(name, handle);
                            projects.push(projectData);
                            processedProjects++;
                            console.log(`✅ Loaded project ${name} with ${projectData.stats.backlog.count + projectData.stats.inProgress.count + projectData.stats.done.count} total tasks`);
                        } catch (error) {
                            console.warn(`❌ Error loading project ${name}:`, error);
                        }
                    } else {
                        console.log(`⏭️ Skipping directory: ${name} (starts with . or is src)`);
                    }
                }
            }
            
            console.log(`📊 Summary: Found ${foundDirectories} directories, processed ${processedProjects} projects`);
        } catch (error) {
            console.error('❌ Error reading directory:', error);
            throw new Error('Failed to read projects directory');
        }

        return projects.sort((a, b) => a.name.localeCompare(b.name));
    }

    async loadProjectData(projectName, projectHandle) {
        const stats = {
            backlog: { count: 0, detail: '(0h)' },
            inProgress: { count: 0, detail: '(1 dev)' },
            done: { count: 0, detail: '(0h)' }
        };

        // Рахуємо файли в кожній директорії
        const directories = ['backlog', 'progress', 'review', 'testing', 'done'];
        let totalInProgress = 0;
        const developersSet = new Set();

        for (const dirName of directories) {
            try {
                const dirHandle = await projectHandle.getDirectoryHandle(dirName);
                const count = await this.countMarkdownFiles(dirHandle);
                
                if (dirName === 'backlog') {
                    stats.backlog.count = count;
                    stats.backlog.hours = `${count * 4}h`;
                    stats.backlog.detail = `(${count * 4}h)`;
                } else if (dirName === 'done') {
                    stats.done.count = count;
                    stats.done.hours = `${count * 6}h`;
                    stats.done.detail = `(${count * 6}h)`;
                } else {
                    // progress, review, testing - все йде в inProgress
                    totalInProgress += count;
                    if (count > 0) {
                        const devList = await this.getDevelopersFromDirectory(dirHandle);
                        for (const d of devList) developersSet.add(d);
                    }
                }
            } catch (error) {
                // Directory doesn't exist - skip
            }
        }

        stats.inProgress.count = totalInProgress;
        const developersArray = Array.from(developersSet);
        stats.inProgress.developers = `${Math.max(1, developersArray.length)} dev${developersArray.length !== 1 ? 's' : ''}`;
        stats.inProgress.detail = `(${Math.max(1, developersArray.length)} dev${developersArray.length !== 1 ? 's' : ''})`;

        // Read description from README
        const description = await this.readProjectDescription(projectHandle);

        return {
            id: projectName,
            name: projectName,
            description,
            stats
            // Додаємо список реальних імен папок-розробників для UI
            , developers: developersArray
         };
     }

    async countMarkdownFiles(dirHandle) {
        let count = 0;
        
        try {
            for await (const [name, handle] of dirHandle.entries()) {
                if (handle.kind === 'file' && name.endsWith('.md') && name.toLowerCase() !== 'readme.md') {
                    count++;
                } else if (handle.kind === 'directory') {
                    // Recursively count files in subdirectories
                    count += await this.countMarkdownFiles(handle);
                }
            }
        } catch (error) {
            console.warn('Error reading directory:', error);
        }

        return count;
    }

    async countDevelopers(dirHandle) {
        // Стара сумарна версія — тепер делегуємо до getDevelopersFromDirectory
        try {
            const devs = await this.getDevelopersFromDirectory(dirHandle);
            return devs.length || 1;
        } catch (err) {
            console.warn('countDevelopers fallback error:', err);
            return 1;
        }
     }

    async readProjectDescription(projectHandle) {
        try {
            const readmeHandle = await projectHandle.getFileHandle('README.md');
            const file = await readmeHandle.getFile();
            const content = await file.text();
            
            const lines = content.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-') && trimmed.length > 20) {
                    return trimmed.length > 120 ? trimmed.substr(0, 120) + '...' : trimmed;
                }
            }
            
            // If no description found, return first non-empty line
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    return trimmed.length > 120 ? trimmed.substr(0, 120) + '...' : trimmed;
                }
            }
        } catch (error) {
            console.warn('Failed to read README.md');
        }

        return 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas hendrerit sem libero, et aliquam ligula ...';
    }
}

// Export for use
window.FileSystemProjectLoader = FileSystemProjectLoader;
}