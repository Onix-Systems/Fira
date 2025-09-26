// Project Board JavaScript - v2.3 - Cache Buster Fix
console.log('📋 Loading Project Board JS v2.3');
class ProjectBoard {
    constructor() {
        console.log(`🆕 Creating new ProjectBoard instance`);
        this.currentProject = null;
        this.tasks = [];
        this.filteredTasks = [];
        this.draggedTask = null;
        this.searchTerm = '';
        this.selectedDeveloper = '';
        this.dateRange = '';
        this.currentView = 'kanban'; // 'kanban' or 'list'
        this.sortColumn = '';
        this.dropZonesSetup = false;
        this.sortDirection = 'asc'; // 'asc' or 'desc'
        this.displayedTasks = 20; // Initial number of tasks to show
        this.loadIncrement = 20;  // How many more tasks to load on scroll

        // Column sorting state
        this.columnSortStates = {}; // Track sort state for each column

        // Path where tasks were loaded from (if known) - used to save back to same file
        this.tasksFilePath = null;
        // Currently opened task in the detail modal (used to persist edits)
        this.currentTask = null;
        // Flag to prevent double loading of tasks
        this.tasksLoaded = false;
        // Track which project was loaded last
        this.lastLoadedProject = null;
        // Expose instance globally so wrapper functions / globals can call instance methods
        window.projectBoard = this;
        
        // Role checking utility - check if this is web version (server-based vs file-based)
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        
        this.isWebVersion = hostname.includes("onix-systems-android-tasks") || 
                           (protocol !== 'file:' && hostname !== '');
                           
        console.log('🌐 Hostname:', hostname, 'Protocol:', protocol);
        console.log('🔧 isWebVersion:', this.isWebVersion);
        
        // Chart instances for cleanup
        this.statusChartInstance = null;
        this.timeChartInstance = null;
        this.developerChartInstance = null;
        
        // Initialize asynchronously
        this.init().catch(error => {
            console.error('Failed to initialize ProjectBoard:', error);
        });
    }
    
    // Helper function to get current user role
    getUserRole() {
        if (!this.isWebVersion) return 'editor'; // Local version has full access
        
        const loginData = localStorage.getItem('fira_login');
        if (loginData) {
            try {
                const data = JSON.parse(loginData);
                return data.role || 'viewer';
            } catch (e) {
                console.warn('Failed to parse login data for role check');
                return 'viewer';
            }
        }
        return 'viewer';
    }
    
    // Check if current user is a viewer (read-only)
    isViewer() {
        return this.getUserRole() === 'viewer';
    }
    
    // Check if current user can edit (editor or admin)
    canEdit() {
        const role = this.getUserRole();
        return role === 'editor' || role === 'admin';
    }
    
    // Get git configuration (user name and email)
    async getGitConfig() {
        try {
            const response = await fetch('/api/git-config');
            const data = await response.json();
            if (data.success && data.name) {
                return {
                    name: data.name,
                    email: data.email
                };
            }
        } catch (error) {
            console.warn('Failed to get git config:', error);
        }
        return {
            name: 'User',
            email: null
        };
    }
    
    // Setup UI permissions based on user role
    setupUIPermissions() {
        console.log('🛠️ setupUIPermissions called');
        console.log('📍 Current hostname:', window.location.hostname);
        console.log('🌍 isWebVersion:', this.isWebVersion);
        
        const isViewer = this.isViewer();
        const canEdit = this.canEdit();
        
        console.log('👤 User role:', this.getUserRole());
        console.log('👁️ isViewer:', isViewer);
        console.log('✏️ canEdit:', canEdit);
        
        // For non-web versions (local), always allow full access
        if (!this.isWebVersion) {
            // Set up full editor mode for local versions
            document.body.classList.remove('viewer-mode');
            document.body.classList.add('editor-mode');
            
            console.log('🎯 Setting up drag and drop for local version...');
            // Setup drag and drop for local versions
            setTimeout(() => {
                // Reset drop zones flag to ensure they get re-setup after DOM changes
                this.dropZonesSetup = false;
                this.setupDropZones();
                console.log('✅ setupDropZones completed for local version');
            }, 50);
            
            console.log('🔧 Local version: full editor access enabled');
            return;
        }
        
        // Hide/show create task button
        const createTaskBtn = document.getElementById('createTaskBtn');
        if (createTaskBtn) {
            createTaskBtn.style.display = canEdit ? 'flex' : 'none';
        }
        
        // Enable/disable task editing in modal
        const taskCards = document.querySelectorAll('.task-card');
        taskCards.forEach(card => {
            if (canEdit) {
                card.classList.remove('viewer-readonly');
            } else {
                card.classList.add('viewer-readonly');
            }
        });
        
        // Set body class for CSS styling
        if (isViewer) {
            document.body.classList.add('viewer-mode');
            // Removed showViewerModeNotification() - notification not needed
        } else {
            document.body.classList.remove('viewer-mode');
            document.body.classList.add('editor-mode');
        }
        
        // Update placeholder text based on role
        const searchInput = document.getElementById('taskSearchInput');
        if (searchInput) {
            searchInput.placeholder = canEdit ? 'Search tasks...' : 'Search tasks (read-only)...';
        }
        
        // Setup or remove drop zones based on permissions
        if (canEdit) {
            setTimeout(() => {
                // Reset drop zones flag to ensure they get re-setup after DOM changes
                this.dropZonesSetup = false;
                this.setupDropZones();
            }, 50);
        } else {
            this.removeDropZones();
        }
        
        console.log(`🔧 UI permissions set: role=${this.getUserRole()}, canEdit=${canEdit}, isViewer=${isViewer}`);
    }

