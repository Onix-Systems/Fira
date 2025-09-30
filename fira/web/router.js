// Simple SPA Router for Fira Project Management

// Global navigation functions (defined early to ensure availability)
function navigateToProject(projectName) {
    console.log('navigateToProject called with:', projectName);
    if (window.location.protocol === 'file:') {
        // Check if we're already in the pages/ directory
        const currentPath = window.location.pathname;
        if (currentPath.includes('/pages/')) {
            // We're in pages/ directory, navigate relatively
            window.location.href = `project-board.html?project=${encodeURIComponent(projectName)}`;
        } else {
            // We're in root directory, navigate to pages/
            window.location.href = `pages/project-board.html?project=${encodeURIComponent(projectName)}`;
        }
    } else if (window.firaRouter && typeof window.firaRouter.navigateTo === 'function') {
        window.firaRouter.navigateTo(`/project/${encodeURIComponent(projectName)}`);
    } else {
        // Wait for router to be ready instead of immediate fallback
        let attempts = 0;
        const waitForRouter = () => {
            if (window.firaRouter && typeof window.firaRouter.navigateTo === 'function') {
                window.firaRouter.navigateTo(`/project/${encodeURIComponent(projectName)}`);
            } else if (attempts < 10) {
                attempts++;
                setTimeout(waitForRouter, 100);
            } else {
                // Final fallback only after waiting
                window.location.href = `/project/${encodeURIComponent(projectName)}`;
            }
        };
        waitForRouter();
    }
}

function navigateToTask(projectName, taskId) {
    console.log('navigateToTask called with:', projectName, taskId);
    if (window.location.protocol === 'file:') {
        // Check if we're already in the pages/ directory
        const currentPath = window.location.pathname;
        if (currentPath.includes('/pages/')) {
            // We're in pages/ directory, navigate relatively
            window.location.href = `project-board.html?project=${encodeURIComponent(projectName)}&task=${encodeURIComponent(taskId)}`;
        } else {
            // We're in root directory, navigate to pages/
            window.location.href = `pages/project-board.html?project=${encodeURIComponent(projectName)}&task=${encodeURIComponent(taskId)}`;
        }
    } else if (window.firaRouter && typeof window.firaRouter.navigateTo === 'function') {
        window.firaRouter.navigateTo(`/project/${encodeURIComponent(projectName)}/task/${encodeURIComponent(taskId)}`);
    } else {
        // Fallback for server mode when router not ready
        window.location.href = `/project/${encodeURIComponent(projectName)}/task/${encodeURIComponent(taskId)}`;
    }
}

function navigateToDashboard() {
    console.log('navigateToDashboard called');
    console.log('Current protocol:', window.location.protocol);
    console.log('Current pathname:', window.location.pathname);
    console.log('Router available:', !!window.firaRouter);
    
    if (window.location.protocol === 'file:') {
        const currentPath = window.location.pathname;
        if (currentPath.includes('/pages/')) {
            window.location.href = 'dashboard.html';
        } else {
            window.location.href = 'pages/dashboard.html';
        }
    } else {
        // Server mode
        if (window.firaRouter && typeof window.firaRouter.navigateTo === 'function') {
            console.log('Using router navigation to /');
            window.firaRouter.navigateTo('/');
        } else {
            console.log('Router not available, using direct navigation');
            window.location.href = '/';
        }
    }
}

// Make navigation functions globally available immediately
window.navigateToProject = navigateToProject;
window.navigateToTask = navigateToTask;
window.navigateToDashboard = navigateToDashboard;

class FiraRouter {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.container = null;

        // Bind methods
        this.navigateTo = this.navigateTo.bind(this);
        this.handlePopState = this.handlePopState.bind(this);
        this.handleLinkClick = this.handleLinkClick.bind(this);

