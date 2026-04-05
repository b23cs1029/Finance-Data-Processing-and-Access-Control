// ============================================
// ZORVYN FINANCE — CLIENT APPLICATION
// ============================================

// ---- STATE ----
let authToken = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user'));
let currentPage = 'dashboard';
let recordsPage = 1;
let trendsChart = null;
let categoryChart = null;
let expenseTrendChart = null;
let profitMarginsChart = null;
let debounceTimer = null;
let recordsCache = {}; // Store records for edit modal lookup

// ---- DOM REFS ----
const $ = id => document.getElementById(id);

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
    if (authToken && currentUser) {
        showApp();
    }
});

// ============================================
// AUTH
// ============================================
function switchAuthTab(tab) {
    $('auth-error').innerText = '';
    if (tab === 'login') {
        $('login-form').classList.remove('hidden');
        $('register-form').classList.add('hidden');
        $('tab-login').classList.add('active');
        $('tab-register').classList.remove('active');
    } else {
        $('login-form').classList.add('hidden');
        $('register-form').classList.remove('hidden');
        $('tab-login').classList.remove('active');
        $('tab-register').classList.add('active');
    }
}

// Login
$('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const data = await apiCall('/auth/login', 'POST', {
            companyName: $('login-company').value.trim(),
            email: $('login-email').value.trim(),
            password: $('login-password').value
        });
        handleAuthSuccess(data);
    } catch (err) {
        $('auth-error').innerText = err.message;
    }
});

// Register
$('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const data = await apiCall('/auth/register', 'POST', {
            companyName: $('reg-company-name').value.trim(),
            companyCode: $('reg-company-code').value.trim(),
            name: $('reg-name').value.trim(),
            email: $('reg-email').value.trim(),
            password: $('reg-password').value,
            role: $('reg-role').value
        });
        handleAuthSuccess(data);
    } catch (err) {
        $('auth-error').innerText = err.message;
    }
});

function handleAuthSuccess(resData) {
    authToken = resData.token;
    currentUser = resData.data.user;
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(currentUser));
    showApp();
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    $('auth-container').classList.remove('hidden');
    $('app-layout').classList.add('hidden');
    // Reset forms
    $('login-form').reset();
    $('register-form').reset();
    $('auth-error').innerText = '';
    // Destroy charts
    if (trendsChart) { trendsChart.destroy(); trendsChart = null; }
    if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
    if (expenseTrendChart) { expenseTrendChart.destroy(); expenseTrendChart = null; }
    if (profitMarginsChart) { profitMarginsChart.destroy(); profitMarginsChart = null; }
}

// ============================================
// APP SHELL
// ============================================
function showApp() {
    $('auth-container').classList.add('hidden');
    $('app-layout').classList.remove('hidden');

    // Populate sidebar
    $('sidebar-company').innerText = currentUser.companyName || 'COMPANY';
    $('user-name').innerText = currentUser.name;
    $('user-role').innerText = currentUser.role;
    $('user-avatar').innerText = currentUser.name.charAt(0).toUpperCase();

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    $('greeting-text').innerText = `${greeting}, ${currentUser.name.split(' ')[0]}`;

    // Role badge
    const badge = $('header-role-badge');
    badge.innerText = currentUser.role;
    badge.className = 'role-badge role-' + currentUser.role.toLowerCase();

    // Role-based nav visibility
    if (currentUser.role === 'Viewer') {
        $('nav-records').classList.add('hidden');
        $('nav-users').classList.add('hidden');
    } else if (currentUser.role === 'Analyst') {
        $('nav-records').classList.remove('hidden');
        $('nav-users').classList.add('hidden');
    } else {
        // Admin
        $('nav-records').classList.remove('hidden');
        $('nav-users').classList.remove('hidden');
    }

    navigateTo('dashboard');
}

