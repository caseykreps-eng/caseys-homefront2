// lib/_cors.js
export function getCorsHeaders(req, methods) {
  return {
    'Access-Control-Allow-Origin': '*', // Or restrict to your specific domain
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function isDisallowedOrigin(req) {
  // Add logic here if you want to block specific origins
  return false; 
}