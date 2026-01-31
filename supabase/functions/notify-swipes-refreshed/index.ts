import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { t } from "../_shared/translations.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPrefs {
  profile_id: string;
  push_swipes_refreshed: boolean;
  last_swipe_limit_hit_at: string | null;
  swipe_refresh_notified_at: string | null;
}

interface Profile {
  id: string;
  push_token: string | null;
  push_enabled: boolean;
  display_name: string;
  preferred_language: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find users who:
    // 1. Hit their swipe limit in the last 24 hours
    // 2. Haven't been notified since they hit the limit
    // 3. Have swipe refresh notifications enabled
    // 4. Have push notifications enabled and a valid token
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: eligibleUsers, error: fetchError } = await supabase
      .from("notification_preferences")
      .select(`
        profile_id,
        push_swipes_refreshed,
        last_swipe_limit_hit_at,
        swipe_refresh_notified_at
      `)
      .eq("push_swipes_refreshed", true)
      .not("last_swipe_limit_hit_at", "is", null)
      .gte("last_swipe_limit_hit_at", twentyFourHoursAgo.toISOString());

    if (fetchError) {
      console.error("Error fetching eligible users:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${eligibleUsers?.length || 0} users who hit swipe limit recently`);

    // Filter to users who haven't been notified since hitting limit
    const usersToNotify = (eligibleUsers || []).filter((user: NotificationPrefs) => {
      if (!user.last_swipe_limit_hit_at) return false;
      if (!user.swipe_refresh_notified_at) return true;

      // Only notify if they haven't been notified since hitting the limit
      return new Date(user.swipe_refresh_notified_at) < new Date(user.last_swipe_limit_hit_at);
    });

    console.log(`${usersToNotify.length} users need to be notified`);

    if (usersToNotify.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: "No users to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get profile details for these users (including preferred_language for localization)
    const profileIds = usersToNotify.map((u: NotificationPrefs) => u.profile_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, push_token, push_enabled, display_name, preferred_language")
      .in("id", profileIds)
      .eq("push_enabled", true)
      .not("push_token", "is", null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Also get device tokens for multi-device support
    const { data: deviceTokens } = await supabase
      .from("device_tokens")
      .select("profile_id, push_token")
      .in("profile_id", profileIds);

    // Build token map (profile_id -> all tokens) and language map
    const tokenMap = new Map<string, Set<string>>();
    const languageMap = new Map<string, string>();

    // Add tokens and language from profiles table
    (profiles || []).forEach((p: Profile) => {
      if (p.push_token) {
        if (!tokenMap.has(p.id)) tokenMap.set(p.id, new Set());
        tokenMap.get(p.id)!.add(p.push_token);
      }
      languageMap.set(p.id, p.preferred_language || 'en');
    });

    // Add tokens from device_tokens table
    (deviceTokens || []).forEach((dt: { profile_id: string; push_token: string }) => {
      if (!tokenMap.has(dt.profile_id)) tokenMap.set(dt.profile_id, new Set());
      tokenMap.get(dt.profile_id)!.add(dt.push_token);
    });

    console.log(`Found ${tokenMap.size} profiles with push tokens`);

    // Prepare push notifications (localized per user)
    const messages: any[] = [];
    const notifiedProfileIds: string[] = [];

    tokenMap.forEach((tokens, profileId) => {
      const lang = languageMap.get(profileId) || 'en';
      const title = t(lang, 'swipesRefreshed.title');
      const body = t(lang, 'swipesRefreshed.body');

      tokens.forEach((token) => {
        messages.push({
          to: token,
          sound: "default",
          title,
          body,
          data: {
            type: "swipes_refreshed",
            profileId,
          },
          priority: "high",
          channelId: "default",
        });
      });
      notifiedProfileIds.push(profileId);
    });

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notified: 0, message: "No valid push tokens" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send push notifications via Expo
    console.log(`Sending ${messages.length} push notifications...`);

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log("Expo Push API response:", JSON.stringify(result));

    // Count successes
    let successCount = 0;
    if (result.data) {
      result.data.forEach((item: any) => {
        if (item.status === "ok") successCount++;
      });
    }

    // Update notification timestamps for notified users
    if (notifiedProfileIds.length > 0) {
      const { error: updateError } = await supabase
        .from("notification_preferences")
        .update({ swipe_refresh_notified_at: now.toISOString() })
        .in("profile_id", notifiedProfileIds);

      if (updateError) {
        console.error("Error updating notification timestamps:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified: successCount,
        totalMessages: messages.length,
        profilesNotified: notifiedProfileIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-swipes-refreshed:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
