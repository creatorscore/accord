import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Daily "new matches" digest — EMAIL channel.
 *
 * Counterpart to send-new-matches-digest (push). Targets dormant users who are
 * NOT reachable by push (no token or push disabled) but have a mailable address.
 * ~67% of active users fall in this bucket, so this is the larger reach half of
 * the re-engagement system.
 *
 * Candidate selection — dormancy, 7-day freq cap (shared last_digest_sent_at
 * with the push digest so the two audiences are disjoint), email reachability +
 * opt-out respect, and per-user LOCAL send hour (~18:00, derived from longitude)
 * — is centralized in get_digest_candidates('email', ...). Match count comes from
 * count_new_matches_for_digest (same hard-filter logic as discovery). We only
 * email users who actually have >= 1 new compatible member this window — no
 * low-value "we miss you" email here (the reactivation + inactive-user emails
 * already cover pure win-back), so an email always carries a concrete reason.
 *
 * Schedule: hourly; each run sends to users for whom it is ~18:00 local.
 */

const DORMANCY_DAYS    = 2;
const FREQ_CAP_DAYS    = 7;
const WINDOW_DAYS      = 7;
const TARGET_LOCAL_HOUR = 18;
const MIN_COUNT        = 1;
const BATCH_SIZE       = 250; // bounded per run — each send is an HTTP call

type Copy = { subject: string; headline: string; bodySingular: string; bodyPlural: string; cta: string; greeting: string };

