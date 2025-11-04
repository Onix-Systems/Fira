// Task Modal JavaScript
let currentTask = null;
let isEditMode = false;
let attachmentsManager = null;

// DOM elements
const modalOverlay = document.getElementById('taskModalOverlay');
const taskIdDisplay = document.getElementById('taskIdDisplay');
const taskNameInput = document.getElementById('taskName');
const markdownTextarea = document.getElementById('markdownTextarea');
const commentCharCount = document.getElementById('commentCharCount');
const imageDropZone = document.getElementById('imageDropZone');
const imageInput = document.getElementById('imageInput');
const assigneeSelector = document.getElementById('assigneeSelector');
const assigneeDropdown = document.getElementById('assigneeDropdown');
const typeSelector = document.getElementById('typeSelector');
const commentsList = document.getElementById('commentsList');
const newCommentInput = document.getElementById('newComment');

// Initialize modal functionality
function initializeTaskModal() {
    setupEventListeners();
    setupMarkdownEditor();
    setupImageDropZone();
    setupAssigneeSelector();
}

// Setup event listeners
function setupEventListeners() {
    // Mode toggle buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const mode = this.dataset.mode;
            toggleEditMode(mode === 'edit');
        });
    });

    // Character count for comment textarea
    if (newCommentInput) {
        newCommentInput.addEventListener('input', updateCommentCharacterCount);
        updateCommentCharacterCount(); // Initial count
    }

    // Close modal on overlay click
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function(e) {
            if (e.target === modalOverlay) {
                closeTaskModal();
            }
        });
    }

    // Escape key to close modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('active')) {
            closeTaskModal();
        }
    });

    // Clean pasted HTML content in markdown textarea
    if (markdownTextarea) {
        markdownTextarea.addEventListener('paste', function(e) {
            // Check if clipboard contains HTML
            const html = e.clipboardData.getData('text/html');
            const text = e.clipboardData.getData('text/plain');

            // Only clean if HTML contains inline styles AND img tags
            // Don't interfere with normal text paste
            if (html && html.includes('style=') && html.includes('<img')) {
                e.preventDefault();

                // Clean the HTML and convert to markdown
                let cleanText = cleanMarkdownFromInlineStyles(html);

                // If cleaning failed, use plain text as fallback
                if (!cleanText || cleanText === html) {
                    cleanText = text;
                }

                // Insert cleaned text at cursor position
                const start = markdownTextarea.selectionStart;
                const end = markdownTextarea.selectionEnd;
                const currentValue = markdownTextarea.value;

                markdownTextarea.value = currentValue.substring(0, start) +
                                        cleanText +
                                        currentValue.substring(end);

                // Set cursor position after pasted text
                markdownTextarea.selectionStart = markdownTextarea.selectionEnd = start + cleanText.length;

                console.log('✅ Cleaned pasted HTML content');
            }
            // Otherwise let default paste behavior work
        });
    }
}

// Setup markdown editor toolbar
function setupMarkdownEditor() {
    const toolbarButtons = document.querySelectorAll('.toolbar-btn');
    
    toolbarButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            applyMarkdownFormatting(action);
        });
    });
}

// Helper function to check if a line is already quoted
function isLineQuoted(line) {
    return line.trim().startsWith('> ');
}

// Helper function to remove quote formatting from a line
function removeQuoteFromLine(line) {
    return line.replace(/^\s*>\s?/, '');
}

// Helper function to add quote formatting to a line
function addQuoteToLine(line) {
    return `> ${line}`;
}

// Helper function to check if a line is a list item
function isLineListItem(line) {
    return /^\s*[-*+]\s/.test(line.trim()) || /^\s*\d+\.\s/.test(line.trim());
}

// Helper function to remove list formatting from a line
function removeListFromLine(line) {
    return line.replace(/^\s*[-*+]\s/, '').replace(/^\s*\d+\.\s/, '');
}

