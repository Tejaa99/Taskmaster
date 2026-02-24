// frontend/js/tasks.js

// ==================== GLOBAL VARIABLES ====================
let taskToDelete = null;
let currentShareTaskId = null;
let currentDate = new Date();
let calendarTasks = [];
let dependentTasks = {};
let recognition = null;
let searchTimeout;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Tasks.js loaded');
    
    if (window.location.pathname.includes('dashboard.html')) {
        console.log('📡 Initializing dashboard...');
        
        loadUserInfo();
        loadTasks();
        setupEventListeners();
        loadDependencies();
        initSmartSearch();
        initKeyboardShortcuts();
        initOfflineSupport();
        initVoiceInput();
        addVoiceButton();
        initCalendar();
        initAnalytics();
    }
});

// ==================== USER INFO ====================
function loadUserInfo() {
    const userData = getUserData();
    if (userData && userData.name) {
        const displayElement = document.getElementById('userDisplayName');
        if (displayElement) {
            displayElement.textContent = userData.name;
        }
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeTaskModal();
            closeDeleteModal();
            closeShareModal();
        }
    });
    
    document.addEventListener('click', function(e) {
        const container = document.getElementById('searchSuggestions');
        if (container && !e.target.closest('.search-container')) {
            container.style.display = 'none';
        }
    });
}

// ==================== SECTION NAVIGATION ====================
function showSection(section, event) {
    if (event) {
        event.preventDefault();
    }
    
    console.log('📂 Showing section:', section);
    
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.classList.remove('active');
    });
    
    if (event && event.target) {
        const clickedLink = event.target.closest('a');
        if (clickedLink) {
            clickedLink.classList.add('active');
        }
    }
    
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
    });
    
    const sectionElement = document.getElementById(`${section}-section`);
    if (sectionElement) {
        sectionElement.classList.add('active');
    }
    
    if (section === 'tasks') {
        loadTasks();
    } else if (section === 'profile') {
        loadProfile();
    } else if (section === 'shared') {
        loadSharedTasks();
    } else if (section === 'activity') {
        loadActivityLog();
    } else if (section === 'analytics') {
        loadAnalytics();
    } else if (section === 'calendar') {
        renderCalendar();
    }
}

// ==================== TASK MANAGEMENT ====================

