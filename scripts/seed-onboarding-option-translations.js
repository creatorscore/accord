#!/usr/bin/env node
/**
 * Seeds onboarding option translations into the target locale files.
 *
 * For each option group, we store translations under:
 *   onboarding.options.<namespace>.<slug>
 *
 * Slugs must match `slugifyOption()` in lib/onboarding-labels.ts:
 *   - lowercase
 *   - apostrophes removed
 *   - every other non-alphanumeric run → '_'
 *   - no leading/trailing '_'
 *
 * Locales covered: en (English seed, matches current hardcoded labels),
 * plus ar/ur/bn/fa/hi per the request to serve Muslim users in their
 * primary languages. Other locales fall back to the English defaultValue
 * at render time until translators fill them in.
 */

const fs = require('fs');
const path = require('path');

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// -----------------------------------------------------------------------------
// Translation data: [english, ar, ur, bn, fa, hi] per value
// -----------------------------------------------------------------------------
// Key order is [value/label, ar, ur, bn, fa, hi]. For plain string arrays the
// value is the label; for object arrays the value is stable and only the
// label varies.

const T = {
  // Plain string arrays — slug derives from the value itself
  genders: {
    items: [
      { slug: 'man',         en: 'Man',         ar: 'رجل',            ur: 'مرد',           bn: 'পুরুষ',        fa: 'مرد',           hi: 'पुरुष' },
      { slug: 'woman',       en: 'Woman',       ar: 'امرأة',          ur: 'عورت',          bn: 'মহিলা',        fa: 'زن',            hi: 'महिला' },
      { slug: 'non_binary',  en: 'Non-binary',  ar: 'غير ثنائي',      ur: 'نان-بائنری',    bn: 'নন-বাইনারি',   fa: 'ناهم‌تبار',     hi: 'नॉन-बाइनरी' },
    ],
  },

  pronouns: {
    items: [
      { slug: 'she_her',        en: 'she/her',           ar: 'هي',                         ur: 'وہ (مؤنث)',          bn: 'সে (মহিলা)',                fa: 'او (مؤنث)',                     hi: 'वह (स्त्री)' },
      { slug: 'he_him',         en: 'he/him',            ar: 'هو',                         ur: 'وہ (مذکر)',          bn: 'সে (পুরুষ)',                fa: 'او (مذکر)',                     hi: 'वह (पुरुष)' },
      { slug: 'they_them',      en: 'they/them',         ar: 'هم',                         ur: 'وہ (غیر بائنری)',    bn: 'তারা',                      fa: 'آن‌ها',                         hi: 'वे' },
      { slug: 'she_they',       en: 'she/they',          ar: 'هي/هم',                      ur: 'وہ مؤنث/نان-بائنری', bn: 'সে/তারা',                   fa: 'او/آن‌ها (مؤنث)',               hi: 'वह/वे (स्त्री)' },
      { slug: 'he_they',        en: 'he/they',           ar: 'هو/هم',                      ur: 'وہ مذکر/نان-بائنری', bn: 'সে/তারা',                   fa: 'او/آن‌ها (مذکر)',               hi: 'वह/वे (पुरुष)' },
      { slug: 'any_pronouns',   en: 'any pronouns',      ar: 'أي ضمائر',                   ur: 'کوئی بھی ضمیر',      bn: 'যেকোনো সর্বনাম',             fa: 'هر ضمیری',                      hi: 'कोई भी सर्वनाम' },
      { slug: 'ask_me',         en: 'ask me',            ar: 'اسألني',                     ur: 'مجھ سے پوچھیں',      bn: 'জিজ্ঞাসা করুন',              fa: 'از من بپرسید',                  hi: 'मुझसे पूछें' },
      { slug: 'prefer_not_to_say', en: 'prefer not to say', ar: 'أفضل عدم القول',          ur: 'بتانا نہیں چاہتا',   bn: 'বলতে চাই না',                fa: 'ترجیح می‌دهم نگویم',            hi: 'नहीं बताना चाहता' },
    ],
  },

  orientations: {
    items: [
      { slug: 'lesbian',       en: 'Lesbian',       ar: 'مثلية',           ur: 'لیسبیئن',     bn: 'লেসবিয়ান',         fa: 'لزبین',              hi: 'लेस्बियन' },
      { slug: 'gay',           en: 'Gay',           ar: 'مثلي',            ur: 'گے',           bn: 'গে',                fa: 'گی',                 hi: 'गे' },
      { slug: 'bisexual',      en: 'Bisexual',      ar: 'ثنائي الميول',    ur: 'بائی سیکشوئل', bn: 'বাইসেক্সুয়াল',     fa: 'دوجنس‌گرا',          hi: 'बाइसेक्शुअल' },
      { slug: 'straight',      en: 'Straight',      ar: 'مستقيم',          ur: 'سٹریٹ',        bn: 'স্ট্রেট',           fa: 'دگرجنس‌گرا',         hi: 'स्ट्रेट' },
      { slug: 'queer',         en: 'Queer',         ar: 'كوير',            ur: 'کوئیر',        bn: 'কুইয়ার',            fa: 'کوئیر',              hi: 'क्वीयर' },
      { slug: 'asexual',       en: 'Asexual',       ar: 'لاجنسي',          ur: 'اے سیکشوئل',   bn: 'অ্যাসেক্সুয়াল',      fa: 'بی‌جنس‌گرا',         hi: 'अलैंगिक' },
      { slug: 'pansexual',     en: 'Pansexual',     ar: 'بانسيكشوال',      ur: 'پین سیکشوئل',  bn: 'প্যানসেক্সুয়াল',    fa: 'همه‌جنس‌گرا',        hi: 'पैनसेक्शुअल' },
      { slug: 'demisexual',    en: 'Demisexual',    ar: 'ديميسكشوال',      ur: 'ڈیمی سیکشوئل', bn: 'ডেমিসেক্সুয়াল',      fa: 'دمی‌جنس‌گرا',        hi: 'डेमीसेक्शुअल' },
      { slug: 'questioning',   en: 'Questioning',   ar: 'مستكشف',          ur: 'سوالیہ',       bn: 'অনুসন্ধানকারী',     fa: 'در حال کشف',         hi: 'खोज रहा हूँ' },
      { slug: 'omnisexual',    en: 'Omnisexual',    ar: 'أومنيسيكشوال',    ur: 'اومنی سیکشوئل', bn: 'অমনিসেক্সুয়াল',     fa: 'همه‌جنس‌گرا (همگانی)', hi: 'ओम्निसेक्शुअल' },
      { slug: 'polysexual',    en: 'Polysexual',    ar: 'بوليسيكشوال',     ur: 'پولی سیکشوئل', bn: 'পলিসেক্সুয়াল',      fa: 'چندجنس‌گرا',         hi: 'पॉलीसेक्शुअल' },
      { slug: 'androsexual',   en: 'Androsexual',   ar: 'أندروسكشوال',     ur: 'اینڈرو سیکشوئل', bn: 'অ্যান্ড্রোসেক্সুয়াল', fa: 'مردگرا',             hi: 'एंड्रोसेक्शुअल' },
      { slug: 'gynesexual',    en: 'Gynesexual',    ar: 'جينيسكشوال',      ur: 'جائنی سیکشوئل', bn: 'জাইনিসেক্সুয়াল',    fa: 'زن‌گرا',             hi: 'गाइनेसेक्शुअल' },
      { slug: 'sapiosexual',   en: 'Sapiosexual',   ar: 'سابيوسيكشوال',    ur: 'سیپیو سیکشوئل', bn: 'স্যাপিওসেক্সুয়াল',  fa: 'سپیوسکشوال',         hi: 'सैपियोसेक्शुअल' },
      { slug: 'heteroflexible',en: 'Heteroflexible',ar: 'هيتيروفليكسيبل',  ur: 'ہیٹرو فلیکسیبل', bn: 'হেটেরোফ্লেক্সিবল',  fa: 'دگرجنس‌گرا منعطف',   hi: 'हेटेरोफ्लेक्सिबल' },
      { slug: 'homoflexible',  en: 'Homoflexible',  ar: 'هوموفليكسيبل',    ur: 'ہومو فلیکسیبل', bn: 'হোমোফ্লেক্সিবল',   fa: 'همجنس‌گرا منعطف',    hi: 'होमोफ्लेक्सिबल' },
      { slug: 'prefer_not_to_say', en: 'Prefer not to say', ar: 'أفضل عدم القول', ur: 'بتانا نہیں چاہتا', bn: 'বলতে চাই না', fa: 'ترجیح می‌دهم نگویم', hi: 'नहीं बताना चाहता' },
      { slug: 'other',         en: 'Other',         ar: 'آخر',             ur: 'دیگر',         bn: 'অন্যান্য',           fa: 'دیگر',               hi: 'अन्य' },
    ],
  },

  genderPrefs: {
    items: [
      { slug: 'men',         en: 'Men',         ar: 'رجال',        ur: 'مرد',       bn: 'পুরুষ',       fa: 'مردان',         hi: 'पुरुष' },
      { slug: 'women',       en: 'Women',       ar: 'نساء',        ur: 'عورتیں',    bn: 'মহিলা',       fa: 'زنان',          hi: 'महिलाएँ' },
      { slug: 'non_binary',  en: 'Non-binary',  ar: 'غير ثنائي',   ur: 'نان-بائنری',bn: 'নন-বাইনারি',  fa: 'ناهم‌تبار',     hi: 'नॉन-बाइनरी' },
      { slug: 'everyone',    en: 'Everyone',    ar: 'الجميع',      ur: 'سب',        bn: 'সবাই',        fa: 'همه',           hi: 'सभी' },
    ],
  },

  ethnicities: {
    items: [
      { slug: 'asian',                        en: 'Asian',                        ar: 'آسيوي',                ur: 'ایشیائی',           bn: 'এশীয়',                 fa: 'آسیایی',                   hi: 'एशियाई' },
      { slug: 'black_african',                en: 'Black/African',                ar: 'أسود/أفريقي',          ur: 'سیاہ فام/افریقی',   bn: 'কৃষ্ণাঙ্গ/আফ্রিকান',    fa: 'سیاه‌پوست/آفریقایی',       hi: 'अश्वेत/अफ्रीकी' },
      { slug: 'hispanic_latinx',              en: 'Hispanic/Latinx',              ar: 'هسباني/لاتيني',        ur: 'ہسپانوی/لاطینی',    bn: 'হিস্পানিক/ল্যাটিনক্স',   fa: 'اسپانیایی‌تبار/لاتین‌تبار',hi: 'हिस्पैनिक/लैटिनक्स' },
      { slug: 'indigenous_native',            en: 'Indigenous/Native',            ar: 'سكان أصليون',          ur: 'مقامی',             bn: 'আদিবাসী',               fa: 'بومی',                     hi: 'स्वदेशी' },
      { slug: 'middle_eastern_north_african', en: 'Middle Eastern/North African', ar: 'شرق أوسطي/شمال أفريقي',ur: 'مشرقِ وسطیٰ/شمالی افریقی', bn: 'মধ্যপ্রাচ্য/উত্তর আফ্রিকান', fa: 'خاورمیانه‌ای/آفریقای شمالی', hi: 'मध्य पूर्वी/उत्तर अफ्रीकी' },
      { slug: 'pacific_islander',             en: 'Pacific Islander',             ar: 'من جزر المحيط الهادئ', ur: 'بحرالکاہل کے جزائر', bn: 'প্যাসিফিক দ্বীপবাসী',   fa: 'اهل جزایر اقیانوس آرام',   hi: 'प्रशांत द्वीपवासी' },
      { slug: 'south_asian',                  en: 'South Asian',                  ar: 'جنوب آسيوي',           ur: 'جنوبی ایشیائی',     bn: 'দক্ষিণ এশীয়',          fa: 'جنوب آسیایی',              hi: 'दक्षिण एशियाई' },
      { slug: 'white_caucasian',              en: 'White/Caucasian',              ar: 'أبيض/قوقازي',          ur: 'سفید فام/قفقازی',   bn: 'শ্বেতাঙ্গ/ককেশীয়',     fa: 'سفیدپوست/قفقازی',          hi: 'श्वेत/कॉकेशियन' },
      { slug: 'multiracial',                  en: 'Multiracial',                  ar: 'متعدد الأعراق',        ur: 'متعدد نسلی',        bn: 'বহু-জাতিগত',            fa: 'چندنژادی',                 hi: 'बहुजातीय' },
      { slug: 'other',                        en: 'Other',                        ar: 'آخر',                  ur: 'دیگر',              bn: 'অন্যান্য',                fa: 'دیگر',                     hi: 'अन्य' },
      { slug: 'prefer_not_to_say',            en: 'Prefer not to say',            ar: 'أفضل عدم القول',       ur: 'بتانا نہیں چاہتا',  bn: 'বলতে চাই না',             fa: 'ترجیح می‌دهم نگویم',       hi: 'नहीं बताना चाहता' },
    ],
  },

  religions: {
    items: [
      { slug: 'christian',                   en: 'Christian',                   ar: 'مسيحي',               ur: 'مسیحی',         bn: 'খ্রিস্টান',          fa: 'مسیحی',                   hi: 'ईसाई' },
      { slug: 'catholic',                    en: 'Catholic',                    ar: 'كاثوليكي',            ur: 'کیتھولک',       bn: 'ক্যাথলিক',           fa: 'کاتولیک',                 hi: 'कैथोलिक' },
      { slug: 'protestant',                  en: 'Protestant',                  ar: 'بروتستانتي',          ur: 'پروٹسٹنٹ',      bn: 'প্রোটেস্ট্যান্ট',    fa: 'پروتستان',                hi: 'प्रोटेस्टेंट' },
      { slug: 'muslim',                      en: 'Muslim',                      ar: 'مسلم',                ur: 'مسلمان',        bn: 'মুসলিম',              fa: 'مسلمان',                  hi: 'मुस्लिम' },
      { slug: 'jewish',                      en: 'Jewish',                      ar: 'يهودي',               ur: 'یہودی',         bn: 'ইহুদি',               fa: 'یهودی',                   hi: 'यहूदी' },
      { slug: 'hindu',                       en: 'Hindu',                       ar: 'هندوسي',              ur: 'ہندو',          bn: 'হিন্দু',              fa: 'هندو',                    hi: 'हिन्दू' },
      { slug: 'buddhist',                    en: 'Buddhist',                    ar: 'بوذي',                ur: 'بدھ مت',        bn: 'বৌদ্ধ',               fa: 'بودایی',                  hi: 'बौद्ध' },
      { slug: 'sikh',                        en: 'Sikh',                        ar: 'سيخي',                ur: 'سکھ',           bn: 'শিখ',                 fa: 'سیک',                     hi: 'सिख' },
      { slug: 'atheist',                     en: 'Atheist',                     ar: 'ملحد',                ur: 'ملحد',          bn: 'নাস্তিক',             fa: 'خداناباور',               hi: 'नास्तिक' },
      { slug: 'agnostic',                    en: 'Agnostic',                    ar: 'لا أدري',             ur: 'لاادری',        bn: 'অজ্ঞেয়বাদী',          fa: 'ندانم‌گرا',               hi: 'अज्ञेयवादी' },
      { slug: 'spiritual_but_not_religious', en: 'Spiritual but not religious', ar: 'روحاني لكن غير متدين',ur: 'روحانی مگر مذہبی نہیں', bn: 'আধ্যাত্মিক, ধার্মিক নই', fa: 'معنوی اما نه مذهبی',  hi: 'आध्यात्मिक लेकिन धार्मिक नहीं' },
      { slug: 'other',                       en: 'Other',                       ar: 'آخر',                 ur: 'دیگر',          bn: 'অন্যান্য',            fa: 'دیگر',                    hi: 'अन्य' },
      { slug: 'prefer_not_to_say',           en: 'Prefer not to say',           ar: 'أفضل عدم القول',      ur: 'بتانا نہیں چاہتا',bn: 'বলতে চাই না',        fa: 'ترجیح می‌دهم نگویم',      hi: 'नहीं बताना चाहता' },
    ],
  },

  politicalViews: {
    items: [
      { slug: 'liberal',           en: 'Liberal',           ar: 'ليبرالي',         ur: 'لبرل',        bn: 'উদারপন্থী',         fa: 'لیبرال',              hi: 'उदार' },
      { slug: 'progressive',       en: 'Progressive',       ar: 'تقدمي',           ur: 'ترقی پسند',   bn: 'প্রগতিশীল',         fa: 'مترقی',               hi: 'प्रगतिशील' },
      { slug: 'moderate',          en: 'Moderate',          ar: 'معتدل',           ur: 'معتدل',       bn: 'মধ্যপন্থী',          fa: 'میانه‌رو',            hi: 'मध्यमार्गी' },
      { slug: 'conservative',      en: 'Conservative',      ar: 'محافظ',           ur: 'قدامت پسند',  bn: 'রক্ষণশীল',           fa: 'محافظه‌کار',          hi: 'रूढ़िवादी' },
      { slug: 'libertarian',       en: 'Libertarian',       ar: 'تحرري',           ur: 'آزاد خیال',   bn: 'লিবার্টেরিয়ান',     fa: 'آزادی‌خواه',          hi: 'स्वतंत्रतावादी' },
      { slug: 'socialist',         en: 'Socialist',         ar: 'اشتراكي',         ur: 'سوشلسٹ',      bn: 'সমাজতান্ত্রিক',      fa: 'سوسیالیست',           hi: 'समाजवादी' },
      { slug: 'apolitical',        en: 'Apolitical',        ar: 'غير سياسي',       ur: 'غیر سیاسی',   bn: 'অরাজনৈতিক',          fa: 'غیرسیاسی',            hi: 'गैर-राजनीतिक' },
      { slug: 'other',             en: 'Other',             ar: 'آخر',             ur: 'دیگر',        bn: 'অন্যান্য',           fa: 'دیگر',                hi: 'अन्य' },
      { slug: 'prefer_not_to_say', en: 'Prefer not to say', ar: 'أفضل عدم القول',  ur: 'بتانا نہیں چاہتا',bn: 'বলতে চাই না',     fa: 'ترجیح می‌دهم نگویم',  hi: 'नहीं बताना चाहता' },
    ],
  },

  // Object arrays — slug is the .value field
  relationshipTypes: {
    items: [
      { slug: 'platonic', en: 'Platonic Only',     ar: 'أفلاطوني فقط',      ur: 'صرف افلاطونی',     bn: 'শুধু প্লেটোনিক',       fa: 'فقط افلاطونی',         hi: 'केवल प्लेटोनिक' },
      { slug: 'romantic', en: 'Romantic Possible', ar: 'رومانسي محتمل',     ur: 'رومانوی ممکن',     bn: 'রোমান্টিক সম্ভব',      fa: 'رمانتیک احتمالی',      hi: 'रोमांटिक संभव' },
      { slug: 'open',     en: 'Open Arrangement',  ar: 'ترتيب مفتوح',       ur: 'کھلا انتظام',      bn: 'উন্মুক্ত ব্যবস্থা',    fa: 'قرارداد باز',          hi: 'खुली व्यवस्था' },
    ],
  },

  primaryReasons: {
    items: [
      { slug: 'financial',       en: 'Financial Stability', ar: 'الاستقرار المالي',    ur: 'مالی استحکام',      bn: 'আর্থিক স্থিতিশীলতা',   fa: 'ثبات مالی',             hi: 'वित्तीय स्थिरता' },
      { slug: 'immigration',     en: 'Immigration/Visa',    ar: 'الهجرة/التأشيرة',     ur: 'امیگریشن/ویزا',     bn: 'ইমিগ্রেশন/ভিসা',       fa: 'مهاجرت/ویزا',           hi: 'आप्रवासन/वीज़ा' },
      { slug: 'family_pressure', en: 'Family Pressure',     ar: 'ضغط عائلي',            ur: 'خاندانی دباؤ',      bn: 'পারিবারিক চাপ',        fa: 'فشار خانوادگی',         hi: 'पारिवारिक दबाव' },
      { slug: 'legal_benefits',  en: 'Legal Benefits',      ar: 'منافع قانونية',        ur: 'قانونی فوائد',      bn: 'আইনি সুবিধা',          fa: 'مزایای قانونی',         hi: 'कानूनी लाभ' },
      { slug: 'companionship',   en: 'Companionship',       ar: 'الرفقة',               ur: 'رفاقت',             bn: 'সঙ্গ',                   fa: 'همراهی',                hi: 'साथ' },
      { slug: 'safety',          en: 'Safety & Protection', ar: 'السلامة والحماية',     ur: 'سلامتی اور تحفظ',   bn: 'নিরাপত্তা ও সুরক্ষা',   fa: 'ایمنی و محافظت',         hi: 'सुरक्षा एवं संरक्षण' },
      { slug: 'other',           en: 'Other',               ar: 'آخر',                  ur: 'دیگر',              bn: 'অন্যান্য',                fa: 'دیگر',                  hi: 'अन्य' },
    ],
  },

  childrenOptions: {
    items: [
      { slug: 'yes',   en: 'Yes',               ar: 'نعم',            ur: 'جی ہاں',         bn: 'হ্যাঁ',             fa: 'بله',              hi: 'हाँ' },
      { slug: 'no',    en: 'No',                ar: 'لا',             ur: 'نہیں',           bn: 'না',                fa: 'خیر',              hi: 'नहीं' },
      { slug: 'maybe', en: 'Maybe / Open to it',ar: 'ربما / منفتح',   ur: 'شاید / کھلا',    bn: 'হয়তো / উন্মুক্ত',   fa: 'شاید / باز',       hi: 'शायद / खुला' },
    ],
  },

  familyPlans: {
    items: [
      { slug: 'biological',      en: 'Biological Children',       ar: 'أطفال بيولوجيون',       ur: 'حیاتیاتی اولاد',       bn: 'জৈবিক সন্তান',             fa: 'فرزند بیولوژیکی',         hi: 'जैविक बच्चे' },
      { slug: 'adoption',        en: 'Adoption',                  ar: 'تبني',                  ur: 'گود لینا',             bn: 'দত্তক',                    fa: 'فرزندخواندگی',            hi: 'गोद लेना' },
      { slug: 'surrogacy',       en: 'Surrogacy',                 ar: 'تأجير الأرحام',         ur: 'سروگیسی',              bn: 'সারোগেসি',                 fa: 'رحم اجاره‌ای',            hi: 'सरोगेसी' },
      { slug: 'ivf',             en: 'IVF/Fertility Treatments',  ar: 'تلقيح صناعي/علاج الخصوبة',ur: 'آئی وی ایف/علاج',    bn: 'আইভিএফ/প্রজনন চিকিৎসা',    fa: 'آی‌وی‌اف/درمان ناباروری', hi: 'आईवीएफ/प्रजनन उपचार' },
      { slug: 'co_parenting',    en: 'Co-Parenting',              ar: 'أبوة مشتركة',           ur: 'مشترکہ والدین',        bn: 'সহ-পিতামাতৃত্ব',           fa: 'هم‌والدینی',              hi: 'सह-पालन' },
      { slug: 'fostering',       en: 'Fostering',                 ar: 'رعاية بديلة',           ur: 'فاسٹرنگ',              bn: 'ফস্টারিং',                  fa: 'سرپرستی',                 hi: 'फॉस्टरिंग' },
      { slug: 'already_have',    en: 'Already Have Children',     ar: 'لدي أطفال بالفعل',      ur: 'پہلے سے اولاد ہے',     bn: 'ইতিমধ্যে সন্তান আছে',       fa: 'قبلاً فرزند دارم',        hi: 'पहले से बच्चे हैं' },
      { slug: 'open_discussion', en: 'Open to Discussion',        ar: 'منفتح للنقاش',          ur: 'بحث کے لیے تیار',      bn: 'আলোচনার জন্য উন্মুক্ত',    fa: 'آماده گفتگو',             hi: 'चर्चा के लिए तैयार' },
      { slug: 'other',           en: 'Other',                     ar: 'آخر',                   ur: 'دیگر',                 bn: 'অন্যান্য',                  fa: 'دیگر',                    hi: 'अन्य' },
    ],
  },

  petsOptions: {
    items: [
      { slug: 'love_them',   en: 'Love Them',       ar: 'أحبها',           ur: 'بہت پسند',        bn: 'ভালোবাসি',         fa: 'عاشقشان هستم',   hi: 'बहुत पसंद' },
      { slug: 'like_them',   en: 'Like Them',       ar: 'أحبها قليلاً',    ur: 'پسند',           bn: 'পছন্দ',             fa: 'دوستشان دارم',   hi: 'पसंद' },
      { slug: 'indifferent', en: 'Indifferent',     ar: 'محايد',           ur: 'غیر جانبدار',    bn: 'উদাসীন',             fa: 'بی‌تفاوت',       hi: 'तटस्थ' },
      { slug: 'allergic',    en: 'Allergic',        ar: 'لدي حساسية',      ur: 'الرجی ہے',       bn: 'অ্যালার্জি',         fa: 'حساسیت دارم',    hi: 'एलर्जी है' },
      { slug: 'dont_like',   en: "Don't Like Them", ar: 'لا أحبها',         ur: 'پسند نہیں',      bn: 'পছন্দ করি না',       fa: 'دوست ندارم',      hi: 'पसंद नहीं' },
    ],
  },

  housingPrefs: {
    items: [
      { slug: 'separate_spaces', en: 'Separate Bedrooms/Spaces', ar: 'غرف/مساحات منفصلة',       ur: 'الگ کمرے/جگہیں',    bn: 'পৃথক শয়নকক্ষ/স্থান',      fa: 'اتاق‌های جدا',             hi: 'अलग कमरे/स्थान' },
      { slug: 'roommates',       en: 'Live Like Roommates',       ar: 'العيش كزملاء سكن',       ur: 'روم میٹس کی طرح',   bn: 'রুমমেটের মতো বসবাস',     fa: 'مانند هم‌اتاقی',           hi: 'रूममेट की तरह' },
      { slug: 'separate_homes',  en: 'Separate Homes Nearby',     ar: 'منازل منفصلة قريبة',     ur: 'قریب الگ گھر',      bn: 'নিকটবর্তী আলাদা বাড়ি',   fa: 'خانه‌های جدا نزدیک هم',   hi: 'पास के अलग घर' },
      { slug: 'shared_bedroom',  en: 'Shared Bedroom',            ar: 'غرفة نوم مشتركة',        ur: 'مشترکہ کمرہ',       bn: 'যৌথ শয়নকক্ষ',             fa: 'اتاق‌خواب مشترک',          hi: 'साझा शयनकक्ष' },
      { slug: 'flexible',        en: 'Flexible/Negotiable',       ar: 'مرن/قابل للتفاوض',       ur: 'لچکدار/قابل بحث',   bn: 'নমনীয়/আলোচনাসাপেক্ষ',   fa: 'انعطاف‌پذیر',             hi: 'लचीला/बातचीत योग्य' },
    ],
  },

  financialArr: {
    items: [
      { slug: 'separate',        en: 'Keep Finances Separate', ar: 'إبقاء المالية منفصلة',    ur: 'مالیات الگ رکھیں',   bn: 'আর্থিক বিষয় আলাদা',       fa: 'مالی‌ها را جدا نگه داریم', hi: 'वित्त अलग रखें' },
      { slug: 'shared_expenses', en: 'Share Bills/Expenses',   ar: 'تقاسم الفواتير/المصاريف', ur: 'اخراجات مشترک',      bn: 'বিল/খরচ ভাগাভাগি',         fa: 'تقسیم هزینه‌ها',          hi: 'बिल/खर्च साझा करें' },
      { slug: 'joint',           en: 'Joint Finances',         ar: 'مالية مشتركة',            ur: 'مشترکہ مالیات',      bn: 'যৌথ আর্থিক ব্যবস্থা',      fa: 'مالی مشترک',              hi: 'संयुक्त वित्त' },
      { slug: 'prenup_required', en: 'Prenup Required',        ar: 'اتفاقية ما قبل الزواج',   ur: 'پری نپ ضروری',       bn: 'প্রেনাপ প্রয়োজন',         fa: 'قرارداد پیش از ازدواج',   hi: 'प्रीनप आवश्यक' },
      { slug: 'flexible',        en: 'Flexible/Negotiable',    ar: 'مرن/قابل للتفاوض',        ur: 'لچکدار/قابل بحث',    bn: 'নমনীয়/আলোচনাসাপেক্ষ',    fa: 'انعطاف‌پذیر',             hi: 'लचीला/बातचीत योग्य' },
    ],
  },

  educationLevels: {
    items: [
      { slug: 'high_school',  en: 'High School',         ar: 'ثانوية عامة',       ur: 'ہائی اسکول',   bn: 'উচ্চ বিদ্যালয়',           fa: 'دبیرستان',         hi: 'हाई स्कूल' },
      { slug: 'associates',   en: "Associate's Degree",   ar: 'شهادة الزمالة',    ur: 'ایسوسی ایٹ ڈگری', bn: 'অ্যাসোসিয়েট ডিগ্রি',    fa: 'مدرک کاردانی',     hi: 'एसोसिएट डिग्री' },
      { slug: 'bachelors',    en: "Bachelor's Degree",    ar: 'بكالوريوس',        ur: 'بیچلر ڈگری',   bn: 'স্নাতক',                   fa: 'لیسانس',           hi: 'बैचलर डिग्री' },
      { slug: 'masters',      en: "Master's Degree",      ar: 'ماجستير',          ur: 'ماسٹرز ڈگری',  bn: 'স্নাতকোত্তর',              fa: 'کارشناسی ارشد',    hi: 'मास्टर डिग्री' },
      { slug: 'doctorate',    en: 'Doctorate / PhD',      ar: 'دكتوراه',          ur: 'پی ایچ ڈی',    bn: 'পিএইচডি',                  fa: 'دکترا',            hi: 'पीएचडी' },
      { slug: 'trade_school', en: 'Trade School',         ar: 'مدرسة مهنية',      ur: 'ٹریڈ اسکول',   bn: 'কারিগরি স্কুল',           fa: 'مدرسه فنی',        hi: 'व्यावसायिक स्कूल' },
      { slug: 'self_taught',  en: 'Self-Taught',          ar: 'تعلم ذاتي',        ur: 'خود سکھایا',   bn: 'স্ব-শিক্ষিত',              fa: 'خودآموخته',        hi: 'स्वयं सीखा' },
      { slug: 'other',        en: 'Other',                ar: 'آخر',              ur: 'دیگر',         bn: 'অন্যান্য',                  fa: 'دیگر',             hi: 'अन्य' },
    ],
  },

  drinkingOptions: {
    items: [
      { slug: 'never',              en: 'Never',              ar: 'أبداً',              ur: 'کبھی نہیں',    bn: 'কখনোই না',         fa: 'هرگز',                hi: 'कभी नहीं' },
      { slug: 'socially',           en: 'Socially',           ar: 'اجتماعياً',          ur: 'سماجی طور پر', bn: 'সামাজিকভাবে',       fa: 'اجتماعی',             hi: 'सामाजिक रूप से' },
      { slug: 'regularly',          en: 'Regularly',          ar: 'بانتظام',            ur: 'باقاعدگی سے',  bn: 'নিয়মিত',            fa: 'مرتباً',              hi: 'नियमित रूप से' },
      { slug: 'prefer_not_to_say',  en: 'Prefer Not to Say',  ar: 'أفضل عدم القول',     ur: 'بتانا نہیں چاہتا', bn: 'বলতে চাই না',  fa: 'ترجیح می‌دهم نگویم',  hi: 'नहीं बताना चाहता' },
    ],
  },

  smokingOptions: {
    items: [
      { slug: 'never',         en: 'Never',          ar: 'أبداً',          ur: 'کبھی نہیں',     bn: 'কখনোই না',         fa: 'هرگز',                hi: 'कभी नहीं' },
      { slug: 'socially',      en: 'Socially',       ar: 'اجتماعياً',      ur: 'سماجی طور پر',  bn: 'সামাজিকভাবে',      fa: 'اجتماعی',             hi: 'सामाजिक रूप से' },
      { slug: 'regularly',     en: 'Regularly',      ar: 'بانتظام',        ur: 'باقاعدگی سے',   bn: 'নিয়মিত',           fa: 'مرتباً',              hi: 'नियमित रूप से' },
      { slug: 'trying_to_quit',en: 'Trying to Quit', ar: 'أحاول الإقلاع',  ur: 'چھوڑنے کی کوشش',bn: 'ছাড়ার চেষ্টা',     fa: 'در تلاش برای ترک',    hi: 'छोड़ने की कोशिश' },
    ],
  },

  weedOptions: {
    items: [
      { slug: 'never',     en: 'Never',     ar: 'أبداً',     ur: 'کبھی نہیں',    bn: 'কখনোই না',       fa: 'هرگز',       hi: 'कभी नहीं' },
      { slug: 'socially',  en: 'Socially',  ar: 'اجتماعياً', ur: 'سماجی طور پر', bn: 'সামাজিকভাবে',    fa: 'اجتماعی',    hi: 'सामाजिक रूप से' },
      { slug: 'regularly', en: 'Regularly', ar: 'بانتظام',   ur: 'باقاعدگی سے',  bn: 'নিয়মিত',         fa: 'مرتباً',     hi: 'नियमित रूप से' },
    ],
  },

  drugOptions: {
    items: [
      { slug: 'never',     en: 'Never',     ar: 'أبداً',     ur: 'کبھی نہیں',    bn: 'কখনোই না',       fa: 'هرگز',       hi: 'कभी नहीं' },
      { slug: 'socially',  en: 'Socially',  ar: 'اجتماعياً', ur: 'سماجی طور پر', bn: 'সামাজিকভাবে',    fa: 'اجتماعی',    hi: 'सामाजिक रूप से' },
      { slug: 'regularly', en: 'Regularly', ar: 'بانتظام',   ur: 'باقاعدگی سے',  bn: 'নিয়মিত',         fa: 'مرتباً',     hi: 'नियमित रूप से' },
    ],
  },
};

// -----------------------------------------------------------------------------
// Build the onboarding.options block per locale
// -----------------------------------------------------------------------------
function buildOptionsForLocale(locale) {
  const out = {};
  for (const [ns, group] of Object.entries(T)) {
    out[ns] = {};
    for (const item of group.items) {
      const val = item[locale];
      if (val !== undefined) out[ns][item.slug] = val;
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// Merge into each locale file
// -----------------------------------------------------------------------------
const LOCALES = ['en', 'ar', 'ur', 'bn', 'fa', 'hi'];
const localesDir = path.join(__dirname, '..', 'locales');

for (const locale of LOCALES) {
  const filePath = path.join(localesDir, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`  skip ${locale}.json (not found)`);
    continue;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(raw);
  json.onboarding = json.onboarding || {};
  json.onboarding.options = buildOptionsForLocale(locale);
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
  const count = Object.values(json.onboarding.options).reduce(
    (s, g) => s + Object.keys(g).length,
    0,
  );
  console.log(`  ${locale}.json: ${count} option translations`);
}

console.log('\nDone. Each option lives at onboarding.options.<namespace>.<slug>.');
