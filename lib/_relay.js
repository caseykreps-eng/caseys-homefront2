// lib/_relay.js
export function getRelayBaseUrl() {
  return process.env.WS_RELAY_URL;
}

export function getRelayHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': process.env.RELAY_API_KEY || '', // If your relay requires a key
    ...extra,
  };
}

export async function fetchWithTimeout(url, options, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export function buildRelayResponse(response, body, headers = {}) {
  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}