// Helper function to handle quote toggle
function handleQuoteToggle(markdownTextarea, selectedText, start, end) {
    const textBefore = markdownTextarea.value.substring(0, start);
    const textAfter = markdownTextarea.value.substring(end);

    // If no text is selected, work with the current line
    if (!selectedText) {
        // Find the current line
        const allText = textBefore + textAfter;
        const lines = allText.split('\n');
        const currentLineIndex = textBefore.split('\n').length - 1;
        const currentLine = lines[currentLineIndex] || '';

        if (isLineQuoted(currentLine)) {
            // Remove quote from current line
            const newLine = removeQuoteFromLine(currentLine);
            lines[currentLineIndex] = newLine;
            const newText = lines.join('\n');
            // Calculate cursor position after removal
            const removedChars = currentLine.length - newLine.length;
            const cursorPos = Math.max(start - removedChars, textBefore.split('\n').slice(0, currentLineIndex).join('\n').length + (currentLineIndex > 0 ? 1 : 0));
            return { text: newText, cursorPos };
        } else {
            // Add quote to current line
            const newLine = addQuoteToLine(currentLine);
            lines[currentLineIndex] = newLine;
            const newText = lines.join('\n');
            // Calculate cursor position after adding
            const addedChars = newLine.length - currentLine.length;
            const cursorPos = start + addedChars;
            return { text: newText, cursorPos };
        }
    } else {
        // Work with selected text - split into lines
        const selectedLines = selectedText.split('\n');
        const allQuoted = selectedLines.every(line => isLineQuoted(line));

        let processedLines;
        let cursorPos;
        if (allQuoted) {
            // Remove quotes from all lines
            processedLines = selectedLines.map(line => removeQuoteFromLine(line));
            const newSelectedText = processedLines.join('\n');
            cursorPos = start + newSelectedText.length;
        } else {
            // Add quotes to all lines
            processedLines = selectedLines.map(line => addQuoteToLine(line));
            const newSelectedText = processedLines.join('\n');
            cursorPos = start + newSelectedText.length;
        }

        return { text: textBefore + processedLines.join('\n') + textAfter, cursorPos };
    }
}

// Helper function to handle list toggle
function handleListToggle(markdownTextarea, selectedText, start, end, listPrefix) {
    const textBefore = markdownTextarea.value.substring(0, start);
    const textAfter = markdownTextarea.value.substring(end);

    // If no text is selected, work with the current line
    if (!selectedText) {
        // Find the current line
        const allText = textBefore + textAfter;
        const lines = allText.split('\n');
        const currentLineIndex = textBefore.split('\n').length - 1;
        const currentLine = lines[currentLineIndex] || '';

        if (isLineListItem(currentLine)) {
            // Remove list formatting from current line
            const newLine = removeListFromLine(currentLine);
            lines[currentLineIndex] = newLine;
            const newText = lines.join('\n');
            // Calculate cursor position after removal
            const removedChars = currentLine.length - newLine.length;
            const cursorPos = Math.max(start - removedChars, textBefore.split('\n').slice(0, currentLineIndex).join('\n').length + (currentLineIndex > 0 ? 1 : 0));
            return { text: newText, cursorPos };
        } else {
            // Add list formatting to current line
            const newLine = `${listPrefix}${currentLine}`;
            lines[currentLineIndex] = newLine;
            const newText = lines.join('\n');
            // Calculate cursor position after adding
            const addedChars = listPrefix.length;
            const cursorPos = start + addedChars;
            return { text: newText, cursorPos };
        }
    } else {
        // Work with selected text - split into lines
        const selectedLines = selectedText.split('\n');
        const allListItems = selectedLines.every(line => isLineListItem(line));

        let processedLines;
        let cursorPos;
        if (allListItems) {
            // Remove list formatting from all lines
            processedLines = selectedLines.map(line => removeListFromLine(line));
            const newSelectedText = processedLines.join('\n');
            cursorPos = start + newSelectedText.length;
        } else {
            // Add list formatting to all lines
            processedLines = selectedLines.map(line => `${listPrefix}${line}`);
            const newSelectedText = processedLines.join('\n');
            cursorPos = start + newSelectedText.length;
        }

        return { text: textBefore + processedLines.join('\n') + textAfter, cursorPos };
    }
}

