// shopifyapp/jobs/reminderWorker.mjs
import * as BullMQ from 'bullmq';
const { Worker, QueueScheduler, Queue } = BullMQ;
import IORedis                   from 'ioredis';
import { coupons }               from '../utils/db.mjs';            // your Mongo collection
import { callChatPowers }        from '../services/chatPowerService.mjs';

const connection = new IORedis(process.env.REDIS_URL);
// ensure delayed jobs get processed
new QueueScheduler('coupon-reminders', { connection });

new Worker('coupon-reminders', async job => {
  const { phone, coupon, day } = job.data;

  // only send if coupon still valid & unused
  const doc = await coupons.findOne({ coupon });
  if (!doc || doc.used) return;

  // send your nudge message; you can customize text per `day`
  await callChatPowers(
    phone,
    `nudge_${day}`,       // or just a free-text message
    `It’s been ${day} days since we sent you code ${coupon}. Ready to try?`
  );

  // record that we sent this day’s nudge so you can inspect it later
  await coupons.updateOne(
    { coupon },
    { $push: { remindersSent: day } }
  );
}, { connection });
