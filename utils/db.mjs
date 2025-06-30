// shopifyapp/utils/db.mjs
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const mongo = new MongoClient(process.env.MONGODB_URI);
await mongo.connect();

export const coupons = mongo
  .db('henna')
  .collection('coupons');

// ensure uniqueness
await coupons.createIndex({ phone: 1 }, { unique: true });