// Load tasks from backend
// Load tasks from backend - SIMPLIFIED VERSION
async function loadTasks() {
    console.log('📥 Loading tasks...');
    
    const container = document.getElementById('tasksContainer');
    if (container) {
        container.innerHTML = '<div class="loading">Loading tasks...</div>';
    }
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }
        
        const response = await apiRequest('/tasks');
        console.log('📦 Tasks response:', response);
        
        if (response && response.success) {
            const tasks = response.tasks || [];
            console.log(`✅ Loaded ${tasks.length} tasks`);
            
            localStorage.setItem('tasks', JSON.stringify(tasks));
            
            // Update UI - with null checks
            const totalElement = document.getElementById('totalTasks');
            if (totalElement) totalElement.textContent = tasks.length;
            
            const pendingElement = document.getElementById('pendingTasks');
            if (pendingElement) pendingElement.textContent = tasks.filter(t => t.status === 'pending').length;
            
            const inProgressElement = document.getElementById('inProgressTasks');
            if (inProgressElement) inProgressElement.textContent = tasks.filter(t => t.status === 'in-progress').length;
            
            const completedElement = document.getElementById('completedTasks');
            if (completedElement) completedElement.textContent = tasks.filter(t => t.status === 'completed').length;
            
            // Display tasks
            displayTasks(tasks);
            
            // Display recent tasks
            displayRecentTasks(tasks.slice(0, 5));
            
            if (tasks.length > 0) {
                showToast(`📊 Loaded ${tasks.length} tasks`, 'success');
            } else {
                const container = document.getElementById('tasksContainer');
                if (container) {
                    container.innerHTML = '<div class="no-tasks">No tasks found. Click "New Task" to create one!</div>';
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error loading tasks:', error);
        const container = document.getElementById('tasksContainer');
        if (container) {
            container.innerHTML = '<div class="no-tasks">Error loading tasks</div>';
        }
    }
}
// Load tasks from cache
function loadTasksFromCache() {
    console.log('📦 Attempting to load tasks from cache');
    const cachedTasks = localStorage.getItem('tasks');
    
    if (cachedTasks) {
        try {
            const tasks = JSON.parse(cachedTasks);
            console.log(`📦 Loaded ${tasks.length} tasks from cache`);
            
            updateStats(tasks);
            displayRecentTasks(tasks.slice(0, 5));
            displayTasks(tasks);
            calendarTasks = tasks;
            
            showToast('📴 Showing cached tasks (offline mode)', 'info');
        } catch (e) {
            console.error('❌ Error parsing cached tasks:', e);
            showNoTasksMessage();
        }
    } else {
        showNoTasksMessage();
    }
}

function showNoTasksMessage() {
    const container = document.getElementById('tasksContainer');
    if (container) {
        container.innerHTML = '<div class="no-tasks"><i class="fas fa-tasks"></i><p>No tasks found. Click "New Task" to create one!</p></div>';
    }
}

// Update statistics
// Update statistics
function updateStats(tasks) {
    console.log('📊 Updating stats with', tasks.length, 'tasks');
    
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    
    const totalElement = document.getElementById('totalTasks');
    const pendingElement = document.getElementById('pendingTasks');
    const inProgressElement = document.getElementById('inProgressTasks');
    const completedElement = document.getElementById('completedTasks');
    
    // Check if elements exist before updating
    if (totalElement) totalElement.textContent = total;
    if (pendingElement) pendingElement.textContent = pending;
    if (inProgressElement) inProgressElement.textContent = inProgress;
    if (completedElement) completedElement.textContent = completed;
    
    console.log(`📊 Stats - Total: ${total}, Pending: ${pending}, In Progress: ${inProgress}, Completed: ${completed}`);
}

// Display recent tasks
function displayRecentTasks(tasks) {
    const container = document.getElementById('recentTasksList');
    if (!container) return;
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div class="no-tasks">No tasks yet. Create your first task!</div>';
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="task-item">
            <div class="task-info">
                <span class="task-priority ${task.priority || 'medium'}"></span>
                <span class="task-title ${task.status === 'completed' ? 'completed' : ''}">
                    ${task.title || 'Untitled'}
                </span>
            </div>
            <div class="task-due ${isOverdue(task.dueDate) && task.status !== 'completed' ? 'overdue' : ''}">
                <i class="far fa-calendar"></i>
                ${formatDate(task.dueDate) || 'No date'}
            </div>
        </div>
    `).join('');
}

// Display all tasks
function displayTasks(tasks) {
    const container = document.getElementById('tasksContainer');
    if (!container) return;
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div class="no-tasks"><i class="fas fa-tasks"></i><p>No tasks found. Click "New Task" to create one!</p></div>';
        return;
    }
    
    container.innerHTML = tasks.map(task => {
        // Safely access task properties with defaults
        const taskId = task._id || task.id || '';
        const title = task.title || 'Untitled';
        const description = task.description || 'No description provided';
        const priority = task.priority || 'medium';
        const category = task.category || 'general';
        const status = task.status || 'pending';
        const dueDate = task.dueDate || null;
        const attachments = task.attachments || [];
        const comments = task.comments || [];
        
        return `
        <div class="task-card priority-${priority}" data-task-id="${taskId}">
            <div class="task-header">
                <h3>${title}</h3>
                <div class="task-actions">
                    <button class="btn-reminder" onclick="sendTaskReminder('${taskId}')" title="Send Reminder">
                        <i class="fas fa-bell"></i>
                    </button>
                    <button onclick="showShareModal('${taskId}')" title="Share Task">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button onclick="showDependencyManager('${taskId}')" title="Task Dependencies">
                        <i class="fas fa-link"></i>
                    </button>
                    <button onclick="editTask('${taskId}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete" onclick="showDeleteModal('${taskId}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="task-description">${description}</div>
            
            <div class="task-meta">
                <span class="task-category"><i class="fas fa-tag"></i> ${category}</span>
                <span class="task-due-date ${isOverdue(dueDate) && status !== 'completed' ? 'overdue' : ''}">
                    <i class="far fa-calendar"></i> ${formatDate(dueDate)}
                </span>
            </div>
            
            <div class="task-attachments">
                ${attachments.length > 0 ? attachments.map(att => `
                    <div class="attachment-item">
                        <i class="fas fa-paperclip"></i>
                        <a href="http://localhost:5000${att.url}" target="_blank">${att.filename}</a>
                        <button onclick="deleteAttachment('${taskId}', '${att.saved_as}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('') : ''}
                <button class="btn-attachment" onclick="showFilePicker('${taskId}')">
                    <i class="fas fa-paperclip"></i> Attach File
                </button>
            </div>
            
            <div class="task-comments">
                ${comments.length > 0 ? comments.slice(-3).map(comment => `
                    <div class="comment-item">
                        <div class="comment-header">
                            <span class="comment-author">${comment.userName || 'User'}</span>
                            <span class="comment-date">${formatDateTime(comment.timestamp)}</span>
                        </div>
                        <div class="comment-text">${comment.text}</div>
                    </div>
                `).join('') : ''}
                <div class="comment-input-group">
                    <input type="text" id="comment-${taskId}" placeholder="Add a comment..." onkeypress="if(event.key==='Enter') addComment('${taskId}')">
                    <button onclick="addComment('${taskId}')"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
            
            <div class="task-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${getProgressPercentage(status)}%"></div>
                </div>
                <div class="progress-text">${status} ${getStatusBadge(status)}</div>
            </div>
        </div>
    `}).join('');
}

// Get progress percentage
function getProgressPercentage(status) {
    if (status === 'completed') return 100;
    if (status === 'in-progress') return 50;
    return 0;
}

// ==================== TASK CRUD OPERATIONS ====================

function showAddTaskModal() {
    console.log('➕ Showing add task modal');
    document.getElementById('modalTitle').textContent = 'Add New Task';
    document.getElementById('taskForm').reset();
    document.getElementById('taskId').value = '';
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('taskDueDate');
    if (dateInput) {
        dateInput.valueAsDate = tomorrow;
    }
    
    document.getElementById('taskModal').style.display = 'block';
}

function showTemplateSelector() {
    const modal = document.createElement('div');
    modal.className = 'modal template-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h2><i class="fas fa-template"></i> Choose Template</h2>
            <div class="template-grid">
                ${Object.entries(TASK_TEMPLATES).map(([key, template]) => `
                    <div class="template-card" onclick="createFromTemplate('${key}')">
                        <div class="template-icon">
                            <i class="fas ${getTemplateIcon(key)}"></i>
                        </div>
                        <h3>${template.title}</h3>
                        <p>${template.description}</p>
                        <div class="template-meta">
                            <span class="badge ${template.priority}">${template.priority}</span>
                            <span class="badge">${template.category}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="template-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

const TASK_TEMPLATES = {
    'daily': {
        title: 'Daily Standup',
        description: 'Daily team sync meeting',
        category: 'work',
        priority: 'medium',
        status: 'pending'
    },
    'weekly': {
        title: 'Weekly Review',
        description: 'Review weekly progress and plan next week',
        category: 'work',
        priority: 'high',
        status: 'pending'
    },
    'shopping': {
        title: 'Grocery Shopping',
        description: 'Buy groceries for the week',
        category: 'shopping',
        priority: 'medium',
        status: 'pending'
    },
    'exercise': {
        title: 'Workout',
        description: 'Daily exercise routine',
        category: 'health',
        priority: 'high',
        status: 'pending'
    },
    'learning': {
        title: 'Learn New Skill',
        description: 'Spend 1 hour learning',
        category: 'personal',
        priority: 'medium',
        status: 'pending'
    }
};

function getTemplateIcon(key) {
    const icons = {
        'daily': 'fa-users',
        'weekly': 'fa-calendar-week',
        'shopping': 'fa-shopping-cart',
        'exercise': 'fa-dumbbell',
        'learning': 'fa-book'
    };
    return icons[key] || 'fa-task';
}

function createFromTemplate(templateKey) {
    const template = TASK_TEMPLATES[templateKey];
    if (!template) return;
    
    document.getElementById('modalTitle').textContent = 'Create from Template';
    document.getElementById('taskId').value = '';
    document.getElementById('taskTitle').value = template.title;
    document.getElementById('taskDescription').value = template.description;
    document.getElementById('taskPriority').value = template.priority;
    document.getElementById('taskCategory').value = template.category;
    document.getElementById('taskStatus').value = template.status;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateInput = document.getElementById('taskDueDate');
    if (dateInput) {
        dateInput.valueAsDate = tomorrow;
    }
    
    document.querySelector('.template-modal')?.remove();
    document.getElementById('taskModal').style.display = 'block';
}

async function editTask(taskId) {
    console.log('✏️ Editing task:', taskId);
    
    try {
        const response = await apiRequest(`/tasks/${taskId}`);
        
        if (response.success) {
            const task = response.task;
            
            document.getElementById('modalTitle').textContent = 'Edit Task';
            document.getElementById('taskId').value = task._id;
            document.getElementById('taskTitle').value = task.title || '';
            document.getElementById('taskDescription').value = task.description || '';
            
            if (task.dueDate) {
                document.getElementById('taskDueDate').value = task.dueDate.split('T')[0];
            }
            
            document.getElementById('taskPriority').value = task.priority || 'medium';
            document.getElementById('taskCategory').value = task.category || 'work';
            document.getElementById('taskStatus').value = task.status || 'pending';
            
            document.getElementById('taskModal').style.display = 'block';
        }
        
    } catch (error) {
        console.error('❌ Error loading task:', error);
        showToast('Error loading task details', 'error');
    }
}

async function handleTaskSubmit(event) {
    event.preventDefault();
    console.log('📝 Task form submitted');
    
    const taskId = document.getElementById('taskId').value;
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        dueDate: document.getElementById('taskDueDate').value,
        priority: document.getElementById('taskPriority').value,
        category: document.getElementById('taskCategory').value,
        status: document.getElementById('taskStatus').value
    };
    
    try {
        let response;
        
        if (taskId) {
            response = await apiRequest(`/tasks/${taskId}`, 'PUT', taskData);
            showToast('✅ Task updated successfully!');
        } else {
            response = await apiRequest('/tasks', 'POST', taskData);
            showToast('✅ Task created successfully!');
        }
        
        if (response && response.success) {
            closeTaskModal();
            loadTasks();
        }
        
    } catch (error) {
        console.error('❌ Error saving task:', error);
        showToast('Error saving task. Please try again.', 'error');
    }
}

// ==================== DELETE TASK ====================

function showDeleteModal(taskId) {
    taskToDelete = taskId;
    document.getElementById('deleteModal').style.display = 'block';
}

async function confirmDelete() {
    if (!taskToDelete) return;
    
    try {
        const response = await apiRequest(`/tasks/${taskToDelete}`, 'DELETE');
        
        if (response.success) {
            showToast('✅ Task deleted successfully!');
            closeDeleteModal();
            loadTasks();
        }
        
    } catch (error) {
        console.error('❌ Error deleting task:', error);
        showToast('Error deleting task. Please try again.', 'error');
    }
}

function closeTaskModal() {
    document.getElementById('taskModal').style.display = 'none';
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    taskToDelete = null;
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ==================== FILTER TASKS ====================

async function filterTasks() {
    const status = document.getElementById('filterStatus').value;
    
    try {
        const response = await apiRequest(`/tasks${status !== 'all' ? `?status=${status}` : ''}`);
        if (response && response.tasks) {
            displayTasks(response.tasks);
        }
    } catch (error) {
        console.error('❌ Error filtering tasks:', error);
    }
}

// ==================== PROFILE ====================
// ==================== ENHANCED PROFILE SECTION ====================
// ==================== ENHANCED PROFILE SECTION WITH ALL FEATURES ====================

async function loadProfile() {
    console.log('👤 Loading enhanced profile...');
    
    try {
        const response = await apiRequest('/user/profile');
        
        if (response.success) {
            const user = response.user;
            const taskStats = user.taskStats || { total: 0, pending: 0, inProgress: 0, completed: 0 };
            
            // Calculate completion rate
            const completionRate = taskStats.total > 0 
                ? Math.round((taskStats.completed / taskStats.total) * 100) 
                : 0;
            
            // Get join date
            const joinDate = user.createdAt ? new Date(user.createdAt) : new Date();
            const joinMonth = joinDate.toLocaleString('default', { month: 'long' });
            const joinYear = joinDate.getFullYear();
            
            // Generate heatmap data
            const heatmapDays = generateHeatmapData();
            
            // Calculate achievements
            const achievements = calculateAchievements(taskStats, user);
            
            // Get user's bio
            const userBio = user.bio || 'No bio yet. Click edit to add one!';
            
            // Get profile photo
            const profilePhoto = user.profilePhoto || '';
            
            const profileContainer = document.querySelector('.profile-container');
            if (!profileContainer) return;
            
            profileContainer.innerHTML = `
                <div class="profile-card">
                    <div class="profile-cover"></div>
                    
                    <div class="profile-avatar-wrapper" id="profileAvatarWrapper">
                        <div class="profile-avatar" id="profileAvatar" onclick="triggerPhotoUpload()">
                            ${profilePhoto ? 
                                `<img src="http://localhost:5000${profilePhoto}" alt="Profile" class="profile-image">` : 
                                `<i class="fas fa-user-circle"></i>`
                            }
                            <div class="profile-avatar-overlay">
                                <i class="fas fa-camera"></i>
                                <span>Change Photo</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="profile-header">
                        <h2 id="profileName">${user.name || 'User'}</h2>
                        <p id="profileEmail">
                            <i class="fas fa-envelope"></i>
                            ${user.email || 'No email'}
                        </p>
                        <p id="profileBio" class="profile-bio">${userBio}</p>
                    </div>
                    
                    <!-- Stats Grid -->
                    <div class="profile-stats-grid">
                        <div class="profile-stat-card">
                            <div class="profile-stat-icon">
                                <i class="fas fa-tasks"></i>
                            </div>
                            <div class="profile-stat-value">${taskStats.total}</div>
                            <div class="profile-stat-label">Total Tasks</div>
                        </div>
                        
                        <div class="profile-stat-card">
                            <div class="profile-stat-icon">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <div class="profile-stat-value">${taskStats.completed}</div>
                            <div class="profile-stat-label">Completed</div>
                        </div>
                        
                        <div class="profile-stat-card">
                            <div class="profile-stat-icon">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="profile-stat-value">${completionRate}%</div>
                            <div class="profile-stat-label">Success Rate</div>
                        </div>
                    </div>
                    
                    <!-- Profile Details -->
                    <div class="profile-details">
                        <div class="detail-item">
                            <div class="detail-icon">
                                <i class="fas fa-calendar-alt"></i>
                            </div>
                            <div class="detail-content">
                                <div class="detail-label">Member Since</div>
                                <div class="detail-value">${joinMonth} ${joinYear}</div>
                            </div>
                            <span class="detail-badge">${getMemberDuration(joinDate)}</span>
                        </div>
                        
                        <div class="detail-item">
                            <div class="detail-icon">
                                <i class="fas fa-fire"></i>
                            </div>
                            <div class="detail-content">
                                <div class="detail-label">Current Streak</div>
                                <div class="detail-value">${calculateStreak()} day${calculateStreak() !== 1 ? 's' : ''}</div>
                            </div>
                            <span class="detail-badge">🔥</span>
                        </div>
                        
                        <div class="detail-item">
                            <div class="detail-icon">
                                <i class="fas fa-tag"></i>
                            </div>
                            <div class="detail-content">
                                <div class="detail-label">Most Used Category</div>
                                <div class="detail-value">${getMostUsedCategory()}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Activity Heatmap -->
                    <div class="profile-heatmap">
                        <div class="heatmap-title">
                            <i class="fas fa-calendar-check"></i>
                            <span>Activity (Last 7 days)</span>
                        </div>
                        <div class="heatmap-grid">
                            ${heatmapDays.map(day => `
                                <div class="heatmap-day level-${day.level}" 
                                     title="${day.date}: ${day.count} task${day.count !== 1 ? 's' : ''}"></div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- Achievements Section with Content -->
                    <div class="profile-achievements">
                        <div class="achievements-title">
                            <i class="fas fa-medal"></i>
                            <span>Achievements</span>
                        </div>
                        <div class="achievements-grid">
                            ${achievements.map(ach => `
                                <div class="achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}" 
                                     onclick="showAchievementDetails('${ach.name}', '${ach.description}', ${ach.unlocked})">
                                    <div class="achievement-icon ${ach.unlocked ? '' : 'locked'}">
                                        <i class="${ach.icon}"></i>
                                    </div>
                                    <div class="achievement-info">
                                        <div class="achievement-name">${ach.name}</div>
                                        <div class="achievement-progress">
                                            ${ach.unlocked ? 
                                                '<span class="achievement-unlocked"><i class="fas fa-check-circle"></i> Unlocked</span>' : 
                                                `<span class="achievement-locked"><i class="fas fa-lock"></i> ${ach.progress || 'Locked'}</span>`
                                            }
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- Profile Actions -->
                    <div class="profile-actions">
                        <button class="profile-action-btn" onclick="showEditProfileModal()">
                            <i class="fas fa-user-edit"></i>
                            Edit Profile
                        </button>
                        <button class="profile-action-btn primary" onclick="exportProfile()">
                            <i class="fas fa-download"></i>
                            Export Data
                        </button>
                    </div>
                </div>
            `;
            
            // Add hidden file input for photo upload
            addPhotoUploadInput();
        }
        
    } catch (error) {
        console.error('❌ Error loading profile:', error);
    }
}

// ==================== PROFILE PHOTO UPLOAD ====================

function addPhotoUploadInput() {
    // Remove existing if any
    const existing = document.getElementById('profilePhotoInput');
    if (existing) existing.remove();
    
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'profilePhotoInput';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.onchange = uploadProfilePhoto;
    document.body.appendChild(input);
}

function triggerPhotoUpload() {
    document.getElementById('profilePhotoInput').click();
}

async function uploadProfilePhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image size should be less than 5MB', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('photo', file);
    
    try {
        showToast('Uploading photo...', 'info');
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/user/photo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('✅ Profile photo updated!', 'success');
            loadProfile(); // Reload profile to show new photo
        } else {
            showToast(result.message || 'Upload failed', 'error');
        }
    } catch (error) {
        console.error('❌ Photo upload error:', error);
        showToast('Failed to upload photo', 'error');
    }
}

// ==================== EDIT PROFILE MODAL ====================

function showEditProfileModal() {
    const userData = getUserData();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'editProfileModal';
    modal.innerHTML = `
        <div class="modal-content edit-profile-modal">
            <span class="close" onclick="closeEditProfileModal()">&times;</span>
            <h2><i class="fas fa-user-edit"></i> Edit Profile</h2>
            
            <form id="editProfileForm" onsubmit="saveProfileChanges(event)">
                <div class="form-group">
                    <label for="editName">Full Name</label>
                    <input type="text" id="editName" value="${userData.name || ''}" required>
                </div>
                
                <div class="form-group">
                    <label for="editEmail">Email Address</label>
                    <input type="email" id="editEmail" value="${userData.email || ''}" required>
                </div>
                
                <div class="form-group">
                    <label for="editBio">Bio</label>
                    <textarea id="editBio" rows="3" placeholder="Tell us about yourself...">${userData.bio || ''}</textarea>
                    <small class="char-count"><span id="bioCharCount">${userData.bio ? userData.bio.length : 0}</span>/200</small>
                </div>
                
                <div class="form-group photo-options">
                    <label>Profile Photo</label>
                    <div class="photo-actions">
                        <button type="button" class="btn btn-secondary" onclick="triggerPhotoUpload()">
                            <i class="fas fa-camera"></i> Change Photo
                        </button>
                        <button type="button" class="btn btn-outline-danger" onclick="deleteProfilePhoto()">
                            <i class="fas fa-trash"></i> Remove Photo
                        </button>
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                    <button type="button" class="btn btn-secondary" onclick="closeEditProfileModal()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    // Add character counter
    document.getElementById('editBio').addEventListener('input', function() {
        const count = this.value.length;
        document.getElementById('bioCharCount').textContent = count;
    });
}

function closeEditProfileModal() {
    const modal = document.getElementById('editProfileModal');
    if (modal) modal.remove();
}

async function saveProfileChanges(event) {
    event.preventDefault();
    
    const name = document.getElementById('editName').value;
    const email = document.getElementById('editEmail').value;
    const bio = document.getElementById('editBio').value;
    
    try {
        const response = await apiRequest('/user/profile', 'PUT', { name, email, bio });
        
        if (response.success) {
            showToast('✅ Profile updated successfully!', 'success');
            
            // Update stored user data
            const userData = getUserData();
            userData.name = name;
            userData.email = email;
            userData.bio = bio;
            setUserData(userData);
            
            closeEditProfileModal();
            loadProfile(); // Reload profile
        }
    } catch (error) {
        console.error('❌ Error updating profile:', error);
        showToast('Failed to update profile', 'error');
    }
}

async function deleteProfilePhoto() {
    if (!confirm('Remove your profile photo?')) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/user/photo`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('✅ Profile photo removed', 'success');
            closeEditProfileModal();
            loadProfile();
        } else {
            showToast(result.message || 'Failed to remove photo', 'error');
        }
    } catch (error) {
        console.error('❌ Error deleting photo:', error);
        showToast('Failed to delete photo', 'error');
    }
}

// ==================== ACHIEVEMENTS WITH CONTENT ====================

function calculateAchievements(taskStats, user) {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const sharedTasks = tasks.filter(t => t.sharedWith && t.sharedWith.length > 0).length;
    
    return [
        { 
            name: 'First Task', 
            icon: 'fas fa-check-circle', 
            unlocked: taskStats.total >= 1,
            description: '🎉 You created your first task! Keep up the great work!',
            progress: taskStats.total >= 1 ? 'Completed' : 'Create your first task'
        },
        { 
            name: 'Task Master', 
            icon: 'fas fa-crown', 
            unlocked: taskStats.total >= 10,
            description: '👑 You\'ve created 10 tasks! You\'re a true Task Master!',
            progress: `${taskStats.total}/10 tasks created`
        },
        { 
            name: 'Completionist', 
            icon: 'fas fa-trophy', 
            unlocked: taskStats.completed >= 5,
            description: '🏆 5 tasks completed! Nothing can stop you now!',
            progress: `${taskStats.completed}/5 tasks completed`
        },
        { 
            name: 'Team Player', 
            icon: 'fas fa-users', 
            unlocked: sharedTasks >= 1,
            description: '🤝 You shared a task with your team! Collaboration is key!',
            progress: sharedTasks >= 1 ? 'Shared with team' : 'Share a task with someone'
        },
        { 
            name: 'Early Bird', 
            icon: 'fas fa-sun', 
            unlocked: true,
            description: `🌟 You've been a member since ${new Date(user.createdAt).toLocaleDateString()}. Thanks for sticking with us!`,
            progress: 'Loyal member'
        },
        { 
            name: 'Streak Master', 
            icon: 'fas fa-fire', 
            unlocked: calculateStreak() >= 7,
            description: '🔥 7 day streak! You\'re on fire!',
            progress: `${calculateStreak()}/7 days streak`
        },
        { 
            name: 'Organizer', 
            icon: 'fas fa-folder-tree', 
            unlocked: getUniqueCategories().length >= 3,
            description: '📂 You use multiple categories to organize your tasks!',
            progress: `${getUniqueCategories().length}/3 categories used`
        },
        { 
            name: 'Goal Crusher', 
            icon: 'fas fa-bullseye', 
            unlocked: taskStats.completed >= taskStats.total * 0.5 && taskStats.total > 0,
            description: '🎯 You\'ve completed over 50% of your tasks! Keep crushing goals!',
            progress: `${Math.round((taskStats.completed / taskStats.total) * 100) || 0}% completion rate`
        }
    ];
}

function getUniqueCategories() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const categories = new Set(tasks.map(t => t.category || 'general').filter(Boolean));
    return Array.from(categories);
}

function showAchievementDetails(name, description, unlocked) {
    showToast(
        `${name}: ${description}`,
        unlocked ? 'success' : 'info'
    );
}

// ==================== EXPORT PROFILE ====================

function exportProfile() {
    const userData = getUserData();
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    
    const stats = {
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        pendingTasks: tasks.filter(t => t.status === 'pending').length,
        inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
        completionRate: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0,
        categories: getCategoryStats(tasks),
        achievements: calculateAchievements({ total: tasks.length, completed: tasks.filter(t => t.status === 'completed').length }, userData)
    };
    
    const profileData = {
        user: {
            name: userData.name,
            email: userData.email,
            bio: userData.bio || '',
            memberSince: userData.createdAt
        },
        stats: stats,
        tasks: tasks,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(profileData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `taskmaster_profile_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showToast('✅ Profile data exported successfully!', 'success');
}

function getCategoryStats(tasks) {
    const stats = {};
    tasks.forEach(task => {
        const cat = task.category || 'general';
        stats[cat] = (stats[cat] || 0) + 1;
    });
    return stats;
}

// ==================== EXISTING HELPER FUNCTIONS (Keep these) ====================

function generateHeatmapData() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const last7Days = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const taskCount = tasks.filter(t => {
            const taskDate = t.createdAt ? t.createdAt.split('T')[0] : '';
            return taskDate === dateStr;
        }).length;
        
        const level = Math.min(taskCount, 5);
        
        last7Days.push({
            date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            count: taskCount,
            level: level
        });
    }
    
    return last7Days;
}

function getMemberDuration(joinDate) {
    const now = new Date();
    const diffTime = Math.abs(now - joinDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
        return `${diffDays} days`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''}`;
    } else {
        const years = Math.floor(diffDays / 365);
        return `${years} year${years > 1 ? 's' : ''}`;
    }
}

function calculateStreak() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const activityDays = new Set();
    
    tasks.forEach(task => {
        if (task.createdAt) {
            const date = task.createdAt.split('T')[0];
            activityDays.add(date);
        }
        if (task.updatedAt) {
            const date = task.updatedAt.split('T')[0];
            activityDays.add(date);
        }
    });
    
    const sortedDays = Array.from(activityDays).sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < sortedDays.length; i++) {
        const day = sortedDays[i];
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedStr = expectedDate.toISOString().split('T')[0];
        
        if (day === expectedStr) {
            streak++;
        } else {
            break;
        }
    }
    
    return streak;
}

function getMostUsedCategory() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const categories = {};
    
    tasks.forEach(task => {
        const cat = task.category || 'general';
        categories[cat] = (categories[cat] || 0) + 1;
    });
    
    let maxCount = 0;
    let mostUsed = 'general';
    
    for (const [cat, count] of Object.entries(categories)) {
        if (count > maxCount) {
            maxCount = count;
            mostUsed = cat;
        }
    }
    
    return mostUsed.charAt(0).toUpperCase() + mostUsed.slice(1);
}
// ==================== SHARED TASKS ====================

