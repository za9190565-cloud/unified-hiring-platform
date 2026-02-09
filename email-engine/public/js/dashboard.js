/**
 * Mursel Smart Dashboard - Frontend Logic
 */

let users = [
    { id: 'user123', name: 'أحمد العتيبي', email: 'a.otaibi@example.com', status: 'verified', lastReply: 'قبل ساعتين', reputation: 90 },
    { id: 'user456', name: 'سارة الغامدي', email: 's.ghamdi@example.com', status: 'pending', lastReply: '-', reputation: 45 },
    { id: 'user789', name: 'خالد الدوسري', email: 'k.dosari@example.com', status: 'verified', lastReply: 'أمس', reputation: 75 },
    { id: 'user101', name: 'نورة المطيري', email: 'n.mutairi@example.com', status: 'pending', lastReply: '-', reputation: 30 }
];

// Tab Switching
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));

    document.getElementById(`${tabId}-tab`).classList.add('active');
    event.currentTarget.classList.add('active');

    const titles = { stats: 'الإحصائيات', users: 'قائمة الإرسال', logs: 'السجلات', config: 'الإعدادات' };
    document.getElementById('page-title').innerText = titles[tabId];
}

// Render Users
function renderUsers(data = users) {
    const tbody = document.getElementById('user-list');
    tbody.innerHTML = '';

    data.forEach(u => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: bold;">${u.name}</span>
                    <span style="font-size: 11px; color: var(--text-muted);">${u.email}</span>
                </div>
            </td>
            <td><span class="badge ${u.status}">${u.status}</span></td>
            <td>${u.lastReply}</td>
            <td><div class="rep-bar" style="width: ${u.reputation}%; background: ${u.reputation > 70 ? 'var(--success)' : 'var(--warning)'}"></div></td>
            <td id="sent-by-${u.id}" style="font-size: 11px; color: var(--text-muted);">-</td>
            <td>
                <button class="btn btn-icon ${u.status !== 'verified' ? 'disabled' : ''}" onclick="sendIndividual('${u.id}')">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Search & Filter
function filterUsers() {
    const query = document.getElementById('user-search').value.toLowerCase();
    const status = document.getElementById('status-filter').value;

    const filtered = users.filter(u => {
        const matchesQuery = u.name.toLowerCase().includes(query) || u.id.toLowerCase().includes(query);
        const matchesStatus = status === 'all' || u.status === status;
        return matchesQuery && matchesStatus;
    });

    renderUsers(filtered);
}

// Live Logs
function addLog(msg, type = 'info') {
    const container = document.getElementById('live-logs');
    const time = new Date().toLocaleTimeString('ar-EG');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-time">${time}</span> <span class="log-tag tag-${type}">[${type.toUpperCase()}]</span> ${msg}`;
    container.prepend(entry);
    
    // Keep only last 100 logs
    while (container.children.length > 100) {
        container.removeChild(container.lastChild);
    }
}

function clearLogs() {
    document.getElementById('live-logs').innerHTML = '';
}

// Toast
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Stats Polling
async function refreshStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        document.getElementById('stat-total-sent').innerText = data.totalSent || 0;
        document.getElementById('stat-reply-rate').innerText = `${data.replyRate || 0}%`;
        document.getElementById('stat-queue-size').innerText = data.queue ? data.queue.waiting : 0;

        // Render Connectors
        if (data.connectors) {
            renderConnectors(data.connectors);
        }

        // Update recent jobs
        if (data.recentJobs && data.recentJobs.length > 0) {
            updateRecentJobs(data.recentJobs);
        }

        // Randomize chart for visual flavor
        const bars = document.querySelectorAll('.bar');
        bars.forEach(b => {
            b.style.height = `${Math.floor(Math.random() * 80) + 20}%`;
        });
    } catch (e) {
        console.error('Failed to fetch stats', e);
    }
}

// Render Connectors
function renderConnectors(connectors) {
    const container = document.getElementById('connectors-status');
    if (!container) return;
    container.innerHTML = '';

    connectors.forEach(c => {
        const div = document.createElement('div');
        div.className = 'connector-bubble';
        div.innerHTML = `<div class="dot ${c.status}"></div> <span>${c.email}</span>`;
        container.appendChild(div);
    });
}

// Update Recent Jobs in UI
function updateRecentJobs(jobs) {
    jobs.forEach(job => {
        if (job.result && job.result.success) {
            const leadId = job.data.leadId;
            const sentBy = job.result.by;
            const sentAt = new Date(job.result.sentAt).toLocaleTimeString('ar-EG');
            
            // Update user table if exists
            const cell = document.getElementById(`sent-by-${leadId}`);
            if (cell) {
                cell.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> ${sentBy}<br><small>${sentAt}</small>`;
            }
            
            // Add to logs
            addLog(`تم إرسال رسالة إلى ${job.result.to} عبر ${sentBy}`, 'success');
        }
    });
}

// Actions
async function syncAll() {
    addLog('بدء مزامنة كافة المستخدمين من tryeverengine.com...', 'info');
    showToast('جاري المزامنة...');

    // Simulate API call
    setTimeout(() => {
        addLog('تمت مزامنة 142 مستخدم بنجاح.', 'success');
        showToast('تمت المزامنة بنجاح');
    }, 2000);
}

async function saveConfig(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const config = Object.fromEntries(formData.entries());

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                warmup: { min: parseInt(config.warmupMin), max: parseInt(config.warmupMax) },
                cooldown: { perDomainPerMinute: parseInt(config.perMin) }
            })
        });

        if (res.ok) {
            showToast('تم حفظ الإعدادات بنجاح');
            addLog('تم تحديث إعدادات المحرك ديناميكياً.', 'success');
        }
    } catch (err) {
        showToast('فشل حفظ الإعدادات');
    }
}

function sendIndividual(id) {
    const user = users.find(u => u.id === id);
    if (!user || user.status !== 'verified') return;
    
    fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, email: user.email })
    }).then(res => res.json())
      .then(data => {
          if (data.success) {
              addLog(`تم إلحاق ${user.name} في طابور الإرسال`, 'success');
              showToast('تم الإلحاق في الطابور');
          }
      });
}

async function startSending() {
    const verifiedUsers = users.filter(u => u.status === 'verified');
    
    if (verifiedUsers.length === 0) {
        showToast('لا يوجد مستخدمين مفعلين');
        return;
    }
    
    addLog(`🚀 بدء الإرسال الجماعي لـ ${verifiedUsers.length} مستخدم`, 'info');
    showToast(`جاري إرسال ${verifiedUsers.length} رسالة...`);
    
    try {
        const res = await fetch('/api/send/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                users: verifiedUsers.map(u => ({ id: u.id, email: u.email, name: u.name }))
            })
        });
        
        const data = await res.json();
        if (data.success) {
            addLog(`✅ تم إلحاق ${data.queued} رسالة في طابور الإرسال`, 'success');
            showToast('تم بدء الإرسال بنجاح');
        }
    } catch (err) {
        addLog('❌ فشل بدء الإرسال', 'error');
        showToast('حدث خطأ');
    }
}

function exportData(format) {
    showToast(`جاري تصدير البيانات بصيغة ${format.toUpperCase()}...`);
}

// Init
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('current-date').innerText = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
    renderUsers();
    setInterval(refreshStats, 5000);
    refreshStats();
    addLog('لوحة تحكم مرسل الذكي جاهزة للعمل.', 'success');
});
addLog('لوحة تحكم مرسل الذكي جاهزة العمل.', 'success');
