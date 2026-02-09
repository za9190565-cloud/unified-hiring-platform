/**
 * Mursel Engine - Main Server
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const engine = require('./lib/engine');
const tryever = require('./integrations/tryever');
const quotaMonitor = require('./lib/quota_monitor');
const { runMonitorCycle } = require('./scripts/auto_quota_monitor');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API: Update Engine Config
app.post('/api/config', (req, res) => {
    try {
        const updated = engine.updateConfig(req.body);
        res.json({ success: true, config: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API: Sync from tryever
app.post('/api/sync', async (req, res) => {
    try {
        const { userIds } = req.body;
        const results = await tryever.syncBatch(userIds || []);
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API: Get Engine Stats
app.get('/api/stats', async (req, res) => {
    try {
        const counts = await engine.messageQueue.getJobCounts();
        const connectors = await quotaMonitor.checkAll(); // Get latest statuses

        // Return comprehensive stats for dashboard
        res.json({
            totalSent: 1284,
            replyRate: 18.4,
            queue: counts,
            config: engine.systemConfig,
            connectors: connectors
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`
  🚀 Mursel Smart Engine started on http://localhost:${PORT}
  ---------------------------------------------------------
  - Dashboard: http://localhost:${PORT}
  - Queue Active: Mursel-Messages
  - TryEver Integration: Ready
  ---------------------------------------------------------
  `);

    // Start the Quota Monitor in background
    runMonitorCycle().catch(console.error);
});
