/**
 * PostHog Debugging Script
 *
 * Run this in your app to verify PostHog is working correctly
 *
 * Usage:
 * 1. Import this file in your app/_layout.tsx
 * 2. Call testPostHog() after initialization
 * 3. Check console logs for results
 */

import { posthogClient, trackEvent } from '@/lib/analytics';

export async function testPostHog() {
  console.log('\n🔍 ===== PostHog Diagnostic Test =====\n');

  // Check if client exists
  if (!posthogClient) {
    console.error('❌ PostHog client is NULL - not initialized!');
    console.log('Possible causes:');
    console.log('1. Missing EXPO_PUBLIC_POSTHOG_API_KEY in environment');
    console.log('2. Initialization failed (check logs above)');
    console.log('3. initializePostHog() was not called');
    return;
  }

  console.log('✅ PostHog client exists');

  // Check environment variables
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST;

  console.log('\n📋 Environment Check:');
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : '❌ MISSING');
  console.log('Host:', host || '❌ MISSING');

  if (!apiKey) {
    console.error('\n❌ EXPO_PUBLIC_POSTHOG_API_KEY is missing!');
    console.log('Add to eas.json production.env or .env file');
    return;
  }

  // Send test events
  console.log('\n📤 Sending test events...');

  try {
    trackEvent('posthog_test_event', {
      timestamp: new Date().toISOString(),
      test_type: 'manual_diagnostic',
      source: 'test-posthog-script',
    });
    console.log('✅ Test event sent');

    // Force flush to ensure immediate delivery
    if (posthogClient.flush) {
      await posthogClient.flush();
      console.log('✅ Events flushed to PostHog servers');
    }

    console.log('\n✅ PostHog appears to be working!');
    console.log('Check your PostHog dashboard at https://us.i.posthog.com');
    console.log('Look for event: "posthog_test_event"');
    console.log('Events may take 1-2 minutes to appear in dashboard');

  } catch (error) {
    console.error('\n❌ Error sending test event:', error);
  }

  console.log('\n🔍 ===== End of PostHog Diagnostic Test =====\n');
}

// Auto-run in development (comment out if you don't want auto-run)
if (__DEV__) {
  setTimeout(() => {
    testPostHog().catch(console.error);
  }, 3000); // Wait 3 seconds after app starts
}
