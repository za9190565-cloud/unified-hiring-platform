const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const sendersPath = path.join(__dirname, '../../config/senders.json');
let senders = JSON.parse(fs.readFileSync(sendersPath, 'utf8'));
let currentSenderIndex = 0;

const stats = { totalSent: 0, replyRate: 0 };
const systemConfig = { warmup: { min: 20, max: 150 }, cooldown: { perDomainPerMinute: 1 }, dailyLimit: 150 };
const inMemoryQueue = [];
let isProcessing = false;

function getNextSender() {
    const sender = senders[currentSenderIndex];
    currentSenderIndex = (currentSenderIndex + 1) % senders.length;
    return sender;
}

async function processJob(jobData) {
    const { title, body, leadEmail, leadId } = jobData;
    const account = getNextSender();

    console.log(`[Sending] ${account.email} -> ${leadEmail}`);

    const transporter = nodemailer.createTransport({
        host: account.host,
        port: account.port,
        secure: account.secure,
        auth: { user: account.email, pass: account.pass }
    });

    await transporter.sendMail({
        from: `"إدارة التوظيف" <${account.email}>`,
        to: leadEmail,
        subject: title,
        text: body
    });

    stats.totalSent++;
    return { success: true, sentAt: new Date().toISOString(), by: account.email, to: leadEmail, leadId };
}

async function processQueue() {
    if (isProcessing || inMemoryQueue.length === 0) return;
    
    isProcessing = true;
    const job = inMemoryQueue.shift();
    
    try {
        await processJob(job.data);
        console.log(`[Success] Sent to ${job.data.leadEmail}`);
    } catch (err) {
        console.error('[Error]', err.message);
    }
    
    isProcessing = false;
    if (inMemoryQueue.length > 0) setTimeout(processQueue, 2000);
}

async function enqueue(lead, titleBase, customBody, priority) {
    inMemoryQueue.push({
        id: Date.now(),
        data: {
            leadEmail: lead.email,
            title: titleBase,
            body: customBody || "السلام عليكم، نشكركم لاهتمامكم بخدماتنا.",
            leadId: lead.id
        }
    });
    processQueue();
}

const messageQueue = {
    add: enqueue,
    getJobCounts: async () => ({ waiting: inMemoryQueue.length, active: 0, completed: 0 }),
    getCompleted: async () => []
};

module.exports = {
    messageQueue,
    systemConfig,
    stats,
    updateConfig: (cfg) => Object.assign(systemConfig, cfg),
    enqueue,
    getRecentJobs: async () => []
};
