import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Daily "new matches" digest push notification.
 *
 * Targets dormant users who haven't opened the app in >= DORMANCY_DAYS days
 * and haven't received a digest in >= FREQ_CAP_DAYS days. For each, counts
 * NEW verified signups from the last WINDOW_DAYS that pass their hard
 * filters (via count_new_matches_for_digest RPC). If count >= MIN_COUNT,
 * enqueues a localized push into notification_queue. The aggregate count is
 * the only personal data surfaced — no individual names are revealed.
 *
 * Schedule: pg_cron job `send-new-matches-digest-daily` at 17:00 UTC.
 *
 * Idempotency: last_digest_sent_at guards double-sends within a single day
 * even if the cron fires twice.
 *
 * Translations: inlined below rather than imported from _shared/translations.ts
 * to keep the function self-contained. Keys are mirrored client-side at
 * notifications.newMatchesDigest.* if we ever want an in-app variant.
 */

const DORMANCY_DAYS = 3;
const FREQ_CAP_DAYS = 7;
const WINDOW_DAYS   = 7;
const MIN_COUNT     = 1;
const BATCH_SIZE    = 500;

type Translation = { title: string; bodySingular: string; bodyPlural: string };

const TRANSLATIONS: Record<string, Translation> = {
  en: { title: 'New matches near you ✨', bodySingular: '{{count}} new compatible member joined this week. Come take a look.', bodyPlural: '{{count}} new compatible members joined this week. Come take a look.' },
  es: { title: 'Nuevas coincidencias cerca de ti ✨', bodySingular: '{{count}} nuevo miembro compatible se unió esta semana. Echa un vistazo.', bodyPlural: '{{count}} nuevos miembros compatibles se unieron esta semana. Echa un vistazo.' },
  fr: { title: 'De nouveaux matchs près de toi ✨', bodySingular: '{{count}} nouveau membre compatible a rejoint cette semaine. Viens jeter un œil.', bodyPlural: '{{count}} nouveaux membres compatibles ont rejoint cette semaine. Viens jeter un œil.' },
  de: { title: 'Neue Matches in deiner Nähe ✨', bodySingular: '{{count}} neues kompatibles Mitglied ist diese Woche beigetreten. Schau mal rein.', bodyPlural: '{{count}} neue kompatible Mitglieder sind diese Woche beigetreten. Schau mal rein.' },
  ar: { title: 'توافقات جديدة بالقرب منك ✨', bodySingular: 'انضم {{count}} عضو متوافق جديد هذا الأسبوع. ألقِ نظرة.', bodyPlural: 'انضم {{count}} أعضاء متوافقون جدد هذا الأسبوع. ألقِ نظرة.' },
  hi: { title: 'आपके पास नए मैच ✨', bodySingular: 'इस हफ़्ते {{count}} नया संगत सदस्य जुड़ा है। एक नज़र डालें।', bodyPlural: 'इस हफ़्ते {{count}} नए संगत सदस्य जुड़े हैं। एक नज़र डालें।' },
  pt: { title: 'Novos matches perto de você ✨', bodySingular: '{{count}} novo membro compatível entrou esta semana. Dá uma olhada.', bodyPlural: '{{count}} novos membros compatíveis entraram esta semana. Dá uma olhada.' },
  ru: { title: 'Новые совпадения рядом ✨', bodySingular: 'На этой неделе присоединился {{count}} новый подходящий участник. Загляните.', bodyPlural: 'На этой неделе присоединилось {{count}} новых подходящих участников. Загляните.' },
  zh: { title: '附近有新的匹配 ✨', bodySingular: '本周有 {{count}} 位新的合适会员加入。来看看吧。', bodyPlural: '本周有 {{count}} 位新的合适会员加入。来看看吧。' },
  tr: { title: 'Yakınında yeni eşleşmeler ✨', bodySingular: 'Bu hafta {{count}} yeni uyumlu üye katıldı. Göz at.', bodyPlural: 'Bu hafta {{count}} yeni uyumlu üye katıldı. Göz at.' },
  it: { title: 'Nuovi match vicino a te ✨', bodySingular: "{{count}} nuovo membro compatibile si è unito questa settimana. Dai un'occhiata.", bodyPlural: "{{count}} nuovi membri compatibili si sono uniti questa settimana. Dai un'occhiata." },
  pl: { title: 'Nowe dopasowania w pobliżu ✨', bodySingular: 'W tym tygodniu dołączył {{count}} nowy zgodny członek. Zajrzyj.', bodyPlural: 'W tym tygodniu dołączyło {{count}} nowych zgodnych członków. Zajrzyj.' },
  uk: { title: 'Нові збіги поруч ✨', bodySingular: 'Цього тижня приєднався {{count}} новий сумісний учасник. Зазирніть.', bodyPlural: 'Цього тижня приєдналося {{count}} нових сумісних учасників. Зазирніть.' },
  he: { title: 'התאמות חדשות בקרבתך ✨', bodySingular: 'השבוע הצטרף {{count}} חבר מתאים חדש. בואו תראו.', bodyPlural: 'השבוע הצטרפו {{count}} חברים מתאימים חדשים. בואו תראו.' },
  fa: { title: 'همخوانی‌های جدید در نزدیکی شما ✨', bodySingular: 'این هفته {{count}} عضو همخوان جدید ملحق شد. یک نگاه بیندازید.', bodyPlural: 'این هفته {{count}} عضو همخوان جدید ملحق شدند. یک نگاه بیندازید.' },
  ur: { title: 'آپ کے قریب نئے میچز ✨', bodySingular: 'اس ہفتے {{count}} نیا موافق رکن شامل ہوا۔ ایک نظر ڈالیں۔', bodyPlural: 'اس ہفتے {{count}} نئے موافق ارکان شامل ہوئے۔ ایک نظر ڈالیں۔' },
  bn: { title: 'আপনার কাছে নতুন ম্যাচ ✨', bodySingular: 'এই সপ্তাহে {{count}} নতুন সামঞ্জস্যপূর্ণ সদস্য যোগ দিয়েছেন। একবার দেখুন।', bodyPlural: 'এই সপ্তাহে {{count}} নতুন সামঞ্জস্যপূর্ণ সদস্য যোগ দিয়েছেন। একবার দেখুন।' },
  id: { title: 'Kecocokan baru di dekatmu ✨', bodySingular: 'Minggu ini {{count}} anggota cocok baru bergabung. Yuk, lihat.', bodyPlural: 'Minggu ini {{count}} anggota cocok baru bergabung. Yuk, lihat.' },
  ka: { title: 'ახალი დამთხვევები თქვენთან ახლოს ✨', bodySingular: 'ამ კვირაში შემოუერთდა {{count}} ახალი თავსებადი წევრი. გადახედეთ.', bodyPlural: 'ამ კვირაში შემოუერთდა {{count}} ახალი თავსებადი წევრი. გადახედეთ.' },
};

