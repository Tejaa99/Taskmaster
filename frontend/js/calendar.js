// frontend/js/calendar.js

let currentDate = new Date();
let calendarTasks = [];

function initCalendar() {
    loadTasksForCalendar();
    renderCalendar();
}

function loadTasksForCalendar() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    calendarTasks = tasks;
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    document.getElementById('currentMonth').textContent = 
        new Date(year, month).toLocaleDateString('default', { month: 'long', year: 'numeric' });
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    let calendarHTML = '<div class="calendar-days">';
    
    // Previous month days
    for (let i = 0; i < firstDay; i++) {
        calendarHTML += '<div class="calendar-day other-month"></div>';
    }
    
    // Current month days
    for (let d = 1; d <= lastDate; d++) {
        const date = new Date(year, month, d);
        const dateStr = date.toISOString().split('T')[0];
        const tasksOnDay = calendarTasks.filter(t => t.dueDate === dateStr);
        const isToday = isSameDay(date, new Date());
        
        calendarHTML += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${tasksOnDay.length > 0 ? 'has-tasks' : ''}" 
                 onclick="showTasksForDate('${dateStr}')">
                <span class="calendar-day-number">${d}</span>
                ${tasksOnDay.length > 0 ? `
                    <div class="task-indicators">
                        ${tasksOnDay.slice(0, 3).map(t => 
                            `<div class="task-indicator ${t.priority}"></div>`
                        ).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    calendarHTML += '</div>';
    document.getElementById('calendarDays').innerHTML = calendarHTML;
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
    const tasks = calendarTasks.filter(t => t.dueDate === dateStr);
    if (tasks.length > 0) {
        showToast(`${tasks.length} tasks on ${new Date(dateStr).toLocaleDateString()}`, 'info');
    }
}