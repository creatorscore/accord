import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * "New matches" digest push notification (PUSH channel).
 *
 * Candidate selection — dormancy, 7-day freq cap (shared last_digest_sent_at
 * with the email digest so the two channel audiences are disjoint), push
 * reachability, and per-user LOCAL send hour (~TARGET_LOCAL_HOUR, derived from
 * longitude) — is centralized in the get_digest_candidates RPC. For each
 * candidate, counts NEW signups from the last WINDOW_DAYS that pass their hard
 * filters (count_new_matches_for_digest). If count >= MIN_COUNT, enqueues a
 * localized push; otherwise a generic "we miss you" fallback. Only the
 * aggregate count is surfaced — never individual names.
 *
 * Schedule: pg_cron job `send-new-matches-digest-daily`, hourly; each run sends
 * to the users for whom it is ~TARGET_LOCAL_HOUR local right now.
 *
 * Idempotency: last_digest_sent_at guards double-sends.
 */

const DORMANCY_DAYS = 2;
const FREQ_CAP_DAYS = 7;
const WINDOW_DAYS   = 7;
const MIN_COUNT     = 1;
const BATCH_SIZE    = 2000;
const TARGET_LOCAL_HOUR = 18;

type Translation = { title: string; bodySingular: string; bodyPlural: string };

// Generic "we miss you" copy for dormant users with no compatible new signups
// in the WINDOW_DAYS window. Without this fallback, users in low-density
// regions never receive outreach at all.
const FALLBACK_TRANSLATIONS: Record<string, { title: string; body: string }> = {
  en: { title: 'We miss you 💜', body: 'Your matches are waiting. Come back and see who joined Accord.' },
  es: { title: 'Te extrañamos 💜', body: 'Tus coincidencias te esperan. Vuelve y mira quién se unió a Accord.' },
  fr: { title: 'Tu nous manques 💜', body: "Tes matchs t'attendent. Reviens voir qui a rejoint Accord." },
  de: { title: 'Wir vermissen dich 💜', body: 'Deine Matches warten. Schau, wer Accord beigetreten ist.' },
  ar: { title: 'نفتقدك 💜', body: 'توافقاتك بانتظارك. عُد وشاهد من انضم إلى Accord.' },
  hi: { title: 'हमें आपकी याद आ रही है 💜', body: 'आपके मैच इंतज़ार कर रहे हैं। वापस आइए और देखिए कौन Accord से जुड़ा।' },
  pt: { title: 'Sentimos sua falta 💜', body: 'Seus matches estão esperando. Volte e veja quem entrou no Accord.' },
  ru: { title: 'Мы скучаем по вам 💜', body: 'Ваши совпадения ждут. Вернитесь и посмотрите, кто присоединился к Accord.' },
  zh: { title: '我们想你了 💜', body: '你的匹配在等你。回来看看谁加入了 Accord。' },
  tr: { title: 'Seni özledik 💜', body: 'Eşleşmelerin seni bekliyor. Geri dön ve Accord’a kimin katıldığını gör.' },
  it: { title: 'Ci manchi 💜', body: "I tuoi match ti aspettano. Torna e scopri chi si è unito ad Accord." },
  pl: { title: 'Tęsknimy za tobą 💜', body: 'Twoje dopasowania czekają. Wróć i zobacz, kto dołączył do Accord.' },
  uk: { title: 'Ми сумуємо за вами 💜', body: 'Ваші збіги чекають. Поверніться і подивіться, хто приєднався до Accord.' },
  he: { title: 'מתגעגעים אליך 💜', body: 'ההתאמות שלך מחכות. חזרו וראו מי הצטרף ל-Accord.' },
  fa: { title: 'دلمان برایت تنگ شده 💜', body: 'همخوانی‌هایت منتظرند. بازگرد و ببین چه کسی به Accord پیوسته.' },
  ur: { title: 'ہمیں آپ کی یاد آتی ہے 💜', body: 'آپ کے میچز انتظار کر رہے ہیں۔ واپس آئیں اور دیکھیں کون Accord سے جڑا۔' },
  bn: { title: 'আপনাকে মিস করছি 💜', body: 'আপনার ম্যাচগুলো অপেক্ষা করছে। ফিরে আসুন এবং দেখুন কে Accord-এ যোগ দিয়েছে।' },
  id: { title: 'Kami merindukanmu 💜', body: 'Kecocokanmu menunggu. Kembali dan lihat siapa yang bergabung dengan Accord.' },
  ka: { title: 'გენატრებით 💜', body: 'თქვენი დამთხვევები გელით. დაბრუნდით და ნახეთ ვინ შემოუერთდა Accord-ს.' },
};

