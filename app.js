const API_BASE_URL = 'http://localhost:5205/api';
let userSubscriptions = new Set();
let currentTab = 'all'; // 'all' أو 'watchlist'
let stockChart = null;
const priceHistoryMap = {}; // تخزين أحدث الأسعار للرسم البياني

// المتغيرات الخاصة بالفرز والفترات الزمنية
let currentSortColumn = 'symbol';
let currentSortDirection = 'asc';
let currentTimeframe = '1H';
let currentChartSymbol = '';

// ==========================================
// 0. SweetAlert2 Helper Notifications
// ==========================================

const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#1e293b',
    color: '#f8fafc',
    customClass: {
        popup: 'border border-slate-700 shadow-xl rounded-xl'
    }
});

function notify(icon, title) {
    Toast.fire({ icon, title });
}

function showAlert(icon, title, text = '') {
    Swal.fire({
        icon,
        title,
        text,
        background: '#0f172a',
        color: '#f8fafc',
        confirmButtonColor: '#10b981',
        customClass: {
            popup: 'border border-slate-800 rounded-2xl'
        }
    });
}

// ==========================================
// 1. Authentication Handling
// ==========================================

async function login() {
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        return notify('warning', 'Please fill in all fields.');
    }

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

            const searchInput = document.getElementById('search-stock-input');
            if (searchInput) searchInput.value = '';

            toggleModal('auth-modal');
            updateAuthUI();
            await loadStocks();

            if (connection.state === signalR.HubConnectionState.Connected) {
                await connection.stop();
            }
            await startSignalR();

            notify('success', `Welcome back, ${data.username}!`);
        } else {
            showAlert('error', 'Login Failed', 'Invalid username or password.');
        }
    } catch (err) {
        console.error("❌ Login Error:", err);
        showAlert('error', 'Connection Error', 'Could not connect to the server.');
    }
}

async function register() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();

    if (!username || !password) {
        return notify('warning', 'Please fill in all fields.');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            showAlert('success', 'Account Created', 'Registration successful! You can now log in.');
        } else {
            showAlert('error', 'Registration Failed', 'An error occurred during registration.');
        }
    } catch (err) {
        console.error("❌ Register Error:", err);
        showAlert('error', 'Connection Error', 'Could not connect to the server.');
    }
}

function logout() {
    localStorage.clear();
    userSubscriptions.clear();
    currentTab = 'all';
    const searchInput = document.getElementById('search-stock-input');
    if (searchInput) searchInput.value = '';
    updateAuthUI();
    notify('info', 'Logged out successfully.');
    console.log("🔒 User Logged Out.");
}

function updateAuthUI() {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');

    const openAuthBtn = document.getElementById('open-auth-btn');
    const userBox = document.getElementById('user-info-container');
    const addStockCard = document.getElementById('add-stock-card');
    const addAdminCard = document.getElementById('add-admin-card');
    const dashboardContainer = document.getElementById('dashboard-container');
    const loggedOutNotice = document.getElementById('logged-out-notice');
    const tabsContainer = document.getElementById('tabs-container');

    if (token) {
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

        if (role === 'Admin') {
            if (addStockCard) addStockCard.classList.remove('hidden');
            if (addAdminCard) addAdminCard.classList.remove('hidden');
            if (tabsContainer) tabsContainer.classList.add('hidden');
        } else {
            if (addStockCard) addStockCard.classList.add('hidden');
            if (addAdminCard) addAdminCard.classList.add('hidden');
            if (tabsContainer) tabsContainer.classList.remove('hidden');
        }
    } else {
        if (openAuthBtn) openAuthBtn.classList.remove('hidden');
        if (userBox) userBox.classList.add('hidden');
        if (addStockCard) addStockCard.classList.add('hidden');
        if (addAdminCard) addAdminCard.classList.add('hidden');
        if (dashboardContainer) dashboardContainer.classList.add('hidden');
        if (loggedOutNotice) loggedOutNotice.classList.remove('hidden');

        const tbody = document.getElementById('stocks-table-body');
        if (tbody) tbody.innerHTML = '';
    }
}

