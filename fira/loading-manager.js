// Loading Manager
// Handles loading screen display and status updates during initialization

class LoadingManager {
    constructor() {
        this.isShowing = false;
        this.currentStep = null;
        this.steps = [
            { id: 'server-check', label: 'Checking server...', completed: false },
            { id: 'projects-load', label: 'Loading projects...', completed: false },
            { id: 'tasks-load', label: 'Loading tasks...', completed: false, dynamic: true },
            { id: 'complete', label: 'Ready!', completed: false }
        ];
        this.taskLoadingCount = { current: 0, total: 0 };
    }

    show() {
        if (this.isShowing) return;
        
        console.log('🔄 LoadingManager: Showing loading screen');
        this.isShowing = true;
        
        // Create loading screen element
        const loadingScreen = document.createElement('div');
        loadingScreen.className = 'loading-screen';
        loadingScreen.id = 'fira-loading-screen';
        
        loadingScreen.innerHTML = `
            <div class="loading-content">
                <h1>Fira</h1>
                <p>Project Management System</p>
                <div class="loading-spinner"></div>
                
                <div class="loading-status">
                    <div class="loading-status-title">System Initialization</div>
                    <div class="loading-steps" id="loading-steps">
                        ${this.renderSteps()}
                    </div>
                    <div class="loading-progress" id="loading-progress"></div>
                </div>
            </div>
        `;
        
        // Add to body
        document.body.appendChild(loadingScreen);
        
        // Set first step as active
        this.setActiveStep('server-check');
    }

    hide() {
        if (!this.isShowing) return;
        
        console.log('✅ LoadingManager: Hiding loading screen');
        this.isShowing = false;
        
        const loadingScreen = document.getElementById('fira-loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                if (loadingScreen.parentNode) {
                    loadingScreen.parentNode.removeChild(loadingScreen);
                }
            }, 500);
        }
    }

    renderSteps() {
        return this.steps.map(step => {
            const iconClass = step.completed ? 'completed' : 
                            (this.currentStep === step.id ? 'active' : 'waiting');
            
            let label = step.label;
            if (step.id === 'tasks-load' && step.dynamic && this.taskLoadingCount.total > 0) {
                label = `Loading tasks (${this.taskLoadingCount.current}/${this.taskLoadingCount.total})...`;
            }
            
            return `
                <div class="loading-step ${step.completed ? 'completed' : (this.currentStep === step.id ? 'active' : '')}" 
                     data-step="${step.id}">
                    <div class="loading-step-icon ${iconClass}"></div>
                    <div class="loading-step-text">${label}</div>
                </div>
            `;
        }).join('');
    }

    updateSteps() {
        const stepsContainer = document.getElementById('loading-steps');
        if (stepsContainer) {
            stepsContainer.innerHTML = this.renderSteps();
        }
    }

    setActiveStep(stepId) {
        console.log(`🔄 LoadingManager: Setting active step: ${stepId}`);
        this.currentStep = stepId;
        this.updateSteps();
    }

    completeStep(stepId) {
        console.log(`✅ LoadingManager: Completing step: ${stepId}`);
        const step = this.steps.find(s => s.id === stepId);
        if (step) {
            step.completed = true;
        }
        this.updateSteps();
    }

    updateTaskProgress(current, total) {
        this.taskLoadingCount = { current, total };
        
        // Update the tasks-load step with dynamic content
        const tasksStep = this.steps.find(s => s.id === 'tasks-load');
        if (tasksStep && total > 0) {
            tasksStep.dynamic = true;
        }
        
        this.updateSteps();
        
        // Update progress text
        const progressElement = document.getElementById('loading-progress');
        if (progressElement && total > 0) {
            const percentage = Math.round((current / total) * 100);
            progressElement.textContent = `${percentage}% complete`;
        }
    }

    setError(message) {
        console.error('❌ LoadingManager: Error:', message);
        
        const loadingScreen = document.getElementById('fira-loading-screen');
        if (loadingScreen) {
            const statusTitle = loadingScreen.querySelector('.loading-status-title');
            const spinner = loadingScreen.querySelector('.loading-spinner');
            
            if (statusTitle) {
                statusTitle.textContent = 'Loading Error';
                statusTitle.style.color = '#ef4444';
            }
            
            if (spinner) {
                spinner.style.display = 'none';
            }
            
            // Add error message
            const statusDiv = loadingScreen.querySelector('.loading-status');
            if (statusDiv && !statusDiv.querySelector('.error-message')) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.style.cssText = `
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    color: #ef4444;
                    padding: 12px;
                    border-radius: 8px;
                    margin-top: 16px;
                    font-size: 14px;
                `;
                errorDiv.textContent = message;
                statusDiv.appendChild(errorDiv);
            }
        }
    }
}

// Global loading manager instance
window.loadingManager = new LoadingManager();

// Auto-show loading screen if not already initialized
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure all scripts are loaded
    setTimeout(() => {
        // Only show if we're not already loaded and not in an error/login state
        if (!window.globalDataManager?.isLoaded && 
            !document.getElementById('fira-loading-screen') && 
            !document.querySelector('#app-content') && 
            !document.body.querySelector('.loading-screen')) {
            console.log('🔄 Auto-showing loading screen on DOMContentLoaded');
            window.loadingManager.show();
        }
    }, 100);
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadingManager;
}