// ============================================
// NAVIGATION
// ============================================
function navigateTo(page) {
    currentPage = page;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Show/hide pages
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    $(`page-${page}`).classList.remove('hidden');

    // Load page data
    if (page === 'dashboard') loadDashboard();
    else if (page === 'records') loadRecords();
    else if (page === 'users') loadUsers();
}

// ============================================
// API HELPER
// ============================================
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const response = await fetch(`/api/v1${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    });

    // Handle 204 No Content
    if (response.status === 204) return { status: 'success' };

    const data = await response.json();
    if (!response.ok) {
        if (response.status === 401) {
            logout();
            throw new Error('Session expired. Please sign in again.');
        }
        throw new Error(data.message || 'Something went wrong');
    }
    return data;
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
    const container = $('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================
// FORMATTERS
// ============================================
const formatMoney = (val) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD'
}).format(val);

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
});

// ============================================
// DASHBOARD PAGE (Role-Aware)
// ============================================
async function loadDashboard() {
    const isViewer = currentUser.role === 'Viewer';

    if (isViewer) {
        // Show viewer dashboard, hide analyst dashboard
        $('viewer-dashboard').classList.remove('hidden');
        $('analyst-dashboard').classList.add('hidden');
        await loadViewerDashboard();
    } else {
        // Show analyst dashboard, hide viewer dashboard
        $('viewer-dashboard').classList.add('hidden');
        $('analyst-dashboard').classList.remove('hidden');
        await loadAnalystDashboard();
    }
}

// ---- VIEWER: Simple 3-card dashboard ----
async function loadViewerDashboard() {
    try {
        const summaryRes = await apiCall('/summary');
        const data = summaryRes.data;

        $('viewer-stat-income').innerText = formatMoney(data.totalIncome);
        $('viewer-stat-expense').innerText = formatMoney(data.totalExpense);
        $('viewer-stat-balance').innerText = formatMoney(data.netBalance);

        // Color the balance based on positive/negative
        const balEl = $('viewer-stat-balance');
        if (data.netBalance >= 0) {
            balEl.style.color = 'var(--success)';
        } else {
            balEl.style.color = 'var(--danger)';
        }
    } catch (err) {
        console.error('Viewer dashboard error:', err);
        showToast(err.message, 'error');
    }
}

// ---- ANALYST / ADMIN: Full analytics dashboard ----
async function loadAnalystDashboard() {
    try {
        const [summaryRes, trendsRes, analyticsRes] = await Promise.all([
            apiCall('/summary'),
            apiCall('/summary/trends'),
            apiCall('/summary/analytics')
        ]);

        const data = summaryRes.data;
        const trends = trendsRes.data.trends;
        const analytics = analyticsRes.data;

        // Update stat cards
        $('stat-income').innerText = formatMoney(data.totalIncome);
        $('stat-expense').innerText = formatMoney(data.totalExpense);
        $('stat-balance').innerText = formatMoney(data.netBalance);
        $('stat-records').innerText = data.totalRecords;

        // Render existing charts
        renderTrendsChart(trends);
        renderCategoryChart(data.categories.expense);

        // Render analytics
        renderAnalytics(analytics);

        // Render recent activity
        renderRecentActivity(data.recentActivity);

    } catch (err) {
        console.error('Dashboard error:', err);
        showToast(err.message, 'error');
    }
}

// ============================================
// ANALYTICS RENDERING
// ============================================
function renderAnalytics(analytics) {
    const { monthly, meanTrend, statistics } = analytics;

    // 1) Expense Trend + Mean overlay chart
    renderExpenseTrendChart(monthly, meanTrend);

    // 2) Profit & Margins chart
    renderProfitMarginsChart(monthly);

    // 3) Statistical insight cards
    $('stat-variability').innerText = formatMoney(statistics.variability);
    $('stat-median').innerText = formatMoney(statistics.median);
    $('stat-mean').innerText = formatMoney(statistics.mean);
    $('stat-mode').innerText = statistics.mode > 0 ? formatMoney(statistics.mode) : 'No mode';
    $('stat-sample').innerText = statistics.sampleSize;

    // Animate insight bars (relative to mean as baseline)
    const maxVal = Math.max(statistics.mean, statistics.median, statistics.variability, statistics.mode || 0, 1);
    animateBar('risk-bar-fill', statistics.variability, maxVal);
    animateBar('median-bar-fill', statistics.median, maxVal);
    animateBar('mean-bar-fill', statistics.mean, maxVal);
    animateBar('mode-bar-fill', statistics.mode, maxVal);
}

function animateBar(id, value, maxVal) {
    const el = $(id);
    if (!el) return;
    const pct = maxVal > 0 ? Math.min((value / maxVal) * 100, 100) : 0;
    setTimeout(() => {
        el.style.width = pct + '%';
    }, 100);
}

function renderExpenseTrendChart(monthly, meanTrend) {
    const ctx = $('expense-trend-chart');
    if (expenseTrendChart) expenseTrendChart.destroy();

    expenseTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: monthly.map(m => m.label),
            datasets: [
                {
                    label: 'Monthly Expense',
                    data: monthly.map(m => m.expense),
                    borderColor: '#f43f5e',
                    backgroundColor: 'rgba(244, 63, 94, 0.08)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#f43f5e',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    borderWidth: 2.5
                },
                {
                    label: 'Mean Trend',
                    data: meanTrend,
                    borderColor: '#f59e0b',
                    borderDash: [8, 4],
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: '#f59e0b',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#8892b0', font: { family: 'Inter', size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#5a6380', font: { family: 'Inter', size: 11 } },
                    grid: { color: 'rgba(100,120,200,0.06)' }
                },
                y: {
                    ticks: {
                        color: '#5a6380',
                        font: { family: 'Inter', size: 11 },
                        callback: v => '$' + v.toLocaleString()
                    },
                    grid: { color: 'rgba(100,120,200,0.06)' }
                }
            }
        }
    });
}

function renderProfitMarginsChart(monthly) {
    const ctx = $('profit-margins-chart');
    if (profitMarginsChart) profitMarginsChart.destroy();

    const profits = monthly.map(m => m.profit);
    const barColors = profits.map(p => p >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(244, 63, 94, 0.7)');
    const borderColors = profits.map(p => p >= 0 ? '#10b981' : '#f43f5e');

    profitMarginsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthly.map(m => m.label),
            datasets: [
                {
                    label: 'Profit',
                    data: profits,
                    backgroundColor: barColors,
                    borderColor: borderColors,
                    borderWidth: 1.5,
                    borderRadius: 6,
                    barPercentage: 0.6
                },
                {
                    label: 'Margin %',
                    data: monthly.map(m => m.margin),
                    type: 'line',
                    borderColor: '#8b5cf6',
                    backgroundColor: 'transparent',
                    pointBackgroundColor: '#8b5cf6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    tension: 0.4,
                    borderWidth: 2,
                    yAxisID: 'yMargin'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#8892b0', font: { family: 'Inter', size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.dataset.yAxisID === 'yMargin') {
                                return `Margin: ${ctx.parsed.y}%`;
                            }
                            return `Profit: $${ctx.parsed.y.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#5a6380', font: { family: 'Inter', size: 11 } },
                    grid: { color: 'rgba(100,120,200,0.06)' }
                },
                y: {
                    position: 'left',
                    ticks: {
                        color: '#5a6380',
                        font: { family: 'Inter', size: 11 },
                        callback: v => '$' + v.toLocaleString()
                    },
                    grid: { color: 'rgba(100,120,200,0.06)' }
                },
                yMargin: {
                    position: 'right',
                    ticks: {
                        color: '#8b5cf6',
                        font: { family: 'Inter', size: 11 },
                        callback: v => v + '%'
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// ============================================
// EXISTING CHARTS (Monthly Trends + Category)
// ============================================
function renderTrendsChart(trends) {
    const ctx = $('trends-chart');
    if (trendsChart) trendsChart.destroy();

    trendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trends.map(t => t.label),
            datasets: [
                {
                    label: 'Income',
                    data: trends.map(t => t.income),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#10b981'
                },
                {
                    label: 'Expenses',
                    data: trends.map(t => t.expense),
                    borderColor: '#f43f5e',
                    backgroundColor: 'rgba(244, 63, 94, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#f43f5e'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#8892b0', font: { family: 'Inter', size: 12 } }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#5a6380', font: { family: 'Inter', size: 11 } },
                    grid: { color: 'rgba(100,120,200,0.06)' }
                },
                y: {
                    ticks: {
                        color: '#5a6380',
                        font: { family: 'Inter', size: 11 },
                        callback: v => '$' + v.toLocaleString()
                    },
                    grid: { color: 'rgba(100,120,200,0.06)' }
                }
            }
        }
    });
}

