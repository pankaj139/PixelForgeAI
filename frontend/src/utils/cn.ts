import { type ClassValue, clsx } from 'clsx';

/**
 * Utility function to merge class names conditionally
 * This is a simplified version of the popular `cn` utility
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export default cn;