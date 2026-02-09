/**
 * tryeverengine.com Integration
 * Handles fetching status and syncing with the local engine.
 */

const axios = require('axios');
const engine = require('../lib/engine');

const TRYEVER_CONFIG = {
    baseUrl: 'https://tryeverengine.com/api',
    apiKey: process.env.TRYEVER_API_KEY || 'YOUR_SECRET_KEY'
};

async function syncUserStatus(userId) {
    try {
        const response = await axios.get(`${TRYEVER_CONFIG.baseUrl}/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${TRYEVER_CONFIG.apiKey}` }
        });

        const userData = response.data;

        // Logic: Only process if verified
        if (userData && userData.status === 'verified') {
            console.log(`[Integration] User ${userId} is verified. Enqueueing message.`);
            await engine.enqueue(
                {
                    id: userId,
                    email: userData.email,
                    lastReplyAt: userData.lastReplyAt
                },
                'تحديث بيانات هيئة الرقابة',
                null,
                1 // High priority for verified
            );
            return { status: 'synced', userId };
        } else {
            console.log(`[Integration] User ${userId} status: ${userData ? userData.status : 'unknown'}. Skipping.`);
            return { status: 'skipped', userId };
        }
    } catch (error) {
        console.error(`[Integration Error] Failed to sync ${userId}:`, error.message);
        throw error;
    }
}

/**
 * Sync All active campaigns from tryever
 */
async function syncBatch(userIds) {
    const results = [];
    for (const id of userIds) {
        results.push(await syncUserStatus(id));
    }
    return results;
}

module.exports = {
    syncUserStatus,
    syncBatch
};