// Apply markdown formatting
function applyMarkdownFormatting(action) {
    if (!markdownTextarea) return;

    const start = markdownTextarea.selectionStart;
    const end = markdownTextarea.selectionEnd;
    const selectedText = markdownTextarea.value.substring(start, end);
    const beforeText = markdownTextarea.value.substring(0, start);
    const afterText = markdownTextarea.value.substring(end);

    let replacement = '';
    let cursorOffset = 0;

    switch (action) {
        case 'bold':
            replacement = `**${selectedText || 'bold text'}**`;
            cursorOffset = selectedText ? 0 : -2;
            break;
        case 'italic':
            replacement = `*${selectedText || 'italic text'}*`;
            cursorOffset = selectedText ? 0 : -1;
            break;
        case 'code':
            replacement = `\`${selectedText || 'code'}\``;
            cursorOffset = selectedText ? 0 : -1;
            break;
        case 'h1':
            replacement = `# ${selectedText || 'Heading 1'}`;
            cursorOffset = selectedText ? 0 : 0;
            break;
        case 'h2':
            replacement = `## ${selectedText || 'Heading 2'}`;
            cursorOffset = selectedText ? 0 : 0;
            break;
        case 'h3':
            replacement = `### ${selectedText || 'Heading 3'}`;
            cursorOffset = selectedText ? 0 : 0;
            break;
        case 'list': {
            const result = handleListToggle(markdownTextarea, selectedText, start, end, '- ');
            markdownTextarea.value = result.text;
            markdownTextarea.setSelectionRange(result.cursorPos, result.cursorPos);
            markdownTextarea.focus();
            updateCharacterCount();
            return;
        }
        case 'quote': {
            const result = handleQuoteToggle(markdownTextarea, selectedText, start, end);
            markdownTextarea.value = result.text;
            markdownTextarea.setSelectionRange(result.cursorPos, result.cursorPos);
            markdownTextarea.focus();
            updateCharacterCount();
            return;
        }
        case 'link':
            replacement = `[${selectedText || 'link text'}](url)`;
            cursorOffset = selectedText ? -5 : -4;
            break;
        case 'image':
            replacement = `![${selectedText || 'alt text'}](image-url)`;
            cursorOffset = selectedText ? -12 : -11;
            break;
        case 'attachment':
            // Trigger file input for attachments
            const attachmentFileInput = document.getElementById('attachmentFileInput');
            if (attachmentFileInput) {
                attachmentFileInput.click();
            } else {
                // If attachments section not loaded, scroll to it or show message
                const attachmentsContainer = document.getElementById('attachmentsContainer');
                if (attachmentsContainer) {
                    attachmentsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
            return; // Don't modify text for attachment action
    }

    markdownTextarea.value = beforeText + replacement + afterText;
    
    // Set cursor position
    const newCursorPos = start + replacement.length + cursorOffset;
    markdownTextarea.setSelectionRange(newCursorPos, newCursorPos);
    markdownTextarea.focus();
    
    updateCharacterCount();
}

// Toggle edit/preview mode
function toggleEditMode(editMode) {
    isEditMode = editMode;
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === (editMode ? 'edit' : 'preview'));
    });

    const markdownEditor = document.getElementById('markdownEditor');
    const markdownPreview = document.getElementById('markdownPreview');
    
    if (editMode) {
        markdownEditor.style.display = 'block';
        markdownPreview.style.display = 'none';
    } else {
        markdownEditor.style.display = 'none';
        markdownPreview.style.display = 'block';
        renderMarkdownPreview();
    }
}

