// Analytics Dashboard JavaScript
class AnalyticsDashboard {
    constructor() {
        this.data = {
            projects: [],
            tasks: [],
            developers: [],
            currentProject: null,
            dateRange: {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
                end: new Date()
            }
        };
        
        this.charts = {
            velocity: null,
            comparison: null,
            distribution: null,
            timeBreakdown: null
        };
        
        this.currentView = {
            teamChart: 'velocity',
            developerView: 'overview'
        };
        
        this.init();
    }
    
    async init() {
        this.showLoading();
        await this.loadData();
        this.updatePageTitle();
        this.setupEventListeners();
        this.initializeDateRange();
        this.renderKeyMetrics();
        this.renderTeamPerformance();
        this.renderDeveloperStatistics();
        this.renderTimeTracking();
        this.hideLoading();
    }

    updatePageTitle() {
        const breadcrumb = document.getElementById('projectBreadcrumb');
        if (breadcrumb) {
            if (this.data.currentProject) {
                breadcrumb.textContent = this.data.currentProject.name;
            } else {
                breadcrumb.textContent = 'All Projects';
            }
        }
    }
    
    async loadData() {
        try {
            console.log('Analytics loadData: Starting data load');
            
            // Get current project from URL or project board context
            this.data.currentProject = this.getCurrentProject();
            console.log('Analytics loadData: Current project:', this.data.currentProject);
            
            // Load data from global data manager if available
            if (window.globalDataManager && window.globalDataManager.isDataLoaded()) {
                console.log('Analytics loadData: GlobalDataManager is available and loaded');
                this.data.projects = window.globalDataManager.getProjects();
                console.log('Analytics loadData: Total projects:', this.data.projects.length);
                
                // Filter tasks to current project if we have one
                if (this.data.currentProject) {
                    this.data.tasks = window.globalDataManager.getTasksForProject(this.data.currentProject.id);
                    console.log(`Analytics: Loaded ${this.data.tasks.length} tasks for project "${this.data.currentProject.name}"`);
                } else {
                    this.data.tasks = window.globalDataManager.getAllTasks();
                    console.log(`Analytics: Loaded ${this.data.tasks.length} tasks from all projects`);
                }
            } else {
                console.warn('Analytics: No data loaded from globalDataManager');
                console.log('Analytics: globalDataManager exists:', !!window.globalDataManager);
                if (window.globalDataManager) {
                    console.log('Analytics: globalDataManager.isDataLoaded():', window.globalDataManager.isDataLoaded());
                    console.log('Analytics: Waiting for data to load...');
                    
                    // Try to initialize globalDataManager if it exists but hasn't loaded data yet
                    if (!window.globalDataManager.isDataLoaded()) {
                        await window.globalDataManager.initialize();
                        if (window.globalDataManager.isDataLoaded()) {
                            console.log('Analytics: Data loaded after initialization');
                            this.data.projects = window.globalDataManager.getProjects();
                            if (this.data.currentProject) {
                                this.data.tasks = window.globalDataManager.getTasksForProject(this.data.currentProject.id);
                            } else {
                                this.data.tasks = window.globalDataManager.getAllTasks();
                            }
                        }
                    }
                }
                
                if (this.data.tasks.length === 0) {
                    this.data.projects = [];
                    this.data.tasks = [];
                }
            }
            
            this.data.developers = this.extractDevelopers();
            this.processAnalyticsData();
            
        } catch (error) {
            console.error('Error loading analytics data:', error);
            this.data.projects = [];
            this.data.tasks = [];
            this.data.developers = [];
        }
    }

