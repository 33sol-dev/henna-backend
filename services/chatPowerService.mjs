// shopifyapp/services/chatPowerService.mjs
import fetch from 'node-fetch';

const ORDER_WEBHOOK_URL = 'https://hooks.chatpowers.com/event/webhook/685992692fa663e3c6af53d7';
const NUDGE_WEBHOOK_URL = 'https://hooks.chatpowers.com/event/webhook/685c1e04001d3f9716902afa';

/**
 * phone: E.164 string
 * event: 'order-created' | 'order_shipped' | 'order_delivered' | 'nudge_<days>'
 * payloadData: an object, e.g. { order: '#1007' } or { coupon: 'FREEABC123' }
 */
export async function callChatPowers(phone, event, payloadData) {
  const url = event.startsWith('nudge_') ? NUDGE_WEBHOOK_URL : ORDER_WEBHOOK_URL;
  const body = {
    to:    phone,
    event: event,
    data:  payloadData
  };

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}
