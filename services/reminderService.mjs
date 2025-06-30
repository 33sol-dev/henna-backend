// shopifyapp/services/reminderService.mjs
import { Queue } from 'bullmq';
import IORedis    from 'ioredis';
import 'dotenv/config';

const connection    = new IORedis(process.env.REDIS_URL);
export const reminderQueue = new Queue('coupon-reminders', { connection });

/**
 * Schedule 4 delayed jobs: at 2, 5, 7 and 11 days.
 * Each job payload contains { phone, coupon, day }.
 */
export async function scheduleReminders(phone, coupon) {
  const days = [2,5,7,11];
  for (const day of days) {
    await reminderQueue.add(
      `nudge:${coupon}:${day}`,
      { phone, coupon, day },
      { delay: day * 24 * 60 * 60 * 1000 }  // ms
    );
  }
}
