# Supabase Edge Functions

This directory contains Supabase Edge Functions that run on the Deno runtime.

## TypeScript Configuration

Edge Functions use **Deno**, not Node.js, so they have a separate TypeScript configuration:

- **`deno.jsonc`**: Deno TypeScript configuration for Edge Functions
- **Root `tsconfig.json`**: Excludes `supabase/functions` (Node.js doesn't compile Deno code)

## Type Checking

### Using Supabase CLI (Recommended)
The Supabase CLI automatically type-checks Edge Functions when deploying:

```bash
# Deploy a function (automatically type-checks with Deno)
npx supabase functions deploy function-name

# Deploy all functions
npx supabase functions deploy
```

### Using Deno Directly
If you have Deno installed, you can type-check locally:

```bash
# Install Deno (if needed)
curl -fsSL https://deno.land/install.sh | sh

# Type check a specific function
cd supabase/functions/function-name
deno check index.ts

# Type check all functions
for dir in supabase/functions/*/; do
  if [ -f "$dir/index.ts" ]; then
    echo "Checking $dir..."
    deno check "$dir/index.ts"
  fi
done
```

## Available Functions

### Production Functions (Live)
- **`admin-broadcast`**: Send push notifications to users
- **`process-notifications`**: Process notification queue
- **`revenuecat-webhook`**: Handle RevenueCat subscription webhooks
- **`reviews-get-profile`**: Get review data for profiles
- **`reviews-notify`**: Send review reminder notifications
- **`reviews-submit`**: Submit user reviews
- **`mailerlite-sync`**: Sync users to MailerLite
- **`mailerlite-webhook`**: Handle MailerLite webhooks

## Development Workflow

### Creating a New Function

```bash
# Create function
npx supabase functions new my-function

# Add to deno.jsonc if needed
# The function will automatically inherit the deno.jsonc config
```

### Testing Locally

```bash
# Start Supabase locally
npx supabase start

# Serve function locally (auto-reloads on changes)
npx supabase functions serve function-name --env-file supabase/.env.local

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/function-name' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"key":"value"}'
```

### Deploying

```bash
# Deploy single function
npx supabase functions deploy function-name

# Deploy all functions
npx supabase functions deploy

# Deploy with custom environment variables
npx supabase secrets set MY_SECRET=value
npx supabase functions deploy function-name
```

## Important: Backward Compatibility

⚠️ **This is a LIVE app with active users!**

When modifying Edge Functions:
1. **Never change function signatures** without versioning (e.g., `/v2/function-name`)
2. **Always maintain backward compatibility** with existing API contracts
3. **Test thoroughly** in local/staging before deploying
4. **Use database migrations** for schema changes (never break existing queries)
5. **Handle errors gracefully** - return proper HTTP status codes

## Environment Variables

Edge Functions access environment variables via `Deno.env.get()`:

```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
```

### Setting Secrets

```bash
# Set a secret
npx supabase secrets set MY_SECRET=value

# List secrets
npx supabase secrets list

# Unset a secret
npx supabase secrets unset MY_SECRET
```

## Common Patterns

### CORS Headers
Always import and use CORS headers:

```typescript
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ... your logic

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
```

### Authentication
Always verify user authentication:

```typescript
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  throw new Error('Missing authorization header');
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  { global: { headers: { Authorization: authHeader } } }
);

const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  throw new Error('Not authenticated');
}
```

### Error Handling
Always catch and return proper error responses:

```typescript
try {
  // ... your logic
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
} catch (error) {
  console.error('Function error:', error);
  return new Response(
    JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error instanceof Error && error.message.includes('Not authenticated') ? 401 : 400,
    }
  );
}
```

## Monitoring

### Viewing Logs

```bash
# View logs for a specific function
npx supabase functions logs function-name

# Follow logs in real-time
npx supabase functions logs function-name --follow

# View logs from specific time
npx supabase functions logs function-name --since 1h
```

### Debugging

Add console.log statements - they'll appear in function logs:

```typescript
console.log('Processing request:', { userId: user.id, action: 'create' });
console.error('Error occurred:', error);
```

## TypeScript Tips

### Deno-Specific Types
Deno provides built-in types:

```typescript
// Request/Response are globally available
Deno.serve(async (req: Request): Promise<Response> => {
  // ...
});

// Use Deno APIs
const env = Deno.env.get('MY_VAR');
const file = await Deno.readTextFile('./file.txt');
```

### Import Maps
Use JSR imports for Supabase client:

```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2';
```

### Type Safety with Database
Generate types from your database schema:

```bash
npx supabase gen types typescript --local > supabase/functions/_shared/database.types.ts
```

Then import and use:

```typescript
import { Database } from '../_shared/database.types.ts';

const supabase = createClient<Database>(url, key);
```

## Troubleshooting

### "Cannot find module" errors
- Make sure you're using JSR imports: `jsr:@supabase/supabase-js@2`
- Check that `deno.jsonc` exists in `supabase/functions/`

### Type errors when running `tsc`
- This is normal! The root `tsconfig.json` excludes Edge Functions
- Use `npx supabase functions deploy` which uses Deno's type checker

### Function not deploying
- Check you're logged in: `npx supabase login`
- Verify project linked: `npx supabase link --project-ref your-project-ref`
- Check function syntax: `deno check index.ts`

## Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)
- [Deno Deploy](https://deno.com/deploy)