// Render markdown to HTML for preview
function renderMarkdownPreview() {
    const previewContent = document.getElementById('previewContent');
    const markdownText = markdownTextarea?.value || '';

    if (!previewContent) return;

    // Remove YAML frontmatter block
    let cleanMarkdown = markdownText;
    if (markdownText.startsWith('---')) {
        const endIndex = markdownText.indexOf('\n---\n', 3);
        if (endIndex !== -1) {
            cleanMarkdown = markdownText.substring(endIndex + 5);
        }
    }

    // Simple markdown to HTML conversion
    let html = cleanMarkdown
        // Headers
        .replace(/^### (.+$)/gim, '<h3>$1</h3>')
        .replace(/^## (.+$)/gim, '<h2>$1</h2>')
        .replace(/^# (.+$)/gim, '<h1>$1</h1>')
        // Bold and italic
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Code
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // Lists
        .replace(/^- (.+$)/gim, '<li>$1</li>')
        // Quotes
        .replace(/^> (.+$)/gim, '<blockquote style="border-left: 4px solid #8b5cf6; margin: 8px 0; padding: 8px 16px; background: #f8fafc; font-style: italic; color: #475569;">$1</blockquote>')
        // Links
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
        // Line breaks
        .replace(/\n/g, '<br>');
    
    // Wrap list items in ul tags
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    
    // If no content, show placeholder
    if (!markdownText.trim()) {
        html = '<p style="color: #888; font-style: italic;">No description provided...</p>';
    }
    
    previewContent.innerHTML = html;
}

// Update comment character count
function updateCommentCharacterCount() {
    if (newCommentInput && commentCharCount) {
        const count = newCommentInput.value.length;
        commentCharCount.textContent = count;
        
        // Change color based on limit
        if (count > 200) {
            commentCharCount.style.color = '#ef4444';
        } else if (count > 150) {
            commentCharCount.style.color = '#f59e0b';
        } else {
            commentCharCount.style.color = '#9E9E9E';
        }
    }
}

// Setup image drop zone
function setupImageDropZone() {
    if (!imageDropZone || !imageInput) return;

    // Click to select file
    imageDropZone.addEventListener('click', function() {
        imageInput.click();
    });

    // Handle file selection
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            handleImageFile(file);
        }
    });

    // Drag and drop functionality
    imageDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        imageDropZone.classList.add('dragover');
    });

    imageDropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        imageDropZone.classList.remove('dragover');
    });

    imageDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        imageDropZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            handleImageFile(files[0]);
        }
    });
}

// Handle image file
async function handleImageFile(file) {
    console.log('Image file selected:', file.name);

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        alert('Invalid file type. Please upload PNG, JPG, GIF, or WebP images.');
        return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        alert('File is too large. Maximum size is 5MB.');
        return;
    }

    // Show loading indicator
    if (imageDropZone) {
        imageDropZone.innerHTML = '<p>Uploading...</p>';
    }

    try {
        // Get project and task IDs
        const projectId = localStorage.getItem('activeProject') || currentProject;
        const taskId = currentTask?.id || taskIdDisplay?.value;

        if (!projectId || !taskId) {
            throw new Error('Missing project or task ID');
        }

        // Create FormData
        const formData = new FormData();
        formData.append('image', file);

        // Upload image
        const apiClient = window.firaAPIClient || window.apiClient;
        if (!apiClient) {
            throw new Error('API client not available');
        }
        const response = await apiClient.uploadImage(projectId, taskId, formData);

        if (response.success) {
            // Add to gallery if available
            if (window.imageGallery) {
                window.imageGallery.addImage({
                    id: response.image_id,
                    filename: response.filename,
                    original_name: file.name,
                    url: response.url,
                    thumbnail_url: response.thumbnail_url,
                    size: file.size,
                    uploaded_at: new Date().toISOString()
                });
            }

            // Insert markdown link into textarea
            const imageMarkdown = `![${file.name}](${response.url})`;
            insertMarkdownAtCursor(imageMarkdown);

            console.log('✅ Image uploaded successfully');
        } else {
            throw new Error(response.error || 'Upload failed');
        }
    } catch (error) {
        console.error('❌ Image upload error:', error);
        alert(`Failed to upload image: ${error.message}`);
    } finally {
        // Reset drop zone
        if (imageDropZone) {
            imageDropZone.innerHTML = '<p>Drop an image here or click to select</p>';
        }
    }
}