function interpolate(text: string, count: number): string {
  return text.replace(/\{\{count\}\}/g, String(count));
}

function pickTranslation(lang: string | null | undefined, count: number): { title: string; body: string } {
  const base = (lang ?? 'en').split('-')[0].toLowerCase();
  const tr = TRANSLATIONS[base] ?? TRANSLATIONS.en;
  const bodyTemplate = count === 1 ? tr.bodySingular : tr.bodyPlural;
  return { title: tr.title, body: interpolate(bodyTemplate, count) };
}

interface DigestTarget {
  profileId: string;
  preferredLanguage: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const dormantBefore = new Date(now.getTime() - DORMANCY_DAYS * 86400_000).toISOString();
    const digestCapBefore = new Date(now.getTime() - FREQ_CAP_DAYS * 86400_000).toISOString();

    // 1. Fetch eligible dormant users.
    const { data: candidates, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, preferred_language, last_active_at, last_digest_sent_at')
      .lt('last_active_at', dormantBefore)
      .eq('push_enabled', true)
      .eq('is_active', true)
      .eq('profile_complete', true)
      .or('policy_restricted.is.null,policy_restricted.eq.false')
      .or('is_admin.is.null,is_admin.eq.false')
      .or(`last_digest_sent_at.is.null,last_digest_sent_at.lt.${digestCapBefore}`)
      .limit(BATCH_SIZE);

    if (fetchErr) throw fetchErr;

    const targets: DigestTarget[] = (candidates ?? []).map((c) => ({
      profileId: c.id as string,
      preferredLanguage: (c.preferred_language as string) || 'en',
    }));

    console.log(`[digest] ${targets.length} dormant candidate(s) to check`);

    let enqueued = 0;
    let skippedNoMatches = 0;
    let errored = 0;

    // 2. For each, count new matches via RPC; enqueue notification if >= MIN_COUNT.
    for (const tgt of targets) {
      try {
        const { data: count, error: rpcErr } = await supabase.rpc(
          'count_new_matches_for_digest',
          { p_profile_id: tgt.profileId, p_window_days: WINDOW_DAYS },
        );

        if (rpcErr) {
          console.error(`[digest] RPC failed for ${tgt.profileId}:`, rpcErr);
          errored++;
          continue;
        }

        const newMatchCount = Number(count ?? 0);
        if (newMatchCount < MIN_COUNT) {
          skippedNoMatches++;
          continue;
        }

        const { title, body } = pickTranslation(tgt.preferredLanguage, newMatchCount);

        const { error: insertErr } = await supabase
          .from('notification_queue')
          .insert({
            recipient_profile_id: tgt.profileId,
            notification_type: 'new_matches_digest',
            title,
            body,
            data: {
              type: 'new_matches_digest',
              screen: 'discover',
              count: newMatchCount,
            },
            status: 'pending',
          });

        if (insertErr) {
          console.error(`[digest] queue insert failed for ${tgt.profileId}:`, insertErr);
          errored++;
          continue;
        }

        // Stamp last_digest_sent_at so the frequency cap sticks even before
        // process-notifications actually delivers the push.
        const { error: stampErr } = await supabase
          .from('profiles')
          .update({ last_digest_sent_at: now.toISOString() })
          .eq('id', tgt.profileId);

        if (stampErr) {
          console.error(`[digest] stamp failed for ${tgt.profileId}:`, stampErr);
          // Don't roll back the queue row — the push will still send; next run
          // will just double-stamp at worst.
        }

        enqueued++;
      } catch (e: any) {
        console.error(`[digest] unexpected error for ${tgt.profileId}:`, e?.message ?? e);
        errored++;
      }
    }

    const result = {
      success: true,
      candidates: targets.length,
      enqueued,
      skippedNoMatches,
      errored,
      window_days: WINDOW_DAYS,
      dormancy_days: DORMANCY_DAYS,
      freq_cap_days: FREQ_CAP_DAYS,
      min_count: MIN_COUNT,
    };
    console.log('[digest] run complete', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error in send-new-matches-digest:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
