// Configuration
const DB_KEY = 'financeManager_LocalDB';
const TRIAL_DURATION_MS = 60 * 1000; // 1 Minute

// State Management
let appState = {
    user: null,
    transactions: [],
    currency: 'USD',
    rates: { USD: 1, EUR: 0.93, GBP: 0.79, INR: 83.5, JPY: 156.0 }, // Fallback rates
    chart: null
};

// Currency Config
const currencyConfig = {
    USD: { symbol: '$', locale: 'en-US' },
    EUR: { symbol: '€', locale: 'de-DE' },
    GBP: { symbol: '£', locale: 'en-GB' },
    INR: { symbol: '₹', locale: 'en-IN' },
    JPY: { symbol: '¥', locale: 'ja-JP' }
};

// DOM Elements
const screens = {
    login: document.getElementById('login-screen'),
    dashboard: document.getElementById('dashboard-screen'),
    manual: document.getElementById('manual-screen'),
    editProfile: document.getElementById('edit-profile-screen'),
    paywall: document.getElementById('paywall-screen')
};

const currencySelect = document.getElementById('currency-select');

// Utility to switch screens
function showScreen(screenName) {
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
        screen.classList.add('hidden');
    });
    
    screens[screenName].classList.remove('hidden');
    setTimeout(() => screens[screenName].classList.add('active'), 50);
}

// Toast Notification
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Fetch Real-time Rates
async function fetchRates() {
    try {
        const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,INR,JPY');
        const data = await res.json();
        appState.rates = { USD: 1, ...data.rates };
        console.log('Real-time rates updated:', appState.rates);
    } catch (e) {
        console.warn('Using fallback exchange rates');
    }
}

// Format Currency
function formatCurrency(amountUSD) {
    const rate = appState.rates[appState.currency] || 1;
    const converted = amountUSD * rate;
    const config = currencyConfig[appState.currency];
    return new Intl.NumberFormat(config.locale, { 
        style: 'currency', 
        currency: appState.currency 
    }).format(converted);
}

// Initialize App
async function init() {
    const savedUser = localStorage.getItem('financeManagerActiveUser');
    const savedCurrency = localStorage.getItem('financeManagerCurrency');
    
    await fetchRates();

    if (savedCurrency) {
        appState.currency = savedCurrency;
        if (currencySelect) currencySelect.value = savedCurrency;
    }

    if (savedUser) {
        appState.user = JSON.parse(savedUser);
        loadUserTransactions();
        if (checkTrialStatus()) {
            showScreen('paywall');
        } else {
            updateDashboard();
            showScreen('dashboard');
        }
    } else {
        showScreen('login');
    }

    // Refresh trial status every 10 seconds
    setInterval(() => {
        if (screens.dashboard.classList.contains('active')) {
            if (checkTrialStatus()) showScreen('paywall');
        }
    }, 10000);
}

// Database Helpers
function getDB() {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : { users: [], bills: [], logs: [] };
}

function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// Trial Logic
function checkTrialStatus() {
    if (!appState.user || !appState.user.trial_start_date) return false;
    
    const start = new Date(appState.user.trial_start_date);
    const now = new Date();
    
    if (now < start) {
        const trialDaysEl = document.getElementById('trial-days');
        if (trialDaysEl) {
            const diff = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
            trialDaysEl.textContent = diff > 1000 ? "LIFETIME ACCESS ACTIVE" : `PREMIUM ACTIVE: ${diff} DAYS LEFT`;
        }
        return false;
    }

    const elapsed = now - start;
    if (elapsed > TRIAL_DURATION_MS) return true;
    
    const secondsLeft = Math.ceil((TRIAL_DURATION_MS - elapsed) / 1000);
    const trialDaysEl = document.getElementById('trial-days');
    if (trialDaysEl) trialDaysEl.textContent = `Trial active: ${secondsLeft}s left`;
    return false;
}

// Login Handling
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name-input').value;
    const username = document.getElementById('username-input').value;
    const picBg = document.getElementById('profile-preview-label').style.backgroundImage;
    const pic = picBg !== '' ? picBg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '') : null;
    
    const db = getDB();
    let user = db.users.find(u => u.username === username);

    if (user) {
        db.logs.push({ username, login_time: new Date().toISOString() });
    } else {
        user = {
            username,
            name,
            profile_pic: pic,
            trial_start_date: new Date().toISOString()
        };
        db.users.push(user);
        db.logs.push({ username, login_time: new Date().toISOString() });
    }

    saveDB(db);
    appState.user = user;
    localStorage.setItem('financeManagerActiveUser', JSON.stringify(user));
    
    loadUserTransactions();
    
    if (checkTrialStatus()) {
        showScreen('paywall');
    } else {
        updateDashboard();
        showScreen('dashboard');
    }
});

// Profile Pic Upload Previews
document.getElementById('profile-pic').addEventListener('change', handlePicPreview('profile-preview-label'));
document.getElementById('edit-profile-pic').addEventListener('change', handlePicPreview('edit-profile-preview'));

function handlePicPreview(labelId) {
    return (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const label = document.getElementById(labelId);
                label.style.backgroundImage = `url(${e.target.result})`;
                label.innerHTML = '';
            };
            reader.readAsDataURL(file);
        }
    };
}

function loadUserTransactions() {
    if (!appState.user) return;
    const db = getDB();
    appState.transactions = db.bills.filter(b => b.username === appState.user.username);
}

// Currency Selector Listener
if (currencySelect) {
    currencySelect.addEventListener('change', (e) => {
        appState.currency = e.target.value;
        localStorage.setItem('financeManagerCurrency', appState.currency);
        updateDashboard();
    });
}

