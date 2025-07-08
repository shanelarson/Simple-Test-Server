// src/utils/moderation.js
// Utility for calling OpenAI Moderation API
import fetch from 'node-fetch';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  // Applications importing this module must set this variable for moderation
  console.warn('[OpenAI Moderation] OPENAI_API_KEY is not set! Moderation will fail.');
}

/**
 * Checks a text string using OpenAI Moderation endpoint.
 * @param {string} input - The comment text to check
 * @returns {Promise<{flagged: boolean, categories?: object, reasons?: Array<string>, raw?: any}>}
 * @throws Error if the API is unreachable or fails (caller should treat this as moderation failure/block)
 */
export async function moderateText(input) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI moderation is not configured (OPENAI_API_KEY missing).');
  }

  const resp = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({ input })
  });
  if (!resp.ok) {
    // For rate limits or any error, surface a generic error
    let msg = 'Moderation service error.';
    try {
      const data = await resp.json();
      msg = data.error && data.error.message ? data.error.message : msg;
    } catch {}
    throw new Error(msg);
  }
  const json = await resp.json();
  // OpenAI moderation API always returns results.results[0]
  if (!json || !json.results || !json.results.length) {
    throw new Error('Invalid moderation service response.');
  }
  const res = json.results[0];
  return {
    flagged: !!res.flagged,
    categories: res.categories,
    reasons: res.category_scores ? Object.keys(res.category_scores).filter(cat => res.categories[cat]) : [],
    raw: json
  };
}
