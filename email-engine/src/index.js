/**
 * Mursel Engine - Main Server
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const engine = require('./lib/engine_simple');
const quotaMonitor = require('./lib/quota_monitor');

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

// API: Send to individual user
app.post('/api/send', async (req, res) => {
    try {
        const { userId, email } = req.body;
        await engine.enqueue(
            { id: userId, email, lastReplyAt: null },
            'تحديث بيانات هيئة الرقابة',
            null,
            0
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API: Send batch
app.post('/api/send/batch', async (req, res) => {
    try {
        const { users } = req.body;
        let queued = 0;
        
        for (const user of users) {
            await engine.enqueue(
                { id: user.id, email: user.email, lastReplyAt: null },
                'تحديث بيانات هيئة الرقابة',
                null,
                0
            );
            queued++;
        }
        
        res.json({ success: true, queued });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API: Get Engine Stats
app.get('/api/stats', async (req, res) => {
    try {
        const counts = await engine.messageQueue.getJobCounts();
        const connectors = await quotaMonitor.checkAll();
        const recentJobs = await engine.getRecentJobs(20);

        res.json({
            totalSent: engine.stats.totalSent,
            replyRate: engine.stats.replyRate,
            queue: counts,
            config: engine.systemConfig,
            connectors: connectors,
            recentJobs: recentJobs
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API: Get Recent Jobs
app.get('/api/jobs/recent', async (req, res) => {
    try {
        const jobs = await engine.getRecentJobs(50);
        res.json({ success: true, jobs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`\n  🚀 Mursel Engine: http://localhost:${PORT}\n`);
});