function renderCategoryChart(expenseCategories) {
    const ctx = $('category-chart');
    if (categoryChart) categoryChart.destroy();

    if (!expenseCategories || expenseCategories.length === 0) {
        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['No Data'],
                datasets: [{ data: [1], backgroundColor: ['rgba(100,120,200,0.1)'], borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#5a6380', font: { family: 'Inter' } } }
                }
            }
        });
        return;
    }

    const colors = ['#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: expenseCategories.map(c => c._id.category),
            datasets: [{
                data: expenseCategories.map(c => c.totalAmount),
                backgroundColor: expenseCategories.map((_, i) => colors[i % colors.length]),
                borderWidth: 0,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#8892b0',
                        font: { family: 'Inter', size: 11 },
                        padding: 12,
                        usePointStyle: true,
                        pointStyleWidth: 8
                    }
                }
            }
        }
    });
}

function renderRecentActivity(activities) {
    const tbody = $('activity-tbody');
    tbody.innerHTML = '';

    if (!activities || activities.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:40px">No recent activity yet</td></tr>`;
        return;
    }

    activities.forEach(a => {
        const isIncome = a.type === 'income';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(a.date)}</td>
            <td><span class="${isIncome ? 'type-income' : 'type-expense'}">${a.type.charAt(0).toUpperCase() + a.type.slice(1)}</span></td>
            <td>${a.category}</td>
            <td class="text-muted">${a.notes || '—'}</td>
            <td class="text-right" style="font-weight:600; color: ${isIncome ? 'var(--success)' : 'var(--danger)'}">
                ${isIncome ? '+' : '-'}${formatMoney(a.amount)}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================
// RECORDS PAGE
// ============================================
function debounceLoadRecords() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadRecords(), 400);
}

