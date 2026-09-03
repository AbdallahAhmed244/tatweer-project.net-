const API_BASE_URL = 'http://localhost:5205/api';


async function login() {
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (!username || !password) return alert('يرجى ملء كافة الحقول');

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
            
            updateAuthUI();
            loadStocks(); 
        } else {
            alert('بيانات الدخول غير صحيحة.');
        }
    } catch (err) {
        alert('تعذر الاتصال بالسيرفر. تأكد من تشغيل الـ Backend.');
    }
}

async function register() {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;

    if (!username || !password) return alert('يرجى ملء كافة الحقول');

    
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (response.ok) {
        alert('تم إنشاء حساب مستخدم (User) بنجاح! قم بتسجيل الدخول الآن.');
    } else {
        alert('حدث خطأ أثناء إنشاء الحساب (قد يكون اسم المستخدم مأخوذاً).');
    }
}

function logout() {
    localStorage.clear();
    updateAuthUI();
    loadStocks();
}

function updateAuthUI() {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');

    const loginBox = document.getElementById('login-form-container');
    const userBox = document.getElementById('user-info-container');
    const addStockCard = document.getElementById('add-stock-card');

    if (token) {
        if (loginBox) loginBox.classList.add('d-none');
        if (userBox) {
            userBox.classList.remove('d-none');
            document.getElementById('user-display').innerHTML = `<i class="bi bi-person-circle"></i> ${username} <span class="badge bg-warning text-dark">${role}</span>`;
        }
        
        // إظهار كارت الإضافة للأدمن فقط
        if (addStockCard) {
            if (role === 'Admin') {
                addStockCard.classList.remove('d-none');
            } else {
                addStockCard.classList.add('d-none');
            }
        }
    } else {
        if (loginBox) loginBox.classList.remove('d-none');
        if (userBox) userBox.classList.add('d-none');
        if (addStockCard) addStockCard.classList.add('d-none');
    }
}

// ==========================================
// 2. إدارة الأسهم وقائمة العرض
// ==========================================

async function loadStocks() {
    try {
        const response = await fetch(`${API_BASE_URL}/stocks`);
        const stocks = await response.json();
        const tbody = document.getElementById('stocks-table-body');
        if (tbody) tbody.innerHTML = '';

        stocks.forEach(stock => renderStockRow(stock));
    } catch (err) {
        console.error("خطأ في جلب الأسهم:", err);
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

    // إتاحة خيار الحذف للأدمن فقط
    const actionCellHtml = (role === 'Admin')
        ? `<button onclick="deleteStock('${symbol}')" class="btn btn-outline-danger btn-sm">
                <i class="bi bi-trash"></i> حذف
           </button>`
        : `<span class="text-muted small">عرض فقط</span>`;

    if (!existingRow) {
        tbody.innerHTML += `
            <tr id="row-${symbol}">
                <td class="fw-bold">${symbol}</td>
                <td id="price-${symbol}">${price} $</td>
                <td id="action-${symbol}">${actionCellHtml}</td>
            </tr>
        `;
    } else {
        // تحديث خانة الإجراءات عند تغيير حالة تسجيل الدخول
        const actionCell = document.getElementById(`action-${symbol}`);
        if (actionCell) actionCell.innerHTML = actionCellHtml;
    }
}

async function addStock() {
    const symbolInput = document.getElementById('stock-symbol');
    const priceInput = document.getElementById('stock-price');
    const symbol = symbolInput.value.toUpperCase();
    const price = parseFloat(priceInput.value);
    const token = localStorage.getItem('token');

    if (!token) return alert('يجب تسجيل الدخول لإضافة سهم.');
    if (!symbol || isNaN(price)) return alert('ادخل بيانات السهم كاملة وبشكل صحيح.');

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
        alert('حسابك لا يملك صلاحيات Admin لإضافة أسهم.');
    } else {
        alert('تعذر إضافة السهم.');
    }
}

async function deleteStock(symbol) {
    const token = localStorage.getItem('token');

    if (!token) return alert('يجب تسجيل الدخول كـ Admin لحذف السهم!');

    const response = await fetch(`${API_BASE_URL}/stocks/${symbol}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (response.ok) {
        const row = document.getElementById(`row-${symbol}`);
        if (row) {
            row.classList.add('animate__animated', 'animate__fadeOutLeft');
            setTimeout(() => row.remove(), 500);
        }
    } else if (response.status === 403) {
        alert('حسابك لا يملك صلاحيات Admin للحذف.');
    } else {
        alert('حدث خطأ أثناء الحذف.');
    }
}

// ==========================================
// 3. إعداد اتصال SignalR للأسعار الحية
// ==========================================

const connection = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:5205/stockHub")
    .configureLogging(signalR.LogLevel.Information)
    .build();

connection.on("ReceivePriceUpdate", (arg1, arg2) => {
    console.log(arg1);
    console.log(arg2);
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
        const oldPrice = parseFloat(priceCell.innerText) || 0;
        priceCell.innerText = `${newPrice} $`;

        priceCell.classList.remove('price-up', 'price-down');
        void priceCell.offsetWidth; // Trigger Reflow
        priceCell.classList.add(newPrice >= oldPrice ? 'price-up' : 'price-down');
    }
});

connection.start()
    .then(() => console.log("✅ متصل بـ SignalR بنجاح!"))
    .catch(err => console.error("❌ فشل الاتصال بـ SignalR:", err));

// التشغيل الابتدائي عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    loadStocks();
});