    // Show notification for viewer mode
    showViewerModeNotification() {
        if (!this.isViewer() || !this.isWebVersion) return;
        
        // Check if notification already exists
        if (document.getElementById('viewer-mode-notification')) return;
        
        const notification = document.createElement('div');
        notification.id = 'viewer-mode-notification';
        notification.className = 'viewer-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">👁️</span>
                <span class="notification-text">Read-only mode - Drag & Drop disabled</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 12px 16px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            font-size: 14px;
            color: #856404;
            max-width: 300px;
        `;
        
        // Style the notification content
        const style = document.createElement('style');
        style.textContent = `
            .viewer-notification .notification-content {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .viewer-notification .notification-icon {
                font-size: 16px;
            }
            .viewer-notification .notification-text {
                flex: 1;
                font-weight: 500;
            }
            .viewer-notification .notification-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #856404;
                padding: 0;
                margin-left: 8px;
            }
            .viewer-notification .notification-close:hover {
                color: #533f03;
            }
        `;
        
        if (!document.getElementById('viewer-notification-styles')) {
            style.id = 'viewer-notification-styles';
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
        
        console.log('👁️ Viewer mode notification shown');
    }

    async init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        this.loadProjectFromUrl();
        this.setupEventListeners();
        await this.loadProjectTasks();
        this.filterAndRenderTasks();
        this.initializeViewSwitchButton();

        // Setup UI permissions after everything is loaded
        // Note: setupUIPermissions() now handles setupDropZones() internally
        this.setupUIPermissions();

        // Check for task parameter in URL and open it if found
        this.checkAndOpenTaskFromUrl();

        // Add window resize listener to re-equalize column heights
        window.addEventListener('resize', () => {
            // Debounce the resize event
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                if (this.currentView === 'kanban') {
                    this.equalizeColumnHeights();
                }
            }, 250);
        });
    }

    checkAndOpenTaskFromUrl() {
        console.log('🔍 Checking for task parameter in URL...');

        let taskParam = null;

        // Try to get task from router first
        if (window.firaRouter && window.firaRouter.getCurrentParams) {
            const params = window.firaRouter.getCurrentParams();
            taskParam = params.taskId || params.taskname;
            console.log('📡 Router task param:', taskParam);
        }

        // Fallback to URL parameters if no router param found
        if (!taskParam) {
            const urlParams = new URLSearchParams(window.location.search);
            taskParam = urlParams.get('task');
            console.log('📄 URL task param:', taskParam);
        }

        if (taskParam) {
            console.log('🎯 Found task parameter, opening task:', taskParam);
            // Wait a bit for tasks to be rendered before opening the modal
            setTimeout(() => {
                this.openTaskByName(decodeURIComponent(taskParam));
            }, 300);
        } else {
            console.log('📄 No task parameter found in URL');
        }
    }

    loadProjectFromUrl() {
        console.log('🔍 Loading project from URL...');
        
        // Reset tasks loaded flag when loading new project
        console.log(`🔄 Resetting tasksLoaded flag from ${this.tasksLoaded} to false`);
        this.tasksLoaded = false;
        
        // Try to get project from router first
        if (window.firaRouter && window.firaRouter.getCurrentParams) {
            const params = window.firaRouter.getCurrentParams();
            const projectId = params.projectname;
            console.log(`📡 Router params:`, params);
            console.log(`📂 Project ID from router: "${projectId}"`);
            
            if (projectId && window.PROJECTS_DATA) {
                const foundProject = window.PROJECTS_DATA.find(p => p.id === projectId);
                if (foundProject) {
                    this.currentProject = foundProject;
                    console.log(`✅ Found project in PROJECTS_DATA:`, this.currentProject);
                } else {
                    this.currentProject = { id: projectId, name: decodeURIComponent(projectId), description: '' };
                    console.log(`⚠️ Project not in PROJECTS_DATA, using decoded with empty description:`, this.currentProject);
                }
            } else if (projectId) {
                this.currentProject = { id: projectId, name: decodeURIComponent(projectId), description: '' };
                console.log(`⚠️ No PROJECTS_DATA available, using decoded with empty description:`, this.currentProject);
            }
        }
        
        // Fallback to URL parameters
        if (!this.currentProject) {
            const urlParams = new URLSearchParams(window.location.search);
            const projectId = urlParams.get('project');
            console.log(`📄 URL params project: "${projectId}"`);
            
            if (projectId && window.PROJECTS_DATA) {
                const foundProject = window.PROJECTS_DATA.find(p => p.id === projectId);
                if (foundProject) {
                    this.currentProject = foundProject;
                    console.log(`✅ Found project in PROJECTS_DATA:`, this.currentProject);
                } else {
                    this.currentProject = { id: projectId, name: decodeURIComponent(projectId), description: '' };
                    console.log(`⚠️ Project not in PROJECTS_DATA, using decoded with empty description:`, this.currentProject);
                }
            } else if (projectId) {
                this.currentProject = { id: projectId, name: decodeURIComponent(projectId), description: '' };
                console.log(`⚠️ No PROJECTS_DATA available, using decoded with empty description:`, this.currentProject);
            } else {
                this.currentProject = { id: 'sample-project', name: 'Sample Project', description: '' };
                console.log(`❌ No project found, using sample project`);
            }
        }
        
        console.log(`🎯 Final current project:`, this.currentProject);
        
        if (this.currentProject) {
            const projectNameElement = document.getElementById('projectName');
            if (projectNameElement) {
                projectNameElement.textContent = this.currentProject.name;
                console.log(`✅ Set project name to: "${this.currentProject.name}"`);
            } else {
                console.error('❌ Project name element not found!');
            }
            
            // Try to load fresh project description after initial loading
            setTimeout(() => {
                this.loadFreshProjectData();
            }, 500); // Small delay to ensure global data manager is ready
        }
    }
    
    // Method to load fresh project data from server when page loads
    async loadFreshProjectData() {
        console.log('🔍 loadFreshProjectData called for project:', this.currentProject?.id);
        
        if (!this.currentProject) {
            console.log('❌ No current project, exiting loadFreshProjectData');
            return;
        }
        
        console.log('🔍 Current project description:', this.currentProject.description);
        console.log('🔍 Description equals ID?', this.currentProject.description === this.currentProject.id);
        console.log('🔍 Description is empty?', !this.currentProject.description || this.currentProject.description.trim() === '');
        
        // Only try to load if description is missing or looks like project ID
        if (this.currentProject.description && 
            this.currentProject.description !== this.currentProject.id && 
            this.currentProject.description.trim() !== '') {
            console.log('✅ Project already has valid description, skipping fresh data load');
            return;
        }
        
        // Try to load from server first
        console.log('🔍 Checking server availability:');
        console.log('  - globalDataManager:', !!window.globalDataManager);
        console.log('  - apiClient:', !!window.globalDataManager?.apiClient);
        console.log('  - loadingMode:', window.globalDataManager?.loadingMode);
        
        if (window.globalDataManager && 
            window.globalDataManager.apiClient && 
            window.globalDataManager.loadingMode === 'server') {
            try {
                console.log('🔄 Loading fresh project data on page load...');
                const serverProjects = await window.globalDataManager.apiClient.getProjects();
                console.log('🔍 Server projects loaded:', serverProjects.length);
                const serverProject = serverProjects.find(p => p.id === this.currentProject.id);
                console.log('🔍 Found server project:', !!serverProject);
                console.log('🔍 Server project description:', serverProject?.description);
                
                if (serverProject && serverProject.description && 
                    serverProject.description !== serverProject.id && 
                    serverProject.description.trim() !== '') {
                    
                    console.log('✅ Found fresh project data from server:', serverProject);
                    // Update current project with fresh data
                    this.currentProject = { ...this.currentProject, ...serverProject };
                    
                    // Also update in globalDataManager if it exists
                    if (window.globalDataManager && window.globalDataManager.projects) {
                        const projectIndex = window.globalDataManager.projects.findIndex(p => p.id === this.currentProject.id);
                        if (projectIndex !== -1) {
                            window.globalDataManager.projects[projectIndex] = { ...this.currentProject };
                            console.log('✅ Updated project in globalDataManager');
                        }
                    }
                    
                    console.log('✅ Project description restored from server on page load');
                    return; // Successfully loaded from server
                } else {
                    console.log('⚠️ Server project has no valid description');
                }
            } catch (error) {
                console.warn('⚠️ Failed to load fresh project data on page load:', error);
            }
        } else {
            console.log('⚠️ Server not available for loading fresh data');
        }
        
        // Try to load from global data manager as fallback
        if ((!this.currentProject.description || 
             this.currentProject.description === this.currentProject.id || 
             this.currentProject.description.trim() === '') &&
            window.globalDataManager && window.globalDataManager.getProjects) {
            
            const projects = window.globalDataManager.getProjects();
            const foundProject = projects.find(p => p.id === this.currentProject.id);
            if (foundProject && foundProject.description && 
                foundProject.description !== foundProject.id && 
                foundProject.description.trim() !== '') {
                
                console.log('✅ Found project data in globalDataManager:', foundProject);
                this.currentProject = { ...this.currentProject, ...foundProject };
                console.log('✅ Project description restored from globalDataManager on page load');
            }
        }
    }

    setupEventListeners() {
        // Remove old listeners by cloning elements (this clears all event listeners)
        this.cleanupEventListeners();
        
        // Back button
        console.log('🔧 Setting up back button event listener...');
        const backButton = document.getElementById('backButton');
        console.log('🔍 Back button found:', !!backButton);
        if (backButton) {
            console.log('✅ Adding click listener to back button');
            const backHandler = (e) => {
                console.log('🔙 Back button clicked!');  // Debug log
                e.preventDefault();

                // If a task is open, try to save its edits but don't block the UI
                if (this.currentTask) {
                    this.saveTaskChanges(this.currentTask).catch(err => console.error('saveTaskChanges (background):', err));
                }

                // Persist all tasks in background (don't await)
                this.saveTasksToDisk()
                    .then(() => console.log('Background tasks save completed'))
                    .catch(err => console.error('Background save failed:', err));

                // Navigate back to dashboard (check if task is open first)
                console.log('🔙 Navigating back to dashboard...');
                
                // If task modal is open, just close it instead of navigating to dashboard
                const taskModal = document.getElementById('taskDetailModal');
                if (taskModal && taskModal.style.display === 'flex') {
                    console.log('🔙 Task modal is open, closing it instead of navigating');
                    closeTaskModal();
                    return;
                }
                
                // Navigate to dashboard only if no task is open
                if (window.firaRouter && typeof window.firaRouter.navigateTo === 'function') {
                    console.log('✅ Using router navigation to dashboard');
                    window.firaRouter.navigateTo('/');
                } else if (window.navigateToDashboard && typeof window.navigateToDashboard === 'function') {
                    console.log('✅ Using global navigation function');
                    window.navigateToDashboard();
                } else {
                    console.log('⚠️ Using browser history back');
                    window.history.back();
                }
            };
            backButton.addEventListener('click', backHandler);
            // Store handler for potential cleanup
            this.eventHandlers = this.eventHandlers || new Map();
            this.eventHandlers.set('backButton', backHandler);
        }


        const viewSwitchBtn = document.getElementById('viewSwitchBtn');
        if (viewSwitchBtn) {
            const viewSwitchHandler = () => {
                this.switchView();
            };
            viewSwitchBtn.addEventListener('click', viewSwitchHandler);
            this.eventHandlers = this.eventHandlers || new Map();
            this.eventHandlers.set('viewSwitchBtn', viewSwitchHandler);
        }

        // Calculate Date button
        const calculateDateBtn = document.getElementById('calculateDateBtn');
        if (calculateDateBtn) {
            const calculateDateHandler = () => {
                // Navigate to calculate date page with correct path
                window.location.href = '/pages/calculateDate.html';
            };
            calculateDateBtn.addEventListener('click', calculateDateHandler);
            this.eventHandlers = this.eventHandlers || new Map();
            this.eventHandlers.set('calculateDateBtn', calculateDateHandler);
        }

        // Analytics button
        const analyticsBtn = document.getElementById('analyticsBtn');
        if (analyticsBtn) {
            const analyticsHandler = () => {
                this.toggleView('analytics');
            };
            analyticsBtn.addEventListener('click', analyticsHandler);
            this.eventHandlers = this.eventHandlers || new Map();
            this.eventHandlers.set('analyticsBtn', analyticsHandler);
        }

        // Create task button
        const createTaskBtn = document.getElementById('createTaskBtn');
        if (createTaskBtn) {
            const createTaskHandler = () => {
                console.log('🔄 createTaskBtn clicked, checking mode...');
                console.log('🔄 globalDataManager:', window.globalDataManager);
                console.log('🔄 loadingMode:', window.globalDataManager?.loadingMode);
                
                // Check if we're in server mode
                if (window.globalDataManager && window.globalDataManager.loadingMode === 'server') {
                    // Open the new create task detail modal for server mode
                    console.log('✅ Opening create task detail modal (server mode)');
                    this.openCreateTaskDetailModal();
                } else {
                    console.log('⚠️ Not in server mode, using fallback logic');
                    // For non-server mode, still try to open create task modal if it exists
                    const createModal = document.getElementById('createTaskDetailModal');
                    if (createModal) {
                        console.log('✅ Found create modal, opening it instead of task detail modal');
                        this.openCreateTaskDetailModal();
                        return;
                    }
                    // Create a new empty task and open the detail modal (original logic)
                    const newTask = {
                        id: this.generateTaskId(),
                        title: '',
                        content: '',
                        fullContent: '',
                        column: 'backlog',
                        timeEstimate: '2h',
                        timeSpent: '0h',
                        priority: 'low',
                        developer: '',
                        assignee: '',
                        created: new Date().toISOString().substring(0, 10),
                        projectId: this.currentProject ? this.currentProject.id : ''
                    };
                    
                    // Mark as new task for saving logic
                    newTask._isNew = true;
                    
                    // Open the same detail modal used for editing
                    this.openTaskDetail(newTask);
                }
            };
            createTaskBtn.addEventListener('click', createTaskHandler);
            this.eventHandlers = this.eventHandlers || new Map();
            this.eventHandlers.set('createTaskBtn', createTaskHandler);
        }

        // Add Developer button
        const addDeveloperBtn = document.getElementById('addDeveloperBtn');
        if (addDeveloperBtn) {
            const addDeveloperHandler = () => {
                this.openAddDeveloperModal();
            };
            addDeveloperBtn.addEventListener('click', addDeveloperHandler);
            this.eventHandlers = this.eventHandlers || new Map();
            this.eventHandlers.set('addDeveloperBtn', addDeveloperHandler);
        }

        // Create task form submission
        const createTaskForm = document.getElementById('createTaskForm');
        if (createTaskForm) {
            createTaskForm.addEventListener('submit', (e) => {
                this.handleCreateTask(e);
            });
        }

        // Search and filter
        const taskSearchInput = document.getElementById('taskSearchInput');
        if (taskSearchInput) {
            taskSearchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.filterAndRenderTasks();
            });
        }

        const developerFilter = document.getElementById('developerFilter');
        if (developerFilter) {
            developerFilter.addEventListener('change', (e) => {
                this.selectedDeveloper = e.target.value;
                this.filterAndRenderTasks();
            });
        }

        // Date range filter (removed from UI)

        // Project details button (opens edit project modal)
        const projectDetailsButton = document.getElementById('projectDetailsButton');
        if (projectDetailsButton) {
            projectDetailsButton.addEventListener('click', () => {
                this.openEditProjectModal();
            });
        }

        // Setup time tracking click handler
        this.setupTimeTrackingClickHandler();

        // Setup list view event listeners
        this.setupListViewEventListeners();

        // Setup column sorting event listeners
        this.setupColumnSortEventListeners();
    }

    cleanupEventListeners() {
        // Simple approach: since we don't need to preserve any other listeners,
        // and the main problematic buttons are top-level, we can just clear their handlers
        // More sophisticated approach would be to track and remove specific listeners
        const buttonIds = ['backButton', 'calculateDateBtn', 'analyticsBtn', 'viewSwitchBtn', 'createTaskBtn'];
        
        buttonIds.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button && this.eventHandlers && this.eventHandlers.has(buttonId)) {
                // Remove the specific handler if we have it stored
                const handler = this.eventHandlers.get(buttonId);
                button.removeEventListener('click', handler);
                console.log(`🧹 Cleaned up event listener for ${buttonId}`);
            }
        });
    }

    generateTaskId() {
        // Generate sequential task ID for new tasks
        if (!this.currentProject) {
            return 'TSK-1';
        }

        // If tasks are not loaded yet, warn and use a temporary ID
        if (!this.tasksLoaded && this.tasks.length === 0) {
            console.warn('⚠️ Tasks not loaded yet, generating temporary ID. This should be replaced with proper sequential ID.');
            const timestamp = Date.now().toString().slice(-3);
            return `${this.currentProject.id.toUpperCase()}-TEMP-${timestamp}`;
        }

        // First, try to detect the project code from existing tasks
        let projectPrefix = this.getProjectPrefix();

        // Find all existing tasks for this project that follow the sequential pattern
        const projectTasks = this.tasks.filter(task => {
            if (!task.id) return false;

            // Check if task ID starts with the project prefix followed by a dash and number
            const pattern = new RegExp(`^${projectPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+$`);
            return pattern.test(task.id);
        });

        // Extract the highest number from existing task IDs
        let maxNumber = 0;
        projectTasks.forEach(task => {
            const match = task.id.match(new RegExp(`^${projectPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`));
            if (match) {
                const number = parseInt(match[1], 10);
                if (number > maxNumber) {
                    maxNumber = number;
                }
            }
        });

        // Generate next sequential number
        const nextNumber = maxNumber + 1;
        const taskId = `${projectPrefix}-${nextNumber}`;

        console.log(`🆔 Generated sequential task ID: ${taskId} (from ${projectTasks.length} existing tasks, max number was ${maxNumber})`);
        return taskId;
    }

    getProjectPrefix() {
        // Try to detect project prefix from existing tasks
        if (this.tasks && this.tasks.length > 0) {
            // Look for common patterns in existing task IDs
            const patterns = {};

            this.tasks.forEach(task => {
                if (task.id) {
                    // Extract potential prefix (everything before the last dash-number pattern)
                    const match = task.id.match(/^([A-Z-]+)-\d+$/);
                    if (match) {
                        const prefix = match[1];
                        patterns[prefix] = (patterns[prefix] || 0) + 1;
                    }
                }
            });

            // Find the most common prefix
            let mostCommonPrefix = null;
            let maxCount = 0;
            for (const [prefix, count] of Object.entries(patterns)) {
                if (count > maxCount) {
                    maxCount = count;
                    mostCommonPrefix = prefix;
                }
            }

            if (mostCommonPrefix && maxCount > 0) {
                console.log(`🔍 Detected project prefix: ${mostCommonPrefix} (${maxCount} tasks)`);
                return mostCommonPrefix;
            }
        }

        // Fallback to predefined mappings or project name
        const projectId = this.currentProject.id.toLowerCase();
        const prefixMap = {
            'androidailibrary': 'AAL',
            'gbl-commander-kmp': 'GBL-KMP',
            'tasks': 'TSK'
        };

        const prefix = prefixMap[projectId] || this.currentProject.id.toUpperCase();
        console.log(`🔍 Using fallback prefix: ${prefix} for project: ${projectId}`);
        return prefix;
    }

    async generateTaskIdAsync() {
        // Ensure tasks are loaded before generating ID
        if (!this.tasksLoaded) {
            console.log('🔄 Tasks not loaded yet, loading them first...');
            await this.loadProjectTasks();
        }
        return this.generateTaskId();
    }

    async loadProjectTasks() {
        console.log(`🔍 loadProjectTasks v2.3 called - flag status: ${this.tasksLoaded}, project: ${this.currentProject?.id}`);
        
        // Check if we're loading the same project to prevent unnecessary reloads
        if (this.tasksLoaded && this.lastLoadedProject === this.currentProject?.id) {
            console.log(`⏭️ Tasks already loaded for project: ${this.currentProject.id}, skipping`);
            return;
        }
        
        // CRITICAL FIX: Use existing data if global data manager already has it loaded
        if (window.globalDataManager && window.globalDataManager.isDataLoaded()) {
            const availableTasks = window.globalDataManager.getTasksForProject(this.currentProject.id);
            if (availableTasks && availableTasks.length > 0) {
                console.log(`✅ v2.3 FIX: Global data already loaded with ${availableTasks.length} tasks for project ${this.currentProject.id}, using existing data WITHOUT reload`);
                this.tasks = availableTasks;
                this.tasksLoaded = true;
                this.lastLoadedProject = this.currentProject.id;
                this.checkForDuplicates('loadProjectTasks v2.3 using existing data');
                return;
            }
        }
        
        console.log(`🔄 v2.3 FIX: Need to load fresh data for project: ${this.currentProject?.id}`);
        
        try {
            console.log(`🔍 Loading tasks for project: ${this.currentProject.id}`);
            
            // Debug: Check directory handle status
            console.log('🔍 Directory handle debug:');
            console.log('  - globalDataManager.directoryHandle:', !!window.globalDataManager?.directoryHandle);
            console.log('  - window.firaDirectoryHandle:', !!window.firaDirectoryHandle);
            console.log('  - isDataLoaded:', window.globalDataManager?.isDataLoaded());
            
            // Check if we have session data from navigation  
            const sessionData = sessionStorage.getItem('fira-session-data');
            if (sessionData) {
                console.log('✅ Found session data from navigation, should load normally');
            } else {
                console.log('⚠️ No session data found, will need to initialize fresh');
            }
            
            // Initialize global data manager if not loaded
            if (window.globalDataManager && !window.globalDataManager.isDataLoaded()) {
                console.log('📡 Global data manager not loaded, initializing and waiting...');
                
                try {
                    await window.globalDataManager.initialize();
                    console.log(`✅ Global data manager initialized. Data loaded: ${window.globalDataManager.isDataLoaded()}`);
                    
                    // For web version, give extra time for async operations to complete
                    const isWeb = window.location.hostname.includes("onix-systems-android-tasks");
                    if (isWeb) {
                        console.log('🌐 Web version detected - waiting for data loading...');
                        // Wait a bit more for async operations
                        let attempts = 0;
                        while (!window.globalDataManager.isDataLoaded() && attempts < 10) {
                            console.log(`⏳ Waiting for data loading... attempt ${attempts + 1}/10`);
                            await new Promise(resolve => setTimeout(resolve, 200));
                            attempts++;
                        }
                    }
                    
                    // Check if initialization was successful
                    if (!window.globalDataManager.isDataLoaded()) {
                        console.log('❌ Global data manager initialization failed after waiting');
                        console.log('📊 Loading mode:', window.globalDataManager.loadingMode);
                        console.log('📊 Projects count:', window.globalDataManager.projects?.length || 0);
                        console.log('📊 API Client available:', !!window.globalDataManager.apiClient);
                        console.log('📊 Static data available:', !!window.PROJECTS_DATA);
                        console.log('📊 User role:', this.getUserRole());
                        console.log('📊 Is web version:', this.isWebVersion);
                        
                        // Try force initialization with static data as last resort
                        if (window.PROJECTS_DATA && window.PROJECTS_DATA.length > 0) {
                            console.log('🔄 Attempting emergency fallback to static data...');
                            try {
                                window.globalDataManager.loadFromStaticData();
                                window.globalDataManager.isLoaded = true;
                                console.log('✅ Emergency fallback successful - projects:', window.globalDataManager.projects?.length);
                                
                                // Double check that data was loaded
                                if (!window.globalDataManager.projects || window.globalDataManager.projects.length === 0) {
                                    console.log('❌ Emergency fallback failed - no projects loaded');
                                    this.redirectToDashboard('Failed to load project data (emergency fallback failed)');
                                    return;
                                }
                            } catch (fallbackError) {
                                console.error('❌ Emergency fallback error:', fallbackError);
                                this.redirectToDashboard('Failed to load project data (fallback error)');
                                return;
                            }
                        } else {
                            console.log('❌ No static data available for fallback');
                            this.redirectToDashboard('Failed to load project data (no fallback data)');
                            return;
                        }
                    }
                } catch (error) {
                    console.error('❌ Failed to initialize global data manager:', error);
                    this.redirectToDashboard('Error loading project data');
                    return;
                }
            }
            
            // Get tasks from global data manager
            if (window.globalDataManager && window.globalDataManager.isDataLoaded()) {
                console.log(`🔄 TASK LOADING: Getting tasks for project "${this.currentProject.id}"`);
                this.tasks = window.globalDataManager.getTasksForProject(this.currentProject.id);
                console.log(`📝 TASK LOADING: Loaded ${this.tasks.length} tasks for project "${this.currentProject.id}"`);
                this.checkForDuplicates('after loadProjectTasks');
                
                // Track the last successfully loaded project and mark as loaded
                this.lastLoadedProject = this.currentProject.id;
                this.tasksLoaded = true;
                console.log(`🏷️ TASK LOADING: Set lastLoadedProject to "${this.lastLoadedProject}" and tasksLoaded to true`);
                
                if (this.tasks.length === 0) {
                    console.warn(`⚠️ TASK LOADING: No tasks found for project ${this.currentProject.id}. Available projects:`, 
                        window.globalDataManager.getProjects().map(p => p.id));
                }
                
                // Debug: show first few tasks with detailed info
                console.log(`🔍 TASK LOADING: First 3 tasks for project "${this.currentProject.id}":`);
                this.tasks.slice(0, 3).forEach((task, index) => {
                    console.log(`   ${index + 1}. ${task.id}: "${task.title}" (column: ${task.column}, projectId: ${task.projectId})`);
                });
            } else {
                console.warn('❌ TASK LOADING: Global data not loaded, using sample tasks');
                this.loadSampleTasks();
                this.lastLoadedProject = this.currentProject.id;
                this.tasksLoaded = true;
                console.log(`🏷️ TASK LOADING: Set lastLoadedProject to "${this.lastLoadedProject}" and tasksLoaded to true (sample tasks)`);
            }
        } catch (error) {
            console.error('❌ Failed to load project tasks:', error);
            console.warn('🔄 Falling back to sample tasks');
            this.loadSampleTasks();
            this.tasksLoaded = true;
            this.lastLoadedProject = this.currentProject.id;
        }
    }

    formatDeveloperName(developerKey) {
        // Use the global data manager's formatter
        return window.globalDataManager ? 
            window.globalDataManager.formatDeveloperName(developerKey) : 
            developerKey;
    }

    loadSampleTasks() {
        this.tasks = [
            {
                id: 'TSK-714',
                title: 'Implement user authentication flow',
                column: 'backlog',
                timeSpent: '2h',
                timeEstimate: '9h',
                assignee: 'Unassigned',
                priority: 'high',
                developer: null
            },
            {
                id: 'TSK-715',
                title: 'Design dashboard mockups',
                column: 'progress',
                timeSpent: '4h',
                timeEstimate: '6h',
                assignee: 'dev-john',
                priority: 'low',
                developer: 'dev-john'
            },
            {
                id: 'TSK-716',
                title: 'Set up CI/CD pipeline',
                column: 'progress',
                timeSpent: '1h',
                timeEstimate: '8h',
                assignee: 'dev-mary',
                priority: 'low',
                developer: 'dev-mary'
            },
            {
                id: 'TSK-717',
                title: 'Write API documentation',
                column: 'review',
                timeSpent: '3h',
                timeEstimate: '5h',
                assignee: 'Alex Brown',
                priority: 'low',
                developer: 'dev-alex'
            },
            {
                id: 'TSK-718',
                title: 'Create unit tests for auth module',
                column: 'testing',
                timeSpent: '2h',
                timeEstimate: '4h',
                assignee: 'dev-john',
                priority: 'high',
                developer: 'dev-john'
            },
            {
                id: 'TSK-719',
                title: 'Setup database schema',
                column: 'done',
                timeSpent: '6h',
                timeEstimate: '6h',
                assignee: 'dev-mary',
                priority: 'high',
                developer: 'dev-mary'
            },
            {
                id: 'TSK-720',
                title: 'Implement responsive navigation',
                column: 'backlog',
                timeSpent: '0h',
                timeEstimate: '4h',
                assignee: 'Unassigned',
                priority: 'low',
                developer: null
            },
            {
                id: 'TSK-721',
                title: 'Add error handling middleware',
                column: 'review',
                timeSpent: '2h',
                timeEstimate: '3h',
                assignee: 'Alex Brown',
                priority: 'low',
                developer: 'dev-alex'
            }
        ];
    }

    // Debug helper to check for duplicates
    checkForDuplicates(source = '') {
        const taskIds = this.tasks.map(t => t.id);
        const duplicates = taskIds.filter((id, index) => taskIds.indexOf(id) !== index);
        if (duplicates.length > 0) {
            console.error(`🚨 DUPLICATES DETECTED (${source}):`, [...new Set(duplicates)]);
            console.error(`📊 Tasks array state:`, this.tasks.map(t => ({ id: t.id, title: t.title?.substring(0, 20) })));
            console.trace('Stack trace for duplicate detection');
        } else {
            console.log(`✅ No duplicates found (${source}), ${this.tasks.length} unique tasks`);
        }
    }

    // Deduplicate tasks by ID, keeping the most recently modified one
    deduplicateTasks(tasks) {
        console.log(`🔍 Deduplicating ${tasks.length} tasks...`);
        
        // Count duplicates before deduplication
        const taskIds = tasks.map(t => t.id);
        const duplicateIds = taskIds.filter((id, index) => taskIds.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
            console.log(`⚠️ Found duplicates for IDs:`, [...new Set(duplicateIds)]);
        }
        
        const taskMap = new Map();
        
        tasks.forEach((task, index) => {
            const existingTask = taskMap.get(task.id);
            
            console.log(`📝 Processing task ${task.id} (index ${index}):`, {
                lastModified: task.lastModified,
                created: task.created,
                title: task.title?.substring(0, 30) + '...'
            });
            
            if (!existingTask) {
                // First time seeing this task ID
                taskMap.set(task.id, task);
                console.log(`✅ Added task ${task.id} to map`);
            } else {
                // Compare modification times to keep the most recent
                const existingModTime = new Date(existingTask.lastModified || existingTask.created || 0);
                const currentModTime = new Date(task.lastModified || task.created || 0);
                
                console.log(`⏰ Comparing times for ${task.id}:`, {
                    existing: existingModTime.toISOString(),
                    current: currentModTime.toISOString(),
                    keepCurrent: currentModTime >= existingModTime
                });
                
                if (currentModTime >= existingModTime) {
                    taskMap.set(task.id, task);
                    console.log(`🔄 Replaced task ${task.id} with more recent version`);
                } else {
                    console.log(`⏭️ Kept existing task ${task.id} (more recent)`);
                }
            }
        });
        
        const result = Array.from(taskMap.values());
        console.log(`✨ Deduplication complete: ${tasks.length} → ${result.length} tasks`);
        
        return result;
    }

    filterAndRenderTasks() {
        this.checkForDuplicates('before filterAndRenderTasks');
        // First deduplicate tasks to avoid showing duplicates
        this.tasks = this.deduplicateTasks(this.tasks);
        this.checkForDuplicates('after filterAndRenderTasks deduplication');
        this.filteredTasks = this.tasks.filter(task => {
            const matchesSearch = !this.searchTerm || 
                task.title.toLowerCase().includes(this.searchTerm) ||
                task.id.toLowerCase().includes(this.searchTerm);
            
            const matchesDeveloper = !this.selectedDeveloper || 
                this.selectedDeveloper === 'all' ||
                (this.selectedDeveloper === 'unassigned' && !task.developer) ||
                task.developer === this.selectedDeveloper;
            
            return matchesSearch && matchesDeveloper;
        });
        
        this.updateDeveloperDropdown();
        this.renderBoard();
        
        // Also update list view if it's active
        if (this.currentView === 'list') {
            this.displayedTasks = 20; // Reset displayed tasks count when filtering
            this.renderListView();
        }
        
        // Update analytics view if it's active
        if (this.currentView === 'analytics') {
            this.renderAnalytics();
        }
    }

    updateDeveloperDropdown() {
        const developerSelect = document.getElementById('developerFilter');
        if (!developerSelect) {
            console.log('⚠️ Developer filter dropdown not found - page may not be loaded yet');
            return;
        }
        const currentSelection = developerSelect.value;
        
        // Get unique developers from multiple sources
        const developers = new Set();

        // Get developers from existing tasks
        this.tasks.forEach(task => {
            if (task.developer) {
                developers.add(task.developer);
            }
        });

        // Get developers from current project's developers list
        if (this.currentProject && this.currentProject.developers && Array.isArray(this.currentProject.developers)) {
            this.currentProject.developers.forEach(dev => {
                if (dev && dev.trim()) {
                    developers.add(dev.trim());
                }
            });
        }

        // Get developers from globalDataManager cache
        if (window.globalDataManager && window.globalDataManager.projectDevelopers && this.currentProject) {
            const projectDevelopers = window.globalDataManager.projectDevelopers[this.currentProject.id];
            if (projectDevelopers && Array.isArray(projectDevelopers)) {
                projectDevelopers.forEach(dev => {
                    if (dev && dev.trim()) {
                        developers.add(dev.trim());
                    }
                });
            }
        }
        
        // Update dropdown options
        developerSelect.innerHTML = `
            <option value="">Developer</option>
            <option value="all">All Developers</option>
            <option value="unassigned">Unassigned</option>
        `;
        
        // Add real developers
        Array.from(developers).sort().forEach(dev => {
            const option = document.createElement('option');
            option.value = dev;
            option.textContent = this.formatDeveloperName(dev);
            developerSelect.appendChild(option);
        });
        
        // Restore selection if it still exists
        if (currentSelection && Array.from(developerSelect.options).some(opt => opt.value === currentSelection)) {
            developerSelect.value = currentSelection;
        }
    }

    renderBoard() {
        console.log(`🎨 renderBoard: Starting with ${this.filteredTasks.length} filtered tasks`);
        // Extra safety - deduplicate filtered tasks before rendering
        this.filteredTasks = this.deduplicateTasks(this.filteredTasks);
        console.log(`🎨 renderBoard: After deduplication ${this.filteredTasks.length} filtered tasks`);

        const columns = ['backlog', 'progress', 'review', 'testing', 'done'];
        columns.forEach(columnId => {
            const columnContent = document.querySelector(`[data-column="${columnId}"]`);
            let columnTasks = this.filteredTasks.filter(task => task.column === columnId);

            // Apply column-specific sorting if exists
            if (this.columnSortStates[columnId]) {
                const sortState = this.columnSortStates[columnId];
                columnTasks = this.sortTasksByTitle(columnTasks, sortState.direction);
                console.log(`🔄 Applied ${sortState.direction} sorting to ${columnId} column`);
            }

            // Update count in Figma header
            const countElement = document.getElementById(`${columnId}Count`);
            if (countElement) {
                countElement.textContent = columnTasks.length;
            }

            // Clear only task cards, preserve any existing structure
            const existingTaskCards = columnContent.querySelectorAll('.task-card');
            existingTaskCards.forEach(card => card.remove());

            // Add or remove 'empty' class based on task count
            if (columnTasks.length === 0) {
                columnContent.classList.add('empty');
            } else {
                columnContent.classList.remove('empty');
            }

            // Add task cards
            columnTasks.forEach(task => {
                const taskCard = this.createTaskCard(task);
                columnContent.appendChild(taskCard);
            });
        });

        // Restore column sort visual indicators
        this.restoreColumnSortIndicators();

        // Equalize column heights after rendering
        this.equalizeColumnHeights();

        // Setup UI permissions based on user role
        this.setupUIPermissions();

        console.log('✅ Board rendered and permissions set');
        
        // Update analytics if in analytics view
        if (this.currentView === 'analytics') {
            this.updateAnalyticsMetrics();
        }
        
        // Update assignee dropdown after rendering tasks (ensure we have latest developers)
        // Only update if we're not currently in a modal to avoid interfering with current editing
        if (!document.getElementById('taskDetailModal')?.style.display?.includes('flex') &&
            !document.getElementById('createTaskDetailModal')?.style.display?.includes('flex')) {
            this.updateAssigneeDropdown().catch(console.error);
        }
    }
    
    equalizeColumnHeights() {
        const columns = document.querySelectorAll('.kanban-column');
        if (columns.length === 0) return;
        
        // Reset all column heights to auto first
        columns.forEach(column => {
            column.style.height = 'auto';
        });
        
        // Find the maximum height after a brief delay to allow DOM to update
        setTimeout(() => {
            let maxHeight = 0;
            columns.forEach(column => {
                const height = column.offsetHeight;
                if (height > maxHeight) {
                    maxHeight = height;
                }
            });
            
            // Set all columns to the maximum height
            if (maxHeight > 0) {
                columns.forEach(column => {
                    column.style.height = `${maxHeight}px`;
                });
            }
        }, 10);
    }
    createTaskCard(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        
        // Only make draggable if user can edit
        if (this.canEdit()) {
            card.draggable = true;
            card.classList.remove('viewer-readonly');
            console.log('📋 Created draggable card for task:', task.id);
        } else {
            card.draggable = false;
            card.classList.add('viewer-readonly');
            console.log('👁️ Created read-only card for task:', task.id, '(viewer mode)');
        }
        
        card.dataset.taskId = task.id;
        
        card.innerHTML = `
            <div class="task-card-header">
                <div class="task-id">${task.id}</div>
                <div class="task-time" title="Click to track time">
                    <svg class="time-icon" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0z"/>
                    </svg>
                    ${this.formatTime(this.parseTime(task.timeSpent || '0h'))}/${this.formatTime(this.parseTime(task.timeEstimate || '0h'))}
                </div>
            </div>
            <div class="task-name">${task.title}</div>
            <div class="task-card-footer">
                <div class="task-assignee">${task.assignee}</div>
                <div class="task-priority ${task.priority}">${task.priority.toUpperCase()}</div>
            </div>
        `;
        
        // Add event listeners
        let isDragging = false;
        
        card.addEventListener('mousedown', () => {
            isDragging = false;
        });
        
        card.addEventListener('dragstart', () => {
            isDragging = true;
        });
        
        card.addEventListener('click', (e) => {
            // Don't handle click if we just finished dragging
            if (isDragging) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            // Check if time display was clicked
            if (e.target.closest('.task-time')) {
                e.stopPropagation();
                openTimeTrackingModal(task);
                return;
            }
            this.openTaskDetail(task);
        });

        // Drag and drop - only for editors
        if (this.canEdit()) {
            card.addEventListener('dragstart', (e) => {
                this.handleDragStart(e, task);
            });

            card.addEventListener('dragend', (e) => {
                this.handleDragEnd(e);
            });
        }

        return card;
    }

    removeDropZones() {
        console.log('🗑️ Removing drop zones for viewer mode');
        const columns = document.querySelectorAll('.column-content');
        columns.forEach(column => {
            // Remove all drag and drop event listeners by cloning and replacing
            const newColumn = column.cloneNode(true);
            column.parentNode.replaceChild(newColumn, column);
        });
        
        // Reset the setup flag so drop zones can be set up again if needed
        this.dropZonesSetup = false;
    }

    setupDropZones() {
        // Only set up drop zones for editors
        if (!this.canEdit()) {
            console.log('👁️ Skipping drop zone setup for viewer');
            return;
        }
        
        // Prevent duplicate setup
        if (this.dropZonesSetup) {
            console.log('⚠️ Drop zones already setup, skipping...');
            return;
        }
        
        console.log('🎯 Setting up drop zones for editor mode...');
        console.log('🔧 User role:', this.getUserRole(), 'Can edit:', this.canEdit());
        const columns = document.querySelectorAll('.kanban-column');
        console.log('📋 Found', columns.length, 'kanban columns');
        
        columns.forEach((column, index) => {
            console.log(`📋 Setting up column ${index}:`, column.dataset.column);
            
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
                console.log('👆 Drag over column:', column.dataset.column);
            });

            column.addEventListener('dragleave', (e) => {
                // Only remove drag-over if we're not entering a child element
                if (!column.contains(e.relatedTarget)) {
                    column.classList.remove('drag-over');
                    console.log('👈 Drag leave column:', column.dataset.column);
                }
            });

            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                console.log('🎯 Drop on column:', column.dataset.column);
                this.handleDrop(e, column.dataset.column);
            });
        });
        
        // Also add drop zones to column contents as fallback
        const columnContents = document.querySelectorAll('.column-content');
        columnContents.forEach((columnContent, index) => {
            console.log(`📋 Setting up column content ${index}:`, columnContent.dataset.column);
            
            columnContent.addEventListener('dragover', (e) => {
                e.preventDefault();
                columnContent.classList.add('drag-over');
            });

            columnContent.addEventListener('drop', (e) => {
                e.preventDefault();
                columnContent.classList.remove('drag-over');
                console.log('🎯 Drop on column content:', columnContent.dataset.column);
                this.handleDrop(e, columnContent.dataset.column);
            });
        });
        
        // Mark drop zones as setup
        this.dropZonesSetup = true;
        console.log('✅ Drop zones setup completed');
    }

    handleDragStart(e, task) {
        console.log('🎬 Drag start:', task.id);
        this.draggedTask = task;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedTask = null;
    }
    
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    handleDrop(e, targetColumn) {
        console.log('🎯 Drop event on column:', targetColumn, 'with task:', this.draggedTask?.id);
        if (!this.draggedTask) return;
        
        if (this.draggedTask.column !== targetColumn) {
            const oldColumn = this.draggedTask.column;
            
            // Update task column and status
            this.draggedTask.column = targetColumn;
            this.draggedTask.status = targetColumn;
            
            // Find and update in tasks array
            const taskIndex = this.tasks.findIndex(t => t.id === this.draggedTask.id);
            if (taskIndex === -1) {
                console.error('🚨 Task not found in tasks array for drag operation:', this.draggedTask.id);
                console.log('📋 Available tasks:', this.tasks.map(t => t.id));
                return;
            }
            
            this.tasks[taskIndex].column = targetColumn;
            this.tasks[taskIndex].status = targetColumn;
            
            // Update status dropdown if task modal is open
            const taskStatusSelect = document.getElementById('taskStatusSelect');

            if (taskStatusSelect && this.currentTask && this.currentTask.id === this.draggedTask.id) {
                taskStatusSelect.value = targetColumn;
            }
            
            // Re-render board
            this.filterAndRenderTasks();
            
            // Save changes using the complete task object with all content preserved
            const fullTask = this.tasks[taskIndex];
            console.log('💾 Saving full task object during drag-and-drop:', {
                id: fullTask.id,
                hasContent: !!fullTask.content,
                hasFullContent: !!fullTask.fullContent,
                contentLength: fullTask.fullContent ? fullTask.fullContent.length : 0
            });
            this.saveTaskChanges(fullTask, { skipRerender: true, closeAfterSave: false, skipSuccessMessage: true });
            
            // Show specific success message for drag and drop
            this.showMessage(`Task ${this.draggedTask.id} moved to ${targetColumn}`, 'success');
            
            console.log(`Task ${this.draggedTask.id} moved from ${oldColumn} to ${targetColumn}`);
        }
    }

    toggleView(view) {
        const analyticsBtn = document.getElementById('analyticsBtn');
        const viewSwitchBtn = document.getElementById('viewSwitchBtn');
        const kanbanBoard = document.getElementById('kanbanBoard');
        const listView = document.getElementById('listView');
        const analyticsView = document.getElementById('analyticsView');
        
        // Remove active class from all buttons
        analyticsBtn.classList.remove('active');
        viewSwitchBtn.classList.remove('active');
        
        // Hide all views
        kanbanBoard.style.display = 'none';
        listView.style.display = 'none';
        analyticsView.style.display = 'none';
        
        if (view === 'analytics') {
            analyticsBtn.classList.add('active');
            analyticsView.style.display = 'block';
            this.currentView = 'analytics';
            this.renderAnalytics();
        } else if (view === 'kanban') {
            viewSwitchBtn.classList.add('active');
            viewSwitchBtn.textContent = 'List View';
            kanbanBoard.style.display = 'block';
            this.currentView = 'kanban';
        } else if (view === 'list') {
            viewSwitchBtn.classList.add('active');
            viewSwitchBtn.textContent = 'Kanban View';
            listView.style.display = 'block';
            this.currentView = 'list';
            this.renderListView();
        }
    }

    switchView() {
        if (this.currentView === 'kanban') {
            this.toggleView('list');
        } else {
            this.toggleView('kanban');
        }
    }

    initializeViewSwitchButton() {
        const viewSwitchBtn = document.getElementById('viewSwitchBtn');
        if (viewSwitchBtn) {
            // Set initial state based on current view
            if (this.currentView === 'kanban') {
                viewSwitchBtn.textContent = 'List View';
                viewSwitchBtn.classList.add('active');
            } else {
                viewSwitchBtn.textContent = 'Kanban View';
                viewSwitchBtn.classList.remove('active');
            }
        }
    }

    async openTaskDetail(task) {
        console.log('🚀 openTaskDetail called with task:');
        console.log('  task.id:', task.id);
        console.log('  task.timeEstimate:', task.timeEstimate);
        console.log('  task.timeSpent:', task.timeSpent);
        
        const modal = document.getElementById('taskDetailModal');
        
        // Load full task content from server or file system
        if (window.globalDataManager && window.globalDataManager.isDataLoaded()) {
            try {
                const fullTaskContent = await window.globalDataManager.getFullTaskContent(this.currentProject.id, task);
                if (fullTaskContent) {
                    task.fullContent = fullTaskContent;
                }
            } catch (error) {
                console.warn('Could not load full task content:', error);
            }
        }
        
        // Remember currently opened task so we can persist on close/navigation
        this.currentTask = task;
        
        // CRITICAL FIX: Check and update URL BEFORE showing modal to prevent flash
        let shouldUpdateUrl = false;
        if (window.firaRouter && this.currentProject) {
            const currentParams = window.firaRouter.getCurrentParams();
            if (currentParams.projectname) {
                const taskParam = encodeURIComponent(task.id || task.title || task.name);
                const expectedTaskParam = currentParams.taskname || currentParams.taskId;
                
                // Only update URL if we're not already showing this task
                if (!expectedTaskParam || decodeURIComponent(expectedTaskParam) !== (task.id || task.title || task.name)) {
                    shouldUpdateUrl = true;
                    console.log('🔗 Need to update URL for task sharing');
                } else {
                    console.log('🔗 URL already shows correct task, not updating');
                }
            }
        }
        
        // Initialize modal with task data
        this.populateTaskModal(task);
        
        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Set up modal event listeners
        this.setupTaskModalEventListeners(task);
        
        // Update URL AFTER modal is shown to prevent navigation interference
        if (shouldUpdateUrl && window.firaRouter && this.currentProject) {
            const currentParams = window.firaRouter.getCurrentParams();
            if (currentParams.projectname) {
                const taskParam = encodeURIComponent(task.id || task.title || task.name);
                const newUrl = `/project/${encodeURIComponent(currentParams.projectname)}/${taskParam}`;
                
                // Use history.replaceState instead of navigateTo to avoid router triggering
                window.history.replaceState({}, '', newUrl);
                window.firaRouter.currentRoute = newUrl;
                console.log('🔗 Updated URL silently for task sharing:', newUrl);
            }
        }
    }
    
    // Method to open task by name/ID - used by router
    openTaskByName(taskIdentifier) {
        console.log('🔍 Looking for task with identifier:', taskIdentifier);
        console.log('📝 Available tasks:', this.tasks.length);

        if (!this.tasks || this.tasks.length === 0) {
            console.warn('❌ No tasks loaded yet, waiting for tasks to load...');
            // Try again after a delay
            setTimeout(() => {
                if (this.tasks && this.tasks.length > 0) {
                    this.openTaskByName(taskIdentifier);
                } else {
                    this.showMessage(`Task "${taskIdentifier}" cannot be opened - no tasks loaded`, 'error');
                }
            }, 500);
            return;
        }

        // Try to find task by ID first (exact match), then by title
        let task = this.tasks.find(t => t.id === taskIdentifier);

        if (!task) {
            // Try case-insensitive ID match
            task = this.tasks.find(t => t.id.toLowerCase() === taskIdentifier.toLowerCase());
        }

        if (!task) {
            // Try exact title match
            task = this.tasks.find(t => t.title === taskIdentifier);
        }

        if (!task) {
            // Try case-insensitive title match
            task = this.tasks.find(t => t.title.toLowerCase() === taskIdentifier.toLowerCase());
        }

        if (task) {
            console.log('✅ Found task:', task.id, '-', task.title);
            this.openTaskDetail(task);

            // Update URL to include task ID (use ID for consistency)
            if (window.firaRouter) {
                const currentParams = window.firaRouter.getCurrentParams();
                const expectedTaskParam = currentParams.taskname || currentParams.taskId;

                if (currentParams.projectname && (!expectedTaskParam || decodeURIComponent(expectedTaskParam) !== task.id)) {
                    window.firaRouter.navigateTo(`/project/${encodeURIComponent(currentParams.projectname)}/task/${encodeURIComponent(task.id)}`, true);
                    console.log('🔗 Updated URL for task ID:', task.id);
                } else {
                    console.log('🔗 URL already shows correct task, not updating from openTaskByName');
                }
            }
        } else {
            console.warn('❌ Task not found:', taskIdentifier);
            console.log('📋 Available task IDs:', this.tasks.map(t => t.id));
            console.log('📋 Available task titles:', this.tasks.map(t => t.title));
            // Show a message to user
            this.showMessage(`Task "${taskIdentifier}" not found in project "${this.currentProject.name}"`, 'error');
        }
    }
    
    // Method to open the create task detail modal for server mode
    openCreateTaskDetailModal() {
        console.log('🚀 openCreateTaskDetailModal called');
        const modal = document.getElementById('createTaskDetailModal');
        if (!modal) {
            console.error('❌ createTaskDetailModal not found in DOM');
            return;
        }
        
        console.log('✅ Found createTaskDetailModal element:', modal);
        console.log('✅ Modal classes:', modal.className);
        
        // Initialize empty task data
        this.initializeCreateTaskModal();
        
        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Set up modal event listeners
        this.setupCreateTaskModalEventListeners();
        
        console.log('📝 Opened create task detail modal successfully');
        console.log('📝 Modal display style:', modal.style.display);
    }
    
    initializeCreateTaskModal() {
        // Create a new empty task and set it as current task
        this.currentTask = {
            id: this.generateTaskId(),
            title: '',
            content: '',
            fullContent: '',
            column: 'backlog',
            timeEstimate: '2h',
            timeSpent: '0h',
            priority: 'medium',
            developer: '',
            assignee: '',
            created: new Date().toISOString().substring(0, 10),
            projectId: this.currentProject ? this.currentProject.id : '',
            _isNew: true
        };
        
        console.log('🆕 Created new currentTask for task creation:', this.currentTask);
        
        // Clear all form fields
        const taskNameInput = document.getElementById('createTaskNameInput');
        const descriptionEditor = document.getElementById('createTaskDescriptionEditor');
        const prioritySelect = document.getElementById('createTaskPrioritySelect');
        const assigneeSelected = document.querySelector('#createDropdownSelected .selected-value');
        const createdDate = document.getElementById('createTaskCreatedDate');
        const timeRemaining = document.getElementById('createTimeRemaining');
        
        if (taskNameInput) taskNameInput.value = '';
        if (descriptionEditor) descriptionEditor.value = '';
        if (prioritySelect) prioritySelect.value = 'medium';
        if (assigneeSelected) assigneeSelected.textContent = 'Unassigned';
        if (createdDate) createdDate.textContent = new Date().toLocaleDateString();
        if (timeRemaining) timeRemaining.textContent = '2h remaining';
        
        // Update assignee dropdown with current project developers (force refresh to get latest)
        this.updateAssigneeDropdown('Unassigned', true).catch(console.error);
        
        // Set preview mode as default
        const editBtn = document.getElementById('createEditModeBtn');
        const previewBtn = document.getElementById('createPreviewModeBtn');
        const toolbar = document.getElementById('createEditorToolbar');
        const preview = document.getElementById('createTaskDescriptionPreview');

        if (editBtn) editBtn.classList.remove('active');
        if (previewBtn) previewBtn.classList.add('active');
        if (toolbar) toolbar.style.display = 'none';
        if (preview) preview.style.display = 'block';
        if (descriptionEditor) descriptionEditor.style.display = 'none';
    }
    
    setupCreateTaskModalEventListeners() {
        // Initialize assignee dropdown functionality for create modal
        this.initializeCreateAssigneeDropdown();
        
        // Edit/Preview mode buttons
        const editBtn = document.getElementById('createEditModeBtn');
        const previewBtn = document.getElementById('createPreviewModeBtn');
        
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                editBtn.classList.add('active');
                previewBtn.classList.remove('active');
                document.getElementById('createEditorToolbar').style.display = 'flex';
                document.getElementById('createTaskDescriptionEditor').style.display = 'block';
                document.getElementById('createTaskDescriptionPreview').style.display = 'none';
            });
        }
        
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                previewBtn.classList.add('active');
                editBtn.classList.remove('active');
                document.getElementById('createEditorToolbar').style.display = 'none';
                document.getElementById('createTaskDescriptionEditor').style.display = 'none';
                document.getElementById('createTaskDescriptionPreview').style.display = 'block';
                
                // Update preview with current content
                const editor = document.getElementById('createTaskDescriptionEditor');
                const preview = document.getElementById('createTaskDescriptionPreview');
                if (editor && preview) {
                    preview.innerHTML = this.convertMarkdownToHtml(editor.value) || '<em>No description provided</em>';
                }
            });
        }
        
        // Set up createEditorToolbar buttons
        this.setupCreateEditorToolbar();
    }

    setupCreateEditorToolbar() {
        const toolbar = document.getElementById('createEditorToolbar');
        const descriptionEditor = document.getElementById('createTaskDescriptionEditor');
        
        if (!toolbar || !descriptionEditor) {
            console.warn('createEditorToolbar or createTaskDescriptionEditor not found');
            return;
        }

        // Remove existing listeners by cloning toolbar buttons
        const toolbarButtons = toolbar.querySelectorAll('.toolbar-btn');
        toolbarButtons.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });

        // Add fresh listeners to the new buttons
        toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleToolbarAction(btn.dataset.command, descriptionEditor);
            });
        });
    }
    
    populateTaskModal(task) {
        console.log('📝 populateTaskModal called with task:');
        console.log('  task.id:', task.id);
        console.log('  task.timeEstimate:', task.timeEstimate);
        console.log('  task.timeSpent:', task.timeSpent);
        
        // Store current task for other methods to use
        this.currentTask = task;
        
        console.log('  this.currentTask after assignment:', {
            id: this.currentTask.id,
            timeEstimate: this.currentTask.timeEstimate,
            timeSpent: this.currentTask.timeSpent
        });
        
        // Update breadcrumb
        const breadcrumb = document.getElementById('taskBreadcrumb');
        breadcrumb.textContent = `${this.currentProject.name} / ${task.id}`;
        
        // Update task name
        const taskNameInput = document.getElementById('taskNameInput');
        taskNameInput.value = task.title;
        
        // Update description - use full content if available, otherwise fallback to short content
        const descriptionPreview = document.getElementById('taskDescriptionPreview');
        const descriptionEditor = document.getElementById('taskDescriptionEditor');
        const taskContent = task.fullContent || task.content || 'No description available.';
        
        descriptionPreview.innerHTML = this.convertMarkdownToHTML(taskContent);
        descriptionEditor.value = taskContent;
        
        // Update right panel fields
        const taskAssignee = document.getElementById('taskAssignee');
        const taskEstimate = document.getElementById('taskEstimate');
        const taskCreated = document.getElementById('taskCreated');
        const taskTimeSpent = document.getElementById('taskTimeSpent');
        const taskPriority = document.getElementById('taskPriority');
        const taskPrioritySelect = document.getElementById('taskPrioritySelect');
        const taskStatusSelect = document.getElementById('taskStatusSelect');
        
        taskAssignee.value = task.developer || '';
        taskEstimate.value = task.timeEstimate || '0';
        taskCreated.value = task.created || new Date().toISOString().split('T')[0];
        taskTimeSpent.value = task.timeSpent || '';
        if (taskPriority) taskPriority.value = task.priority || 'low';
        if (taskPrioritySelect) taskPrioritySelect.value = task.priority || 'low';

        if (taskStatusSelect) {
            const taskInd = this.tasks.findIndex(t => t.id === task.id);
            // Use the actual task status/column, fallback to 'backlog' only if both are empty
            const actualStatus = this.tasks[taskInd]?.column || this.tasks[taskInd]?.status || task.status || task.column || 'backlog';
            taskStatusSelect.value = actualStatus;
            console.log('Setting task status select to:', actualStatus);
        }
        
        // Sync estimate with estimateInput field
        const estimateInput = document.getElementById('estimateInput');
        if (estimateInput) {
            const estimateValue = (task.timeEstimate || '0').replace('h', '');
            estimateInput.value = estimateValue;
            console.log(`🔄 Syncing estimate to estimateInput: ${estimateValue}`);
        }
        
        // Update visible display elements
        this.updateVisibleTaskFields(task);
        
        // Parse and display activities
        this.parseAndDisplayActivities(task);
        
        // Setup comment functionality
        this.setupCommentForm(task);
        
        // Update task type
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.type === (task.type || 'task')) {
                btn.classList.add('active');
            }
        });
        
        // Update time progress
        this.updateTimeProgress(task);
        
        // Update all time displays with synchronized values
        this.updateTaskDetailTimeDisplays(task);
        
        // Update character counter
        this.updateCharacterCounter();
        
        // Load activity feed
        this.loadActivityFeed(task);
    }
    
    updateVisibleTaskFields(task) {
        // Update assignee dropdown with current project developers (force refresh to get latest)
        this.updateAssigneeDropdown(task.developer || 'Unassigned', true).catch(console.error);
        
        // Update assignee badge
        const assigneeBadge = document.querySelector('.assignee-badge span');
        if (assigneeBadge) {
            assigneeBadge.textContent = task.developer || 'Unassigned';
        }
        
        // Update estimate value
        const estimateValue = document.querySelector('.info-item:nth-child(2) .info-value');
        if (estimateValue) {
            estimateValue.textContent = task.timeEstimate || '0';
        }
        
        // Update created badge
        const createdBadge = document.querySelector('.created-badge');
        if (createdBadge) {
            const date = task.created || task.lastModified || new Date().toISOString();
            const formattedDate = new Date(date).toLocaleDateString('uk-UA', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric'
            }).replace(/\//g, '.');
            createdBadge.textContent = formattedDate;
        }
        
        // Update time tracking
        const timeSpent = document.querySelector('.time-spent');
        const timeRemaining = document.querySelector('.time-remaining');
        const progressFill = document.querySelector('.progress-fill');
        
        if (timeSpent) {
            timeSpent.textContent = task.timeSpent || '1h';
        }
        
        if (timeRemaining && progressFill) {
            const estimate = parseInt(task.timeEstimate) || 4;
            const spent = parseInt(task.timeSpent) || 1;
            const remaining = Math.max(0, estimate - spent);
            const progress = Math.min((spent / estimate) * 100, 100);
            
            timeRemaining.textContent = `${remaining}h remaining`;
            progressFill.style.width = `${progress}%`;
        }
    }
    
    clearDevelopersCache() {
        // Clear developers cache for the current project
        if (window.globalDataManager && this.currentProject) {
            if (window.globalDataManager.projectDevelopers) {
                delete window.globalDataManager.projectDevelopers[this.currentProject.id];
                console.log(`🗑️ Cleared developers cache for project: ${this.currentProject.id}`);
            }
        }
    }

    async updateAssigneeDropdown(selectedAssignee = 'Unassigned', forceRefresh = false) {
        // Get developers from project progress folder structure
        let developers = new Set();
        
        try {
            if (this.currentProject && this.currentProject.id) {
                // Force refresh to get latest developers from filesystem
                const projectDevelopers = await window.globalDataManager.getProjectDevelopers(this.currentProject.id, forceRefresh);
                projectDevelopers.forEach(dev => developers.add(dev));
                console.log(`👥 Found ${projectDevelopers.length} developers for dropdown:`, projectDevelopers);
            }
        } catch (error) {
            console.warn('⚠️ Error getting project developers, trying project data:', error);
            
            // First fallback: use currentProject.developers if available
            if (this.currentProject && this.currentProject.developers && Array.isArray(this.currentProject.developers)) {
                this.currentProject.developers.forEach(dev => {
                    if (dev && dev.trim() && (dev.startsWith('dev-') || dev.startsWith('tech-'))) {
                        developers.add(dev.trim());
                    }
                });
                console.log(`👥 Using project.developers fallback:`, this.currentProject.developers);
            }
            
            // Second fallback: get developers from current tasks
            this.tasks.forEach(task => {
                if (task.developer && task.developer.trim() && (task.developer.startsWith('dev-') || task.developer.startsWith('tech-'))) {
                    developers.add(task.developer.trim());
                }
            });
        }
        
        // Update the dropdown menu in task detail modal
        const dropdownMenu = document.getElementById('dropdownMenu');
        if (dropdownMenu) {
            dropdownMenu.innerHTML = '';
            
            // Add "Unassigned" option first
            const unassignedOption = document.createElement('div');
            unassignedOption.className = 'dropdown-option';
            unassignedOption.setAttribute('data-value', 'Unassigned');
            unassignedOption.textContent = 'Unassigned';
            dropdownMenu.appendChild(unassignedOption);
            
            // Add all developers found in tasks
            Array.from(developers).sort().forEach(dev => {
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.setAttribute('data-value', dev);
                option.textContent = dev;
                dropdownMenu.appendChild(option);
            });
        }
        
        // Update the selected value display
        const selectedValueSpan = document.querySelector('#dropdownSelected .selected-value');
        if (selectedValueSpan) {
            selectedValueSpan.textContent = selectedAssignee;
        }
        
        // Also update create modal dropdown if it exists
        const createDropdownMenu = document.getElementById('createDropdownMenu');
        if (createDropdownMenu) {
            createDropdownMenu.innerHTML = '';
            
            // Add "Unassigned" option first
            const unassignedOption = document.createElement('div');
            unassignedOption.className = 'dropdown-option';
            unassignedOption.setAttribute('data-value', 'Unassigned');
            unassignedOption.textContent = 'Unassigned';
            createDropdownMenu.appendChild(unassignedOption);
            
            // Add all developers found in tasks
            Array.from(developers).sort().forEach(dev => {
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.setAttribute('data-value', dev);
                option.textContent = dev;
                createDropdownMenu.appendChild(option);
            });
        }
        
        // Also update developer filter dropdown in main interface
        const developerFilter = document.getElementById('developerFilter');
        if (developerFilter) {
            // Save current selection
            const currentValue = developerFilter.value;
            
            // Clear existing options (except first 3 which are static)
            const staticOptions = Array.from(developerFilter.options).slice(0, 3);
            developerFilter.innerHTML = '';
            
            // Re-add static options
            staticOptions.forEach(option => {
                developerFilter.appendChild(option);
            });
            
            // Add all developers found in tasks
            Array.from(developers).sort().forEach(dev => {
                const option = document.createElement('option');
                option.value = dev.toLowerCase().replace(/\s+/g, '-');
                option.textContent = dev;
                developerFilter.appendChild(option);
            });
            
            // Restore selection if it still exists
            if (Array.from(developerFilter.options).some(opt => opt.value === currentValue)) {
                developerFilter.value = currentValue;
            }
        }
        
        // Update regular select elements for task assignment
        const taskAssigneeSelect = document.getElementById('taskAssignee');
        if (taskAssigneeSelect) {
            // Save current selection
            const currentTaskAssignee = taskAssigneeSelect.value;
            
            // Clear existing options
            taskAssigneeSelect.innerHTML = '';
            
            // Add "Unassigned" option first
            const unassignedOption = document.createElement('option');
            unassignedOption.value = '';
            unassignedOption.textContent = 'Unassigned';
            taskAssigneeSelect.appendChild(unassignedOption);
            
            // Add all developers
            Array.from(developers).sort().forEach(dev => {
                const option = document.createElement('option');
                option.value = dev;
                option.textContent = dev;
                taskAssigneeSelect.appendChild(option);
            });
            
            // Restore selection if it still exists
            if (currentTaskAssignee && Array.from(taskAssigneeSelect.options).some(opt => opt.value === currentTaskAssignee)) {
                taskAssigneeSelect.value = currentTaskAssignee;
            } else if (selectedAssignee && selectedAssignee !== 'Unassigned') {
                taskAssigneeSelect.value = selectedAssignee;
            }
        }
        
        // Update create task assignee select
        const newTaskAssigneeSelect = document.getElementById('newTaskAssignee');
        if (newTaskAssigneeSelect) {
            // Save current selection
            const currentNewTaskAssignee = newTaskAssigneeSelect.value;
            
            // Clear existing options
            newTaskAssigneeSelect.innerHTML = '';
            
            // Add "Unassigned" option first
            const unassignedOption = document.createElement('option');
            unassignedOption.value = '';
            unassignedOption.textContent = 'Unassigned';
            newTaskAssigneeSelect.appendChild(unassignedOption);
            
            // Add all developers
            Array.from(developers).sort().forEach(dev => {
                const option = document.createElement('option');
                option.value = dev;
                option.textContent = dev;
                newTaskAssigneeSelect.appendChild(option);
            });
            
            // Restore selection if it still exists
            if (currentNewTaskAssignee && Array.from(newTaskAssigneeSelect.options).some(opt => opt.value === currentNewTaskAssignee)) {
                newTaskAssigneeSelect.value = currentNewTaskAssignee;
            }
        }
        
        console.log(`📋 Updated assignee dropdown with ${developers.size} developers:`, Array.from(developers));
    }

    parseAndDisplayActivities(task) {
        const activitiesList = document.getElementById('activitiesList');
        if (!activitiesList) return;
        
        const activities = [];
        const taskContent = task.fullContent || task.content || '';
        
        // Parse comments from task content
        // Format: "2025-07-09 - System Note\n\nHex editor must provide..."
        const commentRegex = /(\d{4}-\d{2}-\d{2})\s*-\s*([^:\n]+)\s*[\:\n]?\s*([\s\S]*?)(?=\n\d{4}-\d{2}-\d{2}\s*-|$)/g;
        let match;
        
        while ((match = commentRegex.exec(taskContent)) !== null) {
            const [, date, author, content] = match;
            if (content.trim()) {
                activities.push({
                    type: 'comment',
                    date: date.trim(),
                    author: author.trim(),
                    content: content.trim()
                });
            }
        }
        
        // Sort activities by date (newest first)
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Display activities
        if (activities.length === 0) {
            activitiesList.innerHTML = '<div class="no-activities">No activities found</div>';
        } else {
            activitiesList.innerHTML = activities.map(activity => `
                <div class="activity-item">
                    <div class="activity-header">
                        <span class="activity-author">${this.escapeHtml(activity.author)}</span>
                        <span class="activity-date">${activity.date}</span>
                    </div>
                    <div class="activity-content">${this.escapeHtml(activity.content)}</div>
                </div>
            `).join('');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupCommentForm(task) {
        const commentInput = document.getElementById('newCommentInput');
        const addCommentBtn = document.getElementById('addCommentBtn');
        
        if (!commentInput || !addCommentBtn) return;
        
        // Clear previous event listeners
        const newAddCommentBtn = addCommentBtn.cloneNode(true);
        addCommentBtn.parentNode.replaceChild(newAddCommentBtn, addCommentBtn);
        
        // Add click event listener
        newAddCommentBtn.addEventListener('click', () => {
            this.addNewComment(task, commentInput);
        });
        
        // Add Enter+Ctrl keyboard shortcut
        commentInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.addNewComment(task, commentInput);
            }
        });
    }

    addNewComment(task, commentInput) {
        const comment = commentInput.value.trim();
        if (!comment) return;
        
        // Get current date
        const currentDate = new Date().toISOString().split('T')[0];
        
        // Add comment to task content
        const newComment = `${currentDate} - User\n\n${comment}\n\n`;
        
        // Append to task content
        task.fullContent = task.fullContent || task.content || '';
        task.fullContent += '\n\n' + newComment;
        task.content += '\n\n' + newComment;
        
        // Update the description editor if it exists
        const descriptionEditor = document.getElementById('taskDescriptionEditor');
        if (descriptionEditor) {
            descriptionEditor.value = task.fullContent;
        }
        
        // Clear comment input
        commentInput.value = '';
        
        // Refresh activities display
        this.parseAndDisplayActivities(task);
        
        // Mark task as modified
        task.lastModified = new Date().toISOString();
        
        // Show success message
        this.showMessage('Comment added successfully!', 'success');
    }
    
    setupTaskModalEventListeners(task) {
        // Edit/Preview mode toggle
        const editModeBtn = document.getElementById('editModeBtn');
        const previewModeBtn = document.getElementById('previewModeBtn');
        const editorToolbar = document.getElementById('editorToolbar');
        const descriptionPreview = document.getElementById('taskDescriptionPreview');
        const descriptionEditor = document.getElementById('taskDescriptionEditor');
        const taskNameInput = document.getElementById('taskNameInput');
        
        if (editModeBtn) {
            editModeBtn.addEventListener('click', () => {
                editModeBtn.classList.add('active');
                previewModeBtn.classList.remove('active');
                editorToolbar.style.display = 'flex';
                descriptionPreview.style.display = 'none';
                descriptionEditor.style.display = 'block';
                taskNameInput.removeAttribute('readonly');
            });
        }
        
        if (previewModeBtn) {
            previewModeBtn.addEventListener('click', () => {
                previewModeBtn.classList.add('active');
                editModeBtn.classList.remove('active');
                editorToolbar.style.display = 'none';
                descriptionEditor.style.display = 'none';
                descriptionPreview.style.display = 'block';
                taskNameInput.setAttribute('readonly', true);

                // Update preview with current editor content
                descriptionPreview.innerHTML = this.convertMarkdownToHTML(descriptionEditor.value);
            });
        }

        // Set preview mode as default
        if (previewModeBtn && editModeBtn) {
            previewModeBtn.classList.add('active');
            editModeBtn.classList.remove('active');
            if (editorToolbar) editorToolbar.style.display = 'none';
            if (descriptionEditor) descriptionEditor.style.display = 'none';
            if (descriptionPreview) descriptionPreview.style.display = 'block';
            if (taskNameInput) taskNameInput.setAttribute('readonly', true);

            // Update preview with current editor content
            if (descriptionPreview && descriptionEditor) {
                descriptionPreview.innerHTML = this.convertMarkdownToHTML(descriptionEditor.value);
            }
        }
        
        // Rich text editor toolbar - remove existing listeners first
        const existingToolbarButtons = editorToolbar ? editorToolbar.querySelectorAll('.toolbar-btn') : [];
        existingToolbarButtons.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });
        
        // Add fresh listeners to toolbar buttons
        if (editorToolbar) {
            editorToolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleToolbarAction(btn.dataset.command, descriptionEditor);
                });
            });
        }
        
        // Character counter, live preview update, and auto-save
        if (descriptionEditor) {
            let debounceTimer;
            let autoSaveTimer;
            
            descriptionEditor.addEventListener('input', () => {
                this.updateCharacterCounter();
                
                // Debounced preview update to avoid excessive updates
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.updateLivePreview();
                }, 300);
                
                // Auto-save description changes after user stops typing
                console.log('🔍 Auto-save check: currentTask exists?', !!this.currentTask, this.currentTask?.id);
                if (this.currentTask) {
                    clearTimeout(autoSaveTimer);
                    console.log('⏰ Setting up auto-save timer for task:', this.currentTask.id);
                    autoSaveTimer = setTimeout(() => {
                        console.log('💾 Auto-saving description changes for task:', this.currentTask.id);
                        this.saveTaskChanges(this.currentTask, { closeAfterSave: false })
                            .then(() => console.log('✅ Description auto-saved for task:', this.currentTask.id))
                            .catch(err => console.error('❌ Failed to auto-save description for task:', this.currentTask.id, err));
                    }, 1500); // Wait 1.5 seconds after last change
                } else {
                    console.warn('⚠️ Cannot auto-save: currentTask is not set');
                }
            });
        }
        
        // Task type buttons
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Time tracking updates
        const taskTimeSpent = document.getElementById('taskTimeSpent');
        const taskEstimate = document.getElementById('taskEstimate');
        
        taskTimeSpent.addEventListener('input', () => {
            // Update task object with current value
            task.timeSpent = taskTimeSpent.value || '0h';
            
            // Also update currentTask reference
            if (this.currentTask && this.currentTask.id === task.id) {
                this.currentTask.timeSpent = task.timeSpent;
            }
            
            this.updateTimeProgress(task);
            // Sync across all UI elements
            this.syncEstimateAcrossUI(task);
        });
        
        // Add listener for estimate changes
        if (taskEstimate) {
            taskEstimate.addEventListener('input', () => {
                // Update task object with current value
                task.timeEstimate = taskEstimate.value || '0h';
                
                // Also update currentTask reference
                if (this.currentTask && this.currentTask.id === task.id) {
                    this.currentTask.timeEstimate = task.timeEstimate;
                }
                
                this.updateTimeProgress(task);
                // Sync across all UI elements
                this.syncEstimateAcrossUI(task);
            });
        }
        
        // Save and cancel buttons
        const saveBtn = document.getElementById('saveTaskBtn');
        const cancelBtn = document.getElementById('cancelTaskBtn');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                await this.saveTaskChanges(task);
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                closeTaskModal();
            });
        }
        
        // Comment functionality
        const addCommentBtn = document.getElementById('addCommentBtn');
        const commentInput = document.getElementById('commentInput');
        
        addCommentBtn.addEventListener('click', async () => {
            await this.addComment(task, commentInput.value);
        });
        
        commentInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                await this.addComment(task, commentInput.value);
            }
        });
        
        // Image upload - setup both zones (edit and create)
        this.setupImageDropZone('imageUpload', 'taskDescriptionEditor');
        this.setupImageDropZone('createImageUpload', 'createTaskDescriptionEditor');
        
        // Priority dropdown functionality
        const taskPrioritySelect = document.getElementById('taskPrioritySelect');
        if (taskPrioritySelect) {
            taskPrioritySelect.addEventListener('change', (e) => {
                const newPriority = e.target.value;
                task.priority = newPriority;
                
                // Update currentTask reference
                if (this.currentTask && this.currentTask.id === task.id) {
                    this.currentTask.priority = newPriority;
                }
                
                // Save changes automatically (don't close modal after priority change)
                this.saveTaskChanges(task, { closeAfterSave: false });
                console.log('Priority updated to:', newPriority);
            });
        }
        
        // Status dropdown functionality
        const taskStatusSelect = document.getElementById('taskStatusSelect');
        if (taskStatusSelect) {

            taskStatusSelect.addEventListener('change', (e) => {
                const newStatus = e.target.value;
                const oldStatus = task.status;
                
                
                // Update task status
                task.status = newStatus;
                task.column = newStatus; // Ensure column is synced
                
                // Update currentTask reference
                if (this.currentTask && this.currentTask.id === task.id) {
                    this.currentTask.status = newStatus;
                    this.currentTask.column = newStatus;
                }
                
                // Update task in tasks array
                const taskIndex = this.tasks.findIndex(t => t.id === task.id);
                if (taskIndex !== -1) {
                    console.log(`🔄 Updating task ${task.id} in array from ${this.tasks[taskIndex].status} to ${newStatus}`);
                    this.tasks[taskIndex].status = newStatus;
                    this.tasks[taskIndex].column = newStatus;
                    console.log(`✅ Task updated in array:`, this.tasks[taskIndex]);
                } else {
                    console.error(`❌ Task ${task.id} not found in tasks array!`);
                }
                
                // Update any visible status indicators in the modal
                const modalStatusBadges = document.querySelectorAll('.status-badge, .task-status');
                modalStatusBadges.forEach(badge => {
                    if (badge.closest('#taskDetailModal')) {
                        badge.textContent = this.getStatusDisplayName(newStatus);
                        badge.className = badge.className.replace(/status-\w+/g, '') + ` status-${newStatus}`;
                    }
                });
                
                // Re-render the board to show the task in new column
                console.log(`🎨 Re-rendering board after status change to ${newStatus}`);
                this.filterAndRenderTasks();
                
                // Save changes automatically (don't close modal after status change)
                this.saveTaskChanges(task, { closeAfterSave: false, skipSuccessMessage: true });
                console.log('Status updated from', oldStatus, 'to:', newStatus);
            });
        }
        
        // Initialize assignee dropdown functionality
        this.initializeAssigneeDropdown();
    }
    
    initializeAssigneeDropdown() {
        const dropdownSelected = document.getElementById('dropdownSelected');
        const dropdownMenu = document.getElementById('dropdownMenu');
        const dropdown = document.getElementById('assigneeDropdown');
        
        if (!dropdownSelected || !dropdownMenu || !dropdown) return;
        
        // Remove any existing listeners to prevent duplicates
        const newDropdownSelected = dropdownSelected.cloneNode(true);
        const newDropdownMenu = dropdownMenu.cloneNode(true);
        
        dropdownSelected.parentNode.replaceChild(newDropdownSelected, dropdownSelected);
        dropdownMenu.parentNode.replaceChild(newDropdownMenu, dropdownMenu);
        
        // Get fresh references
        const freshDropdownSelected = document.getElementById('dropdownSelected');
        const freshDropdownMenu = document.getElementById('dropdownMenu');
        
        // Toggle dropdown
        freshDropdownSelected.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = dropdown.classList.contains('active');
            
            if (isActive) {
                this.closeAssigneeDropdown();
            } else {
                this.openAssigneeDropdown();
            }
        });
        
        // Handle option selection
        freshDropdownMenu.addEventListener('click', (e) => {
            const option = e.target.closest('.dropdown-option');
            if (option) {
                const value = option.getAttribute('data-value');
                this.selectAssigneeOption(value);
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                this.closeAssigneeDropdown();
            }
        });
    }
    
    openAssigneeDropdown() {
        const dropdown = document.getElementById('assigneeDropdown');
        const dropdownSelected = document.getElementById('dropdownSelected');
        const dropdownMenu = document.getElementById('dropdownMenu');
        
        dropdown.classList.add('active');
        dropdownSelected.classList.add('active');
        dropdownMenu.classList.add('show');
    }
    
    closeAssigneeDropdown() {
        const dropdown = document.getElementById('assigneeDropdown');
        const dropdownSelected = document.getElementById('dropdownSelected');
        const dropdownMenu = document.getElementById('dropdownMenu');
        
        dropdown.classList.remove('active');
        dropdownSelected.classList.remove('active');
        dropdownMenu.classList.remove('show');
    }
    
    selectAssigneeOption(value) {
        const selectedValueSpan = document.querySelector('#dropdownSelected .selected-value');
        const taskAssignee = document.getElementById('taskAssignee');
        
        if (selectedValueSpan) {
            selectedValueSpan.textContent = value;
        }
        
        if (taskAssignee) {
            taskAssignee.value = value === 'Unassigned' ? '' : value;
        }
        
        // Update current task data
        if (this.currentTask) {
            this.currentTask.developer = value === 'Unassigned' ? '' : value;
            this.currentTask.assignee = value === 'Unassigned' ? '' : value;
        }
        
        this.closeAssigneeDropdown();
        console.log(`✅ Selected assignee: ${value}`);
    }
    
    initializeCreateAssigneeDropdown() {
        const dropdownSelected = document.getElementById('createDropdownSelected');
        const dropdownMenu = document.getElementById('createDropdownMenu');
        const dropdown = document.getElementById('createAssigneeDropdown');
        
        if (!dropdownSelected || !dropdownMenu || !dropdown) return;
        
        // Remove any existing listeners to prevent duplicates
        const newDropdownSelected = dropdownSelected.cloneNode(true);
        const newDropdownMenu = dropdownMenu.cloneNode(true);
        
        dropdownSelected.parentNode.replaceChild(newDropdownSelected, dropdownSelected);
        dropdownMenu.parentNode.replaceChild(newDropdownMenu, dropdownMenu);
        
        // Get fresh references
        const freshDropdownSelected = document.getElementById('createDropdownSelected');
        const freshDropdownMenu = document.getElementById('createDropdownMenu');
        
        // Toggle dropdown
        freshDropdownSelected.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = dropdown.classList.contains('active');
            
            if (isActive) {
                this.closeCreateAssigneeDropdown();
            } else {
                this.openCreateAssigneeDropdown();
            }
        });
        
        // Handle option selection
        freshDropdownMenu.addEventListener('click', (e) => {
            const option = e.target.closest('.dropdown-option');
            if (option) {
                const value = option.getAttribute('data-value');
                this.selectCreateAssigneeOption(value);
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                this.closeCreateAssigneeDropdown();
            }
        });
    }
    
    openCreateAssigneeDropdown() {
        const dropdown = document.getElementById('createAssigneeDropdown');
        const dropdownSelected = document.getElementById('createDropdownSelected');
        const dropdownMenu = document.getElementById('createDropdownMenu');
        
        dropdown.classList.add('active');
        dropdownSelected.classList.add('active');
        dropdownMenu.classList.add('show');
    }
    
    closeCreateAssigneeDropdown() {
        const dropdown = document.getElementById('createAssigneeDropdown');
        const dropdownSelected = document.getElementById('createDropdownSelected');
        const dropdownMenu = document.getElementById('createDropdownMenu');
        
        dropdown.classList.remove('active');
        dropdownSelected.classList.remove('active');
        dropdownMenu.classList.remove('show');
    }
    
    selectCreateAssigneeOption(value) {
        const selectedValueSpan = document.querySelector('#createDropdownSelected .selected-value');
        
        if (selectedValueSpan) {
            selectedValueSpan.textContent = value;
        }
        
        this.closeCreateAssigneeDropdown();
        console.log(`✅ Selected create assignee: ${value}`);
    }
    
    // Helper function to check if a line is already quoted
    isLineQuoted(line) {
        return line.trim().startsWith('> ');
    }

    // Helper function to remove quote formatting from a line
    removeQuoteFromLine(line) {
        return line.replace(/^\s*>\s?/, '');
    }

    // Helper function to add quote formatting to a line
    addQuoteToLine(line) {
        return `> ${line}`;
    }

    // Helper functions for heading formatting
    isLineHeading(line, level) {
        const prefix = '#'.repeat(level);
        const trimmed = line.trim();
        // Match exact level with optional space: ## or ## text (but not ### text)
        return trimmed.startsWith(prefix) &&
               (trimmed.length === prefix.length || trimmed.charAt(prefix.length) === ' ') &&
               !trimmed.startsWith(prefix + '#');
    }

    // Helper function to remove heading formatting from a line
    removeHeadingFromLine(line) {
        // Remove heading markers with optional space: ## text -> text, ## -> empty string
        return line.replace(/^\s*#+\s?/, '');
    }

    // Helper function to add heading formatting to a line
    addHeadingToLine(line, level) {
        const prefix = '#'.repeat(level) + ' ';
        const cleanLine = this.removeHeadingFromLine(line);
        return `${prefix}${cleanLine}`;
    }

    // Helper function to get current heading level of a line (returns 0 if not a heading)
    getHeadingLevel(line) {
        // Match headings with optional space and optional text: ## or ## text
        const match = line.trim().match(/^(#+)(\s.*)?$/);
        return match ? match[1].length : 0;
    }

    // Helper function to handle heading toggle
    handleHeadingToggle(textBefore, selectedText, textAfter, targetLevel) {
        if (!selectedText) {
            // Find the current line
            const allText = textBefore + textAfter;
            const lines = allText.split('\n');
            const currentLineIndex = textBefore.split('\n').length - 1;
            const currentLine = lines[currentLineIndex] || '';

            const currentLevel = this.getHeadingLevel(currentLine);

            if (currentLevel === targetLevel) {
                // Remove heading formatting - convert back to plain text
                const newLine = this.removeHeadingFromLine(currentLine);
                lines[currentLineIndex] = newLine;
                return lines.join('\n');
            } else {
                // Add or change heading formatting
                const newLine = this.addHeadingToLine(currentLine, targetLevel);
                lines[currentLineIndex] = newLine;
                return lines.join('\n');
            }
        } else {
            // Work with selected text - split into lines
            const selectedLines = selectedText.split('\n');
            const allSameHeading = selectedLines.every(line => this.getHeadingLevel(line) === targetLevel);

            let processedLines;
            if (allSameHeading) {
                // Remove heading formatting from all lines
                processedLines = selectedLines.map(line => this.removeHeadingFromLine(line));
            } else {
                // Add heading formatting to all lines
                processedLines = selectedLines.map(line => this.addHeadingToLine(line, targetLevel));
            }

            return textBefore + processedLines.join('\n') + textAfter;
        }
    }

    // Helper function to check if a line is a list item
    isLineListItem(line) {
        // Check for bullet lists (-, *, +) or numbered lists (1. 2. etc.)
        return /^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line);
    }

    // Helper function to remove list formatting from a line
    removeListFromLine(line) {
        return line.replace(/^\s*[-*+]\s/, '').replace(/^\s*\d+\.\s/, '');
    }

    // Helper function to handle quote toggle
    handleQuoteToggle(textBefore, selectedText, textAfter, start, end) {
        // If no text is selected, work with the current line
        if (!selectedText) {
            // Find the current line
            const allText = textBefore + textAfter;
            const lines = allText.split('\n');
            const currentLineIndex = textBefore.split('\n').length - 1;
            const currentLine = lines[currentLineIndex] || '';

            if (this.isLineQuoted(currentLine)) {
                // Remove quote from current line
                const newLine = this.removeQuoteFromLine(currentLine);
                lines[currentLineIndex] = newLine;
                return lines.join('\n');
            } else {
                // Add quote to current line
                const newLine = this.addQuoteToLine(currentLine);
                lines[currentLineIndex] = newLine;
                return lines.join('\n');
            }
        } else {
            // Work with selected text - split into lines
            const selectedLines = selectedText.split('\n');
            const allQuoted = selectedLines.every(line => this.isLineQuoted(line));

            let processedLines;
            if (allQuoted) {
                // Remove quotes from all lines
                processedLines = selectedLines.map(line => this.removeQuoteFromLine(line));
            } else {
                // Add quotes to all lines
                processedLines = selectedLines.map(line => this.addQuoteToLine(line));
            }

            return textBefore + processedLines.join('\n') + textAfter;
        }
    }

    // Enhanced list insertion with toggle functionality
    handleListInsertion(textBefore, selectedText, textAfter, listPrefix) {
        const isOrderedList = listPrefix.includes('.');

        if (!selectedText) {
            // Find the current line
            const allText = textBefore + textAfter;
            const lines = allText.split('\n');
            const currentLineIndex = textBefore.split('\n').length - 1;
            const currentLine = lines[currentLineIndex] || '';

            if (this.isLineListItem(currentLine)) {
                // Remove list formatting from current line
                const newLine = this.removeListFromLine(currentLine);
                lines[currentLineIndex] = newLine;
                return lines.join('\n');
            } else {
                // Add list formatting to current line
                const prefix = isOrderedList ? '1. ' : listPrefix;
                const newLine = `${prefix}${currentLine}`;
                lines[currentLineIndex] = newLine;
                return lines.join('\n');
            }
        } else {
            // Work with selected text - split into lines
            const selectedLines = selectedText.split('\n');
            // Only check non-empty lines for list formatting
            const nonEmptyLines = selectedLines.filter(line => line.trim() !== '');
            const allListItems = nonEmptyLines.length > 0 && nonEmptyLines.every(line => this.isLineListItem(line));

            let processedLines;
            if (allListItems) {
                // Remove list formatting from all lines
                processedLines = selectedLines.map(line => {
                    if (line.trim() === '') return line; // Keep empty lines as they are
                    return this.removeListFromLine(line);
                });
            } else {
                // Add list formatting to all non-empty lines
                if (isOrderedList) {
                    let counter = 1;
                    processedLines = selectedLines.map(line => {
                        if (line.trim() === '') return line; // Keep empty lines as they are
                        return `${counter++}. ${line}`;
                    });
                } else {
                    processedLines = selectedLines.map(line => {
                        if (line.trim() === '') return line; // Keep empty lines as they are
                        return `${listPrefix}${line}`;
                    });
                }
            }

            return textBefore + processedLines.join('\n') + textAfter;
        }
    }

    handleToolbarAction(command, editor) {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        const textBefore = editor.value.substring(0, start);
        const textAfter = editor.value.substring(end);
        let replacement = '';
        let cursorOffset = 0;
        
        switch (command) {
            case 'bold':
                replacement = selectedText ? `**${selectedText}**` : '****';
                cursorOffset = selectedText ? 0 : -2;
                break;
            case 'italic':
                replacement = selectedText ? `*${selectedText}*` : '**';
                cursorOffset = selectedText ? 0 : -1;
                break;
            case 'code':
                replacement = selectedText ? `\`${selectedText}\`` : '``';
                cursorOffset = selectedText ? 0 : -1;
                break;
            case 'h1':
                replacement = this.handleHeadingToggle(textBefore, selectedText, textAfter, 1);
                break;
            case 'h2':
                replacement = this.handleHeadingToggle(textBefore, selectedText, textAfter, 2);
                break;
            case 'h3':
                replacement = this.handleHeadingToggle(textBefore, selectedText, textAfter, 3);
                break;
            case 'ul':
                replacement = this.handleListInsertion(textBefore, selectedText, textAfter, '- ');
                break;
            case 'ol':
                replacement = this.handleListInsertion(textBefore, selectedText, textAfter, '1. ');
                break;
            case 'quote':
                replacement = this.handleQuoteToggle(textBefore, selectedText, textAfter, start, end);
                cursorOffset = 0;
                break;
            case 'link':
                replacement = selectedText ? `[${selectedText}]()` : `[]()`;
                cursorOffset = selectedText ? -1 : -3;
                break;
            case 'image':
                // Open file picker for image upload
                this.openImagePicker(editor);
                return; // Early return - no need to process replacement
        }
        
        // Handle complex replacements for lists, quotes, and headings that return full text
        if (['ul', 'ol', 'quote', 'h1', 'h2', 'h3'].includes(command)) {
            editor.value = replacement;

            // Find the position of the affected line after replacement
            const lines = replacement.split('\n');
            const textBeforeLines = textBefore.split('\n');
            const currentLineIndex = textBeforeLines.length - 1;

            // Calculate cursor position at the end of the modified line
            let cursorPos = 0;
            for (let i = 0; i < currentLineIndex; i++) {
                cursorPos += lines[i].length + 1; // +1 for newline
            }
            if (currentLineIndex < lines.length) {
                cursorPos += lines[currentLineIndex].length;
            }

            editor.setSelectionRange(cursorPos, cursorPos);
        } else {
            // For other commands (bold, italic, code, links, images)
            editor.setRangeText(replacement, start, end, 'select');
            if (cursorOffset !== 0) {
                const newPos = start + replacement.length + cursorOffset;
                editor.setSelectionRange(newPos, newPos);
            }
        }
        
        editor.focus();
        
        // Update character counter and trigger preview update
        this.updateCharacterCounter();
        
        // Trigger input event for any listeners
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    updateCharacterCounter() {
        const editor = document.getElementById('taskDescriptionEditor');
        const counter = document.getElementById('charCount');
        if (editor && counter) {
            counter.textContent = editor.value.length;
        }
    }
    
    updateLivePreview() {
        const editor = document.getElementById('taskDescriptionEditor');
        const preview = document.getElementById('taskDescriptionPreview');
        if (editor && preview) {
            preview.innerHTML = this.convertMarkdownToHTML(editor.value);
        }
    }
    
    updateTimeProgress(task) {
        // Just delegate to the proper method that handles time-tracking-section
        this.updateTaskProgressVisualization(task);
        
        // Update task in main tasks array for persistence
        if (this.tasks) {
            const taskIndex = this.tasks.findIndex(t => t.id === task.id);
            if (taskIndex !== -1) {
                const existingTask = this.tasks[taskIndex];
                this.tasks[taskIndex] = { 
                    ...task,
                    _fileHandle: task._fileHandle || existingTask._fileHandle
                };
            }
        }
    }
    
    parseTime(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') {
            return 0;
        }
        
        const cleanStr = timeStr.toLowerCase().trim();
        if (!cleanStr) {
            return 0;
        }
        
        // Regex to match time patterns like "2w 3d 4h 30m", "2h", "30m", etc.
        const timePattern = /(\d+(?:\.\d+)?)\s*([wdhm])/g;
        let totalMinutes = 0;
        
        let match;
        while ((match = timePattern.exec(cleanStr)) !== null) {
            const value = parseFloat(match[1]);
            const unit = match[2];
            
            if (isNaN(value) || value < 0) continue;
            
            switch (unit) {
                case 'w':
                    totalMinutes += value * 40 * 60; // weeks to minutes (1w = 40h)
                    break;
                case 'd':
                    totalMinutes += value * 8 * 60; // days to minutes (1d = 8h)
                    break;
                case 'h':
                    totalMinutes += value * 60; // hours to minutes
                    break;
                case 'm':
                    totalMinutes += value; // already in minutes
                    break;
            }
        }
        
        return totalMinutes;
    }

    // Calculate time remaining based on estimate and spent
    calculateTimeRemaining(task) {
        const estimateMinutes = this.parseTime(task.timeEstimate || '0h');
        const spentMinutes = this.parseTime(task.timeSpent || '0h');
        // In Jira-style: if spent > estimate, remaining is 0
        return Math.max(0, estimateMinutes - spentMinutes);
    }

    // Get formatted time display for task cards (spent/estimate format)
    getTaskCardTimeDisplay(task) {
        const estimateHours = Math.round(this.parseTime(task.timeEstimate || '0h') / 60);
        const spentHours = Math.round(this.parseTime(task.timeSpent || '0h') / 60);
        return `${spentHours}/${estimateHours}h`;
    }

    // Get time tracking progress percentage
    getTimeTrackingProgress(task) {
        const estimateMinutes = this.parseTime(task.timeEstimate || '0h');
        const spentMinutes = this.parseTime(task.timeSpent || '0h');
        if (estimateMinutes === 0) return { percentage: 0, isOvertime: false };
        
        const percentage = (spentMinutes / estimateMinutes) * 100;
        const isOvertime = spentMinutes > estimateMinutes;
        
        return { 
            percentage: Math.min(100, percentage), 
            isOvertime: isOvertime
        };
    }

    // Update all time displays for a task
    updateAllTimeDisplays(task) {
        // Update task cards in list view
        const taskRowCard = document.querySelector(`[data-task-id="${task.id}"]`);
        if (taskRowCard) {
            const timeElement = taskRowCard.querySelector('.task-times');
            if (timeElement) {
                timeElement.textContent = this.getTaskCardTimeDisplay(task);
            }
        }

        // Update kanban cards
        const kanbanCard = document.querySelector(`.task-card[data-task-id="${task.id}"]`);
        if (kanbanCard) {
            const timeElement = kanbanCard.querySelector('.task-time');
            if (timeElement) {
                timeElement.textContent = this.getTaskCardTimeDisplay(task);
            }
        }

        // Update task detail modal if open
        this.updateTaskDetailTimeDisplays(task);
    }

    // Update time displays in task detail modal
    updateTaskDetailTimeDisplays(task) {
        // Update estimate input
        const estimateInput = document.getElementById('estimateInput');
        if (estimateInput) {
            estimateInput.value = task.timeEstimate || '0';
        }

        // Update time tracking section elements specifically
        const timeSpentDisplay = document.querySelector('.time-tracking-section .time-spent');
        const timeRemainingDisplay = document.querySelector('.time-tracking-section .time-remaining');
        const progressFill = document.querySelector('.time-tracking-section .progress-fill');

        if (timeSpentDisplay) {
            timeSpentDisplay.textContent = task.timeSpent || '0h';
        }

        if (timeRemainingDisplay) {
            const remainingMinutes = this.calculateTimeRemaining(task);
            const progressInfo = this.getTimeTrackingProgress(task);
            
            if (progressInfo.isOvertime) {
                timeRemainingDisplay.textContent = '0h remaining';
                timeRemainingDisplay.style.color = '#dc2626';
                timeRemainingDisplay.classList.add('overtime');
            } else {
                timeRemainingDisplay.textContent = `${this.formatTime(remainingMinutes)} remaining`;
                timeRemainingDisplay.style.color = '';
                timeRemainingDisplay.classList.remove('overtime');
            }
        }

        if (progressFill) {
            const progressInfo = this.getTimeTrackingProgress(task);
            progressFill.style.width = `${progressInfo.percentage}%`;
            
            // Apply red color if overtime
            if (progressInfo.isOvertime) {
                progressFill.style.backgroundColor = '#dc2626';
                progressFill.classList.add('overtime');
            } else {
                progressFill.style.backgroundColor = '';
                progressFill.classList.remove('overtime');
            }
        }
    }

    // Synchronize estimate across all UI elements
    syncEstimateAcrossUI(task) {
        if (!task) return;
        
        console.log(`🔄 Syncing estimate across UI for task ${task.id}: ${task.timeEstimate}`);
        
        // Update all estimate input fields
        const estimateInput = document.getElementById('estimateInput');
        if (estimateInput) {
            const cleanValue = (task.timeEstimate || '0').replace('h', '');
            if (estimateInput.value !== cleanValue) {
                estimateInput.value = cleanValue;
                console.log(`Updated estimateInput: ${cleanValue}`);
            }
        }
        
        const taskEstimate = document.getElementById('taskEstimate');
        if (taskEstimate) {
            const fullValue = task.timeEstimate || '0h';
            if (taskEstimate.value !== fullValue) {
                taskEstimate.value = fullValue;
                console.log(`Updated taskEstimate: ${fullValue}`);
            }
        }
        
        // Update estimate display in info section
        const estimateValue = document.querySelector('.info-item:nth-child(2) .info-value');
        if (estimateValue) {
            estimateValue.textContent = task.timeEstimate || '0';
        }
        
        // Update time tracking modal if open
        const originalEstimateElement = document.getElementById('originalEstimateValue');
        if (originalEstimateElement) {
            originalEstimateElement.textContent = task.timeEstimate || '0h';
        }
        
        // Update all task cards
        this.updateAllTimeDisplays(task);
        
        // Update progress visualization
        this.updateTaskProgressVisualization(task);
    }

    // Update task progress visualization
    updateTaskProgressVisualization(task) {
        if (!task) return;
        
        // Update progress in task detail modal time-tracking-section
        const progressFill = document.querySelector('.time-tracking-section .progress-fill');
        if (progressFill) {
            const progressInfo = this.getTimeTrackingProgress(task);
            progressFill.style.width = `${progressInfo.percentage}%`;
            
            // Apply red color if overtime
            if (progressInfo.isOvertime) {
                progressFill.style.backgroundColor = '#dc2626';
                progressFill.classList.add('overtime');
            } else {
                progressFill.style.backgroundColor = '';
                progressFill.classList.remove('overtime');
            }
        }
        
        // Update time spent display in time-tracking-section
        const timeSpentDisplay = document.querySelector('.time-tracking-section .time-spent');
        if (timeSpentDisplay) {
            timeSpentDisplay.textContent = task.timeSpent || '0h';
        }
        
        // Update time remaining display in time-tracking-section
        const timeRemainingDisplay = document.querySelector('.time-tracking-section .time-remaining');
        if (timeRemainingDisplay) {
            const remainingMinutes = this.calculateTimeRemaining(task);
            const progressInfo = this.getTimeTrackingProgress(task);
            
            if (progressInfo.isOvertime) {
                timeRemainingDisplay.textContent = '0h remaining';
                timeRemainingDisplay.style.color = '#dc2626';
                timeRemainingDisplay.classList.add('overtime');
            } else {
                timeRemainingDisplay.textContent = `${this.formatTime(remainingMinutes)} remaining`;
                timeRemainingDisplay.style.color = '';
                timeRemainingDisplay.classList.remove('overtime');
            }
        }
    }
    
    formatTime(minutes) {
        if (minutes === 0) {
            return '0h';
        }
        
        // Work-based time conversion: 1w = 40h, 1d = 8h
        const weeks = Math.floor(minutes / (40 * 60)); // 40h * 60min
        const remainingAfterWeeks = minutes % (40 * 60);
        
        const days = Math.floor(remainingAfterWeeks / (8 * 60)); // 8h * 60min  
        const remainingAfterDays = remainingAfterWeeks % (8 * 60);
        
        const hours = Math.floor(remainingAfterDays / 60);
        const mins = remainingAfterDays % 60;
        
        const parts = [];
        if (weeks > 0) parts.push(`${weeks}w`);
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (mins > 0) parts.push(`${mins}m`);
        
        return parts.length > 0 ? parts.join(' ') : '0h';
    }
    
    loadActivityFeed(task) {
        const activityFeed = document.getElementById('activityFeed');
        
        // Sample activity data - in a real app this would come from the task data
        const activities = [
            {
                user: 'John Doe',
                action: 'created this task',
                time: '2 hours ago',
                avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM4YjVjZjYiLz4KPHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI3IiB5PSI3Ij4KPHBhdGggZD0iTTEwIDEwYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIgZmlsbD0iI0ZGRiIvPgo8L3N2Zz4KPC9zdmc+'
            },
            {
                user: 'dev-mary',
                action: 'moved this task to In Progress',
                time: '1 hour ago',
                avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiMxMGI5ODEiLz4KPHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI3IiB5PSI3Ij4KPHBhdGggZD0iTTEwIDEwYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIgZmlsbD0iI0ZGRiIvPgo8L3N2Zz4KPC9zdmc+'
            }
        ];
        
        if (activityFeed) {
            activityFeed.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-avatar">
                    <img src="${activity.avatar}" alt="${activity.user}" />
                </div>
                <div class="activity-content">
                    <div class="activity-text">
                        <strong>${activity.user}</strong> ${activity.action}
                    </div>
                    <div class="activity-time">${activity.time}</div>
                </div>
            </div>
        `).join('');
        }
    }
    
    async addComment(task, comment) {
        if (!comment.trim()) return;
        
        const commentInput = document.getElementById('commentInput');
        const activityFeed = document.getElementById('activityFeed');
        
        // Get git config for user name
        const gitConfig = await this.getGitConfig();
        const userName = gitConfig.name || 'User';
        
        // Add new comment to activity feed
        const newActivity = document.createElement('div');
        newActivity.className = 'activity-item';
        newActivity.innerHTML = `
            <div class="activity-avatar">
                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM4YjVjZjYiLz4KPHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI3IiB5PSI3Ij4KPHBhdGggZD0iTTEwIDEwYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIgZmlsbD0iI0ZGRiIvPgo8L3N2Zz4KPC9zdmc+" alt="${userName}" />
            </div>
            <div class="activity-content">
                <div class="activity-text">
                    <strong>${userName}</strong> commented: "${comment}"
                </div>
                <div class="activity-time">just now</div>
            </div>
        `;
        
        activityFeed.appendChild(newActivity);
        commentInput.value = '';
        
        // Scroll to bottom of activity feed
        activityFeed.scrollTop = activityFeed.scrollHeight;
    }
    
    async handleImageUpload(file, targetEditor = null) {
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            this.showMessage('Please select an image file', 'error');
            return;
        }
        
        if (!this.currentProject) {
            this.showMessage('No project selected', 'error');
            return;
        }
        
        this.showMessage('Uploading image...', 'info');
        
        try {
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('image', file);
            
            // Upload to server
            const response = await fetch(`/api/projects/${encodeURIComponent(this.currentProject.id)}/upload-image`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showMessage('Image uploaded successfully!', 'success');
                
                // Insert markdown into the target editor
                if (targetEditor) {
                    this.insertTextAtCursor(targetEditor, result.markdown);
                } else {
                    // Default to task description editor if available
                    const descriptionEditor = document.getElementById('taskDescriptionEditor') || 
                                             document.getElementById('createTaskDescriptionEditor');
                    if (descriptionEditor) {
                        this.insertTextAtCursor(descriptionEditor, result.markdown);
                    }
                }
                
                // Auto-save the current task after image is added
                if (this.currentTask) {
                    console.log('💾 Auto-saving task after image upload...');
                    this.saveTaskChanges(this.currentTask, { closeAfterSave: false })
                        .then(() => console.log('✅ Task auto-saved after image upload'))
                        .catch(err => console.error('❌ Failed to auto-save task after image upload:', err));
                }
                
                return result;
            } else {
                this.showMessage(`Upload failed: ${result.error}`, 'error');
                return null;
            }
        } catch (error) {
            console.error('Image upload error:', error);
            this.showMessage(`Upload failed: ${error.message}`, 'error');
            return null;
        }
    }
    
    insertTextAtCursor(editor, text) {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const textBefore = editor.value.substring(0, start);
        const textAfter = editor.value.substring(end);
        
        editor.value = textBefore + text + textAfter;
        
        // Move cursor after inserted text
        const newCursorPos = start + text.length;
        editor.focus();
        editor.setSelectionRange(newCursorPos, newCursorPos);
        
        // Trigger input event for any listeners
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    setupImageDropZone(inputId, editorId) {
        const fileInput = document.getElementById(inputId);
        const editor = document.getElementById(editorId);
        
        if (!fileInput || !editor) return;
        
        // Find the drop zone (parent of file input)
        const dropZone = fileInput.closest('.image-drop-zone');
        if (!dropZone) return;
        
        // Click to select file
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });
        
        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleImageUpload(e.target.files[0], editor);
            }
        });
        
        // Drag and drop events
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            // Only remove if we're leaving the drop zone itself, not a child
            if (!dropZone.contains(e.relatedTarget)) {
                dropZone.classList.remove('drag-over');
            }
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files && files[0]) {
                this.handleImageUpload(files[0], editor);
            }
        });
    }
    
    openImagePicker(targetEditor) {
        // Create a temporary file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleImageUpload(e.target.files[0], targetEditor);
            }
            // Clean up
            document.body.removeChild(fileInput);
        });
        
        // Add to DOM and trigger click
        document.body.appendChild(fileInput);
        fileInput.click();
    }
    
    async saveTaskChanges(task, options = { closeAfterSave: true }) {
        console.log('💾 saveTaskChanges called for task:', task?.id, 'options:', options);
        
        // Collect all form data
        const taskNameInput = document.getElementById('taskNameInput');
        const descriptionEditor = document.getElementById('taskDescriptionEditor');
        const taskAssignee = document.getElementById('taskAssignee');
        const taskEstimate = document.getElementById('taskEstimate');
        const taskTimeSpent = document.getElementById('taskTimeSpent');
        const taskPriority = document.getElementById('taskPriority');
        const activeTypeBtn = document.querySelector('.type-btn.active');
        
        // Update form fields if form elements exist AND are visible (modal is open)
        const formElementsExist = taskNameInput && descriptionEditor;
        const taskDetailModal = document.getElementById('taskDetailModal');
        const modalIsOpen = taskDetailModal && 
                           taskDetailModal.style.display === 'flex';
        
        console.log('📝 saveTaskChanges modal state check:', {
            formElementsExist,
            modalExists: !!taskDetailModal,
            modalDisplay: taskDetailModal?.style.display,
            modalIsOpen,
            taskId: task?.id
        });
        
        // Only update task content from form if modal is actually open
        if (formElementsExist && modalIsOpen) {
            console.log('📝 Modal is open, updating task from form elements');
            // Update task object with form content
            if (taskNameInput.value !== undefined && taskNameInput.value !== null) {
                task.title = taskNameInput.value;
            }
            if (descriptionEditor.value !== undefined && descriptionEditor.value !== null) {
                // Extract pure markdown content without YAML frontmatter
                const pureMarkdown = this.extractMarkdownContent(descriptionEditor.value);
                task.content = pureMarkdown; // Short content for display
                task.fullContent = pureMarkdown; // Pure markdown for file saving
                console.log('📝 Extracted pure markdown, length:', pureMarkdown.length, 'original:', descriptionEditor.value.length);
            }
        } else if (formElementsExist && !modalIsOpen) {
            console.log('📝 Modal is closed, preserving existing task content during drag-and-drop');
        }
        
        // Only update other form fields if modal is open
        if (formElementsExist && modalIsOpen) {
            if (taskAssignee && taskAssignee.value !== undefined) {
                task.developer = taskAssignee.value;
                if (taskAssignee.selectedIndex >= 0) {
                    task.assignee = taskAssignee.options[taskAssignee.selectedIndex].text;
                }
            }
            
            console.log(`📝 Updated task content for ${task.id}:`, {
                title: task.title,
                contentLength: task.content ? task.content.length : 0,
                developer: task.developer
            });
        }
        // If modal is not open (e.g., drag & drop), preserve existing task data
        // Normalize time values
        const normalizeTime = (value) => {
            if (!value || value === '' || value === '0') return '0h';
            if (typeof value === 'number') return `${value}h`;
            if (value.endsWith('h')) return value;
            return `${value}h`;
        };
        
        if (formElementsExist && modalIsOpen && taskEstimate && taskTimeSpent) {
            console.log(`📊 saveTaskChanges: Task values BEFORE reading form fields:`);
            console.log(`  task.timeEstimate: "${task.timeEstimate}"`);
            console.log(`  task.timeSpent: "${task.timeSpent}"`);
            console.log(`📊 saveTaskChanges: Reading form values for task ${task.id}:`);
            console.log(`  taskEstimate.value: "${taskEstimate.value}"`);
            console.log(`  taskTimeSpent.value: "${taskTimeSpent.value}"`);
            
            task.timeEstimate = normalizeTime(taskEstimate.value);
            task.timeSpent = normalizeTime(taskTimeSpent.value);
            
            console.log(`  After normalization:`);
            console.log(`  task.timeEstimate: "${task.timeEstimate}"`);
            console.log(`  task.timeSpent: "${task.timeSpent}"`);
            
            // Also sync with estimateInput if it exists (from time tracking section)
            const estimateInput = document.getElementById('estimateInput');
            if (estimateInput && estimateInput.value) {
                const estimateInputValue = normalizeTime(estimateInput.value);
                console.log(`🔄 Syncing estimate: taskEstimate="${task.timeEstimate}" estimateInput="${estimateInputValue}"`);
                task.timeEstimate = estimateInputValue; // Use normalized value from estimateInput
            }
            
            console.log(`📊 Final task values before file save:`);
            console.log(`  task.timeEstimate: "${task.timeEstimate}"`);
            console.log(`  task.timeSpent: "${task.timeSpent}"`);
            
            const taskPrioritySelect = document.getElementById('taskPrioritySelect');
            task.priority = (taskPrioritySelect && taskPrioritySelect.value) || (taskPriority && taskPriority.value) || 'low';
        } else {
            console.log(`📊 saveTaskChanges: Form elements not available, preserving existing task data for ${task.id}`);
        }
        
        // Save status and type from dropdown if form elements exist AND modal is open
        if (formElementsExist && modalIsOpen) {
            const taskStatusSelect = document.getElementById('taskStatusSelect');
            if (taskStatusSelect && taskStatusSelect.value) {
                // Only update status if it wasn't already updated by event handler
                if (!task.status || task.status !== taskStatusSelect.value) {
                    task.status = taskStatusSelect.value;
                    task.column = taskStatusSelect.value; // Keep column in sync with status
                }
            }
            
            // Update type from active button
            if (activeTypeBtn) {
                task.type = activeTypeBtn.dataset.type;
            }
        }
        
        // Add change author information for server logging
        task.changeAuthor = 'User'; // В реальному додатку тут має бути ім'я поточного користувача
        
        // Update task in tasks array or add if new
        const taskIndex = this.tasks.findIndex(t => t.id === task.id);
        if (taskIndex !== -1) {
            // Preserve important references that might be lost during copying
            const existingTask = this.tasks[taskIndex];
            this.tasks[taskIndex] = { 
                ...task,
                _fileHandle: task._fileHandle || existingTask._fileHandle // Preserve file handle
            };
            // Synchronize all time displays for this task
            this.updateAllTimeDisplays(this.tasks[taskIndex]);
        } else if (task._isNew) {
            // Add new task to array
            delete task._isNew; // Remove the flag before adding
            task.lastModified = new Date().toISOString();
            this.tasks.push({ ...task });
            console.log('New task added to tasks array:', task.id);
            
            // Deduplicate to prevent duplicates
            this.tasks = this.deduplicateTasks(this.tasks);
        }
        
        // Try to persist the task using FileSystem loader (preferred), then server, then fallback
        try {
            // 1) File System loader instance kept in globalDataManager (preferred)
            const fsLoader = (window.globalDataManager && window.globalDataManager.fileSystemLoader)
                || window.fileSystemLoader
                || null;

            console.log(`💾 Checking file save options for task ${task.id}:`);
            console.log(`   - fsLoader exists: ${!!fsLoader}`);
            console.log(`   - updateTask function: ${!!(fsLoader && typeof fsLoader.updateTask === 'function')}`);
            console.log(`   - task._fileHandle exists: ${!!task._fileHandle}`);
            console.log(`   - globalDataManager exists: ${!!window.globalDataManager}`);
            console.log(`   - globalDataManager.updateTask exists: ${!!(window.globalDataManager && typeof window.globalDataManager.updateTask === 'function')}`);
            console.log(`   - loadingMode:`, window.globalDataManager?.loadingMode);
            console.log(`   - directoryHandle exists:`, !!window.globalDataManager?.directoryHandle);
            
            if (fsLoader && typeof fsLoader.updateTask === 'function' && task._fileHandle) {
                console.log(`💾 Saving to file system using FS loader...`);
                console.log(`  Task data being saved:`, {
                    id: task.id,
                    timeEstimate: task.timeEstimate,
                    timeSpent: task.timeSpent,
                    fileHandle: task._fileHandle ? 'exists' : 'missing'
                });
                await fsLoader.updateTask(this.currentProject.id, task);
                console.log('✅ Task saved to file system (FS loader)');
            } else if (window.globalDataManager && typeof window.globalDataManager.updateTask === 'function') {
                // 2) Server/local manager update
                console.log(`💾 Using globalDataManager.updateTask, mode: ${window.globalDataManager.loadingMode}`);
                console.log(`  Task data being saved:`, {
                    id: task.id,
                    timeEstimate: task.timeEstimate,
                    timeSpent: task.timeSpent
                });
                await window.globalDataManager.updateTask(this.currentProject.id, task);
                console.log('✅ Task saved via globalDataManager.updateTask');
            } else {
                // 3) Try direct API call to server
                try {
                    console.log('💾 Trying direct API save for task:', task.id);
                    const response = await fetch(`/api/projects/${encodeURIComponent(this.currentProject.id)}/tasks/${encodeURIComponent(task.id)}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            ...task,
                            lastModified: new Date().toISOString()
                        })
                    });
                    
                    if (response.ok) {
                        console.log('✅ Task saved via direct API call');
                    } else {
                        throw new Error(`API returned ${response.status}: ${response.statusText}`);
                    }
                } catch (apiError) {
                    console.warn('⚠️ Direct API save failed:', apiError.message);
                    
                    // 4) Final fallback to localStorage cache (guaranteed)
                    const key = `fira:tasks:${this.currentProject ? this.currentProject.id : 'default'}`;
                    const payload = {
                        tasks: this.tasks,
                        savedAt: new Date().toISOString()
                    };
                    localStorage.setItem(key, JSON.stringify(payload));
                    console.warn('Task persisted to localStorage fallback:', key);
                }
            }
        } catch (error) {
            console.error('Failed to persist task:', error);
            this.showMessage('Task updated locally but failed to persist to disk/server', 'warning');
            // Do not return here — allow UI update to continue (changes are in memory)
        }
        
        // Update the task in memory first
        console.log(`🔄 saveTaskUpdates: Updating task ${task.id} in memory`);
        console.log(`📊 Current tasks array length: ${this.tasks.length}`);
        
        // taskIndex вже оголошено вище, просто використовуємо його
        if (taskIndex !== -1) {
            // Preserve _fileHandle from original task
            const originalTask = this.tasks[taskIndex];
            if (originalTask._fileHandle && !task._fileHandle) {
                console.log(`🔗 Preserving _fileHandle for task ${task.id}`);
                task._fileHandle = originalTask._fileHandle;
            }
            
            // Add lastModified timestamp for deduplication
            task.lastModified = new Date().toISOString();
            console.log(`✏️ Updating existing task at index ${taskIndex}`);
            const existingTask = this.tasks[taskIndex];
            this.tasks[taskIndex] = { 
                ...task,
                _fileHandle: task._fileHandle || existingTask._fileHandle
            };
        } else {
            console.log(`⚠️ Task ${task.id} not found in tasks array, adding it`);
            task.lastModified = new Date().toISOString();
            this.tasks.push({ ...task });
        }
        
        console.log(`📊 Tasks array length after update: ${this.tasks.length}`);
        this.checkForDuplicates('after saveTaskUpdates update');
        
        // Deduplicate to ensure no duplicates after update
        this.tasks = this.deduplicateTasks(this.tasks);
        this.checkForDuplicates('after saveTaskUpdates deduplication');
        
        // Re-render the board to reflect changes (unless caller disabled it)
        if (!options.skipRerender) {
            console.log(`🎨 About to re-render board after task update`);
            this.checkForDuplicates('before final render in saveTaskUpdates'); 
            this.filterAndRenderTasks();
        } else {
            console.log(`🎨 Skipping board re-render as requested by caller`);
        }
        
        // Show success message (unless caller disabled it)
        if (!options.skipSuccessMessage) {
            this.showMessage('Task updated successfully', 'success');
        }

        // Close modal only if caller requested it
        if (options && options.closeAfterSave) {
            closeTaskModal();
        }
    }

    async saveTasksToDisk() {
        // Save tasks to server or localStorage
        // This method is called by the back button and other places
        try {
            // Try to save via globalDataManager if available
            if (window.globalDataManager && typeof window.globalDataManager.saveData === 'function') {
                await window.globalDataManager.saveData();
                console.log('✅ Tasks saved via globalDataManager');
                return true;
            }

            // Fallback: save to localStorage
            const payload = {
                project: this.currentProject,
                tasks: this.tasks
            };
            const key = 'fira:tasks:' + (this.currentProject ? (this.currentProject.name || this.currentProject.id) : 'default');
            localStorage.setItem(key, JSON.stringify(payload, null, 2));
            console.log('✅ Tasks saved to localStorage as fallback');
            return true;
        } catch (err) {
            console.error('❌ saveTasksToDisk failed:', err);
            return false;
        }
    }

    // List View Methods
    setupListViewEventListeners() {
        // Table sorting
        document.addEventListener('click', (e) => {
            if (e.target.closest('.sortable')) {
                const th = e.target.closest('.sortable');
                const column = th.dataset.column;
                this.handleSort(column);
            }
        });

        // Removed pagination - now using infinite scroll
    }

    setupColumnSortEventListeners() {
        // Column header sorting for kanban view
        document.addEventListener('click', (e) => {
            const columnHeader = e.target.closest('.figma-column-header');
            if (columnHeader) {
                const columnName = columnHeader.getAttribute('data-column-name');
                this.handleColumnSort(columnName);
            }
        });
    }

    handleColumnSort(columnName) {
        console.log('🔄 Column sort clicked:', columnName);

        // Get all column headers
        const headers = document.querySelectorAll('.figma-column-header');

        // Find the clicked header
        const clickedHeader = document.querySelector(`[data-column-name="${columnName}"]`);
        if (!clickedHeader) return;

        // Determine sort direction
        let sortDirection = 'asc';
        const currentSort = this.columnSortStates[columnName];
        if (currentSort && currentSort.direction === 'asc') {
            sortDirection = 'desc';
        }

        // Clear all other headers' sort states
        headers.forEach(header => {
            header.removeAttribute('data-sort');
        });

        // Clear all other column sort states
        this.columnSortStates = {};

        // Set the sort direction on clicked header and in state
        clickedHeader.setAttribute('data-sort', sortDirection);
        this.columnSortStates[columnName] = { direction: sortDirection };

        // Re-render the board to apply sorting
        this.renderBoard();

        console.log(`✅ Column ${columnName} sorted ${sortDirection}`);
    }

    sortTasksByTitle(tasks, direction) {
        return tasks.sort((a, b) => {
            const titleA = (a.title || '').trim();
            const titleB = (b.title || '').trim();

            if (direction === 'asc') {
                return titleA.localeCompare(titleB);
            } else {
                return titleB.localeCompare(titleA);
            }
        });
    }

    restoreColumnSortIndicators() {
        // Restore visual indicators for sorted columns after re-render
        Object.keys(this.columnSortStates).forEach(columnName => {
            const sortState = this.columnSortStates[columnName];
            const header = document.querySelector(`[data-column-name="${columnName}"]`);
            if (header && sortState) {
                header.setAttribute('data-sort', sortState.direction);
                console.log(`🔄 Restored ${sortState.direction} indicator for ${columnName}`);
            }
        });
    }

    setupTimeTrackingClickHandler() {
        // Remove any existing time tracking click handler to prevent duplicates
        if (this.timeTrackingClickHandler) {
            document.removeEventListener('click', this.timeTrackingClickHandler);
        }
        
        // Create the click handler function
        this.timeTrackingClickHandler = (e) => {
            const timeTrackingSection = e.target.closest('.time-tracking-section');
            if (timeTrackingSection) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Time tracking section clicked');
                
                // Check if we have a current task (either in edit mode or create mode)
                if (this.currentTask) {
                    console.log('Opening time tracking modal for task:', this.currentTask);
                    
                    // Get fresh task data from form inputs to include any changes
                    const taskEstimate = document.getElementById('taskEstimate');
                    const taskTimeSpent = document.getElementById('taskTimeSpent');
                    const estimateInput = document.getElementById('estimateInput');
                    
                    console.log('🔍 DEBUGGING FORM FIELD VALUES:');
                    console.log('  taskEstimate element:', taskEstimate);
                    console.log('  taskEstimate.value:', taskEstimate?.value);
                    console.log('  taskTimeSpent element:', taskTimeSpent);
                    console.log('  taskTimeSpent.value:', taskTimeSpent?.value);
                    console.log('  estimateInput element:', estimateInput);
                    console.log('  estimateInput.value:', estimateInput?.value);
                    console.log('  currentTask BEFORE update:', {
                        timeEstimate: this.currentTask.timeEstimate,
                        timeSpent: this.currentTask.timeSpent,
                        id: this.currentTask.id
                    });
                    
                    // Create fresh copy of task with current UI values
                    const freshTask = { 
                        ...this.currentTask,
                        _fileHandle: this.currentTask._fileHandle // Preserve file handle
                    };
                    
                    // ALWAYS get the most current values from form fields, regardless of what's in currentTask
                    // Priority: 1) estimateInput, 2) taskEstimate, 3) existing values
                    
                    // Handle estimate
                    let estimateFound = false;
                    if (estimateInput && estimateInput.value && estimateInput.value.trim() !== '') {
                        const estimateValue = estimateInput.value.trim();
                        freshTask.timeEstimate = estimateValue.endsWith('h') ? estimateValue : estimateValue + 'h';
                        console.log('✅ Updated timeEstimate from estimateInput:', freshTask.timeEstimate);
                        estimateFound = true;
                    } else if (taskEstimate && taskEstimate.value && taskEstimate.value.trim() !== '') {
                        freshTask.timeEstimate = taskEstimate.value.trim();
                        console.log('✅ Updated timeEstimate from taskEstimate:', freshTask.timeEstimate);
                        estimateFound = true;
                    }
                    
                    if (!estimateFound) {
                        console.log('⚠️ No estimate value found in form fields, keeping existing:', freshTask.timeEstimate);
                    }
                    
                    // Handle time spent
                    let timeSpentFound = false;
                    if (taskTimeSpent && taskTimeSpent.value && taskTimeSpent.value.trim() !== '') {
                        freshTask.timeSpent = taskTimeSpent.value.trim();
                        console.log('✅ Updated timeSpent from taskTimeSpent:', freshTask.timeSpent);
                        timeSpentFound = true;
                    } else {
                        // If no value in form, default to 0h
                        freshTask.timeSpent = '0h';
                        console.log('✅ Defaulted timeSpent to 0h (form field empty or null)');
                        timeSpentFound = true;
                    }
                    
                    if (!timeSpentFound) {
                        console.log('⚠️ No timeSpent value found, keeping existing:', freshTask.timeSpent);
                    }
                    
                    // Update the current task reference
                    this.currentTask = freshTask;
                    
                    console.log('🎯 FRESH TASK DATA for time tracking modal:');
                    console.log('  freshTask.timeEstimate:', freshTask.timeEstimate);
                    console.log('  freshTask.timeSpent:', freshTask.timeSpent);
                    console.log('  freshTask.id:', freshTask.id);
                    console.log('  this.currentTask AFTER update:', {
                        timeEstimate: this.currentTask.timeEstimate,
                        timeSpent: this.currentTask.timeSpent,
                        id: this.currentTask.id
                    });
                    
                    // Directly show the modal
                    const timeModal = document.getElementById('timeTrackingModal');
                    if (timeModal) {
                        timeModal.style.display = 'flex';
                        console.log('Time tracking modal opened');
                        
                        // Initialize time tracking manager if needed (singleton pattern)
                        if (!window.timeTrackingManager) {
                            window.timeTrackingManager = new TimeTrackingManager();
                        }
                        window.timeTrackingManager.openModal(freshTask);
                    } else {
                        console.error('timeTrackingModal element not found');
                    }
                } else {
                    console.error('No current task found');
                    console.log('this.currentTask:', this.currentTask);
                }
            }
        };
        
        // Add the event listener with our stored function reference
        document.addEventListener('click', this.timeTrackingClickHandler);
    }

    renderListView() {
        if (this.currentView !== 'list') return;
        
        // Sort tasks
        let sortedTasks = [...this.filteredTasks];
        
        if (this.sortColumn) {
            sortedTasks = this.sortTasks(sortedTasks, this.sortColumn, this.sortDirection);
        }
        
        // Show only the displayed number of tasks
        const tasksToShow = sortedTasks.slice(0, this.displayedTasks);
        
        // Render table
        this.renderTable(tasksToShow);
        this.updateTaskCount(sortedTasks.length, tasksToShow.length);
        this.updateSortIcons();
        
        // Setup infinite scroll
        this.setupInfiniteScroll(sortedTasks);
    }

    renderTable(tasks) {
        const rowsContainer = document.getElementById('tasksRowsContainer');
        
        if (tasks.length === 0) {
            rowsContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
                    No tasks found matching your criteria
                </div>
            `;
            return;
        }
        
        rowsContainer.innerHTML = tasks.map(task => {
            const statusClass = task.column === 'progress' ? 'progress' : task.column;
            const assigneeName = task.assignee || 'John';
            const assigneeClass = task.assignee ? '' : 'unassigned';
            
            return `
                <div class="task-row-card" data-task-id="${task.id}">
                    <div class="task-row-content">
                        <div class="task-key">${task.id}</div>
                        <div class="task-times">${this.getTaskCardTimeDisplay(task)}</div>
                        <a href="#" class="task-name-link" data-task-id="${task.id}" title="${task.title}">
                            ${task.title || 'Task name name name name name name name name name...'}
                        </a>
                        <div class="status-badge ${statusClass}">${statusClass.toUpperCase()}</div>
                        <div class="assignee-name ${assigneeClass}">${assigneeName}</div>
                        <div class="priority-badge ${task.priority || 'medium'}">${(task.priority || 'medium').toUpperCase()}</div>
                        
                        <!-- Separator lines -->
                        <div class="task-row-separator sep-1"></div>
                        <div class="task-row-separator sep-2"></div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click event listeners to task name links
        rowsContainer.querySelectorAll('.task-name-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const taskId = link.dataset.taskId;
                const task = this.tasks.find(t => t.id === taskId);
                if (task) {
                    this.openTaskDetail(task);
                }
            });
        });
        
        // Add click event listeners to task row cards
        rowsContainer.querySelectorAll('.task-row-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on the task name link
                if (e.target.classList.contains('task-name-link')) return;
                
                const taskId = card.dataset.taskId;
                const task = this.tasks.find(t => t.id === taskId);
                if (task) {
                    this.openTaskDetail(task);
                }
            });
        });
    }

    sortTasks(tasks, column, direction) {
        return tasks.sort((a, b) => {
            let aValue, bValue;
            
            switch (column) {
                case 'id':
                    aValue = a.id;
                    bValue = b.id;
                    break;
                case 'time':
                    aValue = this.parseTime(a.timeSpent || '0h');
                    bValue = this.parseTime(b.timeSpent || '0h');
                    break;
                case 'title':
                    aValue = a.title.toLowerCase();
                    bValue = b.title.toLowerCase();
                    break;
                case 'status':
                    aValue = a.column;
                    bValue = b.column;
                    break;
                case 'assignee':
                    aValue = (a.assignee || 'Unassigned').toLowerCase();
                    bValue = (b.assignee || 'Unassigned').toLowerCase();
                    break;
                case 'priority':
                    const priorityOrder = { 'low': 1, 'medium': 2, 'high': 3 };
                    aValue = priorityOrder[a.priority] || 0;
                    bValue = priorityOrder[b.priority] || 0;
                    break;
                default:
                    aValue = a[column];
                    bValue = b[column];
            }
            
            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    handleSort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        this.renderListView();
    }

    updateSortIcons() {
        // Clear all sort classes
        document.querySelectorAll('.tasks-table th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });
        
        // Add sort class to active column
        if (this.sortColumn) {
            const activeHeader = document.querySelector(`[data-column="${this.sortColumn}"]`);
            if (activeHeader) {
                activeHeader.classList.add(`sort-${this.sortDirection}`);
            }
        }
    }

    updateTaskCount(totalTasks, displayedTasks) {
        const taskCountElement = document.getElementById('taskCount');
        if (taskCountElement) {
            if (displayedTasks < totalTasks) {
                taskCountElement.textContent = `Showing ${displayedTasks} of ${totalTasks} tasks`;
            } else {
                taskCountElement.textContent = `${totalTasks} tasks`;
            }
        }
    }

    setupInfiniteScroll(sortedTasks) {
        const listContainer = document.getElementById('listView');
        if (!listContainer) return;
        
        // Remove existing scroll listener
        if (this.scrollHandler) {
            listContainer.removeEventListener('scroll', this.scrollHandler);
        }
        
        // Create new scroll handler
        this.scrollHandler = () => {
            const scrollTop = listContainer.scrollTop;
            const scrollHeight = listContainer.scrollHeight;
            const clientHeight = listContainer.clientHeight;
            
            // Load more when scrolled 80% down
            if (scrollTop + clientHeight >= scrollHeight * 0.8) {
                this.loadMoreTasks(sortedTasks);
            }
        };
        
        listContainer.addEventListener('scroll', this.scrollHandler);
    }

    loadMoreTasks(sortedTasks) {
        const newDisplayCount = this.displayedTasks + this.loadIncrement;
        
        // Don't load more than available
        if (this.displayedTasks >= sortedTasks.length) {
            return;
        }
        
        this.displayedTasks = Math.min(newDisplayCount, sortedTasks.length);
        
        // Re-render with more tasks
        const tasksToShow = sortedTasks.slice(0, this.displayedTasks);
        this.renderTable(tasksToShow);
        this.updateTaskCount(sortedTasks.length, this.displayedTasks);
    }

    openDateRangePicker() {
        // Simple date range picker - in a real app you'd use a proper date picker library
        const currentDate = new Date();
        const startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - 7);
        
        const formatDate = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            return `${day}.${month}`;
        };
        
        const dateRange = `${formatDate(startDate)}-${formatDate(currentDate)}`;
        document.getElementById('dateRangeFilter').value = dateRange;
        this.dateRange = dateRange;
        
        // For now, just set the date range without actual filtering
        this.showMessage('Date range filtering functionality would be implemented here', 'info');
    }

    openCreateTaskModal() {
        const modal = document.getElementById('createTaskModal');
        
        // Generate next task ID
        const nextTaskId = this.generateNextTaskId();
        document.getElementById('newTaskId').value = nextTaskId;
        
        // Reset form
        const form = document.getElementById('createTaskForm');
        form.reset();
        document.getElementById('newTaskId').value = nextTaskId; // Restore after reset
        document.getElementById('newTaskEstimate').value = '2h'; // Set default
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Focus on title input
        setTimeout(() => {
            document.getElementById('newTaskTitle').focus();
        }, 100);
    }

    generateNextTaskId() {
        if (!this.currentProject || !this.currentProject.id) {
            return 'TASK-001';
        }
        
        // Get project ID (should be uppercase, e.g., "KSP")
        const projectId = this.currentProject.id.toUpperCase();
        
        // Find existing tasks with this project prefix
        const projectTasks = this.tasks.filter(task => 
            task.id && task.id.startsWith(projectId + '-')
        );
        
        // Extract numbers from existing task IDs
        const existingNumbers = projectTasks
            .map(task => {
                const match = task.id.match(new RegExp(`^${projectId}-(\\d+)`));
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(num => !isNaN(num));
        
        // Find next available number
        const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
        const nextNumber = maxNumber + 1;
        
        // Format with leading zeros
        const formattedNumber = nextNumber.toString().padStart(3, '0');
        
        return `${projectId}-${formattedNumber}`;
    }

    async handleCreateTask(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('createTaskSubmitBtn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        try {
            // Show loading state
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
            
            // Get form data
            const formData = new FormData(e.target);
            const taskData = {
                id: formData.get('taskId'),
                title: formData.get('taskTitle').trim(),
                column: formData.get('taskColumn'),
                assignee: formData.get('taskAssignee') || 'Unassigned',
                priority: formData.get('taskPriority'),
                timeEstimate: formData.get('taskEstimate') || '2h',
                timeSpent: '0h',
                developer: formData.get('taskAssignee') || null,
                content: formData.get('taskDescription') || 'No description provided.',
                fullContent: formData.get('taskDescription') || 'No description provided.',
                created: new Date().toISOString(),
                projectId: this.currentProject.id
            };
            
            // Validate required fields
            if (!taskData.title) {
                this.showMessage('Task title is required', 'error');
                return;
            }
            
            // Add task to local tasks array with timestamp
            taskData.lastModified = new Date().toISOString();
            this.tasks.push(taskData);
            
            // Deduplicate to prevent duplicates
            this.tasks = this.deduplicateTasks(this.tasks);
            
            // Update UI
            this.filterAndRenderTasks();
            
            // Close modal
            closeCreateTaskModal();
            
            // Reset form
            document.getElementById('createTaskForm').reset();
            
            this.showMessage(`Task ${taskData.id} created successfully!`, 'success');
            
            // Try to persist to server/filesystem
            try {
                await this.saveTasksToDisk();
                console.log('New task persisted successfully');
            } catch (saveError) {
                console.warn('Failed to persist new task:', saveError);
                this.showMessage('Task created locally but failed to save to disk', 'warning');
            }
            
        } catch (error) {
            console.error('Error creating task:', error);
            this.showMessage('Failed to create task: ' + error.message, 'error');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            btnText.style.display = 'block';
            btnLoading.style.display = 'none';
        }
    }

    extractMarkdownContent(content) {
        // Extract pure markdown content without YAML frontmatter
        if (!content) return '';
        
        if (content.startsWith('---')) {
            const parts = content.split('---', 3);
            if (parts.length >= 3) {
                const markdown = parts[2] || '';
                console.log('🔍 Extracted markdown from YAML content, length:', markdown.length);
                return markdown.trim(); // Remove leading/trailing whitespace
            }
        }
        
        // No YAML frontmatter found, return original content
        console.log('🔍 No YAML frontmatter found, using original content');
        return content;
    }

    convertMarkdownToHTML(markdown) {
        // Remove YAML frontmatter block
        let cleanMarkdown = markdown;
        if (markdown.startsWith('---')) {
            const endIndex = markdown.indexOf('\n---\n', 3);
            if (endIndex !== -1) {
                cleanMarkdown = markdown.substring(endIndex + 5);
            }
        }

        // Simple markdown to HTML converter for basic formatting
        let html = cleanMarkdown
            // Headers
            .replace(/^### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^## (.+)$/gm, '<h3>$1</h3>')
            .replace(/^# (.+)$/gm, '<h2>$1</h2>')
            // Images - must be processed before links
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; margin: 8px 0; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #8b5cf6; text-decoration: none;">$1</a>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Italic  
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Code
            .replace(/`([^`]+)`/g, '<code style="background: #f3f4f6; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em;">$1</code>')
            // Quotes
            .replace(/^> (.+)$/gm, '<blockquote style="border-left: 4px solid #8b5cf6; margin: 8px 0; padding: 8px 16px; background: #f8fafc; font-style: italic; color: #475569;">$1</blockquote>')
            // Lists
            .replace(/^- \[ \] (.+)$/gm, '<div style="margin: 4px 0;"><input type="checkbox" disabled style="margin-right: 8px;">$1</div>')
            .replace(/^- \[x\] (.+)$/gm, '<div style="margin: 4px 0;"><input type="checkbox" checked disabled style="margin-right: 8px;">$1</div>')
            .replace(/^- (.+)$/gm, '<div style="margin: 4px 0; margin-left: 16px;">• $1</div>')
            // Internal links (wiki-style)
            .replace(/\[\[([^\]]+)\]\]/g, '<span style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 12px;">$1</span>')
            // Line breaks
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
            
        return html;
    }


    async openEditProjectModal() {
        if (!this.currentProject) {
            this.showMessage('No project selected', 'error');
            return;
        }

        // Get full project data from available sources
        let projectData = { ...this.currentProject };
        
        // First, try to get from global data manager
        if (window.globalDataManager && window.globalDataManager.getProjects) {
            const fullProject = window.globalDataManager.getProjects().find(p => p.id === this.currentProject.id);
            if (fullProject) {
                projectData = { ...projectData, ...fullProject };
                console.log('✅ Found project in globalDataManager:', projectData);
            }
        }
        
        // Try to load fresh project data from server if available and description is missing/invalid
        if ((!projectData.description || projectData.description === projectData.id) && 
            window.globalDataManager && 
            window.globalDataManager.apiClient && 
            window.globalDataManager.loadingMode === 'server') {
            try {
                console.log('🔄 Loading fresh project data from server...');
                const serverProjects = await window.globalDataManager.apiClient.getProjects();
                const serverProject = serverProjects.find(p => p.id === this.currentProject.id);
                if (serverProject && serverProject.description && serverProject.description !== serverProject.id) {
                    projectData = { ...projectData, ...serverProject };
                    // Also update the current project in memory
                    this.currentProject = { ...this.currentProject, description: serverProject.description };
                    console.log('✅ Loaded and updated fresh project data from server:', serverProject);
                }
            } catch (error) {
                console.warn('⚠️ Failed to load fresh project data from server:', error);
            }
        }
        
        // Fallback to static PROJECTS_DATA if description is still missing/invalid
        if ((!projectData.description || projectData.description === projectData.id) && window.PROJECTS_DATA) {
            const staticProject = window.PROJECTS_DATA.find(p => p.id === this.currentProject.id);
            if (staticProject && staticProject.description && staticProject.description !== staticProject.id) {
                projectData = { ...projectData, ...staticProject };
                console.log('✅ Enhanced project data with static data:', staticProject);
            }
        }
        
        // If still no valid description, set empty string to avoid showing project ID
        if (!projectData.description || projectData.description === projectData.id) {
            projectData.description = '';
            console.log('⚠️ Set empty description to avoid showing project ID');
        }
        
        // Ensure name is not the project ID
        if (!projectData.name || projectData.name === projectData.id) {
            if (window.PROJECTS_DATA) {
                const staticProject = window.PROJECTS_DATA.find(p => p.id === this.currentProject.id);
                if (staticProject && staticProject.name) {
                    projectData.name = staticProject.name;
                    console.log('✅ Fixed project name from static data:', projectData.name);
                }
            }
        }

        const modal = document.getElementById('editProjectModal');
        const nameInput = document.getElementById('editProjectName');
        const descriptionTextarea = document.getElementById('editProjectDescription');
        const charCountElement = document.getElementById('editDescriptionCharCount');
        
        // Pre-populate form with project data
        nameInput.value = projectData.name || '';
        descriptionTextarea.value = projectData.description || '';
        charCountElement.textContent = (projectData.description || '').length;
        
        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Setup form handlers
        this.setupEditProjectFormHandlers();
        
        // Focus on name input
        setTimeout(() => {
            nameInput.focus();
            nameInput.select();
        }, 100);
    }

    openAddDeveloperModal() {
        const modal = document.getElementById('addDeveloperModal');
        const nameInput = document.getElementById('developerName');
        
        if (!modal || !nameInput) {
            console.error('Add developer modal elements not found');
            return;
        }

        // Clear previous input
        nameInput.value = '';
        
        // Setup form handlers
        this.setupAddDeveloperFormHandlers();
        
        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Focus on name input
        setTimeout(() => {
            nameInput.focus();
        }, 100);
    }

    setupAddDeveloperFormHandlers() {
        const form = document.getElementById('addDeveloperForm');
        
        if (!form) {
            console.error('Add developer form not found');
            return;
        }
        
        // Remove existing listeners by replacing the form with a clone
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        // Add fresh form submission handler
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAddDeveloper();
        });
    }

    async handleAddDeveloper() {
        // Prevent multiple concurrent calls
        if (this.isAddingDeveloper) {
            console.log('🔄 Developer addition already in progress, ignoring duplicate call');
            return;
        }
        
        this.isAddingDeveloper = true;
        
        const nameInput = document.getElementById('developerName');
        const errorElement = document.getElementById('developerNameError');
        const saveBtn = document.getElementById('addDeveloperSaveBtn');
        
        // Disable the save button to prevent multiple clicks
        if (saveBtn) {
            saveBtn.disabled = true;
            const btnText = saveBtn.querySelector('.btn-text');
            const btnLoading = saveBtn.querySelector('.btn-loading');
            if (btnText) btnText.style.display = 'none';
            if (btnLoading) btnLoading.style.display = 'flex';
        }
        
        const developerName = nameInput.value.trim();
        
        // Validate input
        if (!developerName) {
            errorElement.textContent = 'Developer name is required';
            nameInput.focus();
            this.isAddingDeveloper = false;
            if (saveBtn) {
                saveBtn.disabled = false;
                const btnText = saveBtn.querySelector('.btn-text');
                const btnLoading = saveBtn.querySelector('.btn-loading');
                if (btnText) btnText.style.display = 'inline';
                if (btnLoading) btnLoading.style.display = 'none';
            }
            return;
        }
        
        if (developerName.length < 2) {
            errorElement.textContent = 'Developer name must be at least 2 characters';
            nameInput.focus();
            this.isAddingDeveloper = false;
            if (saveBtn) {
                saveBtn.disabled = false;
                const btnText = saveBtn.querySelector('.btn-text');
                const btnLoading = saveBtn.querySelector('.btn-loading');
                if (btnText) btnText.style.display = 'inline';
                if (btnLoading) btnLoading.style.display = 'none';
            }
            return;
        }
        
        // Clear error
        errorElement.textContent = '';
        
        try {
            
            // Create developer ID from name (lowercase, spaces to hyphens)
            const developerId = 'dev-' + developerName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            
            // Check if developer already exists
            if (this.isDeveloperExists(developerId)) {
                errorElement.textContent = 'A developer with this name already exists';
                nameInput.focus();
                this.isAddingDeveloper = false;
                if (saveBtn) {
                    saveBtn.disabled = false;
                    const btnText = saveBtn.querySelector('.btn-text');
                    const btnLoading = saveBtn.querySelector('.btn-loading');
                    if (btnText) btnText.style.display = 'inline';
                    if (btnLoading) btnLoading.style.display = 'none';
                }
                return;
            }
            
            // Add developer to project
            await this.addDeveloperToProject(developerId, developerName);

            // Add developer to local state immediately to ensure it appears in dropdowns
            this.addDeveloperLocally(developerId, developerName);

            // Instead of full refresh, just clear the developers cache so the dropdown will be updated
            if (window.globalDataManager) {
                // Clear only the developers cache for this project
                if (window.globalDataManager.projectDevelopers && window.globalDataManager.projectDevelopers[this.currentProject.id]) {
                    delete window.globalDataManager.projectDevelopers[this.currentProject.id];
                    console.log('🗑️ Cleared developers cache for project:', this.currentProject.id);
                }
            }

            // Update developer dropdown (used for filtering)
            this.updateDeveloperDropdown();

            // Update assignee dropdown for task assignment (force refresh to get latest)
            await this.updateAssigneeDropdown('Unassigned', true);

            // Close modal
            this.closeAddDeveloperModal();
            
            // Show success message
            this.showMessage(`Developer "${developerName}" added successfully!`, 'success');
            
        } catch (error) {
            console.error('Error adding developer:', error);
            errorElement.textContent = 'Failed to add developer. Please try again.';
        } finally {
            // Reset the flag and restore button state
            this.isAddingDeveloper = false;
            
            if (saveBtn) {
                saveBtn.disabled = false;
                const btnText = saveBtn.querySelector('.btn-text');
                const btnLoading = saveBtn.querySelector('.btn-loading');
                if (btnText) btnText.style.display = 'inline';
                if (btnLoading) btnLoading.style.display = 'none';
            }
        }
    }

    isDeveloperExists(developerId) {
        // Check in current task developers
        const developers = new Set();
        this.tasks.forEach(task => {
            if (task.developer) developers.add(task.developer);
            if (task.assignee) developers.add(task.assignee);
        });
        
        return developers.has(developerId);
    }

    async addDeveloperToProject(developerId, developerName) {
        // Create a basic task structure in the new developer's folder
        // This ensures the developer appears in the project structure
        
        if (window.globalDataManager) {
            try {
                // Try to use global data manager to create developer folder
                await window.globalDataManager.addDeveloperToProject(this.currentProject.id, developerId, developerName);
            } catch (error) {
                console.warn('Could not use globalDataManager, adding developer locally:', error);
                // Fallback: just add to local state
                this.addDeveloperLocally(developerId, developerName);
            }
        } else {
            // Fallback: add to local state
            this.addDeveloperLocally(developerId, developerName);
        }
    }

    addDeveloperLocally(developerId, developerName) {
        // Add developer info to a local developers list if needed
        // This is a fallback for when filesystem operations aren't available

        // Add to current project's developers array
        if (this.currentProject) {
            if (!this.currentProject.developers) {
                this.currentProject.developers = [];
            }
            if (!this.currentProject.developers.includes(developerId)) {
                this.currentProject.developers.push(developerId);
                console.log(`Added developer locally: ${developerName} (${developerId})`);
            }
        }

        // Also add to globalDataManager cache if available
        if (window.globalDataManager && window.globalDataManager.projectDevelopers && this.currentProject) {
            const projectId = this.currentProject.id;
            if (!window.globalDataManager.projectDevelopers[projectId]) {
                window.globalDataManager.projectDevelopers[projectId] = [];
            }
            if (!window.globalDataManager.projectDevelopers[projectId].includes(developerId)) {
                window.globalDataManager.projectDevelopers[projectId].push(developerId);
            }
        }
    }

    closeAddDeveloperModal() {
        const modal = document.getElementById('addDeveloperModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    setupEditProjectFormHandlers() {
        const form = document.getElementById('editProjectForm');
        const descriptionTextarea = document.getElementById('editProjectDescription');
        const charCountElement = document.getElementById('editDescriptionCharCount');
        
        // Character counter for description
        descriptionTextarea.addEventListener('input', () => {
            const length = descriptionTextarea.value.length;
            charCountElement.textContent = length;
            
            if (length > 950) {
                charCountElement.style.color = '#dc2626';
            } else {
                charCountElement.style.color = '#9ca3af';
            }
        });
        
        // Form submission handler
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveEditedProject();
        });
    }

    async saveEditedProject() {
        const nameInput = document.getElementById('editProjectName');
        const descriptionTextarea = document.getElementById('editProjectDescription');
        const saveBtn = document.getElementById('saveProjectBtn');
        const btnText = saveBtn.querySelector('.btn-text');
        const btnLoading = saveBtn.querySelector('.btn-loading');
        
        const updatedData = {
            id: this.currentProject.id,
            name: nameInput.value.trim(),
            description: descriptionTextarea.value.trim()
        };
        
        // Validate input
        if (!updatedData.name) {
            this.showMessage('Project name is required', 'error');
            nameInput.focus();
            return;
        }
        
        try {
            console.log('🚀 Starting project update process...');
            console.log('📋 Project data to update:', updatedData);
            console.log('🔍 Current project:', this.currentProject);
            
            // Show loading state
            saveBtn.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
            
            // Update project using global data manager if available
            if (window.globalDataManager) {
                console.log('✅ Using globalDataManager to save project');
                console.log('📊 Loading mode:', window.globalDataManager.loadingMode);
                console.log('📁 Directory handle:', !!window.globalDataManager.directoryHandle);
                
                // Direct call to saveProjectToFileSystem to ensure README.md is updated
                if ((window.globalDataManager.loadingMode === 'directory-picker' || window.globalDataManager.loadingMode === 'directory-refreshed') && window.globalDataManager.directoryHandle) {
                    console.log('💾 Saving directly to README.md file...');
                    await window.globalDataManager.saveProjectToFileSystem(this.currentProject.id, updatedData);
                    console.log('✅ Project saved to README.md successfully');
                } else if (typeof window.globalDataManager.updateProject === 'function') {
                    console.log('🌐 Using updateProject method...');
                    await window.globalDataManager.updateProject(this.currentProject.id, updatedData);
                    console.log('✅ globalDataManager.updateProject completed successfully');
                } else {
                    console.log('📦 Updating local data only...');
                    const projectIndex = window.globalDataManager.projects.findIndex(p => p.id === this.currentProject.id);
                    if (projectIndex !== -1) {
                        window.globalDataManager.projects[projectIndex] = { ...window.globalDataManager.projects[projectIndex], ...updatedData };
                        console.log('✅ Project updated in local cache');
                    }
                }
            } else if (window.GlobalDataManager && !window.globalDataManager) {
                console.log('🔄 Initializing globalDataManager for project update');
                window.globalDataManager = new GlobalDataManager();
                await window.globalDataManager.initialize();
                console.log('✅ globalDataManager initialized, loading mode:', window.globalDataManager.loadingMode);
                
                if ((window.globalDataManager.loadingMode === 'directory-picker' || window.globalDataManager.loadingMode === 'directory-refreshed') && window.globalDataManager.directoryHandle) {
                    console.log('💾 Saving to README.md after initialization...');
                    await window.globalDataManager.saveProjectToFileSystem(this.currentProject.id, updatedData);
                    console.log('✅ Project saved to README.md successfully');
                } else {
                    console.log('📦 Updating local data only after initialization...');
                    const projectIndex = window.globalDataManager.projects.findIndex(p => p.id === this.currentProject.id);
                    if (projectIndex !== -1) {
                        window.globalDataManager.projects[projectIndex] = { ...window.globalDataManager.projects[projectIndex], ...updatedData };
                        console.log('✅ Project updated in local cache');
                    }
                }
            } else {
                console.warn('⚠️ globalDataManager not available for project update');
                console.log('🔍 Debug info:');
                console.log('  - window.globalDataManager exists:', !!window.globalDataManager);
                console.log('  - window.GlobalDataManager exists:', !!window.GlobalDataManager);
                if (window.globalDataManager) {
                    console.log('  - updateProject function exists:', typeof window.globalDataManager.updateProject);
                    console.log('  - globalDataManager keys:', Object.keys(window.globalDataManager));
                    console.log('  - globalDataManager prototype:', Object.getPrototypeOf(window.globalDataManager));
                    console.log('  - globalDataManager prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.globalDataManager)));
                    console.log('  - updateProject directly accessible:', 'updateProject' in window.globalDataManager);
                    
                    // Try to get the method from prototype
                    const prototype = Object.getPrototypeOf(window.globalDataManager);
                    const updateProjectMethod = prototype.updateProject;
                    
                    if (typeof updateProjectMethod === 'function') {
                        console.log('✅ Found updateProject method in prototype, calling it...');
                        await updateProjectMethod.call(window.globalDataManager, this.currentProject.id, updatedData);
                        console.log('✅ updateProject call successful via prototype method');
                    } else {
                        // Last resort: add the method manually
                        console.log('🔧 Adding updateProject method manually...');
                        
                        // Get all necessary methods from prototype
                        const prototype = Object.getPrototypeOf(window.globalDataManager);
                        const saveProjectToFileSystemMethod = prototype.saveProjectToFileSystem;
                        const buildReadmeContentMethod = prototype.buildReadmeContent;
                        const extractProjectInfoMethod = prototype.extractProjectInfo;
                        const hasProjectChangesMethod = prototype.hasProjectChanges;
                        const generateChangeEntryMethod = prototype.generateChangeEntry;
                        
                        console.log('🔍 Methods found in prototype:', {
                            saveProjectToFileSystem: typeof saveProjectToFileSystemMethod,
                            buildReadmeContent: typeof buildReadmeContentMethod,
                            extractProjectInfo: typeof extractProjectInfoMethod,
                            hasProjectChanges: typeof hasProjectChangesMethod,
                            generateChangeEntry: typeof generateChangeEntryMethod
                        });
                        
                        window.globalDataManager.updateProject = async function(projectId, updatedProject) {
                            console.log('🔄 Manual updateProject called:', { projectId, updatedProject });
                            console.log('🔍 Loading mode:', this.loadingMode);
                            console.log('🔍 Directory handle:', !!this.directoryHandle);
                            
                            if (this.loadingMode === 'directory-picker' || this.loadingMode === 'directory-refreshed') {
                                console.log('💾 Using File System Access API to save project');
                                try {
                                    let result;
                                    if (saveProjectToFileSystemMethod && typeof saveProjectToFileSystemMethod === 'function') {
                                        console.log('✅ Using prototype saveProjectToFileSystem method');
                                        result = await saveProjectToFileSystemMethod.call(this, projectId, updatedProject);
                                    } else {
                                        // Implement the method inline if not found in prototype
                                        console.log('🔧 Implementing saveProjectToFileSystem inline');
                                        result = await this.inlineSaveProjectToFileSystem(projectId, updatedProject);
                                    }
                                    console.log('✅ File System Access API save result:', result);
                                    return result;
                                } catch (error) {
                                    console.error('❌ Failed to save project to file system:', error);
                                    throw error;
                                }
                            } else {
                                console.log('📦 Using static mode - updating locally');
                                // Static mode - just update locally
                                const projectIndex = this.projects.findIndex(p => p.id === projectId);
                                if (projectIndex !== -1) {
                                    this.projects[projectIndex] = { ...this.projects[projectIndex], ...updatedProject };
                                    console.log('✅ Project updated in local cache');
                                } else {
                                    console.warn('⚠️ Project not found in local cache:', projectId);
                                }
                                return true;
                            }
                        };
                        
                        // Add inline saveProjectToFileSystem method
                        window.globalDataManager.inlineSaveProjectToFileSystem = async function(projectId, updatedProject) {
                            console.log('💾 Inline saveProjectToFileSystem called:', projectId);
                            
                            if (!this.directoryHandle) {
                                throw new Error('No directory handle available');
                            }
                            
                            try {
                                // Get project directory - try projects/ subdirectory first
                                let projectDirHandle;
                                try {
                                    const projectsDir = await this.directoryHandle.getDirectoryHandle('projects');
                                    projectDirHandle = await projectsDir.getDirectoryHandle(projectId, { create: false });
                                    console.log('✅ Found project in projects/ subdirectory');
                                } catch (error) {
                                    // Fallback to root directory
                                    projectDirHandle = await this.directoryHandle.getDirectoryHandle(projectId, { create: false });
                                    console.log('✅ Found project in root directory');
                                }
                                
                                // Get or create README.md file
                                const readmeHandle = await projectDirHandle.getFileHandle('README.md', { create: true });
                                
                                // Read existing content
                                let existingContent = '';
                                try {
                                    const existingFile = await readmeHandle.getFile();
                                    existingContent = await existingFile.text();
                                } catch (error) {
                                    console.log('⚠️ Could not read existing content:', error.message);
                                }
                                
                                // Build new content with history
                                const timestamp = new Date().toLocaleString('uk-UA', {
                                    year: 'numeric', month: '2-digit', day: '2-digit',
                                    hour: '2-digit', minute: '2-digit'
                                });
                                
                                let newContent = `# ${updatedProject.name || updatedProject.id}\n\n`;
                                if (updatedProject.description) {
                                    newContent += `${updatedProject.description}\n\n`;
                                }
                                
                                // Add change history
                                const changeEntry = `**${timestamp}** - Проект оновлено`;
                                if (existingContent.includes('## История изменений')) {
                                    // Add to existing history
                                    const historyIndex = existingContent.indexOf('## История изменений');
                                    const beforeHistory = existingContent.substring(0, historyIndex);
                                    const historySection = existingContent.substring(historyIndex);
                                    const historyLines = historySection.split('\n');
                                    historyLines.splice(2, 0, changeEntry); // Insert after header
                                    newContent += historyLines.join('\n');
                                } else {
                                    // Create new history section
                                    newContent += `## История изменений\n\n${changeEntry}\n`;
                                }
                                
                                // Write to file
                                const writable = await readmeHandle.createWritable();
                                await writable.write(newContent);
                                await writable.close();
                                
                                console.log('✅ Project README.md saved successfully');
                                
                                // Check if project name changed and rename directory if needed
                                const newProjectName = updatedProject.name || updatedProject.id;
                                if (projectId !== newProjectName) {
                                    console.log('📁 Project name changed, attempting to rename directory...');
                                    console.log(`  From: "${projectId}" to: "${newProjectName}"`);
                                    
                                    try {
                                        await this.renameProjectDirectory(projectId, newProjectName, projectDirHandle);
                                        console.log('✅ Project directory renamed successfully');
                                        
                                        // Update the project ID in our data
                                        updatedProject.id = newProjectName;
                                    } catch (renameError) {
                                        console.warn('⚠️ Could not rename project directory:', renameError.message);
                                        console.log('📝 Changes saved to README.md but directory not renamed');
                                    }
                                }
                                
                                // Update local cache
                                const projectIndex = this.projects.findIndex(p => p.id === projectId);
                                if (projectIndex !== -1) {
                                    this.projects[projectIndex] = { ...this.projects[projectIndex], ...updatedProject };
                                }
                                
                                return true;
                            } catch (error) {
                                console.error('Error in inline saveProjectToFileSystem:', error);
                                throw error;
                            }
                        };
                        
                        // Add directory renaming method
                        window.globalDataManager.renameProjectDirectory = async function(oldName, newName, oldDirHandle) {
                            console.log('📁 Renaming project directory...');
                            console.log(`  Old name: "${oldName}"`);
                            console.log(`  New name: "${newName}"`);
                            
                            // Determine parent directory (projects/ or root)
                            let parentDirHandle = this.directoryHandle;
                            let isInProjectsSubdir = false;
                            
                            try {
                                // Check if project is in projects/ subdirectory
                                const projectsDir = await this.directoryHandle.getDirectoryHandle('projects');
                                await projectsDir.getDirectoryHandle(oldName, { create: false });
                                parentDirHandle = projectsDir;
                                isInProjectsSubdir = true;
                                console.log('📂 Project is in projects/ subdirectory');
                            } catch (error) {
                                console.log('📂 Project is in root directory');
                            }
                            
                            // Check if target directory already exists
                            try {
                                await parentDirHandle.getDirectoryHandle(newName, { create: false });
                                throw new Error(`Directory "${newName}" already exists`);
                            } catch (error) {
                                if (error.message.includes('already exists')) {
                                    throw error;
                                }
                                // Directory doesn't exist, which is good - we can create it
                            }
                            
                            // Create new directory
                            console.log('📁 Creating new directory...');
                            const newDirHandle = await parentDirHandle.getDirectoryHandle(newName, { create: true });
                            
                            // Copy all files and subdirectories
                            await this.copyDirectoryContents(oldDirHandle, newDirHandle);
                            
                            // Try to remove old directory (this is tricky with File System Access API)
                            console.log('🗑️ Attempting to remove old directory...');
                            try {
                                await parentDirHandle.removeEntry(oldName, { recursive: true });
                                console.log('✅ Old directory removed successfully');
                            } catch (removeError) {
                                console.warn('⚠️ Could not remove old directory:', removeError.message);
                                console.log('📝 New directory created but old one still exists');
                                // Don't throw error here - the main operation (rename) succeeded
                            }
                        };
                        
                        // Add directory copying method
                        window.globalDataManager.copyDirectoryContents = async function(sourceDirHandle, targetDirHandle) {
                            console.log('📋 Copying directory contents...');
                            
                            for await (const [name, handle] of sourceDirHandle.entries()) {
                                console.log(`  📄 Copying: ${name}`);
                                
                                if (handle.kind === 'file') {
                                    // Copy file
                                    const file = await handle.getFile();
                                    const content = await file.arrayBuffer();
                                    
                                    const newFileHandle = await targetDirHandle.getFileHandle(name, { create: true });
                                    const writable = await newFileHandle.createWritable();
                                    await writable.write(content);
                                    await writable.close();
                                    
                                } else if (handle.kind === 'directory') {
                                    // Copy directory recursively
                                    const newSubDirHandle = await targetDirHandle.getDirectoryHandle(name, { create: true });
                                    await this.copyDirectoryContents(handle, newSubDirHandle);
                                }
                            }
                            
                            console.log('✅ Directory contents copied successfully');
                        };
                        
                        // Now try to call the manually added method
                        console.log('🧪 Calling manually added updateProject...');
                        await window.globalDataManager.updateProject(this.currentProject.id, updatedData);
                        console.log('✅ Manual updateProject call successful');
                    }
                } else {
                    throw new Error('globalDataManager instance not found');
                }
            }
            
            // Update current project data
            this.currentProject.name = updatedData.name;
            this.currentProject.description = updatedData.description;
            
            // Also update in globalDataManager projects array for consistency
            if (window.globalDataManager && window.globalDataManager.projects) {
                const projectIndex = window.globalDataManager.projects.findIndex(p => p.id === this.currentProject.id);
                if (projectIndex !== -1) {
                    window.globalDataManager.projects[projectIndex] = { ...window.globalDataManager.projects[projectIndex], ...updatedData };
                    console.log('✅ Updated project in globalDataManager.projects array');
                }
            }
            
            // Update static PROJECTS_DATA for consistency
            if (window.PROJECTS_DATA) {
                const staticProjectIndex = window.PROJECTS_DATA.findIndex(p => p.id === this.currentProject.id);
                if (staticProjectIndex !== -1) {
                    window.PROJECTS_DATA[staticProjectIndex] = { ...window.PROJECTS_DATA[staticProjectIndex], ...updatedData };
                    console.log('✅ Updated project in PROJECTS_DATA');
                } else {
                    // Add new project to static data if not found
                    window.PROJECTS_DATA.push({
                        id: this.currentProject.id,
                        name: updatedData.name,
                        description: updatedData.description,
                        tasksCount: { backlog: 0, progress: 0, review: 0, testing: 0, done: 0 },
                        totalTasks: 0,
                        lastModified: new Date().toISOString(),
                        developers: []
                    });
                    console.log('✅ Added new project to PROJECTS_DATA');
                }
            }
            
            // Update dashboard data if available
            if (window.projectsData) {
                const dashboardProjectIndex = window.projectsData.findIndex(p => p.id === this.currentProject.id);
                if (dashboardProjectIndex !== -1) {
                    window.projectsData[dashboardProjectIndex] = { ...window.projectsData[dashboardProjectIndex], ...updatedData };
                    console.log('✅ Updated project in dashboard projectsData');
                    
                    // Also update filtered projects
                    if (window.filteredProjects) {
                        const filteredProjectIndex = window.filteredProjects.findIndex(p => p.id === this.currentProject.id);
                        if (filteredProjectIndex !== -1) {
                            window.filteredProjects[filteredProjectIndex] = { ...window.filteredProjects[filteredProjectIndex], ...updatedData };
                            console.log('✅ Updated project in dashboard filteredProjects');
                        }
                    }
                }
            }
            
            // Update page title while preserving Info button
            const projectNameElement = document.getElementById('projectName');
            const infoButton = projectNameElement.querySelector('button');
            projectNameElement.textContent = updatedData.name;
            if (infoButton) {
                projectNameElement.appendChild(infoButton);
            }
            
            // Close modal
            closeEditProjectModal();
            
            // Show success message
            this.showMessage(`Project "${updatedData.name}" updated successfully!`, 'success');
            
        } catch (error) {
            console.error('Error updating project:', error);
            this.showMessage('Failed to update project. Please try again.', 'error');
        } finally {
            // Reset loading state
            saveBtn.disabled = false;
            btnText.style.display = 'block';
            btnLoading.style.display = 'none';
        }
    }

    renderAnalytics() {
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js is not loaded. Analytics charts will not be displayed.');
            document.getElementById('analyticsView').innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6b7280;">
                    <p>Chart.js is not loaded. Please check your internet connection and try again.</p>
                    <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 16px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer;">Reload Page</button>
                </div>
            `;
            return;
        }
        
        // Update project metrics
        this.updateAnalyticsMetrics();
        
        // Render charts with a small delay to ensure DOM is ready
        setTimeout(() => {
            this.renderStatusChart();
            this.renderTimeChart();
            this.renderDeveloperChart();
        }, 100);
        
        // Update developer statistics
        this.updateDeveloperStats();
        
        // Setup chart toggle buttons
        this.setupChartToggleButtons();
    }
    
    updateAnalyticsMetrics() {
        // Debug: show current project and tasks info
        console.log('🔍 ANALYTICS DEBUG:', {
            currentProject: this.currentProject?.id,
            totalTasksInArray: this.tasks.length,
            totalFilteredTasks: this.filteredTasks?.length || 0,
            usingFilteredTasks: this.filteredTasks && this.filteredTasks.length > 0,
            firstFewTasks: this.tasks.slice(0, 3).map(t => ({id: t.id, column: t.column, project: t.projectId})),
            firstFewFiltered: this.filteredTasks?.slice(0, 3).map(t => ({id: t.id, column: t.column, project: t.projectId})) || []
        });
        
        // Use filteredTasks if available, otherwise use all tasks
        const tasksToAnalyze = this.filteredTasks && this.filteredTasks.length > 0 ? this.filteredTasks : this.tasks;
        
        const totalTasks = tasksToAnalyze.length;
        const backlogTasks = tasksToAnalyze.filter(task => task.column === 'backlog').length;
        const inProgressTasks = tasksToAnalyze.filter(task => task.column === 'progress').length;
        const reviewTasks = tasksToAnalyze.filter(task => task.column === 'review').length;
        const testingTasks = tasksToAnalyze.filter(task => task.column === 'testing').length;
        const completedTasks = tasksToAnalyze.filter(task => task.column === 'done').length;
        
        // Debug: show column breakdown
        console.log('📊 COLUMN BREAKDOWN:', {
            totalTasks,
            backlogTasks,
            inProgressTasks,
            reviewTasks,
            testingTasks,
            completedTasks,
            sum: backlogTasks + inProgressTasks + reviewTasks + testingTasks + completedTasks
        });
        
        // Calculate completion rate
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        // Calculate total time spent and estimated
        const totalSpent = tasksToAnalyze.reduce((sum, task) => sum + this.parseTime(task.timeSpent || '0h'), 0);
        const totalEstimated = tasksToAnalyze.reduce((sum, task) => sum + this.parseTime(task.timeEstimate || '0h'), 0);
        
        // Calculate velocity (tasks completed per week) - simple mock calculation
        const velocity = Math.round(completedTasks / Math.max(1, Math.ceil(totalTasks / 10))); // Rough estimate
        
        // Update DOM elements with correct IDs
        const projectBacklogCount = document.getElementById('projectBacklogCount');
        const projectProgressCount = document.getElementById('projectProgressCount');
        const projectDoneCount = document.getElementById('projectDoneCount');
        const projectVelocityValue = document.getElementById('projectVelocityValue');
        const projectTotalPlanned = document.getElementById('projectTotalPlanned');
        const projectTotalSpent = document.getElementById('projectTotalSpent');
        const projectEfficiency = document.getElementById('projectEfficiency');
        
        if (projectBacklogCount) projectBacklogCount.textContent = backlogTasks;
        if (projectProgressCount) projectProgressCount.textContent = inProgressTasks;
        if (projectDoneCount) projectDoneCount.textContent = completedTasks;
        if (projectVelocityValue) projectVelocityValue.textContent = velocity;
        if (projectTotalPlanned) projectTotalPlanned.textContent = this.formatTime(totalEstimated);
        if (projectTotalSpent) projectTotalSpent.textContent = this.formatTime(totalSpent);
        
        // Calculate efficiency
        const efficiency = totalEstimated > 0 ? Math.round((totalEstimated / Math.max(totalSpent, 1)) * 100) : 100;
        if (projectEfficiency) projectEfficiency.textContent = `${Math.min(efficiency, 100)}%`;
        
        // Update Progress Overview section
        const projectProgressBar = document.getElementById('projectProgress');
        const projectProgressPercentage = document.getElementById('projectProgressPercentage');
        const tasksCompleted = document.getElementById('tasksCompleted');
        const tasksRemaining = document.getElementById('tasksRemaining');
        
        if (projectProgressBar) projectProgressBar.style.width = `${completionRate}%`;
        if (projectProgressPercentage) projectProgressPercentage.textContent = `${completionRate}%`;
        if (tasksCompleted) tasksCompleted.textContent = completedTasks;
        if (tasksRemaining) tasksRemaining.textContent = totalTasks - completedTasks;
        
        console.log('📊 Analytics metrics updated:', {
            totalTasks, backlogTasks, inProgressTasks, completedTasks,
            totalSpent: this.formatTime(totalSpent),
            totalEstimated: this.formatTime(totalEstimated),
            velocity, efficiency,
            completionRate: `${completionRate}%`,
            tasksRemaining: totalTasks - completedTasks
        });
    }
    
    renderStatusChart() {
        const ctx = document.getElementById('projectTaskDistributionChart');
        if (!ctx) {
            console.warn('📊 projectTaskDistributionChart canvas not found');
            return;
        }
        
        // Destroy existing chart if it exists
        if (this.statusChartInstance) {
            this.statusChartInstance.destroy();
        }
        
        const statusCounts = {
            'backlog': this.tasks.filter(task => task.column === 'backlog').length,
            'progress': this.tasks.filter(task => task.column === 'progress').length,
            'review': this.tasks.filter(task => task.column === 'review').length,
            'testing': this.tasks.filter(task => task.column === 'testing').length,
            'done': this.tasks.filter(task => task.column === 'done').length
        };
        
        this.statusChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Backlog', 'In Progress', 'Review', 'Testing', 'Done'],
                datasets: [{
                    data: Object.values(statusCounts),
                    backgroundColor: [
                        '#6b7280', // Backlog - gray
                        '#3b82f6', // Progress - blue
                        '#f59e0b', // Review - amber
                        '#8b5cf6', // Testing - purple
                        '#10b981'  // Done - green
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }
    
    renderTimeChart() {
        const ctx = document.getElementById('projectBurndownCanvas');
        if (!ctx) {
            console.warn('📊 projectBurndownCanvas canvas not found');
            return;
        }
        
        // Destroy existing chart if it exists
        if (this.timeChartInstance) {
            this.timeChartInstance.destroy();
        }
        
        // Group tasks by status and calculate time
        const statusGroups = ['backlog', 'progress', 'review', 'testing', 'done'];
        const spentData = [];
        const estimatedData = [];
        
        statusGroups.forEach(status => {
            const statusTasks = this.tasks.filter(task => task.column === status);
            const spent = statusTasks.reduce((sum, task) => sum + this.parseTime(task.timeSpent || '0h'), 0);
            const estimated = statusTasks.reduce((sum, task) => sum + this.parseTime(task.timeEstimate || '0h'), 0);
            
            spentData.push(Math.round(spent / 60 * 10) / 10); // Convert to hours with 1 decimal
            estimatedData.push(Math.round(estimated / 60 * 10) / 10);
        });
        
        this.timeChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Backlog', 'In Progress', 'Review', 'Testing', 'Done'],
                datasets: [
                    {
                        label: 'Time Spent',
                        data: spentData,
                        backgroundColor: '#10b981',
                        borderColor: '#059669',
                        borderWidth: 1
                    },
                    {
                        label: 'Time Estimated',
                        data: estimatedData,
                        backgroundColor: '#e5e7eb',
                        borderColor: '#d1d5db',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Hours'
                        }
                    }
                },
                    plugins: {
                        legend: {
                            position: 'top'
                        }
                    }
                }
            });
    }
    
    renderDeveloperChart() {
        const ctx = document.getElementById('projectTeamVelocityChart');
        if (!ctx) {
            console.warn('📊 projectTeamVelocityChart canvas not found');
            return;
        }
        
        // Destroy existing chart if it exists
        if (this.developerChartInstance) {
            this.developerChartInstance.destroy();
        }
        
        // Get unique developers and their task counts
        const developerCounts = {};
        this.tasks.forEach(task => {
            const dev = task.developer || 'Unassigned';
            developerCounts[dev] = (developerCounts[dev] || 0) + 1;
        });
        
        // Sort by task count
        const sortedDevelopers = Object.entries(developerCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 8); // Show top 8 developers
        
        const labels = sortedDevelopers.map(([dev]) => 
            dev === 'Unassigned' ? dev : this.formatDeveloperName(dev)
        );
        const data = sortedDevelopers.map(([,count]) => count);
        
        this.developerChartInstance = new Chart(
            ctx, 
            {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Tasks Assigned',
                        data: data,
                        backgroundColor: '#8b5cf6',
                        borderColor: '#7c3aed',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Tasks'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            }
        );
    }
    
    updateDeveloperStats() {
        const developerStatsContainer = document.getElementById('projectDeveloperList');
        if (!developerStatsContainer) {
            console.warn('📊 projectDeveloperList container not found');
            return;
        }
        
        // Calculate developer statistics
        const developerStats = {};
        
        this.tasks.forEach(task => {
            const dev = task.developer || 'Unassigned';
            if (!developerStats[dev]) {
                developerStats[dev] = {
                    totalTasks: 0,
                    completedTasks: 0,
                    timeSpent: 0,
                    timeEstimated: 0
                };
            }
            
            const stats = developerStats[dev];
            stats.totalTasks++;
            if (task.column === 'done') stats.completedTasks++;
            stats.timeSpent += this.parseTime(task.timeSpent || '0h');
            stats.timeEstimated += this.parseTime(task.timeEstimate || '0h');
        });
        
        // Sort developers by total tasks
        const sortedDevs = Object.entries(developerStats)
            .sort(([,a], [,b]) => b.totalTasks - a.totalTasks);
        
        // Render developer stats
        developerStatsContainer.innerHTML = sortedDevs.map(([dev, stats]) => {
            const completionRate = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;
            const timeEfficiency = stats.timeEstimated > 0 ? Math.round((stats.timeSpent / stats.timeEstimated) * 100) : 0;
            const displayName = dev === 'Unassigned' ? dev : this.formatDeveloperName(dev);
            
            return `
                <div class="developer-stat-item">
                    <div class="developer-info">
                        <div class="developer-avatar">
                            ${displayName.charAt(0).toUpperCase()}
                        </div>
                        <div class="developer-details">
                            <div class="developer-name">${displayName}</div>
                            <div class="developer-metrics">
                                <span class="metric">${stats.totalTasks} tasks</span>
                                <span class="metric">${completionRate}% complete</span>
                                <span class="metric">${this.formatTime(stats.timeSpent)} spent</span>
                            </div>
                        </div>
                    </div>
                    <div class="completion-bar">
                        <div class="completion-fill" style="width: ${completionRate}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        
        let backgroundColor, color, borderColor;
        switch (type) {
            case 'error':
                backgroundColor = '#fee2e2';
                color = '#dc2626';
                borderColor = '#fecaca';
                break;
            case 'success':
                backgroundColor = '#d1fae5';
                color = '#065f46';
                borderColor = '#a7f3d0';
                break;
            default: // info
                backgroundColor = '#dbeafe';
                color = '#1d4ed8';
                borderColor = '#bfdbfe';
        }
        
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${backgroundColor};
            color: ${color};
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid ${borderColor};
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
    }

    redirectToDashboard(message) {
        console.log(`🔄 Redirecting to dashboard: ${message}`);
        
        // Show temporary message
        if (message) {
            alert(message);
        }
        
        // Redirect to dashboard
        if (window.location.protocol === 'file:') {
            window.location.href = 'dashboard.html';
        } else {
            window.location.href = '/';
        }
    }

    showNoDirectoryMessage() {
        // Show message that user needs to select directory from dashboard
        const boardContainer = document.querySelector('.board-container') || document.querySelector('#projectBoard');
        if (boardContainer) {
            boardContainer.innerHTML = `
                <div style="
                    text-align: center; 
                    padding: 60px 20px;
                    background: white;
                    border-radius: 12px;
                    margin: 20px;
                    border: 2px dashed #e5e7eb;
                ">
                    <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
                    <h3 style="color: #1f2937; margin-bottom: 12px;">No Directory Selected</h3>
                    <p style="color: #6b7280; margin-bottom: 24px; line-height: 1.5;">
                        Please return to the dashboard and select your projects directory.
                    </p>
                    <button 
                        onclick="window.navigateToDashboard()" 
                        style="
                            background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                            color: white; 
                            border: none; 
                            border-radius: 8px; 
                            padding: 12px 24px; 
                            font-size: 14px; 
                            font-weight: 500; 
                            cursor: pointer;
                            transition: all 0.2s ease;
                        "
                    >Back to Dashboard</button>
                </div>
            `;
        }
    }

    navigateToAnalytics() {
        if (!this.currentProject) {
            console.warn('No current project to navigate analytics for');
            return;
        }

        // Navigate to analytics page with current project
        if (window.location.protocol === 'file:') {
            window.location.href = `analytics.html?project=${encodeURIComponent(this.currentProject.id)}`;
        } else {
            window.location.href = `/analytics?project=${encodeURIComponent(this.currentProject.id)}`;
        }
    }

    getStatusDisplayName(status) {
        const statusNames = {
            'backlog': 'Backlog',
            'progress': 'In Progress',
            'review': 'Review',
            'testing': 'Testing',
            'done': 'Done'
        };
        return statusNames[status] || status;
    }
}