async function loadRecords() {
    try {
        // Build query params
        const params = new URLSearchParams();
        params.set('page', recordsPage);
        params.set('limit', 10);

        const type = $('filter-type').value;
        const category = $('filter-category').value.trim();
        const dateFrom = $('filter-from').value;
        const dateTo = $('filter-to').value;

        if (type) params.set('type', type);
        if (category) params.set('category', category);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);

        const res = await apiCall(`/records?${params.toString()}`);
        const { records, pagination } = res.data;

        // Hide actions column for non-admins
        const actionsHeader = $('records-actions-th');
        if (currentUser.role !== 'Admin') {
            actionsHeader.classList.add('hidden');
            $('btn-add-record').classList.add('hidden');
        } else {
            actionsHeader.classList.remove('hidden');
            $('btn-add-record').classList.remove('hidden');
        }

        const tbody = $('records-tbody');
        tbody.innerHTML = '';

        if (records.length === 0) {
            const colSpan = currentUser.role === 'Admin' ? 7 : 6;
            tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-muted" style="padding:40px">No records found</td></tr>`;
        } else {
            recordsCache = {};
            records.forEach(r => {
                recordsCache[r._id] = r;
                const isIncome = r.type === 'income';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDate(r.date)}</td>
                    <td><span class="${isIncome ? 'type-income' : 'type-expense'}">${r.type.charAt(0).toUpperCase() + r.type.slice(1)}</span></td>
                    <td>${r.category}</td>
                    <td class="text-muted">${r.notes || '—'}</td>
                    <td class="text-muted">${r.createdBy ? r.createdBy.name : '—'}</td>
                    <td class="text-right" style="font-weight:600; color:${isIncome ? 'var(--success)' : 'var(--danger)'}">
                        ${isIncome ? '+' : '-'}${formatMoney(r.amount)}
                    </td>
                    ${currentUser.role === 'Admin' ? `
                    <td class="text-right">
                        <div class="actions">
                            <button class="btn btn-outline btn-icon" title="Edit" onclick="openEditRecordModal('${r._id}')">✏️</button>
                            <button class="btn btn-danger btn-icon" title="Delete" onclick="deleteRecord('${r._id}')">🗑️</button>
                        </div>
                    </td>` : ''}
                `;
                tbody.appendChild(tr);
            });
        }

        // Render pagination
        renderPagination(pagination);

    } catch (err) {
        console.error('Records error:', err);
        showToast(err.message, 'error');
    }
}

function renderPagination(pag) {
    const container = $('records-pagination');
    if (!pag || pag.totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    html += `<button class="btn btn-outline btn-sm" ${pag.page <= 1 ? 'disabled' : ''} onclick="goToPage(${pag.page - 1})">← Prev</button>`;
    html += `<span class="pagination-info">Page ${pag.page} of ${pag.totalPages} (${pag.total} records)</span>`;
    html += `<button class="btn btn-outline btn-sm" ${pag.page >= pag.totalPages ? 'disabled' : ''} onclick="goToPage(${pag.page + 1})">Next →</button>`;

    container.innerHTML = html;
}

function goToPage(page) {
    recordsPage = page;
    loadRecords();
}

// ============================================
// RECORD MODAL (Add / Edit)
// ============================================
function openRecordModal() {
    $('modal-title').innerText = 'New Record';
    $('modal-body').innerHTML = `
        <form id="record-form" onsubmit="submitRecord(event)">
            <div class="form-group">
                <label>Amount ($)</label>
                <input type="number" id="rec-amount" required min="0.01" step="0.01" placeholder="0.00">
            </div>
            <div class="form-group">
                <label>Type</label>
                <select id="rec-type">
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                </select>
            </div>
            <div class="form-group">
                <label>Category</label>
                <input type="text" id="rec-category" required placeholder="e.g. Salary, Rent, Food">
            </div>
            <div class="form-group">
                <label>Date</label>
                <input type="date" id="rec-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
                <label>Notes</label>
                <input type="text" id="rec-notes" placeholder="Optional description...">
            </div>
            <button type="submit" class="btn btn-primary w-100">Add Record</button>
        </form>
    `;
    $('modal-overlay').classList.remove('hidden');
}

function openEditRecordModal(id) {
    const record = recordsCache[id];
    if (!record) {
        showToast('Record not found', 'error');
        return;
    }
    $('modal-title').innerText = 'Edit Record';
    $('modal-body').innerHTML = `
        <form onsubmit="submitEditRecord(event, '${id}')">
            <div class="form-group">
                <label>Amount ($)</label>
                <input type="number" id="edit-amount" required min="0.01" step="0.01" value="${record.amount}">
            </div>
            <div class="form-group">
                <label>Type</label>
                <select id="edit-type">
                    <option value="income" ${record.type === 'income' ? 'selected' : ''}>Income</option>
                    <option value="expense" ${record.type === 'expense' ? 'selected' : ''}>Expense</option>
                </select>
            </div>
            <div class="form-group">
                <label>Category</label>
                <input type="text" id="edit-category" required value="${record.category}">
            </div>
            <div class="form-group">
                <label>Date</label>
                <input type="date" id="edit-date" value="${new Date(record.date).toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
                <label>Notes</label>
                <input type="text" id="edit-notes" value="${record.notes || ''}">
            </div>
            <button type="submit" class="btn btn-primary w-100">Save Changes</button>
        </form>
    `;
    $('modal-overlay').classList.remove('hidden');
}

async function submitRecord(e) {
    e.preventDefault();
    try {
        await apiCall('/records', 'POST', {
            amount: parseFloat($('rec-amount').value),
            type: $('rec-type').value,
            category: $('rec-category').value.trim(),
            date: $('rec-date').value || undefined,
            notes: $('rec-notes').value.trim()
        });
        closeModal();
        showToast('Record added successfully!', 'success');
        loadRecords();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function submitEditRecord(e, id) {
    e.preventDefault();
    try {
        await apiCall(`/records/${id}`, 'PATCH', {
            amount: parseFloat($('edit-amount').value),
            type: $('edit-type').value,
            category: $('edit-category').value.trim(),
            date: $('edit-date').value,
            notes: $('edit-notes').value.trim()
        });
        closeModal();
        showToast('Record updated!', 'success');
        loadRecords();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteRecord(id) {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
        await apiCall(`/records/${id}`, 'DELETE');
        showToast('Record deleted', 'success');
        loadRecords();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============================================
// USERS PAGE (Admin Only)
// ============================================
async function loadUsers() {
    if (currentUser.role !== 'Admin') return;

    try {
        const res = await apiCall('/users');
        const { users } = res.data;

        const tbody = $('users-tbody');
        tbody.innerHTML = '';

        users.forEach(u => {
            const isSelf = u._id === currentUser._id;
            const isActive = u.isActive !== false;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:500">${u.name} ${isSelf ? '<span class="text-muted">(You)</span>' : ''}</td>
                <td class="text-muted">${u.email}</td>
                <td>
                    ${isSelf ? `<span class="role-badge role-${u.role.toLowerCase()}">${u.role}</span>` : `
                    <select class="role-select" onchange="changeUserRole('${u._id}', this.value)" style="padding:4px 8px; background:var(--bg-input); border:1px solid var(--border-color); border-radius:6px; color:var(--text-primary); font-size:12px; font-family:inherit;">
                        <option value="Viewer" ${u.role === 'Viewer' ? 'selected' : ''}>Viewer</option>
                        <option value="Analyst" ${u.role === 'Analyst' ? 'selected' : ''}>Analyst</option>
                        <option value="Admin" ${u.role === 'Admin' ? 'selected' : ''}>Admin</option>
                    </select>`}
                </td>
                <td>
                    <span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">
                        ${isActive ? '● Active' : '● Inactive'}
                    </span>
                </td>
                <td class="text-muted">${formatDate(u.createdAt)}</td>
                <td class="text-right">
                    ${isSelf ? '<span class="text-muted">—</span>' : `
                    <div class="actions">
                        <button class="btn ${isActive ? 'btn-danger' : 'btn-success'} btn-sm" onclick="toggleUserStatus('${u._id}')">
                            ${isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="btn btn-danger btn-icon btn-sm" title="Delete" onclick="deleteUser('${u._id}', '${u.name}')">🗑️</button>
                    </div>`}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error('Users error:', err);
        showToast(err.message, 'error');
    }
}

async function changeUserRole(userId, newRole) {
    try {
        await apiCall(`/users/${userId}/role`, 'PATCH', { role: newRole });
        showToast(`Role updated to ${newRole}`, 'success');
        loadUsers();
    } catch (err) {
        showToast(err.message, 'error');
        loadUsers();
    }
}

async function toggleUserStatus(userId) {
    try {
        await apiCall(`/users/${userId}/status`, 'PATCH');
        showToast('User status updated', 'success');
        loadUsers();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteUser(userId, name) {
    if (!confirm(`Are you sure you want to permanently delete "${name}"?`)) return;
    try {
        await apiCall(`/users/${userId}`, 'DELETE');
        showToast('User deleted', 'success');
        loadUsers();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============================================
// MODAL UTILS
// ============================================
function closeModal(event) {
    if (event && event.target !== $('modal-overlay')) return;
    $('modal-overlay').classList.add('hidden');
}
