const API_BASE_URL = 'http://localhost:5205/api';

// ==========================================
// 1. Authentication Handling
// ==========================================

async function login() {
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) return alert('Please fill in all fields.');

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role);
            localStorage.setItem('username', data.username);

            usernameInput.value = '';
            passwordInput.value = '';

            // تفريغ شريط البحث تماماً عند تسجيل الدخول
            const searchInput = document.getElementById('search-stock-input');
            if (searchInput) searchInput.value = '';

            toggleModal('auth-modal');
            updateAuthUI();
            await loadStocks();
        } else {
            alert('Invalid username or password.');
        }
    } catch (err) {
        alert('Could not connect to server.');
    }
}

async function register() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!username || !password) return alert('Please fill in all fields.');

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            alert('User account created successfully! You can now log in.');
        } else {
            alert('An error occurred during registration.');
        }
    } catch (err) {
        alert('Could not connect to server.');
    }
}

function logout() {
    localStorage.clear();
    const searchInput = document.getElementById('search-stock-input');
    if (searchInput) searchInput.value = '';
    updateAuthUI();
}

function updateAuthUI() {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');

    const openAuthBtn = document.getElementById('open-auth-btn');
    const userBox = document.getElementById('user-info-container');
    const addStockCard = document.getElementById('add-stock-card');
    const dashboardContainer = document.getElementById('dashboard-container');
    const loggedOutNotice = document.getElementById('logged-out-notice');

    if (token) {
        // حالة تسجيل الدخول: إظهار القائمة بالكامل وإخفاء رسالة التنبيه
        if (openAuthBtn) openAuthBtn.classList.add('hidden');
        if (loggedOutNotice) loggedOutNotice.classList.add('hidden');
        if (dashboardContainer) dashboardContainer.classList.remove('hidden');

        if (userBox) {
            userBox.classList.remove('hidden');
            document.getElementById('user-display').innerHTML = `
                <i class="fa-solid fa-circle-user"></i> ${username} 
                <span class="px-2 py-0.5 text-xs rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">${role}</span>
            `;
        }

        if (addStockCard) {
            if (role === 'Admin') {
                addStockCard.classList.remove('hidden');
            } else {
                addStockCard.classList.add('hidden');
            }
        }
    } else {
        // حالة عدم تسجيل الدخول: إخفاء القائمة بالكامل وإظهار رسالة التنبيه
        if (openAuthBtn) openAuthBtn.classList.remove('hidden');
        if (userBox) userBox.classList.add('hidden');
        if (addStockCard) addStockCard.classList.add('hidden');
        if (dashboardContainer) dashboardContainer.classList.add('hidden');
        if (loggedOutNotice) loggedOutNotice.classList.remove('hidden');

        const tbody = document.getElementById('stocks-table-body');
        if (tbody) tbody.innerHTML = '';
    }
}

// ==========================================
// 2. Stock List & Rendering
// ==========================================