// Modal close functions
// Replace async closeTaskModal() with non-blocking close + background save
async function closeTaskModal() {
    const isWeb = window.location.hostname.includes("onix-systems-android-tasks");
    try {
        if (window.projectBoard && window.projectBoard.currentTask) {
            // Force save current task content before closing (WAIT for completion)
            await window.projectBoard.saveTaskChanges(window.projectBoard.currentTask, { closeAfterSave: false });
            console.log('✅ Task content saved before closing modal');
        }

        if (window.projectBoard && isWeb) {
            // Persist all tasks in background
            window.projectBoard.saveTasksToDisk()
                .then(() => console.log('Tasks persisted (on close)'))
                .catch(err => console.error('saveTasksToDisk (on close) failed:', err));
            // clear currentTask reference so UI can reopen safely later
        }
        
        if (window.projectBoard) {
            window.projectBoard.currentTask = null;
        }
        
        // Update URL to remove task parameter when closing (silently without router)
        if (window.firaRouter) {
            const currentParams = window.firaRouter.getCurrentParams();
            if (currentParams.projectname && (currentParams.taskname || currentParams.taskId)) {
                const projectUrl = `/project/${encodeURIComponent(currentParams.projectname)}`;
                // Use history.replaceState to avoid router triggering
                window.history.replaceState({}, '', projectUrl);
                window.firaRouter.currentRoute = projectUrl;
                console.log('🔗 Updated URL silently after closing task:', projectUrl);
            }
        }
    } finally {
        const modal = document.getElementById('taskDetailModal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Refresh kanban board to show updated task status after closing modal
        if (window.projectBoard) {
            console.log('🔄 Refreshing kanban board after closing task modal');
            window.projectBoard.filterAndRenderTasks();
        }
    }
}

function closeCreateTaskModal() {
    document.getElementById('createTaskModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Close modals when clicking outside
const taskDetailModal = document.getElementById('taskDetailModal');
if (taskDetailModal) {
    taskDetailModal.addEventListener('click', async (e) => {
        // if clicked on backdrop -> close modal (and save)
        if (e.target.classList.contains('task-modal-backdrop')) {
            await closeTaskModal().catch(err => console.error(err));
        }
    });
}

const createTaskModal = document.getElementById('createTaskModal');
if (createTaskModal) {
    createTaskModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeCreateTaskModal();
        }
    });
}