// ==========================================
// 2. Sorting, Tabs, Filtering & CSV Export
// ==========================================

function sortTable(column) {
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }

    const symbolIcon = document.getElementById('sort-icon-symbol');
    const priceIcon = document.getElementById('sort-icon-price');

    if (symbolIcon) symbolIcon.className = 'fa-solid fa-sort sort-icon';
    if (priceIcon) priceIcon.className = 'fa-solid fa-sort sort-icon';

    const activeIcon = column === 'symbol' ? symbolIcon : priceIcon;
    if (activeIcon) {
        activeIcon.className = currentSortDirection === 'asc' 
            ? 'fa-solid fa-sort-up sort-icon text-emerald-400' 
            : 'fa-solid fa-sort-down sort-icon text-emerald-400';
    }

    const tbody = document.getElementById('stocks-table-body');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr:not(.skeleton-row)'));

    rows.sort((a, b) => {
        const symbolA = a.id.replace('row-', '').toUpperCase();
        const symbolB = b.id.replace('row-', '').toUpperCase();

        if (column === 'symbol') {
            return currentSortDirection === 'asc' 
                ? symbolA.localeCompare(symbolB) 
                : symbolB.localeCompare(symbolA);
        } else if (column === 'price') {
            const priceA = parseFloat(document.getElementById(`price-value-${symbolA}`)?.innerText.replace('$', '') || 0);
            const priceB = parseFloat(document.getElementById(`price-value-${symbolB}`)?.innerText.replace('$', '') || 0);
            return currentSortDirection === 'asc' ? priceA - priceB : priceB - priceA;
        }
    });

    rows.forEach(row => tbody.appendChild(row));
}

function switchTab(tab) {
    currentTab = tab;

    const allBtn = document.getElementById('tab-all-btn');
    const watchlistBtn = document.getElementById('tab-watchlist-btn');

    if (tab === 'all') {
        if (allBtn) allBtn.className = "px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all";
        if (watchlistBtn) watchlistBtn.className = "px-4 py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition-all";
    } else {
        if (watchlistBtn) watchlistBtn.className = "px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all";
        if (allBtn) allBtn.className = "px-4 py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition-all";
    }

    filterStocks();
}

function filterStocks() {
    const searchInput = document.getElementById('search-stock-input');
    const query = searchInput ? searchInput.value.trim().toUpperCase() : '';
    const rows = document.querySelectorAll('#stocks-table-body tr:not(.skeleton-row)');
    const role = localStorage.getItem('role');

    let visibleCount = 0;

    rows.forEach(row => {
        const symbol = row.getAttribute('id').replace('row-', '').toUpperCase();
        const matchesSearch = symbol.includes(query);
        const matchesTab = (role === 'Admin' || currentTab === 'all') || userSubscriptions.has(symbol);

        if (matchesSearch && matchesTab) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    const countEl = document.getElementById('total-stocks-count');
    if (countEl) countEl.innerText = visibleCount;
}

function exportToCSV() {
    const rows = document.querySelectorAll('#stocks-table-body tr:not(.skeleton-row)');
    let visibleRows = [];

    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const symbol = row.getAttribute('id').replace('row-', '');
            const price = document.getElementById(`price-value-${symbol}`)?.innerText.replace('$', '') || '0.00';
            const high24h = document.getElementById(`high-${symbol}`)?.innerText.replace('$', '') || price;
            const low24h = document.getElementById(`low-${symbol}`)?.innerText.replace('$', '') || price;
            const change = document.getElementById(`price-change-${symbol}`)?.innerText || '0.00%';
            visibleRows.push({ symbol, price, high24h, low24h, change });
        }
    });

    if (visibleRows.length === 0) {
        return notify('warning', 'No stocks available to export.');
    }

    let csvContent = "data:text/csv;charset=utf-8,Symbol,Price ($),24h High ($),24h Low ($),Change (%)\n";
    visibleRows.forEach(item => {
        const cleanChange = item.change.replace('▲ ', '+').replace('▼ ', '');
        csvContent += `${item.symbol},${item.price},${item.high24h},${item.low24h},"${cleanChange}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stocks_watchlist_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notify('success', 'CSV exported successfully!');
}

// ==========================================
// 3. Stock Management & Rendering
// ==========================================

async function loadSubscriptions() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/subscriptions/my-stocks`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const subs = await response.json();
            userSubscriptions = new Set(subs.map(s => s.toUpperCase()));
            console.log("⭐ Loaded User Subscriptions:", Array.from(userSubscriptions));

            if (connection && connection.state === signalR.HubConnectionState.Connected) {
                userSubscriptions.forEach(sym => {
                    connection.invoke("SubscribeToSymbol", sym)
                        .then(() => console.log(`📢 Subscribed to SignalR group: ${sym}`))
                        .catch(err => console.error(`❌ SignalR Subscribe Error (${sym}):`, err));
                });
            }
        }
    } catch (err) {
        console.error("❌ Error fetching subscriptions:", err);
    }
}

