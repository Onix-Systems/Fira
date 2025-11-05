/**
 * Text File Viewer Component
 * Fullscreen text file viewer for attachments
 */

class TextFileViewer {
    constructor() {
        this.overlay = null;
        this.currentFile = null;
        this.isOpen = false;
        this.init();
    }

    /**
     * Initialize the viewer
     */
    init() {
        // Create overlay element
        this.createOverlay();

        // Add to document
        document.body.appendChild(this.overlay);

        // Setup event listeners
        this.setupEventListeners();

        console.log('✅ TextFileViewer initialized');
    }

    /**
     * Create overlay HTML structure
     */
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'text-viewer-overlay';
        this.overlay.id = 'textViewerOverlay';

        this.overlay.innerHTML = `
            <div class="text-viewer-header">
                <div class="text-viewer-title">
                    <span>📄</span>
                    <span class="text-viewer-filename" id="textViewerFilename">Document</span>
                </div>
                <div class="text-viewer-actions">
                    <button class="text-viewer-btn text-viewer-copy-btn" id="textViewerCopyBtn" title="Copy to clipboard">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                    </button>
                    <button class="text-viewer-btn" id="textViewerDownloadBtn" title="Download file">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download
                    </button>
                    <button class="text-viewer-btn text-viewer-close-btn" id="textViewerCloseBtn" title="Close (Esc)">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="text-viewer-content" id="textViewerContent">
                <!-- Content will be loaded here -->
            </div>
        `;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Close button
        const closeBtn = this.overlay.querySelector('#textViewerCloseBtn');
        closeBtn.addEventListener('click', () => this.close());

        // Copy button
        const copyBtn = this.overlay.querySelector('#textViewerCopyBtn');
        copyBtn.addEventListener('click', () => this.copyToClipboard());

        // Download button
        const downloadBtn = this.overlay.querySelector('#textViewerDownloadBtn');
        downloadBtn.addEventListener('click', () => this.download());

        // Close on overlay click (but not on content)
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay || e.target.id === 'textViewerContent') {
                this.close();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    /**
     * Check if file is text-based
     */
    isTextFile(filename) {
        const ext = '.' + filename.split('.').pop().toLowerCase();
        const textExtensions = [
            // Documents
            '.txt', '.md', '.markdown', '.rtf',
            '.pdf', '.doc', '.docx',

            // Code files
            '.js', '.jsx', '.ts', '.tsx',
            '.py', '.java', '.kt', '.swift',
            '.cpp', '.c', '.h', '.hpp',
            '.cs', '.go', '.rs', '.rb',
            '.php', '.html', '.htm', '.css', '.scss', '.sass',
            '.json', '.xml', '.yaml', '.yml',
            '.sh', '.bash', '.zsh',
            '.sql', '.graphql',

            // Config files
            '.env', '.gitignore', '.dockerignore',
            '.properties', '.conf', '.config', '.ini',

            // Data files
            '.csv', '.tsv', '.log'
        ];

        return textExtensions.includes(ext);
    }

    /**
     * Open text file viewer
     */
    async open(fileUrl, filename) {
        console.log('📄 Opening text viewer for:', filename);

        this.currentFile = { url: fileUrl, filename };
        this.isOpen = true;

        // Show overlay
        this.overlay.classList.add('active');

        // Update filename in header
        const filenameElement = this.overlay.querySelector('#textViewerFilename');
        filenameElement.textContent = filename;

        // Show loading state
        this.showLoading();

        // Load file content
        await this.loadFileContent(fileUrl);

        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    /**
     * Load file content from URL
     */
    async loadFileContent(url) {
        const contentElement = this.overlay.querySelector('#textViewerContent');

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type') || '';
            let text = await response.text();

            // Detect file type from extension
            const ext = this.currentFile.filename.split('.').pop().toLowerCase();

            // Display content
            this.displayContent(text, ext);

            console.log('✅ File content loaded successfully');

        } catch (error) {
            console.error('❌ Failed to load file content:', error);
            this.showError(error.message);
        }
    }

    /**
     * Display file content
     */
    displayContent(text, fileExtension) {
        const contentElement = this.overlay.querySelector('#textViewerContent');

        // Determine language class for syntax highlighting
        let languageClass = '';
        if (['json'].includes(fileExtension)) {
            languageClass = 'language-json';
        } else if (['md', 'markdown'].includes(fileExtension)) {
            languageClass = 'language-markdown';
        } else if (['js', 'ts', 'py', 'java', 'kt', 'swift', 'cpp', 'c', 'html', 'css'].includes(fileExtension)) {
            languageClass = 'language-code';
        }

        contentElement.innerHTML = `
            <div class="text-viewer-container">
                <pre class="text-viewer-pre ${languageClass}" id="textViewerPre">${this.escapeHtml(text)}</pre>
            </div>
        `;
    }

    /**
     * Show loading state
     */
    showLoading() {
        const contentElement = this.overlay.querySelector('#textViewerContent');
        contentElement.innerHTML = `
            <div class="text-viewer-loading">
                <div class="text-viewer-spinner"></div>
                <div class="text-viewer-loading-text">Loading file...</div>
            </div>
        `;
    }

    /**
     * Show error state
     */
    showError(message) {
        const contentElement = this.overlay.querySelector('#textViewerContent');
        contentElement.innerHTML = `
            <div class="text-viewer-error">
                <div class="text-viewer-error-icon">⚠️</div>
                <div class="text-viewer-error-text">Failed to load file</div>
                <div class="text-viewer-error-text">${this.escapeHtml(message)}</div>
            </div>
        `;
    }

    /**
     * Close viewer
     */
    close() {
        console.log('📄 Closing text viewer');

        this.isOpen = false;
        this.overlay.classList.remove('active');

        // Restore body scroll
        document.body.style.overflow = '';

        // Clear content after animation
        setTimeout(() => {
            const contentElement = this.overlay.querySelector('#textViewerContent');
            contentElement.innerHTML = '';
            this.currentFile = null;
        }, 200);
    }

    /**
     * Copy content to clipboard
     */
    async copyToClipboard() {
        const preElement = this.overlay.querySelector('#textViewerPre');
        if (!preElement) return;

        const text = preElement.textContent;
        const copyBtn = this.overlay.querySelector('#textViewerCopyBtn');

        try {
            await navigator.clipboard.writeText(text);

            // Visual feedback
            const originalHTML = copyBtn.innerHTML;
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Copied!
            `;

            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = originalHTML;
            }, 2000);

            console.log('✅ Content copied to clipboard');

        } catch (error) {
            console.error('❌ Failed to copy to clipboard:', error);
            alert('Failed to copy to clipboard');
        }
    }

    /**
     * Download file
     */
    download() {
        if (!this.currentFile) return;

        const link = document.createElement('a');
        link.href = this.currentFile.url;
        link.download = this.currentFile.filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('📥 Downloading file:', this.currentFile.filename);
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

// Initialize global text viewer instance
if (typeof window !== 'undefined') {
    window.textFileViewer = null;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.textFileViewer = new TextFileViewer();
        });
    } else {
        window.textFileViewer = new TextFileViewer();
    }
}