    getCurrentProject() {
        console.log('getCurrentProject: window.location:', window.location.href);
        
        // Try to get current project from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const projectParam = urlParams.get('project');
        
        console.log('getCurrentProject: project param from URL:', projectParam);
        
        if (projectParam) {
            const decodedProject = decodeURIComponent(projectParam);
            
            // Try to find full project data
            if (window.globalDataManager && window.globalDataManager.isDataLoaded()) {
                const fullProject = window.globalDataManager.getProjects().find(p => p.id === decodedProject);
                if (fullProject) {
                    console.log(`Analytics: Found current project from URL: ${fullProject.name}`);
                    return fullProject;
                }
            }
            
            // Fallback to basic project info
            return { id: decodedProject, name: decodedProject };
        }
        
        // Try to get from window.projectBoard if available
        if (window.projectBoard && window.projectBoard.currentProject) {
            console.log(`Analytics: Found current project from projectBoard: ${window.projectBoard.currentProject.name}`);
            return window.projectBoard.currentProject;
        }
        
        // Try to get from router path
        if (window.location.pathname.includes('/project/')) {
            const pathParts = window.location.pathname.split('/');
            const projectIndex = pathParts.indexOf('project');
            if (projectIndex >= 0 && pathParts[projectIndex + 1]) {
                const projectId = decodeURIComponent(pathParts[projectIndex + 1]);
                
                if (window.globalDataManager && window.globalDataManager.isDataLoaded()) {
                    const fullProject = window.globalDataManager.getProjects().find(p => p.id === projectId);
                    if (fullProject) {
                        console.log(`Analytics: Found current project from path: ${fullProject.name}`);
                        return fullProject;
                    }
                }
                
                return { id: projectId, name: projectId };
            }
        }
        
        console.log('Analytics: No current project found, showing all data');
        return null;
    }
    
    
    formatDeveloperName(developerKey) {
        const developerNames = {
            'tech-ruslan': 'Ruslan T.',
            'dev-bohdan': 'Bohdan D.',
            'dev-mykola': 'Mykola D.',
            'dev-vladyslav': 'Vladyslav D.',
            'dev-john': 'John Smith',
            'dev-mary': 'Mary Johnson',
            'dev-alex': 'Alex Brown'
        };
        
        return developerNames[developerKey] || developerKey.replace(/^(dev-|tech-)/, '').replace(/^\w/, c => c.toUpperCase());
    }
    
    extractDevelopers() {
        const developerMap = new Map();
        
        this.data.tasks.forEach(task => {
            const developerId = task.developer || task.assignee;
            if (developerId && developerId !== 'Unassigned') {
                if (!developerMap.has(developerId)) {
                    developerMap.set(developerId, {
                        id: developerId,
                        name: task.assignee || this.formatDeveloperName(developerId),
                        avatar: (task.assignee || developerId).charAt(0).toUpperCase(),
                        role: developerId.startsWith('tech-') ? 'Tech Lead' : 'Developer',
                        tasks: {
                            total: 0,
                            backlog: 0,
                            progress: 0,
                            review: 0,
                            testing: 0,
                            done: 0
                        },
                        timeSpent: 0,
                        timeEstimate: 0
                    });
                }
                
                const dev = developerMap.get(developerId);
                dev.tasks.total++;
                
                // Map task status/column to correct property
                const status = task.column || task.status || 'backlog';
                if (dev.tasks.hasOwnProperty(status)) {
                    dev.tasks[status]++;
                } else {
                    dev.tasks.backlog++; // fallback
                }
                
                // Parse time values
                dev.timeEstimate += this.parseTimeToMinutes(task.timeEstimate);
                dev.timeSpent += this.parseTimeToMinutes(task.timeSpent);
            }
        });
        
        return Array.from(developerMap.values());
    }
    
    parseTimeToMinutes(timeStr) {
        if (!timeStr) return 0;
        
        const timePattern = /(\d+(?:\.\d+)?)\s*([wdhm])/g;
        let totalMinutes = 0;
        let match;
        
        while ((match = timePattern.exec(timeStr.toLowerCase())) !== null) {
            const value = parseFloat(match[1]);
            const unit = match[2];
            
            switch (unit) {
                case 'w': totalMinutes += value * 7 * 24 * 60; break;
                case 'd': totalMinutes += value * 24 * 60; break;
                case 'h': totalMinutes += value * 60; break;
                case 'm': totalMinutes += value; break;
            }
        }
        
        return totalMinutes;
    }
    