// ==================== SHARED TASKS - COMPLETE VERSION ====================


async function loadSharedTasks() {
    console.log('📥 Loading shared tasks...');
    
    const container = document.getElementById('sharedTasksContainer');
    if (!container) {
        console.log('❌ Shared tasks container not found');
        return;
    }
    
    container.innerHTML = '<div class="loading">Loading shared tasks...</div>';
    
    try {
        const response = await apiRequest('/tasks/shared');
        console.log('📦 Shared tasks response:', response);
        
        if (!response || !response.success) {
            container.innerHTML = '<div class="no-tasks">Error loading shared tasks</div>';
            return;
        }
        
        const tasks = response.tasks || [];
        console.log(`📋 Found ${tasks.length} shared tasks`);
        
        if (tasks.length === 0) {
            container.innerHTML = '<div class="no-tasks"><i class="fas fa-share-alt"></i><p>No tasks shared with you yet.</p></div>';
            return;
        }
        
        // Log first task to see what data we have
        console.log('📋 Sample shared task:', tasks[0]);
        
        // Display shared tasks with full details
        container.innerHTML = tasks.map(task => {
            // Safely access task properties with defaults
            const taskId = task._id || task.id || '';
            const title = task.title || 'Untitled';
            const description = task.description || 'No description provided';
            const priority = task.priority || 'medium';
            const category = task.category || 'general';
            const status = task.status || 'pending';
            const dueDate = task.dueDate || null;
            
            // Handle arrays safely
            const attachments = Array.isArray(task.attachments) ? task.attachments : [];
            const comments = Array.isArray(task.comments) ? task.comments : [];
            const sharedBy = task.sharedBy || 'Another user';
            
            console.log(`📎 Task "${title}" has ${attachments.length} attachments and ${comments.length} comments`);
            
            return `
            <div class="task-card priority-${priority}" data-task-id="${taskId}">
                <div class="task-header">
                    <h3>${title}</h3>
                    <span class="shared-badge">Shared by: ${sharedBy}</span>
                </div>
                
                <div class="task-description">${description}</div>
                
                <div class="task-meta">
                    <span class="task-category"><i class="fas fa-tag"></i> ${category}</span>
                    <span class="task-due-date ${isOverdue(dueDate) && status !== 'completed' ? 'overdue' : ''}">
                        <i class="far fa-calendar"></i> Due: ${formatDate(dueDate)}
                    </span>
                    <span class="task-status">Status: ${status}</span>
                </div>
                
                <!-- ATTACHMENTS SECTION -->
                ${attachments.length > 0 ? `
                    <div class="task-attachments">
                        <h4><i class="fas fa-paperclip"></i> Attachments (${attachments.length})</h4>
                        ${attachments.map(att => {
                            // Handle different attachment formats
                            const filename = att.filename || att.name || 'file';
                            const fileUrl = att.url || `/uploads/${att.saved_as || att.filename}`;
                            const fileSize = att.size || 0;
                            
                            return `
                            <div class="attachment-item">
                                <i class="fas fa-file"></i>
                                <a href="http://localhost:5000${fileUrl}" target="_blank" title="${filename}">
                                    ${filename.length > 30 ? filename.substring(0,30)+'...' : filename}
                                </a>
                                ${fileSize ? `<span class="attachment-size">${formatFileSize(fileSize)}</span>` : ''}
                                <a href="http://localhost:5000${fileUrl}" download class="download-btn" title="Download">
                                    <i class="fas fa-download"></i>
                                </a>
                            </div>
                        `}).join('')}
                    </div>
                ` : ''}
                
                <!-- COMMENTS SECTION -->
                <div class="task-comments">
                    <h4><i class="fas fa-comments"></i> Comments (${comments.length})</h4>
                    
                    <div class="comments-list">
                        ${comments.length > 0 ? 
                            comments.slice(-5).map(comment => `
                                <div class="comment-item">
                                    <div class="comment-header">
                                        <span class="comment-author">${comment.userName || 'User'}</span>
                                        <span class="comment-date">${formatDateTime(comment.timestamp)}</span>
                                    </div>
                                    <div class="comment-text">${comment.text}</div>
                                </div>
                            `).join('') 
                            : '<p class="no-comments">No comments yet</p>'
                        }
                    </div>
                    
                    <!-- Add Comment - SHARED USER CAN COMMENT -->
                    <div class="comment-input-group">
                        <input type="text" id="shared-comment-${taskId}" placeholder="Add a comment..." 
                               onkeypress="if(event.key==='Enter') addSharedComment('${taskId}')">
                        <button onclick="addSharedComment('${taskId}')">
                            <i class="fas fa-paper-plane"></i> Comment
                        </button>
                    </div>
                </div>
                
                <!-- Progress Bar -->
                <div class="task-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${getProgressPercentage(status)}%"></div>
                    </div>
                    <div class="progress-text">${status} ${getStatusBadge(status)}</div>
                </div>
            </div>
        `}).join('');
        
    } catch (error) {
        console.error('❌ Error loading shared tasks:', error);
        container.innerHTML = '<div class="no-tasks">Error loading shared tasks</div>';
    }
}

