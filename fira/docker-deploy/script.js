// Project data loaded from different sources
let projectsData = [];
let filteredProjects = [];
let fileSystemLoader = null;

// Loading modes
const LOADING_MODES = {
    FILE_SYSTEM: 'file_system', 
    STATIC_DATA: 'static_data'
};

document.addEventListener("DOMContentLoaded", () => {
  const isWeb = window.location.hostname.includes("onix-systems-android-tasks");

  if (isWeb) {
    console.error('CONSOLE LOG');
    
    // Get user role from localStorage
    let userRole = 'viewer'; // default
    try {
      const loginData = localStorage.getItem('fira_login');
      if (loginData) {
        const userData = JSON.parse(loginData);
        userRole = userData.role || 'viewer';
      }
    } catch (e) {
      console.warn('Could not parse login data:', e);
    }
    
    console.log('User role:', userRole);
    
    // Hide elements based on role
    let hiddenElements = [
      '.project-actions',
      '.btn-save'
    ];
    
    // Hide create/edit buttons, mode switchers, image zones and comments for viewers only
    if (userRole === 'viewer') {
      hiddenElements.push('.new-project-btn', '.create-task-btn', '.save-project-btn', '.mode-btn', '.image-drop-zone', '.add-comment-section', '.add-developer-btn');
    }
    
    const style = document.createElement("style");
    style.textContent = `
      ${hiddenElements.join(',\n      ')} {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  } else {
    // Local version - set default role to editor for full access
    console.log('🔓 Local version - full access with editor role');
    
    // Set editor role in localStorage for consistency
    const editorLoginData = {
      role: 'editor',
      username: 'local-user',
      email: 'local@localhost'
    };
    localStorage.setItem('fira_login', JSON.stringify(editorLoginData));
  }
});

// DOM elements (will be set up when page loads)
let searchInput, nameFilter, newProjectBtn, projectsGrid, newProjectModal;

// Load projects using global data manager
async function loadProjects() {
    try {
        showLoading();
        
        // Wait for global data to be loaded if it's not ready yet
        if (!window.globalDataManager) {
            console.warn('globalDataManager not initialized yet, waiting...');
            // Wait a bit for global-data.js to load
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (window.globalDataManager && !window.globalDataManager.isDataLoaded()) {
            await window.globalDataManager.initialize();
        }
        
        // Get projects from global data manager
        if (window.globalDataManager) {
            projectsData = window.globalDataManager.getProjects();
            filteredProjects = [...projectsData];
        } else {
            console.error('globalDataManager still not available after wait');
            projectsData = [];
            filteredProjects = [];
        }
        
        // Mark that directory is selected and data is ready (for navigation)
        if (window.globalDataManager && window.globalDataManager.directoryHandle) {
            sessionStorage.setItem('fira-directory-selected', 'true');
            sessionStorage.setItem('fira-directory-name', window.globalDataManager.directoryHandle.name || 'unknown');
        }
        
        hideLoading();
        renderProjects();
        
        if (projectsData.length === 0) {
            showMessage('No projects found.', 'info');
        }
        
        // Update status indicator
        updateServerStatus();
        
    } catch (error) {
        hideLoading();
        console.error('Failed to load projects:', error);
        showMessage(error.message || 'Failed to load projects', 'error');
        renderProjects();
    }
}

// Update server status indicator
function updateServerStatus() {
    const serverStatus = document.querySelector('.server-status');
    const statusText = document.querySelector('.status-text');
    const statusIndicator = document.querySelector('.status-indicator');
    
    if (!statusText || !statusIndicator || !serverStatus) return;
    
    if (!window.globalDataManager) {
        console.warn('globalDataManager not available for status update');
        return;
    }
    
    const loadingMode = window.globalDataManager.getLoadingMode();
    
    // Remove existing mode classes
    serverStatus.classList.remove('server-mode', 'static-mode', 'cache-mode', 'filesystem-mode', 'generated-mode', 'auto-scanner-mode', 'directory-picker-mode');
    
    if (loadingMode === 'server') {
        statusText.textContent = '🟢 Server Mode';
        statusIndicator.style.background = '#10b981';
        statusIndicator.style.boxShadow = '0 0 4px rgba(16, 185, 129, 0.5)';
        serverStatus.classList.add('server-mode');
        serverStatus.style.display = 'flex';
        showMessage('Connected to Fira server - Full functionality available', 'success');
    } else if (loadingMode === 'cache') {
        statusText.textContent = '🟡 Cache Mode';
        statusIndicator.style.background = '#f59e0b';
        statusIndicator.style.boxShadow = '0 0 4px rgba(245, 158, 11, 0.5)';
        serverStatus.classList.add('cache-mode');
        serverStatus.style.display = 'flex';
        
        // Add cache timestamp if available
        const cacheTimestamp = window.globalDataManager.cacheTimestamp;
        if (cacheTimestamp) {
            const timeStr = new Date(cacheTimestamp).toLocaleString();
            statusText.title = `Cache generated: ${timeStr}`;
        }
        
        showMessage('Using cached project data - Start server to refresh', 'info');
    } else if (loadingMode === 'auto-scanner') {
        statusText.textContent = '🔍 Auto Scanner Mode';
        statusIndicator.style.background = '#059669';
        statusIndicator.style.boxShadow = '0 0 4px rgba(5, 150, 105, 0.5)';
        serverStatus.classList.add('auto-scanner-mode');
        serverStatus.style.display = 'flex';
        showMessage('Projects automatically scanned from file system', 'success');
    } else if (loadingMode === 'directory-picker' || loadingMode === 'directory-restored') {
        statusText.textContent = loadingMode === 'directory-restored' ? '🔄 Directory Restored' : '📂 Directory Picker Mode';
        statusIndicator.style.background = '#10b981';
        statusIndicator.style.boxShadow = '0 0 4px rgba(16, 185, 129, 0.5)';
        serverStatus.classList.add('directory-picker-mode');
        serverStatus.style.display = 'flex';
        const message = loadingMode === 'directory-restored' ? 'Projects restored from previous directory selection' : 'Projects loaded from selected directory';
        showMessage(message, 'success');
    } else if (loadingMode === 'real-filesystem') {
        statusText.textContent = '📁 Real File System Mode';
        statusIndicator.style.background = '#10b981';
        statusIndicator.style.boxShadow = '0 0 4px rgba(16, 185, 129, 0.5)';
        serverStatus.classList.add('filesystem-mode');
        serverStatus.style.display = 'flex';
        showMessage('Loading projects from real file system', 'success');
    } else if (loadingMode === 'jquery-filesystem') {
        statusText.textContent = '🔵 File System Mode';
        statusIndicator.style.background = '#3b82f6';
        statusIndicator.style.boxShadow = '0 0 4px rgba(59, 130, 246, 0.5)';
        serverStatus.classList.add('filesystem-mode');
        serverStatus.style.display = 'flex';
        showMessage('Loading projects from file system via jQuery', 'info');
    } else {
        // Show status for generated data mode
        statusText.textContent = '📊 Generated Data Mode';
        statusIndicator.style.background = '#6b7280';
        statusIndicator.style.boxShadow = '0 0 4px rgba(107, 114, 128, 0.5)';
        serverStatus.classList.add('generated-mode');
        serverStatus.style.display = 'flex';
        showMessage('Using auto-generated data from real file system', 'info');
    }
}


// Show loading indicator
function showLoading() {
    if (!projectsGrid) {
        projectsGrid = document.getElementById('projectsGrid');
    }
    
    if (projectsGrid) {
        projectsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #6b7280; padding: 40px;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
                    <div style="width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top: 3px solid #8b5cf6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p>Loading projects...</p>
                </div>
            </div>
        `;
    }
}

// Hide loading indicator
function hideLoading() {
    // Loading will be replaced by renderProjects()
}

// Show message to user
function showMessage(message, type = 'info') {
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
    }, 4000);
}

