// shopifyapp/services/shopifyService.mjs
import { randomBytes } from 'crypto';
import fetch         from 'node-fetch';
import 'dotenv/config';

const STORE = process.env.SHOPIFY_STORE;
const API   = `https://${STORE}/admin/api/2025-04/graphql.json`;
const REST  = `https://${STORE}/admin/api/2025-04`;

export function makeRandomCode() {
  return 'FREE' + randomBytes(3).toString('hex').toUpperCase();
}

export async function shopifyGraphQL(query, variables = {}) {
  const res  = await fetch(API, {
    method : 'POST',
    headers: {
      'Content-Type'           : 'application/json',
      'X-Shopify-Access-Token' : process.env.SHOPIFY_ACCESS_TOKEN
    },
    body   : JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

export async function getOrder(orderId) {
  const url = `${REST}/orders/${orderId}.json?fields=id,name,note_attributes,fulfillment_status`;
  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN }
  });
  if (!res.ok) {
    throw new Error(`GET /orders/${orderId} → ${res.status}`);
  }
  const { order } = await res.json();
  return order;
}

export function buildCartLink(code, phone) {
  const PRODUCT = '43095173169231:1';
  return `https://${STORE}/cart/${PRODUCT}`
       + `?discount=${encodeURIComponent(code)}`
       + `&shipping_address[phone]=${phone}`
       + `&attributes[whatsapp_phone]=${encodeURIComponent(phone)}`;
}