const editProjectModal = document.getElementById('editProjectModal');
if (editProjectModal) {
    editProjectModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeEditProjectModal();
        }
    });
}

// Add Developer Modal backdrop click handler
const addDeveloperModal = document.getElementById('addDeveloperModal');
if (addDeveloperModal) {
    addDeveloperModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeAddDeveloperModal();
        }
    });
}

// Handle escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Check which modal is open and close it
        const addDeveloperModal = document.getElementById('addDeveloperModal');
        const editProjectModal = document.getElementById('editProjectModal');
        
        if (addDeveloperModal && addDeveloperModal.style.display === 'flex') {
            closeAddDeveloperModal();
        } else if (editProjectModal && editProjectModal.style.display === 'flex') {
            closeEditProjectModal();
        } else {
            // Try to close task modal and save
            closeTaskModal().catch(err => console.error(err));
        }
    }
});

// Initialize the board when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for global data to be loaded if needed
    if (window.globalDataManager && window.globalDataManager.isDataLoaded()) {
        initializeBoard();
    } else {
        // Listen for data loaded event
        window.addEventListener('globalDataLoaded', initializeBoard);
        
        // If global data manager exists but isn't loaded yet, initialize it
        if (window.globalDataManager) {
            window.globalDataManager.initialize();
        }
    }
});