// Initialize the dashboard
async function init() {
    console.log('Dashboard init() called');
    try {
        setupEventListeners();
        
        // Only proceed if event listeners were set up successfully
        if (!searchInput) {
            console.log('⏸️ Dashboard elements not ready - skipping full initialization');
            return false;
        }
        
        console.log('Event listeners set up');
        await loadProjects();
        console.log('Projects loaded successfully');
        return true;
    } catch (error) {
        console.error('Error in dashboard init:', error);
        throw error;
    }
}

// Dashboard initialization function that can be called when DOM is ready
async function initializeDashboard() {
    console.log('🚀 Initializing dashboard...');
    try {
        const success = await init();
        if (success) {
            console.log('✅ Dashboard initialized successfully');
        } else {
            console.log('⏸️ Dashboard initialization deferred - elements not ready');
        }
    } catch (error) {
        console.error('❌ Dashboard initialization failed:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Get DOM elements
    searchInput = document.getElementById('searchInput');
    nameFilter = document.getElementById('nameFilter');
    newProjectBtn = document.getElementById('newProjectBtn');
    projectsGrid = document.getElementById('projectsGrid');
    newProjectModal = document.getElementById('newProjectModal');
    
    // Only set up listeners if elements exist (for router-based loading)
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    } else {
        console.log('ℹ️ Dashboard elements not found - page may not be loaded yet');
        return; // Exit early if dashboard elements don't exist
    }
    
    if (nameFilter) {
        nameFilter.addEventListener('change', handleNameFilter);
    } else {
        console.warn('nameFilter element not found');
    }
    
    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', openNewProjectModal);
    } else {
        console.warn('newProjectBtn element not found');
    }
    
    // Add refresh functionality to logo click
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('click', async () => {
            // Only refresh if we have a directory handle (not static data)
            if (window.globalDataManager && window.globalDataManager.directoryHandle) {
                await window.refreshProjects();
            }
        });
        logo.style.cursor = 'pointer';
        logo.title = 'Click to refresh projects';
    }

    if (newProjectModal) {
        // Close modal when clicking outside
        newProjectModal.addEventListener('click', (e) => {
            if (e.target === newProjectModal) {
                closeModal();
            }
        });
    } else {
        console.warn('newProjectModal element not found');
    }
    
    // Setup create project form
    setupCreateProjectForm();
}

// Handle search functionality
function handleSearch() {
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        filteredProjects = [...projectsData];
    } else {
        filteredProjects = projectsData.filter(project => 
            project.name.toLowerCase().includes(searchTerm) ||
            project.description.toLowerCase().includes(searchTerm)
        );
    }
    
    renderProjects();
}

// Handle name filter
function handleNameFilter() {
    if (!nameFilter) return;
    
    const filterValue = nameFilter.value;
    
    switch (filterValue) {
        case 'a-z':
            filteredProjects.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'z-a':
            filteredProjects.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'recent':
            // Sort by ID (assuming higher ID means more recent)
            filteredProjects.sort((a, b) => b.id - a.id);
            break;
        default:
            // Reset to original order
            filteredProjects = [...projectsData];
            break;
    }
    
    renderProjects();
}