async function loadStocks() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/stocks`);
        const stocks = await response.json();
        const tbody = document.getElementById('stocks-table-body');
        if (tbody) tbody.innerHTML = '';

        stocks.forEach(stock => renderStockRow(stock));
        updateStockCount();
    } catch (err) {
        console.error("Error fetching stocks:", err);
    }
}

function renderStockRow(arg1, arg2) {
    let symbol = (typeof arg1 === 'object' && arg1 !== null) ? (arg1.symbol ?? arg1.Symbol) : arg1;
    let price = (typeof arg1 === 'object' && arg1 !== null) ? (arg1.price ?? arg1.Price) : arg2;
    const role = localStorage.getItem('role');

    if (!symbol || symbol === '[object Object]') return;

    const tbody = document.getElementById('stocks-table-body');
    if (!tbody) return;

    let existingRow = document.getElementById(`row-${symbol}`);

    const actionCellHtml = (role === 'Admin')
        ? `<button onclick="deleteStock('${symbol}')" class="text-slate-500 hover:text-red-400 transition-colors">
                <i class="fa-solid fa-trash"></i> Delete
           </button>`
        : `<span class="text-slate-600 text-xs">Read-only</span>`;

    if (!existingRow) {
        const tr = document.createElement('tr');
        tr.id = `row-${symbol}`;
        tr.className = 'hover:bg-slate-800/30 transition-colors border-b border-slate-800/60';
        tr.innerHTML = `
            <td class="py-4 px-6 font-bold text-emerald-400">${symbol}</td>
            <td id="price-${symbol}" class="py-4 px-6 font-mono font-bold text-slate-100">$${Number(price).toFixed(2)}</td>
            <td id="action-${symbol}" class="py-4 px-6 text-center">${actionCellHtml}</td>
        `;
        tbody.appendChild(tr);
        filterStocks();
    } else {
        const actionCell = document.getElementById(`action-${symbol}`);
        if (actionCell) actionCell.innerHTML = actionCellHtml;
    }

    updateStockCount();
}

async function addStock() {
    const symbolInput = document.getElementById('stock-symbol');
    const priceInput = document.getElementById('stock-price');
    const symbol = symbolInput.value.trim().toUpperCase();
    const price = parseFloat(priceInput.value);
    const token = localStorage.getItem('token');

    if (!token) return alert('You must be logged in.');
    if (!symbol || isNaN(price)) return alert('Please enter valid stock details.');

    try {
        const response = await fetch(`${API_BASE_URL}/stocks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ symbol, price })
        });

        if (response.ok) {
            symbolInput.value = '';
            priceInput.value = '';
            renderStockRow(symbol, price);
        } else if (response.status === 403) {
            alert('Admin permissions required.');
        } else {
            alert('Failed to add stock.');
        }
    } catch (err) {
        alert('Error connecting to server.');
    }
}

async function deleteStock(symbol) {
    const token = localStorage.getItem('token');
    if (!token) return alert('Admin permissions required.');
    if (!confirm(`Are you sure you want to delete ${symbol}?`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/stocks/${symbol}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const row = document.getElementById(`row-${symbol}`);
            if (row) row.remove();
            updateStockCount();
        } else {
            alert('Failed to delete stock.');
        }
    } catch (err) {
        alert('Connection error.');
    }
}

function filterStocks() {
    const searchInput = document.getElementById('search-stock-input');
    if (!searchInput) return;

    const query = searchInput.value.trim().toUpperCase();
    const rows = document.querySelectorAll('#stocks-table-body tr');

    rows.forEach(row => {
        const symbol = row.getAttribute('id').replace('row-', '').toUpperCase();
        row.style.display = symbol.includes(query) ? '' : 'none';
    });


    
}

function updateStockCount() {
    const countEl = document.getElementById('total-stocks-count');
    const rows = document.querySelectorAll('#stocks-table-body tr');
    if (countEl) countEl.innerText = rows.length;
}

// ==========================================
// 3. SignalR Streaming Updates
// ==========================================

const connection = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:5205/stockHub")
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Information)
    .build();

connection.on("ReceivePriceUpdate", (arg1, arg2) => {
    let symbol, newPrice;

    if (typeof arg1 === 'object' && arg1 !== null) {
        symbol = arg1.symbol ?? arg1.Symbol;
        newPrice = arg1.price ?? arg1.Price;
    } else {
        symbol = arg1;
        newPrice = arg2;
    }

    if (!symbol) return;

    let priceCell = document.getElementById(`price-${symbol}`);

    if (!priceCell) {
        renderStockRow(symbol, newPrice);
        priceCell = document.getElementById(`price-${symbol}`);
    }

    if (priceCell) {
        const oldPrice = parseFloat(priceCell.innerText.replace('$', '')) || 0;
        priceCell.innerText = `$${Number(newPrice).toFixed(2)}`;

        priceCell.classList.remove('price-up', 'price-down');
        void priceCell.offsetWidth;
        priceCell.classList.add(newPrice >= oldPrice ? 'price-up' : 'price-down');
    }
});

connection.onreconnected(() => {
    loadStocks();
});

connection.start()
    .then(() => {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
            statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Live 🔴`;
        }
    })
    .catch(err => console.error("❌ SignalR Connection Failed:", err));

function toggleModal(id) {
    const modal = document.getElementById(id);
    modal.classList.toggle('hidden');
    modal.classList.toggle('flex');
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-stock-input');
    if (searchInput) searchInput.value = '';
    updateAuthUI();
    loadStocks();
});