// ==================== ADD COMMENT TO SHARED TASK ====================

async function addSharedComment(taskId) {
    const commentInput = document.getElementById(`shared-comment-${taskId}`);
    const comment = commentInput.value.trim();
    
    if (!comment) {
        showToast('Please enter a comment', 'warning');
        return;
    }
    
    try {
        const response = await apiRequest(`/tasks/${taskId}/comments`, 'POST', { comment });
        
        if (response.success) {
            commentInput.value = '';
            showToast('💬 Comment added', 'success');
            loadSharedTasks(); // Reload shared tasks to show new comment
        }
    } catch (error) {
        console.error('❌ Error adding comment:', error);
        showToast('Failed to add comment', 'error');
    }
}

// ==================== HELPER FUNCTION FOR FILE SIZE ====================

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
// ==================== HELPER FUNCTIONS ====================




// ==================== ACTIVITY LOG ====================

// ==================== ENHANCED ACTIVITY LOG WITH TASK DETAILS ====================

let currentActivityFilter = 'all';

async function loadActivityLog() {
    try {
        const container = document.getElementById('activityLog');
        if (!container) return;
        
        const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const pendingTasks = tasks.filter(t => t.status === 'pending').length;
        const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
        const sharedTasks = tasks.filter(t => t.sharedWith && t.sharedWith.length > 0).length;
        
        // Get current date and time
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        container.innerHTML = `
            <div class="activity-log">
                <h2>
                    <i class="fas fa-history"></i>
                    Activity Timeline
                </h2>
                
                <!-- Stats Overview -->
                <div class="activity-stats">
                    <div class="stat-mini-card" onclick="filterActivity('all')">
                        <div class="stat-mini-icon">
                            <i class="fas fa-tasks"></i>
                        </div>
                        <div class="stat-mini-value">${totalTasks}</div>
                        <div class="stat-mini-label">Total Tasks</div>
                    </div>
                    <div class="stat-mini-card" onclick="filterActivity('completed')">
                        <div class="stat-mini-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="stat-mini-value">${completedTasks}</div>
                        <div class="stat-mini-label">Completed</div>
                    </div>
                    <div class="stat-mini-card" onclick="filterActivity('pending')">
                        <div class="stat-mini-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="stat-mini-value">${pendingTasks + inProgressTasks}</div>
                        <div class="stat-mini-label">In Progress</div>
                    </div>
                </div>
                
                <!-- Filter Buttons -->
                <div class="activity-filters">
                    <button class="activity-filter-btn ${currentActivityFilter === 'all' ? 'active' : ''}" onclick="filterActivity('all')">All</button>
                    <button class="activity-filter-btn ${currentActivityFilter === 'tasks' ? 'active' : ''}" onclick="filterActivity('tasks')">Tasks</button>
                    <button class="activity-filter-btn ${currentActivityFilter === 'completed' ? 'active' : ''}" onclick="filterActivity('completed')">Completed</button>
                    <button class="activity-filter-btn ${currentActivityFilter === 'shared' ? 'active' : ''}" onclick="filterActivity('shared')">Shared</button>
                </div>
                
                <!-- Timeline -->
                <div class="activity-timeline" id="activityTimeline">
                    ${renderActivityItems(tasks, currentActivityFilter)}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('❌ Error loading activity log:', error);
        const container = document.getElementById('activityLog');
        if (container) {
            container.innerHTML = `
                <div class="activity-empty">
                    <i class="fas fa-history"></i>
                    <p>Unable to load activity log</p>
                </div>
            `;
        }
    }
}

// ==================== RENDER ACTIVITY ITEMS BASED ON FILTER ====================

function renderActivityItems(tasks, filter) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
    
    let html = '';
    
    // Always show welcome message
    if (filter === 'all') {
        html += `
            <div class="activity-item" data-type="welcome">
                <div class="activity-icon welcome">
                    <i class="fas fa-rocket"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-text">
                        <strong>Welcome back!</strong> You're making great progress
                    </div>
                    <div class="activity-meta">
                        <span class="activity-time">
                            <i class="far fa-clock"></i>
                            ${timeStr} • ${dateStr}
                        </span>
                        <span class="activity-badge highlight">
                            <i class="fas fa-star"></i> Active Now
                        </span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Show tasks based on filter
    if (filter === 'all' || filter === 'tasks') {
        const tasksToShow = filter === 'all' ? tasks : tasks;
        
        tasksToShow.forEach((task, index) => {
            if (filter === 'all' && index > 2) return; // Show only 3 tasks in all view
            
            const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date';
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
            
            html += `
                <div class="activity-item task-detail" data-type="task" data-task-id="${task._id}" onclick="showTaskDetails('${task._id}')">
                    <div class="activity-icon task">
                        <i class="fas fa-tasks"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-text">
                            <strong>${task.title}</strong>
                        </div>
                        <div class="task-preview">
                            <span class="task-badge ${task.priority}">${task.priority}</span>
                            <span class="task-badge ${task.category}">${task.category}</span>
                            <span class="task-status-badge ${task.status}">${task.status}</span>
                        </div>
                        <div class="activity-meta">
                            <span class="activity-time ${isOverdue ? 'overdue' : ''}">
                                <i class="far fa-calendar"></i>
                                Due: ${dueDate}
                            </span>
                            ${task.sharedWith && task.sharedWith.length > 0 ? 
                                `<span class="activity-badge"><i class="fas fa-share-alt"></i> Shared</span>` : ''}
                        </div>
                        ${task.description ? `<div class="task-description-preview">${task.description.substring(0, 50)}${task.description.length > 50 ? '...' : ''}</div>` : ''}
                    </div>
                </div>
            `;
        });
    }
    
    // Show completed tasks
    if (filter === 'all' || filter === 'completed') {
        const completed = tasks.filter(t => t.status === 'completed');
        
        if (completed.length > 0) {
            completed.slice(0, filter === 'all' ? 2 : completed.length).forEach(task => {
                html += `
                    <div class="activity-item task-detail" data-type="completed" data-task-id="${task._id}" onclick="showTaskDetails('${task._id}')">
                        <div class="activity-icon complete">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-text">
                                <strong>${task.title}</strong> - Completed
                            </div>
                            <div class="activity-meta">
                                <span class="activity-time">
                                    <i class="fas fa-check"></i>
                                    Done
                                </span>
                                <span class="activity-badge highlight">
                                    <i class="fas fa-trophy"></i> Great job!
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
    }
    
    // Show shared tasks with details
    if (filter === 'all' || filter === 'shared') {
        const shared = tasks.filter(t => t.sharedWith && t.sharedWith.length > 0);
        
        if (shared.length > 0) {
            shared.slice(0, filter === 'all' ? 2 : shared.length).forEach(task => {
                // Get user names from localStorage or generate placeholder
                const sharedWithCount = task.sharedWith.length;
                
                html += `
                    <div class="activity-item task-detail" data-type="share" data-task-id="${task._id}" onclick="showTaskDetails('${task._id}')">
                        <div class="activity-icon share">
                            <i class="fas fa-share-alt"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-text">
                                <strong>${task.title}</strong>
                            </div>
                            <div class="shared-details">
                                <i class="fas fa-users"></i>
                                Shared with ${sharedWithCount} user${sharedWithCount > 1 ? 's' : ''}
                            </div>
                            <div class="activity-meta">
                                <span class="activity-time">
                                    <i class="fas fa-share"></i>
                                    Collaboration Active
                                </span>
                                <span class="activity-badge">
                                    <i class="fas fa-user-friends"></i> Shared
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
    }
    
    // Show message if no items for filter
    if (html === '') {
        html = `
            <div class="activity-empty">
                <i class="fas fa-search"></i>
                <p>No activities found for this filter</p>
            </div>
        `;
    }
    
    return html;
}

// ==================== FILTER ACTIVITY ====================

function filterActivity(type) {
    console.log('🔍 Filtering activity by:', type);
    currentActivityFilter = type;
    loadActivityLog(); // Reload with new filter
}

// ==================== SHOW TASK DETAILS ====================

function showTaskDetails(taskId) {
    console.log('📋 Showing details for task:', taskId);
    
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const task = tasks.find(t => t._id === taskId);
    
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    // Create modal with task details
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content task-detail-modal">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h2><i class="fas fa-info-circle"></i> Task Details</h2>
            
            <div class="task-detail-content">
                <div class="detail-row">
                    <span class="detail-label">Title:</span>
                    <span class="detail-value">${task.title}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${task.description || 'No description'}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value status-badge ${task.status}">${task.status}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Priority:</span>
                    <span class="detail-value priority-badge ${task.priority}">${task.priority}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Category:</span>
                    <span class="detail-value">${task.category || 'general'}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Due Date:</span>
                    <span class="detail-value ${isOverdue(task.dueDate) && task.status !== 'completed' ? 'overdue' : ''}">
                        ${formatDate(task.dueDate) || 'No date'}
                    </span>
                </div>
                
                ${task.sharedWith && task.sharedWith.length > 0 ? `
                    <div class="detail-row">
                        <span class="detail-label">Shared With:</span>
                        <span class="detail-value">
                            <i class="fas fa-users"></i> ${task.sharedWith.length} user(s)
                        </span>
                    </div>
                ` : ''}
                
                ${task.attachments && task.attachments.length > 0 ? `
                    <div class="detail-row">
                        <span class="detail-label">Attachments:</span>
                        <div class="attachment-list">
                            ${task.attachments.map(att => `
                                <a href="http://localhost:5000${att.url}" target="_blank" class="attachment-link">
                                    <i class="fas fa-paperclip"></i> ${att.filename}
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${task.comments && task.comments.length > 0 ? `
                    <div class="detail-row">
                        <span class="detail-label">Comments:</span>
                        <div class="comments-preview">
                            ${task.comments.slice(-3).map(c => `
                                <div class="comment-preview">
                                    <strong>${c.userName}:</strong> ${c.text}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="editTask('${task._id}'); this.closest('.modal').remove()">
                    <i class="fas fa-edit"></i> Edit Task
                </button>
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i> Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

// ==================== FEATURE 1: EMAIL REMINDERS ====================

async function sendTaskReminder(taskId) {
    if (!confirm('📧 Send email reminder for this task?')) return;
    
    try {
        const response = await apiRequest(`/tasks/${taskId}/remind`, 'POST');
        
        if (response.success) {
            showToast('📧 Reminder sent successfully!', 'success');
        }
    } catch (error) {
        console.error('❌ Error sending reminder:', error);
        showToast('Failed to send reminder', 'error');
    }
}

// ==================== FEATURE 2: FILE ATTACHMENTS ====================

function showFilePicker(taskId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jpg,.jpeg,.png,.pdf,.doc,.docx,.txt,.xlsx';
    input.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            uploadTaskAttachment(taskId, file);
        }
    };
    input.click();
}

async function uploadTaskAttachment(taskId, file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        showToast('📤 Uploading file...', 'info');
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/attachments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('✅ File uploaded successfully!', 'success');
            loadTasks();
        } else {
            showToast(result.message || 'Upload failed', 'error');
        }
    } catch (error) {
        console.error('❌ Upload error:', error);
        showToast('Upload failed: ' + error.message, 'error');
    }
}

async function deleteAttachment(taskId, filename) {
    if (!confirm('🗑️ Delete this attachment?')) return;
    
    try {
        const response = await apiRequest(`/tasks/${taskId}/attachments/${filename}`, 'DELETE');
        
        if (response.success) {
            showToast('✅ Attachment deleted', 'success');
            loadTasks();
        }
    } catch (error) {
        console.error('❌ Delete error:', error);
        showToast('Failed to delete attachment', 'error');
    }
}

// ==================== FEATURE 3: SHARE TASK ====================

function showShareModal(taskId) {
    currentShareTaskId = taskId;
    
    if (!document.getElementById('shareModal')) {
        createShareModal();
    }
    
    document.getElementById('shareTaskId').value = taskId;
    document.getElementById('shareEmail').value = '';
    document.getElementById('shareModal').style.display = 'block';
}

function createShareModal() {
    const modalHTML = `
        <div id="shareModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeShareModal()">&times;</span>
                <h2><i class="fas fa-share-alt"></i> Share Task</h2>
                <form id="shareForm" onsubmit="shareTask(event)">
                    <input type="hidden" id="shareTaskId">
                    <div class="form-group">
                        <label>Email of person to share with</label>
                        <input type="email" id="shareEmail" required placeholder="colleague@example.com">
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Share Task</button>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

async function shareTask(event) {
    event.preventDefault();
    
    const taskId = document.getElementById('shareTaskId').value;
    const email = document.getElementById('shareEmail').value;
    
    try {
        const response = await apiRequest(`/tasks/${taskId}/share`, 'POST', { email });
        
        if (response.success) {
            showToast('✅ Task shared successfully!', 'success');
            closeShareModal();
        }
    } catch (error) {
        console.error('❌ Share error:', error);
        showToast('Failed to share task: ' + error.message, 'error');
    }
}

// ==================== FEATURE 3: COMMENTS ====================

async function addComment(taskId) {
    const commentInput = document.getElementById(`comment-${taskId}`);
    const comment = commentInput.value.trim();
    
    if (!comment) return;
    
    try {
        const response = await apiRequest(`/tasks/${taskId}/comments`, 'POST', { comment });
        
        if (response.success) {
            commentInput.value = '';
            loadTasks();
            showToast('💬 Comment added', 'success');
        }
    } catch (error) {
        console.error('❌ Comment error:', error);
        showToast('Failed to add comment', 'error');
    }
}

// ==================== FEATURE 4: EXPORT ====================

async function exportTasks(format) {
    try {
        showToast(`📊 Exporting tasks as ${format.toUpperCase()}...`, 'info');
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/export/${format}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const disposition = response.headers.get('Content-Disposition');
            const filename = disposition ? 
                disposition.split('filename=')[1].replace(/"/g, '') : 
                `tasks_export.${format}`;
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showToast(`✅ Tasks exported as ${format.toUpperCase()}!`, 'success');
        } else {
            const error = await response.json();
            showToast(error.message || 'Export failed', 'error');
        }
    } catch (error) {
        console.error('❌ Export error:', error);
        showToast('Export failed: ' + error.message, 'error');
    }
}

async function exportToExcel() {
    try {
        showToast('📊 Preparing Excel report...', 'info');
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/export/excel`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tasks_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showToast('✅ Excel report downloaded!', 'success');
        } else {
            showToast('Export failed', 'error');
        }
    } catch (error) {
        console.error('❌ Export error:', error);
        showToast('Export failed', 'error');
    }
}

// ==================== FEATURE 5: VOICE INPUT ====================

function initVoiceInput() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onresult = handleVoiceResult;
        recognition.onerror = handleVoiceError;
        recognition.onend = () => {
            const voiceBtn = document.getElementById('voiceBtn');
            if (voiceBtn) voiceBtn.classList.remove('recording');
        };
    }
}

