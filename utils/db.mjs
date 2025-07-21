// shopifyapp/utils/db.mjs
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const mongo = new MongoClient(process.env.MONGODB_URI);
await mongo.connect();

const db = mongo.db('henna');

// your existing coupons collection
export const coupons = db.collection('coupons');
await coupons.createIndex({ phone: 1 }, { unique: true });

// new pins collection for 4‑digit codes
export const pins = db.collection('pins');
await pins.createIndex({ phone: 1 }, { unique: true });
