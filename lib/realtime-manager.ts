/**
 * Realtime Connection Manager
 * Prevents runaway costs by limiting concurrent realtime channels per user
 *
 * Without limits: 10K users × 10 channels = 100K concurrent connections = $$$$
 * With limits: 10K users × 3 channels max = 30K connections = manageable
 */

import { RealtimeChannel } from '@supabase/supabase-js';

interface ChannelRegistry {
  [userId: string]: {
    channels: RealtimeChannel[];
    lastActivity: number;
  };
}

class RealtimeConnectionManager {
  private registry: ChannelRegistry = {};
  private MAX_CHANNELS_PER_USER = 5; // Maximum concurrent channels per user
  private IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start automatic cleanup of idle connections
    this.startCleanup();
  }

  /**
   * Register a new channel for a user
   * Automatically enforces per-user limits
   */
  registerChannel(userId: string, channel: RealtimeChannel): boolean {
    if (!this.registry[userId]) {
      this.registry[userId] = {
        channels: [],
        lastActivity: Date.now(),
      };
    }

    const userChannels = this.registry[userId];

    // Enforce max channels per user
    if (userChannels.channels.length >= this.MAX_CHANNELS_PER_USER) {
      console.warn(
        `User ${userId} reached max channels (${this.MAX_CHANNELS_PER_USER}). Removing oldest.`
      );

      // Remove oldest channel
      const oldestChannel = userChannels.channels.shift();
      if (oldestChannel) {
        oldestChannel.unsubscribe();
      }
    }

    // Add new channel
    userChannels.channels.push(channel);
    userChannels.lastActivity = Date.now();

    console.log(
      `User ${userId} now has ${userChannels.channels.length} active channels`
    );

    return true;
  }

  /**
   * Unregister a channel for a user
   */
  unregisterChannel(userId: string, channel: RealtimeChannel): void {
    if (!this.registry[userId]) return;

    const userChannels = this.registry[userId];
    const index = userChannels.channels.indexOf(channel);

    if (index > -1) {
      userChannels.channels.splice(index, 1);
      userChannels.lastActivity = Date.now();

      console.log(
        `Unregistered channel for user ${userId}. ${userChannels.channels.length} remaining.`
      );

      // Clean up user registry if no channels left
      if (userChannels.channels.length === 0) {
        delete this.registry[userId];
      }
    }
  }

  /**
   * Update last activity for a user
   */
  updateActivity(userId: string): void {
    if (this.registry[userId]) {
      this.registry[userId].lastActivity = Date.now();
    }
  }

  /**
   * Get current channel count for a user
   */
  getUserChannelCount(userId: string): number {
    return this.registry[userId]?.channels.length || 0;
  }

  /**
   * Get total active channels across all users
   */
  getTotalChannelCount(): number {
    return Object.values(this.registry).reduce(
      (total, user) => total + user.channels.length,
      0
    );
  }

  /**
   * Cleanup idle connections
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const usersToCleanup: string[] = [];

    for (const [userId, data] of Object.entries(this.registry)) {
      const idleTime = now - data.lastActivity;

      if (idleTime > this.IDLE_TIMEOUT) {
        console.log(
          `Cleaning up idle connections for user ${userId} (idle for ${Math.round(
            idleTime / 60000
          )}min)`
        );

        // Unsubscribe all channels for this user
        data.channels.forEach((channel) => {
          try {
            channel.unsubscribe();
          } catch (error) {
            console.error('Error unsubscribing channel:', error);
          }
        });

        usersToCleanup.push(userId);
      }
    }

    // Remove cleaned up users from registry
    usersToCleanup.forEach((userId) => {
      delete this.registry[userId];
    });

    if (usersToCleanup.length > 0) {
      console.log(`Cleaned up ${usersToCleanup.length} idle users`);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupInterval) return;

    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
      this.logStats();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Log connection statistics
   */
  private logStats(): void {
    const totalChannels = this.getTotalChannelCount();
    const totalUsers = Object.keys(this.registry).length;

    console.log('📊 Realtime Stats:', {
      totalUsers,
      totalChannels,
      avgChannelsPerUser: totalUsers > 0 ? (totalChannels / totalUsers).toFixed(2) : 0,
    });
  }

  /**
   * Force cleanup all connections (for app shutdown)
   */
  cleanup(): void {
    Object.values(this.registry).forEach((data) => {
      data.channels.forEach((channel) => {
        try {
          channel.unsubscribe();
        } catch (error) {
          console.error('Error during cleanup:', error);
        }
      });
    });

    this.registry = {};
    this.stopCleanup();
  }
}

// Singleton instance
export const realtimeManager = new RealtimeConnectionManager();

/**
 * Helper hook for managing realtime subscriptions with automatic cleanup
 */
export function useRealtimeChannel(
  userId: string,
  createChannel: () => RealtimeChannel,
  deps: any[] = []
) {
  const channelRef = { current: null as RealtimeChannel | null };

  // Setup
  const setupChannel = () => {
    // Check if user already has max channels
    if (realtimeManager.getUserChannelCount(userId) >= 5) {
      console.warn(`User ${userId} at max channels, will replace oldest`);
    }

    // Create and register channel
    const channel = createChannel();
    realtimeManager.registerChannel(userId, channel);
    channelRef.current = channel;

    return channel;
  };

  // Cleanup
  const cleanup = () => {
    if (channelRef.current) {
      realtimeManager.unregisterChannel(userId, channelRef.current);
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  };

  return { setupChannel, cleanup, updateActivity: () => realtimeManager.updateActivity(userId) };
}

/**
 * Cost estimation based on current usage
 */
export function estimateRealtimeCost(): {
  dailyMessages: number;
  monthlyMessages: number;
  estimatedCost: number;
} {
  const totalChannels = realtimeManager.getTotalChannelCount();

  // Estimate: Each channel sends ~50 messages/day
  const dailyMessages = totalChannels * 50;
  const monthlyMessages = dailyMessages * 30;

  // Supabase pricing: $10 per 100K messages beyond 2M included
  const includedMessages = 2000000;
  const overageMessages = Math.max(0, monthlyMessages - includedMessages);
  const estimatedCost = (overageMessages / 100000) * 10;

  return {
    dailyMessages,
    monthlyMessages,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
  };
}
