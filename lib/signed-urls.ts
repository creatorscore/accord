/**
 * Signed URL utilities for private Supabase Storage buckets.
 *
 * All storage buckets are private — files require authentication.
 * This module generates time-limited signed URLs with in-memory caching.
 */

import { supabase } from './supabase';

// Cache: "bucket/path" → { url, expiresAt (epoch seconds) }
const cache = new Map<string, { url: string; expiresAt: number }>();

/** Signed URLs last 1 hour */
const SIGNED_URL_DURATION = 3600;
/** Refresh 5 minutes before expiry to avoid stale URLs */
const CACHE_BUFFER = 300;

/**
 * Extract the storage path from a full public/render URL.
 * Returns the input unchanged if it's already a bare path.
 */
export function extractStoragePath(urlOrPath: string, bucket: string): string {
  if (!urlOrPath) return urlOrPath;

  // Already a bare path (not a URL)
  if (!urlOrPath.startsWith('http')) return urlOrPath;

  // Public URL: .../storage/v1/object/public/{bucket}/...
  const publicPattern = `/storage/v1/object/public/${bucket}/`;
  const publicIdx = urlOrPath.indexOf(publicPattern);
  if (publicIdx !== -1) return urlOrPath.substring(publicIdx + publicPattern.length);

  // Render/transform URL: .../storage/v1/render/image/public/{bucket}/...
  const renderPattern = `/storage/v1/render/image/public/${bucket}/`;
  const renderIdx = urlOrPath.indexOf(renderPattern);
  if (renderIdx !== -1) {
    const pathWithParams = urlOrPath.substring(renderIdx + renderPattern.length);
    // Strip query params (e.g. ?width=300&quality=60)
    return pathWithParams.split('?')[0];
  }

  // Signed URL: .../storage/v1/object/sign/{bucket}/...?token=...
  const signPattern = `/storage/v1/object/sign/${bucket}/`;
  const signIdx = urlOrPath.indexOf(signPattern);
  if (signIdx !== -1) {
    const pathWithParams = urlOrPath.substring(signIdx + signPattern.length);
    return pathWithParams.split('?')[0];
  }

  return urlOrPath;
}

/**
 * Get a signed URL for a single file. Results are cached.
 * Retries once on failure and falls back to stale cache to prevent photo disappearing.
 */
export async function getSignedUrl(bucket: string, pathOrUrl: string): Promise<string | null> {
  if (!pathOrUrl) return null;

  const path = extractStoragePath(pathOrUrl, bucket);
  const cacheKey = `${bucket}/${path}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() / 1000 + CACHE_BUFFER) {
    return cached.url;
  }

  // Retry once on failure (network hiccup, transient auth issue)
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_DURATION);

    if (!error && data?.signedUrl) {
      cache.set(cacheKey, {
        url: data.signedUrl,
        expiresAt: Date.now() / 1000 + SIGNED_URL_DURATION,
      });
      return data.signedUrl;
    }

    if (attempt === 0) await new Promise(r => setTimeout(r, 150));
  }

  // Return stale cached URL rather than null — a slightly expired URL is better
  // than no photo at all. The CDN often serves them a few minutes past expiry.
  if (cached?.url) return cached.url;

  return null;
}

/**
 * Batch-sign multiple paths (single RPC, much faster than N individual calls).
 */
export async function getSignedUrls(
  bucket: string,
  pathsOrUrls: string[],
): Promise<(string | null)[]> {
  if (!pathsOrUrls.length) return [];

  const paths = pathsOrUrls.map((p) => extractStoragePath(p, bucket));
  const results: (string | null)[] = new Array(paths.length).fill(null);
  const uncachedIndices: number[] = [];
  const uncachedPaths: string[] = [];

  // Check cache first
  for (let i = 0; i < paths.length; i++) {
    const cacheKey = `${bucket}/${paths[i]}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() / 1000 + CACHE_BUFFER) {
      results[i] = cached.url;
    } else {
      uncachedIndices.push(i);
      uncachedPaths.push(paths[i]);
    }
  }

  // Sign uncached paths in batch (retry once on failure)
  if (uncachedPaths.length > 0) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(uncachedPaths, SIGNED_URL_DURATION);

      if (!error && data) {
        for (let j = 0; j < data.length; j++) {
          const signedUrl = data[j]?.signedUrl;
          if (signedUrl) {
            const idx = uncachedIndices[j];
            results[idx] = signedUrl;
            cache.set(`${bucket}/${uncachedPaths[j]}`, {
              url: signedUrl,
              expiresAt: Date.now() / 1000 + SIGNED_URL_DURATION,
            });
          }
        }
        break; // Success, no retry needed
      }

      if (attempt === 0) await new Promise(r => setTimeout(r, 150));
    }

    // Fill any still-null results with stale cache entries
    for (let j = 0; j < uncachedIndices.length; j++) {
      const idx = uncachedIndices[j];
      if (!results[idx]) {
        const stale = cache.get(`${bucket}/${uncachedPaths[j]}`);
        if (stale?.url) results[idx] = stale.url;
      }
    }
  }

  return results;
}

