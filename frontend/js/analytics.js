// frontend/js/analytics.js

function initAnalytics() {
    console.log('📊 Analytics initialized');
    // Don't load analytics immediately - wait for tasks
}

function loadAnalytics() {
    console.log('📊 Loading analytics...');
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    
    // Check if analytics elements exist before updating
    updateProductivityChart(tasks);
    updateCategoryDistribution(tasks);
}

function updateProductivityChart(tasks) {
    const container = document.getElementById('productivityTimeline');
    if (!container) {
        console.log('📊 Productivity chart container not found');
        return;
    }
    
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
    
    container.innerHTML = chartHTML || '<p>No data yet</p>';
}

function updateCategoryDistribution(tasks) {
    const container = document.getElementById('categoryDistribution');
    if (!container) {
        console.log('📊 Category distribution container not found');
        return;
    }
    
    const categories = {};
    tasks.forEach(task => {
        const cat = task.category || 'other';
        categories[cat] = (categories[cat] || 0) + 1;
    });
    
    const total = tasks.length;
    if (total === 0) {
        container.innerHTML = '<p>No tasks yet</p>';
        return;
    }
    
    const categoryHTML = Object.entries(categories).map(([category, count]) => `
        <div class="category-item">
            <span class="category-name">${category}</span>
            <div class="category-bar">
                <div class="category-fill" style="width: ${(count / total) * 100}%"></div>
            </div>
            <span class="category-count">${count}</span>
        </div>
    `).join('');
    
    container.innerHTML = categoryHTML;
}