function initializeBoard() {
    // Use existing global instance if available
    let board = window.projectBoard;
    if (!board) {
        board = new ProjectBoard();
        window.projectBoard = board; // Ensure it's globally available
    }
    
    // Setup drop zones after a small delay to ensure DOM is ready
    // Note: setupDropZones() is now handled by setupUIPermissions()
    // setTimeout(() => {
    //     board.setupDropZones();
    // }, 100);
}

// Function to initialize project board with specific project for router
window.initProjectBoard = async function(projectName, taskName = null) {
    console.log('Initializing project board for:', projectName, taskName ? 'with task:' + taskName : '');
    
    // Use existing global instance if available, otherwise create new one
    let board = window.projectBoard;
    if (!board) {
        console.log(`🆕 No existing ProjectBoard instance, creating new one`);
        board = new ProjectBoard();
        window.projectBoard = board; // Ensure it's globally available
    } else {
        console.log(`♻️ Using existing ProjectBoard instance`);
        // Only reset if we're switching to a different project
        if (board.lastLoadedProject !== projectName) {
            console.log(`🔄 Switching from project "${board.lastLoadedProject}" to "${projectName}" - resetting load state`);
            board.tasksLoaded = false;
            board.lastLoadedProject = null;
        } else {
            console.log(`✅ Same project "${projectName}" - keeping loaded state`);
        }
        // Re-setup event listeners for new DOM content
        console.log('🔄 Re-setting up event listeners for reused instance');
        board.setupEventListeners();
    }
    
    // Wait for global data to be loaded if needed
    if (window.globalDataManager && window.globalDataManager.isDataLoaded()) {
        
        // Override the project loading logic
        if (window.PROJECTS_DATA) {
            const foundProject = window.PROJECTS_DATA.find(p => p.id === projectName);
            if (foundProject) {
                board.currentProject = foundProject;
                console.log(`✅ Found project in PROJECTS_DATA for router:`, board.currentProject);
            } else {
                board.currentProject = { id: projectName, name: decodeURIComponent(projectName), description: '' };
                console.log(`⚠️ Project not in PROJECTS_DATA for router, using decoded with empty description:`, board.currentProject);
            }
        } else {
            board.currentProject = { id: projectName, name: decodeURIComponent(projectName), description: '' };
            console.log(`⚠️ No PROJECTS_DATA available for router, using decoded with empty description:`, board.currentProject);
        }
        
        document.getElementById('projectName').textContent = board.currentProject.name;
        
        // Try to load fresh project data from server if description is missing
        if (board.currentProject && (!board.currentProject.description || 
            board.currentProject.description === board.currentProject.id || 
            board.currentProject.description.trim() === '')) {
            
            console.log('🔄 Loading fresh project data in router mode...');
            await board.loadFreshProjectData();
        }
        
        // Load tasks for the new project before filtering and rendering
        await board.loadProjectTasks();
        board.filterAndRenderTasks();
        
        // Setup drop zones
        // Note: setupDropZones() is now handled by setupUIPermissions()
        // setTimeout(() => {
        //     board.setupDropZones();
        //     
        //     // If task name is provided, try to open that task
        //     if (taskName) {
        //         setTimeout(() => {
        //             board.openTaskByName(decodeURIComponent(taskName));
        //         }, 200);
        //     }
        // }, 100);
        
        // If task name is provided, try to open that task
        if (taskName) {
            setTimeout(() => {
                board.openTaskByName(decodeURIComponent(taskName));
            }, 200);
        }
        
    } else if (window.globalDataManager) {
        // Wait for data to load then retry
        window.addEventListener('globalDataLoaded', () => {
            window.initProjectBoard(projectName, taskName);
        });
        window.globalDataManager.initialize();
    } else {
        // No global data manager, proceed with project name only  
        board.currentProject = { id: projectName, name: decodeURIComponent(projectName) };
        document.getElementById('projectName').textContent = board.currentProject.name;
        
        // Note: setupDropZones() is now handled by setupUIPermissions()
        // setTimeout(() => {
        //     board.setupDropZones();
        // }, 100);
    }
};