// Render projects grid
function renderProjects() {
    if (!projectsGrid) {
        console.warn('projectsGrid not found, cannot render projects');
        return;
    }
    
    
    projectsGrid.innerHTML = '';
    
    if (filteredProjects.length === 0) {
        projectsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #6b7280; padding: 40px;">
                <h3>No projects found</h3>
                <p>Try adjusting your search or create a new project.</p>
            </div>
        `;
        return;
    }
    
    filteredProjects.forEach(project => {
        const projectCard = createProjectCard(project);
        projectsGrid.appendChild(projectCard);
    });
}

// Create project card element
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.projectId = project.id;
    
    // Ensure project has stats object with all required properties
    if (!project.stats) {
        project.stats = {
            backlog: { count: 0, hours: '0h' },
            inProgress: { count: 0, developers: '0 dev' },
            done: { count: 0, hours: '0h' }
        };
    }
    
    // Ensure each stat category exists
    if (!project.stats.backlog) project.stats.backlog = { count: 0, hours: '0h' };
    if (!project.stats.inProgress) project.stats.inProgress = { count: 0, developers: '0 dev' };
    if (!project.stats.done) project.stats.done = { count: 0, hours: '0h' };
    
    card.innerHTML = `
        <div class="project-actions">
            <img class="delete-icon" src="./res/icons/delete_icon.png" alt="Delete project" title="Delete project" data-project-id="${project.id}" onerror="console.log('Trying alternative paths...'); this.src='res/icons/delete_icon.png'; this.onerror=function(){this.src='../res/icons/delete_icon.png'; this.onerror=function(){console.log('All paths failed');}}">
        </div>
        
        <div class="project-name">${project.name}</div>
        <div class="project-description">${project.description}</div>
        
        <div class="project-stats">
            <div class="stat-item">
                <div class="stat-label">BACKLOG</div>
                <div class="stat-info">
                    <span class="stat-value">${project.stats.backlog.count || 0}</span>
                    <span class="stat-detail">(${project.stats.backlog.hours || '0h'})</span>
                </div>
            </div>
            <div class="stat-item">
                <div class="stat-label">IN PROGRESS</div>
                <div class="stat-info">
                    <span class="stat-value">${project.stats.inProgress.count || 0}</span>
                    <span class="stat-detail">(${project.stats.inProgress.developers || '0 dev'})</span>
                </div>
            </div>
            <div class="stat-item">
                <div class="stat-label">DONE</div>
                <div class="stat-info">
                    <span class="stat-value">${project.stats.done.count || 0}</span>
                    <span class="stat-detail">(${project.stats.done.hours || '0h'})</span>
                </div>
            </div>
        </div>
    `;
    
    // Add click handler for project card (excluding action buttons)
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.project-actions')) {
            handleProjectClick(project.id);
        }
    });
    
    // Add click handler for delete button
    const deleteIcon = card.querySelector('.delete-icon');
    
    deleteIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteProjectModal(project.id);
    });
    
    return card;
}

// Handle project card click
function handleProjectClick(projectId) {
    console.log('🎯 Project clicked:', projectId);
    console.log('📝 Project ID type:', typeof projectId);
    console.log('📊 Project ID bytes:', Array.from(projectId).map(c => c.charCodeAt(0)));
    console.log('🌐 Current protocol:', window.location.protocol);
    console.log('🔗 Router available:', !!window.firaRouter);
    console.log('📍 NavigateToProject available:', !!window.navigateToProject);
    
    // For file:// protocol, navigate directly to project board page
    if (window.location.protocol === 'file:') {
        console.log('✅ File protocol detected, navigating directly to project board');
        // Check if we're already in the pages/ directory
        const currentPath = window.location.pathname;
        if (currentPath.includes('/pages/')) {
            // We're in pages/ directory, navigate relatively
            window.location.href = `project-board.html?project=${encodeURIComponent(projectId)}`;
        } else {
            // We're in root directory, navigate to pages/
            window.location.href = `pages/project-board.html?project=${encodeURIComponent(projectId)}`;
        }
        return;
    }
    
    // Navigate to project board using router for web server mode
    if (window.navigateToProject) {
        console.log('✅ Using navigateToProject function');
        try {
            window.navigateToProject(projectId);
            console.log('✅ Navigation function called successfully');
        } catch (error) {
            console.error('❌ Navigation error:', error);
            // Fallback to direct navigation
            window.location.href = `/project/${encodeURIComponent(projectId)}`;
        }
    } else {
        console.log('⏳ Waiting for router to be ready...');
        // Wait for router to be ready instead of immediate fallback
        let attempts = 0;
        const waitForRouter = () => {
            attempts++;
            console.log(`🔄 Attempt ${attempts}/20: navigateToProject available = ${!!window.navigateToProject}`);
            
            if (window.navigateToProject) {
                console.log('✅ Router now available, calling navigation');
                try {
                    window.navigateToProject(projectId);
                    console.log('✅ Delayed navigation successful');
                } catch (error) {
                    console.error('❌ Delayed navigation error:', error);
                    window.location.href = `/project/${encodeURIComponent(projectId)}`;
                }
            } else if (attempts < 20) {
                setTimeout(waitForRouter, 100);
            } else {
                // Final fallback only after waiting
                console.warn('⚠️ Router not available after waiting, using direct navigation');
                window.location.href = `/project/${encodeURIComponent(projectId)}`;
            }
        };
        waitForRouter();
    }
}

// Delete project (show confirmation modal) - Legacy function for compatibility
function deleteProject(event, projectId) {
    event.stopPropagation(); // Prevent card click event
    openDeleteProjectModal(projectId);
}

// Open new project modal
function openNewProjectModal() {
    newProjectModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scroll
}

// Close modal
function closeModal() {
    newProjectModal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Restore scroll
}

// Handle escape key to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && newProjectModal.style.display === 'flex') {
        closeModal();
    }
});

// Create Project Form Functionality
function setupCreateProjectForm() {
    const form = document.getElementById('createProjectForm');
    const projectNameInput = document.getElementById('projectName');
    const projectIdInput = document.getElementById('projectId');
    const projectDescriptionTextarea = document.getElementById('projectDescription');
    const descriptionCharCount = document.getElementById('descriptionCharCount');
    
    // Auto-generate project ID from name
    projectNameInput.addEventListener('input', (e) => {
        const name = e.target.value;

        // Validate that only English letters are used
        const hasNonEnglish = /[^a-zA-Z0-9\s\-_]/.test(name);
        const projectNameError = document.getElementById('projectNameError');

        if (hasNonEnglish) {
            showFieldError('projectName', 'Project name can only contain English letters, numbers, spaces, hyphens and underscores');
        } else {
            clearFieldError('projectName');

            // Auto-generate project ID from the current name
            const projectId = generateProjectId(name);
            projectIdInput.value = projectId;
        }
    });

    // Validate Project ID input
    projectIdInput.addEventListener('input', (e) => {
        let value = e.target.value.toUpperCase();
        // Remove invalid characters
        value = value.replace(/[^A-Z0-9]/g, '');
        // Ensure it starts with a letter
        if (value && !/^[A-Z]/.test(value)) {
            value = value.replace(/^[^A-Z]*/, '');
        }
        e.target.value = value;
        validateProjectId();
    });

    projectIdInput.addEventListener('blur', validateProjectId);
    
    // Character counter for description
    projectDescriptionTextarea.addEventListener('input', (e) => {
        const length = e.target.value.length;
        descriptionCharCount.textContent = length;
        
        if (length > 500) {
            descriptionCharCount.parentElement.style.color = '#dc2626';
        } else {
            descriptionCharCount.parentElement.style.color = '#9ca3af';
        }
    });
    
    // Form submission
    form.addEventListener('submit', handleCreateProject);
    
    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (newProjectModal.style.display === 'flex') {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                form.dispatchEvent(new Event('submit'));
            }
        }
    });
}

function generateProjectId(name) {
    if (!name) return '';

    // Remove all non-English characters and keep only letters and spaces
    const cleanName = name.replace(/[^a-zA-Z\s]/g, '').trim();

    if (!cleanName) return '';

    // Split by spaces to get words
    const words = cleanName.split(/\s+/).filter(word => word.length > 0);
    let id = '';

    if (words.length === 0) {
        return '';
    }

    // Always take first 3 letters from the first word
    const firstWord = words[0];
    id = firstWord.substring(0, Math.min(3, firstWord.length)).toUpperCase();

    // If the first word has less than 3 letters, try to add from the second word
    if (id.length < 3 && words.length > 1) {
        const remaining = 3 - id.length;
        id += words[1].substring(0, remaining).toUpperCase();
    }

    // If still less than 3 characters, pad with the original letters repeated or just return what we have
    // This ensures we always try to get 3 letters if possible

    return id;
}

function validateProjectId() {
    const projectIdInput = document.getElementById('projectId');
    const projectIdError = document.getElementById('projectIdError');
    const projectId = projectIdInput.value.trim();
    
    if (!projectId) {
        setError(projectIdError, 'Project ID is required');
        return false;
    }
    
    if (projectId.length < 2) {
        setError(projectIdError, 'Project ID must be at least 2 characters');
        return false;
    }
    
    if (projectId.length > 10) {
        setError(projectIdError, 'Project ID must be 10 characters or less');
        return false;
    }
    
    if (!/^[A-Z][A-Z0-9]*$/.test(projectId)) {
        setError(projectIdError, 'Project ID must start with a letter and contain only uppercase letters and numbers');
        return false;
    }
    
    // Check if Project ID already exists
    const existingProject = projectsData.find(p => p.id === projectId);
    if (existingProject) {
        setError(projectIdError, 'Project ID already exists');
        return false;
    }
    
    // clearError(projectIdError);
    return true;
}

function validateProjectName() {
    const projectNameInput = document.getElementById('projectName');
    const projectNameError = document.getElementById('projectNameError');
    const name = projectNameInput.value.trim();

    // Clear previous validation state
    projectNameInput.classList.remove('error', 'success');
    projectNameError.classList.remove('show');

    if (!name) {
        showFieldError('projectName', 'Project name is required');
        return false;
    }

    // Check for non-English characters
    const hasNonEnglish = /[^a-zA-Z0-9\s\-_]/.test(name);
    if (hasNonEnglish) {
        showFieldError('projectName', 'Project name can only contain English letters, numbers, spaces, hyphens and underscores');
        return false;
    }

    if (name.length < 3) {
        showFieldError('projectName', 'Project name must be at least 3 characters long');
        return false;
    }

    if (name.length > 100) {
        showFieldError('projectName', 'Project name must be less than 100 characters');
        return false;
    }

    // Check for duplicate names
    const isDuplicate = projectsData.some(project =>
        project.name.toLowerCase() === name.toLowerCase()
    );

    if (isDuplicate) {
        showFieldError('projectName', 'A project with this name already exists');
        return false;
    }

    // Check for duplicate IDs
    const projectId = document.getElementById('projectId').value;
    const isDuplicateId = projectsData.some(project => project.id === projectId);

    if (isDuplicateId) {
        showFieldError('projectName', 'Generated project ID already exists. Please choose a different name.');
        return false;
    }

    // Validation passed
    projectNameInput.classList.add('success');
    return true;
}

function showFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId + 'Error');
    
    input.classList.add('error');
    errorElement.textContent = message;
    errorElement.classList.add('show');
}

function clearFieldError(fieldId) {
    const input = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId + 'Error');
    
    input.classList.remove('error');
    errorElement.classList.remove('show');
    errorElement.textContent = '';
}

async function handleCreateProject(e) {
    e.preventDefault();
    
    const createBtn = document.getElementById('createProjectBtn');
    const btnText = createBtn.querySelector('.btn-text');
    const btnLoading = createBtn.querySelector('.btn-loading');
    
    // Validate form
    const isNameValid = validateProjectName();
    const isIdValid = validateProjectId();
    
    if (!isNameValid || !isIdValid) {
        return;
    }
    
    // Get form data
    const formData = new FormData(e.target);
    const projectData = {
        id: formData.get('projectId'),
        name: formData.get('projectName'),
        description: formData.get('projectDescription') || 'No description provided',
        created: new Date().toISOString()
    };
    
    try {
        // Show loading state
        createBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';
        
        // Create project using global data manager (which will choose the right method)
        if (window.globalDataManager) {
            const result = await window.globalDataManager.createProject(projectData);
            if (!result.success) {
                throw new Error(result.error || 'Failed to create project');
            }
            
            // Update local data from global manager
            projectsData = window.globalDataManager.getProjects();
            filteredProjects = [...projectsData];
        } else {
            throw new Error('Global data manager not available');
        }
        
        // Re-render projects
        renderProjects();
        
        // Close modal and reset form
        closeModal();
        resetCreateProjectForm();
        
        // Show success message
        showMessage(`Project "${projectData.name}" created successfully!`, 'success');
        
    } catch (error) {
        console.error('Error creating project:', error);
        showMessage(`Failed to create project. ${error.message}`, 'error');
    } finally {
        // Reset loading state
        createBtn.disabled = false;
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
    }
}


function resetCreateProjectForm() {
    const form = document.getElementById('createProjectForm');
    const projectNameInput = document.getElementById('projectName');
    const projectIdInput = document.getElementById('projectId');
    const projectDescriptionTextarea = document.getElementById('projectDescription');
    const descriptionCharCount = document.getElementById('descriptionCharCount');
    
    // Reset form
    form.reset();
    
    // Clear validation states
    clearFieldError('projectName');
    projectNameInput.classList.remove('error', 'success');
    
    // Reset character counter
    descriptionCharCount.textContent = '0';
    descriptionCharCount.parentElement.style.color = '#9ca3af';
    
    // Clear auto-generated project ID
    projectIdInput.value = '';
}

// Enhanced modal functions
function openNewProjectModal() {
    resetCreateProjectForm();
    newProjectModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Focus on project name input
    setTimeout(() => {
        document.getElementById('projectName').focus();
    }, 100);
}

function closeModal() {
    newProjectModal.style.display = 'none';
    document.body.style.overflow = 'auto';
    resetCreateProjectForm();
}

// Edit Project Modal functionality
let currentEditingProject = null;
let originalProjectData = null;
let hasUnsavedChanges = false;

// Open edit project modal
function openEditProjectModal(projectId) {
    const project = projectsData.find(p => p.id === projectId);
    if (!project) {
        showMessage('Project not found', 'error');
        return;
    }
    
    currentEditingProject = project;
    originalProjectData = {
        name: project.name,
        description: project.description || ''
    };
    
    // Get modal elements
    const modal = document.getElementById('editProjectModal');
    const nameInput = document.getElementById('editProjectName');
    const descriptionTextarea = document.getElementById('editProjectDescription');
    const charCountElement = document.getElementById('editDescriptionCharCount');
    
    // Pre-populate form with project data
    nameInput.value = project.name;
    descriptionTextarea.value = project.description || '';
    charCountElement.textContent = (project.description || '').length;
    
    // Reset form state
    clearEditProjectErrors();
    hasUnsavedChanges = false;
    
    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Focus on name input
    setTimeout(() => {
        nameInput.focus();
    }, 100);
    
    // Setup change tracking
    setupEditProjectChangeTracking();
}

// Close edit project modal
function closeEditProjectModal() {
    if (hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
            return;
        }
    }
    
    const modal = document.getElementById('editProjectModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    
    // Reset state
    currentEditingProject = null;
    originalProjectData = null;
    hasUnsavedChanges = false;
    resetEditProjectForm();
}

// Setup change tracking for form fields
function setupEditProjectChangeTracking() {
    const nameInput = document.getElementById('editProjectName');
    const descriptionTextarea = document.getElementById('editProjectDescription');
    const charCountElement = document.getElementById('editDescriptionCharCount');
    
    // Remove existing listeners to avoid duplicates
    nameInput.removeEventListener('input', handleEditProjectChange);
    descriptionTextarea.removeEventListener('input', handleEditProjectChange);
    descriptionTextarea.removeEventListener('input', handleEditDescriptionChange);
    
    // Add change listeners
    nameInput.addEventListener('input', handleEditProjectChange);
    descriptionTextarea.addEventListener('input', handleEditProjectChange);
    descriptionTextarea.addEventListener('input', handleEditDescriptionChange);
    
    function handleEditDescriptionChange(e) {
        const length = e.target.value.length;
        charCountElement.textContent = length;
        
        if (length > 1000) {
            charCountElement.parentElement.style.color = '#dc2626';
        } else {
            charCountElement.parentElement.style.color = '#9ca3af';
        }
    }
}

// Handle form changes for unsaved changes tracking
function handleEditProjectChange() {
    const nameInput = document.getElementById('editProjectName');
    const descriptionTextarea = document.getElementById('editProjectDescription');
    
    const currentName = nameInput.value.trim();
    const currentDescription = descriptionTextarea.value.trim();
    
    // Check if data has changed from original
    hasUnsavedChanges = (
        currentName !== originalProjectData.name ||
        currentDescription !== originalProjectData.description
    );
}

// Validate edit project form
function validateEditProjectForm() {
    const nameInput = document.getElementById('editProjectName');
    const descriptionTextarea = document.getElementById('editProjectDescription');
    const name = nameInput.value.trim();
    const description = descriptionTextarea.value.trim();
    
    let isValid = true;
    
    // Clear previous validation state
    clearEditProjectErrors();
    
    // Validate name
    if (!name) {
        showEditProjectFieldError('editProjectName', 'Project name is required');
        isValid = false;
    } else if (name.length < 3) {
        showEditProjectFieldError('editProjectName', 'Project name must be at least 3 characters long');
        isValid = false;
    } else if (name.length > 100) {
        showEditProjectFieldError('editProjectName', 'Project name must be less than 100 characters');
        isValid = false;
    } else {
        // Check for duplicate names (excluding current project)
        const isDuplicate = projectsData.some(project => 
            project.id !== currentEditingProject.id &&
            project.name.toLowerCase() === name.toLowerCase()
        );
        
        if (isDuplicate) {
            showEditProjectFieldError('editProjectName', 'A project with this name already exists');
            isValid = false;
        } else {
            nameInput.classList.add('success');
        }
    }
    
    // Validate description length
    if (description.length > 1000) {
        showEditProjectFieldError('editProjectDescription', 'Description must be less than 1000 characters');
        isValid = false;
    }
    
    return isValid;
}

// Show validation error for edit project form
function showEditProjectFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId + 'Error');
    
    input.classList.add('error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }
}

// Clear validation errors for edit project form
function clearEditProjectErrors() {
    const nameInput = document.getElementById('editProjectName');
    const descriptionTextarea = document.getElementById('editProjectDescription');
    const nameError = document.getElementById('editProjectNameError');
    const descriptionError = document.getElementById('editProjectDescriptionError');
    
    nameInput.classList.remove('error', 'success');
    descriptionTextarea.classList.remove('error');
    
    if (nameError) {
        nameError.classList.remove('show');
        nameError.textContent = '';
    }
    
    if (descriptionError) {
        descriptionError.classList.remove('show');
        descriptionError.textContent = '';
    }
}

// Handle edit project form submission
async function handleEditProjectSubmit(e) {
    e.preventDefault();
    
    if (!currentEditingProject) {
        return;
    }
    
    const saveBtn = document.getElementById('saveProjectBtn');
    const btnText = saveBtn.querySelector('.btn-text');
    const btnLoading = saveBtn.querySelector('.btn-loading');
    
    // Validate form
    if (!validateEditProjectForm()) {
        return;
    }
    
    // Get form data
    const nameInput = document.getElementById('editProjectName');
    const descriptionTextarea = document.getElementById('editProjectDescription');
    
    const updatedData = {
        name: nameInput.value.trim(),
        description: descriptionTextarea.value.trim()
    };
    
    try {
        // Show loading state
        saveBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';
        
        // Try to save description to server if available
        let serverSaveSuccess = false;
        if (window.globalDataManager && window.globalDataManager.apiClient && window.globalDataManager.loadingMode === 'server') {
            try {
                console.log('💾 Saving project description to server...');
                await window.globalDataManager.apiClient.updateProjectDescription(
                    currentEditingProject.id, 
                    updatedData.description,
                    'User' // В реальному додатку тут має бути ім'я користувача
                );
                serverSaveSuccess = true;
                console.log('✅ Project description saved to server');
            } catch (error) {
                console.warn('⚠️ Failed to save to server, continuing with local update:', error);
            }
        }
        
        // Update project data locally
        currentEditingProject.name = updatedData.name;
        currentEditingProject.description = updatedData.description;
        
        // Update the project data arrays
        const projectIndex = projectsData.findIndex(p => p.id === currentEditingProject.id);
        if (projectIndex !== -1) {
            projectsData[projectIndex] = { ...currentEditingProject };
        }
        
        const filteredIndex = filteredProjects.findIndex(p => p.id === currentEditingProject.id);
        if (filteredIndex !== -1) {
            filteredProjects[filteredIndex] = { ...currentEditingProject };
        }
        
        // Re-render projects to show updated data
        renderProjects();
        
        // Close modal and reset form
        closeEditProjectModal();
        
        // Show appropriate success message
        const message = serverSaveSuccess ? 
            `Project "${updatedData.name}" updated and saved to file!` : 
            `Project "${updatedData.name}" updated locally!`;
        showMessage(message, 'success');
        
    } catch (error) {
        console.error('Error updating project:', error);
        showMessage('Failed to update project. Please try again.', 'error');
    } finally {
        // Reset loading state
        saveBtn.disabled = false;
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
    }
}

// Reset edit project form
function resetEditProjectForm() {
    const form = document.getElementById('editProjectForm');
    const nameInput = document.getElementById('editProjectName');
    const descriptionTextarea = document.getElementById('editProjectDescription');
    const charCountElement = document.getElementById('editDescriptionCharCount');
    
    // Reset form
    form.reset();
    
    // Clear validation states
    clearEditProjectErrors();
    
    // Reset character counter
    charCountElement.textContent = '0';
    charCountElement.parentElement.style.color = '#9ca3af';
}

// Setup edit project form event listeners
function setupEditProjectForm() {
    const form = document.getElementById('editProjectForm');
    if (form) {
        form.addEventListener('submit', handleEditProjectSubmit);
    }
    
    // Setup keyboard handlers
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('editProjectModal');
        if (modal && modal.style.display === 'flex') {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeEditProjectModal();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                form.dispatchEvent(new Event('submit'));
            }
        }
    });
    
    // Setup backdrop click handler
    const modal = document.getElementById('editProjectModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeEditProjectModal();
            }
        });
    }
}

// Delete Project Confirmation Modal functionality
let currentProjectToDelete = null;

// Open delete confirmation modal
function openDeleteProjectModal(projectId) {
    const project = projectsData.find(p => p.id === projectId);
    if (!project) {
        showMessage('Project not found', 'error');
        return;
    }
    
    currentProjectToDelete = project;
    
    // Get modal elements
    const modal = document.getElementById('deleteProjectModal');
    const projectNameElement = document.getElementById('deleteProjectName');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    // Set project name in modal
    projectNameElement.textContent = project.name;
    
    // Reset button state
    resetDeleteButtonState();
    
    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Store the previously focused element for restoration later
    modal.dataset.previousFocus = document.activeElement?.id || '';
    
    // Focus on cancel button for accessibility (safer option)
    setTimeout(() => {
        const cancelBtn = document.getElementById('cancelDeleteBtn');
        cancelBtn.focus();
        
        // Announce to screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.textContent = `Delete confirmation dialog opened for project ${project.name}. Use Tab to navigate, Escape to cancel.`;
        document.body.appendChild(announcement);
        
        // Remove announcement after screen reader has time to read it
        setTimeout(() => {
            if (announcement.parentNode) {
                announcement.parentNode.removeChild(announcement);
            }
        }, 3000);
    }, 100);
    
    // Setup delete confirmation handler
    setupDeleteConfirmationHandlers();
}

// Close delete confirmation modal
function closeDeleteProjectModal() {
    const modal = document.getElementById('deleteProjectModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    
    // Restore focus to previously focused element
    const previousFocusId = modal.dataset.previousFocus;
    if (previousFocusId) {
        const previousElement = document.getElementById(previousFocusId);
        if (previousElement) {
            previousElement.focus();
        }
        modal.dataset.previousFocus = '';
    }
    
    // Reset state
    currentProjectToDelete = null;
    resetDeleteButtonState();
}

// Reset delete button to default state
function resetDeleteButtonState() {
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const btnText = confirmDeleteBtn.querySelector('.btn-text');
    const btnLoading = confirmDeleteBtn.querySelector('.btn-loading');
    
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.removeAttribute('aria-busy');
    btnText.style.display = 'block';
    btnLoading.style.display = 'none';
}

// Setup delete confirmation event handlers
function setupDeleteConfirmationHandlers() {
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    // Remove existing listeners to avoid duplicates
    confirmDeleteBtn.removeEventListener('click', handleConfirmDelete);
    
    // Add delete confirmation handler
    confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
}

async function handleConfirmDelete() {
    if (!currentProjectToDelete) {
        return;
    }

    // 🔹 збережемо назву зараз
    // const projectName = currentProjectToDelete.name;

    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const btnText = confirmDeleteBtn.querySelector('.btn-text');
    const btnLoading = confirmDeleteBtn.querySelector('.btn-loading');

    try {
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.setAttribute('aria-busy', 'true');
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';

        console.log('🗑️ Starting project deletion:', currentProjectToDelete.id);
        console.log('🗑️ Project object:', currentProjectToDelete);
        console.log('🗑️ GlobalDataManager available:', !!window.globalDataManager);
        console.log('🗑️ API client available:', !!window.globalDataManager?.apiClient);
        
        // Use GlobalDataManager for deletion (it handles both filesystem and server cases internally)
        if (window.globalDataManager) {
            console.log('🗑️ Using GlobalDataManager for deletion');
            await window.globalDataManager.deleteProject(currentProjectToDelete.id);
        } else {
            throw new Error('GlobalDataManager not available');
        }

        // Store project name before closing modal
        const deletedProjectName = currentProjectToDelete.name;
        
        // Видаляємо з локальних масивів
        const originalIndex = projectsData.findIndex(p => p.id === currentProjectToDelete.id);
        if (originalIndex !== -1) projectsData.splice(originalIndex, 1);

        const filteredIndex = filteredProjects.findIndex(p => p.id === currentProjectToDelete.id);
        if (filteredIndex !== -1) filteredProjects.splice(filteredIndex, 1);

        // Закриваємо модалку (може скинути currentProjectToDelete!)
        closeDeleteProjectModal();

        // Перемальовуємо список
        renderProjects();

        // Show success message
        showMessage(`Project "${deletedProjectName}" deleted successfully!`, 'success');

    } catch (error) {
        console.error('Error deleting project:', error);
        showMessage('Failed to delete project. Please try again.', 'error');
    } finally {
        resetDeleteButtonState();
    }
}


// Setup delete modal event listeners
function setupDeleteProjectModal() {
    const modal = document.getElementById('deleteProjectModal');
    
    if (!modal) return;
    
    // Setup backdrop click handler
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeDeleteProjectModal();
        }
    });
    
    // Setup keyboard handlers
    document.addEventListener('keydown', (e) => {
        if (modal && modal.style.display === 'flex') {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeDeleteProjectModal();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                // Don't auto-confirm delete for safety, just focus the delete button
                document.getElementById('confirmDeleteBtn').focus();
            } else if (e.key === 'Tab') {
                // Handle Tab key for focus management within modal
                const focusableElements = modal.querySelectorAll(
                    'button:not(:disabled), [tabindex]:not([tabindex="-1"])'
                );
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                
                if (e.shiftKey) {
                    // Shift + Tab - moving backwards
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    // Tab - moving forwards
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        }
    });
}

// Navigate to analytics page
function navigateToAnalytics() {
    console.log('🎯 navigateToAnalytics() called');
    console.log('🎯 Protocol:', window.location.protocol);
    console.log('🎯 Router available:', !!window.firaRouter);
    
    if (window.location.protocol === 'file:') {
        // Check if we're already in pages/ directory
        const currentPath = window.location.pathname;
        console.log('🎯 File protocol - current path:', currentPath);
        if (currentPath.includes('/pages/')) {
            window.location.href = 'analytics.html';
        } else {
            window.location.href = 'pages/analytics.html';
        }
    } else {
        // Use router for server mode to avoid page refresh
        if (window.firaRouter && typeof window.firaRouter.navigateTo === 'function') {
            console.log('🎯 Using router navigation');
            window.firaRouter.navigateTo('/analytics');
        } else {
            console.log('🎯 Router not available, using direct navigation');
            window.location.href = '/analytics';
        }
    }
}

// Make navigation function globally available
window.navigateToAnalytics = navigateToAnalytics;

// Header scroll behavior
function setupHeaderScrollBehavior() {
    const header = document.querySelector('.header');
    const dashboard = document.querySelector('.dashboard');
    let isScrolled = false;
    
    function handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const shouldBeScrolled = scrollTop > 50; // Trigger after 50px of scrolling
        
        if (shouldBeScrolled !== isScrolled) {
            isScrolled = shouldBeScrolled;
            
            if (isScrolled) {
                header.classList.add('scrolled');
                dashboard.classList.add('header-scrolled');
            } else {
                header.classList.remove('scrolled');
                dashboard.classList.remove('header-scrolled');
            }
        }
    }
    
    // Throttle scroll events for better performance
    let ticking = false;
    function throttledScroll() {
        if (!ticking) {
            requestAnimationFrame(() => {
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', throttledScroll, { passive: true });
}

// Initialize dashboard when DOM is loaded (only for standalone pages)
function initializeDashboard() {
    console.log('Initializing dashboard...');
    init();
    setupEditProjectForm();
    setupDeleteProjectModal();
    setupHeaderScrollBehavior();
    setupCacheEventHandlers();
    
    // Make functions globally available for inline onclick handlers
    window.openEditProjectModal = openEditProjectModal;
    window.closeEditProjectModal = closeEditProjectModal;
    window.closeDeleteProjectModal = closeDeleteProjectModal;
}

// Setup cache-related event handlers
function setupCacheEventHandlers() {
    // Listen for server scan required event
    window.addEventListener('serverScanRequired', (event) => {
        const { message, cacheTimestamp } = event.detail;
        
        // Show persistent notification about server requirement
        showServerScanNotification(message, cacheTimestamp);
    });
    
    // Listen for data loaded event to update UI
    window.addEventListener('globalDataLoaded', (event) => {
        const { mode, fromCache, cacheTimestamp } = event.detail;
        
        if (fromCache) {
            console.log('📋 Data loaded from cache');
            showCacheStatusNotification(cacheTimestamp);
        }
    });
}

// Show notification that server scan is required
function showServerScanNotification(message, cacheTimestamp) {
    const notification = document.createElement('div');
    notification.className = 'cache-notification server-scan-required';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-header">
                <span class="notification-icon">⚠️</span>
                <strong>Server Required</strong>
            </div>
            <p>${message}</p>
            <div class="notification-actions">
                <button class="btn btn-primary" onclick="startServerScan()">
                    Start Server Scan
                </button>
                <button class="btn btn-secondary" onclick="dismissServerNotification()">
                    Continue with Cache
                </button>
            </div>
            ${cacheTimestamp ? `<small>Cache from: ${new Date(cacheTimestamp).toLocaleString()}</small>` : ''}
        </div>
    `;
    
    // Add styles if not already present
    if (!document.getElementById('cache-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'cache-notification-styles';
        style.textContent = `
            .cache-notification {
                position: fixed;
                top: 80px;
                right: 20px;
                max-width: 400px;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                z-index: 1000;
                animation: slideIn 0.3s ease-out;
            }
            
            .cache-notification.server-scan-required {
                border-left: 4px solid #f59e0b;
            }
            
            .notification-content {
                padding: 16px;
            }
            
            .notification-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }
            
            .notification-actions {
                display: flex;
                gap: 8px;
                margin-top: 12px;
            }
            
            .notification-actions .btn {
                padding: 6px 12px;
                font-size: 14px;
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-dismiss after 30 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 30000);
}

// Show cache status notification
function showCacheStatusNotification(cacheTimestamp) {
    const timeStr = new Date(cacheTimestamp).toLocaleString();
    showMessage(`📋 Using cached data from ${timeStr} - Start server to refresh`, 'info');
}

// Start server scan process
async function startServerScan() {
    try {
        showMessage('🔍 Starting server scan...', 'info');
        await window.globalDataManager.forceServerScan();
        
        // Reload projects after scan
        await loadProjects();
        showMessage('✅ Server scan completed and cache updated', 'success');
        
        // Remove notification
        dismissServerNotification();
        
    } catch (error) {
        console.error('Server scan failed:', error);
        showMessage('❌ Server scan failed. Please check that the server is running.', 'error');
    }
}

// Dismiss server notification
function dismissServerNotification() {
    const notification = document.querySelector('.cache-notification.server-scan-required');
    if (notification) {
        notification.remove();
    }
}

// Make functions global for button handlers
window.startServerScan = startServerScan;
window.dismissServerNotification = dismissServerNotification;

// Make dashboard initialization globally accessible for router
window.initializeDashboard = initializeDashboard;

// DEBUG: Marker to confirm correct script.js is loaded
console.log('🔧 CORRECT web/script.js loaded - v2.1 dashboard fix');

// Auto-initialize for standalone dashboard page only (not when loaded via router)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Extra safety check - don't initialize if elements don't exist
        if (document.getElementById('searchInput')) {
            if (window.location.pathname.includes('dashboard.html')) {
                // We're on dashboard.html - initialize normally
                initializeDashboard();
            }
        } else if (window.location.protocol === 'file:' && window.location.pathname.includes('index.html')) {
            // We're on index.html in file:// mode - redirect to dashboard
            console.log('File protocol detected on index.html - redirecting to dashboard');
            window.location.href = 'pages/dashboard.html';
        } else {
            // We're likely in router mode - don't auto-initialize
            console.log('🔄 Script loaded in router mode - waiting for explicit initialization');
        }
    });
} else {
    // Document already loaded - extra safety check
    if (document.getElementById('searchInput')) {
        if (window.location.pathname.includes('dashboard.html')) {
            initializeDashboard();
        }
    } else if (window.location.protocol === 'file:' && window.location.pathname.includes('index.html')) {
        console.log('File protocol detected on index.html - redirecting to dashboard');
        window.location.href = 'pages/dashboard.html';
    } else {
        // We're likely in router mode - don't auto-initialize
        console.log('🔄 Script loaded in router mode - waiting for explicit initialization');
    }
}


// Make refresh function globally accessible
window.refreshProjects = async function() {
    try {
        console.log('🔄 Refreshing projects from existing UI...');
        
        // Call refresh method
        const success = await window.globalDataManager.refreshProjects();
        
        if (success) {
            // Update local data
            projectsData = window.globalDataManager.getProjects();
            filteredProjects = [...projectsData];
            
            // Re-render projects
            renderProjects();
            
            showMessage('Projects refreshed successfully!', 'success');
        } else {
            showMessage('Failed to refresh projects.', 'error');
        }
        
    } catch (error) {
        console.error('Error refreshing projects:', error);
        showMessage('Failed to refresh projects.', 'error');
    }
};

// Make renderProjects globally accessible for auto-refresh
window.renderProjects = renderProjects;

// Export initialization function for router use
window.initializeDashboard = initializeDashboard;

// Reset mode choice function (for localhost only)
function resetModeChoice() {
    if (window.globalDataManager) {
        window.globalDataManager.resetModeChoice();
    } else {
        console.warn('Global data manager not available');
    }
}

// Show reset mode button on localhost
function showResetModeButton() {
    const currentHostname = window.location.hostname;
    if (currentHostname.includes('localhost') || currentHostname.includes('127.0.0.1')) {
        const resetModeContainer = document.getElementById('reset-mode-container');
        if (resetModeContainer) {
            resetModeContainer.style.display = 'block';
        }
    }
}

// Initialize mode reset button when page loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(showResetModeButton, 1000); // Show after other initialization
});

// Make functions globally accessible
window.resetModeChoice = resetModeChoice;
window.showResetModeButton = showResetModeButton;