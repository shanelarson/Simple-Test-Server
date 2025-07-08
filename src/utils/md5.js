// Utility function to compute MD5 hash
import crypto from 'crypto';

// Returns the hex MD5 digest of a string
export function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

