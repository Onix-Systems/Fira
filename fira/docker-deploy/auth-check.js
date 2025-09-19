 /**
 * Authentication checker for Fira web version
 * Runs before main application to ensure user is logged in
 * Version: 1.1 - Fixed DOM timing issues
 */

(function() {
    'use strict';
    
    // Check if this is the web version that requires login
    const isWebVersion = window.location.hostname.includes("onix-systems-android-tasks");
    
    if (!isWebVersion) {
        console.log('🔓 Local version - no login required');
        return; // Skip authentication for local versions
    }
    
    console.log('🔐 Web version detected - checking authentication...');
    
    // Check login status
    function checkLoginStatus() {
        const loginData = localStorage.getItem('fira_login');
        
        if (!loginData) {
            console.log('🔐 No login data found, redirecting to login');
            redirectToLogin();
            return false;
        }
        
        try {
            const data = JSON.parse(loginData);
            const loginTime = new Date(data.loginTime);
            const now = new Date();
            const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
            
            // Check if login expired (24 hours)
            if (hoursDiff > 24) {
                console.log('🔐 Login expired, redirecting to login');
                localStorage.removeItem('fira_login');
                redirectToLogin();
                return false;
            }
            
            console.log('✅ Login valid, continuing with app', {
                username: data.username,
                method: data.method,
                hoursAgo: hoursDiff.toFixed(1)
            });
            return true;
            
        } catch (e) {
            console.log('🔐 Invalid login data, redirecting to login');
            localStorage.removeItem('fira_login');
            redirectToLogin();
            return false;
        }
    }
    
    function redirectToLogin() {
        // Add a small delay to prevent redirect loops
        setTimeout(() => {
            window.location.href = '/';
        }, 100);
    }
    
    // Show loading message while checking auth
    function showAuthMessage(message) {
        const statusEl = document.createElement('div');
        statusEl.id = 'auth-status';
        statusEl.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #007bff;
            color: white;
            padding: 10px;
            text-align: center;
            font-family: Arial, sans-serif;
            z-index: 9999;
        `;
        statusEl.textContent = message;

        // Wait for body to be available with additional safety checks
        if (document.body && document.body.insertBefore) {
            try {
                document.body.insertBefore(statusEl, document.body.firstChild);
            } catch (e) {
                console.warn('⚠️ Failed to insert auth status element:', e.message);
                // Fallback: append to document.head if body fails
                if (document.head) {
                    document.head.appendChild(statusEl);
                }
            }
        } else {
            // If body is not ready, wait for it
            const insertElement = () => {
                if (document.body && document.body.insertBefore && !document.getElementById('auth-status')) {
                    try {
                        document.body.insertBefore(statusEl, document.body.firstChild);
                    } catch (e) {
                        console.warn('⚠️ Failed to insert auth status element on DOMContentLoaded:', e.message);
                        if (document.head) {
                            document.head.appendChild(statusEl);
                        }
                    }
                }
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', insertElement);
            } else {
                // DOM is already loaded, try to insert immediately
                setTimeout(insertElement, 10);
            }
        }

        return statusEl;
    }
    
    function hideAuthMessage() {
        const statusEl = document.getElementById('auth-status');
        if (statusEl) {
            statusEl.remove();
        }
    }
    
    // Run authentication check immediately - but wait for DOM to be ready
    console.log('🔐 Auth-check.js v1.1 starting, readyState:', document.readyState);

    const runAuthCheck = () => {
        console.log('🔐 Running auth check, body available:', !!document.body);
        const statusEl = showAuthMessage('🔐 Checking authentication...');

        setTimeout(() => {
            const isAuthenticated = checkLoginStatus();

            if (isAuthenticated) {
                statusEl.textContent = '✅ Authentication verified';
                setTimeout(hideAuthMessage, 1000);
            }
            // If not authenticated, page will redirect automatically
        }, 100);
    };

    // Ensure DOM is ready before showing status
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAuthCheck);
    } else {
        // DOM is already ready
        runAuthCheck();
    }
    
    // Export for other scripts if needed
    window.FiraAuth = {
        isAuthenticated: checkLoginStatus,
        checkLogin: checkLoginStatus,
        redirectToLogin: redirectToLogin
    };
})();