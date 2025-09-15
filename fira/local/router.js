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
            window.history.pushState({}, '', path);
        }

        this.currentRoute = path;
        await this.handleRoute(path);
    }

    async handleRoute(path) {
        console.log('Handling route:', path);
        this.clearActiveTimeouts();

        const route = this.matchRoute(path);

        if (route) {
            console.log('Route found:', route.path, 'params:', route.params);
            try {
                await route.handler(route.params);
            } catch (error) {
                console.error('Route handler error:', error);
                this.showError('Failed to load page');
            }
        } else {
            console.log('No route found for:', path);
            this.handle404(path);
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

    handlePopState() {
        this.navigateTo(window.location.pathname, false);
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
            if (isProjectBoard && (!isAlreadyLoaded || typeof window.initProjectBoard === 'undefined')) {
                console.log(`🔄 Force loading project-board.js (function check: ${typeof window.initProjectBoard})`);
                // Remove existing script if it exists but function is missing
                const existingScript = document.querySelector(`script[src="${src}"]`);
                if (existingScript && typeof window.initProjectBoard === 'undefined') {
                    existingScript.remove();
                }
                
                const newScript = document.createElement('script');
                newScript.src = src;
                newScript.onload = () => {
                    console.log('✅ Project board script loaded:', typeof window.initProjectBoard);
                };
                newScript.onerror = () => console.error('❌ Failed to load project board script:', src);
                document.head.appendChild(newScript);
            } else if (src && !scriptsToSkip.includes(src) && !isAlreadyLoaded) {
                console.log(`✅ Loading script: ${src}`);
                const newScript = document.createElement('script');
                newScript.src = src;
                newScript.onload = () => console.log('Script loaded:', src);
                newScript.onerror = () => console.error('Failed to load script:', src);
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

    start() {
        console.log('Router starting...');
        let initialPath = window.location.pathname;
        if (window.location.protocol === 'file:' || initialPath.includes('.html')) {
            initialPath = '/';
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
        if (window.location.protocol === 'file:') {
            window.location.href = `pages/project-board.html?project=${encodeURIComponent(projectname)}`;
            return;
        }
        const success = await firaRouter.loadPage('/pages/project-board.html');
        if (!success) return;

        const initTimeout = setTimeout(async () => {
            try {
                if (!firaRouter.currentRoute || !firaRouter.currentRoute.includes('/project/')) return;
                await new Promise(r => setTimeout(r, 100));
                if (window.globalDataManager && !window.globalDataManager.isDataLoaded()) await window.globalDataManager.initialize();

                console.log('🔍 Checking for initProjectBoard function...');
                console.log('  initProjectBoard type:', typeof initProjectBoard);
                console.log('  window.initProjectBoard type:', typeof window.initProjectBoard);
                
                if (typeof initProjectBoard === 'function') {
                    console.log('✅ Using global initProjectBoard');
                    initProjectBoard(projectname);
                } else if (typeof window.initProjectBoard === 'function') {
                    console.log('✅ Using window.initProjectBoard');
                    window.initProjectBoard(projectname);
                } else {
                    console.log('⚠️ initProjectBoard not available, waiting...');
                    // Try multiple times with increasing delays
                    let attempts = 0;
                    const maxAttempts = 10;
                    const tryInitProjectBoard = () => {
                        attempts++;
                        console.log(`🔄 Retry ${attempts}/${maxAttempts}: window.initProjectBoard type:`, typeof window.initProjectBoard);
                        if (typeof window.initProjectBoard === 'function') {
                            console.log('✅ Using delayed window.initProjectBoard');
                            window.initProjectBoard(projectname);
                        } else if (attempts < maxAttempts) {
                            setTimeout(tryInitProjectBoard, 200 * attempts); // Increasing delay
                        } else {
                            console.error('❌ initProjectBoard still not available after all attempts');
                        }
                    };
                    setTimeout(tryInitProjectBoard, 300);
                }
            } catch (error) {
                firaRouter.showError('Failed to initialize project board: ' + error.message);
            }
        }, 100);

        if (!firaRouter.activeTimeouts) firaRouter.activeTimeouts = [];
        firaRouter.activeTimeouts.push(initTimeout);
    },

    projectWithTask: async ({ projectname, taskId }) => {
        if (window.location.protocol === 'file:') {
            window.location.href = `pages/project-board.html?project=${encodeURIComponent(projectname)}&task=${encodeURIComponent(taskId)}`;
            return;
        }
        const success = await firaRouter.loadPage('/pages/project-board.html');
        if (!success) return;

        const initTimeout = setTimeout(async () => {
            try {
                if (!firaRouter.currentRoute || !firaRouter.currentRoute.includes('/project/')) return;
                await new Promise(r => setTimeout(r, 100));
                if (window.globalDataManager && !window.globalDataManager.isDataLoaded()) await window.globalDataManager.initialize();

                if (typeof openTaskById === 'function') {
                    openTaskById(taskId);
                } else if (typeof window.openTaskById === 'function') {
                    window.openTaskById(taskId);
                } else {
                    setTimeout(() => {
                        if (typeof window.openTaskById === 'function') window.openTaskById(taskId);
                    }, 500);
                }
            } catch (error) {
                firaRouter.showError('Failed to initialize task: ' + error.message);
            }
        }, 100);

        if (!firaRouter.activeTimeouts) firaRouter.activeTimeouts = [];
        firaRouter.activeTimeouts.push(initTimeout);
    }
};

// Navigation functions already defined at the top of the file

// Initialize router and define routes
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔄 Initializing router...');
    firaRouter = new FiraRouter();

    firaRouter.addRoute('/', RouteHandlers.dashboard);
    firaRouter.addRoute('/dashboard', RouteHandlers.dashboard);
    firaRouter.addRoute('/project/:projectname', RouteHandlers.projectBoard);
    firaRouter.addRoute('/project/:projectname/task/:taskId', RouteHandlers.projectWithTask);

    firaRouter.start();
    console.log('✅ Router initialized and started');
    
    // Make sure router is globally available
    window.firaRouter = firaRouter;
});

// Also initialize immediately if DOM is already loaded
if (document.readyState !== 'loading') {
    console.log('🔄 DOM already loaded, initializing router immediately...');
    firaRouter = new FiraRouter();

    firaRouter.addRoute('/', RouteHandlers.dashboard);
    firaRouter.addRoute('/dashboard', RouteHandlers.dashboard);
    firaRouter.addRoute('/project/:projectname', RouteHandlers.projectBoard);
    firaRouter.addRoute('/project/:projectname/task/:taskId', RouteHandlers.projectWithTask);

    firaRouter.start();
    console.log('✅ Router initialized and started (immediate)');
    
    // Make sure router is globally available
    window.firaRouter = firaRouter;
}
