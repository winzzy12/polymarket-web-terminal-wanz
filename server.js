const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Import strategy modules
const MakerMM = require('./src/strategies/makerMM');
const CopyTrader = require('./src/strategies/copyTrader');
const Sniper = require('./src/strategies/sniper');

// Store active strategy instances
const activeStrategies = {
  makerMM: null,
  copyTrader: null,
  sniper: null
};

// Load saved configurations
let strategyConfigs = {};
const configPath = path.join(__dirname, 'config', 'strategies.json');
if (fs.existsSync(configPath)) {
  strategyConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.get('/api/config/:strategy', (req, res) => {
  const { strategy } = req.params;
  res.json(strategyConfigs[strategy] || {});
});

app.post('/api/config/:strategy', (req, res) => {
  const { strategy } = req.params;
  strategyConfigs[strategy] = req.body;
  fs.writeFileSync(configPath, JSON.stringify(strategyConfigs, null, 2));
  res.json({ success: true, message: 'Configuration saved' });
});

app.get('/api/status', (req, res) => {
  const status = {};
  for (const [key, instance] of Object.entries(activeStrategies)) {
    status[key] = instance ? instance.getStatus() : { running: false };
  }
  res.json(status);
});

app.post('/api/start/:strategy', async (req, res) => {
  const { strategy } = req.params;
  const config = strategyConfigs[strategy];
  
  if (!config) {
    return res.status(400).json({ error: 'Strategy not configured' });
  }

  try {
    switch(strategy) {
      case 'makerMM':
        if (activeStrategies.makerMM) await activeStrategies.makerMM.stop();
        activeStrategies.makerMM = new MakerMM(config, io);
        await activeStrategies.makerMM.start();
        break;
      case 'copyTrader':
        if (activeStrategies.copyTrader) await activeStrategies.copyTrader.stop();
        activeStrategies.copyTrader = new CopyTrader(config, io);
        await activeStrategies.copyTrader.start();
        break;
      case 'sniper':
        if (activeStrategies.sniper) await activeStrategies.sniper.stop();
        activeStrategies.sniper = new Sniper(config, io);
        await activeStrategies.sniper.start();
        break;
    }
    res.json({ success: true, message: `${strategy} started` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stop/:strategy', async (req, res) => {
  const { strategy } = req.params;
  
  try {
    if (activeStrategies[strategy]) {
      await activeStrategies[strategy].stop();
      activeStrategies[strategy] = null;
    }
    res.json({ success: true, message: `${strategy} stopped` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Send initial status
  const status = {};
  for (const [key, instance] of Object.entries(activeStrategies)) {
    status[key] = instance ? instance.getStatus() : { running: false };
  }
  socket.emit('status', status);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Web UI available at http://localhost:3000');
});