function startVoiceInput() {
    if (!recognition) {
        showToast('🎤 Voice input not supported in this browser', 'warning');
        return;
    }
    
    try {
        recognition.start();
        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) voiceBtn.classList.add('recording');
        showToast('🎤 Listening... Speak now', 'info');
    } catch (error) {
        console.error('❌ Voice input error:', error);
    }
}

function handleVoiceResult(event) {
    const transcript = event.results[0][0].transcript;
    document.getElementById('taskTitle').value = transcript;
    showToast('✅ Voice captured! Fill in the details.', 'success');
}

function handleVoiceError(event) {
    console.error('❌ Voice error:', event.error);
    showToast('Voice input failed. Please try again.', 'error');
    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) voiceBtn.classList.remove('recording');
}

function addVoiceButton() {
    const modalHeader = document.querySelector('#taskModal .modal-content h2');
    if (modalHeader && !document.getElementById('voiceBtn')) {
        const voiceBtn = document.createElement('button');
        voiceBtn.id = 'voiceBtn';
        voiceBtn.className = 'btn-voice';
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceBtn.onclick = startVoiceInput;
        voiceBtn.title = 'Voice Input (Click and speak)';
        modalHeader.appendChild(voiceBtn);
    }
}

// ==================== FEATURE 6: SMART SEARCH ====================

