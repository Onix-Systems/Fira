// Project Board JavaScript
class ProjectBoard {
    constructor() {
        console.log(`🆕 Creating new ProjectBoard instance`);
        this.currentProject = null;
        this.tasks = [];
        this.filteredTasks = [];
        this.draggedTask = null;
        this.dropZonesSetup = false;
        this.searchTerm = '';
        this.selectedDeveloper = '';
        this.dateRange = '';
        this.currentView = 'kanban'; // 'kanban' or 'list'
        this.sortColumn = '';
        this.sortDirection = 'asc'; // 'asc' or 'desc'
        this.displayedTasks = 20; // Initial number of tasks to show
        this.loadIncrement = 20;  // How many more tasks to load on scroll

        // Path where tasks were loaded from (if known) - used to save back to same file
        this.tasksFilePath = null;
        // Currently opened task in the detail modal (used to persist edits)
        this.currentTask = null;
        // Flag to prevent double loading of tasks
        this.tasksLoaded = false;
        // Expose instance globally so wrapper functions / globals can call instance methods
        window.projectBoard = this;
        
        // Chart instances for cleanup
        this.statusChartInstance = null;
        this.timeChartInstance = null;
        this.developerChartInstance = null;
        
        // Initialize asynchronously
        this.init().catch(error => {
            console.error('Failed to initialize ProjectBoard:', error);
        });
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
                this.currentProject = window.PROJECTS_DATA.find(p => p.id === projectId) || { id: projectId, name: projectId };
                console.log(`✅ Found project in PROJECTS_DATA:`, this.currentProject);
            } else if (projectId) {
                this.currentProject = { id: projectId, name: decodeURIComponent(projectId) };
                console.log(`⚠️ Project not in PROJECTS_DATA, using decoded:`, this.currentProject);
            }
        }
        
        // Fallback to URL parameters
        if (!this.currentProject) {
            const urlParams = new URLSearchParams(window.location.search);
            const projectId = urlParams.get('project');
            console.log(`📄 URL params project: "${projectId}"`);
            
            if (projectId && window.PROJECTS_DATA) {
                this.currentProject = window.PROJECTS_DATA.find(p => p.id === projectId) || { id: projectId, name: projectId };
                console.log(`✅ Found project in PROJECTS_DATA:`, this.currentProject);
            } else if (projectId) {
                this.currentProject = { id: projectId, name: decodeURIComponent(projectId) };
                console.log(`⚠️ Project not in PROJECTS_DATA, using decoded:`, this.currentProject);
            } else {
                this.currentProject = { id: 'sample-project', name: 'Sample Project' };
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
        }
    }

    setupEventListeners() {
        // Back button
        console.log('🔧 Setting up back button event listener...');
        const backButton = document.getElementById('backButton');
        console.log('🔍 Back button found:', !!backButton);
        if (backButton) {
            console.log('✅ Adding click listener to back button');
            backButton.addEventListener('click', (e) => {
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

                // Navigate back to dashboard
                console.log('🔙 Navigating back to dashboard...');
                if (window.firaRouter && typeof window.firaRouter.navigateTo === 'function') {
                    console.log('✅ Using router navigation');
                    window.firaRouter.navigateTo('/');
                } else if (window.navigateToDashboard && typeof window.navigateToDashboard === 'function') {
                    console.log('✅ Using global navigation function');
                    window.navigateToDashboard();
                } else {
                    console.log('⚠️ Using browser history back');
                    window.history.back();
                }
            });
        }

        // Analytics button - opens in same window
        const analyticsBtn = document.getElementById('analyticsBtn');
        if (analyticsBtn) {
            analyticsBtn.addEventListener('click', () => {
                this.navigateToAnalytics();
            });
        }

        const viewSwitchBtn = document.getElementById('viewSwitchBtn');
        if (viewSwitchBtn) {
            viewSwitchBtn.addEventListener('click', () => {
                this.switchView();
            });
        }

        // Create task button
        const createTaskBtn = document.getElementById('createTaskBtn');
        if (createTaskBtn) {
            createTaskBtn.addEventListener('click', () => {
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
            });
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
    }

    generateTaskId() {
        // Generate unique task ID for new tasks
        const projectPrefix = this.currentProject ? this.currentProject.id.toUpperCase() : 'TSK';
        const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
        const random = Math.random().toString(36).substr(2, 3).toUpperCase(); // 3 random chars
        return `${projectPrefix}-${timestamp}-${random}`;
    }

    async loadProjectTasks() {
        console.log(`🔍 loadProjectTasks called - flag status: ${this.tasksLoaded}, project: ${this.currentProject?.id}`);
        
        // Prevent double loading
        if (this.tasksLoaded) {
            console.log(`⏭️ Tasks already loaded for project: ${this.currentProject.id}, skipping`);
            return;
        }
        
        try {
            console.log(`🔍 Loading tasks for project: ${this.currentProject.id}`);
            this.tasksLoaded = true; // Set flag immediately to prevent concurrent calls
            console.log(`🔒 Set tasksLoaded flag to true`);
            
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
                    
                    // Check if initialization was successful
                    if (!window.globalDataManager.isDataLoaded()) {
                        console.log('❌ Global data manager initialization failed');
                        this.redirectToDashboard('Failed to load project data');
                        return;
                    }
                } catch (error) {
                    console.error('❌ Failed to initialize global data manager:', error);
                    this.redirectToDashboard('Error loading project data');
                    return;
                }
            }
            
            // Get tasks from global data manager
            if (window.globalDataManager && window.globalDataManager.isDataLoaded()) {
                this.tasks = window.globalDataManager.getTasksForProject(this.currentProject.id);
                console.log(`📝 Loaded ${this.tasks.length} tasks for project ${this.currentProject.id}`);
                this.checkForDuplicates('after loadProjectTasks');
                
                if (this.tasks.length === 0) {
                    console.warn(`⚠️ No tasks found for project ${this.currentProject.id}. Available projects:`, 
                        window.globalDataManager.getProjects().map(p => p.id));
                }
                
                // Debug: show first few tasks
                this.tasks.slice(0, 3).forEach(task => {
                    console.log(`   - ${task.id}: ${task.title} (${task.column})`);
                });
            } else {
                console.warn('❌ Global data not loaded, using sample tasks');
                this.loadSampleTasks();
            }
        } catch (error) {
            console.error('❌ Failed to load project tasks:', error);
            console.warn('🔄 Falling back to sample tasks');
            this.loadSampleTasks();
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
                assignee: 'John Smith',
                priority: 'low',
                developer: 'dev-john'
            },
            {
                id: 'TSK-716',
                title: 'Set up CI/CD pipeline',
                column: 'progress',
                timeSpent: '1h',
                timeEstimate: '8h',
                assignee: 'Mary Johnson',
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
                assignee: 'John Smith',
                priority: 'high',
                developer: 'dev-john'
            },
            {
                id: 'TSK-719',
                title: 'Setup database schema',
                column: 'done',
                timeSpent: '6h',
                timeEstimate: '6h',
                assignee: 'Mary Johnson',
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
        const currentSelection = developerSelect.value;
        
        // Get unique developers from tasks
        const developers = new Set();
        this.tasks.forEach(task => {
            if (task.developer) {
                developers.add(task.developer);
            }
        });
        
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
            const columnTasks = this.filteredTasks.filter(task => task.column === columnId);

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
        
        // Equalize column heights after rendering
        this.equalizeColumnHeights();

        // Reset drop zones flag to ensure they get re-setup after DOM changes
        this.dropZonesSetup = false;

        // Setup drop zones after a small delay to ensure DOM is ready
        setTimeout(() => {
            this.setupDropZones();
        }, 50);

        // Update assignee dropdown after rendering tasks (ensure we have latest developers)
        // Only update if we're not currently in a modal to avoid interfering with current editing
        if (!document.getElementById('taskDetailModal')?.style.display?.includes('flex') &&
            !document.getElementById('createTaskDetailModal')?.style.display?.includes('flex')) {
            this.updateAssigneeDropdown();
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
        card.draggable = true;
        console.log('📋 Created draggable card for task:', task.id);
        card.dataset.taskId = task.id;
        
        card.innerHTML = `
            <div class="task-card-header">
                <div class="task-id">${task.id}</div>
                <div class="task-time" title="Click to track time">
                    <svg class="time-icon" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0z"/>
                    </svg>
                    ${task.timeSpent || '0'}/${task.timeEstimate || '0'}
                </div>
            </div>
            <div class="task-name">${task.title}</div>
            <div class="task-card-footer">
                <div class="task-assignee">${task.assignee}</div>
                <div class="task-priority ${task.priority}">${task.priority.toUpperCase()}</div>
            </div>
        `;
        
        // Add event listeners
        card.addEventListener('click', (e) => {
            // Check if time display was clicked
            if (e.target.closest('.task-time')) {
                e.stopPropagation();
                openTimeTrackingModal(task);
                return;
            }
            this.openTaskDetail(task);
        });

        // Drag and drop
        card.addEventListener('dragstart', (e) => {
            this.handleDragStart(e, task);
        });

        card.addEventListener('dragend', (e) => {
            this.handleDragEnd(e);
        });

        return card;
    }

    setupDropZones() {
        if (this.dropZonesSetup) {
            console.log('🎯 Drop zones already set up, skipping...');
            return;
        }

        console.log('🎯 Setting up drop zones for kanban board...');
        const columnContents = document.querySelectorAll('.column-content');
        const kanbanColumns = document.querySelectorAll('.kanban-column');

        // Setup drop zones on column contents
        columnContents.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });

            column.addEventListener('dragleave', (e) => {
                // Only remove drag-over if we're not entering a child element
                if (!column.contains(e.relatedTarget)) {
                    column.classList.remove('drag-over');
                }
            });

            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                this.handleDrop(e, column.dataset.column);
            });
        });

        // Also setup drop zones on kanban columns as fallback
        kanbanColumns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });

            column.addEventListener('dragleave', (e) => {
                // Only remove drag-over if we're not entering a child element
                if (!column.contains(e.relatedTarget)) {
                    column.classList.remove('drag-over');
                }
            });

            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                const columnContent = column.querySelector('.column-content');
                if (columnContent?.dataset.column) {
                    this.handleDrop(e, columnContent.dataset.column);
                }
            });
        });

        // Mark drop zones as setup
        this.dropZonesSetup = true;
        console.log('✅ Drop zones setup completed');
    }

    handleDragStart(e, task) {
        this.draggedTask = task;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedTask = null;
    }

    async handleDrop(e, targetColumn) {
        console.log('🎯 Drop event on column:', targetColumn, 'with task:', this.draggedTask?.id);
        if (!this.draggedTask) return;

        if (this.draggedTask.column !== targetColumn) {
            const oldColumn = this.draggedTask.column;

            // Update task column and status
            this.draggedTask.column = targetColumn;
            this.draggedTask.status = targetColumn;

            // Find and update in tasks array
            const taskIndex = this.tasks.findIndex(t => t.id === this.draggedTask.id);
            if (taskIndex !== -1) {
                this.tasks[taskIndex].column = targetColumn;
                this.tasks[taskIndex].status = targetColumn;

                console.log('💾 Saving task after drag-and-drop:', {
                    id: this.draggedTask.id,
                    oldColumn: oldColumn,
                    newColumn: targetColumn,
                    task: this.tasks[taskIndex]
                });

                // Save the task to persist the change
                try {
                    await this.saveTaskDirectly(this.tasks[taskIndex]);
                    console.log('✅ Task saved successfully after drag-and-drop');
                } catch (error) {
                    console.error('❌ Failed to save task after drag-and-drop:', error);
                    // Revert the change if save failed
                    this.draggedTask.column = oldColumn;
                    this.draggedTask.status = oldColumn;
                    this.tasks[taskIndex].column = oldColumn;
                    this.tasks[taskIndex].status = oldColumn;
                    this.showMessage('Failed to move task. Please try again.', 'error');
                    return;
                }
            }

            // Re-render board
            this.filterAndRenderTasks();

            // Show success message
            this.showMessage(`Task ${this.draggedTask.id} moved to ${targetColumn}`, 'success');

            console.log(`✅ Task ${this.draggedTask.id} moved from ${oldColumn} to ${targetColumn}`);
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
        
        // Load full task content from file if using file system
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
        
        // Initialize modal with task data
        this.populateTaskModal(task);
        
        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Set up modal event listeners
        this.setupTaskModalEventListeners(task);
    }
    
    // Method to open task by name/ID - used by router
    openTaskByName(taskName) {
        console.log('Looking for task:', taskName);
        
        // Try to find task in current tasks array
        const task = this.tasks.find(t => 
            t.id === taskName || 
            t.title === taskName ||
            t.id.toLowerCase() === taskName.toLowerCase() ||
            t.title.toLowerCase() === taskName.toLowerCase()
        );
        
        if (task) {
            console.log('Found task:', task);
            this.openTaskDetail(task);
            
            // Update URL to include task name
            if (window.firaRouter) {
                const currentParams = window.firaRouter.getCurrentParams();
                if (currentParams.projectname && !currentParams.taskname) {
                    window.firaRouter.navigateTo(`/project/${encodeURIComponent(currentParams.projectname)}/${encodeURIComponent(taskName)}`, true);
                }
            }
        } else {
            console.warn('Task not found:', taskName);
            // Show a message to user
            this.showMessage(`Task "${taskName}" not found in project "${this.currentProject.name}"`, 'error');
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
        
        // Update assignee dropdown with current project developers
        this.updateAssigneeDropdown('Unassigned');
        
        // Set edit mode as default
        const editBtn = document.getElementById('createEditModeBtn');
        const previewBtn = document.getElementById('createPreviewModeBtn');
        const toolbar = document.getElementById('createEditorToolbar');
        const preview = document.getElementById('createTaskDescriptionPreview');
        
        if (editBtn) editBtn.classList.add('active');
        if (previewBtn) previewBtn.classList.remove('active');
        if (toolbar) toolbar.style.display = 'block';
        if (preview) preview.style.display = 'none';
        if (descriptionEditor) descriptionEditor.style.display = 'block';
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
                document.getElementById('createEditorToolbar').style.display = 'block';
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
        
        taskAssignee.value = task.developer || '';
        taskEstimate.value = task.timeEstimate || '0';
        taskCreated.value = task.created || new Date().toISOString().split('T')[0];
        taskTimeSpent.value = task.timeSpent || '';
        if (taskPriority) taskPriority.value = task.priority || 'low';
        if (taskPrioritySelect) taskPrioritySelect.value = task.priority || 'low';
        
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
        // Update assignee dropdown with current project developers
        this.updateAssigneeDropdown(task.developer || 'Unassigned');
        
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
    
    updateAssigneeDropdown(selectedAssignee = 'Unassigned') {
        // Get all developers from current tasks
        const developers = new Set();
        
        // Add developers from all tasks in the current project
        this.tasks.forEach(task => {
            if (task.developer && task.developer.trim()) {
                developers.add(task.developer.trim());
            }
            if (task.assignee && task.assignee.trim()) {
                developers.add(task.assignee.trim());
            }
        });
        
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
        
        // Rich text editor toolbar
        document.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleToolbarAction(btn.dataset.command, descriptionEditor);
            });
        });
        
        // Character counter and live preview update
        if (descriptionEditor) {
            let debounceTimer;
            descriptionEditor.addEventListener('input', () => {
                this.updateCharacterCounter();
                
                // Debounced preview update to avoid excessive updates
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.updateLivePreview();
                }, 300);
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
        
        addCommentBtn.addEventListener('click', () => {
            this.addComment(task, commentInput.value);
        });
        
        commentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.addComment(task, commentInput.value);
            }
        });
        
        // Image upload
        const imageUploadArea = document.querySelector('.image-upload-area');
        const imageUpload = document.getElementById('imageUpload');
        
        if (imageUploadArea && imageUpload) {
            imageUploadArea.addEventListener('click', () => {
                imageUpload.click();
            });
            
            imageUpload.addEventListener('change', (e) => {
                this.handleImageUpload(e.target.files[0]);
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
                replacement = selectedText ? `# ${selectedText}` : '# ';
                cursorOffset = selectedText ? 0 : 0;
                break;
            case 'h2':
                replacement = selectedText ? `## ${selectedText}` : '## ';
                cursorOffset = selectedText ? 0 : 0;
                break;
            case 'h3':
                replacement = selectedText ? `### ${selectedText}` : '### ';
                cursorOffset = selectedText ? 0 : 0;
                break;
            case 'ul':
                replacement = this.handleListInsertion(textBefore, selectedText, textAfter, '- ');
                break;
            case 'ol':
                replacement = this.handleListInsertion(textBefore, selectedText, textAfter, '1. ');
                break;
            case 'quote':
                replacement = selectedText ? `> ${selectedText}` : '> ';
                cursorOffset = selectedText ? 0 : 0;
                break;
            case 'link':
                replacement = selectedText ? `[${selectedText}]()` : `[]()`;
                cursorOffset = selectedText ? -1 : -3;
                break;
            case 'image':
                replacement = selectedText ? `![${selectedText}]()` : `![]()`;
                cursorOffset = selectedText ? -1 : -3;
                break;
        }
        
        // Handle complex replacements for lists only
        if (['ul', 'ol'].includes(command)) {
            editor.value = replacement;
            const searchText = selectedText || 'List item';
            const newCursorPos = replacement.indexOf(searchText);
            if (newCursorPos !== -1) {
                editor.setSelectionRange(newCursorPos, newCursorPos + searchText.length);
            }
        } else {
            // Handle all other commands including headings and quotes
            // For headings and quotes, ensure they start on a new line if needed
            if (['h1', 'h2', 'h3', 'quote'].includes(command)) {
                const needsNewLineBefore = start > 0 && !textBefore.endsWith('\n');
                const needsNewLineAfter = end < editor.value.length && !textAfter.startsWith('\n');
                
                const finalReplacement = 
                    (needsNewLineBefore ? '\n' : '') + 
                    replacement + 
                    (needsNewLineAfter ? '\n' : '');
                
                editor.setRangeText(finalReplacement, start, end, 'select');
                
                // Position cursor appropriately
                const newPos = start + finalReplacement.length + cursorOffset + (needsNewLineBefore ? 1 : 0);
                editor.setSelectionRange(newPos, newPos);
            } else {
                // For other commands (bold, italic, code, links, images)
                editor.setRangeText(replacement, start, end, 'select');
                if (cursorOffset !== 0) {
                    const newPos = start + replacement.length + cursorOffset;
                    editor.setSelectionRange(newPos, newPos);
                }
            }
        }
        
        editor.focus();
        
        // Update character counter and trigger preview update
        this.updateCharacterCounter();
        
        // Trigger input event for any listeners
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Helper method to ensure proper line spacing
    ensureNewLine(text, isAfter = false) {
        if (isAfter) {
            return text.endsWith('\n') ? '' : '\n';
        }
        return text === '' || text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
    }
    
    // Helper method for list insertion
    handleListInsertion(textBefore, selectedText, textAfter, listPrefix) {
        const lines = selectedText ? selectedText.split('\n') : ['List item'];
        const listItems = lines.map((line, index) => {
            const prefix = listPrefix.includes('1.') ? `${index + 1}. ` : listPrefix;
            return prefix + (line.trim() || `List item ${index + 1}`);
        }).join('\n');
        
        return textBefore + this.ensureNewLine(textBefore) + listItems + this.ensureNewLine(textAfter, true) + textAfter;
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
        // Convert time string like "2h" or "30m" to minutes
        const match = timeStr.match(/(\d+)([hm])/);
        if (match) {
            const value = parseInt(match[1]);
            const unit = match[2];
            return unit === 'h' ? value * 60 : value;
        }
        return 0;
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
        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
        }
        return `${minutes}m`;
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
                user: 'Mary Johnson',
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
    
    addComment(task, comment) {
        if (!comment.trim()) return;
        
        const commentInput = document.getElementById('commentInput');
        const activityFeed = document.getElementById('activityFeed');
        
        // Add new comment to activity feed
        const newActivity = document.createElement('div');
        newActivity.className = 'activity-item';
        newActivity.innerHTML = `
            <div class="activity-avatar">
                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM4YjVjZjYiLz4KPHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI3IiB5PSI3Ij4KPHBhdGggZD0iTTEwIDEwYzIuMjEgMCA0LTEuNzkgNC00cy0xLjc5LTQtNC00LTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIgZmlsbD0iI0ZGRiIvPgo8L3N2Zz4KPC9zdmc+" alt="You" />
            </div>
            <div class="activity-content">
                <div class="activity-text">
                    <strong>You</strong> commented: "${comment}"
                </div>
                <div class="activity-time">just now</div>
            </div>
        `;
        
        activityFeed.appendChild(newActivity);
        commentInput.value = '';
        
        // Scroll to bottom of activity feed
        activityFeed.scrollTop = activityFeed.scrollHeight;
    }
    
    handleImageUpload(file) {
        if (!file) return;
        
        if (file.type.startsWith('image/')) {
            // In a real app, you would upload the image to a server
            // For now, just show a success message
            this.showMessage('Image upload functionality would be implemented here', 'info');
        } else {
            this.showMessage('Please select an image file', 'error');
        }
    }
    
    async saveTaskDirectly(task) {
        console.log(`💾 saveTaskDirectly: Saving task ${task.id} to individual file`);

        try {
            // Ensure task has correct projectId
            if (!task.projectId && this.currentProject) {
                task.projectId = this.currentProject.id;
                console.log(`🔧 Added projectId ${task.projectId} to task ${task.id}`);
            }

            const projectId = task.projectId || this.currentProject.id;

            // Primary method: Save directly to individual task file via globalDataManager
            if (window.globalDataManager && window.globalDataManager.updateTask) {
                console.log(`💾 Saving task ${task.id} to individual file via globalDataManager.updateTask`);
                await window.globalDataManager.updateTask(projectId, task);
                console.log(`✅ Task ${task.id} saved to individual file: ${task.id}.md`);

                // Update local task data immediately
                const taskIndex = this.tasks.findIndex(t => t.id === task.id);
                if (taskIndex !== -1) {
                    this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...task };
                    console.log(`🔄 Updated local task data for ${task.id}`);
                }

                return;
            }

            // Fallback: save all tasks to disk (less optimal but ensures data persistence)
            console.log('⚠️ Fallback: saving all tasks to disk');
            await this.saveTasksToDisk();
            console.log(`✅ Task ${task.id} saved via saveTasksToDisk fallback`);

        } catch (error) {
            console.error(`❌ Failed to save task ${task.id} to individual file:`, error);
            throw error;
        }
    }

    async saveTaskChanges(task, options = { closeAfterSave: true }) {
        // Collect all form data
        const taskNameInput = document.getElementById('taskNameInput');
        const descriptionEditor = document.getElementById('taskDescriptionEditor');
        const taskAssignee = document.getElementById('taskAssignee');
        const taskEstimate = document.getElementById('taskEstimate');
        const taskTimeSpent = document.getElementById('taskTimeSpent');
        const taskPriority = document.getElementById('taskPriority');
        const activeTypeBtn = document.querySelector('.type-btn.active');
        
        // Update task object with full content
        task.title = taskNameInput.value;
        task.content = descriptionEditor.value; // Short content for display
        task.fullContent = descriptionEditor.value; // Full content for file saving
        task.developer = taskAssignee.value;
        task.assignee = taskAssignee.options[taskAssignee.selectedIndex].text;
        // Normalize time values
        const normalizeTime = (value) => {
            if (!value || value === '' || value === '0') return '0h';
            if (typeof value === 'number') return `${value}h`;
            if (value.endsWith('h')) return value;
            return `${value}h`;
        };
        
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
        task.type = activeTypeBtn ? activeTypeBtn.dataset.type : 'task';
        
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
                // 3) Fallback to localStorage cache (guaranteed)
                const key = `fira:tasks:${this.currentProject ? this.currentProject.id : 'default'}`;
                const payload = {
                    tasks: this.tasks,
                    savedAt: new Date().toISOString()
                };
                localStorage.setItem(key, JSON.stringify(payload));
                console.warn('Task persisted to localStorage fallback:', key);
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
        
        // Re-render the board to reflect changes
        console.log(`🎨 About to re-render board after task update`);
        this.checkForDuplicates('before final render in saveTaskUpdates'); 
        this.filterAndRenderTasks();
        
        // Show success message
        this.showMessage('Task updated successfully', 'success');

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

    setupTimeTrackingClickHandler() {
        // Use event delegation to handle clicks on time tracking sections
        document.addEventListener('click', (e) => {
            const timeTrackingSection = e.target.closest('.time-tracking-section');
            if (timeTrackingSection) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Time tracking section clicked');
                
                // Find the current task being edited
                const taskModal = e.target.closest('#taskDetailModal');
                if (taskModal && this.currentTask) {
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
                        
                        // Initialize time tracking manager if needed
                        if (!window.timeTrackingManager) {
                            window.timeTrackingManager = new TimeTrackingManager();
                        }
                        window.timeTrackingManager.openModal(freshTask);
                    } else {
                        console.error('timeTrackingModal element not found');
                    }
                } else {
                    console.error('Task modal or currentTask not found');
                    console.log('taskModal:', taskModal);
                    console.log('this.currentTask:', this.currentTask);
                }
            }
        });
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

    convertMarkdownToHTML(markdown) {
        // Simple markdown to HTML converter for basic formatting
        let html = markdown
            // Headers
            .replace(/^### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^## (.+)$/gm, '<h3>$1</h3>')
            .replace(/^# (.+)$/gm, '<h2>$1</h2>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Lists
            .replace(/^- \[ \] (.+)$/gm, '<div style="margin: 4px 0;"><input type="checkbox" disabled style="margin-right: 8px;">$1</div>')
            .replace(/^- \[x\] (.+)$/gm, '<div style="margin: 4px 0;"><input type="checkbox" checked disabled style="margin-right: 8px;">$1</div>')
            .replace(/^- (.+)$/gm, '<div style="margin: 4px 0; margin-left: 16px;">• $1</div>')
            // Links
            .replace(/\[\[([^\]]+)\]\]/g, '<span style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 12px;">$1</span>')
            // Line breaks
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
            
        return html;
    }


    openEditProjectModal() {
        if (!this.currentProject) {
            this.showMessage('No project selected', 'error');
            return;
        }

        // Get full project data from global data manager
        let projectData = this.currentProject;
        if (window.globalDataManager) {
            const fullProject = window.globalDataManager.getProjects().find(p => p.id === this.currentProject.id);
            if (fullProject) {
                projectData = fullProject;
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
            if (window.globalDataManager && typeof window.globalDataManager.updateProject === 'function') {
                console.log('✅ Using existing globalDataManager.updateProject');
                console.log('📊 Loading mode:', window.globalDataManager.loadingMode);
                console.log('📁 Directory handle:', !!window.globalDataManager.directoryHandle);
                await window.globalDataManager.updateProject(this.currentProject.id, updatedData);
                console.log('✅ globalDataManager.updateProject completed successfully');
            } else if (window.GlobalDataManager && !window.globalDataManager) {
                // Initialize globalDataManager if not already done
                console.log('🔄 Initializing globalDataManager for project update');
                window.globalDataManager = new GlobalDataManager();
                await window.globalDataManager.initialize();
                console.log('✅ globalDataManager initialized, loading mode:', window.globalDataManager.loadingMode);
                if (typeof window.globalDataManager.updateProject === 'function') {
                    console.log('✅ Calling updateProject after initialization');
                    await window.globalDataManager.updateProject(this.currentProject.id, updatedData);
                    console.log('✅ updateProject completed successfully after initialization');
                } else {
                    console.warn('⚠️ updateProject method still not available after initialization');
                    throw new Error('updateProject method not available after initialization');
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
            
            // Update page title
            document.getElementById('projectName').textContent = updatedData.name;
            
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
    }
    
    updateAnalyticsMetrics() {
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(task => task.column === 'done').length;
        const inProgressTasks = this.tasks.filter(task => task.column === 'progress').length;
        const blockedTasks = this.tasks.filter(task => task.column === 'review' || task.column === 'testing').length;
        
        // Calculate completion rate
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        // Calculate total time spent and estimated
        const totalSpent = this.tasks.reduce((sum, task) => sum + this.parseTime(task.timeSpent || '0h'), 0);
        const totalEstimated = this.tasks.reduce((sum, task) => sum + this.parseTime(task.timeEstimate || '0h'), 0);
        
        // Update DOM elements
        document.getElementById('totalTasksMetric').textContent = totalTasks;
        document.getElementById('completedTasksMetric').textContent = completedTasks;
        document.getElementById('inProgressTasksMetric').textContent = inProgressTasks;
        document.getElementById('blockedTasksMetric').textContent = blockedTasks;
        document.getElementById('completionRateMetric').textContent = `${completionRate}%`;
        document.getElementById('totalTimeSpentMetric').textContent = this.formatTime(totalSpent);
        document.getElementById('totalTimeEstimatedMetric').textContent = this.formatTime(totalEstimated);
    }
    
    renderStatusChart() {
        const ctx = document.getElementById('statusChart');
        if (!ctx) return;
        
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
        const ctx = document.getElementById('timeChart');
        if (!ctx) return;
        
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
        const ctx = document.getElementById('developerChart');
        if (!ctx) return;
        
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
        const developerStatsContainer = document.getElementById('developerStatsContainer');
        if (!developerStatsContainer) return;
        
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
}

// Modal close functions
// Replace async closeTaskModal() with non-blocking close + background save
function closeTaskModal() {
    try {
        if (window.projectBoard && window.projectBoard.currentTask) {
            // Save edits in background but DO NOT ask saveTaskChanges to close the modal itself
            window.projectBoard.saveTaskChanges(window.projectBoard.currentTask, { closeAfterSave: false })
                .catch(err => console.error('saveTaskChanges (on close) failed:', err));
        }

        if (window.projectBoard) {
            // Persist all tasks in background
            window.projectBoard.saveTasksToDisk()
                .then(() => console.log('Tasks persisted (on close)'))
                .catch(err => console.error('saveTasksToDisk (on close) failed:', err));
            // clear currentTask reference so UI can reopen safely later
            window.projectBoard.currentTask = null;
        }
    } finally {
        const modal = document.getElementById('taskDetailModal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = 'auto';
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

// Handle escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Try to close task modal and save
        closeTaskModal().catch(err => console.error(err));
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
    setTimeout(() => {
        board.setupDropZones();
    }, 100);
}

// Function to initialize project board with specific project for router
window.initProjectBoard = function(projectName, taskName = null) {
    console.log('Initializing project board for:', projectName, taskName ? 'with task:' + taskName : '');
    
    // Use existing global instance if available, otherwise create new one
    let board = window.projectBoard;
    if (!board) {
        console.log(`🆕 No existing ProjectBoard instance, creating new one`);
        board = new ProjectBoard();
        window.projectBoard = board; // Ensure it's globally available
    } else {
        console.log(`♻️ Using existing ProjectBoard instance`);
        // Reset tasks loaded flag for new project
        board.tasksLoaded = false;
    }
    
    // Wait for global data to be loaded if needed
    if (window.globalDataManager && window.globalDataManager.isDataLoaded()) {
        
        // Override the project loading logic
        if (window.PROJECTS_DATA) {
            board.currentProject = window.PROJECTS_DATA.find(p => p.id === projectName) || { id: projectName, name: decodeURIComponent(projectName) };
        } else {
            board.currentProject = { id: projectName, name: decodeURIComponent(projectName) };
        }
        
        document.getElementById('projectName').textContent = board.currentProject.name;
        
        // Tasks are already loaded in init(), just filter and render
        board.filterAndRenderTasks();
        
        // Setup drop zones
        setTimeout(() => {
            board.setupDropZones();
            
            // If task name is provided, try to open that task
            if (taskName) {
                setTimeout(() => {
                    board.openTaskByName(decodeURIComponent(taskName));
                }, 200);
            }
        }, 100);
        
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
        
        setTimeout(() => {
            board.setupDropZones();
        }, 100);
    }
};

// Time Tracking Modal Functionality
class TimeTrackingManager {
    constructor() {
        this.currentTask = null;
        this.modal = null;
        this.isVisible = false;
        this.originalTimeSpent = '';
        
        this.init();
    }
    
    init() {
        this.modal = document.getElementById('timeTrackingModal');
        if (!this.modal) return;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Time spent input validation and real-time updates
        const timeSpentInput = document.getElementById('timeSpentInput');
        if (timeSpentInput) {
            timeSpentInput.addEventListener('input', (e) => {
                this.handleTimeSpentInputChange(e.target.value);
            });
            
            timeSpentInput.addEventListener('blur', () => {
                this.validateAndFormatTimeSpentInput();
            });
        }
        
        // Time original estimate input
        const timeOriginalInput = document.getElementById('timeOriginalInput');
        if (timeOriginalInput) {
            timeOriginalInput.addEventListener('input', (e) => {
                this.handleOriginalEstimateInputChange(e.target.value);
            });
            
            timeOriginalInput.addEventListener('blur', () => {
                this.validateAndFormatOriginalEstimateInput();
            });
        }
        
        // Save button
        const saveBtn = document.getElementById('saveTimeTrackingBtn');
        if (saveBtn) {
            console.log('✅ TimeTrackingManager: Save button found and event listener attached');
            saveBtn.addEventListener('click', () => {
                console.log('🔘 TimeTrackingManager: Save button clicked');
                this.handleSaveTimeTracking();
            });
        } else {
            console.error('❌ TimeTrackingManager: Save button not found!');
        }
        
        // Modal backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
        
        // Keyboard handlers
        document.addEventListener('keydown', (e) => {
            if (this.isVisible) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeModal();
                } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    this.handleSaveTimeTracking();
                }
            }
        });
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
                    totalMinutes += value * 7 * 24 * 60; // weeks to minutes
                    break;
                case 'd':
                    breakdown.days += value;
                    totalMinutes += value * 24 * 60; // days to minutes
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
        if (!totalMinutes || totalMinutes <= 0) return '0m';
        
        const weeks = Math.floor(totalMinutes / (7 * 24 * 60));
        const days = Math.floor((totalMinutes % (7 * 24 * 60)) / (24 * 60));
        const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
        const minutes = totalMinutes % 60;
        
        const parts = [];
        if (weeks > 0) parts.push(`${weeks}w`);
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        
        return parts.join(' ') || '0m';
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
        if (!this.isVisible) return;
        
        this.modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        this.isVisible = false;
        this.currentTask = null;
        this.originalTimeSpent = '';
        
        // Reset form
        this.resetForm();
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
                timeDisplay.textContent = `${updatedTask.timeSpent}/${updatedTask.timeEstimate}`;
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
}


// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize assignee dropdown and estimate input if elements exist
    if (document.getElementById('assigneeDropdown') || document.getElementById('estimateInput')) {
        window.assigneeDropdownManager = new AssigneeDropdownManager();
    }
});
console.log('📋 window.initProjectBoard available:', typeof window.initProjectBoard);

// Global functions for create task detail modal
window.closeCreateTaskDetailModal = function() {
    const modal = document.getElementById('createTaskDetailModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
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
        
        // Determine correct column/folder based on assignment
        let targetColumn = 'backlog';
        let targetFolder = 'backlog';
        
        // If task is assigned to someone, put it in their progress folder
        if (assigneeSelected !== 'Unassigned') {
            targetColumn = 'progress';
            targetFolder = `progress/${assigneeSelected}`;
        }
        
        // Create task data
        const taskData = {
            id: projectBoard.generateTaskId(),
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
            file_path: `${targetFolder}/${projectBoard.generateTaskId()}.md`
        };
        
        // Create markdown content with YAML frontmatter
        const yamlFrontmatter = `---
title: ${taskData.title}
estimate: ${taskData.timeEstimate}
spent_time: ${taskData.timeSpent}
priority: ${taskData.priority}
developer: ${taskData.developer}
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
        
        if (window.globalDataManager && window.globalDataManager.apiClient) {
            // First check if server is available
            console.log('🔄 Checking server status before creating task...');
            const isServerAvailable = await window.globalDataManager.apiClient.checkServerStatus();
            console.log('Server available:', isServerAvailable);
            
            if (!isServerAvailable) {
                throw new Error('Server is not available. Please make sure the server is running on port 8080.');
            }
            
            try {
                // Create task via API
                console.log('📡 Calling createTask API...');
                const result = await window.globalDataManager.apiClient.createTask(
                    projectBoard.currentProject.id, 
                    taskData
                );
                
                console.log('API createTask result:', result);
                
                if (result === true) {
                    console.log('✅ Task created successfully');
                    
                    // Close the create task modal
                    window.closeCreateTaskDetailModal();
                    
                    // Instead of modifying projectBoard.tasks directly (which affects all projects),
                    // let's reload tasks for the current project only
                    console.log('🔄 Reloading tasks for current project after task creation');
                    
                    // Reset the tasksLoaded flag to allow reloading
                    projectBoard.tasksLoaded = false;
                    
                    await projectBoard.loadProjectTasks();
                    projectBoard.filterAndRenderTasks();
                    
                    // Show success message with assignment info
                    let successMessage = `Task "${taskData.title}" created successfully`;
                    if (taskData.assignee) {
                        successMessage += ` and assigned to ${taskData.assignee}`;
                    }
                    
                    projectBoard.showMessage(successMessage, 'success');
                    
                    // Make sure we're back to the board view (not task detail view)
                    console.log('📋 Returned to task board after creating task');
                    
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
