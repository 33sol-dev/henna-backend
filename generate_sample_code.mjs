// shopifyapp/generate_sample_code.mjs
import express from 'express';
import cron    from 'node-cron';
import 'dotenv/config';

import { coupons } from './utils/db.mjs';
import {
  makeRandomCode,
  shopifyGraphQL,
  getOrder,
  buildCartLink
} from './services/shopifyService.mjs';
import { callChatPowers } from './services/chatPowerService.mjs';

const app = express();
app.use(express.json({ verify: rawBodySaver }));
function rawBodySaver(req, res, buf) { req.rawBody = buf; }

// 1) Issue coupon
app.post('/api/coupon', async (req, res) => {
  const phone = (req.body.phone || '').trim();
  if (!phone) return res.status(400).json({ error: 'phone required' });

  let doc = await coupons.findOne({ phone });
  if (doc) {
    return res.json({
      coupon: doc.coupon,
      reused: true,
      link:   buildCartLink(doc.coupon, phone)
    });
  }

  // reserve + push to Shopify
  const coupon = makeRandomCode();
  await coupons.insertOne({
    phone,
    coupon,
    createdAt:     new Date(),
    used:          false,
    remindersSent: []
  });

  const { discountRedeemCodeBulkAdd } = await shopifyGraphQL(`
    mutation($id: ID!, $codes: [DiscountRedeemCodeInput!]!) {
      discountRedeemCodeBulkAdd(discountId: $id, codes: $codes) {
        userErrors { field message }
      }
    }
  `, {
    id:    process.env.PARENT_DISCOUNT_ID,
    codes: [{ code: coupon }]
  });

  if (discountRedeemCodeBulkAdd.userErrors.length) {
    await coupons.deleteOne({ phone });
    return res.status(502)
      .json({ error: 'shopify', details: discountRedeemCodeBulkAdd.userErrors });
  }

  res.json({ coupon, link: buildCartLink(coupon, phone) });
});

// 2) Order‐created webhook
app.post('/webhook/order_created', async (req, res) => {
  const order = req.body;
  const attr  = (order.note_attributes || [])
                .find(a => a.name === 'whatsapp_phone');
  if (!attr) return res.sendStatus(200);

  const raw = attr.value;               // "%2B919871031182"
const phone = decodeURIComponent(raw); // "+919871031182"
  const orderName = order.name;
  console.log('order_created ➡', phone, orderName);

  // prevent future nudges
  const result = await coupons.updateOne(
    { phone, used: false },
    { $set: { used: true, usedAt: new Date() } }
  );

  if (result.modifiedCount) {
    await callChatPowers(phone, 'order-created', { order: orderName });
  }
  res.sendStatus(200);
});

// 3) Fulfillment webhook
app.post('/webhook/fulfillment', async (req, res) => {
  const { order_id, status, fulfillment_status } = req.body;
  try {
    const order = await getOrder(order_id);
    const attr  = (order.note_attributes || [])
                  .find(a => a.name === 'whatsapp_phone');
    if (!attr) return res.sendStatus(200);

    const raw = attr.value;               // "%2B919871031182"
    const phone = decodeURIComponent(raw);
    const stage = fulfillment_status || status;
    console.log('fulfillment ➡', phone, stage, order.name);

    await callChatPowers(phone, stage, { order: order.name });
    // mark used, too
    await coupons.updateOne(
      { phone, used: false },
      { $set: { used: true, usedAt: new Date() } }
    );

    res.sendStatus(200);
  } catch (err) {
    console.error('fulfillment-err', err);
    res.status(500).send('server error');
  }
});

// 4) Daily nudges at 4,7,10,13,16 days
// cron.schedule('0 0 * * *', async () => {
//   console.log('🕒 [CRON] daily nudge check at', new Date().toISOString());
//   const intervals = [4, 7, 10, 13, 16];   // days
//   const now = Date.now();

//   // fetch all coupons still unused
//   const docs = await coupons.find({ used: false }).toArray();

//   for (const doc of docs) {
//     const createdMs  = new Date(doc.createdAt).getTime();
//     const daysElapsed = Math.floor((now - createdMs) / 86400000);

//     for (const day of intervals) {
//       if (daysElapsed === day && !doc.remindersSent.includes(day)) {
//         try {
//           console.log(`→ sending nudge_${day} to ${doc.phone} (after ${day} days)`);
//           await callChatPowers(doc.phone, `nudge_${day}`, { coupon: doc.coupon });
//           await coupons.updateOne(
//             { _id: doc._id },
//             { $push: { remindersSent: day } }
//           );
//         } catch (err) {
//           console.error(`❌ nudge_${day} failed for ${doc.phone}`, err);
//         }
//       }
//     }
//   }
// });
// 4, 7, 10, 13, 16 days after issuance, every day at 13:00 server-time
cron.schedule('0 13 * * *', async () => {
  console.log('🕒 [CRON] daily nudge check at', new Date().toISOString())

  const intervals = [4, 7, 10, 13, 16]   // days after coupon.createdAt
  const nowMs     = Date.now()

  // grab all still-unused coupons
  const docs = await coupons.find({ used: false }).toArray()

  for (const doc of docs) {
    const createdMs  = new Date(doc.createdAt).getTime()
    const daysElapsed = Math.floor((nowMs - createdMs) / 86_400_000)  // ms in a day

    for (const day of intervals) {
      if (daysElapsed === day && !(doc.remindersSent || []).includes(day)) {
        try {
          console.log(`→ sending nudge_${day} to ${doc.phone} (after ${day} days)`)
          await callChatPowers(doc.phone, `nudge_${day}`, { coupon: doc.coupon })
          await coupons.updateOne(
            { _id: doc._id },
            { $push: { remindersSent: day } }
          )
        } catch (err) {
          console.error(`✖ nudge_${day} failed for ${doc.phone}`, err)
        }
      }
    }
  }
})

// start server…
app.listen(3000, () => console.log('API & TEST‐CRON running on :3000'));

app.listen(3000, () => console.log('API running on :3000'));