// Time Tracking Modal Functionality
class TimeTrackingManager {
    constructor() {
        this.currentTask = null;
        this.modal = null;
        this.isVisible = false;
        this.originalTimeSpent = '';
        this.listenersAttached = false;
        
        this.init();
    }
    
    init() {
        this.modal = document.getElementById('timeTrackingModal');
        if (!this.modal) return;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Prevent duplicate event listeners
        if (this.listenersAttached) {
            return;
        }
        
        // Time spent input validation and real-time updates
        const timeSpentInput = document.getElementById('timeSpentInput');
        if (timeSpentInput) {
            this.timeSpentInputHandler = (e) => {
                this.handleTimeSpentInputChange(e.target.value);
            };
            this.timeSpentBlurHandler = () => {
                this.validateAndFormatTimeSpentInput();
            };
            
            timeSpentInput.addEventListener('input', this.timeSpentInputHandler);
            timeSpentInput.addEventListener('blur', this.timeSpentBlurHandler);
        }
        
        // Time original estimate input
        const timeOriginalInput = document.getElementById('timeOriginalInput');
        if (timeOriginalInput) {
            this.timeOriginalInputHandler = (e) => {
                this.handleOriginalEstimateInputChange(e.target.value);
            };
            this.timeOriginalBlurHandler = () => {
                this.validateAndFormatOriginalEstimateInput();
            };
            
            timeOriginalInput.addEventListener('input', this.timeOriginalInputHandler);
            timeOriginalInput.addEventListener('blur', this.timeOriginalBlurHandler);
        }
        
        // Save button
        const saveBtn = document.getElementById('saveTimeTrackingBtn');
        if (saveBtn) {
            console.log('✅ TimeTrackingManager: Save button found and event listener attached');
            this.saveButtonHandler = (e) => {
                console.log('🔘 TimeTrackingManager: Save button clicked');
                console.log('🔘 Event details:', e);
                console.log('🔘 Document body overflow:', document.body.style.overflow);
                console.log('🔘 Modal display:', this.modal.style.display);
                
                // Prevent any potential issues
                e.preventDefault();
                e.stopPropagation();
                
                this.handleSaveTimeTracking();
            };
            saveBtn.addEventListener('click', this.saveButtonHandler);
        }
        
        // Mark listeners as attached
        this.listenersAttached = true;
        
        // Modal backdrop click
        this.modalClickHandler = (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        };
        this.modal.addEventListener('click', this.modalClickHandler);
        
        // Keyboard handlers
        this.keydownHandler = (e) => {
            if (this.isVisible) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeModal();
                } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    this.handleSaveTimeTracking();
                }
            }
        };
        document.addEventListener('keydown', this.keydownHandler);
    }
    
    // Parse time string with support for weeks, days, hours, minutes
    parseTimeString(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') {
            return { totalMinutes: 0, isValid: false, breakdown: { weeks: 0, days: 0, hours: 0, minutes: 0 } };
        }
        
        const cleanStr = timeStr.toLowerCase().trim();
        if (!cleanStr) {
            return { totalMinutes: 0, isValid: true, breakdown: { weeks: 0, days: 0, hours: 0, minutes: 0 } };
        }
        
        // Regex to match time patterns like "2w 3d 4h 30m", "2h", "30m", etc.
        const timePattern = /(\d+(?:\.\d+)?)\s*([wdhm])/g;
        const breakdown = { weeks: 0, days: 0, hours: 0, minutes: 0 };
        let totalMinutes = 0;
        let matches = 0;
        
        let match;
        while ((match = timePattern.exec(cleanStr)) !== null) {
            const value = parseFloat(match[1]);
            const unit = match[2];
            
            if (isNaN(value) || value < 0) continue;
            
            matches++;
            
            switch (unit) {
                case 'w':
                    breakdown.weeks += value;
                    totalMinutes += value * 40 * 60; // weeks to minutes (1w = 40h)
                    break;
                case 'd':
                    breakdown.days += value;
                    totalMinutes += value * 8 * 60; // days to minutes (1d = 8h)
                    break;
                case 'h':
                    breakdown.hours += value;
                    totalMinutes += value * 60; // hours to minutes
                    break;
                case 'm':
                    breakdown.minutes += value;
                    totalMinutes += value; // already in minutes
                    break;
            }
        }
        
        // Check if the entire string was parsed (no invalid characters left)
        const reconstructed = cleanStr.replace(timePattern, '').trim();
        const isValid = matches > 0 && reconstructed === '';
        
        return {
            totalMinutes: Math.round(totalMinutes),
            isValid,
            breakdown: {
                weeks: Math.round(breakdown.weeks * 10) / 10,
                days: Math.round(breakdown.days * 10) / 10,
                hours: Math.round(breakdown.hours * 10) / 10,
                minutes: Math.round(breakdown.minutes)
            }
        };
    }
    
    // Format minutes to human readable string
    formatMinutesToString(totalMinutes) {
        if (!totalMinutes || totalMinutes <= 0) return '0h';
        
        // Work-based time conversion: 1w = 40h, 1d = 8h
        const weeks = Math.floor(totalMinutes / (40 * 60)); // 40h * 60min
        const remainingAfterWeeks = totalMinutes % (40 * 60);
        
        const days = Math.floor(remainingAfterWeeks / (8 * 60)); // 8h * 60min  
        const remainingAfterDays = remainingAfterWeeks % (8 * 60);
        
        const hours = Math.floor(remainingAfterDays / 60);
        const minutes = remainingAfterDays % 60;
        
        const parts = [];
        if (weeks > 0) parts.push(`${weeks}w`);
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        
        return parts.length > 0 ? parts.join(' ') : '0h';
    }
    
    // Alias for the same functionality with clearer naming
    formatMinutesToTimeString(totalMinutes) {
        return this.formatMinutesToString(totalMinutes);
    }
    
    // Handle time spent input changes
    handleTimeSpentInputChange(value) {
        const parseResult = this.parseTimeString(value);
        const timeSpentInput = document.getElementById('timeSpentInput');
        
        // Update UI based on validation
        timeSpentInput.classList.remove('error', 'valid');
        
        if (value.trim() === '') {
            // Empty input is valid, set to 0
            this.updateTimeSpentDisplay('0h');
            this.updateProgressBarAndRemaining();
            return;
        }
        
        if (parseResult.isValid) {
            timeSpentInput.classList.add('valid');
            const formattedValue = this.formatMinutesToTimeString(parseResult.totalMinutes);
            this.updateTimeSpentDisplay(formattedValue);
            this.updateProgressBarAndRemaining();
        } else {
            timeSpentInput.classList.add('error');
        }
    }
    
    // Handle original estimate input changes
    handleOriginalEstimateInputChange(value) {
        const parseResult = this.parseTimeString(value);
        const timeOriginalInput = document.getElementById('timeOriginalInput');
        
        timeOriginalInput.classList.remove('error', 'valid');
        
        if (value.trim() === '') {
            // Empty input is valid, set to 0
            this.updateOriginalEstimateDisplay('0h');
            this.updateProgressBarAndRemaining();
            return;
        }
        
        if (parseResult.isValid) {
            timeOriginalInput.classList.add('valid');
            const formattedValue = this.formatMinutesToTimeString(parseResult.totalMinutes);
            this.updateOriginalEstimateDisplay(formattedValue);
            this.updateProgressBarAndRemaining();
        } else {
            timeOriginalInput.classList.add('error');
        }
    }
    
    // Update time spent display
    updateTimeSpentDisplay(timeSpentValue) {
        const timeSpentDisplay = document.getElementById('timeSpentDisplay');
        if (timeSpentDisplay) {
            timeSpentDisplay.textContent = timeSpentValue;
        }
    }
    
    // Update original estimate display
    updateOriginalEstimateDisplay(originalEstimateValue) {
        const originalEstimateElement = document.getElementById('originalEstimateValue');
        if (originalEstimateElement) {
            originalEstimateElement.textContent = originalEstimateValue;
        }
    }
    
    // Update progress bar and time remaining display based on current input values
    updateProgressBarAndRemaining() {
        const timeSpentInput = document.getElementById('timeSpentInput');
        const timeOriginalInput = document.getElementById('timeOriginalInput');
        const timeRemainingDisplay = document.getElementById('timeRemainingDisplay');
        const progressFill = document.getElementById('timeProgressFill');
        
        if (!timeSpentInput || !timeOriginalInput) return;
        
        const spentResult = this.parseTimeString(timeSpentInput.value || '0h');
        const originalResult = this.parseTimeString(timeOriginalInput.value || '0h');
        
        if (!spentResult.isValid || !originalResult.isValid) return;
        
        const spentMinutes = spentResult.totalMinutes;
        const originalMinutes = originalResult.totalMinutes;
        const remainingMinutes = Math.max(0, originalMinutes - spentMinutes);
        
        // Update time remaining display
        if (timeRemainingDisplay) {
            if (spentMinutes <= originalMinutes) {
                const remainingFormatted = this.formatMinutesToTimeString(remainingMinutes);
                timeRemainingDisplay.textContent = `${remainingFormatted} remaining`;
                timeRemainingDisplay.style.color = '';
                timeRemainingDisplay.classList.remove('overtime');
            } else {
                timeRemainingDisplay.textContent = '0h remaining';
                timeRemainingDisplay.style.color = '#dc2626';
                timeRemainingDisplay.classList.add('overtime');
            }
        }
        
        // Update progress bar
        if (progressFill && originalMinutes > 0) {
            const percentage = Math.min(100, (spentMinutes / originalMinutes) * 100);
            const isOvertime = spentMinutes > originalMinutes;
            
            progressFill.style.width = `${percentage}%`;
            
            if (isOvertime) {
                progressFill.style.backgroundColor = '#dc2626';
                progressFill.classList.add('overtime');
            } else {
                progressFill.style.backgroundColor = '';
                progressFill.classList.remove('overtime');
            }
        }
    }
    
    // Validation methods
    validateAndFormatTimeSpentInput() {
        const timeSpentInput = document.getElementById('timeSpentInput');
        if (timeSpentInput && timeSpentInput.value.trim()) {
            const parseResult = this.parseTimeString(timeSpentInput.value);
            if (parseResult.isValid) {
                const formattedValue = this.formatMinutesToTimeString(parseResult.totalMinutes);
                timeSpentInput.value = formattedValue;
                this.updateTimeSpentDisplay(formattedValue);
                this.updateProgressBarAndRemaining();
            }
        }
    }
    
    validateAndFormatOriginalEstimateInput() {
        const timeOriginalInput = document.getElementById('timeOriginalInput');
        if (timeOriginalInput && timeOriginalInput.value.trim()) {
            const parseResult = this.parseTimeString(timeOriginalInput.value);
            if (parseResult.isValid) {
                const formattedValue = this.formatMinutesToTimeString(parseResult.totalMinutes);
                timeOriginalInput.value = formattedValue;
                this.updateOriginalEstimateDisplay(formattedValue);
                this.updateProgressBarAndRemaining();
            }
        }
    }
    
    // Update time calculations and progress visualization
    updateTimeCalculations(spentMinutes, estimateMinutes = null) {
        if (!this.currentTask) return;
        
        console.log('🔄 updateTimeCalculations called:');
        console.log('  spentMinutes:', spentMinutes);
        console.log('  estimateMinutes param:', estimateMinutes);
        console.log('  this.currentTask.timeEstimate:', this.currentTask.timeEstimate);
        console.log('  this.currentTask.timeSpent:', this.currentTask.timeSpent);
        
        if (estimateMinutes === null) {
            const estimateResult = this.parseTimeString(this.currentTask.timeEstimate || '3h');
            estimateMinutes = estimateResult.totalMinutes;
        }
        
        const remainingMinutes = Math.max(0, estimateMinutes - spentMinutes);
        
        console.log('  final estimateMinutes:', estimateMinutes);
        console.log('  remainingMinutes:', remainingMinutes);
        
        // Update time display labels
        const timeSpentDisplay = document.getElementById('timeSpentDisplay');
        const timeRemainingDisplay = document.getElementById('timeRemainingDisplay');
        
        if (timeSpentDisplay) {
            timeSpentDisplay.textContent = this.formatMinutesToTimeString(spentMinutes);
        }
        
        if (timeRemainingDisplay) {
            if (spentMinutes <= estimateMinutes) {
                timeRemainingDisplay.textContent = `${this.formatMinutesToTimeString(remainingMinutes)} remaining`;
                timeRemainingDisplay.style.color = '';
                timeRemainingDisplay.classList.remove('overtime');
            } else {
                timeRemainingDisplay.textContent = '0h remaining';
                timeRemainingDisplay.style.color = '#dc2626';
                timeRemainingDisplay.classList.add('overtime');
            }
        }

        // Update progress bar
        this.updateProgressVisualization(spentMinutes, estimateMinutes);
        
        // Update original estimate input (timeOriginalInput now represents original estimate)
        const timeOriginalInput = document.getElementById('timeOriginalInput');
        if (timeOriginalInput) {
            timeOriginalInput.value = this.formatMinutesToTimeString(estimateMinutes);
        }
    }
    
    // Update progress bar with color coding
    updateProgressVisualization(spentMinutes, estimateMinutes) {
        // Use new progress bar elements
        const progressFill = document.getElementById('timeProgressFill');
        
        let percentage = 0;
        let isOvertime = false;
        
        if (estimateMinutes > 0) {
            percentage = Math.min(100, (spentMinutes / estimateMinutes) * 100);
            isOvertime = spentMinutes > estimateMinutes;
        }
        
        // Update progress bar width and color
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
            
            // Apply red color if overtime
            if (isOvertime) {
                progressFill.style.backgroundColor = '#dc2626';
                progressFill.classList.add('overtime');
            } else {
                progressFill.style.backgroundColor = '';
                progressFill.classList.remove('overtime');
            }
        }
    }
    
    // Update time breakdown display
    updateTimeBreakdown(breakdown) {
        const breakdownDiv = document.getElementById('timeBreakdown');
        const hasNonZeroBreakdown = breakdown.weeks > 0 || breakdown.days > 0 || 
                                   (breakdown.hours > 0 && breakdown.minutes > 0);
        
        if (hasNonZeroBreakdown) {
            breakdownDiv.style.display = 'block';
            document.getElementById('breakdownWeeks').textContent = breakdown.weeks;
            document.getElementById('breakdownDays').textContent = breakdown.days;
            document.getElementById('breakdownHours').textContent = breakdown.hours;
            document.getElementById('breakdownMinutes').textContent = breakdown.minutes;
        } else {
            breakdownDiv.style.display = 'none';
        }
    }
    
    // Validate and format time input on blur
    validateAndFormatTimeInput() {
        const timeInput = document.getElementById('timeSpentInput');
        const value = timeInput.value.trim();
        
        if (!value) return;
        
        const parseResult = this.parseTimeString(value);
        if (parseResult.isValid) {
            // Format the input to a clean representation
            const formatted = this.formatMinutesToString(parseResult.totalMinutes);
            timeInput.value = formatted;
        }
    }
    
    // Open modal with task data
    openModal(task) {
        if (!this.modal || !task) {
            console.error('Modal or task not found:', this.modal, task);
            return;
        }
        
        console.log('Opening time tracking modal with task:', task);
        console.log('Task timeEstimate:', task.timeEstimate);
        console.log('Task timeSpent:', task.timeSpent);
        
        // Use the task as-is - caller should ensure it has fresh data
        this.currentTask = { 
            ...task,
            _fileHandle: task._fileHandle // Preserve file handle
        };
        this.isVisible = true;
        
        // Update modal title with task information
        document.getElementById('timeTrackingTitle').textContent = `Time tracking - ${task.id}`;
        
        // Update task information
        const originalEstimateElement = document.getElementById('originalEstimateValue');
        console.log('Updating originalEstimateValue to:', this.currentTask.timeEstimate || '0h');
        originalEstimateElement.textContent = this.currentTask.timeEstimate || '0h';
        
        // Set current time values
        const timeSpentInput = document.getElementById('timeSpentInput');
        const timeOriginalInput = document.getElementById('timeOriginalInput');
        
        this.originalTimeSpent = this.currentTask.timeSpent || '0h';
        timeSpentInput.value = this.originalTimeSpent;
        
        // Calculate and set remaining time using fresh task data
        const spentResult = this.parseTimeString(this.currentTask.timeSpent || '0h');
        const estimateResult = this.parseTimeString(this.currentTask.timeEstimate || '0h');
        const remainingMinutes = Math.max(0, estimateResult.totalMinutes - spentResult.totalMinutes);
        
        console.log('📊 Time calculations:');
        console.log('  originalTimeSpent:', this.originalTimeSpent);
        console.log('  currentTask.timeSpent:', this.currentTask.timeSpent);
        console.log('  currentTask.timeEstimate:', this.currentTask.timeEstimate);
        console.log('  spentResult.totalMinutes:', spentResult.totalMinutes);
        console.log('  estimateResult.totalMinutes:', estimateResult.totalMinutes);
        console.log('  remainingMinutes:', remainingMinutes);
        
        if (timeOriginalInput) {
            // Set original estimate
            timeOriginalInput.value = this.formatMinutesToTimeString(estimateResult.totalMinutes);
        }
        
        // Update progress display labels with correct IDs
        const timeSpentDisplay = document.getElementById('timeSpentDisplay');
        const timeRemainingDisplay = document.getElementById('timeRemainingDisplay');
        const progressFill = document.getElementById('timeProgressFill');
        
        console.log('Updating progress displays...');
        console.log('timeSpentDisplay element:', timeSpentDisplay);
        console.log('timeRemainingDisplay element:', timeRemainingDisplay);
        console.log('progressFill element:', progressFill);
        
        if (timeSpentDisplay) {
            console.log('Setting timeSpentDisplay to:', this.currentTask.timeSpent || '0h');
            timeSpentDisplay.textContent = this.currentTask.timeSpent || '0h';
        }
        
        if (timeRemainingDisplay) {
            if (spentResult.totalMinutes <= estimateResult.totalMinutes) {
                const remainingFormatted = this.formatMinutesToTimeString(remainingMinutes);
                console.log('Setting timeRemainingDisplay to:', `${remainingFormatted} remaining`);
                timeRemainingDisplay.textContent = `${remainingFormatted} remaining`;
                timeRemainingDisplay.style.color = '';
                timeRemainingDisplay.classList.remove('overtime');
            } else {
                console.log('Setting timeRemainingDisplay to: 0h remaining (overtime)');
                timeRemainingDisplay.textContent = '0h remaining';
                timeRemainingDisplay.style.color = '#dc2626';
                timeRemainingDisplay.classList.add('overtime');
            }
        }
        
        if (progressFill && estimateResult.totalMinutes > 0) {
            const percentage = Math.min(100, (spentResult.totalMinutes / estimateResult.totalMinutes) * 100);
            console.log('Setting progress bar to:', `${percentage}%`);
            progressFill.style.width = `${percentage}%`;
        }
        
        // Update progress display
        this.updateTimeCalculations(spentResult.totalMinutes, estimateResult.totalMinutes);
        
        // Show modal first
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Force modal positioning and prevent scrollbar issues
        this.modal.style.position = 'fixed';
        this.modal.style.top = '0';
        this.modal.style.left = '0';
        this.modal.style.width = '100%';
        this.modal.style.height = '100%';
        this.modal.style.overflowY = 'auto';
        
        console.log('🔒 Modal overflow controls applied');
        
        // Wait for modal to be rendered, then update displays
        setTimeout(() => {
            console.log('Updating displays after modal is shown...');
            console.log('📤 Passing to updateDisplaysAfterModalShow:');
            console.log('  task.timeEstimate:', task.timeEstimate);
            console.log('  task.timeSpent:', task.timeSpent);
            console.log('  this.currentTask.timeEstimate:', this.currentTask.timeEstimate);
            console.log('  this.currentTask.timeSpent:', this.currentTask.timeSpent);
            this.updateDisplaysAfterModalShow(this.currentTask, spentResult, estimateResult, remainingMinutes);
        }, 50);
        
        // Focus on spent time input
        setTimeout(() => {
            timeSpentInput.focus();
            timeSpentInput.select();
        }, 100);
    }

    // Update displays after modal is shown and rendered
    updateDisplaysAfterModalShow(task, spentResult, estimateResult, remainingMinutes) {
        console.log('🔄 updateDisplaysAfterModalShow called with task data:');
        console.log('  task.timeEstimate:', task.timeEstimate);
        console.log('  task.timeSpent:', task.timeSpent);
        console.log('  estimateResult.totalMinutes:', estimateResult.totalMinutes);
        console.log('  spentResult.totalMinutes:', spentResult.totalMinutes);
        console.log('  remainingMinutes:', remainingMinutes);
        
        // Update progress display labels with correct IDs
        const timeSpentDisplay = document.getElementById('timeSpentDisplay');
        const timeRemainingDisplay = document.getElementById('timeRemainingDisplay');
        const progressFill = document.getElementById('timeProgressFill');
        const originalEstimateElement = document.getElementById('originalEstimateValue');
        
        console.log('After modal show - finding elements...');
        console.log('timeSpentDisplay element:', timeSpentDisplay);
        console.log('timeRemainingDisplay element:', timeRemainingDisplay);
        console.log('progressFill element:', progressFill);
        console.log('originalEstimateElement:', originalEstimateElement);
        
        if (timeSpentDisplay) {
            console.log('Setting timeSpentDisplay to:', this.currentTask.timeSpent || '0h');
            timeSpentDisplay.textContent = this.currentTask.timeSpent || '0h';
        } else {
            console.error('timeSpentDisplay element not found after modal show');
        }
        
        if (timeRemainingDisplay) {
            if (spentResult.totalMinutes <= estimateResult.totalMinutes) {
                const remainingFormatted = this.formatMinutesToTimeString(remainingMinutes);
                console.log('Setting timeRemainingDisplay to:', `${remainingFormatted} remaining`);
                timeRemainingDisplay.textContent = `${remainingFormatted} remaining`;
                timeRemainingDisplay.style.color = '';
                timeRemainingDisplay.classList.remove('overtime');
            } else {
                console.log('Setting timeRemainingDisplay to: 0h remaining (overtime)');
                timeRemainingDisplay.textContent = '0h remaining';
                timeRemainingDisplay.style.color = '#dc2626';
                timeRemainingDisplay.classList.add('overtime');
            }
        } else {
            console.error('timeRemainingDisplay element not found after modal show');
        }
        
        if (progressFill && estimateResult.totalMinutes > 0) {
            const percentage = Math.min(100, (spentResult.totalMinutes / estimateResult.totalMinutes) * 100);
            console.log('Setting progress bar to:', `${percentage}%`);
            progressFill.style.width = `${percentage}%`;
        } else {
            console.error('progressFill element not found after modal show or estimate is 0');
        }
        
        if (originalEstimateElement) {
            console.log('Re-setting originalEstimateValue to:', task.timeEstimate || '0h');
            originalEstimateElement.textContent = task.timeEstimate || '0h';
        } else {
            console.error('originalEstimateElement not found after modal show');
        }
    }
    
    // Close modal
    closeModal() {
        console.log('🚪 TimeTrackingManager: closeModal called');
        console.log('🚪 isVisible:', this.isVisible);
        
        if (!this.isVisible) return;
        
        console.log('🚪 Closing modal...');
        this.modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        this.isVisible = false;
        this.currentTask = null;
        this.originalTimeSpent = '';
        
        console.log('🚪 Document body overflow restored to:', document.body.style.overflow);
        
        // Reset form
        this.resetForm();
        
        console.log('🚪 Modal closed successfully');
    }
    
    // Reset form to clean state
    resetForm() {
        const timeInput = document.getElementById('timeSpentInput');
        const errorDiv = document.getElementById('timeValidationError');
        const breakdownDiv = document.getElementById('timeBreakdown');
        
        if (timeInput) {
            timeInput.value = '';
            timeInput.classList.remove('error', 'valid');
        }
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
        if (breakdownDiv) {
            breakdownDiv.style.display = 'none';
        }
        
        // Reset progress visualization
        this.updateProgressVisualization(0, 0);
    }
    
    // Handle save time tracking
    async handleSaveTimeTracking() {
        console.log('🚀 TimeTrackingManager: handleSaveTimeTracking called');
        if (!this.currentTask) {
            console.error('❌ TimeTrackingManager: No current task found');
            return;
        }
        if (!this.currentTask.id) {
            console.error('❌ TimeTrackingManager: Current task has no ID:', this.currentTask);
            return;
        }
        console.log('📋 TimeTrackingManager: Current task:', this.currentTask);
        
        const timeInput = document.getElementById('timeSpentInput');
        const remainingInput = document.getElementById('timeOriginalInput');
        const saveBtn = document.getElementById('saveTimeTrackingBtn');
        
        const newTimeSpent = timeInput.value.trim();
        const newOriginalEstimate = remainingInput.value.trim(); // This is the original estimate
        const parseSpentResult = this.parseTimeString(newTimeSpent);
        const parseEstimateResult = this.parseTimeString(newOriginalEstimate);
        
        if (!parseSpentResult.isValid && newTimeSpent !== '') {
            this.handleTimeSpentInputChange(newTimeSpent); // Show validation error
            return;
        }
        
        if (!parseEstimateResult.isValid && newOriginalEstimate !== '') {
            this.handleOriginalEstimateInputChange(newOriginalEstimate); // Show validation error
            return;
        }
        
        // Store original button text before try block
        const originalText = saveBtn.textContent;
        
        try {
            // Show loading state
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Update task data
            const oldTimeSpent = this.currentTask.timeSpent;
            const oldTimeEstimate = this.currentTask.timeEstimate;
            
            this.currentTask.timeSpent = newTimeSpent || '0m';
            
            // Update original estimate if provided
            if (newOriginalEstimate) {
                this.currentTask.timeEstimate = newOriginalEstimate;
            }
            
            console.log(`📝 TimeTrackingManager: Task data updated:`);
            console.log(`  Old timeSpent: ${oldTimeSpent} → New: ${this.currentTask.timeSpent}`);
            console.log(`  Old timeEstimate: ${oldTimeEstimate} → New: ${this.currentTask.timeEstimate}`);
            console.log(`  Task ID: ${this.currentTask.id}`);
            
            // Add activity log for time changes
            this.addTimeTrackingActivity(this.currentTask, oldTimeSpent, oldTimeEstimate, this.currentTask.timeSpent, this.currentTask.timeEstimate);
            
            // Synchronize the data back to task detail form inputs BEFORE saving
            const taskTimeSpent = document.getElementById('taskTimeSpent');
            if (taskTimeSpent) {
                taskTimeSpent.value = this.currentTask.timeSpent;
                console.log(`✅ Updated taskTimeSpent DOM field to: ${this.currentTask.timeSpent}`);
            }
            
            const taskEstimate = document.getElementById('taskEstimate');
            if (taskEstimate) {
                taskEstimate.value = this.currentTask.timeEstimate;
                console.log(`✅ Updated taskEstimate DOM field to: ${this.currentTask.timeEstimate}`);
            }
            
            const estimateInput = document.getElementById('estimateInput');
            if (estimateInput) {
                // Remove 'h' suffix for the input
                const cleanValue = (this.currentTask.timeEstimate || '0').replace('h', '');
                estimateInput.value = cleanValue;
                console.log(`✅ Updated estimateInput DOM field to: ${cleanValue}`);
            }
            
            // Also update the create task form estimate field if we're in task creation mode
            const newTaskEstimate = document.getElementById('newTaskEstimate');
            if (newTaskEstimate && this.currentTask._isNew) {
                newTaskEstimate.value = this.currentTask.timeEstimate;
                console.log(`✅ Updated newTaskEstimate form field to: ${this.currentTask.timeEstimate}`);
            }
            
            // Update task in the board if it exists
            this.updateTaskInBoard(this.currentTask);
            
            // Synchronize all time displays for this task
            if (window.projectBoard) {
                window.projectBoard.updateAllTimeDisplays(this.currentTask);
                // Also sync estimates to ensure everything is in sync
                window.projectBoard.syncEstimateAcrossUI(this.currentTask);
                // Update progress visualization in time-tracking-section
                window.projectBoard.updateTaskProgressVisualization(this.currentTask);
            }
            
            // Refresh activity display to show the new time tracking entry
            if (window.projectBoard && typeof window.projectBoard.parseAndDisplayActivities === 'function') {
                window.projectBoard.parseAndDisplayActivities(this.currentTask);
            }
            
            // CRITICAL FIX: Synchronize window.projectBoard.currentTask with our updated task
            // This ensures saveTaskChanges works with the correct data when called from task details modal
            if (window.projectBoard) {
                console.log('🔄 TimeTrackingManager: Synchronizing projectBoard.currentTask with updated time data');
                console.log('  Before sync - projectBoard.currentTask:', {
                    id: window.projectBoard.currentTask?.id,
                    timeEstimate: window.projectBoard.currentTask?.timeEstimate,
                    timeSpent: window.projectBoard.currentTask?.timeSpent
                });
                
                // Update the main ProjectBoard's currentTask reference with our changes
                if (window.projectBoard.currentTask && window.projectBoard.currentTask.id === this.currentTask.id) {
                    window.projectBoard.currentTask.timeEstimate = this.currentTask.timeEstimate;
                    window.projectBoard.currentTask.timeSpent = this.currentTask.timeSpent;
                    console.log('✅ Synchronized projectBoard.currentTask with time tracking updates');
                } else {
                    console.warn('⚠️ ProjectBoard.currentTask ID mismatch or missing, using time tracking manager task');
                    window.projectBoard.currentTask = { ...this.currentTask };
                }
                
                console.log('  After sync - projectBoard.currentTask:', {
                    id: window.projectBoard.currentTask.id,
                    timeEstimate: window.projectBoard.currentTask.timeEstimate,
                    timeSpent: window.projectBoard.currentTask.timeSpent
                });
            }

            // Save changes to disk using the project board instance
            if (window.projectBoard && typeof window.projectBoard.saveTaskChanges === 'function') {
                console.log('🔄 TimeTrackingManager: Calling ProjectBoard.saveTaskChanges with updated task:', {
                    id: this.currentTask.id,
                    timeEstimate: this.currentTask.timeEstimate,
                    timeSpent: this.currentTask.timeSpent
                });
                await window.projectBoard.saveTaskChanges(this.currentTask, { closeAfterSave: false });
                console.log('✅ TimeTrackingManager: ProjectBoard.saveTaskChanges completed');
            } else {
                console.warn('⚠️ TimeTrackingManager: ProjectBoard saveTaskChanges method not available');
            }
            
            // Store task ID before closing modal (closeModal clears currentTask)
            const taskId = this.currentTask.id;
            
            // Close modal
            this.closeModal();
            
            // Show success message
            if (window.projectBoard && typeof window.projectBoard.showMessage === 'function') {
                window.projectBoard.showMessage(`Time updated successfully for ${taskId}`, 'success');
            } else {
                console.log(`✅ Time updated successfully for ${taskId}`);
            }
            
        } catch (error) {
            console.error('Error saving time tracking:', error);
            if (window.projectBoard && typeof window.projectBoard.showMessage === 'function') {
                window.projectBoard.showMessage('Failed to save time tracking. Please try again.', 'error');
            } else {
                console.error('❌ Failed to save time tracking. Please try again.');
            }
        } finally {
            // Reset loading state
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }
    
    // Update task in the project board
    updateTaskInBoard(updatedTask) {
        console.log(`🔄 updateTaskInBoard: Updating task ${updatedTask.id}`);
        
        // Try to update in the main project board if available
        if (window.projectBoard && window.projectBoard.tasks) {
            const taskIndex = window.projectBoard.tasks.findIndex(t => t.id === updatedTask.id);
            if (taskIndex !== -1) {
                console.log(`✏️ Updating task in window.projectBoard.tasks at index ${taskIndex}`);
                window.projectBoard.tasks[taskIndex] = { ...updatedTask };
                // Don't call filterAndRenderTasks() here - let the caller control rendering
            } else {
                console.log(`⚠️ Task ${updatedTask.id} not found in window.projectBoard.tasks`);
            }
        }
        
        // Also update in the current instance tasks if it's different
        if (this.tasks && this.tasks !== window.projectBoard?.tasks) {
            console.log(`🔍 Checking current instance tasks (different from window.projectBoard.tasks)`);
            const taskIndex = this.tasks.findIndex(t => t.id === updatedTask.id);
            if (taskIndex !== -1) {
                console.log(`✏️ Updating task in this.tasks at index ${taskIndex}`);
                this.tasks[taskIndex] = { ...updatedTask };
            } else {
                console.log(`⚠️ Task ${updatedTask.id} not found in this.tasks, adding it`);
                this.tasks.push({ ...updatedTask });
                this.checkForDuplicates('after updateTaskInBoard push');
                // Immediately deduplicate after adding
                this.tasks = this.deduplicateTasks(this.tasks);
                this.checkForDuplicates('after updateTaskInBoard deduplication');
            }
        } else {
            console.log(`ℹ️ this.tasks is same as window.projectBoard.tasks or doesn't exist`);
        }
        
        // Update task cards if they exist
        const taskCards = document.querySelectorAll(`[data-task-id="${updatedTask.id}"]`);
        taskCards.forEach(card => {
            const timeDisplay = card.querySelector('.task-time');
            if (timeDisplay) {
                // Use ProjectBoard methods for time formatting
                if (window.projectBoard && typeof window.projectBoard.formatTime === 'function' && typeof window.projectBoard.parseTime === 'function') {
                    timeDisplay.textContent = `${window.projectBoard.formatTime(window.projectBoard.parseTime(updatedTask.timeSpent || '0h'))}/${window.projectBoard.formatTime(window.projectBoard.parseTime(updatedTask.timeEstimate || '0h'))}`;
                } else {
                    // Fallback to raw values
                    timeDisplay.textContent = `${updatedTask.timeSpent || '0h'}/${updatedTask.timeEstimate || '0h'}`;
                }
            }
        });
    }
    
    // Screen reader announcement
    announceModalOpen(task) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.textContent = `Time tracking dialog opened for task ${task.id}. Current time spent: ${task.timeSpent || 'none'}. Use Tab to navigate, Escape to cancel.`;
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            if (announcement.parentNode) {
                announcement.parentNode.removeChild(announcement);
            }
        }, 3000);
    }
    
    // Sync time spent across all UI elements
    syncTimeSpentAcrossUI(timeSpentValue) {
        if (!this.currentTask) return;
        
        console.log(`🔄 Syncing time spent across UI: ${timeSpentValue}`);
        
        // Format the value properly
        const formattedValue = timeSpentValue ? (timeSpentValue.endsWith('h') || timeSpentValue.endsWith('m') ? timeSpentValue : timeSpentValue + 'h') : '0h';
        
        // Update currentTask
        this.currentTask.timeSpent = formattedValue;
        
        // Update main task detail modal timeSpent field
        const taskTimeSpent = document.getElementById('taskTimeSpent');
        if (taskTimeSpent && taskTimeSpent.value !== formattedValue) {
            taskTimeSpent.value = formattedValue;
        }
        
        // Update progress display in main task modal
        const timeSpentDisplay = document.querySelector('.time-spent-display');
        if (timeSpentDisplay) {
            timeSpentDisplay.textContent = formattedValue;
        }
        
        // Update progress wrapper
        const progressWrapper = document.querySelector('.progress-wrapper');
        if (progressWrapper) {
            const timeSpentElement = progressWrapper.querySelector('.time-spent');
            if (timeSpentElement) {
                timeSpentElement.textContent = formattedValue;
            }
        }
        
        // Update time tracking progress
        this.updateTimeCalculations();
        
        // Notify ProjectBoard to update all task cards
        if (window.projectBoard && typeof window.projectBoard.updateAllTimeDisplays === 'function') {
            window.projectBoard.updateAllTimeDisplays(this.currentTask);
        }
    }
    
    // Sync remaining time across all UI elements
    syncRemainingTimeAcrossUI(remainingTimeValue) {
        if (!this.currentTask) return;
        
        console.log(`🔄 Syncing remaining time across UI: ${remainingTimeValue}`);
        
        // Calculate spent time based on remaining time and estimate
        const estimateResult = this.parseTimeString(this.currentTask.timeEstimate || '0h');
        const remainingResult = this.parseTimeString(remainingTimeValue);
        
        if (estimateResult.isValid && remainingResult.isValid) {
            const spentMinutes = Math.max(0, estimateResult.totalMinutes - remainingResult.totalMinutes);
            const spentTimeValue = this.formatMinutesToTimeString(spentMinutes);
            
            // Update time spent input
            const timeSpentInput = document.getElementById('timeSpentInput');
            if (timeSpentInput && timeSpentInput.value !== spentTimeValue) {
                timeSpentInput.value = spentTimeValue;
                this.syncTimeSpentAcrossUI(spentTimeValue);
            }
        }
    }
    
    // Add activity log for time tracking changes
    addTimeTrackingActivity(task, oldTimeSpent, oldTimeEstimate, newTimeSpent, newTimeEstimate) {
        const changes = [];
        
        if (oldTimeSpent !== newTimeSpent) {
            changes.push(`Time spent updated: ${oldTimeSpent || '0h'} → ${newTimeSpent}`);
        }
        
        if (oldTimeEstimate !== newTimeEstimate) {
            changes.push(`Original estimate updated: ${oldTimeEstimate || '0h'} → ${newTimeEstimate}`);
        }
        
        if (changes.length === 0) return;
        
        // Get current date
        const currentDate = new Date().toISOString().split('T')[0];
        
        // Create activity entry
        const activityText = changes.join('\n');
        const newActivity = `${currentDate} - Time Tracking Update\n\n${activityText}\n\n`;
        
        // Append to task content
        task.fullContent = task.fullContent || task.content || '';
        task.fullContent += '\n\n' + newActivity;
        task.content += '\n\n' + newActivity;
        
        // Update the description editor if it exists
        const descriptionEditor = document.getElementById('taskDescriptionEditor');
        if (descriptionEditor) {
            descriptionEditor.value = task.fullContent;
        }
        
        console.log(`📝 Added time tracking activity: ${activityText}`);
    }

    // Show message utility
    showMessage(message, type = 'info') {
        // Use existing message system if available, otherwise create simple notification
        if (typeof showMessage === 'function') {
            showMessage(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

/**
 * Save current tasks to the original file if possible.
 * Tries multiple strategies:
 *  - window.fileSystem.writeFile(path, content)
 *  - electron/ipcRenderer invoke (if available)
 *  - fallback to localStorage
 *
 * After a successful write this.tasksFilePath will be set if a path was used.
 */
async function saveTasksToDisk() {
    // If a ProjectBoard instance exists, delegate to its method
    if (window.projectBoard && typeof window.projectBoard.saveTasksToDisk === 'function') {
        try {
            return await window.projectBoard.saveTasksToDisk();
        } catch (err) {
            console.error('saveTasksToDisk wrapper: delegate failed', err);
            return false;
        }
    }

    // Fallback: if there's a global fileSystem API, perform a basic localStorage save
    try {
        const payload = {
            project: (window.projectBoard && window.projectBoard.currentProject) || null,
            tasks: (window.projectBoard && window.projectBoard.tasks) || []
        };
        const key = 'fira:tasks:' + ((payload.project && (payload.project.name || payload.project.id)) ? (payload.project.name || payload.project.id) : 'default');
        localStorage.setItem(key, JSON.stringify(payload, null, 2));
        console.warn('saveTasksToDisk: saved to localStorage as fallback (' + key + ')');
        return true;
    } catch (err) {
        console.error('saveTasksToDisk fallback failed', err);
        return false;
    }
}

// Global functions for modal control
function openTimeTrackingModal(task) {
    console.log('🌐 GLOBAL openTimeTrackingModal called with task:');
    console.log('  task.id:', task?.id);
    console.log('  task.timeEstimate:', task?.timeEstimate);
    console.log('  task.timeSpent:', task?.timeSpent);
    console.log('  Called from:', new Error().stack);
    
    // If this is called with hardcoded fake data, redirect to proper handler
    if (task?.id === 'current-task' && task?.timeEstimate === '8h' && task?.timeSpent === '2h') {
        console.log('🛑 BLOCKING fake hardcoded data! Redirecting to proper project board handler...');
        
        // Try to trigger the proper handler if we have access to project board
        if (window.projectBoard && window.projectBoard.currentTask) {
            console.log('✅ Using real currentTask from project board:', window.projectBoard.currentTask);
            
            if (!window.timeTrackingManager) {
                window.timeTrackingManager = new TimeTrackingManager();
            }
            
            // Get fresh data from form fields
            const taskEstimate = document.getElementById('taskEstimate');
            const taskTimeSpent = document.getElementById('taskTimeSpent');
            const estimateInput = document.getElementById('estimateInput');
            
            const realTask = { ...window.projectBoard.currentTask };
            
            // Update with form data
            if (estimateInput && estimateInput.value && estimateInput.value.trim() !== '') {
                const estimateValue = estimateInput.value.trim();
                realTask.timeEstimate = estimateValue.endsWith('h') ? estimateValue : estimateValue + 'h';
            } else if (taskEstimate && taskEstimate.value && taskEstimate.value.trim() !== '') {
                realTask.timeEstimate = taskEstimate.value.trim();
            }
            
            if (taskTimeSpent && taskTimeSpent.value && taskTimeSpent.value.trim() !== '') {
                realTask.timeSpent = taskTimeSpent.value.trim();
            } else {
                realTask.timeSpent = '0h';
            }
            
            console.log('✅ Opening modal with real task data:', realTask);
            window.timeTrackingManager.openModal(realTask);
            return;
        } else {
            console.log('❌ No project board or currentTask available, cannot redirect');
            return;
        }
    }
    
    if (!window.timeTrackingManager) {
        window.timeTrackingManager = new TimeTrackingManager();
    }
    
    // Ensure we pass the most current task data, especially if called from a task list
    let freshTask = { 
        ...task,
        _fileHandle: task._fileHandle // Preserve file handle
    };
    
    // If we have access to the current project board and can find this task in memory
    if (window.projectBoard && window.projectBoard.tasks) {
        const memoryTask = window.projectBoard.tasks.find(t => t.id === task.id);
        if (memoryTask) {
            freshTask = { ...memoryTask };
            console.log('Using fresh task data from memory for time tracking modal:', freshTask);
        }
    }
    
    window.timeTrackingManager.openModal(freshTask);
}

function closeTimeTrackingModal() {
    if (window.timeTrackingManager) {
        window.timeTrackingManager.closeModal();
    }
}

// Initialize time tracking when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const timeTrackingModal = document.getElementById('timeTrackingModal');
    if (timeTrackingModal) {
        console.log('✅ TimeTrackingManager: Modal found, initializing...');
        window.timeTrackingManager = new TimeTrackingManager();
        console.log('✅ TimeTrackingManager: Initialized successfully');
    } else {
        console.error('❌ TimeTrackingManager: Modal not found during initialization');
    }
});

// Global function for closing edit project modal
function closeEditProjectModal() {
    const modal = document.getElementById('editProjectModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Global function for closing add developer modal
function closeAddDeveloperModal() {
    if (window.projectBoard && typeof window.projectBoard.closeAddDeveloperModal === 'function') {
        window.projectBoard.closeAddDeveloperModal();
    } else {
        // Fallback
        const modal = document.getElementById('addDeveloperModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }
}

// Assignee Dropdown Manager
class AssigneeDropdownManager {
    constructor() {
        this.initializeDropdown();
        this.initializeEstimateInput();
    }

    initializeDropdown() {
        const dropdownSelected = document.getElementById('dropdownSelected');
        const dropdownMenu = document.getElementById('dropdownMenu');
        const dropdown = document.getElementById('assigneeDropdown');

        if (!dropdownSelected || !dropdownMenu) return;

        // Toggle dropdown
        dropdownSelected.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = dropdownSelected.classList.contains('active');
            
            if (isActive) {
                this.closeDropdown();
            } else {
                this.openDropdown();
            }
        });

        // Handle option selection
        dropdownMenu.addEventListener('click', (e) => {
            const option = e.target.closest('.dropdown-option');
            if (option) {
                const value = option.getAttribute('data-value');
                this.selectOption(value);
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Close dropdown on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDropdown();
            }
        });
    }

    openDropdown() {
        const dropdownSelected = document.getElementById('dropdownSelected');
        const dropdownMenu = document.getElementById('dropdownMenu');
        
        dropdownSelected.classList.add('active');
        dropdownMenu.classList.add('show');
        
        // Mark currently selected option
        const currentValue = document.querySelector('.selected-value').textContent;
        this.updateSelectedOption(currentValue);
    }

    closeDropdown() {
        const dropdownSelected = document.getElementById('dropdownSelected');
        const dropdownMenu = document.getElementById('dropdownMenu');
        
        dropdownSelected.classList.remove('active');
        dropdownMenu.classList.remove('show');
    }

    selectOption(value) {
        const selectedValue = document.querySelector('.selected-value');
        // Truncate text to 12 characters and add ellipsis if longer
        const truncatedValue = value.length > 12 ? value.substring(0, 12) + '...' : value;
        selectedValue.textContent = truncatedValue;
        selectedValue.setAttribute('title', value); // Show full name on hover
        
        this.updateSelectedOption(value);
        this.closeDropdown();
        
        // Trigger change event for potential listeners
        const changeEvent = new CustomEvent('assigneeChanged', { 
            detail: { assignee: value }
        });
        document.dispatchEvent(changeEvent);
        
        console.log('Assignee changed to:', value);
    }

    updateSelectedOption(value) {
        const options = document.querySelectorAll('.dropdown-option');
        options.forEach(option => {
            option.classList.remove('selected');
            if (option.getAttribute('data-value') === value) {
                option.classList.add('selected');
            }
        });
    }

    initializeEstimateInput() {
        const estimateInput = document.getElementById('estimateInput');
        if (!estimateInput) return;

        // Format input on blur
        estimateInput.addEventListener('blur', () => {
            this.formatEstimateValue(estimateInput);
        });

        // Format input on Enter key
        estimateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                estimateInput.blur();
            }
        });

        // Allow only valid characters
        estimateInput.addEventListener('input', (e) => {
            // Validate input (only allow numbers)
            const value = e.target.value;
            if (!/^\d*\.?\d*$/.test(value)) {
                e.target.value = value.replace(/[^\d.]/g, '');
            }
            
            // Sync with taskEstimate field if it exists
            const taskEstimate = document.getElementById('taskEstimate');
            if (taskEstimate && this.currentTask) {
                const newValue = e.target.value;
                console.log(`🔄 Syncing estimateInput change: ${newValue} to taskEstimate`);
                taskEstimate.value = newValue;
                
                // Update current task object with proper formatting
                const formattedValue = newValue ? (newValue.endsWith('h') ? newValue : newValue + 'h') : '0h';
                this.currentTask.timeEstimate = formattedValue;
                
                // Also update the task object in the tasks array
                const taskInArray = this.tasks?.find(t => t.id === this.currentTask.id);
                if (taskInArray) {
                    taskInArray.timeEstimate = formattedValue;
                }
                
                // Sync estimate across all UI elements
                this.syncEstimateAcrossUI(this.currentTask);
                
                // Debounced auto-save the change (only when user stops typing)
                if (this.currentTask.id) {
                    clearTimeout(this.autoSaveTimeout);
                    this.autoSaveTimeout = setTimeout(() => {
                        this.saveTaskChanges(this.currentTask, { closeAfterSave: false })
                            .catch(err => console.error('Auto-save estimate failed:', err));
                    }, 1500); // Wait 1.5 seconds after last change
                }
            }
        });

        // Handle paste events
        estimateInput.addEventListener('paste', (e) => {
            setTimeout(() => {
                this.formatEstimateValue(estimateInput);
            }, 0);
        });
    }

    validateEstimateInput(e) {
        const input = e.target;
        const value = input.value;
        
        // Allow digits, decimal point, 'h', 'd' and backspace/delete
        const validPattern = /^[0-9]*\.?[0-9]*[hd]?$/;
        
        if (!validPattern.test(value)) {
            // Remove last character if invalid
            input.value = value.slice(0, -1);
        }
    }

    formatEstimateValue(input) {
        let value = input.value.trim();
        
        if (!value) {
            input.value = '0h';
            return;
        }

        // Remove any existing h/d suffix
        value = value.replace(/[hd]$/i, '');
        
        // Parse number
        const num = parseFloat(value);
        
        if (isNaN(num) || num < 0) {
            input.value = '0h';
            return;
        }

        // Format the number
        let formattedNum;
        if (num === parseInt(num)) {
            // Whole number
            formattedNum = num.toString();
        } else {
            // Decimal number - round to 1 decimal place
            formattedNum = num.toFixed(1).replace(/\.0$/, '');
        }

        // Add 'h' suffix by default
        input.value = formattedNum + 'h';
        
        // Trigger change event
        const changeEvent = new CustomEvent('estimateChanged', { 
            detail: { estimate: input.value }
        });
        document.dispatchEvent(changeEvent);
        
        console.log('Estimate changed to:', input.value);
    }
    
    moveTaskToColumn(task, oldStatus, newStatus) {
        console.log(`Moving task ${task.id} from ${oldStatus} to ${newStatus}`);
        
        // Remove task from old column
        const oldColumnContent = document.querySelector(`[data-column="${oldStatus}"] .column-content`);
        if (oldColumnContent) {
            const taskCard = oldColumnContent.querySelector(`[data-task-id="${task.id}"]`);
            if (taskCard) {
                taskCard.remove();
            }
        }
        
        // Add task to new column
        const newColumnContent = document.querySelector(`[data-column="${newStatus}"] .column-content`);
        if (newColumnContent) {
            // Create new task card
            const taskCard = this.createTaskCard(task);
            newColumnContent.appendChild(taskCard);
        }
        
        // Update column counts
        this.updateColumnCounts();
        
        // Update task's status
        task.status = newStatus;
        task.column = newStatus;
        
        // Update analytics if in analytics view
        if (this.currentView === 'analytics') {
            this.updateAnalyticsMetrics();
        }
        
        console.log(`Task ${task.id} moved successfully to ${newStatus}`);
    }
    
    setupChartToggleButtons() {
        const chartToggleButtons = document.querySelectorAll('.chart-toggle');
        const chartWrappers = {
            'velocity': document.getElementById('projectVelocityChart'),
            'burndown': document.getElementById('projectBurndownChart'), 
            'distribution': document.getElementById('projectDistributionChart')
        };
        
        chartToggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons
                chartToggleButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                button.classList.add('active');
                
                // Hide all chart wrappers
                Object.values(chartWrappers).forEach(wrapper => {
                    if (wrapper) wrapper.classList.add('hidden');
                });
                
                // Show selected chart wrapper
                const selectedChart = button.dataset.chart;
                const selectedWrapper = chartWrappers[selectedChart];
                if (selectedWrapper) {
                    selectedWrapper.classList.remove('hidden');
                }
                
                console.log(`📊 Switched to ${selectedChart} chart`);
            });
        });
        
        console.log('📊 Chart toggle buttons setup complete');
    }

    // Delete task functionality
    async deleteTask(taskId) {
        try {
            console.log(`🗑️ Deleting task: ${taskId}`);

            // Find the task to delete
            const taskToDelete = this.tasks.find(task => task.id === taskId);
            if (!taskToDelete) {
                throw new Error(`Task ${taskId} not found`);
            }

            // Remove from tasks array
            this.tasks = this.tasks.filter(task => task.id !== taskId);

            // Delete the task file from server
            if (this.isWebVersion && window.globalDataManager && window.globalDataManager.apiClient) {
                console.log(`🔄 Deleting task file for ${taskId} via API`);
                await window.globalDataManager.apiClient.deleteTask(this.currentProject.id, taskId);
                console.log(`✅ Task file deleted successfully for ${taskId}`);
            }

            // Close task detail modal if it's open for this task
            if (this.currentTask && this.currentTask.id === taskId) {
                // Use global function
                if (typeof closeTaskModal === 'function') {
                    await closeTaskModal();
                } else {
                    // Fallback to direct modal close
                    const modal = document.getElementById('taskDetailModal');
                    if (modal) {
                        modal.style.display = 'none';
                        document.body.style.overflow = 'auto';
                    }
                    this.currentTask = null;
                }
            }

            // Refresh the kanban board
            this.renderBoard();

            console.log(`✅ Task ${taskId} deleted successfully`);
            return true;

        } catch (error) {
            console.error('❌ Error deleting task:', error);
            alert(`Error deleting task: ${error.message}`);
            return false;
        }
    }
}


// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize assignee dropdown and estimate input if elements exist
    if (document.getElementById('assigneeDropdown') || document.getElementById('estimateInput')) {
        window.assigneeDropdownManager = new AssigneeDropdownManager();
    }
});
console.log('📋 v2.3 Project Board JS loaded - window.initProjectBoard available:', typeof window.initProjectBoard);

// Global functions for create task detail modal
window.closeCreateTaskDetailModal = function() {
    const modal = document.getElementById('createTaskDetailModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Clear currentTask when closing create modal
        if (window.projectBoard) {
            console.log('🧹 Clearing currentTask on create modal close');
            window.projectBoard.currentTask = null;
            
            // Refresh kanban board to show any newly created tasks
            console.log('🔄 Refreshing kanban board after closing create task modal');
            window.projectBoard.filterAndRenderTasks();
        }
    }
};

window.createNewTaskFromModal = async function() {
    try {
        // Get current project board instance
        const projectBoard = window.projectBoard;
        console.log('🔍 Checking project board instance:', projectBoard);
        if (!projectBoard) {
            console.error('❌ Project board instance not found');
            console.log('Available window properties:', Object.keys(window).filter(key => key.includes('project')));
            return;
        }
        console.log('✅ Project board instance found:', projectBoard.constructor.name);


        // Collect data from the modal
        const taskName = document.getElementById('createTaskNameInput')?.value?.trim();
        const description = document.getElementById('createTaskDescriptionEditor')?.value?.trim() || '';
        const priority = document.getElementById('createTaskPrioritySelect')?.value || 'medium';
        const status = document.getElementById('createTaskStatusSelect')?.value || 'backlog';
        
        console.log('🔍 DEBUG: Task creation values:', {
            taskName: taskName,
            taskNameEmpty: !taskName,
            taskNameLength: taskName ? taskName.length : 0,
            description: description,
            priority: priority,
            status: status
        });
        const assigneeSelected = document.querySelector('#createDropdownSelected .selected-value')?.textContent || 'Unassigned';
        
        // Validate required fields
        if (!taskName) {
            alert('Task name is required');
            document.getElementById('createTaskNameInput')?.focus();
            return;
        }
        
        if (!projectBoard.currentProject) {
            console.error('No current project selected');
            alert('No project selected');
            return;
        }
        
        console.log('📁 Current project:', projectBoard.currentProject);
        console.log('📁 Project ID:', projectBoard.currentProject.id);
        console.log('📁 Project name:', projectBoard.currentProject.name);
        
        // Determine correct column/folder based on status and assignment
        let targetColumn = status;
        let targetFolder = status;
        
        // Handle assignment logic:
        // - If assigned to someone and status is backlog, change to progress automatically
        // - If assigned to someone and status is progress/review/testing/done, put in dev folder
        if (assigneeSelected !== 'Unassigned') {
            if (status === 'backlog') {
                // Auto-change from backlog to progress when assigned
                targetColumn = 'progress';
                targetFolder = `progress/${assigneeSelected}`;
            } else if (status === 'progress') {
                targetFolder = `progress/${assigneeSelected}`;
            } else if (status === 'review') {
                targetFolder = `review/${assigneeSelected}`;
            } else if (status === 'testing') {
                targetFolder = `testing/${assigneeSelected}`;
            } else if (status === 'done') {
                targetFolder = `done/${assigneeSelected}`;
            }
        }
        
        // Create task data
        const taskId = await projectBoard.generateTaskIdAsync();
        const taskData = {
            id: taskId,
            title: taskName,
            content: description,
            fullContent: description,
            column: targetColumn,
            folder: targetFolder, // Server needs to know which folder to save to
            priority: priority,
            assignee: assigneeSelected === 'Unassigned' ? '' : assigneeSelected,
            developer: assigneeSelected === 'Unassigned' ? '' : assigneeSelected,
            timeEstimate: '2h',
            timeSpent: '0h',
            created: new Date().toISOString().substring(0, 10),
            projectId: projectBoard.currentProject.id,
            // Add UI-specific fields
            status: targetColumn,
            file_path: `${targetFolder}/${taskId}.md`
        };
        
        // Create markdown content with YAML frontmatter
        const yamlFrontmatter = `---
title: ${taskData.title}
estimate: ${taskData.timeEstimate}
spent_time: ${taskData.timeSpent}
priority: ${taskData.priority}
developer: ${taskData.developer}
status: ${taskData.status || taskData.column || 'backlog'}
created: ${taskData.created}
---

${taskData.content}`;
        
        console.log('Creating task with data:', taskData);
        console.log('YAML frontmatter:', yamlFrontmatter);
        
        // Save task using API client
        console.log('🔍 Checking API client availability...');
        console.log('globalDataManager:', !!window.globalDataManager);
        console.log('apiClient:', !!window.globalDataManager?.apiClient);
        console.log('loadingMode:', window.globalDataManager?.loadingMode);
        
        // Add detailed debugging
        if (window.globalDataManager) {
            console.log('🔍 GlobalDataManager details:', {
                isLoaded: window.globalDataManager.isLoaded,
                loadingMode: window.globalDataManager.loadingMode,
                hasApiClient: !!window.globalDataManager.apiClient,
                apiClientBaseUrl: window.globalDataManager.apiClient?.baseUrl,
                currentDirectoryPath: window.globalDataManager.currentDirectoryPath
            });
        }
        
        if (window.globalDataManager && window.globalDataManager.apiClient) {
            // First check if server is available
            console.log('🔄 Checking server status before creating task...');
            console.log('🔍 API Client baseUrl:', window.globalDataManager.apiClient.baseUrl);
            console.log('🔍 Current isServerAvailable:', window.globalDataManager.apiClient.isServerAvailable);
            
            const isServerAvailable = await window.globalDataManager.apiClient.checkServerStatus();
            console.log('🔍 After checkServerStatus, isServerAvailable:', isServerAvailable);
            console.log('🔍 API Client isServerAvailable property:', window.globalDataManager.apiClient.isServerAvailable);
            
            if (!isServerAvailable) {
                console.error('❌ Server check failed. Cannot create task.');
                throw new Error('Server is not available. Please make sure the server is running.');
            }
            
            try {
                // Create task via API
                console.log('📡 Calling createTask API...');
                console.log('📂 Creating task in project:', projectBoard.currentProject.id);
                console.log('📝 Task data sending to server:', JSON.stringify(taskData, null, 2));
                
                // Check the exact URL that will be called
                const apiUrl = `${window.globalDataManager.apiClient.baseUrl}/api/projects/${encodeURIComponent(projectBoard.currentProject.id)}/tasks`;
                console.log('🔗 API URL:', apiUrl);
                
                const result = await window.globalDataManager.apiClient.createTask(
                    projectBoard.currentProject.id, 
                    taskData
                );
                
                console.log('📨 API createTask result:', result);
                console.log('📨 API createTask result type:', typeof result);
                
                if (result === true) {
                    console.log('✅ Task created successfully');
                    
                    // Show success message first
                    let successMessage = `Task "${taskData.title}" created successfully`;
                    if (taskData.assignee) {
                        successMessage += ` and assigned to ${taskData.assignee}`;
                    }
                    projectBoard.showMessage(successMessage, 'success');
                    
                    // Close the create task modal
                    window.closeCreateTaskDetailModal();
                    
                    console.log('🔄 Simple reload: Just reloading current project tasks...');
                    
                    // Simple approach: just reload tasks for current project
                    projectBoard.tasksLoaded = false;
                    
                    // Simple reload approach
                    try {
                        console.log('🔄 Reloading tasks for current project...');
                        console.log('🔍 Current project:', projectBoard.currentProject?.id);
                        console.log('🔍 Task was created in project:', taskData.projectId);
                        console.log('🔍 Project match:', projectBoard.currentProject?.id === taskData.projectId);
                        
                        // Gentle approach: Just refresh tasks for current project
                        console.log('🔄 Refreshing tasks for current project...');
                        
                        // Temporarily clear only the project-specific cache flags
                        const wasTasksLoaded = projectBoard.tasksLoaded;
                        const wasLastProject = projectBoard.lastLoadedProject;
                        
                        projectBoard.tasksLoaded = false;
                        projectBoard.lastLoadedProject = null;
                        
                        // If using global data manager, refresh only this project's tasks
                        if (window.globalDataManager && window.globalDataManager.apiClient) {
                            console.log('🔄 Refreshing tasks via API for current project only...');
                            try {
                                const tasksResponse = await window.globalDataManager.apiClient.getProjectTasks(projectBoard.currentProject.id);
                                if (tasksResponse.success) {
                                    // Update only this project's tasks in the global cache
                                    window.globalDataManager.projectTasks[projectBoard.currentProject.id] = tasksResponse.tasks;
                                    
                                    // Remove old tasks from allTasks and add new ones
                                    window.globalDataManager.allTasks = window.globalDataManager.allTasks.filter(
                                        task => task.projectId !== projectBoard.currentProject.id
                                    );
                                    window.globalDataManager.allTasks.push(...tasksResponse.tasks);
                                    
                                    console.log(`✅ Updated cache with ${tasksResponse.tasks.length} tasks for project ${projectBoard.currentProject.id}`);
                                }
                            } catch (refreshError) {
                                console.warn('⚠️ Failed to refresh project tasks via API:', refreshError);
                                // Restore original cache flags if refresh failed
                                projectBoard.tasksLoaded = wasTasksLoaded;
                                projectBoard.lastLoadedProject = wasLastProject;
                            }
                        }
                        
                        // Now reload tasks for current project
                        await projectBoard.loadProjectTasks();
                        
                        // Fallback: If still no tasks loaded or new task not found, force direct API call
                        if (!projectBoard.tasks || projectBoard.tasks.length === 0 || 
                            !projectBoard.tasks.find(t => t.id === taskData.id)) {
                            console.log('🚨 Fallback: Direct API reload due to cache issues...');
                            
                            try {
                                // Direct API call bypassing all cache
                                const directResponse = await fetch(`/api/projects/${projectBoard.currentProject.id}/tasks`);
                                if (directResponse.ok) {
                                    const directData = await directResponse.json();
                                    if (directData.success && directData.tasks) {
                                        projectBoard.tasks = directData.tasks;
                                        console.log(`✅ Direct API reload successful: ${directData.tasks.length} tasks loaded`);
                                        
                                        const createdTask = projectBoard.tasks.find(t => t.id === taskData.id);
                                        if (createdTask) {
                                            console.log('✅ Created task found via direct API call');
                                        }
                                    }
                                }
                            } catch (directError) {
                                console.error('❌ Direct API fallback failed:', directError);
                            }
                        }
                        console.log('✅ Tasks reloaded successfully');
                        console.log('🔍 Total tasks after reload:', projectBoard.tasks?.length);
                        
                        // Check if our created task is in the loaded tasks
                        const createdTask = projectBoard.tasks?.find(task => task.id === taskData.id);
                        if (createdTask) {
                            console.log('✅ Created task found in loaded tasks:', createdTask.title);
                            console.log('🔍 Task details:', {
                                id: createdTask.id,
                                title: createdTask.title,
                                status: createdTask.status,
                                column: createdTask.column,
                                assignee: createdTask.assignee
                            });
                        } else {
                            console.log('❌ Created task NOT found in loaded tasks');
                            console.log('🔍 Available task IDs:', projectBoard.tasks?.map(t => t.id) || []);
                        }
                        
                        // Re-render the interface
                        projectBoard.filterAndRenderTasks();
                        console.log('✅ Interface updated');
                        
                        // Additional verification: Ensure the created task is visible in UI
                        setTimeout(() => {
                            const taskCards = document.querySelectorAll('.task-card');
                            const createdTaskCard = Array.from(taskCards).find(card => 
                                card.dataset.taskId === taskData.id || 
                                card.innerHTML.includes(taskData.id)
                            );
                            
                            if (createdTaskCard) {
                                console.log('✅ Created task is visible in UI');
                                // Briefly highlight the new task
                                createdTaskCard.style.border = '2px solid #28a745';
                                createdTaskCard.style.boxShadow = '0 0 10px rgba(40, 167, 69, 0.5)';
                                setTimeout(() => {
                                    createdTaskCard.style.border = '';
                                    createdTaskCard.style.boxShadow = '';
                                }, 3000);
                            } else {
                                console.log('⚠️ Created task not visible in UI, but should be in data');
                                console.log('🔍 Available task cards:', taskCards.length);
                                console.log('🔍 Looking for task ID:', taskData.id);
                            }
                        }, 500);
                        
                    } catch (error) {
                        console.error('❌ Failed to reload tasks:', error);
                        console.error('❌ Error stack:', error.stack);
                    }
                    
                    console.log('📋 Task creation and reload process completed successfully');
                    
                } else {
                    throw new Error('Failed to create task');
                }
            } catch (error) {
                console.error('❌ Error creating task:', error);
                alert(`Error creating task: ${error.message}`);
            }
        } else {
            console.error('API client not available');
            alert('Server mode not available');
        }
        
    } catch (error) {
        console.error('Error in createNewTaskFromModal:', error);
        alert(`Error creating task: ${error.message}`);
    }
};

