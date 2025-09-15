// Global data storage for projects and tasks
// This file manages all data loading and storage for the entire application

// Prevent double declaration when loaded via server
if (typeof GlobalDataManager === 'undefined') {
class GlobalDataManager {
    constructor() {
        this.projects = [];
        this.allTasks = []; // All tasks from all projects
        this.projectTasks = {}; // Tasks organized by project ID
        this.isLoaded = false;
        this.loadingMode = 'static'; // 'static', 'filesystem', 'server', or 'cache'
        this.fileSystemLoader = null;
        this.apiClient = null;
        // Keep file handles so we can write back to the exact files
        this.fileHandles = {};
        // Cache management
        this.cacheFileName = 'fira-cache.json';
        this.cacheTimestamp = null;
        this.requiresServerScan = false;
        // Store directory handle persistently
        this.directoryHandle = null;
        // Cache developers for each project
        this.projectDevelopers = {};
        
        // Loading screen visibility flag
        this.shouldShowLoading = true; // Default to showing loading screen
        
        // Check if there's a global directory handle from another page
        if (window.firaDirectoryHandle) {
            this.directoryHandle = window.firaDirectoryHandle;
            console.log('🔗 Found shared directory handle from another page');
        }
        
        // Setup automatic refresh on window focus
        this.setupAutoRefresh();
    }

    setupAutoRefresh() {
        // Auto-refresh when user comes back to the page (after potentially deleting files)
        if (typeof window !== 'undefined') {
            window.addEventListener('focus', async () => {
                // Only auto-refresh if we have a directory and data is loaded
                if (this.directoryHandle && this.isLoaded && this.loadingMode.includes('directory')) {
                    console.log('🔄 Window focus detected - auto-refreshing projects...');
                    try {
                        await this.refreshProjects();
                        
                        // Notify any active dashboard to update
                        if (window.refreshProjects && typeof window.refreshProjects === 'function') {
                            // Don't call refreshProjects as it would double-refresh
                            // Instead trigger a render update
                            if (window.renderProjects && typeof window.renderProjects === 'function') {
                                window.renderProjects();
                            }
                        }
                    } catch (error) {
                        console.warn('Auto-refresh on focus failed:', error);
                    }
                }
            });
        }
    }

    async initialize(forceReload = false) {
        // Skip initialization if data is already loaded (unless forced)
        if (!forceReload && this.isLoaded) {
            console.log('✅ Data already loaded, skipping initialization');
            return;
        }
        
        // Initialize API client
        if (window.firaAPIClient) {
            this.apiClient = window.firaAPIClient;
        }

        if (forceReload) {
            console.log('🔄 Force reload requested, clearing cached data');
            this.projects = [];
            this.allTasks = [];
            this.projectTasks = {};
            this.isLoaded = false;
            
            // Clear session storage to prevent stale data restoration
            try {
                sessionStorage.removeItem('fira-session-data');
            } catch (e) {
                console.warn('Could not clear session storage:', e);
            }
        }

        try {
            // First, try to restore previously selected directory (if available)
            console.log('🔄 Checking for previously selected directory...');
            
            if (!forceReload && await this.tryRestoreDirectory()) {
                console.log('✅ Successfully restored projects from previous directory selection');
                this.isLoaded = true;
                this.notifyDataLoaded();
                return;
            }
            
            // Check if this is the web version (server-based vs file-based)
            const currentHostname = window.location.hostname;
            const protocol = window.location.protocol;
            
            // Consider it web version if:
            // 1. Specific production hostname
            // 2. Has API client available with HTTP protocol (includes localhost servers)
            // 3. HTTP/HTTPS protocol with actual hostname (but not file://)
            const isWeb = currentHostname.includes("onix-systems-android-tasks") || 
                         (!!this.apiClient && protocol.startsWith('http')) ||
                         (protocol.startsWith('http') && currentHostname);
                         
            console.log(`🔍 Hostname: "${currentHostname}", Protocol: "${protocol}", API Client: ${!!this.apiClient}`);
            console.log(`🔍 Determined isWeb: ${isWeb}`);
            
            // For web version, add small delay to ensure all scripts loaded
            if (isWeb) {
                console.log('🌐 Web version - adding initialization delay...');
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            if (isWeb) {
                console.log('🌐 Web hostname detected - skipping directory selection and loading from server');
                console.log('🔧 API Client status:', {
                    hasApiClient: !!this.apiClient,
                    apiClientUrl: this.apiClient?.baseUrl
                });
                
                // For web version, directly try to load from server without directory selection
                console.log('🔧 Web mode - API client details:', {
                    hasApiClient: !!this.apiClient,
                    baseUrl: this.apiClient?.baseUrl
                });
                
                if (this.apiClient) {
                    console.log('🔄 Web version detected - checking server availability...');
                    
                    // Check if we're staying on the same project page (refresh case)
                    const currentPath = window.location.pathname;
                    const isProjectPage = currentPath.startsWith('/project/');
                    this.shouldShowLoading = !isProjectPage;
                    
                    if (this.shouldShowLoading) {
                        console.log('🔄 Showing loading screen for navigation to new page');
                        // Notify loading manager to show if available
                        if (window.loadingManager && !window.loadingManager.isShowing) {
                            window.loadingManager.show();
                        }
                        
                        // Update loading step
                        if (window.loadingManager) {
                            window.loadingManager.setActiveStep('server-check');
                        }
                    } else {
                        console.log('🔄 Project page refresh detected - loading silently in background');
                    }
                    
                    try {
                        // First check if server is available
                        await this.apiClient.checkServerStatus();
                        
                        if (this.apiClient.isServerAvailable) {
                            console.log('✅ Server is available, loading from server...');
                            
                            // Complete server check step
                            if (window.loadingManager && this.shouldShowLoading) {
                                window.loadingManager.completeStep('server-check');
                                window.loadingManager.setActiveStep('projects-load');
                            }
                            
                            await this.loadFromServerAndCache();
                            
                            // Ensure we're in server mode after loading
                            this.loadingMode = 'server';
                            console.log(`✅ Server data loaded: ${this.projects.length} projects, mode: ${this.loadingMode}`);
                            
                            // If it's localhost, check if user has already made a choice
                            if (currentHostname.includes('localhost') || currentHostname.includes('127.0.0.1')) {
                                const previousModeChoice = sessionStorage.getItem('fira-mode-selected');
                                console.log('🔄 Localhost detected - checking previous mode choice:', previousModeChoice);
                                
                                if (previousModeChoice === 'server') {
                                    console.log('🔄 User previously chose server mode, skipping directory selection');
                                    this.loadingMode = 'server';
                                    console.log(`✅ Using SERVER mode (from previous choice). Tasks will be created on the server.`);
                                } else if (previousModeChoice === 'directory') {
                                    // Try to restore previous directory selection
                                    const previousDirSelected = sessionStorage.getItem('fira-directory-selected');
                                    if (previousDirSelected === 'true' && window.firaDirectoryHandle) {
                                        console.log('🔄 Restoring previous directory selection...');
                                        const projects = await this.scanDirectoryForProjects(window.firaDirectoryHandle);
                                        if (projects.length > 0) {
                                            this.projects = this.filterDeletedProjects(projects);
                                            this.loadingMode = 'directory-picker';
                                            await this.loadTasksForProjects(window.firaDirectoryHandle);
                                            console.log(`✅ Restored directory mode, loaded ${this.projects.length} projects and ${this.allTasks.length} tasks`);
                                            this.isLoaded = true;
                                            this.notifyDataLoaded();
                                            return;
                                        }
                                    }
                                    // If can't restore directory, fall through to ask again
                                }
                                
                                // If no previous choice or can't restore, use server mode by default
                                if (!previousModeChoice) {
                                    console.log('🔄 No previous choice found - defaulting to server mode...');
                                    sessionStorage.setItem('fira-mode-selected', 'server');
                                    this.loadingMode = 'server';
                                    console.log(`✅ Using SERVER mode (default). Tasks will be created in projects/ directory on server.`);
                                }
                            }
                            
                            console.log(`✅ Successfully loaded from server (mode: ${this.loadingMode})`);
                            this.isLoaded = true;
                            this.notifyDataLoaded();
                            return;
                        } else {
                            console.log('⚠️ Server is not available, falling back to static data');
                            this.loadFromStaticData();
                            this.isLoaded = true;
                            this.notifyDataLoaded();
                            return;
                        }
                    } catch (error) {
                        console.error('❌ Failed to connect to server:', error);
                        console.log('⚠️ Falling back to static data for web version');
                        
                        // Show error in loading manager
                        if (window.loadingManager) {
                            window.loadingManager.setError('Не вдалося підключитися до сервера. Використовуються статичні дані.');
                        }
                        
                        // Ensure static data is loaded
                        this.loadFromStaticData();
                        
                        // Double check that we have data
                        if (this.projects.length === 0) {
                            console.log('⚠️ No static projects available, creating emergency fallback');
                            this.projects = [{
                                id: 'demo-project',
                                name: 'Demo Project',
                                description: 'Demo project for web version (server unavailable)',
                                path: 'demo-project',
                                tasksCount: { backlog: 1, progress: 0, review: 0, testing: 0, done: 0 },
                                totalTasks: 1,
                                lastModified: new Date().toISOString(),
                                developers: ['demo-user']
                            }];
                            this.allTasks = [{
                                id: 'DEMO-001',
                                title: 'Demo Task',
                                column: 'backlog',
                                content: 'This is a demo task shown when the server is not available.',
                                projectId: 'demo-project',
                                assignee: 'demo-user',
                                priority: 'medium'
                            }];
                            this.projectTasks = { 'demo-project': this.allTasks };
                        }
                        
                        this.isLoaded = true;
                        this.notifyDataLoaded();
                        console.log(`✅ Fallback complete: ${this.projects.length} projects, ${this.allTasks.length} tasks`);
                        return;
                    }
                } else {
                    console.log('⚠️ No API client available for web version, falling back to static data');
                    this.loadFromStaticData();
                    
                    // Ensure we have data even without API client
                    if (this.projects.length === 0) {
                        console.log('⚠️ Creating emergency fallback data (no API client)');
                        this.projects = [{
                            id: 'demo-project',
                            name: 'Demo Project',
                            description: 'Demo project for web version (no API client)',
                            path: 'demo-project',
                            tasksCount: { backlog: 1, progress: 0, review: 0, testing: 0, done: 0 },
                            totalTasks: 1,
                            lastModified: new Date().toISOString(),
                            developers: ['demo-user']
                        }];
                        this.allTasks = [{
                            id: 'DEMO-001',
                            title: 'Demo Task',
                            column: 'backlog',
                            content: 'This is a demo task shown when API client is not available.',
                            projectId: 'demo-project',
                            assignee: 'demo-user',
                            priority: 'medium'
                        }];
                        this.projectTasks = { 'demo-project': this.allTasks };
                    }
                    
                    this.isLoaded = true;
                    this.notifyDataLoaded();
                    console.log(`✅ No API client fallback complete: ${this.projects.length} projects, ${this.allTasks.length} tasks`);
                    return;
                }
            }
            
            console.log('🔄 Not web hostname - continuing with standard flow');
            
            // If no previous directory available, prompt user for directory selection
            console.log('🔄 No previous directory found, prompting user to select working directory...');
            
            if (await this.selectNewDirectory()) {
                console.log('✅ Successfully loaded projects from selected directory');
                this.isLoaded = true;
                this.notifyDataLoaded();
                return;
            }

            // Check if server is available as fallback (but not for file:// protocol)
            if (window.location.protocol !== 'file:' && this.apiClient && await this.apiClient.checkServerStatus()) {
                console.log('🔄 Server available - loading real-time data from file system');
                await this.loadFromServerAndCache();
                this.isLoaded = true;
                this.notifyDataLoaded();
                return;
            }
            
            // If user cancelled directory selection, show friendly message
            console.log('⚠️ No directory selected, no projects available');
            this.projects = [];
            this.allTasks = [];
            this.projectTasks = {};
            this.loadingMode = 'no-directory';
            
            // Show user-friendly message about what to do next
            setTimeout(() => {
                this.showNoDirectoryMessage();
            }, 500);
            
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.loadFromStaticData();
            this.isLoaded = true;
            this.notifyDataLoaded();
        }
    }


    async tryAutoProjectsScanner() {
        if (!window.autoProjectsScanner) {
            console.log('Auto projects scanner not available');
            return false;
        }

        try {
            const success = await window.autoProjectsScanner.scanProjects();
            if (success) {
                // Load projects from auto scanner
                this.projects = this.filterDeletedProjects(window.autoProjectsScanner.getProjects());
                this.loadingMode = 'auto-scanner';
                
                // Create empty task structure for now
                this.allTasks = [];
                this.projectTasks = {};
                this.projects.forEach(project => {
                    this.projectTasks[project.id] = [];
                });
                
                console.log(`✅ Auto projects scanner: loaded ${this.projects.length} projects`);
                return true;
            } else {
                console.log('🔄 Auto projects scanner found no projects or failed');
            }
        } catch (error) {
            console.warn('Auto projects scanner failed:', error);
        }
        
        return false;
    }

    async tryRealFileSystemLoader() {
        if (!window.realFileSystemLoader) {
            console.log('Real file system loader not available');
            return false;
        }

        try {
            const success = await window.realFileSystemLoader.initialize();
            if (success) {
                // Load projects from real file system loader
                this.projects = this.filterDeletedProjects(window.realFileSystemLoader.getProjects());
                this.loadingMode = 'real-filesystem';
                
                // Create empty task structure for now
                this.allTasks = [];
                this.projectTasks = {};
                this.projects.forEach(project => {
                    this.projectTasks[project.id] = [];
                });
                
                console.log(`✅ Real file system loader: loaded ${this.projects.length} projects`);
                return true;
            } else {
                console.log('🔄 Real file system loader initialization failed');
            }
        } catch (error) {
            console.warn('Real file system loader failed:', error);
        }
        
        return false;
    }

    async tryJQueryFileLoader() {
        if (!window.jQueryFileLoader) {
            console.log('jQuery file loader not available');
            return false;
        }

        try {
            const success = await window.jQueryFileLoader.initialize();
            if (success) {
                // Load projects from jQuery file loader
                this.projects = this.filterDeletedProjects(window.jQueryFileLoader.getProjects());
                this.loadingMode = 'jquery-filesystem';
                
                // Create empty task structure
                this.allTasks = [];
                this.projectTasks = {};
                this.projects.forEach(project => {
                    this.projectTasks[project.id] = [];
                });
                
                console.log(`✅ jQuery file loader: loaded ${this.projects.length} projects`);
                return true;
            } else {
                console.log('🔄 jQuery file loader initialization failed, will use static data');
            }
        } catch (error) {
            console.warn('jQuery file loader failed:', error);
        }
        
        return false;
    }

    async tryRestoreDirectory() {
        // Only try directory operations for file:// protocol or localhost
        const currentHostname = window.location.hostname;
        const protocol = window.location.protocol;
        const isWebVersion = currentHostname.includes("onix-systems-android-tasks") || 
                           (protocol.startsWith('http') && currentHostname && !currentHostname.includes('localhost') && !currentHostname.includes('127.0.0.1'));
        
        if (isWebVersion) {
            console.log('🌐 Web version detected - skipping directory operations');
            return false;
        }
        
        // For file:// protocol, try to restore from sessionStorage (navigation between pages)
        if (window.location.protocol === 'file:') {
            console.log('🔄 File protocol detected - checking for session data...');
            
            try {
                const cachedData = sessionStorage.getItem('fira-session-data');
                if (cachedData) {
                    const sessionData = JSON.parse(cachedData);
                    
                    // Check if data is not too old (less than 30 minutes for navigation)
                    const dataAge = Date.now() - new Date(sessionData.timestamp).getTime();
                    if (dataAge < 1800000) { // 30 minutes
                        this.projects = sessionData.projects || [];
                        this.allTasks = sessionData.allTasks || [];
                        this.projectTasks = sessionData.projectTasks || {};
                        this.loadingMode = 'session-restored';
                        
                        console.log(`✅ Restored from session: ${this.projects.length} projects and ${this.allTasks.length} tasks`);
                        return true;
                    } else {
                        console.log('Session data is too old, removing...');
                        sessionStorage.removeItem('fira-session-data');
                    }
                } else {
                    console.log('No session data found');
                }
            } catch (error) {
                console.warn('Failed to restore from sessionStorage:', error);
                sessionStorage.removeItem('fira-session-data');
            }
            
            return false; // Prompt for directory selection
        }

        // Check if we have File System Access API
        if (!('showDirectoryPicker' in window)) {
            return false;
        }

        // Check if we already have a directory handle in memory
        if (this.directoryHandle) {
            try {
                // Verify handle is still valid by attempting to read it
                await this.directoryHandle.requestPermission({ mode: 'read' });
                
                // Reload projects from the stored directory handle
                const projects = await this.scanDirectoryForProjects(this.directoryHandle);
                if (projects.length > 0) {
                    this.projects = this.filterDeletedProjects(projects);
                    this.loadingMode = 'directory-picker';
                    
                    // Load all tasks for all projects
                    await this.loadTasksForProjects(this.directoryHandle);
                    console.log(`✅ Restored from memory: ${this.projects.length} projects and ${this.allTasks.length} tasks`);
                    
                    // Save to session for file:// protocol
                    this.saveToSession();
                    return true;
                }
            } catch (error) {
                console.warn('Stored directory handle is invalid:', error);
                this.directoryHandle = null;
            }
        }

        // Try to get stored directory handle - but this won't work due to security
        try {
            const storedHandle = localStorage.getItem('fira-directory-handle');
            if (!storedHandle) {
                return false;
            }

            // Parse the stored handle (this is browser-specific storage)
            if (this.directoryHandle) {
                console.log('🔄 Attempting to restore directory access...');
                
                // Try to verify we still have access
                try {
                    await this.directoryHandle.requestPermission({ mode: 'read' });
                    
                    // Scan the directory again
                    const projects = await this.scanDirectoryForProjects(this.directoryHandle);
                    await this.loadTasksForProjects(this.directoryHandle);
                    
                    if (projects.length > 0) {
                        this.projects = this.filterDeletedProjects(projects);
                        this.loadingMode = 'directory-restored';
                        return true;
                    }
                } catch (error) {
                    console.log('📁 Directory access lost, will prompt for new selection');
                    this.directoryHandle = null;
                    localStorage.removeItem('fira-directory-handle');
                }
            }
        } catch (error) {
            console.log('Failed to restore directory:', error);
        }

        return false;
    }


    async refreshProjects() {
        console.log('🔄 Refreshing projects...');
        
        // Clear developers cache on refresh
        this.projectDevelopers = {};
        console.log('🗑️ Cleared developers cache');
        
        // Check if we're in server mode first
        if (this.apiClient && this.loadingMode === 'server') {
            console.log('🔄 Server mode detected - refreshing from server instead of directory handle');
            try {
                // Use server API to reload projects and tasks
                await this.loadFromServerAndCache();
                
                // Notify listeners that data has changed
                this.notifyDataLoaded();
                
                console.log('✅ Successfully refreshed from server');
                return true;
            } catch (error) {
                console.error('❌ Error refreshing from server:', error);
                return false;
            }
        } else if (this.directoryHandle) {
            try {
                // Verify we still have access
                await this.directoryHandle.requestPermission({ mode: 'read' });
                
                // Rescan the directory
                const projects = await this.scanDirectoryForProjects(this.directoryHandle);
                
                if (projects.length >= 0) { // Allow zero projects
                    this.projects = this.filterDeletedProjects(projects);
                    await this.loadTasksForProjects(this.directoryHandle);
                    this.loadingMode = 'directory-refreshed';
                    
                    // Save to session for file:// protocol
                    this.saveToSession();
                    
                    // Notify listeners that data has changed
                    this.notifyDataLoaded();
                    
                    console.log(`✅ Refreshed: ${this.projects.length} projects and ${this.allTasks.length} tasks`);
                    return true;
                } else {
                    console.log('⚠️ No projects found after refresh');
                    return false;
                }
                
            } catch (error) {
                console.error('Error refreshing projects:', error);
                return false;
            }
        } else {
            console.log('⚠️ No directory handle available and not in server mode, asking user to select new directory');
            return await this.selectNewDirectory();
        }
    }

    async selectNewDirectory() {
        console.log('📁 Selecting new directory...');
        
        // Check if File System Access API is supported
        if (!('showDirectoryPicker' in window)) {
            console.log('❌ File System Access API not supported in this browser');
            this.showDirectorySelectionDialog(); // Shows unsupported message
            return false;
        }
        
        // Clear existing data
        this.directoryHandle = null;
        window.firaDirectoryHandle = null;
        sessionStorage.removeItem('fira-session-data');
        sessionStorage.removeItem('fira-directory-selected');
        
        // Show directory selection dialog and get directory handle directly
        const directoryHandle = await this.showDirectorySelectionDialog();
        
        if (directoryHandle) {
            console.log('🔄 User selected new directory, processing...');
            
            // Store directory handle for later use both in instance and globally
            this.directoryHandle = directoryHandle;
            window.firaDirectoryHandle = directoryHandle; // Share between pages
            
            // Store the fact that we have selected a directory
            sessionStorage.setItem('fira-directory-selected', 'true');
            sessionStorage.setItem('fira-directory-name', directoryHandle.name);
            
            // Try to sync directory with server if server is available
            let serverSyncSuccess = false;
            if (this.apiClient && await this.apiClient.checkServer()) {
                try {
                    console.log('🔄 Attempting to sync directory with server...');
                    // Get the directory path if possible
                    const directoryPath = directoryHandle.name; // This is just the folder name, not full path
                    
                    // For web File System API, we can't get full path for security reasons
                    // But we can try to set a relative path on the server
                    // The server should use the selected directory as base directory
                    console.log(`🔧 Setting server directory to: ${directoryPath}`);
                    
                    // Set working directory on server (this will fail gracefully if path doesn't exist on server)
                    await this.apiClient.setWorkingDirectory(directoryPath).catch(error => {
                        console.log('⚠️ Could not sync exact path with server (expected in browser mode):', error.message);
                    });
                    
                    // In hybrid mode, load projects from server instead of scanning directory
                    console.log('🔄 Loading projects from server...');
                    this.projects = await this.apiClient.getProjects();
                    this.loadingMode = 'hybrid'; // Browser directory + server API
                    serverSyncSuccess = true;
                    console.log('✅ Hybrid mode enabled: loaded projects from server API');
                } catch (error) {
                    console.log('⚠️ Server sync failed, scanning directory locally:', error.message);
                    // Fallback to scanning directory
                    const projects = await this.scanDirectoryForProjects(directoryHandle);
                    this.projects = projects;
                    this.loadingMode = 'directory-picker';
                }
            } else {
                console.log('⚠️ Server not available, scanning directory locally');
                // Fallback to scanning directory
                const projects = await this.scanDirectoryForProjects(directoryHandle);
                this.projects = projects;
                this.loadingMode = 'directory-picker';
            }
            
            if (this.projects.length > 0) {
                
                // Load all tasks for all projects
                console.log('🔍 Loading tasks for all projects...');
                await this.loadTasksForProjects(directoryHandle);
                
                console.log(`✅ New directory selected, loaded ${this.projects.length} projects and ${this.allTasks.length} tasks`);
                
                // Save to session
                this.saveToSession();
                
                // Notify listeners that data has changed
                this.notifyDataLoaded();
                return true;
            } else {
                console.log('⚠️ No projects found in selected directory');
                this.showNoProjectsMessage();
                return false;
            }
        }
        
        return false;
    }

    async scanDirectoryForProjects(directoryHandle) {
        const projects = [];
        console.log('🔍 Scanning directory for projects...');
        
        // First, check if there's a 'projects' subdirectory
        let projectsDir = null;
        
        try {
            projectsDir = await directoryHandle.getDirectoryHandle('projects');
            console.log('📁 Found projects/ subdirectory');
        } catch (error) {
            console.log('📁 No projects/ subdirectory, scanning root directory');
            projectsDir = directoryHandle;
        }
        
        // Scan directory for project folders
        for await (const [name, handle] of projectsDir.entries()) {
            if (handle.kind === 'directory') {
                const project = await this.scanProjectDirectory(name, handle);
                if (project) {
                    projects.push(project);
                }
            }
        }
        
        return projects;
    }

    async loadTasksForProjects(directoryHandle) {
        this.allTasks = [];
        this.projectTasks = {};

        // In hybrid mode, use server API instead of File System API
        if (this.loadingMode === 'hybrid' && this.apiClient) {
            console.log('🔄 Loading tasks via server API (hybrid mode)...');
            
            for (const project of this.projects) {
                try {
                    const tasks = await this.apiClient.getTasks(project.id);
                    this.projectTasks[project.id] = tasks;
                    this.allTasks.push(...tasks);
                    console.log(`📋 Loaded ${tasks.length} tasks for project ${project.id} via server`);
                } catch (error) {
                    console.warn(`Failed to load tasks for project ${project.id} from server:`, error);
                    this.projectTasks[project.id] = [];
                }
            }
            return;
        }

        // Original File System Access API logic for directory-picker mode
        // First, check if there's a 'projects' subdirectory
        let projectsDir = null;
        
        try {
            projectsDir = await directoryHandle.getDirectoryHandle('projects');
        } catch (error) {
            projectsDir = directoryHandle;
        }

        // Load tasks for each project
        for (const project of this.projects) {
            const projectTasks = [];
            
            try {
                const projectHandle = await projectsDir.getDirectoryHandle(project.id);
                
                // Load tasks from each column
                const columns = ['backlog', 'progress', 'inprogress', 'review', 'testing', 'done'];
                for (const columnName of columns) {
                    try {
                        const columnHandle = await projectHandle.getDirectoryHandle(columnName);
                        const columnTasks = await this.loadTasksFromColumn(columnHandle, columnName, project.id);
                        projectTasks.push(...columnTasks);
                    } catch (error) {
                        // Column doesn't exist, skip
                    }
                }
                
                this.projectTasks[project.id] = projectTasks;
                this.allTasks.push(...projectTasks);
                
                console.log(`📋 Loaded ${projectTasks.length} tasks for project ${project.id}`);
                
            } catch (error) {
                console.warn(`Failed to load tasks for project ${project.id}:`, error);
                this.projectTasks[project.id] = [];
            }
        }
    }

    async loadTasksFromColumn(columnHandle, columnName, projectId) {
        const tasks = [];
        
        // Handle both direct files and developer subdirectories
        for await (const [name, handle] of columnHandle.entries()) {
            if (handle.kind === 'file' && name.endsWith('.md') && name.toLowerCase() !== 'readme.md') {
                // Direct task file in column
                const task = await this.parseTaskFile(handle, columnName, projectId, null);
                if (task) tasks.push(task);
            } else if (handle.kind === 'directory' && !name.toLowerCase().includes('readme')) {
                // Developer subdirectory
                const developerName = name;
                try {
                    for await (const [taskName, taskHandle] of handle.entries()) {
                        if (taskHandle.kind === 'file' && taskName.endsWith('.md') && taskName.toLowerCase() !== 'readme.md') {
                            const task = await this.parseTaskFile(taskHandle, columnName, projectId, developerName);
                            if (task) tasks.push(task);
                        }
                    }
                } catch (error) {
                    console.warn(`Error reading developer directory ${developerName}:`, error);
                }
            }
        }
        
        return tasks;
    }

    async parseTaskFile(fileHandle, columnName, projectId, developerName) {
        try {
            const file = await fileHandle.getFile();
            const content = await file.text();
            
            // Parse YAML frontmatter and content
            const task = this.parseMarkdownTask(content, fileHandle.name, columnName, projectId, developerName);
            return task;
            
        } catch (error) {
            console.warn(`Error parsing task file ${fileHandle.name}:`, error);
            return null;
        }
    }

    parseMarkdownTask(content, fileName, columnName, projectId, developerName) {
        // Extract task ID from filename
        const taskId = fileName.replace(/\.md$/i, '').split('-').slice(0, 3).join('-');
        
        // Parse YAML frontmatter
        let frontmatter = {};
        let mainContent = content;
        
        if (content.startsWith('---')) {
            const frontmatterMatch = content.match(/^---\n(.*?)\n---\n(.*)$/s);
            if (frontmatterMatch) {
                const yamlContent = frontmatterMatch[1];
                mainContent = frontmatterMatch[2];
                
                // Simple YAML parser
                yamlContent.split('\n').forEach(line => {
                    const match = line.match(/^(\w+):\s*(.+)$/);
                    if (match) {
                        const key = match[1].toLowerCase(); // Convert to lowercase
                        const value = match[2].trim();
                        frontmatter[key] = value;
                    }
                });
            }
        }
        
        // Extract title from content if not in frontmatter
        let title = frontmatter.title;
        if (!title) {
            const titleMatch = mainContent.match(/^#\s+([^\n]+)/m);
            if (titleMatch) {
                title = titleMatch[1].replace(/^[A-Z]+-[A-Z]+-\d+:\s*/, '');
            }
        }
        
        // Parse additional fields from markdown content if not in frontmatter
        if (!frontmatter.priority) {
            const priorityMatch = mainContent.match(/\*?\*?Priority:\*?\*?\s*([^\n\r]+)/i);
            if (priorityMatch) {
                frontmatter.priority = priorityMatch[1].trim();
            }
        }
        
        if (!frontmatter.estimate) {
            const estimateMatch = mainContent.match(/\*?\*?Estimate:\*?\*?\s*([^\n\r]+)/i);
            if (estimateMatch) {
                frontmatter.estimate = estimateMatch[1].trim();
            }
        }
        
        // Determine assignee
        let assignee = 'Unassigned';
        let developer = null;
        
        if (developerName) {
            assignee = this.formatDeveloperName(developerName);
            developer = developerName;
        } else if (frontmatter.developer) {
            assignee = this.formatDeveloperName(frontmatter.developer);
            developer = frontmatter.developer;
        }
        
        return {
            id: taskId,
            title: title || taskId, // Use taskId instead of fileName
            column: columnName,
            timeSpent: frontmatter.spent_time || '0h',
            timeEstimate: frontmatter.estimate || '0h',
            assignee: assignee,
            priority: frontmatter.priority ? frontmatter.priority.toLowerCase() : 'low',
            developer: developer,
            content: mainContent,
            fullContent: content,
            projectId: projectId,
            status: frontmatter.status || columnName,
            created: frontmatter.created || frontmatter.date || new Date().toISOString().split('T')[0]
        };
    }

    formatDeveloperName(developerKey) {
        // Use real folder names as developer names - no hardcoded mapping
        if (!developerKey) return 'Unassigned';
        
        // Return the folder name as-is since it represents the real developer name
        return developerKey;
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

            const totalTasks = project.stats.backlog.count + project.stats.inProgress.count + project.stats.done.count;
            console.log(`✅ Added project: ${projectId} (${totalTasks} total tasks)`);
            
            // Pre-cache developers for this project
            try {
                await this.getProjectDevelopers(projectId, true); // Force refresh
                console.log(`👥 Pre-cached developers for project: ${projectId}`);
            } catch (devError) {
                console.warn(`⚠️ Could not pre-cache developers for ${projectId}:`, devError);
            }
            
            return project;
            
        } catch (error) {
            console.warn(`⚠️ Error scanning project ${projectId}:`, error);
            return null;
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

    showDirectorySelectionDialog() {
        console.log('📁 Creating directory selection modal dialog...');
        return new Promise((resolve) => {
            // Create modal dialog
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: white;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            `;
            
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                padding: 40px;
                border-radius: 16px;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
                max-width: 450px;
                text-align: center;
                animation: fadeInUp 0.3s ease-out;
            `;
            
            const isSupported = 'showDirectoryPicker' in window;
            
            // Add animation keyframes
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeInUp {
                    from { 
                        opacity: 0; 
                        transform: translateY(30px) scale(0.95); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0) scale(1); 
                    }
                }
            `;
            document.head.appendChild(style);
            
            dialog.innerHTML = `
                <div style="margin-bottom: 24px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
                    <h2 style="color: #1f2937; margin-bottom: 8px; font-size: 24px; font-weight: 600;">Select Working Directory</h2>
                    <p style="color: #6b7280; line-height: 1.6; margin: 0;">
                        ${isSupported 
                            ? 'Choose the folder containing your projects to get started'
                            : 'File System Access API is not supported in this browser.<br>Please use Chrome or Edge 86+ for directory access.'
                        }
                    </p>
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: center;">
                    ${isSupported ? `
                        <button id="selectDirBtn" style="
                            background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                            color: white; 
                            border: none; 
                            border-radius: 10px; 
                            padding: 14px 28px; 
                            font-size: 16px; 
                            font-weight: 600; 
                            cursor: pointer;
                            transition: all 0.2s ease;
                            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
                        " 
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(139, 92, 246, 0.4)';"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(139, 92, 246, 0.3)';"
                        >📂 Choose Folder</button>
                    ` : ''}
                </div>
                
                ${isSupported ? `
                    <p style="color: #9ca3af; font-size: 12px; margin-top: 20px; margin-bottom: 0;">
                        💡 Select the folder containing your projects (e.g., the folder with projects/ subfolder)
                    </p>
                ` : ''}
            `;
            
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            
            // Event handlers
            const selectBtn = dialog.querySelector('#selectDirBtn');
            let buttonClicked = false;
            
            if (selectBtn) {
                selectBtn.addEventListener('click', async () => {
                    if (buttonClicked) {
                        console.log('📁 Button already clicked, ignoring duplicate click');
                        return;
                    }
                    buttonClicked = true;
                    
                    console.log('📁 User clicked "Select Directory" button');
                    selectBtn.style.opacity = '0.5';
                    selectBtn.style.cursor = 'not-allowed';
                    selectBtn.textContent = '⏳ Opening...';
                    
                    try {
                        console.log('📁 Opening directory picker directly...');
                        
                        const directoryHandle = await window.showDirectoryPicker({
                            mode: 'read',
                            startIn: 'documents'
                        });
                        
                        console.log(`📁 Selected directory: ${directoryHandle.name}`);
                        
                        // Clean up modal
                        document.body.removeChild(modal);
                        document.head.removeChild(style);
                        
                        resolve(directoryHandle);
                    } catch (error) {
                        // Reset button state if user cancelled or error occurred
                        if (error.name === 'AbortError') {
                            console.log('🚫 Directory selection cancelled by user');
                        } else {
                            console.error('❌ Error opening directory picker:', error);
                        }
                        
                        // Clean up modal and resolve with null
                        document.body.removeChild(modal);
                        document.head.removeChild(style);
                        resolve(null);
                    }
                });
            } else {
                // If File System API is not supported, resolve with null
                console.log('📁 File System API not supported, auto-skipping');
                setTimeout(() => {
                    document.body.removeChild(modal);
                    document.head.removeChild(style);
                    resolve(null);
                }, 3000);
            }
            
            // Disable background click for better UX (user must make a choice)
        });
    }

    showNoDirectoryMessage() {
        // Show a subtle message in the dashboard about selecting a directory
        const projectsGrid = document.getElementById('projectsGrid');
        if (projectsGrid) {
            projectsGrid.innerHTML = `
                <div style="
                    grid-column: 1/-1; 
                    text-align: center; 
                    padding: 60px 20px;
                    background: white;
                    border-radius: 12px;
                    border: 2px dashed #e5e7eb;
                ">
                    <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
                    <h3 style="color: #1f2937; margin-bottom: 12px;">No Directory Selected</h3>
                    <p style="color: #6b7280; margin-bottom: 24px; line-height: 1.5;">
                        To view your projects, you need to select your working directory.<br>
                        Click the button below to choose your projects folder.
                    </p>
                    <button 
                        onclick="window.globalDataManager.selectNewDirectory()" 
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
                        onmouseover="this.style.transform='translateY(-2px)'"
                        onmouseout="this.style.transform='translateY(0)'"
                    >
                        🔄 Select Directory
                    </button>
                </div>
            `;
        }
    }

    showNoServerMessage() {
        // Show a message about server not being available
        const projectsGrid = document.getElementById('projectsGrid');
        if (projectsGrid && this.projects.length === 0) {
            projectsGrid.innerHTML = `
                <div style="
                    grid-column: 1/-1; 
                    text-align: center; 
                    padding: 60px 20px;
                    background: white;
                    border-radius: 12px;
                    border: 1px solid #fbbf24;
                    background: linear-gradient(135deg, #fef3c7, #fde68a);
                ">
                    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                    <h3 style="color: #92400e; margin-bottom: 12px;">Server Connection Failed</h3>
                    <p style="color: #92400e; margin-bottom: 16px; line-height: 1.5;">
                        Could not connect to Fira server. Using static demo data.<br>
                        Make sure the server is running on port 8080.
                    </p>
                    <div style="color: #92400e; font-size: 14px; margin-bottom: 24px;">
                        <strong>To fix this:</strong><br>
                        1. Run <code>start.bat</code> to start the server<br>
                        2. Or choose a directory to work with your files
                    </div>
                    <button 
                        onclick="window.location.reload()" 
                        style="
                            background: linear-gradient(135deg, #f59e0b, #d97706);
                            color: white; 
                            border: none; 
                            border-radius: 8px; 
                            padding: 12px 24px; 
                            font-size: 14px; 
                            font-weight: 500; 
                            cursor: pointer;
                            margin-right: 12px;
                            transition: all 0.2s ease;
                        "
                        onmouseover="this.style.transform='translateY(-2px)'"
                        onmouseout="this.style.transform='translateY(0)'"
                    >
                        🔄 Retry Connection
                    </button>
                    <button 
                        onclick="window.globalDataManager.selectNewDirectory()" 
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
                        onmouseover="this.style.transform='translateY(-2px)'"
                        onmouseout="this.style.transform='translateY(0)'"
                    >
                        📁 Select Directory Instead
                    </button>
                </div>
            `;
        }
    }

    // File system loading removed - now uses cache or static data only

    async loadAllTasksFromFileSystem() {
        this.allTasks = [];
        this.projectTasks = {};

        const columns = ['backlog', 'progress', 'review', 'testing', 'done'];
        
        // Get projects directory
        let projectsDir;
        try {
            projectsDir = await this.fileSystemLoader.directoryHandle.getDirectoryHandle('projects');
        } catch (e) {
            projectsDir = this.fileSystemLoader.directoryHandle;
        }

        // Load tasks for each project
        for (const project of this.projects) {
            const projectTasks = [];
            
            try {
                const projectDir = await projectsDir.getDirectoryHandle(project.id);
                
                // Load tasks from each column
                for (const columnName of columns) {
                    try {
                        const columnDir = await projectDir.getDirectoryHandle(columnName);
                        const columnTasks = await this.loadTasksFromColumn(columnDir, columnName, project.id);
                        projectTasks.push(...columnTasks);
                    } catch (error) {
                        // Column doesn't exist, skip
                        console.log(`Column ${columnName} not found in project ${project.id}`);
                    }
                }
                
                this.projectTasks[project.id] = projectTasks;
                this.allTasks.push(...projectTasks);
                
            } catch (error) {
                console.warn(`Failed to load tasks for project ${project.id}:`, error);
                this.projectTasks[project.id] = [];
            }
        }
    }

    async loadTasksFromColumn(columnDir, columnName, projectId) {
        const tasks = [];
        
        // Handle both direct files and developer subdirectories
        for await (const [name, handle] of columnDir.entries()) {
            if (handle.kind === 'file' && name.endsWith('.md') && name.toLowerCase() !== 'readme.md') {
                // Direct task file in column
                const task = await this.parseTaskFile(handle, columnName, projectId, null);
                if (task) tasks.push(task);
            } else if (handle.kind === 'directory' && !name.toLowerCase().includes('readme')) {
                // Developer subdirectory
                const developerName = name;
                try {
                    for await (const [taskName, taskHandle] of handle.entries()) {
                        if (taskHandle.kind === 'file' && taskName.endsWith('.md') && taskName.toLowerCase() !== 'readme.md') {
                            const task = await this.parseTaskFile(taskHandle, columnName, projectId, developerName);
                            if (task) tasks.push(task);
                        }
                    }
                } catch (error) {
                    console.warn(`Error reading developer directory ${developerName}:`, error);
                }
            }
        }
        
        return tasks;
    }

    async parseTaskFile(fileHandle, columnName, projectId, developerName) {
        try {
            const file = await fileHandle.getFile();
            const content = await file.text();
            
            // Parse YAML frontmatter and content
            const task = this.parseMarkdownTask(content, fileHandle.name, columnName, projectId, developerName);
            // Store file handle on the returned task so updates can write back
            try {
                task._fileHandle = fileHandle;
                if (!this.fileHandles[projectId]) this.fileHandles[projectId] = {};
                this.fileHandles[projectId][task.id] = fileHandle;
            } catch (e) {
                console.warn('Could not attach file handle to task object:', e);
            }
            return task;
            
        } catch (error) {
            console.warn(`Error parsing task file ${fileHandle.name}:`, error);
            return null;
        }
    }

    parseMarkdownTask(content, fileName, columnName, projectId, developerName) {
        // Extract task ID from filename (e.g., "GBL-KMP-003-ios-welcome-screen.md" -> "GBL-KMP-003")
        const taskId = fileName.replace(/\.md$/i, '').split('-').slice(0, 3).join('-');
        
        // Parse YAML frontmatter
        let frontmatter = {};
        let mainContent = content;
        
        if (content.startsWith('---')) {
            const frontmatterMatch = content.match(/^---\n(.*?)\n---\n(.*)$/s);
            if (frontmatterMatch) {
                const yamlContent = frontmatterMatch[1];
                mainContent = frontmatterMatch[2];
                
                // Simple YAML parser for our specific format
                yamlContent.split('\n').forEach(line => {
                    const match = line.match(/^(\w+):\s*(.+)$/);
                    if (match) {
                        const key = match[1].toLowerCase(); // Convert to lowercase
                        const value = match[2].trim();
                        frontmatter[key] = value;
                    }
                });
            }
        }
        
        // Extract title from content if not in frontmatter
        let title = frontmatter.title;
        if (!title) {
            const titleMatch = mainContent.match(/^#\s+([^\n]+)/m);
            if (titleMatch) {
                title = titleMatch[1].replace(/^[A-Z]+-[A-Z]+-\d+:\s*/, ''); // Remove task ID prefix
            }
        }
        
        // Parse additional fields from markdown content if not in frontmatter
        if (!frontmatter.priority) {
            const priorityMatch = mainContent.match(/\*?\*?Priority:\*?\*?\s*([^\n\r]+)/i);
            if (priorityMatch) {
                frontmatter.priority = priorityMatch[1].trim();
            }
        }
        
        if (!frontmatter.estimate) {
            const estimateMatch = mainContent.match(/\*?\*?Estimate:\*?\*?\s*([^\n\r]+)/i);
            if (estimateMatch) {
                frontmatter.estimate = estimateMatch[1].trim();
            }
        }
        
        // Determine assignee
        let assignee = 'Unassigned';
        let developer = null;
        
        if (developerName) {
            assignee = this.formatDeveloperName(developerName);
            developer = developerName;
        } else if (frontmatter.developer) {
            assignee = this.formatDeveloperName(frontmatter.developer);
            developer = frontmatter.developer;
        }
        
        return {
            id: taskId,
            title: title || taskId, // Use taskId instead of fileName
            column: columnName,
            timeSpent: frontmatter.spent_time || '0h',
            timeEstimate: frontmatter.estimate || '0h',
            assignee: assignee,
            priority: frontmatter.priority ? frontmatter.priority.toLowerCase() : 'low',
            developer: developer,
            content: mainContent,
            projectId: projectId,
            created: frontmatter.created || frontmatter.date || new Date().toISOString().split('T')[0]
        };
    }

    formatDeveloperName(developerKey) {
        // Use real folder names as developer names - no hardcoded mapping
        if (!developerKey) return 'Unassigned';
        
        // Return the folder name as-is since it represents the real developer name
        return developerKey;
    }

    loadFromStaticData() {
        // Load static data as fallback
        console.log('📊 Loading static fallback data (server unavailable mode)');
        this.projects = window.PROJECTS_DATA ? this.filterDeletedProjects([...window.PROJECTS_DATA]) : [];
        this.loadingMode = 'static';
        
        // Show user-friendly message about fallback mode
        setTimeout(() => {
            const statusEl = document.querySelector('.status-message') || document.createElement('div');
            statusEl.className = 'status-message';
            statusEl.innerHTML = `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 10px; margin: 10px; border-radius: 5px; text-align: center;">
                    📡 Server not available - showing demo data (${this.projects.length} projects). Some features may be limited.
                </div>
            `;
            if (!document.querySelector('.status-message')) {
                document.body.insertBefore(statusEl, document.body.firstChild);
            }
        }, 1000);
        
        console.log(`✅ Static data loaded: ${this.projects.length} projects, ${this.allTasks.length} tasks`);
        
        // Create sample tasks for demo
        this.allTasks = [
            {
                id: 'TSK-714',
                title: 'Implement user authentication flow',
                column: 'backlog',
                timeSpent: '2h',
                timeEstimate: '9h',
                assignee: 'Unassigned',
                priority: 'high',
                developer: null,
                content: '## Description\nImplement user authentication flow with login, logout, and session management.\n\n## Tasks\n- [ ] Create login form\n- [ ] Implement authentication logic\n- [ ] Add session management',
                projectId: 'fira'
            },
            {
                id: 'TSK-715',
                title: 'Design dashboard mockups',
                column: 'progress',
                timeSpent: '4h',
                timeEstimate: '6h',
                assignee: 'dev-john',
                priority: 'medium',
                developer: 'dev-john',
                content: '## Description\nCreate comprehensive dashboard mockups for the main application interface.\n\n## Tasks\n- [x] Research design patterns\n- [ ] Create wireframes\n- [ ] Design high-fidelity mockups',
                projectId: 'fira'
            },
            {
                id: 'GBL-001',
                title: 'iOS Welcome Screen Implementation',
                column: 'backlog',
                timeSpent: '0h',
                timeEstimate: '3h',
                assignee: 'Unassigned',
                priority: 'medium',
                developer: null,
                content: '## Description\nImplement iOS-optimized Welcome screen following iOS design patterns.\n\n## Tasks\n- [ ] Design Welcome screen layout\n- [ ] Implement welcome message and app branding\n- [ ] Add Recent files section',
                projectId: 'gbl-commander-kmp'
            },
            {
                id: 'GBL-002',
                title: 'iOS Save Dialog',
                column: 'progress',
                timeSpent: '1h',
                timeEstimate: '2h',
                assignee: 'tech-ruslan',
                priority: 'medium',
                developer: 'tech-ruslan',
                content: '## Description\nImplement iOS-native file save dialog with automatic filename conflict resolution.\n\n## Tasks\n- [x] Design save dialog interface\n- [ ] Implement filename input with validation\n- [ ] Add conflict resolution logic',
                projectId: 'gbl-commander-kmp'
            }
        ];
        
        // Organize tasks by project
        this.projectTasks = {};
        this.projects.forEach(project => {
            this.projectTasks[project.id] = this.allTasks.filter(task => task.projectId === project.id);
        });
        
        console.log(`Loaded ${this.projects.length} projects and ${this.allTasks.length} tasks from static data`);
    }

    async loadFromServer() {
        if (!this.apiClient) {
            throw new Error('No API client available');
        }
        
        // For web version, try to connect even without prior server check
        const currentHostname = window.location.hostname;
        const isWeb = currentHostname.includes("onix-systems-android-tasks");
        
        if (!isWeb && !this.apiClient.isServerAvailable) {
            throw new Error('Server not available');
        }

        try {
            console.log(`🔄 SERVER RELOAD: Loading fresh data from server`);
            
            // Load projects from server
            this.projects = this.filterDeletedProjects(await this.apiClient.getProjects());
            this.loadingMode = 'server';
            
            // Complete projects loading step
            if (window.loadingManager && this.shouldShowLoading) {
                window.loadingManager.completeStep('projects-load');
                window.loadingManager.setActiveStep('tasks-load');
            }
            
            // Load all tasks for all projects
            this.allTasks = [];
            this.projectTasks = {};
            
            console.log(`🔄 SERVER RELOAD: Loading tasks for ${this.projects.length} projects`);
            
            // Initialize task loading progress
            if (window.loadingManager) {
                window.loadingManager.updateTaskProgress(0, this.projects.length);
            }
            
            let currentProjectIndex = 0;
            for (const project of this.projects) {
                console.log(`🔄 SERVER RELOAD: Loading tasks for project: ${project.id}`);
                const projectTasks = await this.apiClient.getProjectTasks(project.id);
                this.projectTasks[project.id] = projectTasks;
                this.allTasks.push(...projectTasks);
                console.log(`🔄 SERVER RELOAD: Loaded ${projectTasks.length} tasks for project ${project.id}`);
                
                // Update progress
                currentProjectIndex++;
                if (window.loadingManager) {
                    window.loadingManager.updateTaskProgress(currentProjectIndex, this.projects.length);
                }
            }
            
            console.log(`✅ SERVER RELOAD: Completed loading ${this.projects.length} projects and ${this.allTasks.length} tasks from server`);
            console.log(`✅ SERVER RELOAD: Project tasks breakdown:`, Object.keys(this.projectTasks).map(id => `${id}: ${this.projectTasks[id].length} tasks`));
            
        } catch (error) {
            console.error('Failed to load from server:', error);
            throw error;
        }
    }

    // Server-specific methods for CRUD operations
    async updateTask(projectId, task) {
        console.log(`🔄 updateTask called:`, {
            projectId,
            taskId: task.id,
            loadingMode: this.loadingMode,
            hasDirectoryHandle: !!this.directoryHandle,
            hasApiClient: !!this.apiClient,
            hasFileSystemLoader: !!this.fileSystemLoader
        });

        if ((this.loadingMode === 'server' || this.loadingMode === 'hybrid') && this.apiClient) {
            try {
                console.log('🚀 globalDataManager.updateTask: Sending to API:', {
                    taskId: task.id,
                    timeEstimate: task.timeEstimate,
                    timeSpent: task.timeSpent,
                    taskDataKeys: Object.keys(task)
                });
                await this.apiClient.updateTask(projectId, task.id, task);
                
                // Update local cache
                const projectTasks = this.projectTasks[projectId] || [];
                const taskIndex = projectTasks.findIndex(t => t.id === task.id);
                if (taskIndex !== -1) {
                    projectTasks[taskIndex] = task;
                } else {
                    projectTasks.push(task);
                    this.projectTasks[projectId] = projectTasks;
                }
                
                // Update allTasks array
                const allTaskIndex = this.allTasks.findIndex(t => t.id === task.id && t.projectId === projectId);
                if (allTaskIndex !== -1) {
                    this.allTasks[allTaskIndex] = task;
                } else {
                    this.allTasks.push(task);
                }
                
                return true;
            } catch (error) {
                console.error('Failed to update task on server:', error);
                throw error;
            }
        } else if (this.loadingMode === 'filesystem' && this.fileSystemLoader) {
            // Use existing file system method if available
            return await this.fileSystemLoader.updateTask(projectId, task);
        } else if ((this.loadingMode === 'directory-picker' || this.loadingMode === 'directory-refreshed') && this.directoryHandle) {
            // File System Access API mode - save to actual files
            console.log('💾 Using File System Access API to save task');
            try {
                const result = await this.saveTaskToFileSystem(projectId, task);
                console.log('✅ File System Access API save result:', result);
                return result;
            } catch (error) {
                console.error('❌ Failed to save task to file system:', error);
                // Fallback to local storage
                const projectTasks = this.projectTasks[projectId] || [];
                const taskIndex = projectTasks.findIndex(t => t.id === task.id);
                if (taskIndex !== -1) {
                    projectTasks[taskIndex] = task;
                }
                console.log('📦 Falling back to local storage update');
                return false; // Indicate partial failure
            }
        } else {
            // Static mode - just update locally
            const projectTasks = this.projectTasks[projectId] || [];
            const taskIndex = projectTasks.findIndex(t => t.id === task.id);
            if (taskIndex !== -1) {
                projectTasks[taskIndex] = task;
            }
            return true;
        }
    }

    async createProject(projectData) {
        console.log('🔄 Creating project:', projectData);

        // If we have a selected directory, create project there using File System Access API
        if (this.directoryHandle && this.loadingMode.includes('directory')) {
            try {
                console.log('📁 Creating project in selected directory using File System Access API');
                
                // Create project directory
                const projectDirHandle = await this.directoryHandle.getDirectoryHandle(projectData.id, { create: true });
                console.log(`✅ Created project directory: ${projectData.id}`);
                
                // Create standard subdirectories
                const subdirs = ['backlog', 'progress', 'review', 'testing', 'done'];
                for (const subdir of subdirs) {
                    await projectDirHandle.getDirectoryHandle(subdir, { create: true });
                    console.log(`✅ Created subdirectory: ${subdir}`);
                }
                
                // Create README.md file
                const readmeHandle = await projectDirHandle.getFileHandle('README.md', { create: true });
                const writable = await readmeHandle.createWritable();
                await writable.write(`# ${projectData.name}\n\n${projectData.description || 'No description provided'}\n\n## Project Structure\n\n- **backlog/**: New tasks waiting to be started\n- **progress/**: Tasks currently being worked on\n- **review/**: Tasks ready for review\n- **testing/**: Tasks being tested\n- **done/**: Completed tasks\n`);
                await writable.close();
                console.log('✅ Created README.md file');
                
                // Add project to local data
                const newProject = {
                    id: projectData.id,
                    name: projectData.name,
                    description: projectData.description || 'No description provided',
                    stats: {
                        backlog: { count: 0, detail: '(0 tasks)' },
                        inProgress: { count: 0, detail: '(0 devs)' },
                        done: { count: 0, detail: '(0 tasks)' }
                    }
                };
                
                this.projects.unshift(newProject);
                this.projectTasks[projectData.id] = [];
                
                console.log('✅ Project created successfully in selected directory');
                return { success: true, project: newProject };
                
            } catch (error) {
                console.error('❌ Failed to create project in selected directory:', error);
                throw error;
            }
        }
        
        // Fallback to server creation if no directory selected or server mode
        if ((this.loadingMode === 'server' || this.loadingMode === 'hybrid') && this.apiClient) {
            try {
                console.log('🌐 Creating project on server');
                const result = await this.apiClient.createProject(projectData);
                
                if (result.success) {
                    // Add to local cache
                    const newProject = {
                        id: projectData.id,
                        name: projectData.name,
                        description: projectData.description || 'No description provided',
                        stats: {
                            backlog: { count: 0, detail: '(0 tasks)' },
                            inProgress: { count: 0, detail: '(0 devs)' },
                            done: { count: 0, detail: '(0 tasks)' }
                        }
                    };
                    
                    this.projects.unshift(newProject);
                    this.projectTasks[projectData.id] = [];
                    
                    return { success: true, project: newProject };
                }
                throw new Error(result.error || 'Failed to create project on server');
            } catch (error) {
                console.error('Failed to create project on server:', error);
                throw error;
            }
        }
        
        throw new Error('No valid creation method available (no directory selected and no server)');
    }

    async deleteProject(projectId) {
        console.log('🗑️ GlobalDataManager.deleteProject called for:', projectId);
        console.log('🗑️ Loading mode:', this.loadingMode);
        console.log('🗑️ API client available:', !!this.apiClient);
        
        // Always use server API for deletion, regardless of loading mode
        if (this.apiClient) {
            console.log('🗑️ Using server API for deletion');
            try {
                const result = await this.apiClient.deleteProject(projectId);
                console.log('🗑️ Server deletion successful:', result);
                
                // Update local cache safely
                this.removeProjectFromCache(projectId);
                
                return result;
            } catch (error) {
                console.error('Failed to delete project on server:', error);
                
                // If project doesn't exist on server (404), just remove from local cache
                if (error.message && error.message.includes('not found')) {
                    console.log('🗑️ Project not found on server, removing from local cache only');
                    this.removeProjectFromCache(projectId);
                    return { success: true, message: 'Project removed from local cache (not found on server)' };
                }
                
                throw error;
            }
        }
        
        throw new Error('No API client available for deletion');
    }

    removeProjectFromCache(projectId) {
        console.log('🗑️ Removing project from local cache:', projectId);
        
        // Update local cache safely
        if (this.projectData && Array.isArray(this.projectData)) {
            this.projectData = this.projectData.filter(p => p.id !== projectId);
        }
        if (this.projectTasks && this.projectTasks[projectId]) {
            delete this.projectTasks[projectId];
        }
        if (this.allTasks && Array.isArray(this.allTasks)) {
            this.allTasks = this.allTasks.filter(task => task.projectId !== projectId);
        }
        
        // Save to localStorage to persist across page refreshes
        this.saveDeletedProjectToStorage(projectId);
        
        console.log('🗑️ Project removed from local cache');
    }

    saveDeletedProjectToStorage(projectId) {
        try {
            const deletedProjects = JSON.parse(localStorage.getItem('deletedProjects') || '[]');
            if (!deletedProjects.includes(projectId)) {
                deletedProjects.push(projectId);
                localStorage.setItem('deletedProjects', JSON.stringify(deletedProjects));
                console.log('🗑️ Saved deleted project to localStorage:', projectId);
            }
        } catch (error) {
            console.warn('Failed to save deleted project to localStorage:', error);
        }
    }

    getDeletedProjects() {
        try {
            return JSON.parse(localStorage.getItem('deletedProjects') || '[]');
        } catch (error) {
            console.warn('Failed to load deleted projects from localStorage:', error);
            return [];
        }
    }

    filterDeletedProjects(projects) {
        const deletedProjects = this.getDeletedProjects();
        if (deletedProjects.length === 0) {
            return projects;
        }
        
        const filtered = projects.filter(project => !deletedProjects.includes(project.id));
        if (filtered.length !== projects.length) {
            console.log('🗑️ Filtered out deleted projects:', deletedProjects);
        }
        return filtered;
    }

    async createTask(projectId, task) {

        if ((this.loadingMode === 'server' || this.loadingMode === 'hybrid') && this.apiClient) {
            try {
                await this.apiClient.createTask(projectId, task);
                
                // Update local cache
                if (!this.projectTasks[projectId]) {
                    this.projectTasks[projectId] = [];
                }
                this.projectTasks[projectId].push(task);
                this.allTasks.push(task);
                
                return true;
            } catch (error) {
                console.error('Failed to create task on server:', error);
                throw error;
            }
        } else {
            // Fallback for other modes
            if (!this.projectTasks[projectId]) {
                this.projectTasks[projectId] = [];
            }
            this.projectTasks[projectId].push(task);
            this.allTasks.push(task);
            return true;
        }
    }

    async deleteTask(projectId, taskId) {

        if ((this.loadingMode === 'server' || this.loadingMode === 'hybrid') && this.apiClient) {
            try {
                await this.apiClient.deleteTask(projectId, taskId);
                
                // Update local cache
                const projectTasks = this.projectTasks[projectId] || [];
                this.projectTasks[projectId] = projectTasks.filter(t => t.id !== taskId);
                this.allTasks = this.allTasks.filter(t => !(t.id === taskId && t.projectId === projectId));
                
                return true;
            } catch (error) {
                console.error('Failed to delete task on server:', error);
                throw error;
            }
        } else {
            // Fallback for other modes
            const projectTasks = this.projectTasks[projectId] || [];
            this.projectTasks[projectId] = projectTasks.filter(t => t.id !== taskId);
            this.allTasks = this.allTasks.filter(t => !(t.id === taskId && t.projectId === projectId));
            return true;
        }
    }

    async updateProject(projectId, updatedProject) {
        console.log(`🔄 updateProject called:`, {
            projectId,
            updatedProject,
            loadingMode: this.loadingMode,
            hasDirectoryHandle: !!this.directoryHandle,
            hasApiClient: !!this.apiClient
        });

        if ((this.loadingMode === 'server' || this.loadingMode === 'hybrid') && this.apiClient) {
            try {
                await this.apiClient.updateProject(projectId, updatedProject);
                
                // Update local cache
                const projectIndex = this.projects.findIndex(p => p.id === projectId);
                if (projectIndex !== -1) {
                    this.projects[projectIndex] = { ...this.projects[projectIndex], ...updatedProject };
                }
                
                return true;
            } catch (error) {
                console.error('Failed to update project on server:', error);
                throw error;
            }
        } else if ((this.loadingMode === 'directory-picker' || this.loadingMode === 'directory-refreshed') && this.directoryHandle) {
            // File System Access API mode - save to README.md
            console.log('💾 Using File System Access API to save project');
            console.log('📁 Directory handle available:', !!this.directoryHandle);
            console.log('🆔 Project ID to update:', projectId);
            console.log('📊 Updated project data:', updatedProject);
            try {
                const result = await this.saveProjectToFileSystem(projectId, updatedProject);
                console.log('✅ File System Access API save result:', result);
                return result;
            } catch (error) {
                console.error('❌ Failed to save project to file system:', error);
                console.error('❌ Error stack:', error.stack);
                // Fallback to local storage
                const projectIndex = this.projects.findIndex(p => p.id === projectId);
                if (projectIndex !== -1) {
                    this.projects[projectIndex] = { ...this.projects[projectIndex], ...updatedProject };
                    console.log('📦 Updated project in local cache at index:', projectIndex);
                } else {
                    console.warn('⚠️ Project not found in local cache for fallback update');
                }
                console.log('📦 Falling back to local storage update');
                throw error; // Re-throw error so UI can show proper message
            }
        } else {
            // Static mode - just update locally
            const projectIndex = this.projects.findIndex(p => p.id === projectId);
            if (projectIndex !== -1) {
                this.projects[projectIndex] = { ...this.projects[projectIndex], ...updatedProject };
            }
            return true;
        }
    }

    // File System Access API save methods
    async saveTaskToFileSystem(projectId, task) {
        if (!this.directoryHandle) {
            throw new Error('No directory handle available');
        }

        try {
            console.log('💾 Saving task to file system:', task.id);
            console.log('📝 Task data being written:', {
                id: task.id,
                timeEstimate: task.timeEstimate,
                timeSpent: task.timeSpent,
                title: task.title,
                fullContent: task.fullContent ? task.fullContent.substring(0, 100) + '...' : 'no content'
            });
            
            // Get project directory
            const projectDirHandle = await this.directoryHandle.getDirectoryHandle(projectId, { create: false });
            
            // Find current task file to get old content for change logging
            console.log('🔍 Step 1: Finding current task file...');
            const currentFile = await this.findTaskFile(projectDirHandle, task.id);
            let oldContent = '';
            let oldFrontmatter = {};
            let oldStatus = 'backlog';
            
            console.log('🔍 Step 2: Processing current file...', currentFile ? 'found' : 'not found');
            if (currentFile) {
                const file = await currentFile.handle.getFile();
                oldContent = await file.text();
                oldStatus = currentFile.status;
                console.log('🔍 Step 3: Old content length:', oldContent.length, 'Status:', oldStatus);
                
                // Parse old frontmatter
                if (oldContent.startsWith('---')) {
                    const parts = oldContent.split('---', 3);
                    if (parts.length >= 3) {
                        try {
                            // Simple YAML parsing for key: value pairs
                            const yamlLines = parts[1].trim().split('\n');
                            yamlLines.forEach(line => {
                                const colonIndex = line.indexOf(':');
                                if (colonIndex > -1) {
                                    const key = line.substring(0, colonIndex).trim();
                                    const value = line.substring(colonIndex + 1).trim();
                                    oldFrontmatter[key] = value;
                                }
                            });
                            console.log('🔍 Step 4: Parsed old frontmatter:', oldFrontmatter);
                        } catch (e) {
                            console.warn('Could not parse old frontmatter:', e);
                        }
                    }
                }
            }
            
            // Determine target directory based on task column
            const targetStatus = task.column || 'backlog';
            let targetDirHandle = await projectDirHandle.getDirectoryHandle(targetStatus, { create: true });
            
            // Handle developer subfolders for progress
            if (targetStatus === 'progress' && task.developer) {
                targetDirHandle = await targetDirHandle.getDirectoryHandle(task.developer, { create: true });
            }
            
            // Create new file content with change logging
            console.log('📄 About to call buildTaskFileContent with:', {
                taskId: task.id,
                hasOldFrontmatter: Object.keys(oldFrontmatter).length > 0,
                oldStatus,
                targetStatus,
                hasOldContent: !!oldContent
            });
            const newContent = this.buildTaskFileContent(task, oldFrontmatter, oldStatus, targetStatus, oldContent);
            console.log('✅ buildTaskFileContent completed, content length:', newContent.length);
            
            // Write to target file (use existing filename if found, otherwise use task ID)
            const fileName = currentFile ? currentFile.fileName : `${task.id}.md`;
            const fileHandle = await targetDirHandle.getFileHandle(fileName, { create: true });
            
            console.log('💾 Writing task file:', fileName);
            console.log('📄 First 300 chars of content:', newContent.substring(0, 300));
            
            // Check what exactly is being written to the frontmatter
            const frontmatterMatch = newContent.match(/---\n([\s\S]*?)\n---/);
            if (frontmatterMatch) {
                console.log('🔍 Extracted YAML frontmatter being written:');
                console.log(frontmatterMatch[1]);
            }
            
            const writable = await fileHandle.createWritable();
            await writable.write(newContent);
            await writable.close();
            
            console.log('✅ Task file written successfully:', fileName);
            
            // If file was moved to different directory, delete the old file
            if (currentFile && (oldStatus !== targetStatus || (targetStatus === 'progress' && currentFile.status !== targetStatus))) {
                try {
                    console.log('🗑️ Removing old file from:', currentFile.status, 'directory');
                    
                    // Get the old directory handle
                    let oldDirHandle = await projectDirHandle.getDirectoryHandle(currentFile.status);
                    
                    // Handle developer subfolder for old file if needed
                    if (currentFile.status === 'progress' && currentFile.developer) {
                        oldDirHandle = await oldDirHandle.getDirectoryHandle(currentFile.developer);
                    }
                    
                    // Remove old file only if it's not the same location
                    const oldPath = `${currentFile.status}/${currentFile.developer || ''}/${fileName}`;
                    const newPath = `${targetStatus}/${task.developer || ''}/${fileName}`;
                    
                    if (oldPath !== newPath) {
                        await oldDirHandle.removeEntry(fileName);
                        console.log('✅ Old file removed successfully');
                    }
                } catch (removeError) {
                    console.warn('⚠️ Could not remove old file:', removeError.message);
                    // Don't fail the whole operation if we can't remove old file
                }
            }
            
            // Verify write by reading it back immediately
            try {
                const file = await fileHandle.getFile();
                const readBackContent = await file.text();
                const readBackMatch = readBackContent.match(/estimate: (.+)/);
                const spentMatch = readBackContent.match(/spent_time: (.+)/);
                console.log('🔍 Verification read-back:');
                console.log('  estimate in file:', readBackMatch ? readBackMatch[1] : 'not found');
                console.log('  spent_time in file:', spentMatch ? spentMatch[1] : 'not found');
            } catch (readError) {
                console.warn('⚠️ Could not read back file for verification:', readError);
            }
            
            // Remove old file if location changed
            if (currentFile && currentFile.status !== targetStatus) {
                try {
                    await currentFile.dirHandle.removeEntry(currentFile.fileName);
                    console.log(`Moved task from ${currentFile.status} to ${targetStatus}`);
                } catch (e) {
                    console.warn('Could not remove old file:', e);
                }
            }
            
            console.log('✅ Task saved to file system successfully');
            
            // Update local cache
            const projectTasks = this.projectTasks[projectId] || [];
            const taskIndex = projectTasks.findIndex(t => t.id === task.id);
            if (taskIndex !== -1) {
                projectTasks[taskIndex] = task;
            } else {
                projectTasks.push(task);
                this.projectTasks[projectId] = projectTasks;
            }
            
            return true;
            
        } catch (error) {
            console.error('Error saving task to file system:', error);
            throw error;
        }
    }
    
    async findTaskFile(projectDirHandle, taskId) {
        const statusFolders = ['backlog', 'progress', 'review', 'testing', 'done'];
        const possibleFileNames = [
            `${taskId}.md`,
            `${taskId}-ios-welcome-screen.md`,
            `${taskId}-ios-file-details.md`,
            // Add more specific patterns based on your file naming
        ];
        
        console.log(`🔍 Looking for task file with ID: ${taskId} in project ${projectDirHandle.name}`);
        
        for (const status of statusFolders) {
            try {
                const statusDirHandle = await projectDirHandle.getDirectoryHandle(status);
                
                // Check direct files
                for await (const [name, handle] of statusDirHandle.entries()) {
                    if (handle.kind === 'file' && name.endsWith('.md')) {
                        // Check if filename contains the task ID
                        if (name.startsWith(taskId) || name.includes(taskId)) {
                            console.log(`✅ Found matching task file: ${status}/${name}`);
                            return { handle: handle, status, dirHandle: statusDirHandle, fileName: name };
                        }
                    } else if (handle.kind === 'directory' && status === 'progress') {
                        // Check developer subfolders
                        try {
                            for await (const [subName, subHandle] of handle.entries()) {
                                if (subHandle.kind === 'file' && subName.endsWith('.md')) {
                                    if (subName.startsWith(taskId) || subName.includes(taskId)) {
                                        console.log(`✅ Found matching task file: ${status}/${name}/${subName}`);
                                        return { handle: subHandle, status, dirHandle: handle, fileName: subName };
                                    }
                                }
                            }
                        } catch (e) {
                            // Error iterating developer subfolder
                        }
                    }
                }
            } catch (e) {
                // Status folder doesn't exist, continue
                console.log(`⚠️ Status folder ${status} not accessible:`, e.message);
            }
        }
        
        console.log(`❌ Task file not found for ID: ${taskId}`);
        return null; // File not found
    }
    
    buildTaskFileContent(task, oldFrontmatter, oldStatus, newStatus, oldContent) {
        // Normalize time estimates to consistent format
        const normalizeTime = (timeStr) => {
            if (!timeStr || timeStr === '' || timeStr === '0') return '0h';
            if (typeof timeStr === 'number') return `${timeStr}h`;
            if (timeStr.endsWith('h')) return timeStr;
            return `${timeStr}h`;
        };

        // Build frontmatter
        const frontmatter = {
            title: task.title || '',
            estimate: normalizeTime(task.timeEstimate),
            spent_time: normalizeTime(task.timeSpent),
            priority: task.priority || 'medium',
            developer: task.developer || '',
            status: newStatus || task.status || task.column || 'backlog',
            created: task.created || new Date().toISOString().split('T')[0]
        };
        
        console.log('📋 buildTaskFileContent: Building frontmatter for task:', task.id);
        console.log('  Raw task data:', {
            timeEstimate: task.timeEstimate,
            timeSpent: task.timeSpent,
            hasContent: !!task.content,
            hasFullContent: !!task.fullContent,
            hasOldContent: !!oldContent,
            oldContentLength: oldContent ? oldContent.length : 0
        });
        console.log('  Normalized frontmatter:', {
            estimate: frontmatter.estimate,
            spent_time: frontmatter.spent_time
        });
        
        // Remove empty values
        Object.keys(frontmatter).forEach(key => {
            if (!frontmatter[key]) {
                delete frontmatter[key];
            }
        });
        
        // Build YAML content
        const yamlLines = Object.entries(frontmatter).map(([key, value]) => `${key}: ${value}`);
        const yamlContent = yamlLines.join('\n');
        
        // Get main content - ALWAYS extract markdown without frontmatter
        let markdownContent = '';
        
        // First try to get content from task object
        let rawContent = task.content || task.fullContent || '';
        console.log('🔍 DEBUG: Raw content from task:', {
            hasContent: !!task.content,
            hasFullContent: !!task.fullContent,
            rawContentLength: rawContent.length,
            rawContentStart: rawContent.substring(0, 100),
            startsWithYaml: rawContent.startsWith('---')
        });
        
        // If task object has content, extract markdown part (skip frontmatter)
        if (rawContent) {
            if (rawContent.startsWith('---')) {
                const parts = rawContent.split('---', 3);
                if (parts.length >= 3) {
                    markdownContent = parts[2] || ''; // Get content after second ---
                    console.log('🔄 Extracted markdown from task content (skipped frontmatter), length:', markdownContent.length);
                } else {
                    markdownContent = rawContent; // Fallback if parsing fails
                    console.log('🔄 Used task content as fallback, length:', markdownContent.length);
                }
            } else {
                markdownContent = rawContent; // No frontmatter in task content
                console.log('🔄 Used task content (no frontmatter), length:', markdownContent.length);
            }
        }
        // If no content in task object, extract from old content (skip frontmatter)
        else if (oldContent) {
            if (oldContent.startsWith('---')) {
                const parts = oldContent.split('---', 3);
                if (parts.length >= 3) {
                    markdownContent = parts[2] || ''; // Get content after second ---
                    console.log('🔄 Extracted markdown from old content, length:', markdownContent.length);
                } else {
                    markdownContent = oldContent; // Fallback to full content if parsing fails
                    console.log('🔄 Used full old content as fallback, length:', markdownContent.length);
                }
            } else {
                markdownContent = oldContent; // No frontmatter, use full content
                console.log('🔄 Used old content (no frontmatter), length:', markdownContent.length);
            }
        } else {
            console.log('⚠️ No content available from any source');
        }
        
        // Generate change log
        const changes = [];
        if (oldStatus && newStatus && oldStatus !== newStatus) {
            changes.push(`Status changed: ${oldStatus} → ${newStatus}`);
        }
        
        if (oldFrontmatter.title !== frontmatter.title && oldFrontmatter.title) {
            changes.push(`Title changed: "${oldFrontmatter.title}" → "${frontmatter.title}"`);
        }
        
        // Normalize old values for comparison
        const oldEstimateNormalized = normalizeTime(oldFrontmatter.estimate);
        const oldSpentNormalized = normalizeTime(oldFrontmatter.spent_time);
        
        if (oldEstimateNormalized !== frontmatter.estimate) {
            changes.push(`Time estimate changed: ${oldEstimateNormalized} → ${frontmatter.estimate}`);
        }
        
        if (oldSpentNormalized !== frontmatter.spent_time) {
            changes.push(`Time spent changed: ${oldSpentNormalized} → ${frontmatter.spent_time}`);
        }
        
        if (oldFrontmatter.priority !== frontmatter.priority) {
            changes.push(`Priority changed: ${oldFrontmatter.priority || 'medium'} → ${frontmatter.priority}`);
        }
        
        if (oldFrontmatter.developer !== frontmatter.developer) {
            if (frontmatter.developer) {
                changes.push(`Developer assigned: ${frontmatter.developer}`);
            } else if (oldFrontmatter.developer) {
                changes.push(`Developer removed: ${oldFrontmatter.developer}`);
            }
        }
        
        // Add change log if there are changes
        if (changes.length > 0) {
            const changeAuthor = task.changeAuthor || 'User';
            const changeTimestamp = new Date().toLocaleString('en-US');
            const changesSummary = '- ' + changes.join('\n- ');
            
            if (!markdownContent.endsWith('\n')) {
                markdownContent += '\n';
            }
            markdownContent += `\n---\n**Changed:** ${changeTimestamp} by ${changeAuthor}\n${changesSummary}\n`;
        }
        
        // Build final content
        const finalContent = `---\n${yamlContent}\n---\n\n${markdownContent}`;
        
        console.log('🔍 DEBUG: Final content being built:', {
            yamlLength: yamlContent.length,
            markdownLength: markdownContent.length,
            finalLength: finalContent.length,
            finalStart: finalContent.substring(0, 200)
        });
        
        return finalContent;
    }


    async saveProjectToFileSystem(projectId, updatedProject) {
        if (!this.directoryHandle) {
            throw new Error('No directory handle available');
        }

        try {
            console.log('💾 Saving project to file system:', projectId);
            console.log('🔤 Project ID encoding check:', {
                projectId,
                length: projectId.length,
                charCodes: Array.from(projectId).map(c => c.charCodeAt(0)),
                chars: Array.from(projectId),
                encoded: encodeURIComponent(projectId)
            });
            
            // Get project directory
            let projectDirHandle;
            console.log('🔍 Looking for project directory:', projectId);
            
            // Try different encoding approaches for project names with special characters
            const projectIdVariants = [
                projectId,                      // Original
                encodeURIComponent(projectId),  // URL encoded
                projectId.normalize('NFC'),     // Unicode normalization
                projectId.normalize('NFD')      // Alternative normalization
            ];
            
            let foundProjectDir = false;
            
            try {
                // First try looking in projects/ subdirectory
                console.log('🔍 Trying projects/ subdirectory first...');
                const projectsDir = await this.directoryHandle.getDirectoryHandle('projects');
                
                for (let variant of projectIdVariants) {
                    try {
                        console.log(`🔍 Trying project variant: "${variant}"`);
                        projectDirHandle = await projectsDir.getDirectoryHandle(variant, { create: false });
                        console.log('✅ Found project in projects/ subdirectory with variant:', variant);
                        foundProjectDir = true;
                        break;
                    } catch (variantError) {
                        console.log(`❌ Variant "${variant}" not found:`, variantError.message);
                    }
                }
                
                if (!foundProjectDir) {
                    throw new Error('No project variant found in projects/ subdirectory');
                }
            } catch (error) {
                console.log('⚠️ Project not found in projects/ subdirectory, trying root directory...');
                console.log('❌ Projects subdirectory error:', error.message);
                
                try {
                    // Fallback to root directory with variants
                    for (let variant of projectIdVariants) {
                        try {
                            console.log(`🔍 Trying root project variant: "${variant}"`);
                            projectDirHandle = await this.directoryHandle.getDirectoryHandle(variant, { create: false });
                            console.log('✅ Found project in root directory with variant:', variant);
                            foundProjectDir = true;
                            break;
                        } catch (variantError) {
                            console.log(`❌ Root variant "${variant}" not found:`, variantError.message);
                        }
                    }
                    
                    if (!foundProjectDir) {
                        // List available directories for debugging
                        console.log('🔍 Available directories:');
                        try {
                            for await (const [name, handle] of this.directoryHandle.entries()) {
                                if (handle.kind === 'directory') {
                                    console.log(`  - "${name}" (${name.length} chars, codes: ${Array.from(name).map(c => c.charCodeAt(0)).join(',')})`);
                                }
                            }
                            
                            // Also list projects subdirectory
                            const projectsDir = await this.directoryHandle.getDirectoryHandle('projects');
                            console.log('🔍 Available projects:');
                            for await (const [name, handle] of projectsDir.entries()) {
                                if (handle.kind === 'directory') {
                                    console.log(`  - "${name}" (${name.length} chars, codes: ${Array.from(name).map(c => c.charCodeAt(0)).join(',')})`);
                                }
                            }
                        } catch (listError) {
                            console.log('❌ Could not list directories:', listError.message);
                        }
                        
                        throw new Error(`Project directory '${projectId}' not found. Tried variants: ${projectIdVariants.join(', ')}`);
                    }
                } catch (rootError) {
                    console.error('❌ Project directory not found anywhere:', rootError.message);
                    throw new Error(`Project directory '${projectId}' not found in projects/ subdirectory or root directory. Original error: ${rootError.message}`);
                }
            }
            
            // Get or create README.md file
            console.log('📄 Getting README.md file handle...');
            const readmeHandle = await projectDirHandle.getFileHandle('README.md', { create: true });
            console.log('✅ README.md handle obtained');
            
            // Read existing content
            let existingContent = '';
            try {
                console.log('📖 Reading existing README.md content...');
                const existingFile = await readmeHandle.getFile();
                existingContent = await existingFile.text();
                console.log('✅ Existing content read, length:', existingContent.length);
                console.log('📝 First 200 chars of existing content:', existingContent.substring(0, 200));
            } catch (error) {
                console.log('⚠️ Could not read existing content (file may not exist):', error.message);
                // File doesn't exist or can't be read, start with empty content
            }
            
            // Build new README content
            console.log('🏗️ Building new README content...');
            const newContent = this.buildReadmeContent(updatedProject, existingContent);
            console.log('✅ New content built, length:', newContent.length);
            console.log('📝 First 200 chars of new content:', newContent.substring(0, 200));
            console.log('📝 Last 200 chars of new content:', newContent.substring(Math.max(0, newContent.length - 200)));
            
            // Write to file
            console.log('💾 Creating writable stream...');
            const writable = await readmeHandle.createWritable();
            console.log('✅ Writable stream created');
            
            console.log('✍️ Writing content to file...');
            await writable.write(newContent);
            console.log('✅ Content written to stream');
            
            console.log('🔒 Closing writable stream...');
            await writable.close();
            console.log('✅ Stream closed successfully');
            
            console.log('✅ Project README.md saved successfully');
            
            // Update local cache
            const projectIndex = this.projects.findIndex(p => p.id === projectId);
            if (projectIndex !== -1) {
                this.projects[projectIndex] = { ...this.projects[projectIndex], ...updatedProject };
            }
            
            return true;
            
        } catch (error) {
            console.error('Error saving project to file system:', error);
            throw error;
        }
    }

    buildReadmeContent(updatedProject, existingContent) {
        console.log('🏗️ Building README content for project:', updatedProject);
        console.log('📋 Existing content length:', existingContent.length);
        
        // Extract existing project info for change history
        const existingProject = this.extractProjectInfo(existingContent);
        console.log('📊 Extracted existing project info:', existingProject);
        
        // Extract existing content that we want to preserve (everything except title and description)
        let contentLines = existingContent.split('\n');
        let preservedContent = '';
        let historySection = '';
        
        // Find the change history section if it exists
        const historyIndex = contentLines.findIndex(line => line.trim().startsWith('## История изменений') || line.trim().startsWith('## Change History'));
        if (historyIndex >= 0) {
            historySection = contentLines.slice(historyIndex).join('\n');
        }
        
        // Find the first line that starts with # (title)
        const titleIndex = contentLines.findIndex(line => line.trim().startsWith('# '));
        
        if (titleIndex >= 0) {
            // Keep everything after the title and first paragraph, but before history section
            let startIndex = titleIndex + 1;
            
            // Skip the description paragraph (find next empty line or #)
            while (startIndex < contentLines.length) {
                const line = contentLines[startIndex].trim();
                if (line === '' || line.startsWith('#')) {
                    break;
                }
                startIndex++;
            }
            
            // Skip empty lines
            while (startIndex < contentLines.length && contentLines[startIndex].trim() === '') {
                startIndex++;
            }
            
            // Preserve remaining content up to history section
            let endIndex = historyIndex > 0 ? historyIndex : contentLines.length;
            if (startIndex < endIndex) {
                preservedContent = contentLines.slice(startIndex, endIndex).join('\n').trim();
            }
        } else if (!historySection) {
            // No existing title found, preserve all content if no history section
            preservedContent = existingContent.trim();
        }
        
        // Build new README content
        let newContent = `# ${updatedProject.name || updatedProject.id}\n\n`;
        
        if (updatedProject.description && updatedProject.description.trim()) {
            newContent += `${updatedProject.description.trim()}\n\n`;
        }
        
        if (preservedContent && preservedContent.trim()) {
            newContent += preservedContent + '\n\n';
        }
        
        // Generate change history entry if there are changes
        const hasChanges = this.hasProjectChanges(existingProject, updatedProject);
        if (hasChanges) {
            const changeEntry = this.generateChangeEntry(existingProject, updatedProject);
            
            if (historySection) {
                // Insert new change at the beginning of existing history
                const historyLines = historySection.split('\n');
                const headerLine = historyLines[0]; // "## История изменений" or "## Change History"
                const restOfHistory = historyLines.slice(1);
                
                newContent += `${headerLine}\n\n${changeEntry}\n${restOfHistory.join('\n')}\n`;
            } else {
                // Create new history section
                newContent += `## История изменений\n\n${changeEntry}\n`;
            }
        } else if (historySection) {
            // No changes, but preserve existing history
            console.log('📚 Preserving existing history section');
            newContent += historySection + '\n';
        } else {
            console.log('📚 No history section to preserve');
        }
        
        console.log('✅ Final README content built, total length:', newContent.length);
        console.log('📝 Content structure check - contains history:', newContent.includes('## История изменений'));
        return newContent;
    }

    extractProjectInfo(content) {
        const lines = content.split('\n');
        let name = '';
        let description = '';
        
        // Find title
        const titleIndex = lines.findIndex(line => line.trim().startsWith('# '));
        if (titleIndex >= 0) {
            name = lines[titleIndex].replace(/^#\s*/, '').trim();
        }
        
        // Find description (first paragraph after title)
        if (titleIndex >= 0) {
            let descStartIndex = titleIndex + 1;
            
            // Skip empty lines
            while (descStartIndex < lines.length && lines[descStartIndex].trim() === '') {
                descStartIndex++;
            }
            
            // Collect description lines until empty line or section header
            let descLines = [];
            for (let i = descStartIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line === '' || line.startsWith('#')) {
                    break;
                }
                descLines.push(line);
            }
            
            description = descLines.join(' ').trim();
        }
        
        return { name, description };
    }

    hasProjectChanges(existing, updated) {
        if (!existing.name && !existing.description) {
            return true; // New project
        }
        
        return existing.name !== (updated.name || updated.id) || 
               existing.description !== (updated.description || '').trim();
    }

    generateChangeEntry(existing, updated) {
        const timestamp = new Date().toLocaleString('uk-UA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let changes = [];
        
        if (!existing.name && !existing.description) {
            changes.push('Проект створено');
        } else {
            if (existing.name !== (updated.name || updated.id)) {
                changes.push(`Назва змінена з "${existing.name}" на "${updated.name || updated.id}"`);
            }
            
            if (existing.description !== (updated.description || '').trim()) {
                if (!existing.description && updated.description) {
                    changes.push('Додано опис проекту');
                } else if (existing.description && !updated.description) {
                    changes.push('Видалено опис проекту');
                } else {
                    changes.push('Опис проекту оновлено');
                }
            }
        }
        
        return `**${timestamp}** - ${changes.join(', ')}`;
    }

    async getFullTaskContent(projectId, task) {
        if ((this.loadingMode === 'server' || this.loadingMode === 'hybrid') && this.apiClient) {
            try {
                const fullTask = await this.apiClient.getTask(projectId, task.id);
                return fullTask ? fullTask.fullContent : null;
            } catch (error) {
                console.warn('Could not get full task content from server:', error);
                return task.fullContent || task.content;
            }
        } else if (this.loadingMode === 'filesystem' && this.fileSystemLoader) {
            return await this.fileSystemLoader.getFullTaskContent(projectId, task);
        } else {
            return task.fullContent || task.content;
        }
    }

    // Public API methods
    getProjects() {
        return this.projects;
    }

    getTasksForProject(projectId) {
        const tasks = this.projectTasks[projectId] || [];
        console.log(`🔍 getTasksForProject(${projectId}): returning ${tasks.length} tasks`);
        if (tasks.length > 0) {
            console.log(`🔍 getTasksForProject(${projectId}): first 3 tasks:`, tasks.slice(0, 3).map(t => `${t.id}: ${t.title}`));
        }
        console.log(`🔍 getTasksForProject(${projectId}): available projects in cache:`, Object.keys(this.projectTasks));
        return tasks;
    }

    // Get developers from progress folder structure for specific project
    async getProjectDevelopers(projectId, forceRefresh = false) {
        console.log(`🔍 Getting developers for project: ${projectId}`);
        
        // Return cached developers if available and not forcing refresh
        if (!forceRefresh && this.projectDevelopers[projectId]) {
            console.log(`📋 Using cached developers for ${projectId}:`, this.projectDevelopers[projectId]);
            return this.projectDevelopers[projectId];
        }
        
        const developers = new Set();
        
        try {
            if (this.loadingMode === 'filesystem' && window.firaDirectoryHandle) {
                // Get project directory
                const projectHandle = await window.firaDirectoryHandle.getDirectoryHandle(projectId);
                
                // Check all status folders for developer directories
                const statusFolders = ['progress', 'inprogress', 'review', 'testing', 'done'];
                
                for (const folderName of statusFolders) {
                    try {
                        const statusHandle = await projectHandle.getDirectoryHandle(folderName);
                        
                        // List all subdirectories in status folder
                        for await (const [name, entry] of statusHandle.entries()) {
                            if (entry.kind === 'directory' && (name.startsWith('dev-') || name.startsWith('tech-'))) {
                                developers.add(name);
                                console.log(`👨‍💻 Found developer folder: ${name} in ${folderName}`);
                            }
                        }
                    } catch (statusError) {
                        console.log(`📁 No ${folderName} folder found for project ${projectId}`);
                    }
                }
            } else if (this.loadingMode === 'server' || this.loadingMode === 'hybrid') {
                // For server mode, first try to get developers from project data (if available from server)
                const project = this.projects.find(p => p.id === projectId);
                if (project && project.developers && Array.isArray(project.developers)) {
                    project.developers.forEach(dev => {
                        if (dev && dev.trim() && (dev.startsWith('dev-') || dev.startsWith('tech-'))) {
                            developers.add(dev.trim());
                        }
                    });
                    console.log(`👥 Using project.developers from server: ${project.developers}`);
                }
                
                // Fallback: get developers from all tasks if project developers not available
                if (developers.size === 0) {
                    const tasks = this.getTasksForProject(projectId);
                    tasks.forEach(task => {
                        if (task.developer && (task.developer.startsWith('dev-') || task.developer.startsWith('tech-'))) {
                            developers.add(task.developer);
                        }
                    });
                }
            } else {
                // For static/demo mode, get developers from all tasks
                const tasks = this.getTasksForProject(projectId);
                tasks.forEach(task => {
                    if (task.developer && (task.developer.startsWith('dev-') || task.developer.startsWith('tech-'))) {
                        developers.add(task.developer);
                    }
                });
            }
        } catch (error) {
            console.warn(`⚠️ Error getting developers for project ${projectId}:`, error);
        }
        
        const developerList = Array.from(developers).sort();
        console.log(`👥 Found ${developerList.length} developers for project ${projectId}:`, developerList);
        
        // Cache the results for future use
        this.projectDevelopers[projectId] = developerList;
        
        return developerList;
    }

    getAllTasks() {
        return this.allTasks;
    }

    getLoadingMode() {
        return this.loadingMode;
    }

    isDataLoaded() {
        return this.isLoaded;
    }

    // Cache management methods
    async cacheExists() {
        try {
            const response = await fetch(this.cacheFileName);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async isCacheStale() {
        try {
            const response = await fetch(this.cacheFileName);
            if (!response.ok) return true;
            
            const cacheData = await response.json();
            const cacheTimestamp = new Date(cacheData.timestamp);
            const now = new Date();
            
            // Cache is stale if older than 24 hours
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
            return (now - cacheTimestamp) > maxAge;
        } catch (error) {
            return true; // Consider stale if we can't read it
        }
    }

    async loadFromCache() {
        // Try to load from file first
        try {
            const response = await fetch(this.cacheFileName);
            if (response.ok) {
                const cacheData = await response.json();
                
                // Validate cache structure
                if (!cacheData.projects || !cacheData.allTasks || !cacheData.projectTasks) {
                    console.warn('Invalid cache file structure');
                } else {
                    // Load data from cache file
                    this.projects = this.filterDeletedProjects(cacheData.projects);
                    this.allTasks = cacheData.allTasks;
                    this.projectTasks = cacheData.projectTasks;
                    this.cacheTimestamp = new Date(cacheData.timestamp);
                    this.loadingMode = 'cache';
                    this.isLoaded = true;
                    
                    console.log(`✅ Loaded ${this.projects.length} projects and ${this.allTasks.length} tasks from cache file`);
                    this.notifyDataLoaded();
                    return true;
                }
            }
        } catch (error) {
            console.warn('Failed to load from cache file:', error);
        }

        // Fallback to localStorage
        try {
            const cacheString = localStorage.getItem('fira-cache-data');
            if (cacheString) {
                const cacheData = JSON.parse(cacheString);
                
                // Validate cache structure
                if (!cacheData.projects || !cacheData.allTasks || !cacheData.projectTasks) {
                    console.warn('Invalid localStorage cache structure');
                    return false;
                }
                
                // Load data from localStorage cache
                this.projects = this.filterDeletedProjects(cacheData.projects);
                this.allTasks = cacheData.allTasks;
                this.projectTasks = cacheData.projectTasks;
                this.cacheTimestamp = new Date(cacheData.timestamp);
                this.loadingMode = 'cache';
                this.isLoaded = true;
                
                console.log(`✅ Loaded ${this.projects.length} projects and ${this.allTasks.length} tasks from localStorage cache`);
                this.notifyDataLoaded();
                return true;
            }
        } catch (error) {
            console.warn('Failed to load from localStorage cache:', error);
        }
        
        return false;
    }

    async loadFromServerAndCache() {
        try {
            // Just load from server, no cache generation needed
            await this.loadFromServer();
            
        } catch (error) {
            console.error('Failed to load from server:', error);
            throw error;
        }
    }

    async generateCache() {
        if (!this.apiClient || !this.apiClient.isServerAvailable) {
            console.warn('Cannot generate cache without server');
            return false;
        }

        try {
            // For mini-server, use already loaded data instead of scanning again
            console.log('🔄 Generating cache from already loaded data...');
            
            const cacheData = {
                timestamp: new Date().toISOString(),
                projects: this.projects,
                allTasks: this.allTasks,
                projectTasks: this.projectTasks,
                fileStructure: {},
                metadata: {
                    version: '1.0',
                    generatedBy: 'Fira-Cache-System',
                    totalProjects: this.projects.length,
                    totalTasks: this.allTasks.length
                }
            };
            
            // Try to save cache file via server endpoint
            try {
                const saved = await this.apiClient.saveCacheFile(cacheData);
                if (saved) {
                    console.log('✅ Cache file saved to server directory');
                    
                    // Also store in localStorage as backup
                    localStorage.setItem('fira-cache-data', JSON.stringify(cacheData));
                    return true;
                }
            } catch (serverError) {
                console.warn('Failed to save cache via server:', serverError);
            }
            
            // Fallback: store in localStorage and offer download
            localStorage.setItem('fira-cache-data', JSON.stringify(cacheData));
            console.log('✅ Cache stored in localStorage');
            
            // Offer download as fallback
            if (confirm('Cache generated! Would you like to download the cache file as backup?')) {
                const blob = new Blob([JSON.stringify(cacheData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = this.cacheFileName;
                a.click();
                URL.revokeObjectURL(url);
            }
            
            return true;
            
        } catch (error) {
            console.error('Failed to generate cache:', error);
            return false;
        }
    }

    async forceServerScan() {
        if (!this.apiClient || !this.apiClient.isServerAvailable) {
            throw new Error('Server not available for scanning');
        }

        try {
            // Trigger server scan and cache generation
            await this.loadFromServerAndCache();
            this.requiresServerScan = false;
            this.isLoaded = true;
            this.notifyDataLoaded();
            
        } catch (error) {
            console.error('Failed to perform server scan:', error);
            throw error;
        }
    }

    // Allow user to reset their mode choice (for localhost only)
    resetModeChoice() {
        const currentHostname = window.location.hostname;
        if (currentHostname.includes('localhost') || currentHostname.includes('127.0.0.1')) {
            sessionStorage.removeItem('fira-mode-selected');
            sessionStorage.removeItem('fira-directory-selected');
            sessionStorage.removeItem('fira-directory-name');
            window.firaDirectoryHandle = null;
            console.log('🔄 Mode choice reset. Refresh the page to choose again.');
            alert('Mode choice reset. Refresh the page to choose between Server mode or Local Directory mode.');
        }
    }

    // Session management for file:// protocol
    saveToSession() {
        // Save current valid data to sessionStorage for navigation between file:// pages
        if (window.location.protocol === 'file:' && this.isLoaded) {
            try {
                const sessionData = {
                    timestamp: new Date().toISOString(),
                    projects: this.projects,
                    allTasks: this.allTasks,
                    projectTasks: this.projectTasks,
                    loadingMode: this.loadingMode
                };
                
                sessionStorage.setItem('fira-session-data', JSON.stringify(sessionData));
                console.log('✅ Session data saved to sessionStorage');
            } catch (error) {
                console.warn('Failed to save session data:', error);
            }
        }
    }

    // Event handling
    notifyDataLoaded() {
        // Complete all loading steps (only if loading screen was shown)
        if (window.loadingManager && this.shouldShowLoading) {
            window.loadingManager.completeStep('tasks-load');
            window.loadingManager.setActiveStep('complete');
            window.loadingManager.completeStep('complete');
            
            // Hide loading screen after a brief delay to show completion
            setTimeout(() => {
                window.loadingManager.hide();
            }, 800);
        } else if (this.shouldShowLoading === false) {
            console.log('🔄 Background loading completed for project page refresh');
        }
        
        // Save session data when data is loaded
        this.saveToSession();
        
        // Dispatch custom event when data is loaded
        window.dispatchEvent(new CustomEvent('globalDataLoaded', {
            detail: {
                projects: this.projects,
                tasks: this.allTasks,
                mode: this.loadingMode,
                fromCache: this.loadingMode === 'cache',
                cacheTimestamp: this.cacheTimestamp
            }
        }));
    }

    notifyRequiresServerScan() {
        // Dispatch custom event when server scan is required
        window.dispatchEvent(new CustomEvent('serverScanRequired', {
            detail: {
                message: 'Cache is stale. Please start the server to update project data.',
                cacheTimestamp: this.cacheTimestamp
            }
        }));
    }

    async addDeveloperToProject(projectId, developerId, developerName) {
        console.log(`👥 Adding developer ${developerName} (${developerId}) to project ${projectId}`);
        
        // Prevent duplicate calls for the same developer within a short time
        const operationKey = `${projectId}-${developerId}`;
        if (this.developerOperations && this.developerOperations.has(operationKey)) {
            console.log(`🔄 Developer addition for ${developerId} in project ${projectId} already in progress, skipping duplicate`);
            return;
        }
        
        // Track this operation
        if (!this.developerOperations) {
            this.developerOperations = new Set();
        }
        this.developerOperations.add(operationKey);
        
        // Clean up the operation tracking after 10 seconds
        setTimeout(() => {
            if (this.developerOperations) {
                this.developerOperations.delete(operationKey);
            }
        }, 10000);
        
        try {
            // Initialize API client if not already done
            if (!this.apiClient && window.firaAPIClient) {
                this.apiClient = window.firaAPIClient;
            }
            
            // ONLY use server API - no File System API fallback to avoid directory selection popup
            if (this.apiClient) {
                console.log('📡 Using server API to create developer folders in all status directories');
                
                // Create developer folders in all relevant status directories
                const statusDirectories = ['progress', 'review', 'testing', 'done'];
                const createPromises = [];
                
                for (const statusDir of statusDirectories) {
                    const promise = this.apiClient.createDirectory(projectId, statusDir, developerId)
                        .then(result => {
                            if (result && result.success) {
                                console.log(`✅ Developer folder created: ${projectId}/${statusDir}/${developerId}`);
                                return { statusDir, success: true };
                            } else {
                                console.warn(`⚠️ Failed to create folder ${projectId}/${statusDir}/${developerId}:`, result?.error);
                                return { statusDir, success: false, error: result?.error };
                            }
                        })
                        .catch(error => {
                            console.warn(`⚠️ Error creating folder ${projectId}/${statusDir}/${developerId}:`, error);
                            return { statusDir, success: false, error: error.message };
                        });
                    
                    createPromises.push(promise);
                }
                
                // Wait for all directory creation attempts
                const results = await Promise.all(createPromises);
                const successCount = results.filter(r => r.success).length;
                
                if (successCount > 0) {
                    console.log(`✅ Created ${successCount}/${statusDirectories.length} developer folders via server API`);

                    // Update project's developers list in memory
                    const project = this.projects.find(p => p.id === projectId);
                    if (project) {
                        if (!project.developers) {
                            project.developers = [];
                        }
                        if (!project.developers.includes(developerId)) {
                            project.developers.push(developerId);
                            console.log(`👥 Added ${developerId} to project.developers for ${projectId}`);
                        }
                    }

                    // Clear developers cache to force refresh
                    if (this.projectDevelopers[projectId]) {
                        delete this.projectDevelopers[projectId];
                    }

                    // Clean up the operation tracking on success
                    if (this.developerOperations) {
                        this.developerOperations.delete(operationKey);
                    }

                    return;
                } else {
                    const errors = results.map(r => `${r.statusDir}: ${r.error || 'Unknown error'}`).join(', ');
                    throw new Error(`Failed to create any developer folders: ${errors}`);
                }
            } else {
                console.error('❌ API client not available');
                throw new Error('Server API not available. Please ensure the server is running.');
            }
            
        } catch (error) {
            console.error(`❌ Error adding developer to project:`, error);
            // Clean up the operation tracking on error
            if (this.developerOperations) {
                this.developerOperations.delete(operationKey);
            }
            throw error;
        }
    }
}

// Export GlobalDataManager class to global scope
window.GlobalDataManager = GlobalDataManager;

// Create global instance (singleton pattern)
if (!window.globalDataManager) {
    console.log('🆕 Creating new GlobalDataManager instance');
    window.globalDataManager = new GlobalDataManager();
} else {
    console.log('♻️  Using existing GlobalDataManager instance');
    console.log('  - DirectoryHandle exists:', !!window.globalDataManager.directoryHandle);
    console.log('  - Data loaded:', window.globalDataManager.isDataLoaded());
    console.log('  - Loading mode:', window.globalDataManager.loadingMode);
}

} // Close the if (typeof GlobalDataManager === 'undefined') block
