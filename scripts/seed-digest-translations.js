#!/usr/bin/env node
/**
 * Adds `newMatchesDigest.{title,bodySingular,bodyPlural}` into
 * supabase/functions/_shared/translations.ts for all 19 supported
 * languages. Idempotent: skips languages that already have the key.
 *
 * Also adds the same keys into each client locale file under
 * `notifications.newMatchesDigest.*` so the client can surface the
 * same copy (e.g. in an in-app banner) if we ever want to.
 */

const fs = require('fs');
const path = require('path');

const TRANSLATIONS = {
  en: {
    title: 'New matches near you ✨',
    bodySingular: '{{count}} new compatible member joined this week. Come take a look.',
    bodyPlural: '{{count}} new compatible members joined this week. Come take a look.',
  },
  es: {
    title: 'Nuevas coincidencias cerca de ti ✨',
    bodySingular: '{{count}} nuevo miembro compatible se unió esta semana. Echa un vistazo.',
    bodyPlural: '{{count}} nuevos miembros compatibles se unieron esta semana. Echa un vistazo.',
  },
  fr: {
    title: 'De nouveaux matchs près de toi ✨',
    bodySingular: '{{count}} nouveau membre compatible a rejoint cette semaine. Viens jeter un œil.',
    bodyPlural: '{{count}} nouveaux membres compatibles ont rejoint cette semaine. Viens jeter un œil.',
  },
  de: {
    title: 'Neue Matches in deiner Nähe ✨',
    bodySingular: '{{count}} neues kompatibles Mitglied ist diese Woche beigetreten. Schau mal rein.',
    bodyPlural: '{{count}} neue kompatible Mitglieder sind diese Woche beigetreten. Schau mal rein.',
  },
  ar: {
    title: 'توافقات جديدة بالقرب منك ✨',
    bodySingular: 'انضم {{count}} عضو متوافق جديد هذا الأسبوع. ألقِ نظرة.',
    bodyPlural: 'انضم {{count}} أعضاء متوافقون جدد هذا الأسبوع. ألقِ نظرة.',
  },
  hi: {
    title: 'आपके पास नए मैच ✨',
    bodySingular: 'इस हफ़्ते {{count}} नया संगत सदस्य जुड़ा है। एक नज़र डालें।',
    bodyPlural: 'इस हफ़्ते {{count}} नए संगत सदस्य जुड़े हैं। एक नज़र डालें।',
  },
  pt: {
    title: 'Novos matches perto de você ✨',
    bodySingular: '{{count}} novo membro compatível entrou esta semana. Dá uma olhada.',
    bodyPlural: '{{count}} novos membros compatíveis entraram esta semana. Dá uma olhada.',
  },
  ru: {
    title: 'Новые совпадения рядом ✨',
    bodySingular: 'На этой неделе присоединился {{count}} новый подходящий участник. Загляните.',
    bodyPlural: 'На этой неделе присоединилось {{count}} новых подходящих участников. Загляните.',
  },
  zh: {
    title: '附近有新的匹配 ✨',
    bodySingular: '本周有 {{count}} 位新的合适会员加入。来看看吧。',
    bodyPlural: '本周有 {{count}} 位新的合适会员加入。来看看吧。',
  },
  tr: {
    title: 'Yakınında yeni eşleşmeler ✨',
    bodySingular: 'Bu hafta {{count}} yeni uyumlu üye katıldı. Göz at.',
    bodyPlural: 'Bu hafta {{count}} yeni uyumlu üye katıldı. Göz at.',
  },
  it: {
    title: 'Nuovi match vicino a te ✨',
    bodySingular: '{{count}} nuovo membro compatibile si è unito questa settimana. Dai un\'occhiata.',
    bodyPlural: '{{count}} nuovi membri compatibili si sono uniti questa settimana. Dai un\'occhiata.',
  },
  pl: {
    title: 'Nowe dopasowania w pobliżu ✨',
    bodySingular: 'W tym tygodniu dołączył {{count}} nowy zgodny członek. Zajrzyj.',
    bodyPlural: 'W tym tygodniu dołączyło {{count}} nowych zgodnych członków. Zajrzyj.',
  },
  uk: {
    title: 'Нові збіги поруч ✨',
    bodySingular: 'Цього тижня приєднався {{count}} новий сумісний учасник. Зазирніть.',
    bodyPlural: 'Цього тижня приєдналося {{count}} нових сумісних учасників. Зазирніть.',
  },
  he: {
    title: 'התאמות חדשות בקרבתך ✨',
    bodySingular: 'השבוע הצטרף {{count}} חבר מתאים חדש. בואו תראו.',
    bodyPlural: 'השבוע הצטרפו {{count}} חברים מתאימים חדשים. בואו תראו.',
  },
  fa: {
    title: 'همخوانی‌های جدید در نزدیکی شما ✨',
    bodySingular: 'این هفته {{count}} عضو همخوان جدید ملحق شد. یک نگاه بیندازید.',
    bodyPlural: 'این هفته {{count}} عضو همخوان جدید ملحق شدند. یک نگاه بیندازید.',
  },
  ur: {
    title: 'آپ کے قریب نئے میچز ✨',
    bodySingular: 'اس ہفتے {{count}} نیا موافق رکن شامل ہوا۔ ایک نظر ڈالیں۔',
    bodyPlural: 'اس ہفتے {{count}} نئے موافق ارکان شامل ہوئے۔ ایک نظر ڈالیں۔',
  },
  bn: {
    title: 'আপনার কাছে নতুন ম্যাচ ✨',
    bodySingular: 'এই সপ্তাহে {{count}} নতুন সামঞ্জস্যপূর্ণ সদস্য যোগ দিয়েছেন। একবার দেখুন।',
    bodyPlural: 'এই সপ্তাহে {{count}} নতুন সামঞ্জস্যপূর্ণ সদস্য যোগ দিয়েছেন। একবার দেখুন।',
  },
  id: {
    title: 'Kecocokan baru di dekatmu ✨',
    bodySingular: 'Minggu ini {{count}} anggota cocok baru bergabung. Yuk, lihat.',
    bodyPlural: 'Minggu ini {{count}} anggota cocok baru bergabung. Yuk, lihat.',
  },
  ka: {
    title: 'ახალი დამთხვევები თქვენთან ახლოს ✨',
    bodySingular: 'ამ კვირაში შემოუერთდა {{count}} ახალი თავსებადი წევრი. გადახედეთ.',
    bodyPlural: 'ამ კვირაში შემოუერთდა {{count}} ახალი თავსებადი წევრი. გადახედეთ.',
  },
};

