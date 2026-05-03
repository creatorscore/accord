/**
 * Adds verification.banner translations to all 18 non-English locales
 */
const fs = require('fs');
const path = require('path');

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

const translations = {
  ar: { verification: { banner: { getVerified: 'احصل على التحقق لمطابقات أكثر بـ 3 أضعاف', verify: 'تحقق' } } },
  bn: { verification: { banner: { getVerified: '৩ গুণ বেশি ম্যাচের জন্য যাচাই করুন', verify: 'যাচাই' } } },
  de: { verification: { banner: { getVerified: 'Verifiziere dich für 3x mehr Matches', verify: 'Verifizieren' } } },
  es: { verification: { banner: { getVerified: 'Verifícate para 3x más coincidencias', verify: 'Verificar' } } },
  fa: { verification: { banner: { getVerified: 'برای ۳ برابر تطابق بیشتر تأیید شوید', verify: 'تأیید' } } },
  fr: { verification: { banner: { getVerified: 'Vérifiez-vous pour 3x plus de matchs', verify: 'Vérifier' } } },
  he: { verification: { banner: { getVerified: 'אמת את עצמך לקבלת פי 3 יותר התאמות', verify: 'אמת' } } },
  hi: { verification: { banner: { getVerified: '3 गुना अधिक मिलान के लिए सत्यापित हों', verify: 'सत्यापित करें' } } },
  id: { verification: { banner: { getVerified: 'Verifikasi untuk 3x lebih banyak kecocokan', verify: 'Verifikasi' } } },
  it: { verification: { banner: { getVerified: 'Verificati per 3 volte più match', verify: 'Verifica' } } },
  ka: { verification: { banner: { getVerified: 'ვერიფიცირდით 3-ჯერ მეტი თანხვედრისთვის', verify: 'ვერიფიკაცია' } } },
  pl: { verification: { banner: { getVerified: 'Zweryfikuj się, aby uzyskać 3x więcej dopasowań', verify: 'Zweryfikuj' } } },
  pt: { verification: { banner: { getVerified: 'Verifique-se para 3x mais combinações', verify: 'Verificar' } } },
  ru: { verification: { banner: { getVerified: 'Подтвердите себя для 3x больше совпадений', verify: 'Подтвердить' } } },
  tr: { verification: { banner: { getVerified: '3 kat daha fazla eşleşme için doğrulanın', verify: 'Doğrula' } } },
  uk: { verification: { banner: { getVerified: 'Підтвердіть себе для 3x більше збігів', verify: 'Підтвердити' } } },
  ur: { verification: { banner: { getVerified: '3 گنا زیادہ مماثلتوں کے لیے تصدیق کروائیں', verify: 'تصدیق' } } },
  zh: { verification: { banner: { getVerified: '验证后获得3倍更多匹配', verify: '验证' } } },
};

const localesDir = path.join(__dirname, '..', 'locales');

for (const [locale, newKeys] of Object.entries(translations)) {
  const filePath = path.join(localesDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  deepMerge(data, newKeys);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Updated ${locale}.json`);
}

console.log('Done! Added verification.banner to 18 locales');