async function loadStocks() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        await loadSubscriptions();

        const response = await fetch(`${API_BASE_URL}/stocks`);
        const stocks = await response.json();
        console.log("📈 Loaded Stocks List:", stocks);

        const tbody = document.getElementById('stocks-table-body');
        if (tbody) tbody.innerHTML = '';

        stocks.forEach(stock => renderStockRow(stock));
        
        sortTable(currentSortColumn);
        filterStocks();
    } catch (err) {
        console.error("❌ Error fetching stocks:", err);
    }
}

function renderStockRow(arg1, arg2, arg3, arg4) {
    let symbol, price, high24h, low24h;

    if (typeof arg1 === 'object' && arg1 !== null) {
        symbol = arg1.symbol ?? arg1.Symbol;
        price = arg1.price ?? arg1.Price;
        high24h = arg1.high24h ?? arg1.High24h ?? price;
        low24h = arg1.low24h ?? arg1.Low24h ?? price;
    } else {
        symbol = arg1;
        price = arg2;
        high24h = arg3 ?? price;
        low24h = arg4 ?? price;
    }

    const role = localStorage.getItem('role');

    if (!symbol || symbol === '[object Object]') return;
    symbol = symbol.toUpperCase();

    const tbody = document.getElementById('stocks-table-body');
    if (!tbody) return;

    let existingRow = document.getElementById(`row-${symbol}`);
    const isSubscribed = userSubscriptions.has(symbol);

    recordPriceHistory(symbol, Number(price) || 0);

    let actionCellHtml = '';
    if (role === 'Admin') {
        actionCellHtml = `
            <button onclick="deleteStock('${symbol}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/40 transition-all" title="Delete Stock">
                <i class="fa-solid fa-trash mr-1"></i> Delete
            </button>`;
    } else {
        actionCellHtml = isSubscribed
            ? `<button onclick="toggleSubscription('${symbol}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all">
                    <i class="fa-solid fa-star mr-1"></i> Subscribed
               </button>`
            : `<button onclick="toggleSubscription('${symbol}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all">
                    <i class="fa-solid fa-plus mr-1"></i> Subscribe
               </button>`;
    }

    if (!existingRow) {
        const tr = document.createElement('tr');
        tr.id = `row-${symbol}`;
        tr.className = 'hover:bg-slate-800/30 transition-colors border-b border-slate-800/60';
        tr.innerHTML = `
            <td class="py-4 px-6 font-bold text-emerald-400 cursor-pointer hover:underline" onclick="openStockChart('${symbol}')" title="Click to view live chart">
                <i class="fa-solid fa-chart-line mr-1.5 text-xs text-slate-500"></i>${symbol}
            </td>
            <td id="price-${symbol}" class="py-4 px-6 font-mono font-bold text-slate-100">
                <span id="price-value-${symbol}">$${Number(price).toFixed(2)}</span>
                <span id="price-change-${symbol}" class="ml-2 text-xs font-semibold text-slate-500">0.00%</span>
            </td>
            <td id="high-${symbol}" class="py-4 px-6 font-mono font-semibold text-emerald-400/90">$${Number(high24h).toFixed(2)}</td>
            <td id="low-${symbol}" class="py-4 px-6 font-mono font-semibold text-rose-400/90">$${Number(low24h).toFixed(2)}</td>
            <td id="action-${symbol}" class="py-4 px-6 text-center">${actionCellHtml}</td>
        `;
        tbody.appendChild(tr);
    } else {
        const priceVal = document.getElementById(`price-value-${symbol}`);
        const highElem = document.getElementById(`high-${symbol}`);
        const lowElem = document.getElementById(`low-${symbol}`);
        const actionCell = document.getElementById(`action-${symbol}`);

        if (priceVal) priceVal.innerText = `$${Number(price).toFixed(2)}`;
        if (highElem) highElem.innerText = `$${Number(high24h).toFixed(2)}`;
        if (lowElem) lowElem.innerText = `$${Number(low24h).toFixed(2)}`;
        if (actionCell) actionCell.innerHTML = actionCellHtml;
    }

    filterStocks();
}