// Update Dashboard UI
function updateDashboard() {
    document.getElementById('dash-name').textContent = appState.user.name;
    if (appState.user.profile_pic) {
        document.getElementById('dash-profile-img').src = appState.user.profile_pic;
    }
    
    const totalUSD = appState.transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
    document.getElementById('total-balance').textContent = formatCurrency(totalUSD);
    
    renderTransactions();
    renderChart();
    checkTrialStatus();
}

// Chart Logic
function renderChart() {
    const canvas = document.getElementById('spendingChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const categories = {};
    const rate = appState.rates[appState.currency] || 1;

    appState.transactions.forEach(tx => {
        const cat = tx.category || 'Other';
        const convertedAmount = Number(tx.amount) * rate;
        categories[cat] = (categories[cat] || 0) + convertedAmount;
    });

    const labels = Object.keys(categories);
    const data = Object.values(categories);

    if (appState.chart) appState.chart.destroy();
    if (labels.length === 0) return;

    appState.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#ffffff', '#888888', '#444444', '#cccccc', '#222222'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#888', font: { size: 10 } }
                }
            }
        }
    });
}

// Render Transactions List
function renderTransactions() {
    const list = document.getElementById('transactions-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (appState.transactions.length === 0) {
        list.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px; font-size: 11px; text-transform: uppercase;">No entries found.</p>';
        return;
    }
    
    const sorted = [...appState.transactions].sort((a,b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(tx => {
        const item = document.createElement('div');
        item.className = 'transaction-item glass-panel';
        
        item.innerHTML = `
            <div class="tx-details">
                <div class="tx-title">${tx.merchant} <span style="color:#555; font-size:10px;">• ${tx.category || 'Other'}</span></div>
                <div class="tx-date">${new Date(tx.date).toLocaleDateString()}</div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="tx-amount">${formatCurrency(tx.amount)}</div>
                <button class="edit-btn icon-btn" onclick="editBill(${tx.id})" style="width:30px; height:30px; font-size:12px;"><i class="fa-solid fa-pen"></i></button>
            </div>
        `;
        list.appendChild(item);
    });
}

// Edit Bill Logic
window.editBill = function(id) {
    const bill = appState.transactions.find(b => b.id === id);
    if (!bill) return;

    document.getElementById('edit-bill-id').value = id;
    document.getElementById('manual-amount').value = bill.amount;
    document.getElementById('manual-merchant').value = bill.merchant;
    document.getElementById('manual-category').value = bill.category;
    document.getElementById('manual-date').value = bill.date;
    
    showScreen('manual');
};

// Edit Profile Trigger
document.getElementById('edit-profile-trigger').addEventListener('click', () => {
    document.getElementById('edit-name-input').value = appState.user.name;
    const preview = document.getElementById('edit-profile-preview');
    if (appState.user.profile_pic) {
        preview.style.backgroundImage = `url(${appState.user.profile_pic})`;
        preview.innerHTML = '';
    }
    showScreen('editProfile');
});

// Edit Profile Form Submit
document.getElementById('edit-profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const newName = document.getElementById('edit-name-input').value;
    const picBg = document.getElementById('edit-profile-preview').style.backgroundImage;
    const newPic = picBg !== '' ? picBg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '') : appState.user.profile_pic;

    const db = getDB();
    const userIndex = db.users.findIndex(u => u.username === appState.user.username);
    
    if (userIndex !== -1) {
        db.users[userIndex].name = newName;
        db.users[userIndex].profile_pic = newPic;
        saveDB(db);
        
        appState.user = db.users[userIndex];
        localStorage.setItem('financeManagerActiveUser', JSON.stringify(appState.user));
        
        showToast('Profile Updated');
        updateDashboard();
        showScreen('dashboard');
    }
});

// Navigation Buttons
document.getElementById('manual-btn').addEventListener('click', () => {
    if(checkTrialStatus()) { showScreen('paywall'); return; }
    document.getElementById('manual-form').reset();
    document.getElementById('edit-bill-id').value = "";
    document.getElementById('manual-date').valueAsDate = new Date();
    showScreen('manual');
});

document.getElementById('logout-btn-dash').addEventListener('click', () => {
    if(confirm('Log out?')) {
        localStorage.removeItem('financeManagerActiveUser');
        location.reload();
    }
});

document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        updateDashboard();
        showScreen('dashboard');
    });
});

// Manual Form Logic
document.getElementById('manual-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('edit-bill-id').value;
    const amount = document.getElementById('manual-amount').value;
    const merchant = document.getElementById('manual-merchant').value;
    const category = document.getElementById('manual-category').value;
    const date = document.getElementById('manual-date').value;
    
    // Note: We store everything as USD internally for conversion to work.
    // If the user is currently in INR, we convert the input back to USD.
    const rate = appState.rates[appState.currency] || 1;
    const amountInUSD = Number(amount) / rate;

    const db = getDB();
    
    if (editId) {
        const index = db.bills.findIndex(b => b.id == editId);
        if (index !== -1) {
            db.bills[index].amount = amountInUSD;
            db.bills[index].merchant = merchant;
            db.bills[index].category = category;
            db.bills[index].date = date;
        }
    } else {
        const newBill = {
            username: appState.user.username,
            amount: amountInUSD,
            merchant,
            category,
            date,
            id: Date.now()
        };
        db.bills.push(newBill);
    }
    
    saveDB(db);
    loadUserTransactions();
    showToast(editId ? 'Bill Updated' : 'Ledger Updated');
    updateDashboard();
    showScreen('dashboard');
});

// Run Init
window.addEventListener('DOMContentLoaded', init);