function initSmartSearch() {
    const searchInput = document.getElementById('smartSearch');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', handleSmartSearch);
    searchInput.addEventListener('focus', showSuggestions);
    
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => applyFilter(chip.dataset.filter));
    });
}

function handleSmartSearch(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const query = e.target.value.toLowerCase();
        performSmartSearch(query);
    }, 300);
}

function performSmartSearch(query) {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    
    const filters = parseNaturalLanguage(query);
    let filteredTasks = tasks;
    
    if (filters.priority) {
        filteredTasks = filteredTasks.filter(t => t.priority === filters.priority);
    }
    
    if (filters.status) {
        filteredTasks = filteredTasks.filter(t => t.status === filters.status);
    }
    
    if (filters.category) {
        filteredTasks = filteredTasks.filter(t => t.category === filters.category);
    }
    
    if (filters.date === 'today') {
        const today = new Date().toISOString().split('T')[0];
        filteredTasks = filteredTasks.filter(t => t.dueDate && t.dueDate.split('T')[0] === today);
    } else if (filters.date === 'tomorrow') {
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        filteredTasks = filteredTasks.filter(t => t.dueDate && t.dueDate.split('T')[0] === tomorrow);
    } else if (filters.date === 'overdue') {
        const today = new Date().toISOString().split('T')[0];
        filteredTasks = filteredTasks.filter(t => t.dueDate && t.dueDate.split('T')[0] < today && t.status !== 'completed');
    }
    
    if (query && Object.keys(filters).length === 0) {
        filteredTasks = tasks.filter(t => 
            (t.title && t.title.toLowerCase().includes(query)) || 
            (t.description && t.description.toLowerCase().includes(query))
        );
    }
    
    displayTasks(filteredTasks);
    showToast(`🔍 Found ${filteredTasks.length} tasks`, 'info');
}

