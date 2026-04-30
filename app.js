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

// Utility to switch screens
function showScreen(screenName) {
    const screens = {
        login: document.getElementById('login-screen'),
        dashboard: document.getElementById('dashboard-screen'),
        manual: document.getElementById('manual-screen'),
        editProfile: document.getElementById('edit-profile-screen'),
        paywall: document.getElementById('paywall-screen')
    };

    Object.values(screens).forEach(screen => {
        if (screen) {
            screen.classList.remove('active');
            screen.classList.add('hidden');
        }
    });
    
    if (screens[screenName]) {
        screens[screenName].classList.remove('hidden');
        setTimeout(() => screens[screenName].classList.add('active'), 50);
    }
}

// Toast Notification
function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// Fetch Real-time Rates (Async Background)
async function fetchRates() {
    try {
        const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,INR,JPY');
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        appState.rates = { USD: 1, ...data.rates };
        console.log('Real-time rates updated:', appState.rates);
        updateDashboard(); // Re-render with new rates
    } catch (e) {
        console.warn('Using fallback exchange rates');
    }
}

// Format Currency
function formatCurrency(amountUSD) {
    const rate = appState.rates[appState.currency] || 1;
    const converted = amountUSD * rate;
    const config = currencyConfig[appState.currency];
    if (!config) return `$${amountUSD.toFixed(2)}`;
    
    try {
        return new Intl.NumberFormat(config.locale, { 
            style: 'currency', 
            currency: appState.currency 
        }).format(converted);
    } catch (e) {
        return `${config.symbol}${converted.toFixed(2)}`;
    }
}

// Initialize App
function init() {
    const savedUser = localStorage.getItem('financeManagerActiveUser');
    const savedCurrency = localStorage.getItem('financeManagerCurrency');
    
    fetchRates(); // Fire and forget

    if (savedCurrency) {
        appState.currency = savedCurrency;
        const currencySelect = document.getElementById('currency-select');
        if (currencySelect) currencySelect.value = savedCurrency;
    }

    if (savedUser) {
        try {
            appState.user = JSON.parse(savedUser);
            loadUserTransactions();
            if (checkTrialStatus()) {
                showScreen('paywall');
            } else {
                updateDashboard();
                showScreen('dashboard');
            }
        } catch (e) {
            console.error('Error loading user session', e);
            showScreen('login');
        }
    } else {
        showScreen('login');
    }

    setupEventListeners();

    // Refresh trial status every 10 seconds
    setInterval(() => {
        const dash = document.getElementById('dashboard-screen');
        if (dash && !dash.classList.contains('hidden')) {
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

function loadUserTransactions() {
    if (!appState.user) return;
    const db = getDB();
    appState.transactions = db.bills.filter(b => b.username === appState.user.username);
}

// Update Dashboard UI
function updateDashboard() {
    if (!appState.user) return;
    
    const nameEl = document.getElementById('dash-name');
    if (nameEl) nameEl.textContent = appState.user.name;
    
    const imgEl = document.getElementById('dash-profile-img');
    if (imgEl && appState.user.profile_pic) {
        imgEl.src = appState.user.profile_pic;
    }
    
    const totalUSD = appState.transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const balanceEl = document.getElementById('total-balance');
    if (balanceEl) balanceEl.textContent = formatCurrency(totalUSD);
    
    renderTransactions();
    renderChart();
    checkTrialStatus();
}

// Chart Logic
function renderChart() {
    const canvas = document.getElementById('spendingChart');
    if (!canvas || typeof Chart === 'undefined') return;
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

    const idEl = document.getElementById('edit-bill-id');
    const amtEl = document.getElementById('manual-amount');
    const merEl = document.getElementById('manual-merchant');
    const catEl = document.getElementById('manual-category');
    const datEl = document.getElementById('manual-date');

    if (idEl) idEl.value = id;
    if (amtEl) amtEl.value = bill.amount;
    if (merEl) merEl.value = bill.merchant;
    if (catEl) catEl.value = bill.category;
    if (datEl) datEl.value = bill.date;
    
    showScreen('manual');
};

function setupEventListeners() {
    // Login Handling
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('name-input').value;
            const username = document.getElementById('username-input').value;
            const previewLabel = document.getElementById('profile-preview-label');
            const picBg = previewLabel ? previewLabel.style.backgroundImage : '';
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
    }

    // Profile Pic Upload Previews
    const profPic = document.getElementById('profile-pic');
    if (profPic) profPic.addEventListener('change', handlePicPreview('profile-preview-label'));
    
    const editProfPic = document.getElementById('edit-profile-pic');
    if (editProfPic) editProfPic.addEventListener('change', handlePicPreview('edit-profile-preview'));

    // Currency Selector
    const currencySelect = document.getElementById('currency-select');
    if (currencySelect) {
        currencySelect.addEventListener('change', (e) => {
            appState.currency = e.target.value;
            localStorage.setItem('financeManagerCurrency', appState.currency);
            updateDashboard();
        });
    }

    // Edit Profile Trigger
    const editTrigger = document.getElementById('edit-profile-trigger');
    if (editTrigger) {
        editTrigger.addEventListener('click', () => {
            const nameInp = document.getElementById('edit-name-input');
            if (nameInp) nameInp.value = appState.user.name;
            const preview = document.getElementById('edit-profile-preview');
            if (preview && appState.user.profile_pic) {
                preview.style.backgroundImage = `url(${appState.user.profile_pic})`;
                preview.innerHTML = '';
            }
            showScreen('editProfile');
        });
    }

    // Edit Profile Form Submit
    const editProfForm = document.getElementById('edit-profile-form');
    if (editProfForm) {
        editProfForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newName = document.getElementById('edit-name-input').value;
            const preview = document.getElementById('edit-profile-preview');
            const picBg = preview ? preview.style.backgroundImage : '';
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
    }

    // Navigation Buttons
    const manualBtn = document.getElementById('manual-btn');
    if (manualBtn) {
        manualBtn.addEventListener('click', () => {
            if(checkTrialStatus()) { showScreen('paywall'); return; }
            const form = document.getElementById('manual-form');
            if (form) form.reset();
            const editId = document.getElementById('edit-bill-id');
            if (editId) editId.value = "";
            const dateInput = document.getElementById('manual-date');
            if (dateInput) dateInput.valueAsDate = new Date();
            showScreen('manual');
        });
    }

    const logoutBtn = document.getElementById('logout-btn-dash');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if(confirm('Log out?')) {
                localStorage.removeItem('financeManagerActiveUser');
                location.reload();
            }
        });
    }

    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            updateDashboard();
            showScreen('dashboard');
        });
    });

    // Manual Form Logic
    const manualForm = document.getElementById('manual-form');
    if (manualForm) {
        manualForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const editId = document.getElementById('edit-bill-id').value;
            const amount = document.getElementById('manual-amount').value;
            const merchant = document.getElementById('manual-merchant').value;
            const category = document.getElementById('manual-category').value;
            const date = document.getElementById('manual-date').value;
            
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
    }
}

function handlePicPreview(labelId) {
    return (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const label = document.getElementById(labelId);
                if (label) {
                    label.style.backgroundImage = `url(${e.target.result})`;
                    label.innerHTML = '';
                }
            };
            reader.readAsDataURL(file);
        }
    };
}

// Run Init
window.addEventListener('DOMContentLoaded', init);
