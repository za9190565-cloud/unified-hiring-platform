/**
 * Mursel Smart Engine - Core Logic
 * Consolidates Subject Generation, Reply-First Management, and Queue integration.
 */

const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Setup Redis Connection with error handling
let redisConnection;
try {
    redisConnection = new IORedis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        maxRetriesPerRequest: null,
        retryStrategy: () => null,
        lazyConnect: true
    });
    
    redisConnection.on('error', (err) => {
        console.warn('[Redis] Connection failed, using in-memory queue');
    });
} catch (e) {
    console.warn('[Redis] Not available, using in-memory queue');
}

// Load Senders
const sendersPath = path.join(__dirname, '../../config/senders.json');
let senders = [];
try {
    senders = JSON.parse(fs.readFileSync(sendersPath, 'utf8'));
} catch (e) {
    console.warn('[Engine] No senders found in config/senders.json');
}

let currentSenderIndex = 0;
function getNextSender() {
    if (senders.length === 0) return null;
    const sender = senders[currentSenderIndex];
    currentSenderIndex = (currentSenderIndex + 1) % senders.length;
    return sender;
}

class SubjectGenerator {
    constructor() {
        this.rotation = ['إداري', 'شخصي', 'محايد'];
        this.history = new Map(); // key -> usage count
    }

    getContextDate() {
        const today = new Date();
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        return today.toLocaleDateString('ar-EG', options);
    }

    generate(titleBase) {
        const axis = this.rotation[Math.floor(Math.random() * this.rotation.length)];
        const dateContext = this.getContextDate();
        const key = `${axis}-${titleBase}-${dateContext}`;

        const count = this.history.get(key) || 0;
        if (count >= 5) {
            // If limit reached, try to rotate axis or just return with a suffix
            return `${titleBase} – ${axis} – ${dateContext} [${Date.now().toString().slice(-4)}]`;
        }

        this.history.set(key, count + 1);
        return `${titleBase} – ${axis} – ${dateContext}`;
    }
}

class ReplyFirstManager {
    constructor() {
        this.retryIntervals = [30 * 60 * 1000, 2 * 60 * 60 * 1000, 24 * 60 * 60 * 1000]; // 30min, 2h, 24h
    }

    /**
     * Checks if content needs a major change based on last reply time.
     */
    shouldChangeContent(lastReplyAt) {
        if (!lastReplyAt) return true;
        const now = Date.now();
        const elapsed = now - new Date(lastReplyAt).getTime();
        return elapsed > this.retryIntervals[this.retryIntervals.length - 1]; // Change if no reply in 24h
    }

    prioritize(jobs) {
        return jobs.sort((a, b) => (b.data.priority || 0) - (a.data.priority || 0));
    }
}

// Global System Configuration
let systemConfig = {
    warmup: { min: 20, max: 150 },
    cooldown: { perDomainPerMinute: 1, burstLimit: 3 },
    subjects: ['إداري', 'شخصي', 'محايد'],
    dailyLimit: 150,
    retryIntervals: [30 * 60 * 1000, 2 * 60 * 60 * 1000, 24 * 60 * 60 * 1000]
};

// Stats tracking
const stats = {
    totalSent: 0,
    replyRate: 0,
    lastUpdate: Date.now()
};

function updateConfig(newConfig) {
    systemConfig = { ...systemConfig, ...newConfig };
    console.log('[Engine] Configuration updated:', systemConfig);
    return systemConfig;
}

// Initialize Components
const subjectGen = new SubjectGenerator();
const replyManager = new ReplyFirstManager();

// In-memory queue fallback
let messageQueue;
let messageWorker;
let inMemoryQueue = [];
let isProcessing = false;

try {
    messageQueue = new Queue('mursel-messages', { connection: redisConnection });
    
    // Worker Implementation
    messageWorker = new Worker('mursel-messages', async job => {
        return await processJob(job.data);
    }, { connection: redisConnection });
} catch (e) {
    console.log('[Engine] Using in-memory queue (Redis not available)');
    messageQueue = {
        add: async (name, data, opts) => {
            inMemoryQueue.push({ id: Date.now(), data, opts });
            processInMemoryQueue();
            return { id: Date.now() };
        },
        getJobCounts: async () => ({ waiting: inMemoryQueue.length, active: 0, completed: 0 }),
        getCompleted: async () => []
    };
}

async function processJob(jobData) {
    const { title, body, leadEmail, priority, leadId } = jobData;
    const account = getNextSender();

    if (!account) {
        throw new Error('No SMTP accounts available');
    }

    console.log(`[Queue] Sending via ${account.email} -> ${leadEmail} | Subject: ${title}`);

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
        await transporter.sendMail({
            from: `"إدارة التوظيف" <${account.email}>`,
            to: leadEmail,
            subject: title,
            text: body,
            html: `<div>${body.replace(/\n/g, '<br>')}</div>`
        });

        stats.totalSent++;
        const delay = (60 / systemConfig.cooldown.perDomainPerMinute) * 1000;
        await new Promise(r => setTimeout(r, delay));

        return { success: true, sentAt: new Date().toISOString(), by: account.email, to: leadEmail, leadId };
    } catch (err) {
        console.error(`[SMTP Error] ${account.email} failed:`, err.message);
        throw err;
    }
}

async function processInMemoryQueue() {
    if (isProcessing || inMemoryQueue.length === 0) return;
    
    isProcessing = true;
    const job = inMemoryQueue.shift();
    
    try {
        await processJob(job.data);
    } catch (err) {
        console.error('[Queue] Job failed:', err.message);
    }
    
    isProcessing = false;
    if (inMemoryQueue.length > 0) {
        setTimeout(processInMemoryQueue, 1000);
    }
}

/**
 * Main Interface for adding messages
 */
async function enqueue(lead, titleBase, customBody = null, priority = 0) {
    const title = subjectGen.generate(titleBase);
    const needsContentChange = replyManager.shouldChangeContent(lead.lastReplyAt);

    await messageQueue.add('send_email', {
        leadEmail: lead.email,
        title: needsContentChange ? title : `${titleBase} (Follow up)`,
        body: customBody || "السلام عليكم، نشكركم لاهتمامكم بخدماتنا.",
        priority,
        leadId: lead.id
    }, {
        priority: priority > 0 ? 1 : 10, // BullMQ: lower is higher priority
        removeOnComplete: true
    });
}

/**
 * Get recent completed jobs
 */
async function getRecentJobs(limit = 20) {
    try {
        if (messageQueue.getCompleted) {
            const completed = await messageQueue.getCompleted(0, limit - 1);
            return completed.map(job => ({
                id: job.id,
                data: job.data,
                result: job.returnvalue,
                timestamp: job.finishedOn
            }));
        }
        return [];
    } catch (err) {
        return [];
    }
}

module.exports = {
    subjectGen,
    replyManager,
    messageQueue,
    messageWorker,
    systemConfig,
    stats,
    updateConfig,
    enqueue,
    getRecentJobs
};
