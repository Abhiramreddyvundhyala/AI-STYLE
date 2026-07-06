/**
 * Validation Utilities
 * Input validation helpers
 */

import type { CreateStyleInput, CreateRatingInput } from '../types/database';
import {
  MIN_STYLE_PRICE,
  MAX_STYLE_PRICE,
  MIN_WITHDRAWAL_AMOUNT,
  CATEGORIES,
} from '../types/database';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate style input
 */
export function validateStyleInput(input: Partial<CreateStyleInput>): string[] {
  const errors: string[] = [];

  if (!input.title || input.title.trim().length < 3) {
    errors.push('Title must be at least 3 characters');
  }

  if (!input.category || !CATEGORIES.includes(input.category as any)) {
    errors.push('Invalid category');
  }

  if (
    typeof input.price !== 'number' ||
    input.price < MIN_STYLE_PRICE ||
    input.price > MAX_STYLE_PRICE
  ) {
    errors.push(`Price must be between ₹${MIN_STYLE_PRICE} and ₹${MAX_STYLE_PRICE}`);
  }

  if (!input.sample_image_url || !isValidUrl(input.sample_image_url)) {
    errors.push('Valid sample image URL is required');
  }

  if (!input.prompt || input.prompt.trim().length === 0) {
    errors.push('Prompt is required');
  }

  return errors;
}

/**
 * Validate rating input
 */
export function validateRatingInput(input: Partial<CreateRatingInput>): string[] {
  const errors: string[] = [];

  if (!input.stars || input.stars < 1 || input.stars > 5) {
    errors.push('Rating must be between 1 and 5 stars');
  }

  if (input.review_text && input.review_text.length > 500) {
    errors.push('Review text must be less than 500 characters');
  }

  return errors;
}

/**
 * Validate withdrawal amount
 */
export function validateWithdrawalAmount(
  amount: number,
  availableBalance: number
): string[] {
  const errors: string[] = [];

  if (amount < MIN_WITHDRAWAL_AMOUNT) {
    errors.push(`Minimum withdrawal amount is ₹${MIN_WITHDRAWAL_AMOUNT}`);
  }

  if (amount > availableBalance) {
    errors.push('Insufficient balance');
  }

  return errors;
}

/**
 * Validate UPI ID
 */
export function validateUpiId(upiId: string): boolean {
  const upiRegex = /^[\w.-]+@[\w.-]+$/;
  return upiRegex.test(upiId);
}

/**
 * Validate email
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize HTML
 */
export function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): string[] {
  const errors: string[] = [];

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    errors.push('Only JPEG, PNG, and WebP images are allowed');
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    errors.push('Image size must be less than 10MB');
  }

  return errors;
}