async function toggleSubscription(symbol) {
    const token = localStorage.getItem('token');
    if (!token) return notify('warning', 'Please login first.');

    const upperSymbol = symbol.toUpperCase();
    const isSubscribed = userSubscriptions.has(upperSymbol);

    const endpoint = isSubscribed
        ? `${API_BASE_URL}/subscriptions/unsubscribe/${upperSymbol}`
        : `${API_BASE_URL}/subscriptions/subscribe/${upperSymbol}`;

    const method = isSubscribed ? 'DELETE' : 'POST';

    try {
        const response = await fetch(endpoint, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            if (isSubscribed) {
                userSubscriptions.delete(upperSymbol);
                if (connection.state === signalR.HubConnectionState.Connected) {
                    connection.invoke("UnsubscribeFromSymbol", upperSymbol)
                        .then(() => console.log(`🔕 Unsubscribed from SignalR group: ${upperSymbol}`))
                        .catch(err => console.error(err));
                }
                notify('info', `Removed ${upperSymbol} from Watchlist`);
            } else {
                userSubscriptions.add(upperSymbol);
                if (connection.state === signalR.HubConnectionState.Connected) {
                    connection.invoke("SubscribeToSymbol", upperSymbol)
                        .then(() => console.log(`🔔 Subscribed to SignalR group: ${upperSymbol}`))
                        .catch(err => console.error(err));
                }
                notify('success', `Added ${upperSymbol} to Watchlist`);
            }
            renderStockRow(upperSymbol);
        } else {
            showAlert('error', 'Action Failed', 'Failed to update subscription.');
        }
    } catch (err) {
        console.error('❌ Subscription error:', err);
        showAlert('error', 'Connection Error', 'Error connecting to server.');
    }
}

async function addStock() {
    const symbolInput = document.getElementById('stock-symbol');
    const priceInput = document.getElementById('stock-price');
    const symbol = symbolInput.value.trim().toUpperCase();
    const price = parseFloat(priceInput.value);
    const token = localStorage.getItem('token');

    if (!token) return notify('warning', 'You must be logged in.');
    if (!symbol || isNaN(price)) return notify('warning', 'Please enter valid stock details.');

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
            renderStockRow(symbol, price, price, price);
            notify('success', `Stock ${symbol} created at $${price}`);
        } else if (response.status === 403) {
            showAlert('error', 'Access Denied', 'Admin permissions required.');
        } else {
            showAlert('error', 'Failed', 'Failed to add stock.');
        }
    } catch (err) {
        console.error('❌ Add Stock error:', err);
        showAlert('error', 'Error', 'Error connecting to server.');
    }
}