// Global delete task functions
window.showDeleteTaskConfirmation = function() {
    const modal = document.getElementById('deleteTaskConfirmationModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

window.hideDeleteTaskConfirmation = function() {
    const modal = document.getElementById('deleteTaskConfirmationModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

window.confirmDeleteTask = async function() {
    const projectBoard = window.projectBoard;
    if (!projectBoard || !projectBoard.currentTask) {
        console.error('❌ ProjectBoard instance or current task not found');
        return;
    }

    const taskId = projectBoard.currentTask.id;
    console.log(`🗑️ Confirming delete for task: ${taskId}`);

    // Hide confirmation dialog
    window.hideDeleteTaskConfirmation();

    // Delete the task
    const success = await projectBoard.deleteTask(taskId);
    if (success) {
        console.log(`✅ Task ${taskId} deleted successfully`);
    }
};

// Global function for opening create task fullscreen
window.openCreateTaskFullScreen = function() {
    // Get current project board instance
    const projectBoard = window.projectBoard;
    if (!projectBoard) {
        console.error('Project board instance not found');
        return;
    }
    
    // Check if we're in server mode
    if (window.globalDataManager && window.globalDataManager.loadingMode === 'server') {
        // Open the create task modal as fullscreen
        projectBoard.openCreateTaskDetailModal();
        console.log('📝 Opened create task fullscreen from task detail modal');
    } else {
        console.log('Create task only available in server mode');
        alert('Create task feature is only available when using server mode');
    }
};

// Global function for opening task by ID (used by router)
window.openTaskById = function(taskId) {
    console.log('🔍 openTaskById called with:', taskId);

    // Get current project board instance
    const projectBoard = window.projectBoard;
    if (!projectBoard) {
        console.error('❌ ProjectBoard instance not found');
        return;
    }

    // Use the improved openTaskByName method which handles both ID and name search
    // and includes its own logic for waiting for tasks to load
    projectBoard.openTaskByName(taskId);
};