// Helper: Insert markdown at cursor position
function insertMarkdownAtCursor(markdown) {
    if (!markdownTextarea) return;

    const start = markdownTextarea.selectionStart;
    const end = markdownTextarea.selectionEnd;
    const text = markdownTextarea.value;

    markdownTextarea.value = text.substring(0, start) + markdown + text.substring(end);
    markdownTextarea.selectionStart = markdownTextarea.selectionEnd = start + markdown.length;
    markdownTextarea.focus();

    // Update character count if function exists
    if (typeof updateCharacterCount === 'function') {
        updateCharacterCount();
    }
}

// Update assignee dropdown options from developers list
function updateAssigneeDropdown() {
    if (!assigneeDropdown) return;

    // Clear existing options
    assigneeDropdown.innerHTML = '';

    // Add "Unassigned" option
    const unassignedOption = document.createElement('div');
    unassignedOption.className = 'dropdown-option';
    unassignedOption.textContent = 'Unassigned';
    assigneeDropdown.appendChild(unassignedOption);

    // Add developers from global developers array
    if (window.developers && Array.isArray(window.developers)) {
        window.developers.forEach(dev => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.textContent = dev;
            assigneeDropdown.appendChild(option);
        });
    }
}

// Setup assignee selector
function setupAssigneeSelector() {
    if (!assigneeSelector || !assigneeDropdown) return;

    const assigneeBadge = assigneeSelector.querySelector('.assignee-badge');

    // Update dropdown options initially
    updateAssigneeDropdown();

    assigneeBadge.addEventListener('click', function(e) {
        e.stopPropagation();
        // Update dropdown options before showing
        updateAssigneeDropdown();
        assigneeDropdown.classList.toggle('active');
    });

    // Handle dropdown option selection
    assigneeDropdown.addEventListener('click', function(e) {
        if (e.target.classList.contains('dropdown-option')) {
            assigneeBadge.textContent = e.target.textContent;
            assigneeDropdown.classList.remove('active');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
        assigneeDropdown.classList.remove('active');
    });
}

// Make function available globally for external updates
window.updateAssigneeDropdown = updateAssigneeDropdown;

// Open task modal
async function openTaskModal(task = null) {
    currentTask = task;

    if (task) {
        // Edit existing task
        populateModalWithTask(task);

        // Load task images if gallery is available
        if (window.imageGallery) {
            const projectId = localStorage.getItem('activeProject') || currentProject;
            const taskId = task.id;

            if (projectId && taskId) {
                try {
                    await window.imageGallery.loadImages(projectId, taskId);
                } catch (error) {
                    console.error('Error loading images:', error);
                }
            }
        }

        // Load task attachments if manager is available
        if (window.AttachmentsManager) {
            const projectId = localStorage.getItem('activeProject') || currentProject;
            const taskId = task.id;

            if (projectId && taskId) {
                const container = document.getElementById('attachmentsContainer');
                if (container) {
                    attachmentsManager = new window.AttachmentsManager(projectId, taskId);
                    try {
                        await attachmentsManager.init(container);
                    } catch (error) {
                        console.error('Error loading attachments:', error);
                    }
                }
            }
        }
    } else {
        // Create new task
        clearModalFields();
        const newTaskId = generateNewTaskId();

        // Clear gallery for new task
        if (window.imageGallery) {
            window.imageGallery.images = [];
            window.imageGallery.renderImages();
        }

        // Initialize attachments manager for new task
        if (window.AttachmentsManager) {
            const projectId = localStorage.getItem('activeProject') || currentProject;

            if (projectId && newTaskId) {
                const container = document.getElementById('attachmentsContainer');
                if (container) {
                    attachmentsManager = new window.AttachmentsManager(projectId, newTaskId);
                    try {
                        // Initialize with empty attachments list
                        attachmentsManager.container = container;
                        attachmentsManager.attachments = [];
                        attachmentsManager.render();
                        attachmentsManager.setupEventListeners();
                    } catch (error) {
                        console.error('Error initializing attachments for new task:', error);
                    }
                }
            }
        }
    }

    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Set preview mode as default
    toggleEditMode(false);

    // Focus on task name input
    setTimeout(() => {
        if (taskNameInput) taskNameInput.focus();
    }, 300);
}

// Close task modal
function closeTaskModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';

    // Clear attachments manager
    attachmentsManager = null;
    
    // Clear form after animation
    setTimeout(() => {
        clearModalFields();
        currentTask = null;
        
        // Refresh kanban board to show updated task status after closing modal
        if (typeof renderBoard === 'function') {
            console.log('🔄 Refreshing kanban board after closing task modal');
            renderBoard();
        }
    }, 300);
}

