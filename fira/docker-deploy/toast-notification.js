// Toast Notification System for Web Version
// Shows warning messages for web version users

class ToastNotification {
    constructor() {
        this.toastContainer = null;
        this.isWebVersion = this.detectWebVersion();
        this.activeToasts = new Set(); // Track active toast messages
        this.init();
    }

    detectWebVersion() {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        const href = window.location.href;

        // Web version is when running on production server OR localhost server (not file://)
        // This will show toasts on web version and localhost testing
        const isWeb = (protocol !== 'file:' && hostname !== '');

        console.log('🍞 Toast detectWebVersion:', {
            hostname,
            protocol,
            href,
            isWeb,
            isProduction: hostname.includes("onix-systems-android-tasks"),
            isLocalhost: hostname === 'localhost' || hostname === '127.0.0.1'
        });
        return isWeb;
    }

    init() {
        // Create toast container
        this.toastContainer = document.createElement('div');
        this.toastContainer.id = 'toast-container';
        this.toastContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(this.toastContainer);

        // Add global styles
        const style = document.createElement('style');
        style.textContent = `
            .toast-message {
                background: #000000;
                color: #ffffff;
                padding: 16px 24px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                font-size: 14px;
                line-height: 1.5;
                max-width: 500px;
                text-align: center;
                opacity: 0;
                transform: translateY(20px);
                transition: all 0.3s ease;
                pointer-events: auto;
            }

            .toast-message.show {
                opacity: 1;
                transform: translateY(0);
            }

            .toast-message.hide {
                opacity: 0;
                transform: translateY(20px);
            }
        `;
        document.head.appendChild(style);
    }

    show(message, duration = 4000) {
        console.log('🍞 Toast show() called:', { isWebVersion: this.isWebVersion, message });

        if (!this.isWebVersion) {
            console.log('🍞 Toast not shown - not web version');
            return; // Don't show toasts in local version
        }

        // Check if this exact message is already being displayed
        if (this.activeToasts.has(message)) {
            console.log('🍞 Toast not shown - duplicate message already displayed');
            return;
        }

        console.log('🍞 Creating toast element...');

        // Add message to active toasts
        this.activeToasts.add(message);

        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;

        this.toastContainer.appendChild(toast);
        console.log('🍞 Toast element appended to container');

        // Trigger animation
        setTimeout(() => {
            toast.classList.add('show');
            console.log('🍞 Toast animation started');
        }, 10);

        // Auto-hide after duration
        setTimeout(() => {
            this.hide(toast, message);
        }, duration);
    }

    hide(toast, message) {
        toast.classList.remove('show');
        toast.classList.add('hide');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            // Remove message from active toasts when fully hidden
            if (message) {
                this.activeToasts.delete(message);
            }
        }, 300);
    }

    // Pre-defined messages
    showWebVersionWarning() {
        this.show('This is the web version of Fira. Any actions you perform will not be saved. Please use the local version to save your changes.');
    }

    showActionNotSaved(action) {
        this.show(`${action} not saved. This is the web version - use local version to save changes.`);
    }
}

// Initialize toast notification system
let toastNotification;

// Initialize immediately when body is available
function initToastSystem() {
    if (!toastNotification && document.body) {
        console.log('🍞 Initializing toast notification system...');
        toastNotification = new ToastNotification();
        console.log('🍞 Toast notification system initialized:', toastNotification);
        console.log('🍞 Toast isWebVersion:', toastNotification.isWebVersion);
    }
}

// Try to initialize as early as possible
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToastSystem);
} else {
    // DOM already loaded
    initToastSystem();
}

// Export for use in other scripts
window.ToastNotification = ToastNotification;
window.showToast = (message, duration) => {
    initToastSystem(); // Ensure initialized
    if (toastNotification) {
        toastNotification.show(message, duration);
    } else {
        console.warn('🍞 Toast system not yet initialized');
    }
};
window.showWebVersionWarning = () => {
    initToastSystem(); // Ensure initialized
    if (toastNotification) {
        toastNotification.showWebVersionWarning();
    } else {
        console.warn('🍞 Toast system not yet initialized for warning');
    }
};
