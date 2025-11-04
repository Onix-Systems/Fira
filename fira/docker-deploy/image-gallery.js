/**
 * Image Gallery Component for Fira
 * Handles image preview, lightbox, and horizontal carousel
 */

class ImageGallery {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.images = [];
        this.currentIndex = 0;
        this.lightboxOpen = false;
        this.currentCarouselIndex = 0;

        // Zoom/pan state
        this.zoom = 1;
        this.minZoom = 1;
        this.maxZoom = 5;
        this.zoomStep = 0.5;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;

        if (this.container) {
            this.initGallery();
        }
    }

    /**
     * Initialize gallery structure
     */
    initGallery() {
        this.container.innerHTML = `
            <div class="image-gallery">
                <div class="image-preview-container">
                    <!-- Images will be rendered here -->
                </div>
            </div>

            <!-- Lightbox Modal -->
            <div class="image-lightbox" id="imageLightbox">
                <button class="lightbox-close" onclick="window.imageGallery.closeLightbox()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2"/>
                    </svg>
                </button>

                <button class="lightbox-prev" onclick="window.imageGallery.prevImage()">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                        <path d="M15 18L9 12L15 6" stroke="white" stroke-width="2"/>
                    </svg>
                </button>

                <div class="lightbox-content">
                    <img id="lightboxImage" src="" alt="">
                    <div class="lightbox-counter">
                        <span id="lightboxCounter">1 / 1</span>
                    </div>

                    <!-- Zoom Controls -->
                    <div class="lightbox-zoom-controls">
                        <button class="zoom-btn" onclick="window.imageGallery.zoomOut()" title="Zoom Out (-)">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                <path d="M19 13H5v-2h14v2z"/>
                            </svg>
                        </button>
                        <span class="zoom-level" id="zoomLevel">100%</span>
                        <button class="zoom-btn" onclick="window.imageGallery.zoomIn()" title="Zoom In (+)">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                        </button>
                        <button class="zoom-btn" onclick="window.imageGallery.resetZoom()" title="Reset Zoom (0)">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <button class="lightbox-next" onclick="window.imageGallery.nextImage()">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                        <path d="M9 6L15 12L9 18" stroke="white" stroke-width="2"/>
                    </svg>
                </button>
            </div>
        `;

        this.previewContainer = this.container.querySelector('.image-preview-container');
        this.lightbox = document.getElementById('imageLightbox');
        this.lightboxImage = document.getElementById('lightboxImage');
        this.lightboxCounter = document.getElementById('lightboxCounter');

        this.setupKeyboardNavigation();
    }

    /**
     * Load images from task
     */
    async loadImages(projectId, taskId) {
        try {
            console.log(`📥 Loading images for task: ${projectId}/${taskId}`);

            const response = await window.apiClient.getTaskImages(projectId, taskId);

            if (response.success && response.images) {
                this.images = response.images;
                console.log(`✅ Loaded ${this.images.length} images`);
                this.renderImages();
            } else {
                this.images = [];
                this.renderImages();
            }
        } catch (error) {
            console.error('❌ Error loading images:', error);
            this.images = [];
            this.renderImages();
        }
    }

    /**
     * Add new image to gallery
     */
    addImage(imageData) {
        this.images.push(imageData);
        this.renderImages();
    }

    /**
     * Render images based on count
     */
    renderImages() {
        if (!this.previewContainer) return;

        if (this.images.length === 0) {
            this.previewContainer.innerHTML = '<p class="no-images">No images attached</p>';
            return;
        }

        if (this.images.length === 1) {
            // Single image - simple preview
            this.renderSingleImage();
        } else {
            // Multiple images - horizontal carousel
            this.renderCarousel();
        }
    }

    /**
     * Render single image with delete button
     */
    renderSingleImage() {
        const image = this.images[0];

        this.previewContainer.innerHTML = `
            <div class="image-single">
                <div class="image-wrapper">
                    <img src="${image.thumbnail_url || image.url}"
                         alt="${image.description || image.original_name || ''}"
                         onclick="window.imageGallery.openLightbox(0)"
                         class="image-thumbnail">
                    <button class="image-delete"
                            onclick="window.imageGallery.deleteImage(0, event)"
                            title="Delete image">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2"/>
                        </svg>
                    </button>
                    <button class="image-zoom"
                            onclick="window.imageGallery.openLightbox(0)"
                            title="View full size">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="white" stroke-width="2"/>
                        </svg>
                    </button>
                </div>
                <p class="image-name">${image.original_name || image.filename || ''}</p>
            </div>
        `;
    }

    /**
     * Render carousel for multiple images
     */
    renderCarousel() {
        const imagesHTML = this.images.map((image, index) => `
            <div class="carousel-item ${index === 0 ? 'active' : ''}">
                <div class="image-wrapper">
                    <img src="${image.thumbnail_url || image.url}"
                         alt="${image.description || image.original_name || ''}"
                         onclick="window.imageGallery.openLightbox(${index})"
                         class="image-thumbnail">
                    <button class="image-delete"
                            onclick="window.imageGallery.deleteImage(${index}, event)"
                            title="Delete image">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2"/>
                        </svg>
                    </button>
                    <button class="image-zoom"
                            onclick="window.imageGallery.openLightbox(${index})"
                            title="View full size">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="white" stroke-width="2"/>
                        </svg>
                    </button>
                </div>
                <p class="image-name">${image.original_name || image.filename || ''}</p>
            </div>
        `).join('');

        this.previewContainer.innerHTML = `
            <div class="image-carousel">
                <button class="carousel-prev" onclick="window.imageGallery.carouselPrev()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </button>

                <div class="carousel-track-container">
                    <div class="carousel-track">
                        ${imagesHTML}
                    </div>
                </div>

                <button class="carousel-next" onclick="window.imageGallery.carouselNext()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </button>

                <div class="carousel-dots">
                    ${this.images.map((_, i) => `
                        <span class="carousel-dot ${i === 0 ? 'active' : ''}"
                              onclick="window.imageGallery.goToSlide(${i})"></span>
                    `).join('')}
                </div>
            </div>
        `;

        this.currentCarouselIndex = 0;
    }

    /**
     * Carousel navigation - Next
     */
    carouselNext() {
        const track = this.previewContainer.querySelector('.carousel-track');
        const items = track.querySelectorAll('.carousel-item');
        const dots = this.previewContainer.querySelectorAll('.carousel-dot');

        this.currentCarouselIndex = (this.currentCarouselIndex + 1) % items.length;

        items.forEach((item, i) => {
            item.classList.toggle('active', i === this.currentCarouselIndex);
        });

        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentCarouselIndex);
        });

        track.style.transform = `translateX(-${this.currentCarouselIndex * 100}%)`;
    }

    /**
     * Carousel navigation - Previous
     */
    carouselPrev() {
        const track = this.previewContainer.querySelector('.carousel-track');
        const items = track.querySelectorAll('.carousel-item');
        const dots = this.previewContainer.querySelectorAll('.carousel-dot');

        this.currentCarouselIndex = this.currentCarouselIndex === 0
            ? items.length - 1
            : this.currentCarouselIndex - 1;

        items.forEach((item, i) => {
            item.classList.toggle('active', i === this.currentCarouselIndex);
        });

        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentCarouselIndex);
        });

        track.style.transform = `translateX(-${this.currentCarouselIndex * 100}%)`;
    }

    /**
     * Go to specific slide
     */
    goToSlide(index) {
        const track = this.previewContainer.querySelector('.carousel-track');
        const items = track.querySelectorAll('.carousel-item');
        const dots = this.previewContainer.querySelectorAll('.carousel-dot');

        this.currentCarouselIndex = index;

        items.forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });

        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });

        track.style.transform = `translateX(-${index * 100}%)`;
    }

    /**
     * Delete image
     */
    async deleteImage(index, event) {
        event?.stopPropagation();

        if (!confirm('Are you sure you want to delete this image?')) {
            return;
        }

        const image = this.images[index];

        // Get project and task IDs from current context
        const projectId = localStorage.getItem('activeProject') || currentProject;
        const taskId = currentTask?.id || taskIdDisplay?.value;

        if (!projectId || !taskId) {
            console.error('Missing project or task ID');
            alert('Cannot delete image: Missing project or task information');
            return;
        }

        try {
            await window.apiClient.deleteImage(projectId, taskId, image.filename || image.id);

            // Remove from array and re-render
            this.images.splice(index, 1);
            this.renderImages();

            // Remove from markdown textarea if available
            if (typeof removeImageFromMarkdown === 'function') {
                removeImageFromMarkdown(image.url);
            }

            console.log('✅ Image deleted successfully');

        } catch (error) {
            console.error('❌ Delete error:', error);
            alert('Failed to delete image: ' + error.message);
        }
    }

    /**
     * Open lightbox
     */
    openLightbox(index) {
        if (this.images.length === 0) return;

        this.currentIndex = index;
        this.lightboxOpen = true;

        // Reset zoom when opening
        this.resetZoom();

        this.lightboxImage.src = this.images[index].url;
        this.lightboxCounter.textContent = `${index + 1} / ${this.images.length}`;

        this.lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close lightbox
     */
    closeLightbox() {
        this.lightboxOpen = false;
        this.lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    /**
     * Lightbox navigation - Next
     */
    nextImage() {
        if (this.images.length === 0) return;

        this.currentIndex = (this.currentIndex + 1) % this.images.length;

        // Reset zoom when changing images
        this.resetZoom();

        this.lightboxImage.src = this.images[this.currentIndex].url;
        this.lightboxCounter.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
    }

    /**
     * Lightbox navigation - Previous
     */
    prevImage() {
        if (this.images.length === 0) return;

        this.currentIndex = this.currentIndex === 0
            ? this.images.length - 1
            : this.currentIndex - 1;

        // Reset zoom when changing images
        this.resetZoom();

        this.lightboxImage.src = this.images[this.currentIndex].url;
        this.lightboxCounter.textContent = `${this.currentIndex + 1} / ${this.images.length}`;
    }

    /**
     * Zoom In
     */
    zoomIn() {
        if (this.zoom < this.maxZoom) {
            this.zoom = Math.min(this.zoom + this.zoomStep, this.maxZoom);
            this.applyZoom();
        }
    }

    /**
     * Zoom Out
     */
    zoomOut() {
        if (this.zoom > this.minZoom) {
            this.zoom = Math.max(this.zoom - this.zoomStep, this.minZoom);
            this.applyZoom();
        }
    }

    /**
     * Reset Zoom
     */
    resetZoom() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.applyZoom();
    }

    /**
     * Apply zoom and pan transformations
     */
    applyZoom() {
        if (!this.lightboxImage) return;

        this.lightboxImage.style.transform = `scale(${this.zoom}) translate(${this.panX}px, ${this.panY}px)`;
        this.lightboxImage.style.cursor = this.zoom > 1 ? 'grab' : 'default';

        // Update zoom level display
        const zoomLevel = document.getElementById('zoomLevel');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    }

    /**
     * Setup mouse wheel zoom
     */
    setupMouseWheel() {
        if (!this.lightbox) return;

        this.lightbox.addEventListener('wheel', (e) => {
            if (!this.lightboxOpen) return;

            e.preventDefault();

            if (e.deltaY < 0) {
                this.zoomIn();
            } else {
                this.zoomOut();
            }
        }, { passive: false });
    }

    /**
     * Setup pan/drag functionality
     */
    setupPanDrag() {
        if (!this.lightboxImage) return;

        this.lightboxImage.addEventListener('mousedown', (e) => {
            if (this.zoom <= 1) return;

            this.isPanning = true;
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;
            this.lightboxImage.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;

            this.panX = e.clientX - this.startX;
            this.panY = e.clientY - this.startY;
            this.applyZoom();
        });

        document.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                if (this.zoom > 1) {
                    this.lightboxImage.style.cursor = 'grab';
                }
            }
        });
    }

    /**
     * Setup touch gestures (pinch-to-zoom, double-tap)
     */
    setupTouchGestures() {
        if (!this.lightboxImage) return;

        let touchStartDistance = 0;
        let touchStartZoom = 1;
        let lastTap = 0;

        this.lightboxImage.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Pinch zoom
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                touchStartDistance = Math.hypot(
                    touch1.clientX - touch2.clientX,
                    touch1.clientY - touch2.clientY
                );
                touchStartZoom = this.zoom;
            } else if (e.touches.length === 1) {
                // Double tap detection
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;

                if (tapLength < 300 && tapLength > 0) {
                    // Double tap detected
                    e.preventDefault();
                    if (this.zoom === 1) {
                        this.zoom = 2;
                    } else {
                        this.resetZoom();
                    }
                    this.applyZoom();
                }
                lastTap = currentTime;
            }
        }, { passive: false });

        this.lightboxImage.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const touchDistance = Math.hypot(
                    touch1.clientX - touch2.clientX,
                    touch1.clientY - touch2.clientY
                );

                const scale = touchDistance / touchStartDistance;
                this.zoom = Math.max(this.minZoom, Math.min(touchStartZoom * scale, this.maxZoom));
                this.applyZoom();
            }
        }, { passive: false });
    }

    /**
     * Keyboard navigation
     */
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (!this.lightboxOpen) return;

            switch(e.key) {
                case 'Escape':
                    this.closeLightbox();
                    break;
                case 'ArrowLeft':
                    this.prevImage();
                    break;
                case 'ArrowRight':
                    this.nextImage();
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    this.zoomIn();
                    break;
                case '-':
                case '_':
                    e.preventDefault();
                    this.zoomOut();
                    break;
                case '0':
                    e.preventDefault();
                    this.resetZoom();
                    break;
            }
        });

        // Setup after lightbox elements are created
        this.setupMouseWheel();
        this.setupPanDrag();
        this.setupTouchGestures();
    }
}

/**
 * Helper function to remove image markdown from textarea
 */
function removeImageFromMarkdown(imageUrl) {
    const textarea = document.getElementById('markdownTextarea');
    if (!textarea) return;

    // Escape special regex characters in URL
    const escapedUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const markdownPattern = new RegExp(`!\\[.*?\\]\\(${escapedUrl}\\)`, 'g');

    textarea.value = textarea.value.replace(markdownPattern, '');

    // Trigger character count update if available
    if (typeof updateCharacterCount === 'function') {
        updateCharacterCount();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('imageGalleryContainer')) {
        window.imageGallery = new ImageGallery('imageGalleryContainer');
    }
});
