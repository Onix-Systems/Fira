/**
 * Attachments List Component
 * Manages file attachments for tasks
 */

class AttachmentsManager {
    constructor(projectId, taskId) {
        this.projectId = projectId;
        this.taskId = taskId;
        this.attachments = [];
        this.uploadInProgress = false;
        this.listenersAttached = false;
    }

    /**
     * Initialize attachments component
     */
    async init(containerElement) {
        this.container = containerElement;
        await this.loadAttachments();
        this.render();
        this.setupEventListeners();
    }

    /**
     * Load attachments from server
     */
    async loadAttachments() {
        try {
            const result = await window.firaAPIClient.getTaskAttachments(this.projectId, this.taskId);
            if (result.success) {
                this.attachments = result.attachments || [];
                console.log(`📎 Loaded ${this.attachments.length} attachments`);
            }
        } catch (error) {
            console.error('❌ Failed to load attachments:', error);
            this.attachments = [];
        }
    }

    /**
     * Render attachments UI
     */
    render() {
        if (!this.container) return;

        const html = `
            <div class="attachments-section">
                <div class="attachments-header">
                    <h4 class="attachments-title">
                        📎 Attachments (${this.attachments.length})
                    </h4>
                </div>

                <!-- Upload Zone -->
                <div class="attachment-upload-zone" id="attachmentUploadZone">
                    <div class="upload-zone-content">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <p class="upload-text">Drop files here or click to select</p>
                        <p class="upload-hint">Max 250MB per file • Images and videos supported • No .exe, .bat, .sh files</p>
                    </div>
                    <input type="file" id="attachmentFileInput" style="display: none;" multiple>
                </div>

                <!-- Progress Bar -->
                <div class="upload-progress" id="uploadProgress" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <p class="progress-text" id="progressText">Uploading...</p>
                </div>

                <!-- Attachments List -->
                <div class="attachments-list" id="attachmentsList">
                    ${this.renderAttachmentsList()}
                </div>
            </div>
        `;

        this.container.innerHTML = html;
    }

    /**
     * Check if file is media (image or video)
     */
    isMediaFile(filename) {
        const ext = '.' + filename.split('.').pop().toLowerCase();
        const mediaFormats = [
            '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp',
            '.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv'
        ];
        return mediaFormats.includes(ext);
    }

    /**
     * Check if file is video
     */
    isVideoFile(filename) {
        const ext = '.' + filename.split('.').pop().toLowerCase();
        const videoFormats = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv'];
        return videoFormats.includes(ext);
    }

