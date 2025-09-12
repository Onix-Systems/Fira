/**
 * Enhanced login check - protects main app and handles redirection
 */

(function() {
    // Check if this is local version - skip login checks for local
    const isLocalVersion = !window.location.hostname.includes("onix-systems-android-tasks");
    if (isLocalVersion) {
        console.log('🔓 Local version - skipping login check');
        // Still add the helper functions
        window.logoutUser = function() {
            console.log('👋 Logout not needed for local version');
        };
        window.isUserLoggedIn = function() {
            return true; // Always logged in for local
        };
        return;
    }
    
    // Only run this check if we're on app pages (but not login screen)
    const currentPath = window.location.pathname;
    const isAppPage = currentPath === '/app.html' || currentPath === '/main.html' || 
                     currentPath.startsWith('/project/') || currentPath.startsWith('/analytics');
    
    if (isAppPage) {
        console.log('🔐 Checking login for protected app page:', currentPath);
        
        // Check if user is already logged in
        const loginData = localStorage.getItem('fira_login');
        let isLoggedIn = false;
        
        if (loginData) {
            try {
                const data = JSON.parse(loginData);
                const loginTime = new Date(data.loginTime);
                const now = new Date();
                const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
                
                // Check if login is still valid (24 hours)
                if (hoursDiff < 24) {
                    isLoggedIn = true;
                    console.log('✅ Valid login found for user:', data.username);
                } else {
                    console.log('⏰ Login expired');
                    localStorage.removeItem('fira_login');
                }
            } catch (e) {
                console.log('❌ Invalid login data');
                localStorage.removeItem('fira_login');
            }
        }
        
        // If not logged in, redirect to root (which shows login screen)
        if (!isLoggedIn) {
            console.log('🔄 Not logged in - redirecting to login screen');
            window.location.href = '/';
            return;
        }
    }
    
    // Add logout functionality
    window.logoutUser = function() {
        console.log('👋 Logging out user');
        localStorage.removeItem('fira_login');
        window.location.href = '/';
    };
    
    // Add helper to check login status
    window.isUserLoggedIn = function() {
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
    };
})();