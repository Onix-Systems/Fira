/**
 * API Client for Fira Server Integration
 * Handles communication with Python Flask server
 */

// Prevent double declaration when loaded via server
if (typeof FiraAPIClient === 'undefined') {
class FiraAPIClient {
    constructor(baseUrl = null) {
        // Auto-detect server URL based on current page
        if (!baseUrl) {
            const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
            const currentHost = window.location.hostname;
            
            // Special handling for web deployment - use standard port with /api proxy
            if (currentHost.includes("onix-systems-android-tasks")) {
                baseUrl = `${window.location.protocol}//${currentHost}`;
            }
            // If we're running on a server, use the same port
            else if (window.location.protocol !== 'file:') {
                baseUrl = `${window.location.protocol}//${currentHost}:${currentPort}`;
            } else {
                // Default for file:// protocol - try common ports
                // Check if we can detect the port from current environment
                const detectedPort = this.detectServerPort();
                baseUrl = `http://localhost:${detectedPort}`;
            }
        }
        this.baseUrl = baseUrl;
        this.isServerAvailable = false;
        this.checkingServer = false;
        
        // Simple cache to prevent repeated API calls
        this.cache = {
            projects: null,
            projectTasks: {},
            lastProjectsUpdate: 0,
            lastTasksUpdate: {},
            cacheDuration: 30000 // 30 seconds cache
        };
        
        console.log(`🔗 FiraAPIClient initialized with baseUrl: ${this.baseUrl}`);
    }

    /**
     * Clear cache to force fresh data on next request
     */
    clearCache() {
        console.log('🗑️ Clearing API client cache');
        this.cache.projects = null;
        this.cache.projectTasks = {};
        this.cache.lastProjectsUpdate = 0;
        this.cache.lastTasksUpdate = {};
    }

    /**
     * Try to detect server port from common ports
     */
    detectServerPort() {
        // Common ports used by the server
        const commonPorts = [8080, 5555, 5000, 3000];
        
        // If FIRA_PORT is somehow available (unlikely in browser), use it
        // Otherwise use 8080 as it's most commonly used for development
        return 8080;
    }

    /**
     * Check if we should proceed with API call
     */
    shouldProceedWithApiCall() {
        const currentHostname = window.location.hostname;
        const isWeb = currentHostname.includes("onix-systems-android-tasks");
        
        // For both web and local versions, check server availability
        // Web version will gracefully fallback to static data at a higher level
        return this.isServerAvailable;
    }

    /**
     * Check if server is available
     */
    async checkServerStatus() {
        if (this.checkingServer) {
            console.log('🔄 Server check already in progress, returning current status:', this.isServerAvailable);
            return this.isServerAvailable;
        }

        this.checkingServer = true;
        
        const checkUrl = `${this.baseUrl}/api/status`;
        console.log(`🔄 Checking server status at: ${checkUrl}`);
        console.log(`🔍 Current baseUrl: ${this.baseUrl}`);
        
        try {
            const response = await fetch(checkUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Short timeout to fail fast
                signal: AbortSignal.timeout(5000)
            });
            
            console.log(`📡 Server response status: ${response.status} ${response.statusText}`);
            console.log(`📡 Response ok: ${response.ok}`);
            
            if (response.ok) {
                const data = await response.json();
                this.isServerAvailable = data.status === 'ok';
                console.log('✅ Fira server is available:', data);
                console.log('✅ isServerAvailable set to:', this.isServerAvailable);
            } else {
                this.isServerAvailable = false;
                console.log('❌ Server responded with error:', response.status, response.statusText);
            }
        } catch (error) {
            this.isServerAvailable = false;
            console.log(`❌ Server connection failed: ${error.message}`);
            console.log(`❌ Error type: ${error.name}`);
            console.log(`❌ Failed URL: ${checkUrl}`);
            
            // If initial connection failed and we're using file:// protocol,
            // try alternative ports
            if (window.location.protocol === 'file:') {
                console.log('🔄 Trying alternative ports...');
                const alternativePorts = [5555, 5000, 3000];
                
                for (const port of alternativePorts) {
                    if (this.baseUrl.includes(`localhost:${port}`)) continue; // Skip current port
                    
                    const altUrl = `http://localhost:${port}`;
                    console.log(`🔄 Trying alternative server at: ${altUrl}`);
                    
                    try {
                        const altResponse = await fetch(`${altUrl}/api/status`, {
                            method: 'GET',
                            signal: AbortSignal.timeout(2000) // Shorter timeout for alternatives
                        });
                        
                        if (altResponse.ok) {
                            const altData = await altResponse.json();
                            if (altData.status === 'ok') {
                                console.log(`✅ Found server on alternative port: ${port}`);
                                this.baseUrl = altUrl;
                                this.isServerAvailable = true;
                                break;
                            }
                        }
                    } catch (altError) {
                        console.log(`❌ Port ${port} also failed:`, altError.message);
                    }
                }
            }
            
            if (!this.isServerAvailable) {
                console.log('📱 Server not available, using static mode:', error.message);
            }
        } finally {
            this.checkingServer = false;
            console.log(`🏁 Server check completed. Final status: ${this.isServerAvailable}`);
        }

        return this.isServerAvailable;
    }

    /**
     * Get all projects
     */
    async getProjects() {
        if (!this.shouldProceedWithApiCall()) {
            throw new Error('Server not available');
        }

        // Check cache first
        const now = Date.now();
        if (this.cache.projects && (now - this.cache.lastProjectsUpdate) < this.cache.cacheDuration) {
            console.log('📋 Using cached projects data');
            return this.cache.projects;
        }

        try {
            console.log('🔄 Fetching fresh projects data from server');
            const response = await fetch(`${this.baseUrl}/api/projects`);
            const data = await response.json();
            
            if (data.success) {
                // Update cache
                this.cache.projects = data.projects;
                this.cache.lastProjectsUpdate = now;
                return data.projects;
            } else {
                throw new Error(data.error || 'Failed to get projects');
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
            throw error;
        }
    }

    /**
     * Get tasks for a project
     */
    async getProjectTasks(projectId) {
        if (!this.shouldProceedWithApiCall()) {
            throw new Error('Server not available');
        }

        // Check cache first
        const now = Date.now();
        const lastUpdate = this.cache.lastTasksUpdate[projectId] || 0;
        if (this.cache.projectTasks[projectId] && (now - lastUpdate) < this.cache.cacheDuration) {
            console.log(`📋 Using cached tasks data for project "${projectId}"`);
            return this.cache.projectTasks[projectId];
        }

        try {
            const url = `${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/tasks`;
            console.log(`🔄 API REQUEST: Fetching tasks for project "${projectId}" from: ${url}`);
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                console.log(`✅ API RESPONSE: Received ${data.tasks.length} tasks for project "${projectId}"`);
                
                // Update cache
                this.cache.projectTasks[projectId] = data.tasks;
                this.cache.lastTasksUpdate[projectId] = now;
                
                if (data.tasks.length > 0) {
                    console.log(`✅ API RESPONSE: First 3 tasks:`, data.tasks.slice(0, 3).map(t => `${t.id}: ${t.title}`));
                }
                return data.tasks;
            } else {
                throw new Error(data.error || 'Failed to get tasks');
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
            throw error;
        }
    }

    /**
     * Get a specific task
     */
    async getTask(projectId, taskId) {
        if (!this.shouldProceedWithApiCall()) {
            throw new Error('Server not available');
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`);
            const data = await response.json();
            
            if (data.success) {
                return data.task;
            } else {
                throw new Error(data.error || 'Failed to get task');
            }
        } catch (error) {
            console.error('Error fetching task:', error);
            throw error;
        }
    }

    /**
     * Create a new task
     */
    async createTask(projectId, taskData) {
        if (!this.shouldProceedWithApiCall()) {
            throw new Error('Server not available');
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                return true;
            } else {
                throw new Error(data.error || 'Failed to create task');
            }
        } catch (error) {
            console.error('Error creating task:', error);
            throw error;
        }
    }

    /**
     * Update an existing task
     */
    async updateTask(projectId, taskId, taskData) {
        if (!this.shouldProceedWithApiCall()) {
            throw new Error('Server not available');
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                return true;
            } else {
                throw new Error(data.error || 'Failed to update task');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    }

    /**
     * Delete a task
     */
    async deleteTask(projectId, taskId) {
        if (!this.shouldProceedWithApiCall()) {
            throw new Error('Server not available');
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, {
                method: 'DELETE',
            });
            
            const data = await response.json();
            
            if (data.success) {
                return true;
            } else {
                throw new Error(data.error || 'Failed to delete task');
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            throw error;
        }
    }

    /**
     * Get full task content (for compatibility)
     */
    async getFullTaskContent(projectId, taskId) {
        const task = await this.getTask(projectId, taskId);
        return task ? task.fullContent : null;
    }

    /**
     * Create a new project
     */
    async createProject(projectData) {
        if (!this.shouldProceedWithApiCall()) {
            throw new Error('Server not available');
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(projectData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                return data;
            } else {
                throw new Error(data.error || 'Failed to create project');
            }
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    }

    /**
     * Update project information
     */
    async updateProject(projectId, projectData) {
        if (!this.shouldProceedWithApiCall()) {
            throw new Error('Server not available');
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(projectData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                return data;
            } else {
                throw new Error(data.error || 'Failed to update project');
            }
        } catch (error) {
            console.error('Error updating project:', error);
            throw error;
        }
    }

    /**
     * Delete project
     */
    async deleteProject(projectId) {
        if (!this.shouldProceedWithApiCall()) {
            throw new Error('Server not available');
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `Server error: ${response.status}`);
            }

            if (data.success) {
                return data;
            } else {
                throw new Error(data.error || 'Failed to delete project');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            throw error;
        }
    }

    /**
     * Update project description
     */
    async updateProjectDescription(projectId, description, changeAuthor = 'User') {
        if (!this.shouldProceedWithApiCall()) {
            throw new Error('Server not available');
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/description`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: description,
                    changeAuthor: changeAuthor
                }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                return true;
            } else {
                throw new Error(data.error || 'Failed to update project description');
            }
        } catch (error) {
            console.error('Error updating project description:', error);
            throw error;
        }
    }

    /**
     * Scan projects with detailed file structure for cache generation
     */
    async scanProjectsDetailed() {
        if (!this.shouldProceedWithApiCall()) {
            throw new Error('Server not available for scanning');
        }

        try {
            console.log('🔍 Starting detailed project scan...');
            const response = await fetch(`${this.baseUrl}/api/scan-detailed`);
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Detailed scan completed:', data.summary);
                return {
                    projects: data.projects,
                    allTasks: data.allTasks,
                    projectTasks: data.projectTasks,
                    fileStructure: data.fileStructure,
                    metadata: data.metadata
                };
            } else {
                throw new Error(data.error || 'Failed to scan projects');
            }
        } catch (error) {
            console.error('Error during detailed scan:', error);
            throw error;
        }
    }

    /**
     * Save cache file via server
     */
    async saveCacheFile(cacheData) {
        if (!this.shouldProceedWithApiCall()) {
            return false;
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/save-cache`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(cacheData)
            });

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Error saving cache file:', error);
            return false;
        }
    }

    /**
     * Set working directory on server
     */
    async setWorkingDirectory(directoryPath) {
        if (!this.shouldProceedWithApiCall()) {
            throw new Error('Server not available');
        }

        try {
            console.log(`🔧 Setting working directory to: ${directoryPath}`);
            const response = await fetch(`${this.baseUrl}/api/select-directory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    path: directoryPath
                })
            });

            const data = await response.json();
            
            if (data.success) {
                console.log(`✅ Working directory set successfully: ${data.working_directory}`);
                return data.working_directory;
            } else {
                throw new Error(data.error || 'Failed to set working directory');
            }
        } catch (error) {
            console.error('Error setting working directory:', error);
            throw error;
        }
    }

    /**
     * Get current working directory from server
     */
    async getWorkingDirectory() {
        if (!this.shouldProceedWithApiCall()) {
            throw new Error('Server not available');
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/working-directory`);
            const data = await response.json();
            
            if (data.success) {
                return data.working_directory;
            } else {
                throw new Error(data.error || 'Failed to get working directory');
            }
        } catch (error) {
            console.error('Error getting working directory:', error);
            throw error;
        }
    }

    /**
     * Create a directory structure (e.g., for developer folders)
     * @param {string} projectId - The project identifier
     * @param {string} parentDir - Parent directory (e.g., 'progress')
     * @param {string} dirName - Directory name to create
     */
    async createDirectory(projectId, parentDir, dirName) {
        try {
            console.log(`📁 API: Creating directory ${projectId}/${parentDir}/${dirName}`);
            console.log(`📡 Using base URL: ${this.baseUrl}`);
            
            const response = await fetch(`${this.baseUrl}/api/create-directory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    project_id: projectId,
                    parent_dir: parentDir,
                    dir_name: dirName
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                console.log(`✅ API: Directory created successfully`);
                // Clear projects cache to force refresh
                this.clearCache();
                return data;
            } else {
                throw new Error(data.error || 'Failed to create directory');
            }
        } catch (error) {
            console.error('Error creating directory:', error);
            throw error;
        }
    }
}

// Global API client instance
window.firaAPIClient = new FiraAPIClient();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FiraAPIClient;
}

// Close the double declaration protection
}