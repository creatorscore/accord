import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to get watermark information for the current viewer
 *
 * Returns the current user's ID to be embedded in watermarks on profiles they view.
 * This creates a traceable record if they screenshot and share someone's profile.
 *
 * Usage:
 * ```tsx
 * const { viewerUserId, isReady } = useWatermark();
 *
 * return (
 *   <View>
 *     <ProfileContent />
 *     {isReady && <DynamicWatermark userId={profileId} viewerUserId={viewerUserId} />}
 *   </View>
 * );
 * ```
 */
export function useWatermark() {
  const { user } = useAuth();

  return {
    viewerUserId: user?.id || 'guest',
    isReady: !!user?.id,
  };
}
