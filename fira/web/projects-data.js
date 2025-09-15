// Static fallback data for web version when server is not available
// This ensures the application works even when backend API is down
window.PROJECTS_DATA = [
    {
        "id": "gbl-commander-kmp",
        "name": "GBL Commander KMP",
        "description": "Cross-platform binary file editor and GBL file management tool with specialized features for iOS development.",
        "path": "gbl-commander-kmp",
        "tasksCount": {
            "backlog": 8,
            "progress": 4,
            "review": 3,
            "testing": 12,
            "done": 25
        },
        "totalTasks": 52,
        "lastModified": "2024-09-04T05:28:00Z",
        "developers": ["tech-ruslan", "dev-bohdan", "dev-mykola", "dev-vladyslav"]
    },
    {
        "id": "android-tasks",
        "name": "Android Tasks",
        "description": "Task management system for Android development projects with folder-based workflow.",
        "path": "tasks",
        "tasksCount": {
            "backlog": 3,
            "progress": 2,
            "review": 1,
            "testing": 4,
            "done": 15
        },
        "totalTasks": 25,
        "lastModified": "2024-09-03T12:15:00Z",
        "developers": ["denys"]
    },
    {
        "id": "fira",
        "name": "Fira Task Management",
        "description": "Web-based task management system with real-time updates and kanban workflow.",
        "path": "fira",
        "tasksCount": {
            "backlog": 5,
            "progress": 1,
            "review": 0,
            "testing": 2,
            "done": 8
        },
        "totalTasks": 16,
        "lastModified": "2024-09-04T03:45:00Z",
        "developers": ["None"]
    }
];

console.log('📊 Static fallback data loaded for web version (server unavailable mode)');