// {{count}} is interpolated. Core languages; everything else falls back to en.
const COPY: Record<string, Copy> = {
  en: { subject: '{{count}} new match{{plural}} for you on Accord ✨', headline: 'Someone new joined who matches you', bodySingular: '{{count}} new compatible member joined Accord this week and fits what you’re looking for.', bodyPlural: '{{count}} new compatible members joined Accord this week and fit what you’re looking for.', cta: 'See who joined', greeting: 'Hi' },
  es: { subject: '{{count}} nueva(s) coincidencia(s) en Accord ✨', headline: 'Alguien nuevo que coincide contigo se unió', bodySingular: '{{count}} nuevo miembro compatible se unió a Accord esta semana y encaja con lo que buscas.', bodyPlural: '{{count}} nuevos miembros compatibles se unieron a Accord esta semana y encajan con lo que buscas.', cta: 'Ver quién se unió', greeting: 'Hola' },
  fr: { subject: '{{count}} nouveau(x) match(s) sur Accord ✨', headline: 'Quelqu’un qui te correspond vient d’arriver', bodySingular: '{{count}} nouveau membre compatible a rejoint Accord cette semaine et correspond à ce que tu cherches.', bodyPlural: '{{count}} nouveaux membres compatibles ont rejoint Accord cette semaine et correspondent à ce que tu cherches.', cta: 'Voir qui a rejoint', greeting: 'Bonjour' },
  de: { subject: '{{count}} neue(s) Match(es) auf Accord ✨', headline: 'Jemand Neues, der zu dir passt, ist beigetreten', bodySingular: '{{count}} neues kompatibles Mitglied ist diese Woche Accord beigetreten und passt zu dem, was du suchst.', bodyPlural: '{{count}} neue kompatible Mitglieder sind diese Woche Accord beigetreten und passen zu dem, was du suchst.', cta: 'Sieh, wer beigetreten ist', greeting: 'Hallo' },
  pt: { subject: '{{count}} novo(s) match(es) no Accord ✨', headline: 'Alguém novo que combina com você entrou', bodySingular: '{{count}} novo membro compatível entrou no Accord esta semana e combina com o que você procura.', bodyPlural: '{{count}} novos membros compatíveis entraram no Accord esta semana e combinam com o que você procura.', cta: 'Ver quem entrou', greeting: 'Olá' },
  it: { subject: '{{count}} nuovo/i match su Accord ✨', headline: 'Qualcuno di nuovo che ti corrisponde si è unito', bodySingular: '{{count}} nuovo membro compatibile si è unito ad Accord questa settimana e corrisponde a ciò che cerchi.', bodyPlural: '{{count}} nuovi membri compatibili si sono uniti ad Accord questa settimana e corrispondono a ciò che cerchi.', cta: 'Guarda chi si è unito', greeting: 'Ciao' },
  ru: { subject: '{{count}} новых совпадений на Accord ✨', headline: 'Присоединился кто-то подходящий', bodySingular: 'На этой неделе к Accord присоединился {{count}} новый подходящий участник.', bodyPlural: 'На этой неделе к Accord присоединилось {{count}} новых подходящих участников.', cta: 'Посмотреть', greeting: 'Привет' },
  ar: { subject: '{{count}} توافق جديد على Accord ✨', headline: 'انضم شخص جديد يناسبك', bodySingular: 'انضم {{count}} عضو متوافق جديد إلى Accord هذا الأسبوع ويناسب ما تبحث عنه.', bodyPlural: 'انضم {{count}} أعضاء متوافقون جدد إلى Accord هذا الأسبوع ويناسبون ما تبحث عنه.', cta: 'شاهد من انضم', greeting: 'مرحباً' },
  hi: { subject: 'Accord पर {{count}} नए मैच ✨', headline: 'आपसे मेल खाने वाला कोई नया जुड़ा', bodySingular: 'इस हफ़्ते {{count}} नया संगत सदस्य Accord से जुड़ा जो आपकी पसंद से मेल खाता है।', bodyPlural: 'इस हफ़्ते {{count}} नए संगत सदस्य Accord से जुड़े जो आपकी पसंद से मेल खाते हैं।', cta: 'देखें कौन जुड़ा', greeting: 'नमस्ते' },
  zh: { subject: 'Accord 上有 {{count}} 个新匹配 ✨', headline: '有与你匹配的新成员加入了', bodySingular: '本周有 {{count}} 位新的合适会员加入 Accord，与你的心仪相符。', bodyPlural: '本周有 {{count}} 位新的合适会员加入 Accord，与你的心仪相符。', cta: '看看谁加入了', greeting: '你好' },
  tr: { subject: 'Accord’da senin için {{count}} yeni eşleşme ✨', headline: 'Sana uygun yeni biri katıldı', bodySingular: 'Bu hafta {{count}} yeni uyumlu üye Accord’a katıldı ve aradığına uyuyor.', bodyPlural: 'Bu hafta {{count}} yeni uyumlu üye Accord’a katıldı ve aradığına uyuyor.', cta: 'Kimlerin katıldığına bak', greeting: 'Merhaba' },
  id: { subject: '{{count}} kecocokan baru di Accord ✨', headline: 'Seseorang baru yang cocok denganmu bergabung', bodySingular: 'Minggu ini {{count}} anggota cocok baru bergabung dengan Accord dan sesuai dengan yang kamu cari.', bodyPlural: 'Minggu ini {{count}} anggota cocok baru bergabung dengan Accord dan sesuai dengan yang kamu cari.', cta: 'Lihat siapa yang bergabung', greeting: 'Halo' },
};

function pick(lang: string | null | undefined): Copy {
  const base = (lang ?? 'en').split('-')[0].toLowerCase();
  return COPY[base] ?? COPY.en;
}
function interp(s: string, count: number): string {
  return s.replace(/\{\{count\}\}/g, String(count)).replace(/\{\{plural\}\}/g, count === 1 ? '' : 'es');
}

