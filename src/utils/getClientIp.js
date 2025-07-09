// Helper to extract the client IP from an Express request, supporting X-Forwarded-For and proxies
export function getClientIp(req) {
  // Trust X-Forwarded-For if present (in reverse proxy setups), else req.ip
  // Handles multiple IPs (comma separated)
  let ip = req.headers['x-forwarded-for'];
  if (ip) {
    if (Array.isArray(ip)) ip = ip[0];
    ip = ip.split(',')[0].trim(); // first in the list
  }
  if (!ip) {
    // Express populates req.ip (might be IPv6 format ::ffff:127.0.0.1)
    ip = req.ip;
  }
  // Strip IPv6 prefix if present
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip;
}