async function createAdmin() {
    const usernameInput = document.getElementById('admin-username');
    const passwordInput = document.getElementById('admin-password');
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const token = localStorage.getItem('token');

    if (!username || !password) {
        return notify('warning', 'يرجى كتابة اسم المستخدم وكلمة المرور');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/create-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            showAlert('success', 'تم الإنجاز 🎉', 'تم إنشاء حساب الأدمن بنجاح!');
            usernameInput.value = '';
            passwordInput.value = '';
        } else {
            const errorText = await response.text();
            showAlert('error', 'فشل إنشاء الأدمن', errorText);
        }
    } catch (err) {
        console.error(err);
        showAlert('error', 'خطأ في الاتصال', 'حدث خطأ أثناء الاتصال بالسيرفر');
    }
}

async function deleteStock(symbol) {
    const token = localStorage.getItem('token');
    if (!token) return notify('warning', 'Admin permissions required.');

    const result = await Swal.fire({
        title: `Delete ${symbol}?`,
        text: "Are you sure you want to delete this stock? This action cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, delete it!',
        background: '#0f172a',
        color: '#f8fafc',
        customClass: {
            popup: 'border border-slate-800 rounded-2xl'
        }
    });

    if (!result.isConfirmed) return;

    try {
        const response = await fetch(`${API_BASE_URL}/stocks/${symbol}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const row = document.getElementById(`row-${symbol}`);
            if (row) row.remove();
            filterStocks();
            notify('success', `Deleted stock: ${symbol}`);
        } else {
            showAlert('error', 'Failed', 'Failed to delete stock.');
        }
    } catch (err) {
        console.error('❌ Delete Stock error:', err);
        showAlert('error', 'Connection Error', 'Failed to connect to server.');
    }
}

// ==========================================
// 4. Live Charts & Timeframes (Chart.js)
// ==========================================

function setTimeframe(tf) {
    currentTimeframe = tf;
    ['1H', '1D', '1W'].forEach(t => {
        const btn = document.getElementById(`tf-${t}`);
        if (btn) {
            if (t === tf) {
                btn.className = "px-2.5 py-1 text-xs font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all";
            } else {
                btn.className = "px-2.5 py-1 text-xs font-bold rounded text-slate-400 hover:text-white transition-all";
            }
        }
    });

    if (currentChartSymbol) {
        openStockChart(currentChartSymbol);
    }
}

function openStockChart(symbol) {
    currentChartSymbol = symbol;
    document.getElementById('chart-stock-symbol').innerText = `${symbol} - Real-time Price Chart (${currentTimeframe})`;
    toggleModal('chart-modal');

    const ctx = document.getElementById('stockHistoryChart').getContext('2d');
    let history = priceHistoryMap[symbol] || [{ time: new Date().toLocaleTimeString(), price: 0 }];

    if (currentTimeframe === '1H') history = history.slice(-15);
    else if (currentTimeframe === '1D') history = history.slice(-30);

    if (stockChart) stockChart.destroy();

    stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => h.time),
            datasets: [{
                label: 'Price ($)',
                data: history.map(h => h.price),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
            }
        }
    });
}

function recordPriceHistory(symbol, price) {
    if (!priceHistoryMap[symbol]) priceHistoryMap[symbol] = [];
    const time = new Date().toLocaleTimeString();

    const lastEntry = priceHistoryMap[symbol][priceHistoryMap[symbol].length - 1];
    if (!lastEntry || lastEntry.price !== price) {
        priceHistoryMap[symbol].push({ time, price });
    }

    if (priceHistoryMap[symbol].length > 50) priceHistoryMap[symbol].shift();

    if (stockChart && currentChartSymbol === symbol) {
        let history = priceHistoryMap[symbol];
        if (currentTimeframe === '1H') history = history.slice(-15);

        stockChart.data.labels = history.map(h => h.time);
        stockChart.data.datasets[0].data = history.map(h => h.price);
        stockChart.update();
    }
}

// ==========================================
// 5. SignalR Streaming Setup & Connection
// ==========================================

const connection = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:5205/stockHub", {
        accessTokenFactory: () => localStorage.getItem('token') || ''
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Information)
    .build();

connection.on("ReceivePriceUpdate", (arg1, arg2, arg3, arg4) => {
    console.log("📡 SignalR Message Received:", arg1, arg2, arg3, arg4);

    let symbol, newPrice, high24h, low24h;

    if (typeof arg1 === 'object' && arg1 !== null) {
        symbol = arg1.symbol ?? arg1.Symbol;
        newPrice = arg1.price ?? arg1.Price;
        high24h = arg1.high24h ?? arg1.High24h;
        low24h = arg1.low24h ?? arg1.Low24h;
    } else {
        symbol = arg1;
        newPrice = arg2;
        high24h = arg3;
        low24h = arg4;
    }

    if (!symbol) return;
    symbol = symbol.toUpperCase();
    newPrice = Number(newPrice);
    high24h = Number(high24h ?? newPrice);
    low24h = Number(low24h ?? newPrice);

    recordPriceHistory(symbol, newPrice);

    let priceCell = document.getElementById(`price-${symbol}`);

    if (!priceCell) {
        renderStockRow(symbol, newPrice, high24h, low24h);
        priceCell = document.getElementById(`price-${symbol}`);
    }

    if (priceCell) {
        const priceValueEl = document.getElementById(`price-value-${symbol}`);
        const priceChangeEl = document.getElementById(`price-change-${symbol}`);
        const highElem = document.getElementById(`high-${symbol}`);
        const lowElem = document.getElementById(`low-${symbol}`);

        const oldPrice = parseFloat(priceValueEl.innerText.replace('$', '')) || 0;
        priceValueEl.innerText = `$${newPrice.toFixed(2)}`;

        if (highElem) highElem.innerText = `$${high24h.toFixed(2)}`;
        if (lowElem) lowElem.innerText = `$${low24h.toFixed(2)}`;

        priceCell.classList.remove('price-up', 'price-down');
        void priceCell.offsetWidth;
        priceCell.classList.add(newPrice >= oldPrice ? 'price-up' : 'price-down');

        if (priceChangeEl && oldPrice > 0) {
            const percentChange = ((newPrice - oldPrice) / oldPrice) * 100;
            const sign = percentChange >= 0 ? '+' : '';
            const arrow = percentChange >= 0 ? '▲' : '▼';

            priceChangeEl.innerText = `${arrow} ${sign}${percentChange.toFixed(2)}%`;
            priceChangeEl.className = percentChange >= 0
                ? 'ml-2 text-xs font-semibold text-emerald-400'
                : 'ml-2 text-xs font-semibold text-red-400';
        }
    }
});

connection.onreconnecting(error => {
    console.warn("⚠️ SignalR Reconnecting...", error);
});

connection.onreconnected(connectionId => {
    console.log("🟢 SignalR Reconnected. Connection ID:", connectionId);
    loadStocks();
});

connection.onclose(error => {
    console.error("🔴 SignalR Connection Closed.", error);
});

async function startSignalR() {
    try {
        await connection.start();
        console.log("🟢 SignalR Connected Successfully! Connection ID:", connection.connectionId);

        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
            statusEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Live 🔴`;
        }

        if (userSubscriptions.size > 0) {
            userSubscriptions.forEach(sym => {
                connection.invoke("SubscribeToSymbol", sym)
                    .then(() => console.log(`📢 Initial subscription sent for group: ${sym}`))
                    .catch(err => console.error(err));
            });
        }
    } catch (err) {
        console.error("❌ SignalR Connection Failed:", err);
        setTimeout(startSignalR, 5000);
    }
}

function toggleModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.toggle('hidden');
        modal.classList.toggle('flex');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-stock-input');
    if (searchInput) searchInput.value = '';
    updateAuthUI();
    loadStocks();
    startSignalR();
});