/**
 * Gmail Quota & Health Monitor
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class QuotaMonitor {
    constructor() {
        this.sendersPath = path.join(__dirname, '../../config/senders.json');
        this.stats = new Map(); // email -> { status: 'READY'|'BLOCKED', lastChecked: Date }
    }

    /**
     * Tests a specific SMTP account for health and quota
     */
    async testConnector(account) {
        const transporter = nodemailer.createTransport({
            host: account.host,
            port: account.port,
            secure: account.secure,
            auth: {
                user: account.email,
                pass: account.pass
            }
        });

        try {
            await transporter.verify();
            this.stats.set(account.email, { status: 'READY', lastChecked: new Date() });
            return 'READY';
        } catch (error) {
            console.error(`[QuotaMonitor] Account ${account.email} failed:`, error.message);
            // If it's a quota error (usually 550 or 421 for Gmail)
            if (error.message.includes('quota') || error.message.includes('limit') || error.code === 'EENVELOPE') {
                this.stats.set(account.email, { status: 'BLOCKED', lastChecked: new Date() });
                return 'BLOCKED';
            }
            this.stats.set(account.email, { status: 'ERROR', lastChecked: new Date() });
            return 'ERROR';
        }
    }

    async checkAll() {
        if (!fs.existsSync(this.sendersPath)) return [];
        const senders = JSON.parse(fs.readFileSync(this.sendersPath, 'utf8'));
        const results = [];

        for (const sender of senders) {
            const status = await this.testConnector(sender);
            results.push({ email: sender.email, status });
        }
        return results;
    }

    getStatus(email) {
        return this.stats.get(email) || { status: 'UNKNOWN' };
    }
}

module.exports = new QuotaMonitor();
