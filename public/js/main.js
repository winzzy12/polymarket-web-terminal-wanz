let socket = io();
let currentLogs = [];

// Socket event handlers
socket.on('connect', () => {
    addLog('Connected to trading server', 'info');
    document.getElementById('connectionStatus').textContent = 'Connected';
    document.getElementById('connectionStatus').style.background = '#48bb78';
});

socket.on('disconnect', () => {
    addLog('Disconnected from server', 'error');
    document.getElementById('connectionStatus').textContent = 'Disconnected';
    document.getElementById('connectionStatus').style.background = '#f56565';
});

socket.on('status', (status) => {
    updateStatusIndicators(status);
});

socket.on('trade', (trade) => {
    addLog(`Trade executed: ${trade.type} - ${trade.amount} @ ${trade.price}`, 'success');
    updateMetrics(trade);
});

socket.on('log', (log) => {
    addLog(log.message, log.level);
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    });
});

// Strategy controls
document.getElementById('startMaker').addEventListener('click', () => startStrategy('makerMM'));
document.getElementById('stopMaker').addEventListener('click', () => stopStrategy('makerMM'));
document.getElementById('startCopy').addEventListener('click', () => startStrategy('copyTrader'));
document.getElementById('stopCopy').addEventListener('click', () => stopStrategy('copyTrader'));
document.getElementById('startSniper').addEventListener('click', () => startStrategy('sniper'));
document.getElementById('stopSniper').addEventListener('click', () => stopStrategy('sniper'));

// Form submissions
document.getElementById('makerConfig').addEventListener('submit', (e) => saveConfig(e, 'makerMM'));
document.getElementById('copyConfig').addEventListener('submit', (e) => saveConfig(e, 'copyTrader'));
document.getElementById('sniperConfig').addEventListener('submit', (e) => saveConfig(e, 'sniper'));

// Log controls
document.getElementById('clearLogs').addEventListener('click', () => {
    currentLogs = [];
    document.getElementById('logContainer').innerHTML = '';
});

document.getElementById('exportLogs').addEventListener('click', () => {
    const blob = new Blob([currentLogs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
});

async function saveConfig(event, strategy) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const config = Object.fromEntries(formData.entries());
    
    // Handle multiple select values
    for (let [key, value] of formData.entries()) {
        if (event.target.querySelector(`[name="${key}"]`)?.multiple) {
            config[key] = formData.getAll(key);
        }
    }
    
    try {
        const response = await fetch(`/api/config/${strategy}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            addLog(`${strategy} configuration saved`, 'success');
        }
    } catch (error) {
        addLog(`Failed to save config: ${error.message}`, 'error');
    }
}

async function startStrategy(strategy) {
    try {
        const response = await fetch(`/api/start/${strategy}`, { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            addLog(`${strategy} started successfully`, 'success');
        } else {
            addLog(`Failed to start ${strategy}: ${data.error}`, 'error');
        }
    } catch (error) {
        addLog(`Error starting ${strategy}: ${error.message}`, 'error');
    }
}

async function stopStrategy(strategy) {
    try {
        const response = await fetch(`/api/stop/${strategy}`, { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            addLog(`${strategy} stopped`, 'info');
        }
    } catch (error) {
        addLog(`Error stopping ${strategy}: ${error.message}`, 'error');
    }
}

function updateStatusIndicators(status) {
    const makerStatus = document.getElementById('makerStatus');
    const copyStatus = document.getElementById('copyStatus');
    const sniperStatus = document.getElementById('sniperStatus');
    
    if (status.makerMM?.running) {
        makerStatus.textContent = 'Running';
        makerStatus.className = 'status running';
    } else {
        makerStatus.textContent = 'Stopped';
        makerStatus.className = 'status stopped';
    }
    
    if (status.copyTrader?.running) {
        copyStatus.textContent = 'Running';
        copyStatus.className = 'status running';
    } else {
        copyStatus.textContent = 'Stopped';
        copyStatus.className = 'status stopped';
    }
    
    if (status.sniper?.running) {
        sniperStatus.textContent = 'Running';
        sniperStatus.className = 'status running';
    } else {
        sniperStatus.textContent = 'Stopped';
        sniperStatus.className = 'status stopped';
    }
}

function addLog(message, level = 'info') {
    const logContainer = document.getElementById('logContainer');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${level}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    currentLogs.push(`[${timestamp}] ${message}`);
    
    // Keep only last 1000 logs in memory
    if (currentLogs.length > 1000) {
        currentLogs.shift();
    }
}

function updateMetrics(trade) {
    // Update metrics based on trade data
    // This would be expanded with actual calculations
    const totalPnL = document.getElementById('totalPnL');
    const totalTrades = document.getElementById('totalTrades');
    
    let currentTrades = parseInt(totalTrades.textContent) || 0;
    totalTrades.textContent = currentTrades + 1;
    
    // Update P&L (simplified)
    let currentPnL = parseFloat(totalPnL.textContent.replace('$', '')) || 0;
    if (trade.pnl) {
        currentPnL += trade.pnl;
        totalPnL.textContent = `$${currentPnL.toFixed(2)}`;
    }
}

// Load initial configs
async function loadConfigs() {
    const strategies = ['makerMM', 'copyTrader', 'sniper'];
    for (const strategy of strategies) {
        try {
            const response = await fetch(`/api/config/${strategy}`);
            if (response.ok) {
                const config = await response.json();
                // Populate forms with saved configs
                populateForm(strategy, config);
            }
        } catch (error) {
            console.error(`Failed to load ${strategy} config:`, error);
        }
    }
}

function populateForm(strategy, config) {
    const formId = strategy === 'makerMM' ? 'makerConfig' : 
                   strategy === 'copyTrader' ? 'copyConfig' : 'sniperConfig';
    const form = document.getElementById(formId);
    
    for (const [key, value] of Object.entries(config)) {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = value === 'on' || value === true;
            } else if (input.multiple && Array.isArray(value)) {
                Array.from(input.options).forEach(option => {
                    option.selected = value.includes(option.value);
                });
            } else {
                input.value = value;
            }
        }
    }
}

// Initialize
loadConfigs();
addLog('Web interface loaded. Configure your strategies to begin trading.', 'info');