        // Initialize router
        this.init();
    }

    init() {
        window.addEventListener('popstate', this.handlePopState);
        document.addEventListener('click', this.handleLinkClick);

        this.container = document.getElementById('app-content') || this.createContainer();
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'app-content';
        if (document.body) {
            document.body.appendChild(container);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.appendChild(container);
            });
        }
        return container;
    }

    addRoute(path, handler) {
        this.routes.set(path, handler);
    }

    async navigateTo(path, pushState = true) {
        console.log('Navigating to:', path);

        if (pushState && window.location.pathname !== path) {
            window.history.pushState({ path: path }, '', path);
        }

        this.currentRoute = path;
        await this.handleRoute(path);
    }

    async handleRoute(path) {
        console.log('Handling route:', path);
        this.clearActiveTimeouts();

        // OPTIMIZATION: Prevent unnecessary routing for task URL changes on same project
        if (this.currentRoute && window.projectBoard) {
            const currentRoute = this.matchRoute(this.currentRoute);
            const newRoute = this.matchRoute(path);
            
            // Check if we're just changing task parameter on the same project
            if (currentRoute && newRoute && 
                currentRoute.path.includes('/project/') && 
                newRoute.path.includes('/project/') &&
                currentRoute.params.projectname === newRoute.params.projectname &&
                window.projectBoard.currentProject &&
                window.projectBoard.currentProject.id === newRoute.params.projectname &&
                window.projectBoard.tasksLoaded) {
                
                console.log('🔄 Same project URL update, just opening task without route handling');
                
                // Directly call openTaskById if we have a task parameter
                const taskParam = newRoute.params.taskId || newRoute.params.taskname;
                if (taskParam && typeof window.openTaskById === 'function') {
                    window.openTaskById(taskParam);
                    this.currentRoute = path; // Update current route without handling
                    return;
                }
            }
        }

        // Check if user is logged in for protected routes
        if (this.requiresAuthentication(path)) {
            if (!this.isUserLoggedIn()) {
                console.log('🔐 Route requires authentication, redirecting to login');
                // Store intended destination for redirect after login
                localStorage.setItem('fira_redirect_after_login', path);
                this.showLoginScreen();
                return;
            }
        }

        const route = this.matchRoute(path);

        if (route) {
            console.log('Route found:', route.path, 'params:', route.params);
            try {
                await route.handler(route.params);
            } catch (error) {
                console.error('Route handler error:', error);
                // REFRESH FIX: If project route fails, redirect to dashboard instead of showing error
                if (path.includes('/project/')) {
                    console.log('🔄 Project route failed - redirecting to dashboard');
                    this.navigateTo('/', true);
                } else {
                    this.showError('Failed to load page');
                }
            }
        } else {
            console.log('No route found for:', path);
            // REFRESH FIX: If unknown project route, redirect to dashboard
            if (path.includes('/project/')) {
                console.log('🔄 Unknown project route - redirecting to dashboard');
                this.navigateTo('/', true);
            } else {
                this.handle404(path);
            }
        }
    }

    clearActiveTimeouts() {
        if (this.activeTimeouts) {
            this.activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
            this.activeTimeouts = [];
        }
    }

    matchRoute(path) {
        const cleanPath = path.replace(/\/$/, '') || '/';

        for (const [routePath, handler] of this.routes) {
            const params = this.extractParams(routePath, cleanPath);
            if (params !== null) {
                return { handler, params, path: routePath };
            }
        }

        return null;
    }

    extractParams(routePath, actualPath) {
        const routeParts = routePath.split('/');
        const actualParts = actualPath.split('/');

        if (routeParts.length !== actualParts.length) return null;

        const params = {};
        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const actualPart = actualParts[i];

            if (routePart.startsWith(':')) {
                params[routePart.slice(1)] = decodeURIComponent(actualPart);
            } else if (routePart !== actualPart) {
                return null;
            }
        }

        return params;
    }

    handlePopState(event) {
        console.log('🔙 Browser back/forward button pressed');
        console.log('  Current pathname:', window.location.pathname);
        console.log('  History state:', event.state);

        // Get the path from history state or fallback to current pathname
        const path = event.state?.path || window.location.pathname;
        console.log('  Navigating to:', path);

        this.navigateTo(path, false);
    }

    handleLinkClick(event) {
        const link = event.target.closest('[data-route]');
        if (link) {
            event.preventDefault();
            const path = link.getAttribute('data-route');
            this.navigateTo(path);
        }
    }

    async loadPage(pagePath) {
        try {
            let fullPath = pagePath;
            if (window.location.protocol === 'file:') {
                const baseDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
                fullPath = baseDir + pagePath;
            }

            const response = await fetch(fullPath);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Load CSS files from the page
            this.loadPageCSS(doc);
            
            const bodyContent = doc.body.innerHTML;
            this.container.innerHTML = bodyContent;

            this.executePageScripts(doc);
            return true;
        } catch (error) {
            console.error('Failed to load page:', error);
            this.showError(`Failed to load page: ${error.message}`);
            return false;
        }
    }

    loadPageCSS(doc) {
        // Get all CSS links from the page
        const cssLinks = doc.querySelectorAll('link[rel="stylesheet"]');
        
        cssLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            
            // Convert relative paths to absolute for server mode
            let cssPath = href;
            if (window.location.protocol !== 'file:') {
                if (href.startsWith('../')) {
                    // Convert ../style.css to /style.css for server mode
                    cssPath = '/' + href.substring(3);
                } else if (!href.startsWith('/') && !href.startsWith('http')) {
                    // Convert relative paths like "style.css" to absolute "/style.css"
                    cssPath = '/' + href;
                }
            }
            
            // Check if this CSS is already loaded (check href without query parameters)
            const baseCssPath = cssPath.split('?')[0];
            const existingLink = document.querySelector(`link[href*="${baseCssPath}"]`);
            if (existingLink) {
                console.log('CSS already loaded (found existing):', baseCssPath);
                // Remove old version and add new one with cache-busting
                existingLink.remove();
            }
            
            // Create new CSS link with cache-busting
            const newLink = document.createElement('link');
            newLink.rel = 'stylesheet';
            newLink.href = cssPath + '?v=' + Date.now(); // Add cache-busting parameter
            newLink.onload = () => console.log('CSS loaded:', cssPath);
            newLink.onerror = () => console.warn('Failed to load CSS:', cssPath);
            
            document.head.appendChild(newLink);
            console.log('Loading CSS with cache-bust:', cssPath + '?v=' + Date.now());
        });
    }

    executePageScripts(doc) {
        const scriptsToSkip = [
            '../projects-data.js',
            '../file-system.js', 
            '../global-data.js',
            '../script.js'
        ];

        const scripts = doc.querySelectorAll('script[src]');
        scripts.forEach(script => {
            const src = script.getAttribute('src');
            console.log(`🔍 Found script: "${src}"`);
            console.log(`  - Skip check: ${scriptsToSkip.includes(src)}`);
            console.log(`  - Already loaded: ${!!document.querySelector(`script[src="${src}"]`)}`);
            
            const isAlreadyLoaded = !!document.querySelector(`script[src="${src}"]`);
            const isProjectBoard = src === '../project-board.js';

            // Special handling for project-board.js - always ensure it's loaded and function is available
            if (isProjectBoard) {
                console.log(`🔄 Project board script detected, function check: ${typeof window.initProjectBoard}`);
                console.log(`🔄 Force loading project-board.js to ensure fresh functionality`);

                // Always remove existing script and reload
                const existingScript = document.querySelector(`script[src*="project-board.js"]`);
                if (existingScript) {
                    console.log('🗑️ Removing existing project-board.js script');
                    existingScript.remove();
                }

                const newScript = document.createElement('script');
                // Fix the path: ../project-board.js should resolve to /project-board.js from root
                const correctedPath = '/project-board.js';
                newScript.src = correctedPath + '?v=' + Date.now();
                newScript.onload = () => {
                    console.log('✅ Project board script loaded:', typeof window.initProjectBoard);
                };
                newScript.onerror = () => {
                    console.error('❌ Failed to load project board script from:', correctedPath);
                    console.log('🔄 Trying alternative path /pages/project-board.js...');

                    // Fallback to alternative path
                    const fallbackScript = document.createElement('script');
                    fallbackScript.src = '../project-board.js?v=' + Date.now();
                    fallbackScript.onload = () => {
                        console.log('✅ Project board script loaded via fallback:', typeof window.initProjectBoard);
                    };
                    fallbackScript.onerror = () => {
                        console.error('❌ Failed to load project board script via fallback path');
                    };
                    document.head.appendChild(fallbackScript);
                };
                document.head.appendChild(newScript);
            } else if (src && !scriptsToSkip.includes(src) && !isAlreadyLoaded) {
                console.log(`✅ Loading script: ${src}`);
                const newScript = document.createElement('script');

                // Fix relative paths for scripts loaded from pages/
                let correctedSrc = src;
                if (src.startsWith('../') && !src.includes('http')) {
                    correctedSrc = '/' + src.substring(3); // Remove '../' and add '/'
                }

                newScript.src = correctedSrc;
                newScript.onload = () => console.log('Script loaded:', correctedSrc);
                newScript.onerror = () => console.error('Failed to load script:', correctedSrc);
                document.head.appendChild(newScript);
            } else {
                console.log(`⚠️ Skipping script: ${src}`);
            }
        });

        const inlineScripts = doc.querySelectorAll('script:not([src])');
        inlineScripts.forEach(script => {
            if (script.textContent.trim()) {
                try { eval(script.textContent); } 
                catch (error) { console.warn('Error executing inline script:', error); }
            }
        });
    }

    showError(message) {
        this.container.innerHTML = `
            <div class="error-page">
                <div class="error-content">
                    <h1>Error</h1>
                    <p>${message}</p>
                    <button onclick="firaRouter.navigateTo('/')" class="btn-primary">
                        Go to Dashboard
                    </button>
                </div>
            </div>
        `;
    }

    handle404(path) {
        this.container.innerHTML = `
            <div class="error-page">
                <div class="error-content">
                    <h1>404 - Page Not Found</h1>
                    <p>The path "${path}" was not found.</p>
                    <button onclick="firaRouter.navigateTo('/')" class="btn-primary">
                        Go to Dashboard
                    </button>
                </div>
            </div>
        `;
    }

    getCurrentParams() {
        if (this.currentRoute) {
            const route = this.matchRoute(window.location.pathname);
            return route ? route.params : {};
        }
        return {};
    }

    requiresAuthentication(path) {
        // Check if this is a local version (no authentication required)
        const isLocalVersion = !window.location.hostname.includes("onix-systems-android-tasks");
        if (isLocalVersion) {
            return false; // No authentication required for local version
        }
        
        // All routes except root require authentication for web version
        const publicRoutes = ['/', '/login'];
        return !publicRoutes.includes(path);
    }

    isUserLoggedIn() {
        // Local version always considered "logged in"
        const isLocalVersion = !window.location.hostname.includes("onix-systems-android-tasks");
        if (isLocalVersion) {
            return true;
        }
        
        const loginData = localStorage.getItem('fira_login');
        if (loginData) {
            try {
                const data = JSON.parse(loginData);
                const loginTime = new Date(data.loginTime);
                const now = new Date();
                const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
                return hoursDiff < 24;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    async showLoginScreen() {
        console.log('🔐 Showing login screen');
        try {
            const response = await fetch('/login-screen.html');
            if (response.ok) {
                const html = await response.text();
                this.container.innerHTML = html;
                
                // Setup login form
                this.setupLoginForm();
            } else {
                throw new Error('Failed to load login screen');
            }
        } catch (error) {
            console.error('Error loading login screen:', error);
            // Fallback to simple login form
            this.container.innerHTML = `
                <div class="loading-screen">
                    <div class="loading-content">
                        <h1>Fira Login</h1>
                        <form id="loginForm" style="max-width: 300px; margin: 20px auto; text-align: left;">
                            <div style="margin-bottom: 15px;">
                                <label style="display: block; color: white; margin-bottom: 5px;">Username</label>
                                <input type="text" id="username" name="username" required 
                                       style="width: 100%; padding: 10px; border-radius: 5px; border: none;">
                            </div>
                            <div style="margin-bottom: 20px;">
                                <label style="display: block; color: white; margin-bottom: 5px;">Password</label>
                                <input type="password" id="password" name="password" required 
                                       style="width: 100%; padding: 10px; border-radius: 5px; border: none;">
                            </div>
                            <button type="submit" class="btn-primary" style="width: 100%;">Login</button>
                        </form>
                        <div id="loginError" style="color: #ff6b6b; margin-top: 10px; display: none;"></div>
                    </div>
                </div>
            `;
            this.setupLoginForm();
        }
    }

    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        const loginError = document.getElementById('loginError');
        
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                
                try {
                    console.log('🔐 Attempting login for user:', username);
                    const response = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Store login data
                        localStorage.setItem('fira_login', JSON.stringify({
                            username: data.username,
                            role: data.role,
                            method: data.method,
                            loginTime: new Date().toISOString()
                        }));
                        
                        console.log('✅ Login successful');
                        
                        // Check if there's a redirect path
                        const redirectPath = localStorage.getItem('fira_redirect_after_login');
                        if (redirectPath) {
                            localStorage.removeItem('fira_redirect_after_login');
                            console.log('🔄 Redirecting to original destination:', redirectPath);
                            this.navigateTo(redirectPath, true);
                        } else {
                            this.navigateTo('/', true);
                        }
                    } else {
                        throw new Error(data.error || 'Login failed');
                    }
                } catch (error) {
                    console.error('❌ Login error:', error);
                    if (loginError) {
                        loginError.textContent = error.message;
                        loginError.style.display = 'block';
                    }
                }
            });
        }
    }

    start() {
        console.log('Router starting...');
        let initialPath = window.location.pathname;
        if (window.location.protocol === 'file:' || initialPath.includes('.html')) {
            initialPath = '/';
        }

        // Preserve the current URL after page refresh
        console.log(`🔄 Initializing router with path: ${initialPath}`);

        // Initialize history state if it doesn't exist
        if (!window.history.state || !window.history.state.path) {
            console.log('🔧 Initializing history state');
            window.history.replaceState({ path: initialPath }, '', initialPath);
        }

        this.navigateTo(initialPath, false);
    }
}