// Populate modal with task data
function populateModalWithTask(task) {
    // Set task ID (just the ID part, not the full filename)
    if (taskIdDisplay) taskIdDisplay.value = task.id || 'NEW-TASK';
    
    // Set task title (parsed title from filename or frontmatter)
    if (taskNameInput) taskNameInput.value = task.title || '';
    
    // Set full description/content
    if (markdownTextarea) {
        markdownTextarea.value = task.content || task.description || '';
    }
    
    // Set assignee
    const assigneeBadge = document.querySelector('.assignee-badge');
    if (assigneeBadge) {
        assigneeBadge.textContent = task.assignee || 'Unassigned';
    }
    
    // Set type
    if (typeSelector) {
        typeSelector.value = task.type || 'task';
    }
    
    // Set estimate
    const estimateInput = document.querySelector('.estimate-input');
    if (estimateInput) {
        estimateInput.value = task.estimate || '4h';
    }
    
    // Update progress bar
    updateTimeTracking(task.spent || '0h', task.estimate || '4h');
    
    // Set dates
    const createdBadge = document.querySelector('.detail-group:nth-child(5) .date-badge');
    const updatedBadge = document.querySelector('.detail-group:nth-child(6) .date-badge');
    
    if (createdBadge) createdBadge.textContent = task.created || new Date().toLocaleDateString();
    if (updatedBadge) updatedBadge.textContent = task.updated || new Date().toLocaleDateString();
}

// Clear modal fields
function clearModalFields() {
    if (taskIdDisplay) taskIdDisplay.value = 'NEW-TASK';
    if (taskNameInput) taskNameInput.value = '';
    if (markdownTextarea) {
        markdownTextarea.value = '';
    }
    if (newCommentInput) {
        newCommentInput.value = '';
        updateCommentCharacterCount();
    }
    
    // Reset assignee
    const assigneeBadge = document.querySelector('.assignee-badge');
    if (assigneeBadge) assigneeBadge.textContent = 'Unassigned';
    
    // Reset type
    if (typeSelector) typeSelector.value = 'task';
    
    // Reset estimate
    const estimateInput = document.querySelector('.estimate-input');
    if (estimateInput) estimateInput.value = '4h';
    
    updateTimeTracking('0h', '4h');
}