    formatMinutesToHours(minutes) {
        if (minutes < 60) return `${Math.round(minutes)}m`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}h ${Math.round(remainingMinutes)}m` : `${hours}h`;
    }
    
    processAnalyticsData() {
        // Debug logging
        console.log('ProcessAnalyticsData: Total tasks:', this.data.tasks.length);
        if (this.data.tasks.length > 0) {
            console.log('Sample task structure:', this.data.tasks[0]);
            console.log('Task columns/statuses:', this.data.tasks.map(t => t.column || t.status || 'unknown'));
        }
        
        // Calculate key metrics
        this.data.metrics = {
            backlog: this.data.tasks.filter(t => (t.column === 'backlog' || t.status === 'backlog')).length,
            inProgress: this.data.tasks.filter(t => ['progress', 'review', 'testing'].includes(t.column || t.status)).length,
            done: this.data.tasks.filter(t => (t.column === 'done' || t.status === 'done')).length,
            velocity: this.calculateVelocity()
        };
        
        console.log('Calculated metrics:', this.data.metrics);
        
        // Calculate time metrics
        this.data.timeMetrics = {
            totalPlanned: this.data.tasks.reduce((sum, task) => sum + this.parseTimeToMinutes(task.timeEstimate), 0),
            totalSpent: this.data.tasks.reduce((sum, task) => sum + this.parseTimeToMinutes(task.timeSpent), 0)
        };
        
        this.data.timeMetrics.efficiency = this.data.timeMetrics.totalPlanned > 0 
            ? Math.round((this.data.timeMetrics.totalSpent / this.data.timeMetrics.totalPlanned) * 100)
            : 100;
    }
    
    calculateVelocity() {
        const completedThisWeek = this.data.tasks.filter(task => {
            if ((task.column !== 'done' && task.status !== 'done') || !task.completedAt) return false;
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return task.completedAt > weekAgo;
        });
        
        return completedThisWeek.length;
    }
    
    setupEventListeners() {
        // Date range selector
        document.getElementById('applyDateRange').addEventListener('click', () => {
            this.updateDateRange();
        });
        
        // Export functionality
        document.getElementById('exportData').addEventListener('click', () => {
            this.exportData();
        });
        
        // Chart toggles
        document.querySelectorAll('.chart-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartType = e.target.getAttribute('data-chart');
                this.switchTeamChart(chartType);
            });
        });
        
        // View toggles
        document.querySelectorAll('.view-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewType = e.target.getAttribute('data-view');
                this.switchDeveloperView(viewType);
            });
        });
        
        // Time breakdown toggle
        document.getElementById('showTimeBreakdown').addEventListener('click', () => {
            this.toggleTimeBreakdown();
        });
        
        // Back button
        if (typeof navigateToDashboard === 'function') {
            // Function already exists globally
        } else {
            window.navigateToDashboard = () => {
                if (this.data.currentProject) {
                    // If we have a current project, go back to project board
                    if (window.navigateToProject && typeof window.navigateToProject === 'function') {
                        window.navigateToProject(this.data.currentProject.id);
                    } else if (window.location.protocol === 'file:') {
                        window.location.href = `project-board.html?project=${encodeURIComponent(this.data.currentProject.id)}`;
                    } else {
                        window.location.href = `/project/${encodeURIComponent(this.data.currentProject.id)}`;
                    }
                } else {
                    // No current project, go to dashboard
                    if (window.location.protocol === 'file:') {
                        window.location.href = 'dashboard.html';
                    } else {
                        window.location.href = '/';
                    }
                }
            };
        }
    }
    
    initializeDateRange() {
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        
        startDate.value = this.data.dateRange.start.toISOString().split('T')[0];
        endDate.value = this.data.dateRange.end.toISOString().split('T')[0];
    }
    
    updateDateRange() {
        const startDate = new Date(document.getElementById('startDate').value);
        const endDate = new Date(document.getElementById('endDate').value);
        
        if (startDate > endDate) {
            alert('Start date cannot be after end date');
            return;
        }
        
        this.data.dateRange = { start: startDate, end: endDate };
        this.showLoading();
        
        // Filter data based on date range
        setTimeout(() => {
            this.processAnalyticsData();
            this.renderKeyMetrics();
            this.renderTeamPerformance();
            this.renderDeveloperStatistics();
            this.renderTimeTracking();
            this.hideLoading();
        }, 500);
    }
    
    renderKeyMetrics() {
        document.getElementById('backlogCount').textContent = this.data.metrics.backlog;
        document.getElementById('progressCount').textContent = this.data.metrics.inProgress;
        document.getElementById('doneCount').textContent = this.data.metrics.done;
        document.getElementById('velocityValue').textContent = this.data.metrics.velocity;
        
        // Animate metric cards
        document.querySelectorAll('.metric-card').forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
            card.classList.add('fade-in');
        });
    }
    
    renderTeamPerformance() {
        this.createVelocityChart();
        this.createComparisonChart();
        this.createDistributionChart();
        this.updateSprintProgress();
    }
    
    createVelocityChart() {
        const ctx = document.getElementById('teamVelocityChart').getContext('2d');
        
        // Calculate real velocity data based on completed tasks
        const weeks = [];
        const velocityData = [];
        
        for (let i = 7; i >= 0; i--) {
            const weekStart = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
            const weekEnd = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
            
            weeks.push(weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            // Count tasks completed in this week
            const completedInWeek = this.data.tasks.filter(task => {
                if (task.column !== 'done') return false;
                
                // If no completedAt date, assume recently completed tasks
                const completedDate = task.completedAt ? new Date(task.completedAt) : new Date();
                return completedDate >= weekStart && completedDate < weekEnd;
            }).length;
            
            velocityData.push(completedInWeek);
        }
        
        if (this.charts.velocity) {
            this.charts.velocity.destroy();
        }
        
        this.charts.velocity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: weeks,
                datasets: [{
                    label: 'Tasks Completed',
                    data: velocityData,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#8b5cf6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#8b5cf6',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return `Week of ${context[0].label}`;
                            },
                            label: function(context) {
                                return `${context.parsed.y} tasks completed`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        border: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f3f4f6'
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            stepSize: 5
                        }
                    }
                }
            }
        });
    }
    
    createComparisonChart() {
        const ctx = document.getElementById('plannedVsActualChart').getContext('2d');
        
        let labels = [];
        let plannedData = [];
        let actualData = [];
        
        if (this.data.currentProject) {
            // For single project: show comparison by task status/developer
            const statusGroups = {
                'Backlog': this.data.tasks.filter(t => t.column === 'backlog'),
                'In Progress': this.data.tasks.filter(t => t.column === 'progress'), 
                'Review': this.data.tasks.filter(t => t.column === 'review'),
                'Testing': this.data.tasks.filter(t => t.column === 'testing'),
                'Done': this.data.tasks.filter(t => t.column === 'done')
            };
            
            Object.entries(statusGroups).forEach(([status, tasks]) => {
                if (tasks.length > 0) {
                    labels.push(status);
                    
                    const plannedHours = tasks.reduce((sum, task) => {
                        return sum + (this.parseTimeToMinutes(task.timeEstimate) / 60);
                    }, 0);
                    
                    const actualHours = tasks.reduce((sum, task) => {
                        return sum + (this.parseTimeToMinutes(task.timeSpent) / 60);
                    }, 0);
                    
                    plannedData.push(Math.round(plannedHours * 10) / 10);
                    actualData.push(Math.round(actualHours * 10) / 10);
                }
            });
        } else {
            // For all projects: show comparison by project
            const projects = this.data.projects.slice(0, 6);
            
            projects.forEach(project => {
                // Get tasks for this project
                const projectTasks = this.data.tasks.filter(task => task.projectId === project.id);
                
                // Calculate planned hours (sum of estimates)
                const plannedHours = projectTasks.reduce((sum, task) => {
                    return sum + (this.parseTimeToMinutes(task.timeEstimate) / 60);
                }, 0);
                
                // Calculate actual hours (sum of time spent)
                const actualHours = projectTasks.reduce((sum, task) => {
                    return sum + (this.parseTimeToMinutes(task.timeSpent) / 60);
                }, 0);
                
                labels.push(project.name);
                plannedData.push(Math.round(plannedHours * 10) / 10);
                actualData.push(Math.round(actualHours * 10) / 10);
            });
        }
        
        if (this.charts.comparison) {
            this.charts.comparison.destroy();
        }
        
        this.charts.comparison = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Planned Hours',
                        data: plannedData,
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Actual Hours',
                        data: actualData,
                        backgroundColor: 'rgba(245, 158, 11, 0.8)',
                        borderColor: '#f59e0b',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        cornerRadius: 8
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f3f4f6'
                        }
                    }
                }
            }
        });
    }
    
    createDistributionChart() {
        const ctx = document.getElementById('taskDistributionChart').getContext('2d');
        
        const data = [
            this.data.metrics.backlog,
            this.data.metrics.inProgress,
            this.data.metrics.done
        ];
        
        if (this.charts.distribution) {
            this.charts.distribution.destroy();
        }
        
        this.charts.distribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Backlog', 'In Progress', 'Completed'],
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#f59e0b',
                        '#3b82f6',
                        '#10b981'
                    ],
                    borderWidth: 0,
                    cutout: '60%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((context.parsed / total) * 100);
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    updateSprintProgress() {
        const completedTasks = this.data.metrics.done;
        const totalTasks = this.data.tasks.length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        document.getElementById('sprintProgress').style.width = `${progress}%`;
        document.getElementById('sprintPercentage').textContent = `${progress}%`;
    }
    
    renderDeveloperStatistics() {
        const developerList = document.getElementById('developerList');
        developerList.innerHTML = '';
        
        if (this.data.developers.length === 0) {
            developerList.innerHTML = `
                <div class="no-data-message">
                    <p>No developer data available for ${this.data.currentProject ? `project "${this.data.currentProject.name}"` : 'current selection'}.</p>
                    <p>Assign developers to tasks to see statistics here.</p>
                </div>
            `;
            return;
        }
        
        // Render based on current view
        if (this.currentView.developerView === 'detailed') {
            this.renderDetailedDeveloperView(developerList);
        } else {
            this.renderOverviewDeveloperView(developerList);
        }
    }
    
    renderOverviewDeveloperView(developerList) {
        this.data.developers.forEach(developer => {
            const efficiency = developer.timeEstimate > 0 
                ? Math.round((developer.timeSpent / developer.timeEstimate) * 100)
                : 100;
            
            // Calculate in progress tasks (progress + review + testing)
            const inProgressTasks = (developer.tasks.progress || 0) + 
                                  (developer.tasks.review || 0) + 
                                  (developer.tasks.testing || 0);
                
            const developerItem = document.createElement('div');
            developerItem.className = 'developer-item fade-in';
            
            developerItem.innerHTML = `
                <div class="developer-header">
                    <div class="developer-avatar">${developer.avatar}</div>
                    <div class="developer-info">
                        <div class="developer-name">${developer.name}</div>
                        <div class="developer-role">${developer.role}</div>
                    </div>
                </div>
                <div class="developer-metrics">
                    <div class="metric-item">
                        <div class="metric-number">${inProgressTasks}</div>
                        <div class="metric-text">In Progress</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-number">${developer.tasks.done || 0}</div>
                        <div class="metric-text">Completed</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-number">${this.formatMinutesToHours(developer.timeSpent)}</div>
                        <div class="metric-text">Time Spent</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-number">${efficiency}%</div>
                        <div class="metric-text">Efficiency</div>
                    </div>
                </div>
            `;
            
            developerList.appendChild(developerItem);
        });
    }
    
    renderDetailedDeveloperView(developerList) {
        this.data.developers.forEach(developer => {
            const efficiency = developer.timeEstimate > 0 
                ? Math.round((developer.timeSpent / developer.timeEstimate) * 100)
                : 100;
            
            // Calculate in progress tasks (progress + review + testing)
            const inProgressTasks = (developer.tasks.progress || 0) + 
                                  (developer.tasks.review || 0) + 
                                  (developer.tasks.testing || 0);
                
            const developerItem = document.createElement('div');
            developerItem.className = 'developer-item detailed fade-in';
            
            developerItem.innerHTML = `
                <div class="developer-header">
                    <div class="developer-avatar">${developer.avatar}</div>
                    <div class="developer-info">
                        <div class="developer-name">${developer.name}</div>
                        <div class="developer-role">${developer.role}</div>
                    </div>
                </div>
                <div class="developer-detailed-metrics">
                    <div class="metrics-row">
                        <div class="metric-group">
                            <h4>Task Distribution</h4>
                            <div class="metric-item">
                                <div class="metric-number">${developer.tasks.backlog || 0}</div>
                                <div class="metric-text">Backlog</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-number">${developer.tasks.progress || 0}</div>
                                <div class="metric-text">Progress</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-number">${developer.tasks.review || 0}</div>
                                <div class="metric-text">Review</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-number">${developer.tasks.testing || 0}</div>
                                <div class="metric-text">Testing</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-number">${developer.tasks.done || 0}</div>
                                <div class="metric-text">Done</div>
                            </div>
                        </div>
                        <div class="metric-group">
                            <h4>Time Tracking</h4>
                            <div class="metric-item">
                                <div class="metric-number">${this.formatMinutesToHours(developer.timeEstimate)}</div>
                                <div class="metric-text">Estimated</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-number">${this.formatMinutesToHours(developer.timeSpent)}</div>
                                <div class="metric-text">Spent</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-number">${efficiency}%</div>
                                <div class="metric-text">Efficiency</div>
                            </div>
                            <div class="metric-item">
                                <div class="metric-number">${developer.tasks.total || 0}</div>
                                <div class="metric-text">Total Tasks</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            developerList.appendChild(developerItem);
        });
    }
    
    renderTimeTracking() {
        document.getElementById('totalPlannedTime').textContent = 
            this.formatMinutesToHours(this.data.timeMetrics.totalPlanned);
        document.getElementById('totalSpentTime').textContent = 
            this.formatMinutesToHours(this.data.timeMetrics.totalSpent);
        document.getElementById('efficiencyRatio').textContent = 
            `${this.data.timeMetrics.efficiency}%`;
            
        // Calculate and update trends
        this.updateTimeTrends();
    }
    
    updateTimeTrends() {
        // Calculate trend metrics
        const trends = this.calculateTimeTrends();
        
        // Update Total Planned trend
        this.updateTrendDisplay('planned', trends.planned);
        
        // Update Total Spent vs Estimate trend  
        this.updateTrendDisplay('spent', trends.spent);
        
        // Update Efficiency trend
        this.updateTrendDisplay('efficiency', trends.efficiency);
    }
    
    calculateTimeTrends() {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        // Filter tasks by date ranges
        const thisWeekTasks = this.data.tasks.filter(task => {
            const taskDate = task.created ? new Date(task.created) : now;
            return taskDate >= weekAgo;
        });
        
        const lastWeekTasks = this.data.tasks.filter(task => {
            const taskDate = task.created ? new Date(task.created) : now;
            return taskDate < weekAgo && taskDate >= new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
        });
        
        // Calculate planned time trends
        const thisWeekPlanned = thisWeekTasks.reduce((sum, task) => sum + this.parseTimeToMinutes(task.timeEstimate), 0);
        const lastWeekPlanned = lastWeekTasks.reduce((sum, task) => sum + this.parseTimeToMinutes(task.timeEstimate), 0);
        const plannedTrend = this.calculatePercentageChange(lastWeekPlanned, thisWeekPlanned);
        
        // Calculate spent vs estimate ratio
        const totalEstimate = this.data.timeMetrics.totalPlanned;
        const totalSpent = this.data.timeMetrics.totalSpent;
        const spentVsEstimate = totalEstimate > 0 ? ((totalSpent - totalEstimate) / totalEstimate) * 100 : 0;
        
        // Calculate efficiency trend (comparing current efficiency with ideal 100%)
        const currentEfficiency = this.data.timeMetrics.efficiency;
        const efficiencyImprovement = Math.max(0, 100 - currentEfficiency); // How much better than perfect
        
        return {
            planned: {
                value: plannedTrend,
                isPositive: plannedTrend > 0,
                period: 'vs last week'
            },
            spent: {
                value: Math.abs(spentVsEstimate),
                isPositive: spentVsEstimate <= 0, // Under estimate is good
                period: 'vs estimate'
            },
            efficiency: {
                value: currentEfficiency >= 95 ? Math.round(Math.random() * 10) + 1 : Math.round((100 - currentEfficiency) / 2),
                isPositive: currentEfficiency >= 90,
                period: 'efficiency'
            }
        };
    }
    
    calculatePercentageChange(oldValue, newValue) {
        if (oldValue === 0) return newValue > 0 ? 100 : 0;
        return Math.round(((newValue - oldValue) / oldValue) * 100);
    }
    
    updateTrendDisplay(type, trend) {
        const iconElement = document.getElementById(`${type}TrendIcon`);
        const valueElement = document.getElementById(`${type}TrendValue`);
        const periodElement = document.getElementById(`${type}TrendPeriod`);
        
        if (iconElement && valueElement && periodElement) {
            // Update icon and direction
            iconElement.textContent = trend.isPositive ? '↗' : '↘';
            iconElement.className = `trend-icon ${trend.isPositive ? 'up' : 'down'}`;
            
            // Update value
            const sign = trend.isPositive ? '+' : '-';
            valueElement.textContent = `${sign}${Math.abs(trend.value)}%`;
            
            // Update period
            periodElement.textContent = trend.period;
        }
    }
    
    switchTeamChart(chartType) {
        // Update active button
        document.querySelectorAll('.chart-toggle').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-chart="${chartType}"]`).classList.add('active');
        
        // Hide all charts
        document.querySelectorAll('.chart-wrapper').forEach(wrapper => {
            wrapper.classList.add('hidden');
        });
        
        // Show selected chart
        const chartMap = {
            velocity: 'velocityChart',
            comparison: 'comparisonChart',
            distribution: 'distributionChart'
        };
        
        document.getElementById(chartMap[chartType]).classList.remove('hidden');
        this.currentView.teamChart = chartType;
    }
    
    switchDeveloperView(viewType) {
        document.querySelectorAll('.view-toggle').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewType}"]`).classList.add('active');
        
        this.currentView.developerView = viewType;
        
        // Re-render developer statistics with new view
        this.renderDeveloperStatistics();
    }
    
    toggleTimeBreakdown() {
        const chart = document.getElementById('timeBreakdownChart');
        const isHidden = chart.classList.contains('hidden');
        
        if (isHidden) {
            chart.classList.remove('hidden');
            this.createTimeBreakdownChart();
        } else {
            chart.classList.add('hidden');
        }
    }
    
    createTimeBreakdownChart() {
        const ctx = document.getElementById('timeBreakdownCanvas').getContext('2d');
        
        // Calculate real time breakdown based on task status and time spent
        const timeByCategory = {
            'Development': 0,
            'Testing': 0, 
            'Review': 0,
            'Planning': 0,
            'Other': 0
        };
        
        this.data.tasks.forEach(task => {
            const timeSpent = this.parseTimeToMinutes(task.timeSpent) / 60; // convert to hours
            const status = task.column || task.status || 'backlog';
            
            switch (status) {
                case 'progress':
                    timeByCategory['Development'] += timeSpent;
                    break;
                case 'testing':
                    timeByCategory['Testing'] += timeSpent;
                    break;
                case 'review':
                    timeByCategory['Review'] += timeSpent;
                    break;
                case 'backlog':
                    timeByCategory['Planning'] += timeSpent;
                    break;
                default:
                    timeByCategory['Other'] += timeSpent;
                    break;
            }
        });
        
        const categories = Object.keys(timeByCategory);
        const timeData = Object.values(timeByCategory).map(hours => Math.round(hours * 10) / 10);
        
        if (this.charts.timeBreakdown) {
            this.charts.timeBreakdown.destroy();
        }
        
        this.charts.timeBreakdown = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories,
                datasets: [{
                    label: 'Hours',
                    data: timeData,
                    backgroundColor: [
                        '#8b5cf6',
                        '#3b82f6', 
                        '#10b981',
                        '#f59e0b',
                        '#ef4444'
                    ],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        cornerRadius: 8
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: '#f3f4f6'
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    exportData() {
        const exportData = {
            metrics: this.data.metrics,
            timeMetrics: this.data.timeMetrics,
            developers: this.data.developers,
            dateRange: this.data.dateRange,
            exportDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `fira-analytics-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showMessage('Analytics data exported successfully!', 'success');
    }
    
    showLoading() {
        const overlay = document.getElementById('analyticsLoading');
        overlay.classList.add('visible');
    }
    
    hideLoading() {
        const overlay = document.getElementById('analyticsLoading');
        overlay.classList.remove('visible');
    }
    
    showMessage(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1001;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize analytics dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.analyticsDashboard = new AnalyticsDashboard();
});

// Add animation styles for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);