    /**
     * Check if file is text-based
     */
    isTextFile(filename) {
        const ext = '.' + filename.split('.').pop().toLowerCase();
        const textExtensions = [
            // Documents
            '.txt', '.md', '.markdown', '.rtf',

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
     * Render list of attachments
     */
    renderAttachmentsList() {
        if (this.attachments.length === 0) {
            return '<p class="no-attachments">No attachments yet</p>';
        }

        return this.attachments.map((attachment, index) => {
            const isMedia = this.isMediaFile(attachment.original_name);
            const isVideo = this.isVideoFile(attachment.original_name);
            const isText = this.isTextFile(attachment.original_name);

            return `
                <div class="attachment-item" data-id="${attachment.id}" data-index="${index}">
                    <div class="attachment-icon">
                        ${this.getFileIcon(attachment.type)}
                    </div>
                    <div class="attachment-info">
                        <div class="attachment-name" title="${attachment.original_name}">
                            ${this.truncateFilename(attachment.original_name, 30)}
                        </div>
                        <div class="attachment-meta">
                            <span class="attachment-size">${this.formatFileSize(attachment.size)}</span>
                            <span class="attachment-separator">•</span>
                            <span class="attachment-date">${this.formatDate(attachment.uploaded_at)}</span>
                        </div>
                    </div>
                    <div class="attachment-actions">
                        ${isMedia ? `
                            <button class="attachment-action-btn view-btn"
                                    data-index="${index}"
                                    title="${isVideo ? 'Play video' : 'View image'}">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    ${isVideo ?
                                        '<polygon points="5 3 19 12 5 21 5 3"></polygon>' :
                                        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>'
                                    }
                                </svg>
                            </button>
                        ` : isText ? `
                            <button class="attachment-action-btn view-text-btn"
                                    data-index="${index}"
                                    title="View text file">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                        ` : ''}
                        <button class="attachment-action-btn download-btn"
                                data-url="${attachment.url}"
                                data-filename="${attachment.original_name}"
                                title="Download">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </button>
                        <button class="attachment-action-btn delete-btn"
                                data-filename="${attachment.filename}"
                                title="Delete">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Prevent duplicate event listeners
        if (this.listenersAttached) {
            console.log('⚠️ Event listeners already attached, skipping');
            return;
        }

        const uploadZone = document.getElementById('attachmentUploadZone');
        const fileInput = document.getElementById('attachmentFileInput');

        if (!uploadZone || !fileInput) return;

        // Click to select files
        uploadZone.addEventListener('click', () => {
            if (!this.uploadInProgress) {
                fileInput.click();
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                this.handleFiles(files);
            }
            fileInput.value = ''; // Reset input
        });

        // Drag and drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadZone.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadZone.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadZone.classList.remove('drag-over');

            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.handleFiles(files);
            }
        });

        // Attachment action buttons
        this.container.addEventListener('click', (e) => {
            // View/Play button (media)
            const viewBtn = e.target.closest('.view-btn');
            if (viewBtn) {
                e.stopPropagation();
                e.preventDefault();
                const index = parseInt(viewBtn.dataset.index);
                this.viewAttachment(index);
                return;
            }

            // View text file button
            const viewTextBtn = e.target.closest('.view-text-btn');
            if (viewTextBtn) {
                e.stopPropagation();
                e.preventDefault();
                const index = parseInt(viewTextBtn.dataset.index);
                this.viewTextFile(index);
                return;
            }

            // Download button
            const downloadBtn = e.target.closest('.download-btn');
            if (downloadBtn) {
                e.stopPropagation();
                e.preventDefault();
                const url = downloadBtn.dataset.url;
                const filename = downloadBtn.dataset.filename;
                this.downloadAttachment(url, filename);
                return;
            }

            // Delete button
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                e.preventDefault();
                const filename = deleteBtn.dataset.filename;
                this.deleteAttachment(filename);
                return;
            }
        });

        // Mark listeners as attached
        this.listenersAttached = true;
        console.log('✅ Attachments event listeners attached');
    }

    /**
     * Handle file uploads
     */
    async handleFiles(files) {
        if (this.uploadInProgress) {
            console.warn('⚠️ Upload already in progress');
            return;
        }

        // Validate files
        const blockedExtensions = ['.exe', '.bat', '.sh', '.app', '.dll', '.so', '.dylib'];
        const maxSize = 250 * 1024 * 1024; // 250MB

        for (const file of files) {
            const ext = '.' + file.name.split('.').pop().toLowerCase();

            if (blockedExtensions.includes(ext)) {
                alert(`File type ${ext} is not allowed for security reasons`);
                return;
            }

            if (file.size > maxSize) {
                alert(`File ${file.name} exceeds 250MB limit`);
                return;
            }
        }

        // Upload files one by one
        for (const file of files) {
            await this.uploadFile(file);
        }
    }

    /**
     * Upload single file
     */
    async uploadFile(file) {
        this.uploadInProgress = true;
        this.showProgress(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const result = await window.firaAPIClient.uploadAttachment(
                this.projectId,
                this.taskId,
                formData
            );

            if (result.success) {
                console.log('✅ File uploaded:', file.name);
                await this.loadAttachments();
                this.updateAttachmentsList();
            }

        } catch (error) {
            console.error('❌ Upload failed:', error);
            alert(`Failed to upload ${file.name}: ${error.message}`);
        } finally {
            this.uploadInProgress = false;
            this.showProgress(false);
        }
    }

    /**
     * View attachment (image/video) in fullscreen
     */
    viewAttachment(index) {
        console.log('👁️ Opening media viewer for attachment:', index);

        // Check if ImageGallery is available
        if (!window.imageGallery) {
            console.error('❌ ImageGallery not initialized');
            alert('Media viewer is not available');
            return;
        }

        // Filter only media attachments and find the index
        const mediaAttachments = this.attachments
            .map((att, idx) => ({ ...att, originalIndex: idx }))
            .filter(att => this.isMediaFile(att.original_name));

        if (mediaAttachments.length === 0) {
            console.error('❌ No media attachments found');
            return;
        }

        // Find the media index relative to all media items
        const attachment = this.attachments[index];
        const mediaIndex = mediaAttachments.findIndex(att => att.originalIndex === index);

        if (mediaIndex === -1) {
            console.error('❌ Attachment not found in media list');
            return;
        }

        // Format attachments for ImageGallery
        const formattedMedia = mediaAttachments.map(att => ({
            url: att.url,
            thumbnail_url: att.url,
            filename: att.filename,
            original_name: att.original_name,
            description: att.original_name
        }));

        // Replace ImageGallery images with attachments and open lightbox
        window.imageGallery.images = formattedMedia;
        window.imageGallery.openLightbox(mediaIndex);

        console.log(`✅ Opened media viewer: ${attachment.original_name}`);
    }

    /**
     * View text file in fullscreen viewer
     */
    viewTextFile(index) {
        console.log('📄 Opening text viewer for attachment:', index);

        // Check if TextFileViewer is available
        if (!window.textFileViewer) {
            console.error('❌ TextFileViewer not initialized');
            alert('Text viewer is not available');
            return;
        }

        const attachment = this.attachments[index];
        if (!attachment) {
            console.error('❌ Attachment not found at index:', index);
            return;
        }

        // Open text viewer
        window.textFileViewer.open(attachment.url, attachment.original_name);

        console.log(`✅ Opened text viewer: ${attachment.original_name}`);
    }

    /**
     * Download attachment
     */
    downloadAttachment(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('📥 Downloading:', filename);
    }

    /**
     * Delete attachment
     */
    async deleteAttachment(filename) {
        // Prevent double deletion
        if (this.deleteInProgress) {
            console.warn('⚠️ Delete already in progress');
            return;
        }

        if (!confirm('Are you sure you want to delete this attachment?')) {
            return;
        }

        this.deleteInProgress = true;

        try {
            const result = await window.firaAPIClient.deleteAttachment(
                this.projectId,
                this.taskId,
                filename
            );

            if (result.success) {
                console.log('✅ Attachment deleted:', filename);
                await this.loadAttachments();
                this.updateAttachmentsList();
            }

        } catch (error) {
            console.error('❌ Delete failed:', error);
            alert(`Failed to delete attachment: ${error.message}`);
        } finally {
            this.deleteInProgress = false;
        }
    }

    /**
     * Update attachments list without full re-render
     */
    updateAttachmentsList() {
        const listContainer = document.getElementById('attachmentsList');
        if (listContainer) {
            listContainer.innerHTML = this.renderAttachmentsList();
        }

        // Update count in header
        const title = this.container.querySelector('.attachments-title');
        if (title) {
            title.textContent = `📎 Attachments (${this.attachments.length})`;
        }
    }

    /**
     * Show/hide upload progress
     */
    showProgress(show) {
        const progress = document.getElementById('uploadProgress');
        if (progress) {
            progress.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * Get file icon based on extension
     */
    getFileIcon(type) {
        const iconMap = {
            // Documents
            '.pdf': '📄',
            '.doc': '📄',
            '.docx': '📄',
            '.txt': '📄',
            '.md': '📄',
            '.rtf': '📄',

            // Archives
            '.zip': '📦',
            '.rar': '📦',
            '.7z': '📦',
            '.tar': '📦',
            '.gz': '📦',

            // Code
            '.js': '💻',
            '.py': '💻',
            '.java': '💻',
            '.kt': '💻',
            '.swift': '💻',
            '.cpp': '💻',
            '.c': '💻',
            '.html': '💻',
            '.css': '💻',

            // Spreadsheets
            '.xlsx': '📊',
            '.xls': '📊',
            '.csv': '📊',

            // Presentations
            '.pptx': '📈',
            '.ppt': '📈',
            '.key': '📈',

            // Images
            '.jpg': '🖼️',
            '.jpeg': '🖼️',
            '.png': '🖼️',
            '.gif': '🖼️',
            '.svg': '🖼️',

            // Video
            '.mp4': '🎬',
            '.mov': '🎬',
            '.avi': '🎬',
            '.webm': '🎬',
            '.mkv': '🎬',
            '.flv': '🎬',

            // Audio
            '.mp3': '🎵',
            '.wav': '🎵',
            '.m4a': '🎵'
        };

        return iconMap[type] || '📎';
    }

    /**
     * Format file size to human readable
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Format date to relative time
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    }

    /**
     * Truncate long filenames
     */
    truncateFilename(filename, maxLength) {
        if (filename.length <= maxLength) return filename;

        const extension = filename.split('.').pop();
        const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
        const truncated = nameWithoutExt.substring(0, maxLength - extension.length - 4) + '...';

        return truncated + '.' + extension;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.AttachmentsManager = AttachmentsManager;
}
