/**
 * Translates discover, filters (new keys), and verification sections
 * for locales: he, hi, id, it, ka, pl
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
  he: {
    discover: {
      dailyLimitTitle: 'הגעת למגבלה היומית',
      dailyLimitMessage: 'השתמשת בכל 5 הלייקים להיום. שדרג ללייקים ללא הגבלה!',
      quickFilter: {
        age: 'גיל',
        datingIntentions: 'כוונות היכרויות',
        activeToday: 'פעיל היום'
      },
      ageSlider: {
        ageRange: 'טווח גילאים: {{min}} - {{max}}',
        minimum: 'מינימום: {{value}}',
        maximum: 'מקסימום: {{value}}'
      },
      search: {
        placeholder: "חפש לפי מילת מפתח (למשל: 'טיולים', 'טבעוני')",
        button: 'חפש',
        tip: 'עשה לייק או דלג כדי להמשיך לחפש. נקה חיפוש כדי לראות את כל הפרופילים.',
        noResults: 'אין תוצאות עבור "{{keyword}}"',
        noResultsHint: 'נסה מילות מפתח שונות או התאם את המסננים שלך כדי למצוא יותר התאמות.',
        clearSearch: 'נקה חיפוש'
      },
      emptyState: {
        allCaughtUp: 'ראית הכל',
        checkBack: 'אנשים חדשים מצטרפים כל יום.\nחזור בקרוב או הרחב את ההעדפות שלך.'
      },
      premiumCta: {
        goPremium: 'עבור לפרימיום',
        description: 'ראה מי עשה לך לייק, לייקים ללא הגבלה ועוד.',
        upgrade: 'שדרג'
      },
      recommendations: {
        expandReach: 'הרחב את הטווח שלך',
        increaseDistance: 'הגדל מרחק ב-{{count}} מייל',
        widenAge: 'הרחב טווח גילאים ב-{{count}} שנים',
        includeGender: 'כלול {{gender}}',
        searchGlobally: 'חפש ברחבי העולם',
        expandSearch: 'הרחב את החיפוש שלך',
        newProfilesK: '{{count}}אלף+ פרופילים חדשים',
        newProfiles: '{{count}} פרופילים חדשים',
        newProfileSingular: 'פרופיל חדש אחד',
        updatePreferencesTitle: 'לעדכן העדפות?',
        updatePreferencesMessage: 'להוסיף "{{gender}}" להעדפות המגדר שלך? אפשר לשנות בכל עת בהגדרות > העדפות התאמה.',
        add: 'הוסף'
      },
      banner: {
        photoBlurTitle: 'למה חלק מהתמונות מטושטשות',
        photoBlurDescription: 'חלק מהמשתמשים מפעילים טשטוש תמונות בהגדרות הפרטיות שלהם כדי להגן על זהותם עד להתאמה. התמונות יתגלו אחרי שתתחברו!',
        profileHidden: 'הפרופיל מוסתר',
        profileHiddenDescription: 'הפרופיל שלך מוסתר זמנית. הקש כדי להעלות תמונות חדשות.',
        completeProfileToMatch: 'השלם את הפרופיל כדי למצוא התאמה',
        completeProfile: 'השלם את הפרופיל שלך',
        completeProfilePreview: 'אתה יכול לגלוש בחופשיות! השלם את ההרשמה כדי להתחיל לעשות לייקים ולמצוא התאמות.',
        completeProfileDefault: 'סיים את ההגדרה כדי להתחיל למצוא התאמות. אתה יכול לגלוש אך עדיין לא יכול לעשות לייק או להיראות.'
      },
      premiumLocation: {
        title: 'פתח חיפוש גלובלי',
        description: 'יש לך העדפות מיקום שמורות שדורשות פרימיום:',
        searchGlobally: 'חפש התאמות ברחבי העולם',
        matchCities: 'מצא התאמות בערים ספציפיות',
        upgradeMessage: 'שדרג לפרימיום כדי להפעיל תכונות אלה ולמצוא התאמות בכל מקום בעולם.',
        upgradeToPremium: 'שדרג לפרימיום',
        maybeLater: 'אולי מאוחר יותר'
      }
    },
    filters: {
      basicFilters: 'מסננים בסיסיים',
      minimum: 'מינימום',
      maximum: 'מקסימום',
      activeToday: 'פעיל היום',
      activeTodayDescription: 'הצג רק משתמשים שהיו פעילים ב-24 השעות האחרונות',
      showBlurred: 'הצג תמונות מטושטשות',
      showBlurredDescription: 'כלול פרופילים עם טשטוש תמונות מופעל',
      advancedFilters: 'מסננים מתקדמים',
      identityBackground: 'זהות ורקע',
      gender: 'מגדר',
      ethnicity: 'אתניות',
      sexualOrientation: 'נטייה מינית',
      physicalPersonality: 'פיזי ואישיות',
      heightRange: 'טווח גובה',
      zodiacSign: 'מזל',
      mbtiPersonality: 'סוג אישיות MBTI',
      loveLanguage: 'שפת אהבה',
      lifestyle: 'סגנון חיים',
      languagesSpoken: 'שפות דיבור',
      smoking: 'עישון',
      drinking: 'שתייה',
      pets: 'חיות מחמד',
      marriageIntentions: 'כוונות נישואין',
      primaryReason: 'סיבה עיקרית',
      relationshipType: 'סוג יחסים',
      wantsChildren: 'רוצה ילדים',
      housingPreference: 'העדפת מגורים',
      financialArrangement: 'הסדר כספי'
    },
    verification: {
      alreadyVerified: 'כבר מאומת',
      alreadyVerifiedMessage: 'התמונות שלך כבר מאומתות!',
      tooManyAttempts: 'יותר מדי ניסיונות',
      tooManyAttemptsMessage: 'חרגת ממספר ניסיונות האימות המרבי (5). אנא פנה לתמיכה בכתובת hello@joinaccord.app.',
      tooManyAttemptsMessageShort: 'חרגת ממספר ניסיונות האימות המרבי. אנא פנה לתמיכה.',
      cameraPermission: 'נדרשת הרשאת מצלמה',
      cameraPermissionMessage: 'אנא אפשר גישה למצלמה כדי לצלם סלפי אימות.',
      selfieError: 'שגיאת סלפי',
      selfieErrorMessage: 'משהו השתבש. אנא נסה שוב.',
      success: 'התמונות אומתו!',
      successMessage: 'התמונות שלך אומתו!\n\nביטחון התאמה: {{similarity}}%\n\nהפרופיל שלך מציג כעת תג מאומת.',
      awesome: 'מעולה!',
      unsuccessful: 'האימות לא הצליח',
      unsuccessfulMessage: '{{message}}\n\nכדי לשפר את הסיכויים:\n\n• צלם את הסלפי באור יום טבעי בהיר\n• ודא שתמונת הפרופיל הראשית שלך עדכנית\n• הביט ישירות למצלמה\n• הסר משקפי שמש, כובעים או מסכות\n• הימנע מצללים על הפנים',
      tryAgain: 'נסה שוב',
      noPhotos: 'אין תמונות פרופיל',
      noPhotosMessage: 'אנא העלה תמונות פרופיל לפני האימות.',
      profileNotFound: 'הפרופיל לא נמצא. אנא נסה שוב.',
      error: 'שגיאת אימות',
      errorMessage: 'האימות נכשל. אנא נסה שוב מאוחר יותר.',
      statusVerified: 'מאומת',
      statusProcessing: 'מעבד...',
      statusFailed: 'נכשל',
      statusNotVerified: 'לא מאומת',
      title: 'אימות תמונות',
      verifiedDescription: 'התמונות שלך מאומתות! זה מראה למשתמשים אחרים שתמונות הפרופיל שלך מייצגות אותך בדיוק.',
      unverifiedDescription: 'אמת את התמונות שלך על ידי צילום סלפי. נשווה אותו לתמונות הפרופיל שלך באמצעות זיהוי פנים.',
      beforeYouStart: 'לפני שמתחילים',
      beforeYouStartDescription: 'ודא שתמונת הפרופיל הראשית שלך (תמונה ראשונה) היא תמונה עדכנית וברורה של הפנים. הסלפי יושווה לתמונות הפרופיל שלך.',
      attemptsUsed: 'ניסיונות שנוצלו: {{count}} / 5',
      unsuccessfulBanner: 'האימות לא הצליח',
      unsuccessfulBannerMessage: 'הסלפי לא התאים מספיק לתמונות הפרופיל שלך. לתוצאות הטובות ביותר, צלם את הסלפי באור יום טבעי בהיר וודא שתמונת הפרופיל הראשית עדכנית וברורה.',
      verifying: 'מאמת...',
      takeVerificationSelfie: 'צלם סלפי אימות',
      forBestResults: 'לתוצאות הטובות ביותר:',
      tips: {
        daylight: 'צלם את הסלפי באור יום טבעי בהיר',
        faceCamera: 'הביט ישירות למצלמה עם הבעה ניטרלית',
        recentPhoto: 'ודא שתמונת הפרופיל הראשית עדכנית ומראה את הפנים בבירור',
        removeCoverings: 'הסר משקפי שמש, כובעים וכיסויי פנים',
        avoidShadows: 'הימנע מצללים חזקים או סביבות עם תאורה אחורית',
        mustMatch: 'הסלפי שלך חייב להתאים לאדם בתמונות הפרופיל'
      },
      photosVerified: 'התמונות אומתו!',
      verifiedBadgeMessage: 'תג האימות שלך מוצג כעת בפרופיל. זה עוזר לבנות אמון עם התאמות פוטנציאליות.',
      freeForAll: 'חינם לכל המשתמשים'
    }
  },
  hi: {
    discover: {
      dailyLimitTitle: 'दैनिक सीमा पूरी',
      dailyLimitMessage: 'आपने आज के 5 लाइक इस्तेमाल कर लिए हैं। अनलिमिटेड के लिए अपग्रेड करें!',
      quickFilter: {
        age: 'उम्र',
        datingIntentions: 'डेटिंग इरादे',
        activeToday: 'आज सक्रिय'
      },
      ageSlider: {
        ageRange: 'उम्र सीमा: {{min}} - {{max}}',
        minimum: 'न्यूनतम: {{value}}',
        maximum: 'अधिकतम: {{value}}'
      },
      search: {
        placeholder: "कीवर्ड से खोजें (जैसे: 'यात्रा', 'शाकाहारी')",
        button: 'खोजें',
        tip: 'खोज जारी रखने के लिए लाइक या पास करें। सभी प्रोफाइल देखने के लिए सर्च मिटाएं।',
        noResults: '"{{keyword}}" के लिए कोई परिणाम नहीं',
        noResultsHint: 'अलग कीवर्ड आज़माएं या अधिक मिलान खोजने के लिए फ़िल्टर बदलें।',
        clearSearch: 'खोज मिटाएं'
      },
      emptyState: {
        allCaughtUp: 'आपने सब देख लिया',
        checkBack: 'हर दिन नए लोग जुड़ते हैं।\nजल्द वापस आएं या अपनी प्राथमिकताएं बढ़ाएं।'
      },
      premiumCta: {
        goPremium: 'प्रीमियम लें',
        description: 'देखें किसने आपको लाइक किया, अनलिमिटेड लाइक और बहुत कुछ।',
        upgrade: 'अपग्रेड'
      },
      recommendations: {
        expandReach: 'अपनी पहुंच बढ़ाएं',
        increaseDistance: 'दूरी {{count}} मील बढ़ाएं',
        widenAge: 'उम्र सीमा {{count}} साल बढ़ाएं',
        includeGender: '{{gender}} शामिल करें',
        searchGlobally: 'वैश्विक रूप से खोजें',
        expandSearch: 'अपनी खोज बढ़ाएं',
        newProfilesK: '{{count}}हज़ार+ नए प्रोफाइल',
        newProfiles: '{{count}} नए प्रोफाइल',
        newProfileSingular: '1 नया प्रोफाइल',
        updatePreferencesTitle: 'प्राथमिकताएं अपडेट करें?',
        updatePreferencesMessage: 'अपनी लिंग प्राथमिकताओं में "{{gender}}" जोड़ें? आप सेटिंग्स > मैचिंग प्राथमिकताएं से कभी भी बदल सकते हैं।',
        add: 'जोड़ें'
      },
      banner: {
        photoBlurTitle: 'कुछ फ़ोटो धुंधली क्यों हैं',
        photoBlurDescription: 'कुछ उपयोगकर्ता मैच होने तक अपनी पहचान की सुरक्षा के लिए गोपनीयता सेटिंग्स में फ़ोटो ब्लर सक्षम करते हैं। कनेक्ट होने के बाद फ़ोटो दिखाई देंगी!',
        profileHidden: 'प्रोफ़ाइल छिपी है',
        profileHiddenDescription: 'आपकी प्रोफ़ाइल अस्थायी रूप से छिपी है। नई फ़ोटो अपलोड करने के लिए टैप करें।',
        completeProfileToMatch: 'मैच करने के लिए प्रोफ़ाइल पूरी करें',
        completeProfile: 'अपनी प्रोफ़ाइल पूरी करें',
        completeProfilePreview: 'आप स्वतंत्र रूप से ब्राउज़ कर सकते हैं! लाइक और मैचिंग शुरू करने के लिए ऑनबोर्डिंग पूरा करें।',
        completeProfileDefault: 'मैचिंग शुरू करने के लिए सेटअप पूरा करें। आप ब्राउज़ कर सकते हैं लेकिन अभी लाइक या दिखाई नहीं दे सकते।'
      },
      premiumLocation: {
        title: 'ग्लोबल सर्च अनलॉक करें',
        description: 'आपकी सहेजी गई लोकेशन प्राथमिकताओं के लिए प्रीमियम चाहिए:',
        searchGlobally: 'विश्व स्तर पर मिलान खोजें',
        matchCities: 'विशिष्ट शहरों में मैच करें',
        upgradeMessage: 'इन सुविधाओं को सक्रिय करने और दुनिया में कहीं भी मिलान खोजने के लिए प्रीमियम में अपग्रेड करें।',
        upgradeToPremium: 'प्रीमियम में अपग्रेड',
        maybeLater: 'शायद बाद में'
      }
    },
    filters: {
      basicFilters: 'बुनियादी फ़िल्टर',
      minimum: 'न्यूनतम',
      maximum: 'अधिकतम',
      activeToday: 'आज सक्रिय',
      activeTodayDescription: 'केवल पिछले 24 घंटों में सक्रिय उपयोगकर्ता दिखाएं',
      showBlurred: 'धुंधली फ़ोटो दिखाएं',
      showBlurredDescription: 'फ़ोटो ब्लर सक्षम प्रोफ़ाइल शामिल करें',
      advancedFilters: 'उन्नत फ़िल्टर',
      identityBackground: 'पहचान और पृष्ठभूमि',
      gender: 'लिंग',
      ethnicity: 'जातीयता',
      sexualOrientation: 'यौन अभिरुचि',
      physicalPersonality: 'शारीरिक और व्यक्तित्व',
      heightRange: 'ऊंचाई सीमा',
      zodiacSign: 'राशि',
      mbtiPersonality: 'MBTI व्यक्तित्व प्रकार',
      loveLanguage: 'प्रेम भाषा',
      lifestyle: 'जीवनशैली',
      languagesSpoken: 'बोली जाने वाली भाषाएं',
      smoking: 'धूम्रपान',
      drinking: 'शराब',
      pets: 'पालतू जानवर',
      marriageIntentions: 'विवाह इरादे',
      primaryReason: 'मुख्य कारण',
      relationshipType: 'रिश्ते का प्रकार',
      wantsChildren: 'बच्चे चाहते हैं',
      housingPreference: 'आवास प्राथमिकता',
      financialArrangement: 'वित्तीय व्यवस्था'
    },
    verification: {
      alreadyVerified: 'पहले से सत्यापित',
      alreadyVerifiedMessage: 'आपकी फ़ोटो पहले से सत्यापित हैं!',
      tooManyAttempts: 'बहुत अधिक प्रयास',
      tooManyAttemptsMessage: 'आपने अधिकतम सत्यापन प्रयास (5) पार कर लिए हैं। कृपया hello@joinaccord.app पर सहायता से संपर्क करें।',
      tooManyAttemptsMessageShort: 'आपने अधिकतम सत्यापन प्रयास पार कर लिए हैं। कृपया सहायता से संपर्क करें।',
      cameraPermission: 'कैमरा अनुमति आवश्यक',
      cameraPermissionMessage: 'सत्यापन सेल्फी लेने के लिए कृपया कैमरा एक्सेस दें।',
      selfieError: 'सेल्फी त्रुटि',
      selfieErrorMessage: 'कुछ गलत हो गया। कृपया फिर से प्रयास करें।',
      success: 'फ़ोटो सत्यापित!',
      successMessage: 'आपकी फ़ोटो सत्यापित हो गई हैं!\n\nमिलान विश्वास: {{similarity}}%\n\nआपकी प्रोफ़ाइल अब सत्यापित बैज दिखा रही है।',
      awesome: 'बढ़िया!',
      unsuccessful: 'सत्यापन असफल',
      unsuccessfulMessage: '{{message}}\n\nअपनी संभावनाएं बेहतर करने के लिए:\n\n• उज्ज्वल प्राकृतिक दिन के उजाले में सेल्फी लें\n• सुनिश्चित करें कि आपकी मुख्य प्रोफ़ाइल फ़ोटो हालिया है\n• सीधे कैमरे की ओर देखें\n• धूप का चश्मा, टोपी या मास्क हटाएं\n• चेहरे पर छाया से बचें',
      tryAgain: 'फिर से कोशिश करें',
      noPhotos: 'कोई प्रोफ़ाइल फ़ोटो नहीं',
      noPhotosMessage: 'सत्यापन से पहले कृपया प्रोफ़ाइल फ़ोटो अपलोड करें।',
      profileNotFound: 'प्रोफ़ाइल नहीं मिली। कृपया फिर से प्रयास करें।',
      error: 'सत्यापन त्रुटि',
      errorMessage: 'सत्यापन विफल। कृपया बाद में फिर से प्रयास करें।',
      statusVerified: 'सत्यापित',
      statusProcessing: 'प्रोसेसिंग...',
      statusFailed: 'विफल',
      statusNotVerified: 'असत्यापित',
      title: 'फ़ोटो सत्यापन',
      verifiedDescription: 'आपकी फ़ोटो सत्यापित हैं! यह अन्य उपयोगकर्ताओं को दिखाता है कि आपकी प्रोफ़ाइल फ़ोटो सटीक रूप से आपको दर्शाती हैं।',
      unverifiedDescription: 'सेल्फी लेकर अपनी फ़ोटो सत्यापित करें। हम चेहरे की पहचान का उपयोग करके आपकी प्रोफ़ाइल फ़ोटो से तुलना करेंगे।',
      beforeYouStart: 'शुरू करने से पहले',
      beforeYouStartDescription: 'सुनिश्चित करें कि आपकी मुख्य प्रोफ़ाइल फ़ोटो (पहली फ़ोटो) आपके चेहरे की हालिया, स्पष्ट फ़ोटो है। सेल्फी की तुलना आपकी प्रोफ़ाइल फ़ोटो से की जाएगी।',
      attemptsUsed: 'उपयोग किए गए प्रयास: {{count}} / 5',
      unsuccessfulBanner: 'सत्यापन असफल',
      unsuccessfulBannerMessage: 'सेल्फी आपकी प्रोफ़ाइल फ़ोटो से पर्याप्त मेल नहीं खाई। सर्वोत्तम परिणामों के लिए, उज्ज्वल प्राकृतिक दिन के उजाले में सेल्फी लें और सुनिश्चित करें कि आपकी मुख्य फ़ोटो हालिया और स्पष्ट है।',
      verifying: 'सत्यापन हो रहा है...',
      takeVerificationSelfie: 'सत्यापन सेल्फी लें',
      forBestResults: 'सर्वोत्तम परिणामों के लिए:',
      tips: {
        daylight: 'उज्ज्वल, प्राकृतिक दिन के उजाले में सेल्फी लें',
        faceCamera: 'तटस्थ अभिव्यक्ति के साथ सीधे कैमरे की ओर देखें',
        recentPhoto: 'सुनिश्चित करें कि आपकी मुख्य प्रोफ़ाइल फ़ोटो हालिया है और चेहरा स्पष्ट दिखाती है',
        removeCoverings: 'धूप का चश्मा, टोपी और चेहरा ढकने वाली चीज़ें हटाएं',
        avoidShadows: 'कठोर छाया या बैकलिट वातावरण से बचें',
        mustMatch: 'आपकी सेल्फी प्रोफ़ाइल फ़ोटो में व्यक्ति से मेल खानी चाहिए'
      },
      photosVerified: 'फ़ोटो सत्यापित!',
      verifiedBadgeMessage: 'आपका सत्यापित बैज अब प्रोफ़ाइल पर दिख रहा है। यह संभावित मिलान के साथ विश्वास बनाने में मदद करता है।',
      freeForAll: 'सभी उपयोगकर्ताओं के लिए मुफ़्त'
    }
  },
  id: {
    discover: {
      dailyLimitTitle: 'Batas harian tercapai',
      dailyLimitMessage: 'Anda telah menggunakan 5 like hari ini. Upgrade untuk like tanpa batas!',
      quickFilter: {
        age: 'Usia',
        datingIntentions: 'Niat Kencan',
        activeToday: 'Aktif Hari Ini'
      },
      ageSlider: {
        ageRange: 'Rentang Usia: {{min}} - {{max}}',
        minimum: 'Minimum: {{value}}',
        maximum: 'Maksimum: {{value}}'
      },
      search: {
        placeholder: "Cari berdasarkan kata kunci (mis. 'traveling', 'vegan')",
        button: 'Cari',
        tip: 'Like atau lewati untuk melanjutkan pencarian. Hapus pencarian untuk melihat semua profil.',
        noResults: 'Tidak ada hasil untuk "{{keyword}}"',
        noResultsHint: 'Coba kata kunci berbeda atau sesuaikan filter Anda untuk menemukan lebih banyak kecocokan.',
        clearSearch: 'Hapus Pencarian'
      },
      emptyState: {
        allCaughtUp: 'Anda sudah melihat semua',
        checkBack: 'Orang baru bergabung setiap hari.\nKembali lagi nanti atau perluas preferensi Anda.'
      },
      premiumCta: {
        goPremium: 'Jadi Premium',
        description: 'Lihat siapa yang menyukai Anda, like tak terbatas, dan lainnya.',
        upgrade: 'Upgrade'
      },
      recommendations: {
        expandReach: 'Perluas Jangkauan Anda',
        increaseDistance: 'Tambah jarak {{count}} mil',
        widenAge: 'Perlebar rentang usia {{count}} tahun',
        includeGender: 'Sertakan {{gender}}',
        searchGlobally: 'Cari secara global',
        expandSearch: 'Perluas pencarian Anda',
        newProfilesK: '{{count}}rb+ profil baru',
        newProfiles: '{{count}} profil baru',
        newProfileSingular: '1 profil baru',
        updatePreferencesTitle: 'Perbarui Preferensi?',
        updatePreferencesMessage: 'Tambahkan "{{gender}}" ke preferensi gender Anda? Anda bisa mengubahnya kapan saja di Pengaturan > Preferensi Kecocokan.',
        add: 'Tambah'
      },
      banner: {
        photoBlurTitle: 'Mengapa Beberapa Foto Buram',
        photoBlurDescription: 'Beberapa pengguna mengaktifkan blur foto di pengaturan privasi untuk melindungi identitas hingga cocok. Foto akan terungkap setelah terhubung!',
        profileHidden: 'Profil Tersembunyi',
        profileHiddenDescription: 'Profil Anda tersembunyi sementara. Ketuk untuk mengunggah foto baru.',
        completeProfileToMatch: 'Lengkapi Profil untuk Mencocokkan',
        completeProfile: 'Lengkapi Profil Anda',
        completeProfilePreview: 'Anda bisa menjelajah dengan bebas! Selesaikan onboarding untuk mulai menyukai dan mencocokkan.',
        completeProfileDefault: 'Selesaikan pengaturan untuk mulai mencocokkan. Anda bisa menjelajah tapi belum bisa menyukai atau terlihat.'
      },
      premiumLocation: {
        title: 'Buka Pencarian Global',
        description: 'Anda memiliki preferensi lokasi tersimpan yang memerlukan Premium:',
        searchGlobally: 'Cari kecocokan secara global',
        matchCities: 'Cocokkan di kota tertentu',
        upgradeMessage: 'Upgrade ke Premium untuk mengaktifkan fitur ini dan menemukan kecocokan di mana saja di dunia.',
        upgradeToPremium: 'Upgrade ke Premium',
        maybeLater: 'Mungkin Nanti'
      }
    },
    filters: {
      basicFilters: 'Filter Dasar',
      minimum: 'Minimum',
      maximum: 'Maksimum',
      activeToday: 'Aktif Hari Ini',
      activeTodayDescription: 'Hanya tampilkan pengguna aktif dalam 24 jam terakhir',
      showBlurred: 'Tampilkan Foto Buram',
      showBlurredDescription: 'Sertakan profil dengan blur foto aktif',
      advancedFilters: 'Filter Lanjutan',
      identityBackground: 'Identitas & Latar Belakang',
      gender: 'Gender',
      ethnicity: 'Etnisitas',
      sexualOrientation: 'Orientasi Seksual',
      physicalPersonality: 'Fisik & Kepribadian',
      heightRange: 'Rentang Tinggi',
      zodiacSign: 'Zodiak',
      mbtiPersonality: 'Tipe Kepribadian MBTI',
      loveLanguage: 'Bahasa Cinta',
      lifestyle: 'Gaya Hidup',
      languagesSpoken: 'Bahasa yang Digunakan',
      smoking: 'Merokok',
      drinking: 'Minum',
      pets: 'Hewan Peliharaan',
      marriageIntentions: 'Niat Pernikahan',
      primaryReason: 'Alasan Utama',
      relationshipType: 'Tipe Hubungan',
      wantsChildren: 'Ingin Anak',
      housingPreference: 'Preferensi Tempat Tinggal',
      financialArrangement: 'Pengaturan Keuangan'
    },
    verification: {
      alreadyVerified: 'Sudah Terverifikasi',
      alreadyVerifiedMessage: 'Foto Anda sudah terverifikasi!',
      tooManyAttempts: 'Terlalu Banyak Percobaan',
      tooManyAttemptsMessage: 'Anda telah melebihi batas percobaan verifikasi (5). Silakan hubungi dukungan di hello@joinaccord.app.',
      tooManyAttemptsMessageShort: 'Anda telah melebihi batas percobaan verifikasi. Silakan hubungi dukungan.',
      cameraPermission: 'Izin Kamera Diperlukan',
      cameraPermissionMessage: 'Silakan izinkan akses kamera untuk mengambil selfie verifikasi.',
      selfieError: 'Kesalahan Selfie',
      selfieErrorMessage: 'Terjadi kesalahan. Silakan coba lagi.',
      success: 'Foto Terverifikasi!',
      successMessage: 'Foto Anda telah diverifikasi!\n\nKepercayaan kecocokan: {{similarity}}%\n\nProfil Anda sekarang menampilkan lencana terverifikasi.',
      awesome: 'Luar Biasa!',
      unsuccessful: 'Verifikasi Tidak Berhasil',
      unsuccessfulMessage: '{{message}}\n\nUntuk meningkatkan peluang:\n\n• Ambil selfie di cahaya alami yang terang\n• Pastikan foto profil utama Anda terbaru\n• Hadap langsung ke kamera\n• Lepas kacamata hitam, topi, atau masker\n• Hindari bayangan di wajah',
      tryAgain: 'Coba Lagi',
      noPhotos: 'Tidak Ada Foto Profil',
      noPhotosMessage: 'Silakan unggah foto profil sebelum memverifikasi.',
      profileNotFound: 'Profil tidak ditemukan. Silakan coba lagi.',
      error: 'Kesalahan Verifikasi',
      errorMessage: 'Verifikasi gagal. Silakan coba lagi nanti.',
      statusVerified: 'Terverifikasi',
      statusProcessing: 'Memproses...',
      statusFailed: 'Gagal',
      statusNotVerified: 'Belum Terverifikasi',
      title: 'Verifikasi Foto',
      verifiedDescription: 'Foto Anda terverifikasi! Ini menunjukkan kepada pengguna lain bahwa foto profil Anda merepresentasikan Anda secara akurat.',
      unverifiedDescription: 'Verifikasi foto Anda dengan mengambil selfie. Kami akan membandingkannya dengan foto profil Anda menggunakan pengenalan wajah.',
      beforeYouStart: 'Sebelum Memulai',
      beforeYouStartDescription: 'Pastikan foto profil utama Anda (foto pertama) adalah foto wajah Anda yang terbaru dan jelas. Selfie akan dibandingkan dengan foto profil Anda.',
      attemptsUsed: 'Percobaan digunakan: {{count}} / 5',
      unsuccessfulBanner: 'Verifikasi Tidak Berhasil',
      unsuccessfulBannerMessage: 'Selfie tidak cukup cocok dengan foto profil Anda. Untuk hasil terbaik, ambil selfie di cahaya alami terang dan pastikan foto profil utama Anda terbaru dan jelas.',
      verifying: 'Memverifikasi...',
      takeVerificationSelfie: 'Ambil Selfie Verifikasi',
      forBestResults: 'Untuk hasil terbaik:',
      tips: {
        daylight: 'Ambil selfie di cahaya alami siang hari yang terang',
        faceCamera: 'Hadap langsung ke kamera dengan ekspresi netral',
        recentPhoto: 'Pastikan foto profil utama Anda terbaru dan menunjukkan wajah dengan jelas',
        removeCoverings: 'Lepas kacamata hitam, topi, dan penutup wajah',
        avoidShadows: 'Hindari bayangan keras atau lingkungan dengan cahaya belakang',
        mustMatch: 'Selfie Anda harus cocok dengan orang di foto profil Anda'
      },
      photosVerified: 'Foto Terverifikasi!',
      verifiedBadgeMessage: 'Lencana terverifikasi Anda sekarang ditampilkan di profil. Ini membantu membangun kepercayaan dengan calon kecocokan.',
      freeForAll: 'Gratis untuk semua pengguna'
    }
  },
  it: {
    discover: {
      dailyLimitTitle: 'Limite giornaliero raggiunto',
      dailyLimitMessage: 'Hai usato tutti i 5 like di oggi. Passa a Premium per like illimitati!',
      quickFilter: {
        age: 'Età',
        datingIntentions: 'Intenzioni di dating',
        activeToday: 'Attivo oggi'
      },
      ageSlider: {
        ageRange: 'Fascia d\'età: {{min}} - {{max}}',
        minimum: 'Minimo: {{value}}',
        maximum: 'Massimo: {{value}}'
      },
      search: {
        placeholder: "Cerca per parola chiave (es. 'viaggi', 'vegano')",
        button: 'Cerca',
        tip: 'Metti like o passa per continuare la ricerca. Cancella la ricerca per vedere tutti i profili.',
        noResults: 'Nessun risultato per "{{keyword}}"',
        noResultsHint: 'Prova parole chiave diverse o regola i tuoi filtri per trovare più corrispondenze.',
        clearSearch: 'Cancella ricerca'
      },
      emptyState: {
        allCaughtUp: 'Sei in pari',
        checkBack: 'Nuove persone si iscrivono ogni giorno.\nTorna presto o amplia le tue preferenze.'
      },
      premiumCta: {
        goPremium: 'Diventa Premium',
        description: 'Vedi chi ti ha messo like, like illimitati e altro.',
        upgrade: 'Aggiorna'
      },
      recommendations: {
        expandReach: 'Espandi la tua portata',
        increaseDistance: 'Aumenta la distanza di {{count}} mi',
        widenAge: 'Amplia la fascia d\'età di {{count}} anni',
        includeGender: 'Includi {{gender}}',
        searchGlobally: 'Cerca globalmente',
        expandSearch: 'Espandi la tua ricerca',
        newProfilesK: '{{count}}k+ nuovi profili',
        newProfiles: '{{count}} nuovi profili',
        newProfileSingular: '1 nuovo profilo',
        updatePreferencesTitle: 'Aggiornare preferenze?',
        updatePreferencesMessage: 'Aggiungere "{{gender}}" alle preferenze di genere? Puoi cambiarlo in qualsiasi momento in Impostazioni > Preferenze di corrispondenza.',
        add: 'Aggiungi'
      },
      banner: {
        photoBlurTitle: 'Perché alcune foto sono sfocate',
        photoBlurDescription: 'Alcuni utenti attivano la sfocatura foto nelle impostazioni privacy per proteggere la loro identità fino al match. Le foto saranno rivelate dopo la connessione!',
        profileHidden: 'Profilo nascosto',
        profileHiddenDescription: 'Il tuo profilo è temporaneamente nascosto. Tocca per caricare nuove foto.',
        completeProfileToMatch: 'Completa il profilo per fare match',
        completeProfile: 'Completa il tuo profilo',
        completeProfilePreview: 'Puoi navigare liberamente! Completa la registrazione per iniziare a mettere like e fare match.',
        completeProfileDefault: 'Completa la configurazione per iniziare a fare match. Puoi navigare ma non puoi ancora mettere like o essere visto.'
      },
      premiumLocation: {
        title: 'Sblocca ricerca globale',
        description: 'Hai preferenze di posizione salvate che richiedono Premium:',
        searchGlobally: 'Cerca corrispondenze globalmente',
        matchCities: 'Fai match in città specifiche',
        upgradeMessage: 'Passa a Premium per attivare queste funzionalità e trovare corrispondenze ovunque nel mondo.',
        upgradeToPremium: 'Passa a Premium',
        maybeLater: 'Forse dopo'
      }
    },
    filters: {
      basicFilters: 'Filtri base',
      minimum: 'Minimo',
      maximum: 'Massimo',
      activeToday: 'Attivo oggi',
      activeTodayDescription: 'Mostra solo utenti attivi nelle ultime 24 ore',
      showBlurred: 'Mostra foto sfocate',
      showBlurredDescription: 'Includi profili con sfocatura foto attivata',
      advancedFilters: 'Filtri avanzati',
      identityBackground: 'Identità e background',
      gender: 'Genere',
      ethnicity: 'Etnia',
      sexualOrientation: 'Orientamento sessuale',
      physicalPersonality: 'Fisico e personalità',
      heightRange: 'Intervallo altezza',
      zodiacSign: 'Segno zodiacale',
      mbtiPersonality: 'Tipo personalità MBTI',
      loveLanguage: 'Linguaggio dell\'amore',
      lifestyle: 'Stile di vita',
      languagesSpoken: 'Lingue parlate',
      smoking: 'Fumo',
      drinking: 'Alcol',
      pets: 'Animali domestici',
      marriageIntentions: 'Intenzioni matrimoniali',
      primaryReason: 'Motivo principale',
      relationshipType: 'Tipo di relazione',
      wantsChildren: 'Vuole figli',
      housingPreference: 'Preferenza abitativa',
      financialArrangement: 'Accordo finanziario'
    },
    verification: {
      alreadyVerified: 'Già verificato',
      alreadyVerifiedMessage: 'Le tue foto sono già verificate!',
      tooManyAttempts: 'Troppi tentativi',
      tooManyAttemptsMessage: 'Hai superato il numero massimo di tentativi di verifica (5). Contatta il supporto a hello@joinaccord.app.',
      tooManyAttemptsMessageShort: 'Hai superato il numero massimo di tentativi di verifica. Contatta il supporto.',
      cameraPermission: 'Permesso fotocamera richiesto',
      cameraPermissionMessage: 'Consenti l\'accesso alla fotocamera per scattare un selfie di verifica.',
      selfieError: 'Errore selfie',
      selfieErrorMessage: 'Qualcosa è andato storto. Riprova.',
      success: 'Foto verificate!',
      successMessage: 'Le tue foto sono state verificate!\n\nAffidabilità corrispondenza: {{similarity}}%\n\nIl tuo profilo ora mostra un badge verificato.',
      awesome: 'Fantastico!',
      unsuccessful: 'Verifica non riuscita',
      unsuccessfulMessage: '{{message}}\n\nPer migliorare le possibilità:\n\n• Scatta il selfie con luce naturale brillante\n• Assicurati che la foto principale sia recente\n• Guarda direttamente la fotocamera\n• Rimuovi occhiali da sole, cappelli o maschere\n• Evita ombre sul viso',
      tryAgain: 'Riprova',
      noPhotos: 'Nessuna foto profilo',
      noPhotosMessage: 'Carica foto profilo prima di verificare.',
      profileNotFound: 'Profilo non trovato. Riprova.',
      error: 'Errore di verifica',
      errorMessage: 'Verifica fallita. Riprova più tardi.',
      statusVerified: 'Verificato',
      statusProcessing: 'Elaborazione...',
      statusFailed: 'Fallito',
      statusNotVerified: 'Non verificato',
      title: 'Verifica foto',
      verifiedDescription: 'Le tue foto sono verificate! Questo mostra agli altri utenti che le tue foto profilo ti rappresentano accuratamente.',
      unverifiedDescription: 'Verifica le tue foto scattando un selfie. Lo confronteremo con le tue foto profilo usando il riconoscimento facciale.',
      beforeYouStart: 'Prima di iniziare',
      beforeYouStartDescription: 'Assicurati che la foto principale (prima foto) sia una foto recente e chiara del tuo viso. Il selfie sarà confrontato con le tue foto profilo.',
      attemptsUsed: 'Tentativi usati: {{count}} / 5',
      unsuccessfulBanner: 'Verifica non riuscita',
      unsuccessfulBannerMessage: 'Il selfie non corrispondeva abbastanza alle foto profilo. Per i migliori risultati, scatta il selfie con luce naturale brillante e assicurati che la foto principale sia recente e chiara.',
      verifying: 'Verifica in corso...',
      takeVerificationSelfie: 'Scatta selfie di verifica',
      forBestResults: 'Per i migliori risultati:',
      tips: {
        daylight: 'Scatta il selfie con luce naturale brillante',
        faceCamera: 'Guarda direttamente la fotocamera con espressione neutra',
        recentPhoto: 'Assicurati che la foto principale sia recente e mostri il viso chiaramente',
        removeCoverings: 'Rimuovi occhiali da sole, cappelli e coperture del viso',
        avoidShadows: 'Evita ombre dure o ambienti controluce',
        mustMatch: 'Il tuo selfie deve corrispondere alla persona nelle foto profilo'
      },
      photosVerified: 'Foto verificate!',
      verifiedBadgeMessage: 'Il tuo badge verificato è ora visibile sul profilo. Aiuta a costruire fiducia con potenziali corrispondenze.',
      freeForAll: 'Gratuito per tutti gli utenti'
    }
  },
  ka: {
    discover: {
      dailyLimitTitle: 'დღიური ლიმიტი ამოიწურა',
      dailyLimitMessage: 'დღევანდელი 5 ლაიქი გამოყენებულია. განაახლეთ შეუზღუდავისთვის!',
      quickFilter: {
        age: 'ასაკი',
        datingIntentions: 'გაცნობის მიზნები',
        activeToday: 'დღეს აქტიური'
      },
      ageSlider: {
        ageRange: 'ასაკის დიაპაზონი: {{min}} - {{max}}',
        minimum: 'მინიმუმი: {{value}}',
        maximum: 'მაქსიმუმი: {{value}}'
      },
      search: {
        placeholder: "მოძებნეთ საკვანძო სიტყვით (მაგ. 'მოგზაურობა', 'ვეგანი')",
        button: 'ძებნა',
        tip: 'მოიწონეთ ან გამოტოვეთ ძებნის გასაგრძელებლად. გაასუფთავეთ ძებნა ყველა პროფილის სანახავად.',
        noResults: '"{{keyword}}"-ის შედეგები არ მოიძებნა',
        noResultsHint: 'სცადეთ სხვა საკვანძო სიტყვები ან შეცვალეთ ფილტრები მეტი თანხვედრის საპოვნელად.',
        clearSearch: 'ძებნის გასუფთავება'
      },
      emptyState: {
        allCaughtUp: 'ყველა ნანახია',
        checkBack: 'ყოველდღე ახალი ადამიანები უერთდებიან.\nმალე დაბრუნდით ან გააფართოვეთ თქვენი პრეფერენციები.'
      },
      premiumCta: {
        goPremium: 'გახდი პრემიუმი',
        description: 'ნახეთ ვინ მოგწონდათ, შეუზღუდავი ლაიქები და სხვა.',
        upgrade: 'განახლება'
      },
      recommendations: {
        expandReach: 'გააფართოვეთ თქვენი დიაპაზონი',
        increaseDistance: 'მანძილის გაზრდა {{count}} მილით',
        widenAge: 'ასაკის დიაპაზონის გაფართოება {{count}} წლით',
        includeGender: '{{gender}}-ის ჩართვა',
        searchGlobally: 'გლობალური ძებნა',
        expandSearch: 'ძებნის გაფართოება',
        newProfilesK: '{{count}}ათ+ ახალი პროფილი',
        newProfiles: '{{count}} ახალი პროფილი',
        newProfileSingular: '1 ახალი პროფილი',
        updatePreferencesTitle: 'პრეფერენციების განახლება?',
        updatePreferencesMessage: '"{{gender}}" თქვენს სქესის პრეფერენციებში დაამატოთ? ნებისმიერ დროს შეცვლა შეგიძლიათ პარამეტრებში > თანხვედრის პრეფერენციები.',
        add: 'დამატება'
      },
      banner: {
        photoBlurTitle: 'რატომ არის ზოგიერთი ფოტო ბუნდოვანი',
        photoBlurDescription: 'ზოგიერთი მომხმარებელი ჩართავს ფოტოს ბუნდოვანებას კონფიდენციალურობის პარამეტრებში თანხვედრამდე იდენტობის დასაცავად. ფოტოები გამოჩნდება კავშირის შემდეგ!',
        profileHidden: 'პროფილი დამალულია',
        profileHiddenDescription: 'თქვენი პროფილი დროებით დამალულია. შეეხეთ ახალი ფოტოების ასატვირთად.',
        completeProfileToMatch: 'თანხვედრისთვის პროფილი შეავსეთ',
        completeProfile: 'შეავსეთ თქვენი პროფილი',
        completeProfilePreview: 'შეგიძლიათ თავისუფლად დათვალიერება! ლაიქებისა და თანხვედრის დასაწყებად დაასრულეთ რეგისტრაცია.',
        completeProfileDefault: 'თანხვედრის დასაწყებად დაასრულეთ დაყენება. შეგიძლიათ დათვალიერება მაგრამ ჯერ ვერ მოიწონებთ ან დაინახავენ.'
      },
      premiumLocation: {
        title: 'გლობალური ძებნის გახსნა',
        description: 'თქვენ გაქვთ შენახული მდებარეობის პრეფერენციები რომლებიც პრემიუმს საჭიროებს:',
        searchGlobally: 'გლობალურად თანხვედრების ძებნა',
        matchCities: 'კონკრეტულ ქალაქებში თანხვედრა',
        upgradeMessage: 'განაახლეთ პრემიუმზე ამ ფუნქციების გასააქტიურებლად და მსოფლიოს ნებისმიერ წერტილში თანხვედრის საპოვნელად.',
        upgradeToPremium: 'პრემიუმზე განახლება',
        maybeLater: 'იქნებ მოგვიანებით'
      }
    },
    filters: {
      basicFilters: 'ძირითადი ფილტრები',
      minimum: 'მინიმუმი',
      maximum: 'მაქსიმუმი',
      activeToday: 'დღეს აქტიური',
      activeTodayDescription: 'მხოლოდ ბოლო 24 საათში აქტიური მომხმარებლების ჩვენება',
      showBlurred: 'ბუნდოვანი ფოტოების ჩვენება',
      showBlurredDescription: 'ფოტოს ბუნდოვანებით პროფილების ჩართვა',
      advancedFilters: 'გაფართოებული ფილტრები',
      identityBackground: 'იდენტობა და წარსული',
      gender: 'სქესი',
      ethnicity: 'ეთნიკურობა',
      sexualOrientation: 'სექსუალური ორიენტაცია',
      physicalPersonality: 'ფიზიკური და პიროვნება',
      heightRange: 'სიმაღლის დიაპაზონი',
      zodiacSign: 'ზოდიაქოს ნიშანი',
      mbtiPersonality: 'MBTI პიროვნების ტიპი',
      loveLanguage: 'სიყვარულის ენა',
      lifestyle: 'ცხოვრების წესი',
      languagesSpoken: 'საუბრის ენები',
      smoking: 'მოწევა',
      drinking: 'სასმელი',
      pets: 'შინაური ცხოველები',
      marriageIntentions: 'ქორწინების მიზნები',
      primaryReason: 'ძირითადი მიზეზი',
      relationshipType: 'ურთიერთობის ტიპი',
      wantsChildren: 'სურს შვილები',
      housingPreference: 'საცხოვრებლის პრეფერენცია',
      financialArrangement: 'ფინანსური მოწყობა'
    },
    verification: {
      alreadyVerified: 'უკვე ვერიფიცირებული',
      alreadyVerifiedMessage: 'თქვენი ფოტოები უკვე ვერიფიცირებულია!',
      tooManyAttempts: 'ძალიან ბევრი მცდელობა',
      tooManyAttemptsMessage: 'თქვენ გადააჭარბეთ ვერიფიკაციის მაქსიმალურ მცდელობებს (5). გთხოვთ დაუკავშირდეთ მხარდაჭერას hello@joinaccord.app.',
      tooManyAttemptsMessageShort: 'თქვენ გადააჭარბეთ ვერიფიკაციის მაქსიმალურ მცდელობებს. გთხოვთ დაუკავშირდეთ მხარდაჭერას.',
      cameraPermission: 'საჭიროა კამერის ნებართვა',
      cameraPermissionMessage: 'გთხოვთ დაუშვათ კამერაზე წვდომა ვერიფიკაციის სელფის გადასაღებად.',
      selfieError: 'სელფის შეცდომა',
      selfieErrorMessage: 'რაღაც შეცდომა მოხდა. გთხოვთ სცადეთ ხელახლა.',
      success: 'ფოტოები ვერიფიცირებულია!',
      successMessage: 'თქვენი ფოტოები ვერიფიცირებულია!\n\nთანხვედრის ნდობა: {{similarity}}%\n\nთქვენი პროფილი ახლა აჩვენებს ვერიფიცირებულ ბეჯს.',
      awesome: 'შესანიშნავი!',
      unsuccessful: 'ვერიფიკაცია წარუმატებელი',
      unsuccessfulMessage: '{{message}}\n\nშანსების გასაუმჯობესებლად:\n\n• გადაიღეთ სელფი კაშკაშა ბუნებრივ დღის შუქზე\n• დარწმუნდით რომ თქვენი მთავარი პროფილის ფოტო ახალია\n• უშუალოდ კამერისკენ შეხედეთ\n• მოხსენით სათვალე, ქუდი ან ნიღაბი\n• მოერიდეთ ჩრდილებს სახეზე',
      tryAgain: 'ხელახლა სცადეთ',
      noPhotos: 'პროფილის ფოტოები არ არის',
      noPhotosMessage: 'გთხოვთ ატვირთოთ პროფილის ფოტოები ვერიფიკაციამდე.',
      profileNotFound: 'პროფილი ვერ მოიძებნა. გთხოვთ სცადეთ ხელახლა.',
      error: 'ვერიფიკაციის შეცდომა',
      errorMessage: 'ვერიფიკაცია ვერ მოხერხდა. გთხოვთ მოგვიანებით სცადეთ.',
      statusVerified: 'ვერიფიცირებული',
      statusProcessing: 'მუშავდება...',
      statusFailed: 'ვერ მოხერხდა',
      statusNotVerified: 'არავერიფიცირებული',
      title: 'ფოტოს ვერიფიკაცია',
      verifiedDescription: 'თქვენი ფოტოები ვერიფიცირებულია! ეს აჩვენებს სხვა მომხმარებლებს რომ თქვენი პროფილის ფოტოები ზუსტად წარმოგადგენთ.',
      unverifiedDescription: 'ვერიფიცირეთ თქვენი ფოტოები სელფის გადაღებით. ჩვენ შევადარებთ თქვენი პროფილის ფოტოებს სახის ამოცნობით.',
      beforeYouStart: 'დაწყებამდე',
      beforeYouStartDescription: 'დარწმუნდით რომ თქვენი მთავარი პროფილის ფოტო (პირველი ფოტო) არის თქვენი სახის ახალი, მკაფიო ფოტო. სელფი შედარდება თქვენი პროფილის ფოტოებთან.',
      attemptsUsed: 'გამოყენებული მცდელობები: {{count}} / 5',
      unsuccessfulBanner: 'ვერიფიკაცია წარუმატებელი',
      unsuccessfulBannerMessage: 'სელფი საკმარისად არ ემთხვევა თქვენი პროფილის ფოტოებს. საუკეთესო შედეგისთვის გადაიღეთ სელფი კაშკაშა ბუნებრივ შუქზე და დარწმუნდით რომ მთავარი ფოტო ახალი და მკაფიოა.',
      verifying: 'ვერიფიკაცია მიმდინარეობს...',
      takeVerificationSelfie: 'ვერიფიკაციის სელფის გადაღება',
      forBestResults: 'საუკეთესო შედეგისთვის:',
      tips: {
        daylight: 'გადაიღეთ სელფი კაშკაშა ბუნებრივ დღის შუქზე',
        faceCamera: 'უშუალოდ კამერისკენ შეხედეთ ნეიტრალური გამომეტყველებით',
        recentPhoto: 'დარწმუნდით რომ მთავარი პროფილის ფოტო ახალია და მკაფიოდ აჩვენებს სახეს',
        removeCoverings: 'მოხსენით მზის სათვალე, ქუდები და სახის საფარი',
        avoidShadows: 'მოერიდეთ მკაცრ ჩრდილებს ან უკანა განათებას',
        mustMatch: 'თქვენი სელფი უნდა ემთხვეოდეს პროფილის ფოტოებში პიროვნებას'
      },
      photosVerified: 'ფოტოები ვერიფიცირებულია!',
      verifiedBadgeMessage: 'თქვენი ვერიფიცირებული ბეჯი ახლა ნაჩვენებია პროფილზე. ეს ხელს უწყობს ნდობის აშენებას პოტენციურ თანხვედრებთან.',
      freeForAll: 'უფასო ყველა მომხმარებლისთვის'
    }
  },
  pl: {
    discover: {
      dailyLimitTitle: 'Dzienny limit osiągnięty',
      dailyLimitMessage: 'Wykorzystałeś wszystkie 5 polubień na dziś. Ulepsz, aby uzyskać nieograniczone!',
      quickFilter: {
        age: 'Wiek',
        datingIntentions: 'Intencje randkowe',
        activeToday: 'Aktywny dziś'
      },
      ageSlider: {
        ageRange: 'Przedział wiekowy: {{min}} - {{max}}',
        minimum: 'Minimum: {{value}}',
        maximum: 'Maksimum: {{value}}'
      },
      search: {
        placeholder: "Szukaj słowem kluczowym (np. 'podróże', 'wegański')",
        button: 'Szukaj',
        tip: 'Polub lub pomiń, aby kontynuować wyszukiwanie. Wyczyść wyszukiwanie, aby zobaczyć wszystkie profile.',
        noResults: 'Brak wyników dla "{{keyword}}"',
        noResultsHint: 'Spróbuj innych słów kluczowych lub dostosuj filtry, aby znaleźć więcej dopasowań.',
        clearSearch: 'Wyczyść wyszukiwanie'
      },
      emptyState: {
        allCaughtUp: 'Jesteś na bieżąco',
        checkBack: 'Nowe osoby dołączają codziennie.\nSprawdź ponownie wkrótce lub rozszerz swoje preferencje.'
      },
      premiumCta: {
        goPremium: 'Zostań Premium',
        description: 'Zobacz, kto Cię polubił, nieograniczone polubienia i więcej.',
        upgrade: 'Ulepsz'
      },
      recommendations: {
        expandReach: 'Rozszerz swój zasięg',
        increaseDistance: 'Zwiększ dystans o {{count}} mil',
        widenAge: 'Poszerz przedział wiekowy o {{count}} lat',
        includeGender: 'Uwzględnij {{gender}}',
        searchGlobally: 'Szukaj globalnie',
        expandSearch: 'Rozszerz wyszukiwanie',
        newProfilesK: '{{count}}tys.+ nowych profili',
        newProfiles: '{{count}} nowych profili',
        newProfileSingular: '1 nowy profil',
        updatePreferencesTitle: 'Zaktualizować preferencje?',
        updatePreferencesMessage: 'Dodać "{{gender}}" do preferencji płci? Możesz to zmienić w dowolnym momencie w Ustawienia > Preferencje dopasowania.',
        add: 'Dodaj'
      },
      banner: {
        photoBlurTitle: 'Dlaczego niektóre zdjęcia są rozmyte',
        photoBlurDescription: 'Niektórzy użytkownicy włączają rozmycie zdjęć w ustawieniach prywatności, aby chronić swoją tożsamość do dopasowania. Zdjęcia zostaną ujawnione po połączeniu!',
        profileHidden: 'Profil ukryty',
        profileHiddenDescription: 'Twój profil jest tymczasowo ukryty. Dotknij, aby przesłać nowe zdjęcia.',
        completeProfileToMatch: 'Uzupełnij profil, aby dopasowywać',
        completeProfile: 'Uzupełnij swój profil',
        completeProfilePreview: 'Możesz swobodnie przeglądać! Dokończ rejestrację, aby zacząć lubić i dopasowywać.',
        completeProfileDefault: 'Dokończ konfigurację, aby rozpocząć dopasowywanie. Możesz przeglądać, ale nie możesz jeszcze lubić ani być widocznym.'
      },
      premiumLocation: {
        title: 'Odblokuj wyszukiwanie globalne',
        description: 'Masz zapisane preferencje lokalizacji wymagające Premium:',
        searchGlobally: 'Szukaj dopasowań globalnie',
        matchCities: 'Dopasuj w konkretnych miastach',
        upgradeMessage: 'Ulepsz do Premium, aby aktywować te funkcje i znajdować dopasowania w dowolnym miejscu na świecie.',
        upgradeToPremium: 'Ulepsz do Premium',
        maybeLater: 'Może później'
      }
    },
    filters: {
      basicFilters: 'Filtry podstawowe',
      minimum: 'Minimum',
      maximum: 'Maksimum',
      activeToday: 'Aktywny dziś',
      activeTodayDescription: 'Pokaż tylko użytkowników aktywnych w ciągu ostatnich 24 godzin',
      showBlurred: 'Pokaż rozmyte zdjęcia',
      showBlurredDescription: 'Uwzględnij profile z włączonym rozmyciem zdjęć',
      advancedFilters: 'Filtry zaawansowane',
      identityBackground: 'Tożsamość i pochodzenie',
      gender: 'Płeć',
      ethnicity: 'Pochodzenie etniczne',
      sexualOrientation: 'Orientacja seksualna',
      physicalPersonality: 'Fizyczność i osobowość',
      heightRange: 'Zakres wzrostu',
      zodiacSign: 'Znak zodiaku',
      mbtiPersonality: 'Typ osobowości MBTI',
      loveLanguage: 'Język miłości',
      lifestyle: 'Styl życia',
      languagesSpoken: 'Języki',
      smoking: 'Palenie',
      drinking: 'Alkohol',
      pets: 'Zwierzęta',
      marriageIntentions: 'Intencje małżeńskie',
      primaryReason: 'Główny powód',
      relationshipType: 'Typ związku',
      wantsChildren: 'Chce dzieci',
      housingPreference: 'Preferencja mieszkaniowa',
      financialArrangement: 'Ustalenia finansowe'
    },
    verification: {
      alreadyVerified: 'Już zweryfikowany',
      alreadyVerifiedMessage: 'Twoje zdjęcia są już zweryfikowane!',
      tooManyAttempts: 'Zbyt wiele prób',
      tooManyAttemptsMessage: 'Przekroczono maksymalną liczbę prób weryfikacji (5). Skontaktuj się z pomocą pod hello@joinaccord.app.',
      tooManyAttemptsMessageShort: 'Przekroczono maksymalną liczbę prób weryfikacji. Skontaktuj się z pomocą.',
      cameraPermission: 'Wymagane pozwolenie kamery',
      cameraPermissionMessage: 'Zezwól na dostęp do kamery, aby zrobić selfie weryfikacyjne.',
      selfieError: 'Błąd selfie',
      selfieErrorMessage: 'Coś poszło nie tak. Spróbuj ponownie.',
      success: 'Zdjęcia zweryfikowane!',
      successMessage: 'Twoje zdjęcia zostały zweryfikowane!\n\nPewność dopasowania: {{similarity}}%\n\nTwój profil wyświetla teraz odznakę weryfikacji.',
      awesome: 'Świetnie!',
      unsuccessful: 'Weryfikacja nieudana',
      unsuccessfulMessage: '{{message}}\n\nAby poprawić szanse:\n\n• Zrób selfie w jasnym naturalnym świetle dziennym\n• Upewnij się, że główne zdjęcie profilowe jest aktualne\n• Patrz bezpośrednio w kamerę\n• Zdejmij okulary przeciwsłoneczne, czapki lub maski\n• Unikaj cieni na twarzy',
      tryAgain: 'Spróbuj ponownie',
      noPhotos: 'Brak zdjęć profilowych',
      noPhotosMessage: 'Prześlij zdjęcia profilowe przed weryfikacją.',
      profileNotFound: 'Profil nie znaleziony. Spróbuj ponownie.',
      error: 'Błąd weryfikacji',
      errorMessage: 'Weryfikacja nie powiodła się. Spróbuj ponownie później.',
      statusVerified: 'Zweryfikowany',
      statusProcessing: 'Przetwarzanie...',
      statusFailed: 'Niepowodzenie',
      statusNotVerified: 'Niezweryfikowany',
      title: 'Weryfikacja zdjęć',
      verifiedDescription: 'Twoje zdjęcia są zweryfikowane! To pokazuje innym użytkownikom, że zdjęcia profilowe dokładnie Cię przedstawiają.',
      unverifiedDescription: 'Zweryfikuj zdjęcia robiąc selfie. Porównamy je z Twoimi zdjęciami profilowymi za pomocą rozpoznawania twarzy.',
      beforeYouStart: 'Zanim zaczniesz',
      beforeYouStartDescription: 'Upewnij się, że główne zdjęcie profilowe (pierwsze zdjęcie) jest aktualnym, wyraźnym zdjęciem Twojej twarzy. Selfie zostanie porównane z Twoimi zdjęciami profilowymi.',
      attemptsUsed: 'Wykorzystane próby: {{count}} / 5',
      unsuccessfulBanner: 'Weryfikacja nieudana',
      unsuccessfulBannerMessage: 'Selfie nie pasowało wystarczająco do zdjęć profilowych. Dla najlepszych wyników zrób selfie w jasnym naturalnym świetle i upewnij się, że główne zdjęcie jest aktualne i wyraźne.',
      verifying: 'Weryfikowanie...',
      takeVerificationSelfie: 'Zrób selfie weryfikacyjne',
      forBestResults: 'Dla najlepszych wyników:',
      tips: {
        daylight: 'Zrób selfie w jasnym, naturalnym świetle dziennym',
        faceCamera: 'Patrz bezpośrednio w kamerę z neutralnym wyrazem twarzy',
        recentPhoto: 'Upewnij się, że główne zdjęcie profilowe jest aktualne i wyraźnie pokazuje twarz',
        removeCoverings: 'Zdejmij okulary przeciwsłoneczne, czapki i zasłony twarzy',
        avoidShadows: 'Unikaj ostrych cieni lub otoczenia z kontrświatłem',
        mustMatch: 'Twoje selfie musi pasować do osoby na zdjęciach profilowych'
      },
      photosVerified: 'Zdjęcia zweryfikowane!',
      verifiedBadgeMessage: 'Twoja odznaka weryfikacji jest teraz widoczna na profilu. Pomaga to budować zaufanie z potencjalnymi dopasowaniami.',
      freeForAll: 'Bezpłatne dla wszystkich użytkowników'
    }
  }
};

const localesDir = path.join(__dirname, '..', 'locales');

for (const [locale, newKeys] of Object.entries(translations)) {
  const filePath = path.join(localesDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  deepMerge(data, newKeys);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Updated ${locale}.json`);
}

console.log('Done! Updated 6 locales: he, hi, id, it, ka, pl');