// Clean markdown from inline HTML styles
function cleanMarkdownFromInlineStyles(markdown) {
    if (!markdown) return markdown;

    // Remove inline styles from markdown images
    // Pattern: ![alt](url) style="..."
    // or: <img src="..." style="...">

    // Clean HTML img tags with inline styles
    markdown = markdown.replace(/<img([^>]*?)style="[^"]*"([^>]*?)>/gi, '<img$1$2>');
    markdown = markdown.replace(/<img([^>]*)>/gi, (match) => {
        // Extract src and alt from HTML img tag
        const srcMatch = match.match(/src=["']([^"']+)["']/);
        const altMatch = match.match(/alt=["']([^"']+)["']/);

        if (srcMatch) {
            const src = srcMatch[1];
            const alt = altMatch ? altMatch[1] : '';
            // Convert to clean markdown
            return `![${alt}](${src})`;
        }
        return match;
    });

    // Remove any standalone style attributes that might have leaked
    markdown = markdown.replace(/\s+style="[^"]*"/gi, '');

    // Clean up any extra whitespace
    markdown = markdown.trim();

    return markdown;
}

// Generate new task ID
function generateNewTaskId() {
    const prefix = 'TSK';
    const timestamp = Date.now().toString().slice(-4);
    const randomNum = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const newId = `${prefix}-${timestamp}${randomNum}`;

    if (taskIdDisplay) taskIdDisplay.value = newId;
    return newId;
}

// Update time tracking display
function updateTimeTracking(spent, estimate) {
    const progressFill = document.querySelector('.progress-fill');
    const timeSpentElement = document.querySelector('.time-spent');
    const timeRemainingElement = document.querySelector('.time-remaining');
    
    if (!progressFill || !timeSpentElement || !timeRemainingElement) return;
    
    // Parse hours
    const spentHours = parseInt(spent.replace('h', '')) || 0;
    const estimateHours = parseInt(estimate.replace('h', '')) || 1;
    
    const percentage = Math.min((spentHours / estimateHours) * 100, 100);
    const remainingHours = Math.max(estimateHours - spentHours, 0);
    
    progressFill.style.width = `${percentage}%`;
    timeSpentElement.textContent = `${spentHours}h`;
    timeRemainingElement.textContent = `${remainingHours}h remaining`;
}

// Add comment
function addComment() {
    if (!newCommentInput || !commentsList) return;
    
    const commentText = newCommentInput.value.trim();
    if (!commentText) return;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-GB');
    
    const commentHtml = `
        <div class="comment">
            <div class="comment-header">
                <span class="comment-author">You</span>
                <span class="comment-time">${timeStr} | ${dateStr}</span>
            </div>
            <div class="comment-content">${commentText}</div>
        </div>
    `;
    
    commentsList.insertAdjacentHTML('beforeend', commentHtml);
    newCommentInput.value = '';
    updateCommentCharacterCount();
}

// Clear comment input
function clearComment() {
    if (newCommentInput) {
        newCommentInput.value = '';
        updateCommentCharacterCount();
    }
}

// Save task
function saveTask() {
    // Clean markdown from inline styles before saving
    const cleanDescription = cleanMarkdownFromInlineStyles(markdownTextarea?.value || '');

    const taskData = {
        id: taskIdDisplay?.value || 'NEW-TASK',
        title: taskNameInput?.value || '',
        description: cleanDescription,
        assignee: document.querySelector('.assignee-badge')?.textContent || 'Unassigned',
        type: typeSelector?.value || 'task',
        estimate: document.querySelector('.estimate-input')?.value || '4h',
        updated: new Date().toLocaleDateString()
    };

    console.log('Saving task:', taskData);

    // TODO: Implement actual task saving logic
    // This would involve writing to the file system or updating the task data

    alert('Task saved successfully! (Save functionality will be fully implemented later)');
    closeTaskModal();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if modal elements exist
    if (document.getElementById('taskModalOverlay')) {
        initializeTaskModal();
    }
});

// Export functions for global access
window.openTaskModal = openTaskModal;
window.closeTaskModal = closeTaskModal;
window.addComment = addComment;
window.clearComment = clearComment;
window.saveTask = saveTask;