function parseNaturalLanguage(query) {
    const filters = {};
    const words = query.toLowerCase().split(' ');
    
    if (words.includes('high')) filters.priority = 'high';
    if (words.includes('medium')) filters.priority = 'medium';
    if (words.includes('low')) filters.priority = 'low';
    
    if (words.includes('pending')) filters.status = 'pending';
    if (words.includes('progress')) filters.status = 'in-progress';
    if (words.includes('completed') || words.includes('done')) filters.status = 'completed';
    
    if (words.includes('today')) filters.date = 'today';
    if (words.includes('tomorrow')) filters.date = 'tomorrow';
    if (words.includes('overdue')) filters.date = 'overdue';
    
    const categories = ['work', 'personal', 'shopping', 'health', 'other'];
    categories.forEach(cat => {
        if (words.includes(cat)) filters.category = cat;
    });
    
    return filters;
}

function showSuggestions() {
    const suggestions = [
        'high priority tasks',
        'work tasks due today',
        'completed tasks',
        'shopping list',
        'overdue tasks'
    ];
    
    const suggestionsHTML = suggestions.map(s => `
        <div class="suggestion-item" onclick="document.getElementById('smartSearch').value='${s}'; handleSmartSearch({target:{value:'${s}'}})">
            <i class="fas fa-search"></i> ${s}
        </div>
    `).join('');
    
    const container = document.getElementById('searchSuggestions');
    if (container) {
        container.innerHTML = suggestionsHTML;
        container.style.display = 'block';
    }
}

function applyFilter(filter) {
    document.getElementById('smartSearch').value = '';
    performSmartSearch(filter);
}

// ==================== FEATURE 7: KEYBOARD SHORTCUTS ====================

function initKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeyboardShortcut);
}

function handleKeyboardShortcut(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    const key = e.key.toLowerCase();
    
    if ((e.ctrlKey || e.metaKey) && key === 'n') {
        e.preventDefault();
        showAddTaskModal();
        showToast('✨ Creating new task', 'info');
    }
    
    if (key === '/') {
        e.preventDefault();
        document.getElementById('smartSearch')?.focus();
    }
    
    if (key === '?' && !e.shiftKey) {
        e.preventDefault();
        showShortcutsHelp();
    }
    
    if (!isNaN(key) && parseInt(key) >= 1 && parseInt(key) <= 5) {
        const sections = ['dashboard', 'tasks', 'shared', 'profile', 'analytics'];
        showSection(sections[parseInt(key) - 1]);
    }
}

