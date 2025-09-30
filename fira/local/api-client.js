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
            
            // If we're running on a server, use the same port
            if (window.location.protocol !== 'file:') {
                baseUrl = `${window.location.protocol}//${currentHost}:${currentPort}`;
            } else {
                // Default for file:// protocol
                baseUrl = 'http://localhost:5000';
            }
        }
        this.baseUrl = baseUrl;
        this.isServerAvailable = false;
        this.checkingServer = false;
    }

    /**
     * Check if server is available
     */
    async checkServerStatus() {
        if (this.checkingServer) {
            return this.isServerAvailable;
        }

        this.checkingServer = true;
        
        try {
            const response = await fetch(`${this.baseUrl}/api/status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Short timeout to fail fast
                signal: AbortSignal.timeout(2000)
            });
            
            if (response.ok) {
                const data = await response.json();
                this.isServerAvailable = data.status === 'ok';
                console.log('✅ Fira server is available:', data);
            } else {
                this.isServerAvailable = false;
                console.log('❌ Server responded with error:', response.status);
            }
        } catch (error) {
            this.isServerAvailable = false;
            console.log('📱 Server not available, using static mode:', error.message);
        } finally {
            this.checkingServer = false;
        }

        return this.isServerAvailable;
    }

    /**
     * Get all projects
     */
    async getProjects() {
        if (!this.isServerAvailable) {
            throw new Error('Server not available');
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/projects`);
            const data = await response.json();
            
            if (data.success) {
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
        if (!this.isServerAvailable) {
            throw new Error('Server not available');
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/tasks`);
            const data = await response.json();
            
            if (data.success) {
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
        if (!this.isServerAvailable) {
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
        if (!this.isServerAvailable) {
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
        if (!this.isServerAvailable) {
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
        if (!this.isServerAvailable) {
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
     * Update project description
     */
    async updateProjectDescription(projectId, description, changeAuthor = 'User') {
        if (!this.isServerAvailable) {
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
        if (!this.isServerAvailable) {
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
        if (!this.isServerAvailable) {
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
}

// Global API client instance
window.firaAPIClient = new FiraAPIClient();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FiraAPIClient;
}

// Close the double declaration protection
}