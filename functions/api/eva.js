// /api/eva -> serves data/backtest/eva_scores.json
// Distilled IP: Stern-Stewart EVA spreads per-stock from financial backtest.
import data from '../_data/eva_scores.json' with { type: 'json' };
import { guardRequest, jsonResponse, forbiddenResponse } from '../_shared/origin.js';

export async function onRequestGet({ request }) {
  const guard = guardRequest(request);
  if (!guard.ok) return forbiddenResponse();
  return jsonResponse(data, guard.origin);
}

export async function onRequestOptions({ request }) {
  const guard = guardRequest(request);
  if (!guard.ok) return forbiddenResponse();
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': guard.origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
}
