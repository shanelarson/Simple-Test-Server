// src/utils/captcha.js
import { Captcha } from 'captcha-canvas';
import { md5 } from './md5.js';

// The salt must be set in environment variables as CAPTCHA_SALT
const CAPTCHA_SALT = process.env.CAPTCHA_SALT;
if (!CAPTCHA_SALT) {
  // Log warning at runtime -- required for proper function
  console.warn('[Captcha] CAPTCHA_SALT is not set! Captcha validation will always fail.');
}

/**
 * Generates a new captcha image and salted MD5 hash
 * @returns {image: base64 image string, hash: salted md5 hash}
 */
export function generateCaptcha() {
  // Generate a captcha
  const captcha = new Captcha();
  captcha.async = false; // Synchronous rendering
  captcha.addDecoy();
  captcha.drawTrace();
  captcha.drawCaptcha();
  // Defensive check for captcha.png buffer
  if (!captcha.png || !(captcha.png instanceof Buffer)) {
    throw new Error('Captcha image generation failed.');
  }
  // Convert image buffer to base64 (without data URI prefix)
  const image = captcha.png.toString('base64');
  const text = captcha.text; // The solution
  const hash = md5(text + CAPTCHA_SALT);
  return { image, hash };
}

/**
 * Validates a captcha solution
 * @param {string} captchaText - User text input
 * @param {string} captchaHash - Hash sent from server when captcha generated
 * @returns {boolean}
 */
export function validateCaptcha(captchaText, captchaHash) {
  if (!captchaText || !captchaHash || !CAPTCHA_SALT) return false;
  const expected = md5(captchaText + CAPTCHA_SALT);
  return expected === captchaHash;
}

