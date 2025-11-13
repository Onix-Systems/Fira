/**
 * Fira Footer Component
 * Displays version information and powered by Onix link
 */

(function() {
    'use strict';

    // Configuration
    const FOOTER_CONFIG = {
        version: '1.0.7',
        onixUrl: 'https://onix-systems.com',
        // You can add a logo URL here if/when you have one
        logoUrl: null
    };

    /**
     * Create and inject footer HTML
     */
    function createFooter() {
        // Check if footer already exists
        if (document.querySelector('.fira-footer')) {
            console.log('Footer already exists, skipping creation');
            return;
        }

        const footer = document.createElement('div');
        footer.className = 'fira-footer';

        // Version info
        const versionSpan = document.createElement('span');
        versionSpan.className = 'fira-footer-version';
        versionSpan.textContent = `Fira v${FOOTER_CONFIG.version}`;

        // Separator
        const separator = document.createElement('div');
        separator.className = 'fira-footer-separator';

        // Powered by section
        const poweredBy = document.createElement('div');
        poweredBy.className = 'fira-footer-powered';
        poweredBy.textContent = 'Powered by ';

        // Onix link
        const onixLink = document.createElement('a');
        onixLink.className = 'fira-footer-onix-link';
        onixLink.href = FOOTER_CONFIG.onixUrl;
        onixLink.target = '_blank';
        onixLink.rel = 'noopener noreferrer';

        // Add logo if available, otherwise just text
        if (FOOTER_CONFIG.logoUrl) {
            const logo = document.createElement('img');
            logo.className = 'fira-footer-onix-logo';
            logo.src = FOOTER_CONFIG.logoUrl;
            logo.alt = 'Onix Systems';
            onixLink.appendChild(logo);
        }

        const onixText = document.createElement('span');
        onixText.textContent = 'Onix Systems';
        onixLink.appendChild(onixText);

        // Assemble footer
        poweredBy.appendChild(onixLink);
        footer.appendChild(versionSpan);
        footer.appendChild(separator);
        footer.appendChild(poweredBy);

        // Inject into DOM
        document.body.appendChild(footer);

        console.log('✅ Fira footer created successfully');
    }

    /**
     * Initialize footer when DOM is ready
     */
    function initFooter() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createFooter);
        } else {
            createFooter();
        }
    }

    // Auto-initialize
    initFooter();

    // Export for manual initialization if needed
    window.FiraFooter = {
        create: createFooter,
        config: FOOTER_CONFIG
    };
})();
