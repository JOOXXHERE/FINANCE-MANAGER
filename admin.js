const DB_KEY = 'financeManager_LocalDB';
let db = { users: [], bills: [], logs: [] };

// DOM Elements
const userTableBody = document.getElementById('user-table-body');
const userSearch = document.getElementById('user-search');
const totalUsersCount = document.getElementById('total-users-count');
const activeTrialsCount = document.getElementById('active-trials-count');
const expiredAccountsCount = document.getElementById('expired-accounts-count');
const refreshBtn = document.getElementById('refresh-btn');

// Modal Elements
const userModal = document.getElementById('user-modal');
const modalUserName = document.getElementById('modal-user-name');
const billsTableBody = document.getElementById('bills-table-body');
const closeModal = document.querySelector('.close-modal');

// Initialize
function init() {
    loadData();
    setupEventListeners();
}

function loadData() {
    const data = localStorage.getItem(DB_KEY);
    db = data ? JSON.parse(data) : { users: [], bills: [], logs: [] };
    renderUsers(db.users);
    updateStats();
}

function updateStats() {
    totalUsersCount.textContent = db.users.length;
    
    let active = 0;
    let expired = 0;
    const now = new Date();
    
    db.users.forEach(user => {
        const start = new Date(user.trial_start_date);
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 3) active++;
        else expired++;
    });
    
    activeTrialsCount.textContent = active;
    expiredAccountsCount.textContent = expired;
}

function renderUsers(users) {
    userTableBody.innerHTML = '';
    const now = new Date();
    
    users.forEach(user => {
        const start = new Date(user.trial_start_date);
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isExpired = diffDays > 3;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="user-profile">
                    <img src="${user.profile_pic || ''}" alt="">
                    <span>${user.name}</span>
                </div>
            </td>
            <td>@${user.username}</td>
            <td>${new Date(user.trial_start_date).toLocaleDateString()}</td>
            <td>
                <span class="badge ${isExpired ? 'badge-expired' : 'badge-active'}">
                    ${isExpired ? 'Expired' : 'Active'}
                </span>
            </td>
            <td>
                <button class="action-btn" onclick="viewBills('${user.username}', '${user.name}')">Bills</button>
                <button class="action-btn secondary-btn" onclick="extendValidity('${user.username}')">Extend</button>
            </td>
        `;
        userTableBody.appendChild(row);
    });
}

// Search Logic
userSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = db.users.filter(u => 
        u.name.toLowerCase().includes(query) || 
        u.username.toLowerCase().includes(query)
    );
    renderUsers(filtered);
});

// View Bills Logic
function viewBills(username, name) {
    modalUserName.textContent = `Bills for ${name}`;
    const userBills = db.bills.filter(b => b.username === username);
    
    billsTableBody.innerHTML = '';
    if (userBills.length === 0) {
        billsTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center">No bills found</td></tr>';
    } else {
        // Sort by date newest first
        const sorted = [...userBills].sort((a,b) => new Date(b.date) - new Date(a.date));
        sorted.forEach(bill => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(bill.date).toLocaleDateString()}</td>
                <td>${bill.merchant}</td>
                <td>$${bill.amount.toFixed(2)}</td>
            `;
            billsTableBody.appendChild(row);
        });
    }
    userModal.classList.remove('hidden');
}

// Extend Validity Logic
let selectedUsernameForExtension = null;
const validityModal = document.getElementById('validity-modal');
const closeValidity = document.querySelector('.close-validity');

function extendValidity(username) {
    selectedUsernameForExtension = username;
    validityModal.classList.remove('hidden');
}

function applyExtension(days) {
    if (!selectedUsernameForExtension) return;
    
    const userIndex = db.users.findIndex(u => u.username === selectedUsernameForExtension);
    if (userIndex !== -1) {
        const newStartDate = new Date();
        
        if (days > 0) {
            // Add the specified number of days
            newStartDate.setDate(newStartDate.getDate() + days);
        }
        // if days is 0, newStartDate stays at 'now', giving them exactly 1 minute trial
        
        db.users[userIndex].trial_start_date = newStartDate.toISOString();
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        
        showToast(days === 0 ? 'Trial Reset: 1 Minute Granted' : `Access Extended for ${days} days`);
        validityModal.classList.add('hidden');
        loadData(); // Refresh list
        
        // Update active session if necessary
        const activeUser = JSON.parse(localStorage.getItem('financeManagerActiveUser'));
        if (activeUser && activeUser.username === selectedUsernameForExtension) {
            activeUser.trial_start_date = db.users[userIndex].trial_start_date;
            localStorage.setItem('financeManagerActiveUser', JSON.stringify(activeUser));
        }
    }
}

// Global functions for inline onclicks
window.viewBills = viewBills;
window.extendValidity = extendValidity;
window.applyExtension = applyExtension;

function setupEventListeners() {
    closeModal.addEventListener('click', () => {
        userModal.classList.add('hidden');
    });

    closeValidity.addEventListener('click', () => {
        validityModal.classList.add('hidden');
    });
    
    refreshBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loadData();
        showToast('Data Refreshed');
    });
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

init();
