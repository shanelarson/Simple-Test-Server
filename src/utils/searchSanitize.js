// Utility to sanitize search words for MongoDB regex construction
default function escapeRegex(str) {
  // Escape regex special characters: .*+?^${}()|[]\
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export { escapeRegex };