// Global router instance
let firaRouter;

// Route handlers
const RouteHandlers = {
    dashboard: async () => {
        console.log('Loading dashboard...');
        if (window.location.protocol === 'file:') {
            window.location.href = 'pages/dashboard.html';
            return;
        }
        
        // OPTIMIZATION: Check if we're already on dashboard page to prevent unnecessary reload
        const isDashboardAlreadyLoaded = document.getElementById('searchInput') && 
                                       document.getElementById('projectsGrid') &&
                                       window.globalDataManager && 
                                       window.globalDataManager.isDataLoaded();
        
        if (isDashboardAlreadyLoaded) {
            console.log('✅ Dashboard already loaded, skipping loadPage to prevent flash');
            // Just refresh the projects if needed
            if (typeof window.refreshProjects === 'function') {
                window.refreshProjects();
            }
            return;
        }
        
        console.log('🔄 Loading dashboard page for first time');
        const success = await firaRouter.loadPage('/pages/dashboard.html');
        if (!success) return;

        const initTimeout = setTimeout(async () => {
            try {
                if (firaRouter.currentRoute !== '/' && firaRouter.currentRoute !== '/dashboard') return;

                await new Promise(r => setTimeout(r, 100));
                const requiredElements = ['searchInput', 'nameFilter', 'newProjectBtn', 'projectsGrid'];
                const missing = requiredElements.filter(id => !document.getElementById(id));
                if (missing.length > 0) return firaRouter.showError(`Missing dashboard elements: ${missing.join(', ')}`);

                if (window.globalDataManager && !window.globalDataManager.isDataLoaded()) {
                    await window.globalDataManager.initialize();
                }

                if (typeof window.initializeDashboard === 'function') {
                    await window.initializeDashboard();
                } else if (typeof init === 'function') {
                    await init();
                } else {
                    if (typeof setupEventListeners === 'function') setupEventListeners();
                    if (typeof loadProjects === 'function') await loadProjects();
                }
            } catch (error) {
                firaRouter.showError('Failed to initialize dashboard: ' + error.message);
            }
        }, 100);

        if (!firaRouter.activeTimeouts) firaRouter.activeTimeouts = [];
        firaRouter.activeTimeouts.push(initTimeout);
    },

    projectBoard: async ({ projectname }) => {
        console.log(`🔗 Loading project: "${projectname}"`);

        if (window.location.protocol === 'file:') {
            window.location.href = `pages/project-board.html?project=${encodeURIComponent(projectname)}`;
            return;
        }

        const success = await firaRouter.loadPage('/pages/project-board.html');
        if (!success) {
            console.log('❌ Failed to load project board page - redirecting to dashboard');
            firaRouter.navigateTo('/');
            return;
        }

        // Add a safety timeout to ensure loading screen is hidden even if initialization fails
        const safetyTimeout = setTimeout(() => {
            console.log('⚠️ Safety timeout triggered - redirecting to dashboard to avoid stuck loading');
            // Remove any loading screens that might still be showing (except our main loading screen)
            const loadingScreens = document.querySelectorAll('.loading-screen');
            loadingScreens.forEach(screen => {
                // Don't hide our main loading screen managed by LoadingManager
                if (screen.id === 'fira-loading-screen') {
                    return;
                }

                if (screen.style.display !== 'none') {
                    console.log('🧹 Hiding lingering loading screen');
                    screen.style.display = 'none';
                }
            });
            // REFRESH FIX: Redirect to dashboard if still stuck
            if (firaRouter.currentRoute && firaRouter.currentRoute.includes('/project/')) {
                console.log('🔄 Still on project route after timeout - redirecting to dashboard');
                firaRouter.navigateTo('/');
            }
        }, 5000); // 5 second safety timeout

        const initTimeout = setTimeout(async () => {
            try {
                if (!firaRouter.currentRoute || !firaRouter.currentRoute.includes('/project/')) return;

                console.log('🔗 Project initialization sequence starting...');

                // Step 1: Wait for DOM to be ready
                await new Promise(r => setTimeout(r, 100));

                // Step 2: Initialize global data manager (loads projects list)
                console.log('🔗 Step 1: Loading projects list via GlobalDataManager...');
                if (window.globalDataManager && !window.globalDataManager.isDataLoaded()) {
                    console.log('🔄 Initializing global data manager for project page...');

                    // Create a race condition between initialization and timeout
                    const initPromise = window.globalDataManager.initialize();
                    const timeoutPromise = new Promise((resolve) => setTimeout(() => {
                        console.log('⚠️ Global data manager initialization timeout - proceeding anyway');
                        resolve('timeout');
                    }, 3000));

                    await Promise.race([initPromise, timeoutPromise]);
                    console.log('✅ Projects list loaded successfully');
                } else {
                    console.log('✅ Projects list already available');
                }

                // Step 3: Initialize project board for the specific project
                console.log('🔗 Step 2: Initializing project board for:', projectname);
                console.log('🔍 Checking for initProjectBoard function...');
                console.log('  initProjectBoard type:', typeof initProjectBoard);
                console.log('  window.initProjectBoard type:', typeof window.initProjectBoard);

                if (typeof initProjectBoard === 'function') {
                    console.log('✅ Using global initProjectBoard');
                    await initProjectBoard(projectname);
                    console.log('✅ Project board initialized successfully');
                } else if (typeof window.initProjectBoard === 'function') {
                    console.log('✅ Using window.initProjectBoard');
                    await window.initProjectBoard(projectname);
                    console.log('✅ Project board initialized successfully');
                } else {
                    console.log('⚠️ initProjectBoard not available, using fallback sequence');
                    // Try multiple times with increasing delays
                    let attempts = 0;
                    const maxAttempts = 20;

                    const tryInitProjectBoard = async () => {
                        attempts++;
                        console.log(`🔄 Fallback attempt ${attempts}/${maxAttempts}: checking for initProjectBoard...`);

                        if (typeof window.initProjectBoard === 'function') {
                            console.log('✅ initProjectBoard now available, initializing...');
                            await window.initProjectBoard(projectname);
                            console.log('✅ Fallback initialization complete');
                        } else if (attempts < maxAttempts) {
                            setTimeout(tryInitProjectBoard, 200);
                        } else {
                            console.error('❌ initProjectBoard still not available after all attempts');
                            firaRouter.showError(`Failed to load project "${projectname}". Project board initialization function not found.`);
                        }
                    };

                    setTimeout(tryInitProjectBoard, 300);
                }

                console.log('🔗 Project initialization sequence completed');

                // Clear safety timeout since initialization completed normally
                clearTimeout(safetyTimeout);
            } catch (error) {
                // Clear safety timeout even on error
                clearTimeout(safetyTimeout);
                console.error('❌ Project initialization failed:', error);
                firaRouter.showError(`Failed to load project "${projectname}": ${error.message}`);
            }
        }, 100);

        if (!firaRouter.activeTimeouts) firaRouter.activeTimeouts = [];
        firaRouter.activeTimeouts.push(initTimeout);
        firaRouter.activeTimeouts.push(safetyTimeout);
    },

    projectWithTask: async ({ projectname, taskId, taskname }) => {
        // Support both taskId and taskname parameters
        const taskParam = taskId || taskname;
        console.log(`🔗 Deep link: Loading project "${projectname}" with task "${taskParam}"`);

        if (window.location.protocol === 'file:') {
            window.location.href = `pages/project-board.html?project=${encodeURIComponent(projectname)}&task=${encodeURIComponent(taskParam)}`;
            return;
        }

        // CRITICAL FIX: Check if project board is already loaded for the same project
        const existingBoard = window.projectBoard;
        const isSameProject = existingBoard &&
            existingBoard.currentProject &&
            existingBoard.currentProject.id === projectname &&
            existingBoard.tasksLoaded;

        if (isSameProject) {
            console.log('✅ Project board already loaded, skipping loadPage to prevent flash');
            // Just open the task without loading the page
            if (typeof window.openTaskById === 'function') {
                window.openTaskById(taskParam);
            } else {
                setTimeout(() => {
                    if (typeof window.openTaskById === 'function') window.openTaskById(taskParam);
                }, 100);
            }
            return;
        }

        // Only load page if it's a different project or first time
        console.log('🔄 Loading project board page for new project:', projectname);
        const success = await firaRouter.loadPage('/pages/project-board.html');
        if (!success) {
            console.log('❌ Failed to load project board page - redirecting to dashboard');
            firaRouter.navigateTo('/');
            return;
        }

        const initTimeout = setTimeout(async () => {
            try {
                if (!firaRouter.currentRoute || !firaRouter.currentRoute.includes('/project/')) return;

                console.log('🔗 Deep link initialization sequence starting...');

                // Step 1: Wait for DOM to be ready
                await new Promise(r => setTimeout(r, 100));

                // Step 2: Initialize global data manager (loads projects list)
                console.log('🔗 Step 1: Loading projects list via GlobalDataManager...');
                if (window.globalDataManager && !window.globalDataManager.isDataLoaded()) {
                    await window.globalDataManager.initialize();
                    console.log('✅ Projects list loaded successfully');
                } else {
                    console.log('✅ Projects list already available');
                }

                // Step 3: Check if project board already exists and is for the same project
                const existingBoard = window.projectBoard;
                const isSameProject = existingBoard &&
                    existingBoard.currentProject &&
                    existingBoard.currentProject.id === projectname &&
                    existingBoard.tasksLoaded;

                if (isSameProject) {
                    console.log('✅ Project board already loaded for same project, just opening task:', taskParam);
                    // Just open the task without reinitializing the board
                    if (typeof window.openTaskById === 'function') {
                        window.openTaskById(taskParam);
                    } else {
                        setTimeout(() => {
                            if (typeof window.openTaskById === 'function') window.openTaskById(taskParam);
                        }, 100);
                    }
                    return; // CRITICAL: Exit early to prevent any board reinitialization
                } else {
                    // Step 4: Add project board URL to history before initializing with task
                    const projectUrl = `/project/${encodeURIComponent(projectname)}`;
                    const taskUrl = `/project/${encodeURIComponent(projectname)}/task/${encodeURIComponent(taskParam)}`;

                    // Replace current history entry with project board URL
                    console.log('🔗 Adding project board to history before opening task');
                    window.history.replaceState({ path: projectUrl }, '', projectUrl);
                    // Then add task URL as new entry
                    window.history.pushState({ path: taskUrl }, '', taskUrl);
                    firaRouter.currentRoute = taskUrl;

                    // Step 5: Initialize project board for the specific project
                    console.log('🔗 Step 2: Initializing project board for:', projectname);

                    if (typeof initProjectBoard === 'function') {
                        console.log('✅ Using global initProjectBoard with task:', taskParam);
                        await initProjectBoard(projectname, taskParam);
                        console.log('✅ Project board initialized and task opened via initProjectBoard');
                    } else if (typeof window.initProjectBoard === 'function') {
                        console.log('✅ Using window.initProjectBoard with task:', taskParam);
                        await window.initProjectBoard(projectname, taskParam);
                        console.log('✅ Project board initialized and task opened via window.initProjectBoard');
                    } else {
                        console.log('⚠️ initProjectBoard not available, using fallback sequence');
                        // Fallback: Initialize project board first, then open task
                        let attempts = 0;
                        const maxAttempts = 20;

                        const initProjectBoardFallback = async () => {
                            attempts++;
                            console.log(`🔄 Fallback attempt ${attempts}/${maxAttempts}: checking for initProjectBoard...`);

                            if (typeof window.initProjectBoard === 'function') {
                                console.log('✅ initProjectBoard now available, initializing...');
                                await window.initProjectBoard(projectname, taskParam);
                                console.log('✅ Fallback initialization complete');
                            } else if (attempts < maxAttempts) {
                                setTimeout(initProjectBoardFallback, 200);
                            } else {
                                console.error('❌ initProjectBoard still not available after all attempts');
                                firaRouter.showError(`Failed to load project "${projectname}". Project board initialization function not found.`);
                            }
                        };

                        setTimeout(initProjectBoardFallback, 300);
                    }
                }

                console.log('🔗 Deep link initialization sequence completed');
            } catch (error) {
                console.error('❌ Deep link initialization failed:', error);
                firaRouter.showError(`Failed to load project "${projectname}" with task "${taskParam}": ${error.message}`);
            }
        }, 100);

        if (!firaRouter.activeTimeouts) firaRouter.activeTimeouts = [];
        firaRouter.activeTimeouts.push(initTimeout);
    },

    analytics: async () => {
        console.log('🎯 Loading analytics...');
        console.log('🎯 Current URL:', window.location.href);
        console.log('🎯 Protocol:', window.location.protocol);
        
        if (window.location.protocol === 'file:') {
            console.log('🎯 File protocol - redirecting to pages/analytics.html');
            window.location.href = 'pages/analytics.html';
            return;
        }
        
        console.log('🎯 Server protocol - loading page via router');
        const success = await firaRouter.loadPage('/pages/analytics.html');
        console.log('🎯 Page load success:', success);
        
        if (!success) {
            console.error('🎯 Failed to load analytics page');
            return;
        }

        const initTimeout = setTimeout(async () => {
            try {
                if (firaRouter.currentRoute !== '/analytics') return;

                await new Promise(r => setTimeout(r, 100));

                // Initialize global data if needed
                if (window.globalDataManager && !window.globalDataManager.isDataLoaded()) {
                    await window.globalDataManager.initialize();
                }

                // Initialize analytics if function exists
                console.log('🎯 Checking for analytics initialization function');
                console.log('🎯 window.initializeAnalytics type:', typeof window.initializeAnalytics);
                console.log('🎯 initializeAnalytics type:', typeof initializeAnalytics);
                
                if (typeof window.initializeAnalytics === 'function') {
                    console.log('🎯 Calling window.initializeAnalytics()');
                    await window.initializeAnalytics();
                    console.log('🎯 window.initializeAnalytics() completed');
                } else if (typeof initializeAnalytics === 'function') {
                    console.log('🎯 Calling initializeAnalytics()');
                    await initializeAnalytics();
                    console.log('🎯 initializeAnalytics() completed');
                } else {
                    console.log('⚠️ Analytics initialization function not found');
                    console.log('🎯 Available window functions:', Object.keys(window).filter(k => k.includes('analytic')));
                }
            } catch (error) {
                firaRouter.showError('Failed to initialize analytics: ' + error.message);
            }
        }, 100);

        if (!firaRouter.activeTimeouts) firaRouter.activeTimeouts = [];
        firaRouter.activeTimeouts.push(initTimeout);
    }
};

