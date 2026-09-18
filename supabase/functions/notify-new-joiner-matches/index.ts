import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Real-time "a new match just joined" alert (PUSH channel).
 *
 * Runs every ~30 min. Finds profiles that just finished onboarding (complete +
 * active, created recently, not yet broadcast) and — for each — pushes a small,
 * capped set of DORMANT existing users whose hard filters the joiner satisfies
 * (so the joiner shows up in their discovery). Reverse match + all the guards
 * (dormancy, per-recipient 3-day alert cap, not-already-swiped, blocks/bans,
 * push reachability) live in get_users_matching_new_joiner.
 *
 * Anti-spam: each recipient is capped to one joiner alert per 3 days
 * (last_joiner_alert_at) AND the alert stamps last_digest_sent_at too, so it
 * suppresses the weekly digest for them for a week — a user never gets a joiner
 * alert and a digest stacked. At most RECIPIENTS_PER_JOINER recipients per new
 * joiner. Email-only users are intentionally NOT targeted here; the hourly email
 * digest already covers new joiners across the week for them.
 *
 * The created_at recency gate is essential: every pre-existing profile has
 * joiner_broadcast_at = NULL, so without it the first run would broadcast the
 * entire back catalogue.
 */

const JOINER_LOOKBACK_HOURS   = 2;   // safety window for "just joined"
const MAX_JOINERS_PER_RUN     = 60;
const RECIPIENTS_PER_JOINER   = 40;
const DORMANCY_DAYS           = 2;
const ALERT_CAP_DAYS          = 3;

type T = { title: string; body: string };
const COPY: Record<string, T> = {
  en: { title: 'Someone new joined ✨', body: 'A new member who matches what you’re looking for just joined Accord. Say hi 👋' },
  es: { title: 'Alguien nuevo se unió ✨', body: 'Un nuevo miembro que coincide con lo que buscas acaba de unirse a Accord. Salúdalo 👋' },
  fr: { title: 'Quelqu’un vient d’arriver ✨', body: 'Un nouveau membre qui te correspond vient de rejoindre Accord. Dis bonjour 👋' },
  de: { title: 'Jemand Neues ist da ✨', body: 'Ein neues Mitglied, das zu dir passt, ist gerade Accord beigetreten. Sag Hallo 👋' },
  pt: { title: 'Alguém novo entrou ✨', body: 'Um novo membro que combina com você acabou de entrar no Accord. Diga oi 👋' },
  it: { title: 'Qualcuno di nuovo è arrivato ✨', body: 'Un nuovo membro che ti corrisponde si è appena unito ad Accord. Salutalo 👋' },
  ru: { title: 'Кто-то новый присоединился ✨', body: 'Новый подходящий участник только что присоединился к Accord. Поздоровайтесь 👋' },
  ar: { title: 'انضم شخص جديد ✨', body: 'عضو جديد يناسبك انضم للتو إلى Accord. ألق التحية 👋' },
  hi: { title: 'कोई नया जुड़ा ✨', body: 'आपकी पसंद से मेल खाने वाला एक नया सदस्य अभी Accord से जुड़ा। नमस्ते कहें 👋' },
  zh: { title: '有新成员加入 ✨', body: '一位与你匹配的新成员刚刚加入 Accord。打个招呼吧 👋' },
  tr: { title: 'Yeni biri katıldı ✨', body: 'Aradığına uyan yeni bir üye az önce Accord’a katıldı. Merhaba de 👋' },
  id: { title: 'Seseorang baru bergabung ✨', body: 'Anggota baru yang cocok denganmu baru saja bergabung dengan Accord. Sapa dia 👋' },
};
function pick(lang: string | null | undefined): T {
  const base = (lang ?? 'en').split('-')[0].toLowerCase();
  return COPY[base] ?? COPY.en;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const nowIso = new Date().toISOString();
    const sinceIso = new Date(Date.now() - JOINER_LOOKBACK_HOURS * 3600_000).toISOString();

    // New joiners: completed onboarding recently, not yet broadcast.
    const { data: joiners, error: jErr } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('profile_complete', true)
      .eq('is_active', true)
      .is('joiner_broadcast_at', null)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(MAX_JOINERS_PER_RUN);
    if (jErr) throw jErr;

    let joinersProcessed = 0, alertsEnqueued = 0;

    for (const j of joiners ?? []) {
      try {
        const { data: recipients, error: rErr } = await supabase.rpc('get_users_matching_new_joiner', {
          p_new_profile_id: j.id,
          p_channel: 'push',
          p_dormancy_days: DORMANCY_DAYS,
          p_alert_cap_days: ALERT_CAP_DAYS,
          p_limit: RECIPIENTS_PER_JOINER,
        });
        if (rErr) { console.error(`[joiner] match rpc failed for ${j.id}:`, rErr); continue; }

        const list = (recipients ?? []) as Array<{ profile_id: string; preferred_language: string }>;

        if (list.length > 0) {
          const rows = list.map((r) => {
            const t = pick(r.preferred_language);
            return {
              recipient_profile_id: r.profile_id,
              notification_type: 'new_joiner_match',
              title: t.title,
              body: t.body,
              data: { type: 'new_joiner_match', screen: 'discover', joiner_profile_id: j.id },
              status: 'pending',
            };
          });
          const { error: insErr } = await supabase.from('notification_queue').insert(rows);
          if (insErr) { console.error(`[joiner] queue insert failed for ${j.id}:`, insErr); continue; }

          // Stamp recipients: the 3-day joiner cap AND suppress the weekly digest
          // so a user never gets a joiner alert and a digest stacked.
          const ids = list.map((r) => r.profile_id);
          await supabase.from('profiles').update({ last_joiner_alert_at: nowIso, last_digest_sent_at: nowIso }).in('id', ids);
          alertsEnqueued += rows.length;
        }

        // Mark the joiner processed regardless (so we don't re-scan it).
        await supabase.from('profiles').update({ joiner_broadcast_at: nowIso }).eq('id', j.id);
        joinersProcessed++;
      } catch (e: any) {
        console.error(`[joiner] unexpected for ${j.id}:`, e?.message ?? e);
      }
    }

    const result = { success: true, joinersFound: (joiners ?? []).length, joinersProcessed, alertsEnqueued };
    console.log('[joiner] run complete', result);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    console.error('Error in notify-new-joiner-matches:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message ?? String(error) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
