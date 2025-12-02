/**
 * Utility for merging Tailwind CSS class names
 *
 * Combines clsx for conditional classes and tailwind-merge
 * for proper deduplication of Tailwind classes.
 *
 * Usage:
 * ```tsx
 * import { cn } from '@/lib/cn';
 *
 * <View className={cn(
 *   'base-classes',
 *   isActive && 'active-classes',
 *   className
 * )} />
 * ```
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export default cn;
