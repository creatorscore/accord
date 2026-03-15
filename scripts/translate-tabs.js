/**
 * Adds tabs translations to all 18 non-English locales
 */
const fs = require('fs');
const path = require('path');

const translations = {
  ar: { tabs: { discover: 'اكتشف', likes: 'الإعجابات', matches: 'التوافقات', messages: 'الرسائل', profile: 'الملف الشخصي' } },
  bn: { tabs: { discover: 'আবিষ্কার', likes: 'পছন্দ', matches: 'ম্যাচ', messages: 'বার্তা', profile: 'প্রোফাইল' } },
  de: { tabs: { discover: 'Entdecken', likes: 'Likes', matches: 'Matches', messages: 'Nachrichten', profile: 'Profil' } },
  es: { tabs: { discover: 'Descubrir', likes: 'Me gusta', matches: 'Coincidencias', messages: 'Mensajes', profile: 'Perfil' } },
  fa: { tabs: { discover: 'کشف', likes: 'لایک‌ها', matches: 'تطابق‌ها', messages: 'پیام‌ها', profile: 'پروفایل' } },
  fr: { tabs: { discover: 'Découvrir', likes: 'J\'aime', matches: 'Matchs', messages: 'Messages', profile: 'Profil' } },
  he: { tabs: { discover: 'גלה', likes: 'לייקים', matches: 'התאמות', messages: 'הודעות', profile: 'פרופיל' } },
  hi: { tabs: { discover: 'खोजें', likes: 'पसंद', matches: 'मिलान', messages: 'संदेश', profile: 'प्रोफ़ाइल' } },
  id: { tabs: { discover: 'Jelajahi', likes: 'Suka', matches: 'Kecocokan', messages: 'Pesan', profile: 'Profil' } },
  it: { tabs: { discover: 'Scopri', likes: 'Mi piace', matches: 'Match', messages: 'Messaggi', profile: 'Profilo' } },
  ka: { tabs: { discover: 'აღმოჩენა', likes: 'მოწონებები', matches: 'თანხვედრები', messages: 'შეტყობინებები', profile: 'პროფილი' } },
  pl: { tabs: { discover: 'Odkrywaj', likes: 'Polubienia', matches: 'Dopasowania', messages: 'Wiadomości', profile: 'Profil' } },
  pt: { tabs: { discover: 'Descobrir', likes: 'Curtidas', matches: 'Combinações', messages: 'Mensagens', profile: 'Perfil' } },
  ru: { tabs: { discover: 'Поиск', likes: 'Лайки', matches: 'Пары', messages: 'Сообщения', profile: 'Профиль' } },
  tr: { tabs: { discover: 'Keşfet', likes: 'Beğeniler', matches: 'Eşleşmeler', messages: 'Mesajlar', profile: 'Profil' } },
  uk: { tabs: { discover: 'Пошук', likes: 'Вподобання', matches: 'Збіги', messages: 'Повідомлення', profile: 'Профіль' } },
  ur: { tabs: { discover: 'دریافت کریں', likes: 'پسندیدگی', matches: 'مماثلتیں', messages: 'پیغامات', profile: 'پروفائل' } },
  zh: { tabs: { discover: '发现', likes: '喜欢', matches: '匹配', messages: '消息', profile: '个人资料' } },
};

const localesDir = path.join(__dirname, '..', 'locales');

for (const [locale, newKeys] of Object.entries(translations)) {
  const filePath = path.join(localesDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  Object.assign(data, { tabs: newKeys.tabs, ...data });
  // Put tabs at the top by rebuilding object
  const { tabs, ...rest } = data;
  const rebuilt = { tabs: newKeys.tabs, ...rest };
  fs.writeFileSync(filePath, JSON.stringify(rebuilt, null, 2), 'utf8');
  console.log(`Updated ${locale}.json`);
}

console.log('Done! Added tabs to 18 locales');