function showShortcutsHelp() {
    const shortcuts = [
        { key: 'Ctrl/Cmd + N', description: 'New Task' },
        { key: '/', description: 'Focus Search' },
        { key: '?', description: 'Show Help' },
        { key: '1', description: 'Dashboard' },
        { key: '2', description: 'My Tasks' },
        { key: '3', description: 'Shared With Me' },
        { key: '4', description: 'Profile' },
        { key: '5', description: 'Analytics' }
    ];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h2><i class="fas fa-keyboard"></i> Keyboard Shortcuts</h2>
            <div class="shortcuts-list">
                ${shortcuts.map(s => `
                    <div class="shortcut-item">
                        <span class="shortcut-key">${s.key}</span>
                        <span class="shortcut-desc">${s.description}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

// ==================== FEATURE 8: TASK DEPENDENCIES ====================

// ==================== FEATURE 8: TASK DEPENDENCIES ====================

function showDependencyManager(taskId) {
    console.log('🔗 Opening dependency manager for task:', taskId);
    
    // Get tasks from localStorage
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    console.log('📋 Available tasks:', tasks.length);
    
    const currentTask = tasks.find(t => t._id === taskId);
    
    if (!currentTask) {
        console.error('❌ Current task not found');
        showToast('Task not found', 'error');
        return;
    }
    
    console.log('📌 Current task:', currentTask.title);
    
    // Filter out current task and completed tasks
    const availableTasks = tasks.filter(t => 
        t._id !== taskId && t.status !== 'completed'
    );
    console.log('📋 Available tasks for dependency:', availableTasks.length);
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content dependency-modal">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h2><i class="fas fa-link"></i> Task Dependencies</h2>
            <p class="dependency-info">Tasks that must be completed before "${currentTask.title}"</p>
            
            <div class="dependency-list" id="dependencyList">
                ${renderDependencyList(taskId, tasks)}
            </div>
            
            <div class="dependency-selector">
                <h3>Add Dependency</h3>
                <select id="dependencySelect" class="dependency-select">
                    <option value="">Select a task...</option>
                    ${availableTasks.length > 0 ? 
                        availableTasks.map(t => 
                            `<option value="${t._id}">${t.title} (${t.status})</option>`
                        ).join('') 
                        : '<option value="" disabled>No available tasks</option>'
                    }
                </select>
                <button class="btn btn-primary" onclick="addDependency('${taskId}')">
                    <i class="fas fa-plus"></i> Add Dependency
                </button>
            </div>
            
            <div class="dependency-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

function renderDependencyList(taskId, tasks) {
    // Load dependencies
    const saved = localStorage.getItem('taskDependencies');
    const dependentTasks = saved ? JSON.parse(saved) : {};
    
    const dependencies = dependentTasks[taskId] || [];
    console.log('📋 Current dependencies:', dependencies.length);
    
    if (dependencies.length === 0) {
        return '<p class="no-dependencies">No dependencies set</p>';
    }
    
    return dependencies.map(depId => {
        const task = tasks.find(t => t._id === depId);
        if (!task) return '';
        
        return `
            <div class="dependency-item">
                <div class="dependency-info">
                    <span class="dependency-title">${task.title}</span>
                    <span class="dependency-status status-${task.status}">${task.status}</span>
                </div>
                <button class="btn-icon" onclick="removeDependency('${taskId}', '${depId}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

function addDependency(taskId) {
    const select = document.getElementById('dependencySelect');
    const depId = select.value;
    
    if (!depId) {
        showToast('Please select a task', 'warning');
        return;
    }
    
    // Load existing dependencies
    const saved = localStorage.getItem('taskDependencies');
    const dependentTasks = saved ? JSON.parse(saved) : {};
    
    if (!dependentTasks[taskId]) {
        dependentTasks[taskId] = [];
    }
    
    if (dependentTasks[taskId].includes(depId)) {
        showToast('Dependency already exists', 'warning');
        return;
    }
    
    dependentTasks[taskId].push(depId);
    localStorage.setItem('taskDependencies', JSON.stringify(dependentTasks));
    
    showToast('✅ Dependency added', 'success');
    
    // Refresh modal
    document.querySelector('.modal').remove();
    showDependencyManager(taskId);
}

function removeDependency(taskId, depId) {
    // Load existing dependencies
    const saved = localStorage.getItem('taskDependencies');
    const dependentTasks = saved ? JSON.parse(saved) : {};
    
    if (dependentTasks[taskId]) {
        dependentTasks[taskId] = dependentTasks[taskId].filter(id => id !== depId);
        localStorage.setItem('taskDependencies', JSON.stringify(dependentTasks));
        
        showToast('✅ Dependency removed', 'success');
        
        // Refresh modal
        document.querySelector('.modal').remove();
        showDependencyManager(taskId);
    }
}

function loadDependencies() {
    const saved = localStorage.getItem('taskDependencies');
    return saved ? JSON.parse(saved) : {};
}
function renderDependencyList(taskId, tasks) {
    const dependencies = dependentTasks[taskId] || [];
    if (dependencies.length === 0) {
        return '<p class="no-dependencies">No dependencies set</p>';
    }
    
    return dependencies.map(depId => {
        const task = tasks.find(t => t._id === depId);
        if (!task) return '';
        
        return `
            <div class="dependency-item">
                <div class="dependency-info">
                    <span class="dependency-title">${task.title}</span>
                    <span class="dependency-status status-${task.status}">${task.status}</span>
                </div>
                <button class="btn-icon" onclick="removeDependency('${taskId}', '${depId}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

function addDependency(taskId) {
    const select = document.getElementById('dependencySelect');
    const depId = select.value;
    
    if (!depId) {
        showToast('Please select a task', 'warning');
        return;
    }
    
    if (!dependentTasks[taskId]) {
        dependentTasks[taskId] = [];
    }
    
    if (dependentTasks[taskId].includes(depId)) {
        showToast('Dependency already exists', 'warning');
        return;
    }
    
    dependentTasks[taskId].push(depId);
    saveDependencies();
    showToast('✅ Dependency added', 'success');
    
    document.querySelector('.modal').remove();
    showDependencyManager(taskId);
}

function removeDependency(taskId, depId) {
    if (dependentTasks[taskId]) {
        dependentTasks[taskId] = dependentTasks[taskId].filter(id => id !== depId);
        saveDependencies();
        showToast('✅ Dependency removed', 'success');
        
        document.querySelector('.modal').remove();
        showDependencyManager(taskId);
    }
}

function saveDependencies() {
    localStorage.setItem('taskDependencies', JSON.stringify(dependentTasks));
}

function loadDependencies() {
    const saved = localStorage.getItem('taskDependencies');
    dependentTasks = saved ? JSON.parse(saved) : {};
}

// ==================== FEATURE 9: OFFLINE SUPPORT ====================

let isOnline = navigator.onLine;
let pendingSync = [];

function initOfflineSupport() {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    loadPendingSync();
    updateOnlineStatus();
}

function handleOnline() {
    isOnline = true;
    updateOnlineStatus();
    syncPendingTasks();
    showToast('📶 Back online! Syncing your tasks...', 'success');
}

function handleOffline() {
    isOnline = false;
    updateOnlineStatus();
    showToast('📴 You are offline. Changes will sync when online.', 'warning');
}

function updateOnlineStatus() {
    let indicator = document.getElementById('onlineIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'onlineIndicator';
        document.body.appendChild(indicator);
    }
    
    indicator.className = isOnline ? 'online' : 'offline';
    indicator.innerHTML = isOnline ? 
        '<i class="fas fa-wifi"></i>' : 
        '<i class="fas fa-wifi-slash"></i>';
}

function queueForSync(item) {
    pendingSync.push(item);
    savePendingSync();
    showPendingSyncBadge();
}

function savePendingSync() {
    localStorage.setItem('pendingSync', JSON.stringify(pendingSync));
}

function loadPendingSync() {
    const saved = localStorage.getItem('pendingSync');
    pendingSync = saved ? JSON.parse(saved) : [];
}

async function syncPendingTasks() {
    if (!isOnline || pendingSync.length === 0) return;
    
    showToast(`🔄 Syncing ${pendingSync.length} pending changes...`, 'info');
    
    const syncPromises = pendingSync.map(item => 
        apiRequest(item.endpoint, item.method, item.data)
            .catch(error => console.error('Sync failed:', error))
    );
    
    await Promise.all(syncPromises);
    
    pendingSync = [];
    savePendingSync();
    hidePendingSyncBadge();
    
    showToast('✅ All changes synced!', 'success');
    loadTasks();
}

function showPendingSyncBadge() {
    let badge = document.getElementById('pendingSyncBadge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'pendingSyncBadge';
        badge.className = 'sync-badge';
        badge.onclick = syncPendingTasks;
        document.body.appendChild(badge);
    }
    badge.innerHTML = `<i class="fas fa-sync"></i> ${pendingSync.length} pending`;
    badge.style.display = 'flex';
}

function hidePendingSyncBadge() {
    const badge = document.getElementById('pendingSyncBadge');
    if (badge) {
        badge.style.display = 'none';
    }
}

// ==================== FEATURE 10: CALENDAR ====================

function initCalendar() {
    renderCalendar();
}

function renderCalendar() {
    const calendarElement = document.getElementById('calendarDays');
    if (!calendarElement) return;
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const monthName = document.getElementById('currentMonth');
    if (monthName) {
        monthName.textContent = new Date(year, month).toLocaleDateString('default', { month: 'long', year: 'numeric' });
    }
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    let calendarHTML = '<div class="calendar-days">';
    
    for (let i = 0; i < firstDay; i++) {
        calendarHTML += '<div class="calendar-day other-month"></div>';
    }
    
    for (let d = 1; d <= lastDate; d++) {
        const date = new Date(year, month, d);
        const dateStr = date.toISOString().split('T')[0];
        const tasksOnDay = calendarTasks.filter(t => t.dueDate && t.dueDate.split('T')[0] === dateStr);
        const isToday = isSameDay(date, new Date());
        
        calendarHTML += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${tasksOnDay.length > 0 ? 'has-tasks' : ''}" 
                 onclick="showTasksForDate('${dateStr}')">
                <span class="calendar-day-number">${d}</span>
                ${tasksOnDay.length > 0 ? `
                    <div class="task-indicators">
                        ${tasksOnDay.slice(0, 3).map(t => 
                            `<div class="task-indicator ${t.priority || 'medium'}"></div>`
                        ).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    calendarHTML += '</div>';
    calendarElement.innerHTML = calendarHTML;
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
}

function isSameDay(date1, date2) {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
}

function showTasksForDate(dateStr) {
    const tasks = calendarTasks.filter(t => t.dueDate && t.dueDate.split('T')[0] === dateStr);
    if (tasks.length > 0) {
        showToast(`${tasks.length} tasks on ${new Date(dateStr).toLocaleDateString()}`, 'info');
    }
}

function loadTasksForCalendar() {
    renderCalendar();
}

// ==================== FEATURE: ANALYTICS ====================

function initAnalytics() {
    loadAnalytics();
}

function loadAnalytics() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    
    updateProductivityChart(tasks);
    updateCategoryDistribution(tasks);
}

function updateProductivityChart(tasks) {
    const container = document.getElementById('productivityTimeline');
    if (!container) return;
    
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();
    
    const dailyCounts = last7Days.map(date => 
        tasks.filter(t => t.createdAt && t.createdAt.split('T')[0] === date).length
    );
    
    const maxCount = Math.max(...dailyCounts, 1);
    
    const chartHTML = dailyCounts.map((count, i) => `
        <div class="timeline-item">
            <span class="timeline-date">${new Date(last7Days[i]).toLocaleDateString('default', { weekday: 'short' })}</span>
            <div class="timeline-bar">
                <div class="timeline-fill" style="width: ${(count / maxCount) * 100}%"></div>
            </div>
            <span class="timeline-count">${count}</span>
        </div>
    `).join('');
    
    container.innerHTML = chartHTML;
}

function updateCategoryDistribution(tasks) {
    const container = document.getElementById('categoryDistribution');
    if (!container) return;
    
    const categories = {};
    tasks.forEach(task => {
        const cat = task.category || 'other';
        categories[cat] = (categories[cat] || 0) + 1;
    });
    
    const total = tasks.length;
    
    const categoryHTML = Object.entries(categories).map(([category, count]) => `
        <div class="category-item">
            <span class="category-name">${category}</span>
            <div class="category-bar">
                <div class="category-fill" style="width: ${(count / total) * 100}%"></div>
            </div>
            <span class="category-count">${count}</span>
        </div>
    `).join('');
    
    container.innerHTML = categoryHTML || '<p>No data yet</p>';
}

// Override apiRequest for offline support
const originalApiRequest = window.apiRequest;
window.apiRequest = async function(endpoint, method = 'GET', data = null) {
    if (!isOnline && method !== 'GET') {
        queueForSync({ endpoint, method, data, timestamp: new Date().toISOString() });
        showToast('📴 Change saved locally. Will sync when online.', 'info');
        return { success: true, offline: true };
    }
    
    try {
        return await originalApiRequest(endpoint, method, data);
    } catch (error) {
        if (!isOnline) {
            queueForSync({ endpoint, method, data, timestamp: new Date().toISOString() });
            return { success: true, offline: true };
        }
        throw error;
    }
};
// frontend/js/tasks.js - DEBUG VERSION

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Tasks.js loaded - DEBUG MODE');
    
    if (window.location.pathname.includes('dashboard.html')) {
        console.log('📡 Dashboard detected');
        
        // Check if user is logged in
        const token = localStorage.getItem('token');
        console.log('Token exists:', !!token);
        
        if (!token) {
            console.log('❌ No token, redirecting to login');
            window.location.href = 'index.html';
            return;
        }
        
        // Try to load user info
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        const displayElement = document.getElementById('userDisplayName');
        if (displayElement && userData.name) {
            displayElement.textContent = userData.name;
        }
        
        // Try to load tasks
        loadTasksDebug();
    }
});

async function loadTasksDebug() {
    console.log('📥 Attempting to load tasks...');
    
    const container = document.getElementById('tasksContainer');
    if (container) {
        container.innerHTML = '<div class="loading">Loading tasks...</div>';
    }
    
    try {
        console.log('📡 Making API request...');
        const response = await fetch('http://localhost:5000/api/tasks', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });
        
        console.log('📦 Response status:', response.status);
        const data = await response.json();
        console.log('📦 Response data:', data);
        
        if (data.success && data.tasks) {
            console.log(`✅ Found ${data.tasks.length} tasks`);
            
            if (data.tasks.length === 0) {
                container.innerHTML = '<div class="no-tasks">No tasks yet. Create one!</div>';
            } else {
                // Simple display
                let html = '';
                data.tasks.forEach(task => {
                    html += `
                        <div class="task-card">
                            <h3>${task.title}</h3>
                            <p>${task.description || 'No description'}</p>
                            <div>Due: ${task.dueDate || 'No date'}</div>
                            <div>Status: ${task.status}</div>
                        </div>
                    `;
                });
                container.innerHTML = html;
            }
        } else {
            console.log('❌ API returned error:', data.message);
            container.innerHTML = '<div class="no-tasks">Error loading tasks</div>';
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        container.innerHTML = '<div class="no-tasks">Error: ' + error.message + '</div>';
    }
}