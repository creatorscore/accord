import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';

/**
 * Anti-scam (near-duplicate catfish): compute a 64-bit perceptual hash (dHash)
 * for profile photos that don't have one yet. A dHash survives recompression,
 * resize, and minor crops — so a re-saved/edited STOLEN photo keeps (roughly)
 * the same dHash even though its SHA-256 content_hash changed.
 *
 * dHash: shrink to 9x8 grayscale, then for each row compare each pixel to the
 * one to its right → 8*8 = 64 bits. Stored as a signed bigint in photos.
 *
 * Called by a cron to backfill (and pick up new uploads). Batch is kept small
 * because image decoding is CPU-heavy; we download a tiny transformed version
 * (falling back to the full image) so decode stays cheap.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_BATCH = 25;
const FAIL_SENTINEL = 0n; // real photos ~never dHash to 0 (perfectly flat image); used to mark un-hashable so we don't retry forever. Excluded from detection.

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function toSignedBigint(unsigned: bigint): bigint {
  return unsigned >= (1n << 63n) ? unsigned - (1n << 64n) : unsigned;
}

function dhash(img: Image): bigint {
  const W = 9, H = 8;
  const small = img.resize(W, H);
  let hash = 0n;
  let bit = 0n;
  for (let y = 1; y <= H; y++) {
    for (let x = 1; x < W; x++) {
      const a = Image.colorToRGBA(small.getPixelAt(x, y));
      const b = Image.colorToRGBA(small.getPixelAt(x + 1, y));
      const la = 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2];
      const lb = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2];
      if (la > lb) hash |= (1n << bit);
      bit++;
    }
  }
  return toSignedBigint(hash);
}

function pathFromUrl(url: string | null): string | null {
  if (!url) return null;
  if (!url.startsWith('http')) return url;
  const marker = '/profile-photos/';
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.substring(i + marker.length).split('?')[0];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let batch = DEFAULT_BATCH;
  try {
    const body = await req.json();
    if (body?.batch && Number.isFinite(body.batch)) batch = Math.max(1, Math.min(60, body.batch));
  } catch { /* no body */ }

  const { data: photos, error } = await admin
    .from('photos')
    .select('id, storage_path, url')
    .is('perceptual_hash', null)
    .limit(batch);

  if (error) return json({ error: error.message }, 500);
  if (!photos || photos.length === 0) return json({ done: true, processed: 0, ok: 0, failed: 0, remaining: 0 });

  let ok = 0, failed = 0;
  for (const p of photos) {
    let hash = FAIL_SENTINEL;
    try {
      const path = p.storage_path || pathFromUrl(p.url);
      if (path) {
        // Download a tiny version to keep decode cheap; fall back to full image.
        let bytes: Uint8Array | null = null;
        try {
          const { data: t } = await admin.storage.from('profile-photos')
            .download(path, { transform: { width: 36, height: 36, resize: 'fill' } });
          if (t) bytes = new Uint8Array(await t.arrayBuffer());
        } catch { /* transform not available — fall back */ }
        if (!bytes) {
          const { data: full } = await admin.storage.from('profile-photos').download(path);
          if (full) bytes = new Uint8Array(await full.arrayBuffer());
        }
        if (bytes && bytes.length > 0) {
          const img = await Image.decode(bytes);
          const h = dhash(img);
          hash = h === 0n ? 1n : h; // never store the fail-sentinel for a real hash
          ok++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    await admin.from('photos').update({ perceptual_hash: hash.toString() }).eq('id', p.id);
  }

  const { count: remaining } = await admin
    .from('photos').select('id', { count: 'exact', head: true }).is('perceptual_hash', null);

  return json({ processed: photos.length, ok, failed, remaining: remaining ?? null });
});