function pickFallback(lang: string | null | undefined): { title: string; body: string } {
  const base = (lang ?? 'en').split('-')[0].toLowerCase();
  return FALLBACK_TRANSLATIONS[base] ?? FALLBACK_TRANSLATIONS.en;
}

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

    // Candidate selection (dormancy, freq cap, push reachability, per-user local
    // ~TARGET_LOCAL_HOUR send hour) centralized in get_digest_candidates, shared
    // with the email digest so both channels use one definition + one freq cap.
    const { data: candidates, error: fetchErr } = await supabase.rpc('get_digest_candidates', {
      p_channel: 'push',
      p_target_local_hour: TARGET_LOCAL_HOUR,
      p_dormancy_days: DORMANCY_DAYS,
      p_freq_cap_days: FREQ_CAP_DAYS,
      p_limit: BATCH_SIZE,
    });

    if (fetchErr) throw fetchErr;

    const targets: DigestTarget[] = (candidates ?? []).map((c: any) => ({
      profileId: c.profile_id as string,
      preferredLanguage: (c.preferred_language as string) || 'en',
    }));

    console.log(`[digest] ${targets.length} dormant candidate(s) to check`);

    let enqueuedWithCount = 0;
    let enqueuedFallback = 0;
    let errored = 0;

    for (const tgt of targets) {
      try {
        const { data: count, error: rpcErr } = await supabase.rpc(
          'count_new_matches_for_digest',
          { p_profile_id: tgt.profileId, p_window_days: WINDOW_DAYS },
        );

        if (rpcErr) {
          console.error(`[digest] RPC failed for ${tgt.profileId}:`, rpcErr);
          errored++;
          // Stamp anyway so a misbehaving RPC doesn't permanently block the user.
          await supabase
            .from('profiles')
            .update({ last_digest_sent_at: now.toISOString() })
            .eq('id', tgt.profileId);
          continue;
        }

        const newMatchCount = Number(count ?? 0);
        const useCounted = newMatchCount >= MIN_COUNT;

        const { title, body } = useCounted
          ? pickTranslation(tgt.preferredLanguage, newMatchCount)
          : pickFallback(tgt.preferredLanguage);

        const { error: insertErr } = await supabase
          .from('notification_queue')
          .insert({
            recipient_profile_id: tgt.profileId,
            notification_type: useCounted ? 'new_matches_digest' : 'winback_generic',
            title,
            body,
            data: {
              type: useCounted ? 'new_matches_digest' : 'winback_generic',
              screen: 'discover',
              count: useCounted ? newMatchCount : 0,
            },
            status: 'pending',
          });

        if (insertErr) {
          console.error(`[digest] queue insert failed for ${tgt.profileId}:`, insertErr);
          errored++;
          continue;
        }

        const { error: stampErr } = await supabase
          .from('profiles')
          .update({ last_digest_sent_at: now.toISOString() })
          .eq('id', tgt.profileId);

        if (stampErr) {
          console.error(`[digest] stamp failed for ${tgt.profileId}:`, stampErr);
        }

        if (useCounted) enqueuedWithCount++;
        else enqueuedFallback++;
      } catch (e: any) {
        console.error(`[digest] unexpected error for ${tgt.profileId}:`, e?.message ?? e);
        errored++;
      }
    }

    const result = {
      success: true,
      candidates: targets.length,
      enqueuedWithCount,
      enqueuedFallback,
      enqueuedTotal: enqueuedWithCount + enqueuedFallback,
      errored,
      window_days: WINDOW_DAYS,
      dormancy_days: DORMANCY_DAYS,
      freq_cap_days: FREQ_CAP_DAYS,
      min_count: MIN_COUNT,
      batch_size: BATCH_SIZE,
      target_local_hour: TARGET_LOCAL_HOUR,
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
