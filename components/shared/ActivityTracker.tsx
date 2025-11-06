import { useActivityTracker } from '@/hooks/useActivityTracker';

/**
 * Component that tracks user activity in the background
 * Place this at the root of your app to enable activity tracking
 */
export const ActivityTracker = () => {
  useActivityTracker();
  return null; // This component doesn't render anything
};