function buildEmail(name: string, lang: string, count: number): { subject: string; html: string; text: string } {
  const c = pick(lang);
  const subject = interp(c.subject, count);
  const headline = c.headline;
  const body = interp(count === 1 ? c.bodySingular : c.bodyPlural, count);
  const greeting = `${c.greeting}${name ? ' ' + name : ''}!`;

  const html = `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${headline}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${body}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;"><tr><td align="center" style="padding:20px 10px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
      <tr><td style="background:linear-gradient(135deg,#9B87CE 0%,#B8A9DD 100%);padding:40px 30px;text-align:center;border-radius:16px 16px 0 0;">
        <div style="font-size:56px;line-height:1;">✨</div>
        <h1 style="color:#fff;margin:15px 0 0;font-size:26px;font-weight:700;line-height:1.25;">${headline}</h1>
      </td></tr>
      <tr><td style="background:#fff;border-radius:0 0 16px 16px;box-shadow:0 4px 6px rgba(0,0,0,0.08);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:35px 40px;">
          <p style="font-size:18px;margin:0 0 18px;color:#333;">${greeting}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>
            <td style="background:#F3E8FF;border-radius:12px;padding:22px;text-align:center;">
              <div style="font-size:44px;font-weight:800;color:#6B21A8;line-height:1;">${count}</div>
              <p style="font-size:16px;color:#555;margin:12px 0 0;line-height:1.5;">${body}</p>
            </td>
          </tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <div style="background:#9B87CE;border-radius:10px;padding:16px 28px;display:inline-block;">
              <span style="color:#fff;font-size:16px;font-weight:700;">${c.cta} →</span>
            </div>
            <p style="font-size:13px;color:#888;margin:14px 0 0;">${c.cta} — open the Accord app on your phone.</p>
          </td></tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;"><tr><td style="border-top:1px solid #e6e6e6;padding-top:18px;">
            <p style="font-size:12px;color:#999;text-align:center;margin:0;line-height:1.6;">You’re receiving this because you have an Accord account. Manage notifications in the app under Settings › Notifications.<br><a href="https://joinaccord.app" style="color:#9B87CE;text-decoration:none;">joinaccord.app</a></p>
          </td></tr></table>
        </td></tr></table>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const text = `${greeting}\n\n${headline}\n\n${body}\n\n${c.cta} — open the Accord app on your phone.\n\n—\nYou're receiving this because you have an Accord account. Manage notifications in the app under Settings > Notifications.\njoinaccord.app`;

  return { subject, html, text };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: candidates, error: fetchErr } = await supabase.rpc('get_digest_candidates', {
      p_channel: 'email',
      p_target_local_hour: TARGET_LOCAL_HOUR,
      p_dormancy_days: DORMANCY_DAYS,
      p_freq_cap_days: FREQ_CAP_DAYS,
      p_limit: BATCH_SIZE,
    });
    if (fetchErr) throw fetchErr;

    const list = (candidates ?? []) as Array<{ profile_id: string; user_id: string; preferred_language: string; email: string; display_name: string }>;
    console.log(`[email-digest] ${list.length} email candidate(s) at local hour ${TARGET_LOCAL_HOUR}`);

    const now = new Date().toISOString();
    let sent = 0, skippedNoMatches = 0, errored = 0;

    for (const c of list) {
      try {
        if (!c.email) { continue; }

        const { data: count, error: rpcErr } = await supabase.rpc('count_new_matches_for_digest', {
          p_profile_id: c.profile_id,
          p_window_days: WINDOW_DAYS,
        });
        if (rpcErr) { console.error(`[email-digest] count failed ${c.profile_id}:`, rpcErr); errored++; continue; }

        const n = Number(count ?? 0);
        if (n < MIN_COUNT) { skippedNoMatches++; continue; } // no low-value email

        const { subject, html, text } = buildEmail(c.display_name || '', c.preferred_language || 'en', n);

        const resp = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({
            userId: c.user_id,
            // 'weekly_digest' is the matching EmailType in send-email: it
            // respects the weekly_digest opt-out preference and carries a 7-day
            // cooldown that aligns with our freq cap (a second safety net against
            // double-sends). Do NOT pass a type outside send-email's EmailType
            // union — its cooldown lookup would NaN and throw.
            emailType: 'weekly_digest',
            recipientEmail: c.email,
            recipientName: c.display_name || 'there',
            subject, htmlContent: html, textContent: text,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          console.error(`[email-digest] send-email failed ${c.profile_id}: ${resp.status} ${errText}`);
          errored++;
          continue;
        }

        // Stamp the shared digest freq cap only on a real send.
        await supabase.from('profiles').update({ last_digest_sent_at: now }).eq('id', c.profile_id);
        sent++;
      } catch (e: any) {
        console.error(`[email-digest] unexpected ${c.profile_id}:`, e?.message ?? e);
        errored++;
      }
    }

    const result = { success: true, candidates: list.length, sent, skippedNoMatches, errored, target_local_hour: TARGET_LOCAL_HOUR };
    console.log('[email-digest] run complete', result);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    console.error('Error in send-new-matches-email-digest:', error);
    return new Response(JSON.stringify({ success: false, error: error?.message ?? String(error) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
