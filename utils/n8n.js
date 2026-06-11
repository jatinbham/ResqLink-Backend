const axios = require("axios");

// Generic n8n webhook trigger
const triggerN8n = async (webhookUrl, payload) => {
  if (!webhookUrl) {
    console.warn("[N8n] Webhook URL not configured, skipping trigger.");
    return null;
  }
  try {
    const res = await axios.post(webhookUrl, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    });
    console.log(`[N8n] Triggered ${webhookUrl} → status ${res.status}`);
    return res.data;
  } catch (err) {
    // Non-blocking: log but don't crash the main flow
    console.error(`[N8n] Webhook failed (${webhookUrl}):`, err.message);
    return null;
  }
};

module.exports = {
  triggerRequestHelp: (payload) =>
    triggerN8n(process.env.N8N_WEBHOOK_REQUEST_HELP, payload),

  triggerVolunteer: (payload) =>
    triggerN8n(process.env.N8N_WEBHOOK_VOLUNTEER, payload),

  triggerAnalytics: (payload) =>
    triggerN8n(process.env.N8N_WEBHOOK_ANALYTICS, payload),

  triggerAlert: (payload) =>
    triggerN8n(process.env.N8N_WEBHOOK_ALERT, payload),

  triggerDonation: (payload) =>
    triggerN8n(process.env.N8N_WEBHOOK_DONATION, payload),
};
