/**
 * React hooks for signed storage URLs.
 */

import { useState, useEffect, useRef } from 'react';
import { getSignedUrl, signPhotoUrls } from '../lib/signed-urls';

/**
 * Resolve a single signed URL from a bucket + path/url.
 * Returns null while loading, then the signed URL.
 */
export function useSignedUrl(
  bucket: string | null | undefined,
  pathOrUrl: string | null | undefined,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!bucket || !pathOrUrl) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    getSignedUrl(bucket, pathOrUrl).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [bucket, pathOrUrl]);

  return url;
}

/**
 * Take an array of photo records and return them with signed URLs.
 * Designed for the `photos` table shape: { storage_path, url, ... }.
 *
 * Re-signs when the input array reference changes.
 */
export function useSignedPhotos<
  T extends { storage_path?: string | null; url?: string | null },
>(photos: T[] | null | undefined): T[] {
  // Initialize with input photos (unsigned) to prevent empty flash during async signing
  const [signed, setSigned] = useState<T[]>(photos || []);
  // Track the input to avoid stale closures
  const inputRef = useRef(photos);
  inputRef.current = photos;

  useEffect(() => {
    if (!photos?.length) {
      setSigned([]);
      return;
    }
    // Show unsigned photos immediately while signing happens in background
    setSigned(photos);
    let cancelled = false;
    signPhotoUrls(photos).then((result) => {
      // Only update if the input hasn't changed
      if (!cancelled && inputRef.current === photos) {
        setSigned(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [photos]);

  return signed;
}