// Navigation functions already defined at the top of the file

// Router initialization function
function initializeFiraRouter() {
    console.log('🔄 Initializing router...');
    firaRouter = new FiraRouter();

    // Register routes in order of specificity (most specific first)
    firaRouter.addRoute('/project/:projectname/task/:taskId', RouteHandlers.projectWithTask);
    firaRouter.addRoute('/project/:projectname/:taskname', RouteHandlers.projectWithTask);
    firaRouter.addRoute('/project/:projectname', RouteHandlers.projectBoard);
    firaRouter.addRoute('/dashboard', RouteHandlers.dashboard);
    firaRouter.addRoute('/analytics', RouteHandlers.analytics);
    firaRouter.addRoute('/', RouteHandlers.dashboard);

    firaRouter.start();
    console.log('✅ Router initialized with deep link support');
    console.log('  - /project/:projectname/:taskname → Load project and open specific task');
    console.log('  - /project/:projectname/task/:taskId → Alternative task URL format');
    console.log('  - /project/:projectname → Load project without specific task');

    // Make sure router is globally available
    window.firaRouter = firaRouter;
}

// Initialize router when DOM is ready
document.addEventListener('DOMContentLoaded', initializeFiraRouter);

// Also initialize immediately if DOM is already loaded
if (document.readyState !== 'loading') {
    console.log('🔄 DOM already loaded, initializing router immediately...');
    initializeFiraRouter();
}
