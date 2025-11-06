/**
 * Utilities for online status and last active timestamps
 */

/**
 * Check if a user is currently online (active within last 5 minutes)
 */
export const isOnline = (lastActiveAt: string | null): boolean => {
  if (!lastActiveAt) return false;

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastActive.getTime()) / 1000 / 60;

  return diffMinutes < 5; // Online if active within last 5 minutes
};

/**
 * Get relative time string (e.g., "Active now", "Active 2h ago")
 * Returns null if hide_last_active is enabled or no timestamp
 */
export const getLastActiveText = (
  lastActiveAt: string | null,
  hideLastActive: boolean = false
): string | null => {
  if (hideLastActive || !lastActiveAt) return null;

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - lastActive.getTime()) / 1000);

  // Less than 5 minutes = "Active now"
  if (diffSeconds < 300) {
    return 'Active now';
  }

  // Less than 60 minutes = "Active Xm ago"
  if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `Active ${minutes}m ago`;
  }

  // Less than 24 hours = "Active Xh ago"
  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `Active ${hours}h ago`;
  }

  // Less than 7 days = "Active X days ago"
  if (diffSeconds < 604800) {
    const days = Math.floor(diffSeconds / 86400);
    return days === 1 ? 'Active yesterday' : `Active ${days} days ago`;
  }

  // More than 7 days = "Active over a week ago"
  return 'Active over a week ago';
};

/**
 * Get a shorter version for compact displays
 */
export const getLastActiveShort = (
  lastActiveAt: string | null,
  hideLastActive: boolean = false
): string | null => {
  if (hideLastActive || !lastActiveAt) return null;

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - lastActive.getTime()) / 1000);

  if (diffSeconds < 300) return 'Now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h`;
  if (diffSeconds < 604800) {
    const days = Math.floor(diffSeconds / 86400);
    return `${days}d`;
  }
  return '7d+';
};

/**
 * Get online status color
 */
export const getOnlineStatusColor = (lastActiveAt: string | null): string => {
  if (!lastActiveAt) return '#9CA3AF'; // Gray

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastActive.getTime()) / 1000 / 60;

  if (diffMinutes < 5) return '#10B981'; // Green - Online
  if (diffMinutes < 30) return '#FBBF24'; // Yellow - Recently active
  return '#9CA3AF'; // Gray - Offline
};
