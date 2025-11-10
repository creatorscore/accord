# Accord Scripts

Utility scripts for testing, load testing, and maintenance.

## Load Testing

### Matching Algorithm Load Test

Tests the performance of the matching algorithm at scale by generating test profiles and measuring response times.

```bash
# Run with default settings (100 profiles, 50 iterations)
npx ts-node scripts/load-test-matching.ts

# Custom configuration
npx ts-node scripts/load-test-matching.ts --profiles=1000 --iterations=200

# Skip cleanup (keep test profiles in database)
npx ts-node scripts/load-test-matching.ts --profiles=500 --no-cleanup
```

**Options:**
- `--profiles=N` - Number of test profiles to create (default: 100)
- `--iterations=N` - Number of test iterations to run (default: 50)
- `--no-cleanup` - Skip deleting test profiles after completion

**What it tests:**
- Compatibility score calculation performance
- Discovery query performance
- Database query efficiency
- Algorithm performance at scale

**Performance benchmarks:**
- Compatibility calculation: <100ms (excellent), 100-200ms (good), >200ms (needs optimization)
- Discovery queries: <500ms (excellent), 500-1000ms (acceptable), >1000ms (needs optimization)

### Cleanup Load Test Profiles

Remove all test profiles created by load testing scripts.

```bash
npx ts-node scripts/cleanup-load-test.ts
```

This will:
1. Find all profiles with display names starting with `LoadTest_`
2. Delete profiles (cascades to preferences, likes, matches)
3. Delete associated auth users

## Environment Variables Required

Make sure these are set in your `.env` file:

```bash
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Note:** Service role key is required for administrative operations like creating users and bulk operations.

## Future Scripts

Additional scripts to be added:
- Database migration utilities
- Analytics export scripts
- User data export (GDPR compliance)
- Batch verification status updates
