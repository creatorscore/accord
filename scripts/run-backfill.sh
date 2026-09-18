#!/bin/bash
# Drives the backfill-stuck-onboarding edge function in 25-id batches.
# One-shot rescue for users stuck on location_required_when_complete.
set -u

FN_URL='https://xcaktvlosjsaxcntxbyf.supabase.co/functions/v1/backfill-stuck-onboarding'
TOKEN='PVrH_pUOJ2a3YCmo-b1oI8vs0yiAiYNL'
IDS_JSON="$(dirname "$0")/backfill-batches.json"
BATCH_SIZE=25
DRY_RUN="${DRY_RUN:-false}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2; exit 1
fi

total=$(jq 'length' "$IDS_JSON")
echo "Total IDs: $total — batch size: $BATCH_SIZE — dry_run: $DRY_RUN"

t_candidates=0; t_geocode_failed=0; t_updated=0; t_update_failed=0
batch_n=0
for ((i = 0; i < total; i += BATCH_SIZE)); do
  batch_n=$((batch_n + 1))
  end=$((i + BATCH_SIZE))
  ids=$(jq -c ".[$i:$end]" "$IDS_JSON")
  body=$(jq -nc --argjson ids "$ids" --arg dry "$DRY_RUN" '{profile_ids: $ids, dry_run: ($dry == "true")}')

  echo
  echo "--- batch $batch_n (ids $i..$((end-1))) ---"
  resp=$(curl -s -X POST "$FN_URL" \
    -H "x-backfill-token: $TOKEN" \
    -H 'content-type: application/json' \
    --max-time 120 \
    -d "$body")
  echo "$resp"
  if jq -e . >/dev/null 2>&1 <<<"$resp"; then
    t_candidates=$((t_candidates + $(jq -r '.candidates // 0' <<<"$resp")))
    t_geocode_failed=$((t_geocode_failed + $(jq -r '.geocode_failed // 0' <<<"$resp")))
    t_updated=$((t_updated + $(jq -r '.updated // 0' <<<"$resp")))
    t_update_failed=$((t_update_failed + $(jq -r '.update_failed // 0' <<<"$resp")))
  else
    echo "(non-JSON response — counting as failure)" >&2
  fi
  # Small gap between batches so Nominatim sees breathing room
  sleep 2
done

echo
echo "=========================================="
echo "TOTAL: candidates=$t_candidates updated=$t_updated geocode_failed=$t_geocode_failed update_failed=$t_update_failed"