// ---------- 1. Patch the Edge Function shared translations TS module ----------
const tsPath = path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'translations.ts');
let src = fs.readFileSync(tsPath, 'utf8');

let tsPatched = 0;
for (const [lang, entries] of Object.entries(TRANSLATIONS)) {
  // Find the start of this language block: `  xx: {` at the top level.
  const langStartRe = new RegExp(`\\n  ${lang}: \\{\\n`);
  const startMatch = langStartRe.exec(src);
  if (!startMatch) {
    console.warn(`  [ts] ${lang}: block not found — skipping`);
    continue;
  }

  // Inside this block, find the stats closing: `    }\n  },` (or `    }\n  }\n}` if last).
  // We locate the NEXT occurrence of `    }\n  },` (or `    }\n  }` followed by `};` for last
  // language block) after the language start.
  const afterStart = startMatch.index + startMatch[0].length;
  const closeRe = /    \}\n  (\},|\})/;
  const closeMatch = closeRe.exec(src.substring(afterStart));
  if (!closeMatch) {
    console.warn(`  [ts] ${lang}: closing brace not found — skipping`);
    continue;
  }
  const absClose = afterStart + closeMatch.index;

  // Check if newMatchesDigest already exists in this language block.
  const blockSegment = src.substring(startMatch.index, absClose + closeMatch[0].length);
  if (/newMatchesDigest:/.test(blockSegment)) {
    console.log(`  [ts] ${lang}: already has newMatchesDigest — skipping`);
    continue;
  }

  // Build the insertion (after the `    }` that closes `stats`, before `\n  },`).
  const insertion = `,\n    newMatchesDigest: {\n` +
    `      title: ${JSON.stringify(entries.title)},\n` +
    `      bodySingular: ${JSON.stringify(entries.bodySingular)},\n` +
    `      bodyPlural: ${JSON.stringify(entries.bodyPlural)}\n` +
    `    }`;

  // Insert immediately after the closing `    }` of stats.
  const statsCloseEnd = absClose + '    }'.length;
  src = src.substring(0, statsCloseEnd) + insertion + src.substring(statsCloseEnd);
  tsPatched++;
  console.log(`  [ts] ${lang}: patched`);
}

fs.writeFileSync(tsPath, src);

// ---------- 2. Add notifications.newMatchesDigest.* to each client locale ----------
const localesDir = path.join(__dirname, '..', 'locales');
let localePatched = 0;

for (const [lang, entries] of Object.entries(TRANSLATIONS)) {
  const localePath = path.join(localesDir, `${lang}.json`);
  if (!fs.existsSync(localePath)) {
    console.warn(`  [locale] ${lang}.json not found — skipping`);
    continue;
  }

  const json = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  json.notifications = json.notifications || {};
  json.notifications.newMatchesDigest = {
    title: entries.title,
    bodySingular: entries.bodySingular,
    bodyPlural: entries.bodyPlural,
  };

  fs.writeFileSync(localePath, JSON.stringify(json, null, 2) + '\n');
  localePatched++;
  console.log(`  [locale] ${lang}.json: patched`);
}

console.log(`\nDone. Patched ${tsPatched} TS language block(s) and ${localePatched} client locale file(s).`);
