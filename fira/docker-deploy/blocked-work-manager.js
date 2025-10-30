/**
 * Blocked Work Manager for Fira
 * Handles blocking/unblocking tasks and UI updates
 */

class BlockedWorkManager {
    constructor() {
        this.currentProject = null;
        this.blockReasonModal = null;
    }

    /**
     * Initialize blocked work manager for a project
     */
    init(projectId) {
        this.currentProject = projectId;
        console.log('🚫 Blocked Work Manager initialized for project:', projectId);
    }

    /**
     * Show modal to block a task
     */
    showBlockModal(taskId, taskTitle) {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'blocked-modal-overlay';
        overlay.innerHTML = `
            <div class="blocked-modal-content">
                <div class="blocked-modal-header">
                    <h3>Block Task: ${this.escapeHtml(taskTitle)}</h3>
                    <button class="blocked-modal-close" aria-label="Close">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>
                <div class="blocked-modal-body">
                    <label for="blockReason">Why is this task blocked?</label>
                    <textarea
                        id="blockReason"
                        class="block-reason-input"
                        rows="4"
                        placeholder="e.g., Waiting for API documentation, Dependencies not ready, External approval needed..."
                        required
                    ></textarea>

                    <div class="blocked-modal-actions">
                        <button class="btn-cancel" id="cancelBlockBtn">Cancel</button>
                        <button class="btn-block" id="confirmBlockBtn">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"/>
                            </svg>
                            Block Task
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.blockReasonModal = overlay;

        // Focus textarea
        setTimeout(() => {
            document.getElementById('blockReason').focus();
        }, 100);

        // Event listeners
        overlay.querySelector('.blocked-modal-close').addEventListener('click', () => this.closeBlockModal());
        overlay.querySelector('#cancelBlockBtn').addEventListener('click', () => this.closeBlockModal());
        overlay.querySelector('#confirmBlockBtn').addEventListener('click', () => this.confirmBlock(taskId));

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeBlockModal();
            }
        });

        // Close on ESC
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeBlockModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * Close block modal
     */
    closeBlockModal() {
        if (this.blockReasonModal) {
            this.blockReasonModal.remove();
            this.blockReasonModal = null;
        }
    }

    /**
     * Confirm blocking a task
     */
    async confirmBlock(taskId) {
        const reasonInput = document.getElementById('blockReason');
        const reason = reasonInput.value.trim();

        if (!reason) {
            reasonInput.classList.add('error');
            return;
        }

        try {
            // Show loading state
            const confirmBtn = document.getElementById('confirmBlockBtn');
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Blocking...';

            // Block task via API
            await window.firaAPIClient.blockTask(this.currentProject, taskId, reason);

            // Close modal
            this.closeBlockModal();

            // Reload board to show blocked state
            if (window.location.reload) {
                window.location.reload();
            }

        } catch (error) {
            console.error('Error blocking task:', error);
            alert('Failed to block task: ' + error.message);

            // Reset button
            const confirmBtn = document.getElementById('confirmBlockBtn');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"/>
                </svg>
                Block Task
            `;
        }
    }

    /**
     * Unblock a task
     */
    async unblockTask(taskId, taskTitle) {
        const confirmed = confirm(`Unblock task "${taskTitle}"?`);
        if (!confirmed) return;

        try {
            // Unblock via API
            await window.firaAPIClient.unblockTask(this.currentProject, taskId);

            // Reload board
            if (window.location.reload) {
                window.location.reload();
            }

        } catch (error) {
            console.error('Error unblocking task:', error);
            alert('Failed to unblock task: ' + error.message);
        }
    }

    /**
     * Get blocked badge HTML for a task card header
     */
    getBlockedBadgeHTML(task) {
        if (!task.blocked || !task.is_currently_blocked) {
            return '';
        }

        const blockedDays = task.blocked_time_days || 0;
        const reason = task.blocked_reason || 'Blocked';

        return `
            <div class="task-blocked-badge" title="${this.escapeHtml(reason)}">
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"/>
                </svg>
                <span>${blockedDays}d</span>
            </div>
        `;
    }

    /**
     * Get compact block/unblock button for task card footer
     */
    getBlockButtonHTML(task) {
        if (task.blocked && task.is_currently_blocked) {
            return `
                <button class="task-block-btn blocked"
                        onclick="event.stopPropagation(); window.blockedWorkManager.unblockTask('${this.escapeHtml(task.id)}', '${this.escapeHtml(task.title)}')"
                        title="Unblock: ${this.escapeHtml(task.blocked_reason || 'No reason')}">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z"/>
                    </svg>
                </button>
            `;
        } else {
            return `
                <button class="task-block-btn"
                        onclick="event.stopPropagation(); window.blockedWorkManager.showBlockModal('${this.escapeHtml(task.id)}', '${this.escapeHtml(task.title)}')"
                        title="Block this task">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"/>
                    </svg>
                </button>
            `;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global instance
window.blockedWorkManager = new BlockedWorkManager();

console.log('🚫 Blocked Work Manager loaded');