/**
 * Take an array of photo records (from the `photos` table) and return
 * a copy with `url` replaced by a signed URL derived from `storage_path`.
 *
 * Falls back to the original `url` if signing fails.
 */
export async function signPhotoUrls<
  T extends { storage_path?: string | null; url?: string | null },
>(photos: T[]): Promise<T[]> {
  if (!photos?.length) return photos;

  const paths = photos.map(
    (p) => p.storage_path || extractStoragePath(p.url || '', 'profile-photos'),
  );

  const signedUrls = await getSignedUrls('profile-photos', paths);

  return photos.map((photo, i) => ({
    ...photo,
    url: signedUrls[i] || photo.url,
  }));
}

/**
 * Sign all storage URLs in a batch of profiles (photos + voice intros).
 * Call this after fetching profiles from the database before displaying.
 */
export async function signProfileMediaUrls<
  T extends {
    photos?: { storage_path?: string | null; url?: string | null }[] | null;
    voice_intro_url?: string | null;
  },
>(profiles: T[]): Promise<T[]> {
  if (!profiles?.length) return profiles;

  // Collect all photo paths
  const allPhotos: { storage_path?: string | null; url?: string | null }[] = [];
  const photoOffsets: number[] = [];
  for (const profile of profiles) {
    photoOffsets.push(allPhotos.length);
    if (profile.photos?.length) {
      allPhotos.push(...profile.photos);
    }
  }

  // Batch-sign all photo URLs at once
  const signedPhotos = allPhotos.length > 0 ? await signPhotoUrls(allPhotos) : [];

  // Collect voice intro paths for batch signing
  const voiceEntries: { idx: number; path: string }[] = [];
  for (let i = 0; i < profiles.length; i++) {
    if (profiles[i].voice_intro_url) {
      voiceEntries.push({ idx: i, path: profiles[i].voice_intro_url! });
    }
  }
  const signedVoiceUrls =
    voiceEntries.length > 0
      ? await getSignedUrls(
          'voice-intros',
          voiceEntries.map((e) => e.path),
        )
      : [];

  // Reassemble profiles with signed URLs
  return profiles.map((profile, i) => {
    const copy = { ...profile };

    // Replace photo URLs
    const photoStart = photoOffsets[i];
    const photoCount = profile.photos?.length || 0;
    if (photoCount > 0) {
      copy.photos = signedPhotos.slice(photoStart, photoStart + photoCount) as any;
    }

    // Replace voice intro URL
    const voiceIdx = voiceEntries.findIndex((e) => e.idx === i);
    if (voiceIdx !== -1 && signedVoiceUrls[voiceIdx]) {
      copy.voice_intro_url = signedVoiceUrls[voiceIdx];
    }

    return copy;
  });
}

/** Clear the entire cache (useful on logout). */
export function clearSignedUrlCache(): void {
  cache.clear();
}
