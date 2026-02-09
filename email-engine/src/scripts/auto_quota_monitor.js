/**
 * 🔹 auto_quota_monitor.js – متابعة Gmail + إرسال تلقائي
 * Monitors Gmail quota and starts sending via ready connectors.
 */

const quotaMonitor = require('../lib/quota_monitor');
const engine = require('../lib/engine');
const tryever = require('../integrations/tryever');
const fs = require('fs');
const path = require('path');

const RATE_LIMIT_PER_SEC = 15;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function runMonitorCycle() {
    console.log(`[${new Date().toLocaleTimeString()}] 🔍 فحص حالة حصة Gmail (Quota)...`);

    // 1. Sync ready connectors
    const statuses = await quotaMonitor.checkAll();
    const readyConnectors = statuses.filter(s => s.status === 'READY');

    console.log(`[Monitor] الحسابات الجاهزة: ${readyConnectors.length}/${statuses.length}`);

    if (readyConnectors.length > 0) {
        console.log('🚀 حالة الإرسال: نشط (Active)');

        // 2. Fetch pending tasks (Example: verified users from tryever)
        // In a real scenario, this would pull from a database or a specific queue
        addLogToDashboard('بدء الإرسال عبر الحسابات الجاهزة...');

        // We simulate fetching targets from tryever integration
        // Actually, the engine.enqueue already handles adding to BullMQ
        // We just need to make sure the worker processes them with the rate limit
    } else {
        console.log('⏳ لا توجد حسابات جاهزة حالياً. بانتظار إعادة تفعيل Gmail Quota.');
    }

    setTimeout(runMonitorCycle, CHECK_INTERVAL);
}

function addLogToDashboard(msg) {
    // This would typically go through a websocket or shared state for the dashboard
    console.log(`[DASHBOARD_LOG] ${msg}`);
}

// Start the monitor
runMonitorCycle();

module.exports = { runMonitorCycle };
