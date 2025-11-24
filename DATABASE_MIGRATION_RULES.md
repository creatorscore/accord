# Database Migration Rules for Accord

## Golden Rules for Backward Compatibility

### ✅ ALWAYS SAFE
1. **Add new columns with DEFAULT values**
   ```sql
   ALTER TABLE profiles ADD COLUMN new_field TEXT DEFAULT 'default_value';
   ```

2. **Add new tables**
   ```sql
   CREATE TABLE new_feature (...);
   ```

3. **Add new indexes**
   ```sql
   CREATE INDEX idx_name ON table(column);
   ```

4. **Add new triggers/functions**
   ```sql
   CREATE OR REPLACE FUNCTION ...
   ```

### ⚠️ REQUIRES PLANNING
1. **Changing column types**
   - Create new column with new type
   - Migrate data with a function
   - Deprecate old column
   - Remove old column after 2 releases

2. **Renaming columns**
   - Create new column
   - Copy data from old to new
   - Update app to use new column
   - Keep old column for 1-2 releases
   - Remove old column when minimum version is met

### ❌ NEVER DO (Breaking Changes)
1. **Remove columns without migration period**
2. **Change column constraints that reject existing data**
3. **Remove tables that active versions use**
4. **Change RLS policies that block existing app versions**

---

## Migration Process

### Step 1: Create Migration File
```bash
npx supabase migration new descriptive_name
```

### Step 2: Write SQL
Edit the generated file in `supabase/migrations/`

### Step 3: Test Locally (if using Supabase CLI)
```bash
npx supabase db reset
```

### Step 4: Push to Production
Use Supabase MCP tool:
```javascript
mcp__supabase__apply_migration({
  project_id: "xcaktvlosjsaxcntxbyf",
  name: "descriptive_name",
  query: "SQL HERE"
})
```

### Step 5: Verify
Check `list_migrations` to confirm it's applied

---

## Version Compatibility Matrix

| App Version | Min DB Schema Version | Notes |
|-------------|----------------------|-------|
| 1.0.0 | 20251105214120 | Initial release |
| 1.0.1 | 20251117173358 | Adds watermark, email hygiene |
| 1.1.0 | TBD | Future |

---

## Breaking Change Checklist

If you MUST make a breaking change:

- [ ] Document the change in release notes
- [ ] Update minimum supported app version
- [ ] Provide migration path for existing data
- [ ] Test with older app versions
- [ ] Notify users in advance (push notification)
- [ ] Keep old and new code paths for 1 release cycle
- [ ] Remove old code path only after analytics show <1% usage

---

## For Claude Code AI Assistant

When making database changes:

1. **Always check if it's backward compatible** using rules above
2. **Always create a migration file** (don't use execute_sql directly)
3. **Always add DEFAULT values** to new columns
4. **Never remove columns** without explicit user approval
5. **Ask before making breaking changes**
6. **Document all changes** in this file's Version Compatibility Matrix

## Example Safe Migration

```sql
-- SAFE: Adds new optional feature
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_pronouns TEXT DEFAULT 'they/them';

-- SAFE: Adds index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_location
  ON profiles(location_city, location_state);

-- SAFE: Adds new trigger (doesn't affect existing data)
CREATE OR REPLACE FUNCTION notify_on_match()
RETURNS TRIGGER AS $$
BEGIN
  -- function body
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Example UNSAFE Migration (Requires Planning)

```sql
-- UNSAFE: Changes column type
-- Instead, do this:

-- Step 1: Add new column
ALTER TABLE profiles ADD COLUMN age_new INTEGER;

-- Step 2: Migrate data
UPDATE profiles SET age_new = CAST(age AS INTEGER);

-- Step 3: Deploy app version that uses age_new
-- Wait 1-2 releases...

-- Step 4: Remove old column
ALTER TABLE profiles DROP COLUMN age;

-- Step 5: Rename new column (optional)
ALTER TABLE profiles RENAME COLUMN age_new TO age;
```

---

**Last Updated:** 2025-11-17
**Maintainer:** Claude Code AI Assistant
