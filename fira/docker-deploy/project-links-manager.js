/**
 * Project Links Manager
 * Manages useful links for projects
 */

class ProjectLinksManager {
    constructor(apiClient, projectId) {
        this.apiClient = apiClient;
        this.projectId = projectId;
        this.links = [];
        this.currentEditingLink = null;
        this.isSubmitting = false; // Prevent double submission

        this.init();
    }

    init() {
        // Bind event listeners (only once by cloning to remove old listeners)
        const linksBtn = document.getElementById('projectLinksBtn');
        if (linksBtn) {
            console.log('🔗 Found projectLinksBtn, attaching click listener');
            // Clone to remove old listeners
            const newLinksBtn = linksBtn.cloneNode(true);
            linksBtn.parentNode.replaceChild(newLinksBtn, linksBtn);
            newLinksBtn.addEventListener('click', () => {
                console.log('🔗 Links button clicked!');
                this.openLinksModal();
            });
        } else {
            console.error('❌ projectLinksBtn not found in DOM');
        }

        const linkForm = document.getElementById('linkForm');
        if (linkForm) {
            // Clone to remove old listeners
            const newLinkForm = linkForm.cloneNode(true);
            linkForm.parentNode.replaceChild(newLinkForm, linkForm);
            newLinkForm.addEventListener('submit', (e) => this.handleLinkSubmit(e));
        }

        const autoFetchBtn = document.getElementById('autoFetchIconBtn');
        if (autoFetchBtn) {
            const newAutoFetchBtn = autoFetchBtn.cloneNode(true);
            autoFetchBtn.parentNode.replaceChild(newAutoFetchBtn, autoFetchBtn);
            newAutoFetchBtn.addEventListener('click', () => this.autoFetchIcon());
        }

        const uploadBtn = document.getElementById('uploadIconBtn');
        if (uploadBtn) {
            const newUploadBtn = uploadBtn.cloneNode(true);
            uploadBtn.parentNode.replaceChild(newUploadBtn, uploadBtn);
            newUploadBtn.addEventListener('click', () => {
                document.getElementById('linkIconUpload').click();
            });
        }

        const iconUpload = document.getElementById('linkIconUpload');
        if (iconUpload) {
            const newIconUpload = iconUpload.cloneNode(true);
            iconUpload.parentNode.replaceChild(newIconUpload, iconUpload);
            newIconUpload.addEventListener('change', (e) => this.handleIconUpload(e));
        }

        console.log('✅ ProjectLinksManager initialized');
    }

    async openLinksModal() {
        console.log('🔗 Opening project links modal');

        // Load links from server
        await this.loadLinks();

        // Show modal
        const modal = document.getElementById('projectLinksModal');
        if (modal) {
            modal.classList.add('show');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            console.log('✅ Modal displayed');
        } else {
            console.error('❌ Modal element not found');
        }
    }

    async loadLinks() {
        try {
            const url = `${this.apiClient.baseUrl}/api/projects/${encodeURIComponent(this.projectId)}/links`;
            console.log('📡 Fetching links from:', url);

            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                this.links = data.links || [];
                this.renderLinksTable();
                console.log(`✅ Loaded ${this.links.length} links`);
            } else {
                console.error('Failed to load links:', data.error);
            }
        } catch (error) {
            console.error('Error loading links:', error);
            this.showToast('Failed to load links', 'error');
        }
    }

    renderLinksTable() {
        const tbody = document.getElementById('linksTableBody');
        if (!tbody) return;

        if (this.links.length === 0) {
            tbody.innerHTML = `
                <tr class="no-links-row">
                    <td colspan="5" style="text-align: center; padding: 40px; color: #9ca3af;">
                        No links added yet. Click "Add Link" to create one.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.links.map(link => `
            <tr data-link-id="${link.id}">
                <td>
                    <div class="link-icon-cell">
                        ${link.icon && link.icon.trim() !== '' ?
                            `<img src="${this.apiClient.baseUrl}/api/projects/${encodeURIComponent(this.projectId)}/links/${link.icon}"
                                  alt="${link.title}"
                                  class="link-icon"
                                  onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                             <div class="link-icon-fallback" style="display: none;">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd"/>
                                </svg>
                             </div>` :
                            `<div class="link-icon-fallback">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd"/>
                                </svg>
                             </div>`
                        }
                    </div>
                </td>
                <td>
                    <div class="link-title">${this.escapeHtml(link.title)}</div>
                </td>
                <td>
                    <a href="${this.escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="link-url">
                        ${this.escapeHtml(link.url)}
                    </a>
                </td>
                <td>
                    <div class="link-description">${this.escapeHtml(link.description || '')}</div>
                </td>
                <td>
                    <div class="link-actions">
                        <button class="btn-icon" onclick="window.projectLinksManager.editLink('${link.id}')" title="Edit">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                            </svg>
                        </button>
                        <button class="btn-icon btn-danger" onclick="window.projectLinksManager.deleteLink('${link.id}')" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    openAddLinkDialog() {
        this.currentEditingLink = null;
        document.getElementById('linkDialogTitle').textContent = 'Add Link';
        document.getElementById('linkForm').reset();
        document.getElementById('linkId').value = '';
        document.getElementById('linkIconData').value = '';

        // Reset icon preview
        this.resetIconPreview();

        // Show dialog
        const dialog = document.getElementById('linkDialog');
        if (dialog) {
            dialog.classList.add('show');
            dialog.style.display = 'flex';
            console.log('✅ Add link dialog displayed');
        }
    }

    editLink(linkId) {
        const link = this.links.find(l => l.id === linkId);
        if (!link) return;

        this.currentEditingLink = link;

        document.getElementById('linkDialogTitle').textContent = 'Edit Link';
        document.getElementById('linkId').value = link.id;
        document.getElementById('linkTitle').value = link.title;
        document.getElementById('linkUrl').value = link.url;
        document.getElementById('linkDescription').value = link.description || '';

        // Show icon if exists
        if (link.icon) {
            const iconImg = document.getElementById('linkIconImg');
            const iconPlaceholder = document.querySelector('.icon-placeholder');
            iconImg.src = `${this.apiClient.baseUrl}/api/projects/${encodeURIComponent(this.projectId)}/links/${link.icon}`;
            iconImg.style.display = 'block';
            if (iconPlaceholder) iconPlaceholder.style.display = 'none';
        } else {
            this.resetIconPreview();
        }

        // Show dialog
        const dialog = document.getElementById('linkDialog');
        if (dialog) {
            dialog.classList.add('show');
            dialog.style.display = 'flex';
            console.log('✅ Edit link dialog displayed');
        }
    }

    async deleteLink(linkId) {
        if (!confirm('Are you sure you want to delete this link?')) {
            return;
        }

        try {
            const url = `${this.apiClient.baseUrl}/api/projects/${encodeURIComponent(this.projectId)}/links/${encodeURIComponent(linkId)}`;
            const response = await fetch(url, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Link deleted successfully', 'success');
                await this.loadLinks();
            } else {
                this.showToast('Failed to delete link: ' + data.error, 'error');
            }
        } catch (error) {
            console.error('Error deleting link:', error);
            this.showToast('Failed to delete link', 'error');
        }
    }

    async handleLinkSubmit(e) {
        e.preventDefault();

        const linkId = document.getElementById('linkId').value;
        const title = document.getElementById('linkTitle').value.trim();
        const url = document.getElementById('linkUrl').value.trim();
        const description = document.getElementById('linkDescription').value.trim();
        const iconData = document.getElementById('linkIconData').value;

        if (!title || !url) {
            this.showToast('Title and URL are required', 'error');
            return;
        }

        // Prevent double submission
        if (this.isSubmitting) {
            console.log('⚠️ Form already submitting, ignoring duplicate submit');
            return;
        }
        this.isSubmitting = true;

        // Show loading state
        this.setFormLoading(true);

        try {
            const linkData = {
                title,
                url,
                description
            };

            let response;
            if (linkId) {
                // Update existing link
                response = await fetch(
                    `${this.apiClient.baseUrl}/api/projects/${encodeURIComponent(this.projectId)}/links/${encodeURIComponent(linkId)}`,
                    {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(linkData)
                    }
                );
            } else {
                // Create new link
                response = await fetch(
                    `${this.apiClient.baseUrl}/api/projects/${encodeURIComponent(this.projectId)}/links`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(linkData)
                    }
                );
            }

            const data = await response.json();
            console.log('💾 Link save response:', data);

            if (data.success) {
                console.log('✅ Link saved successfully:', data.link.id);

                // Upload icon if provided
                if (iconData) {
                    console.log('📤 Icon data present, uploading...');
                    await this.uploadIcon(data.link.id, iconData);
                } else {
                    console.log('⚠️ No icon data to upload');
                }

                this.showToast(linkId ? 'Link updated successfully' : 'Link added successfully', 'success');
                this.closeLinkDialog();
                await this.loadLinks();
            } else {
                this.showToast('Failed to save link: ' + data.error, 'error');
            }
        } catch (error) {
            console.error('Error saving link:', error);
            this.showToast('Failed to save link', 'error');
        } finally {
            this.setFormLoading(false);
            this.isSubmitting = false; // Reset flag
        }
    }

    async autoFetchIcon() {
        const url = document.getElementById('linkUrl').value.trim();
        if (!url) {
            this.showToast('Please enter a URL first', 'error');
            return;
        }

        const btn = document.getElementById('autoFetchIconBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<div class="loading-spinner"></div> Fetching...';

        try {
            const response = await fetch(
                `${this.apiClient.baseUrl}/api/fetch-favicon?url=${encodeURIComponent(url)}`
            );
            const data = await response.json();

            if (data.success && data.favicon) {
                document.getElementById('linkIconData').value = data.favicon;

                // Show preview
                const iconImg = document.getElementById('linkIconImg');
                const iconPlaceholder = document.querySelector('.icon-placeholder');
                iconImg.src = data.favicon;
                iconImg.style.display = 'block';
                if (iconPlaceholder) iconPlaceholder.style.display = 'none';

                this.showToast('Icon fetched successfully', 'success');
            } else {
                this.showToast('Could not fetch icon from URL', 'error');
            }
        } catch (error) {
            console.error('Error fetching icon:', error);
            this.showToast('Failed to fetch icon', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    handleIconUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showToast('Please select an image file', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const iconData = event.target.result;
            document.getElementById('linkIconData').value = iconData;

            // Show preview
            const iconImg = document.getElementById('linkIconImg');
            const iconPlaceholder = document.querySelector('.icon-placeholder');
            iconImg.src = iconData;
            iconImg.style.display = 'block';
            if (iconPlaceholder) iconPlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    async uploadIcon(linkId, iconData) {
        console.log('📤 uploadIcon called:', { linkId, iconDataLength: iconData?.length });
        try {
            // Convert data URL to blob
            const response = await fetch(iconData);
            const blob = await response.blob();
            console.log('  - Blob created:', blob.size, 'bytes, type:', blob.type);

            const formData = new FormData();
            formData.append('icon', blob, 'icon.png');

            const uploadUrl = `${this.apiClient.baseUrl}/api/projects/${encodeURIComponent(this.projectId)}/links/${encodeURIComponent(linkId)}/icon`;
            console.log('  - Uploading to:', uploadUrl);

            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });

            console.log('  - Upload response status:', uploadResponse.status);
            const uploadData = await uploadResponse.json();
            console.log('  - Upload response data:', uploadData);

            if (uploadData.success) {
                console.log('✅ Icon uploaded successfully:', uploadData.icon_path);
            } else {
                console.error('❌ Icon upload failed:', uploadData.error);
            }
        } catch (error) {
            console.error('❌ Error uploading icon:', error);
            throw error;
        }
    }

    resetIconPreview() {
        const iconImg = document.getElementById('linkIconImg');
        const iconPlaceholder = document.querySelector('.icon-placeholder');
        iconImg.style.display = 'none';
        iconImg.src = '';
        if (iconPlaceholder) iconPlaceholder.style.display = 'block';
    }

    closeLinkDialog() {
        const dialog = document.getElementById('linkDialog');
        if (dialog) {
            dialog.classList.remove('show');
            dialog.style.display = 'none';
            console.log('✅ Link dialog closed');
        }
    }

    closeLinksModal() {
        const modal = document.getElementById('projectLinksModal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            console.log('✅ Links modal closed');
        }
    }

    setFormLoading(loading) {
        const btn = document.getElementById('saveLinkBtn');
        const btnText = btn.querySelector('.btn-text');
        const btnLoading = btn.querySelector('.btn-loading');

        if (loading) {
            btn.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
        } else {
            btn.disabled = false;
            btnText.style.display = 'block';
            btnLoading.style.display = 'none';
        }
    }

    showToast(message, type = 'info') {
        // Use existing toast notification system if available
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            alert(message);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions for onclick handlers
function closeProjectLinksModal() {
    if (window.projectLinksManager) {
        window.projectLinksManager.closeLinksModal();
    }
}

function closeLinkDialog() {
    if (window.projectLinksManager) {
        window.projectLinksManager.closeLinkDialog();
    }
}

function openAddLinkDialog() {
    if (window.projectLinksManager) {
        window.projectLinksManager.openAddLinkDialog();
    }
}
