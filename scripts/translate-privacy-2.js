/**
 * Adds privacySettings translations to locales: he, hi, id, it, ka, pl
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
    privacySettings: {
      title: "הגדרות פרטיות",
      loading: "טוען הגדרות...",
      infoBannerTitle: "הפרטיות שלך חשובה",
      infoBannerText: "שלטו באופן שבו אחרים רואים אתכם באקורד. שינויים נכנסים לתוקף מיד.",
      sections: {
        profileVisibility: "נראות הפרופיל",
        verification: "אימות",
        activityPrivacy: "פרטיות פעילות",
        location: "מיקום"
      },
      photoBlur: {
        title: "טשטוש תמונות",
        description: "טשטשו את התמונות שלכם עד שתתאימו למישהו"
      },
      incognitoMode: {
        title: "מצב גלישה בסתר",
        description: "הסתירו את הפרופיל שלכם מהגילוי. רק משתמשים שהתאמתם איתם יוכלו לראות אתכם.",
        requiresPremium: " דורש פרימיום."
      },
      hideLastActive: {
        title: "הסתרת פעילות אחרונה",
        description: "אל תציגו מתי הייתם פעילים לאחרונה באקורד"
      },
      hideDistance: {
        title: "הסתרת מרחק מדויק",
        description: "הציגו עיר/מדינה בלבד, הסתירו מרחק מדויק מאחרים",
        warning: "אחרים יראו את העיר/המדינה שלכם אך לא את המרחק המדויק. עדיין תוכלו לסנן התאמות לפי מרחק."
      },
      location: {
        title: "עדכון מיקום",
        description: "השתמשו ב-GPS או חפשו את העיר שלכם כדי להגדיר את המיקום",
        current: "נוכחי: {{location}}",
        useGps: "השתמש ב-GPS",
        searchCity: "חפש עיר",
        searchPlaceholder: "חפשו עיר או מדינה...",
        noCitiesFound: "לא נמצאו ערים"
      },
      tips: {
        title: "טיפים לפרטיות",
        encrypted: "כל ההודעות מוצפנות מקצה לקצה כברירת מחדל",
        blocked: "משתמשים חסומים לא יכולים לראות את הפרופיל שלכם או לשלוח לכם הודעות",
        namePrivacy: "השם האמיתי ופרטי הקשר שלכם לעולם אינם משותפים",
        deleteAccount: "תוכלו למחוק את החשבון והנתונים שלכם בכל עת"
      },
      legal: {
        privacyPolicy: "מדיניות פרטיות",
        termsOfService: "תנאי שימוש"
      },
      alerts: {
        loadError: "טעינת הגדרות הפרטיות נכשלה",
        updateError: "עדכון הגדרת הפרטיות נכשל. אנא נסו שוב.",
        permissionDenied: "הרשאה נדחתה",
        permissionDeniedMessage: "נדרשת הרשאת מיקום לעדכון המיקום שלכם. תוכלו להפעיל אותה בהגדרות המכשיר.",
        preciseLocationRequired: "נדרש מיקום מדויק",
        preciseLocationMessage: "דיוק המיקום נמוך מדי ({{accuracy}} מטרים). אנא הפעילו \"מיקום מדויק\" עבור אקורד בהגדרות האייפון:\n\n1. פתחו הגדרות\n2. גללו לאקורד\n3. הקישו על מיקום\n4. הפעילו \"מיקום מדויק\"\n\nזה מבטיח חישובי מרחק מדויקים להתאמה.",
        openSettings: "פתח הגדרות",
        locationSuccess: "המיקום עודכן ל-{{location}}",
        locationSuccessGeneric: "המיקום שלכם עודכן!",
        locationError: "עדכון המיקום נכשל. אנא נסו שוב."
      }
    }
  },
  hi: {
    privacySettings: {
      title: "गोपनीयता सेटिंग्स",
      loading: "सेटिंग्स लोड हो रही हैं...",
      infoBannerTitle: "आपकी गोपनीयता मायने रखती है",
      infoBannerText: "नियंत्रित करें कि अकॉर्ड पर दूसरे आपको कैसे देखते हैं। बदलाव तुरंत प्रभावी होते हैं।",
      sections: {
        profileVisibility: "प्रोफ़ाइल दृश्यता",
        verification: "सत्यापन",
        activityPrivacy: "गतिविधि गोपनीयता",
        location: "स्थान"
      },
      photoBlur: {
        title: "फोटो ब्लर",
        description: "किसी से मैच होने तक अपनी तस्वीरें धुंधली करें"
      },
      incognitoMode: {
        title: "गुप्त मोड",
        description: "डिस्कवरी से अपनी प्रोफ़ाइल छिपाएं। केवल मैच किए गए उपयोगकर्ता आपको देख सकते हैं।",
        requiresPremium: " प्रीमियम आवश्यक है।"
      },
      hideLastActive: {
        title: "अंतिम सक्रिय छिपाएं",
        description: "दिखाने से बचें कि आप अकॉर्ड पर आखिरी बार कब सक्रिय थे"
      },
      hideDistance: {
        title: "सटीक दूरी छिपाएं",
        description: "केवल शहर/देश दिखाएं, दूसरों से सटीक दूरी छिपाएं",
        warning: "दूसरे आपका शहर/देश देख सकेंगे लेकिन आपकी सटीक दूरी नहीं। आप अभी भी दूरी के अनुसार मैच फ़िल्टर कर सकते हैं।"
      },
      location: {
        title: "स्थान अपडेट करें",
        description: "अपना स्थान सेट करने के लिए GPS का उपयोग करें या अपने शहर की खोज करें",
        current: "वर्तमान: {{location}}",
        useGps: "GPS का उपयोग करें",
        searchCity: "शहर खोजें",
        searchPlaceholder: "शहर या देश खोजें...",
        noCitiesFound: "कोई शहर नहीं मिला"
      },
      tips: {
        title: "गोपनीयता सुझाव",
        encrypted: "सभी संदेश डिफ़ॉल्ट रूप से एंड-टू-एंड एन्क्रिप्टेड हैं",
        blocked: "ब्लॉक किए गए उपयोगकर्ता आपकी प्रोफ़ाइल नहीं देख सकते या आपको संदेश नहीं भेज सकते",
        namePrivacy: "आपका असली नाम और संपर्क जानकारी कभी साझा नहीं की जाती",
        deleteAccount: "आप किसी भी समय अपना खाता और डेटा हटा सकते हैं"
      },
      legal: {
        privacyPolicy: "गोपनीयता नीति",
        termsOfService: "सेवा की शर्तें"
      },
      alerts: {
        loadError: "गोपनीयता सेटिंग्स लोड करने में विफल",
        updateError: "गोपनीयता सेटिंग अपडेट करने में विफल। कृपया पुनः प्रयास करें।",
        permissionDenied: "अनुमति अस्वीकृत",
        permissionDeniedMessage: "अपना स्थान अपडेट करने के लिए स्थान अनुमति आवश्यक है। आप इसे अपनी डिवाइस सेटिंग्स में सक्षम कर सकते हैं।",
        preciseLocationRequired: "सटीक स्थान आवश्यक",
        preciseLocationMessage: "स्थान सटीकता बहुत कम है ({{accuracy}} मीटर)। कृपया अपनी iPhone सेटिंग्स में अकॉर्ड के लिए \"सटीक स्थान\" सक्षम करें:\n\n1. सेटिंग्स खोलें\n2. अकॉर्ड तक स्क्रॉल करें\n3. स्थान पर टैप करें\n4. \"सटीक स्थान\" सक्षम करें\n\nयह मैचिंग के लिए सटीक दूरी गणना सुनिश्चित करता है।",
        openSettings: "सेटिंग्स खोलें",
        locationSuccess: "स्थान {{location}} में अपडेट किया गया",
        locationSuccessGeneric: "आपका स्थान अपडेट कर दिया गया है!",
        locationError: "स्थान अपडेट करने में विफल। कृपया पुनः प्रयास करें।"
      }
    }
  },
  id: {
    privacySettings: {
      title: "Pengaturan Privasi",
      loading: "Memuat pengaturan...",
      infoBannerTitle: "Privasi Anda Penting",
      infoBannerText: "Kontrol bagaimana orang lain melihat Anda di Accord. Perubahan berlaku segera.",
      sections: {
        profileVisibility: "Visibilitas Profil",
        verification: "Verifikasi",
        activityPrivacy: "Privasi Aktivitas",
        location: "Lokasi"
      },
      photoBlur: {
        title: "Blur Foto",
        description: "Buramkan foto Anda sampai Anda cocok dengan seseorang"
      },
      incognitoMode: {
        title: "Mode Penyamaran",
        description: "Sembunyikan profil Anda dari penemuan. Hanya pengguna yang cocok yang dapat melihat Anda.",
        requiresPremium: " Memerlukan Premium."
      },
      hideLastActive: {
        title: "Sembunyikan Terakhir Aktif",
        description: "Jangan tampilkan kapan Anda terakhir aktif di Accord"
      },
      hideDistance: {
        title: "Sembunyikan Jarak Tepat",
        description: "Tampilkan kota/negara saja, sembunyikan jarak tepat dari orang lain",
        warning: "Orang lain akan melihat kota/negara Anda tetapi bukan jarak tepat Anda. Anda masih dapat memfilter kecocokan berdasarkan jarak."
      },
      location: {
        title: "Perbarui Lokasi",
        description: "Gunakan GPS atau cari kota Anda untuk mengatur lokasi",
        current: "Saat ini: {{location}}",
        useGps: "Gunakan GPS",
        searchCity: "Cari Kota",
        searchPlaceholder: "Cari kota atau negara...",
        noCitiesFound: "Tidak ada kota ditemukan"
      },
      tips: {
        title: "Tips Privasi",
        encrypted: "Semua pesan dienkripsi end-to-end secara default",
        blocked: "Pengguna yang diblokir tidak dapat melihat profil Anda atau mengirim pesan kepada Anda",
        namePrivacy: "Nama asli dan info kontak Anda tidak pernah dibagikan",
        deleteAccount: "Anda dapat menghapus akun dan data Anda kapan saja"
      },
      legal: {
        privacyPolicy: "Kebijakan Privasi",
        termsOfService: "Ketentuan Layanan"
      },
      alerts: {
        loadError: "Gagal memuat pengaturan privasi",
        updateError: "Gagal memperbarui pengaturan privasi. Silakan coba lagi.",
        permissionDenied: "Izin Ditolak",
        permissionDeniedMessage: "Izin lokasi diperlukan untuk memperbarui lokasi Anda. Anda dapat mengaktifkannya di pengaturan perangkat.",
        preciseLocationRequired: "Lokasi Tepat Diperlukan",
        preciseLocationMessage: "Akurasi lokasi terlalu rendah ({{accuracy}} meter). Silakan aktifkan \"Lokasi Tepat\" untuk Accord di Pengaturan iPhone Anda:\n\n1. Buka Pengaturan\n2. Gulir ke Accord\n3. Ketuk Lokasi\n4. Aktifkan \"Lokasi Tepat\"\n\nIni memastikan perhitungan jarak yang akurat untuk pencocokan.",
        openSettings: "Buka Pengaturan",
        locationSuccess: "Lokasi diperbarui ke {{location}}",
        locationSuccessGeneric: "Lokasi Anda telah diperbarui!",
        locationError: "Gagal memperbarui lokasi. Silakan coba lagi."
      }
    }
  },
  it: {
    privacySettings: {
      title: "Impostazioni Privacy",
      loading: "Caricamento impostazioni...",
      infoBannerTitle: "La Tua Privacy Conta",
      infoBannerText: "Controlla come gli altri ti vedono su Accord. Le modifiche hanno effetto immediato.",
      sections: {
        profileVisibility: "Visibilità Profilo",
        verification: "Verifica",
        activityPrivacy: "Privacy Attività",
        location: "Posizione"
      },
      photoBlur: {
        title: "Sfocatura Foto",
        description: "Sfoca le tue foto finché non trovi un match con qualcuno"
      },
      incognitoMode: {
        title: "Modalità Incognito",
        description: "Nascondi il tuo profilo dalla scoperta. Solo gli utenti con cui hai fatto match possono vederti.",
        requiresPremium: " Richiede Premium."
      },
      hideLastActive: {
        title: "Nascondi Ultima Attività",
        description: "Non mostrare quando sei stato attivo l'ultima volta su Accord"
      },
      hideDistance: {
        title: "Nascondi Distanza Esatta",
        description: "Mostra solo città/paese, nascondi la distanza precisa dagli altri",
        warning: "Gli altri vedranno la tua città/paese ma non la tua distanza esatta. Puoi comunque filtrare i match per distanza."
      },
      location: {
        title: "Aggiorna Posizione",
        description: "Usa il GPS o cerca la tua città per impostare la posizione",
        current: "Attuale: {{location}}",
        useGps: "Usa GPS",
        searchCity: "Cerca Città",
        searchPlaceholder: "Cerca città o paese...",
        noCitiesFound: "Nessuna città trovata"
      },
      tips: {
        title: "Consigli sulla Privacy",
        encrypted: "Tutti i messaggi sono crittografati end-to-end per impostazione predefinita",
        blocked: "Gli utenti bloccati non possono vedere il tuo profilo o inviarti messaggi",
        namePrivacy: "Il tuo vero nome e le informazioni di contatto non vengono mai condivisi",
        deleteAccount: "Puoi eliminare il tuo account e i tuoi dati in qualsiasi momento"
      },
      legal: {
        privacyPolicy: "Informativa sulla Privacy",
        termsOfService: "Termini di Servizio"
      },
      alerts: {
        loadError: "Impossibile caricare le impostazioni sulla privacy",
        updateError: "Impossibile aggiornare l'impostazione sulla privacy. Riprova.",
        permissionDenied: "Permesso Negato",
        permissionDeniedMessage: "Il permesso di localizzazione è necessario per aggiornare la tua posizione. Puoi abilitarlo nelle impostazioni del dispositivo.",
        preciseLocationRequired: "Posizione Precisa Richiesta",
        preciseLocationMessage: "La precisione della posizione è troppo bassa ({{accuracy}} metri). Abilita \"Posizione Precisa\" per Accord nelle Impostazioni del tuo iPhone:\n\n1. Apri Impostazioni\n2. Scorri fino a Accord\n3. Tocca Posizione\n4. Abilita \"Posizione Precisa\"\n\nQuesto garantisce calcoli di distanza precisi per il matching.",
        openSettings: "Apri Impostazioni",
        locationSuccess: "Posizione aggiornata a {{location}}",
        locationSuccessGeneric: "La tua posizione è stata aggiornata!",
        locationError: "Impossibile aggiornare la posizione. Riprova."
      }
    }
  },
  ka: {
    privacySettings: {
      title: "კონფიდენციალურობის პარამეტრები",
      loading: "პარამეტრების ჩატვირთვა...",
      infoBannerTitle: "თქვენი კონფიდენციალურობა მნიშვნელოვანია",
      infoBannerText: "აკონტროლეთ, როგორ ხედავენ სხვები თქვენ Accord-ზე. ცვლილებები ძალაში შედის დაუყოვნებლივ.",
      sections: {
        profileVisibility: "პროფილის ხილვადობა",
        verification: "ვერიფიკაცია",
        activityPrivacy: "აქტივობის კონფიდენციალურობა",
        location: "მდებარეობა"
      },
      photoBlur: {
        title: "ფოტოს დაბინდვა",
        description: "დააბინდეთ თქვენი ფოტოები ვიღაცასთან დამთხვევამდე"
      },
      incognitoMode: {
        title: "ინკოგნიტო რეჟიმი",
        description: "დამალეთ თქვენი პროფილი აღმოჩენისგან. მხოლოდ დამთხვეული მომხმარებლები ხედავენ თქვენ.",
        requiresPremium: " საჭიროებს პრემიუმს."
      },
      hideLastActive: {
        title: "ბოლო აქტივობის დამალვა",
        description: "არ აჩვენოთ, როდის იყავით ბოლოს აქტიური Accord-ზე"
      },
      hideDistance: {
        title: "ზუსტი მანძილის დამალვა",
        description: "აჩვენეთ მხოლოდ ქალაქი/ქვეყანა, დამალეთ ზუსტი მანძილი სხვებისგან",
        warning: "სხვები დაინახავენ თქვენს ქალაქს/ქვეყანას, მაგრამ არა ზუსტ მანძილს. თქვენ კვლავ შეგიძლიათ გაფილტროთ დამთხვევები მანძილის მიხედვით."
      },
      location: {
        title: "მდებარეობის განახლება",
        description: "გამოიყენეთ GPS ან მოძებნეთ თქვენი ქალაქი მდებარეობის დასაყენებლად",
        current: "მიმდინარე: {{location}}",
        useGps: "GPS-ის გამოყენება",
        searchCity: "ქალაქის ძებნა",
        searchPlaceholder: "მოძებნეთ ქალაქი ან ქვეყანა...",
        noCitiesFound: "ქალაქები ვერ მოიძებნა"
      },
      tips: {
        title: "კონფიდენციალურობის რჩევები",
        encrypted: "ყველა შეტყობინება ნაგულისხმევად დაშიფრულია ბოლოდან ბოლომდე",
        blocked: "დაბლოკილი მომხმარებლები ვერ ხედავენ თქვენს პროფილს და ვერ გიგზავნიან შეტყობინებებს",
        namePrivacy: "თქვენი ნამდვილი სახელი და საკონტაქტო ინფორმაცია არასოდეს გაზიარდება",
        deleteAccount: "შეგიძლიათ წაშალოთ თქვენი ანგარიში და მონაცემები ნებისმიერ დროს"
      },
      legal: {
        privacyPolicy: "კონფიდენციალურობის პოლიტიკა",
        termsOfService: "მომსახურების პირობები"
      },
      alerts: {
        loadError: "კონფიდენციალურობის პარამეტრების ჩატვირთვა ვერ მოხერხდა",
        updateError: "კონფიდენციალურობის პარამეტრის განახლება ვერ მოხერხდა. გთხოვთ, სცადოთ ხელახლა.",
        permissionDenied: "ნებართვა უარყოფილია",
        permissionDeniedMessage: "მდებარეობის ნებართვა საჭიროა თქვენი მდებარეობის განახლებისთვის. შეგიძლიათ ჩართოთ ის მოწყობილობის პარამეტრებში.",
        preciseLocationRequired: "საჭიროა ზუსტი მდებარეობა",
        preciseLocationMessage: "მდებარეობის სიზუსტე ძალიან დაბალია ({{accuracy}} მეტრი). გთხოვთ, ჩართოთ \"ზუსტი მდებარეობა\" Accord-ისთვის თქვენი iPhone-ის პარამეტრებში:\n\n1. გახსენით პარამეტრები\n2. გადაახვიეთ Accord-მდე\n3. შეეხეთ მდებარეობას\n4. ჩართეთ \"ზუსტი მდებარეობა\"\n\nეს უზრუნველყოფს მანძილის ზუსტ გამოთვლას დამთხვევისთვის.",
        openSettings: "პარამეტრების გახსნა",
        locationSuccess: "მდებარეობა განახლდა {{location}}-ზე",
        locationSuccessGeneric: "თქვენი მდებარეობა განახლდა!",
        locationError: "მდებარეობის განახლება ვერ მოხერხდა. გთხოვთ, სცადოთ ხელახლა."
      }
    }
  },
  pl: {
    privacySettings: {
      title: "Ustawienia Prywatności",
      loading: "Ładowanie ustawień...",
      infoBannerTitle: "Twoja Prywatność Ma Znaczenie",
      infoBannerText: "Kontroluj, jak inni widzą Cię na Accord. Zmiany wchodzą w życie natychmiast.",
      sections: {
        profileVisibility: "Widoczność Profilu",
        verification: "Weryfikacja",
        activityPrivacy: "Prywatność Aktywności",
        location: "Lokalizacja"
      },
      photoBlur: {
        title: "Rozmycie Zdjęć",
        description: "Rozmyj swoje zdjęcia, dopóki nie dopasujesz się z kimś"
      },
      incognitoMode: {
        title: "Tryb Incognito",
        description: "Ukryj swój profil z odkrywania. Tylko dopasowani użytkownicy mogą Cię zobaczyć.",
        requiresPremium: " Wymaga Premium."
      },
      hideLastActive: {
        title: "Ukryj Ostatnią Aktywność",
        description: "Nie pokazuj, kiedy ostatnio byłeś aktywny na Accord"
      },
      hideDistance: {
        title: "Ukryj Dokładną Odległość",
        description: "Pokaż tylko miasto/kraj, ukryj dokładną odległość przed innymi",
        warning: "Inni zobaczą Twoje miasto/kraj, ale nie Twoją dokładną odległość. Nadal możesz filtrować dopasowania według odległości."
      },
      location: {
        title: "Zaktualizuj Lokalizację",
        description: "Użyj GPS lub wyszukaj swoje miasto, aby ustawić lokalizację",
        current: "Aktualna: {{location}}",
        useGps: "Użyj GPS",
        searchCity: "Szukaj Miasta",
        searchPlaceholder: "Szukaj miasta lub kraju...",
        noCitiesFound: "Nie znaleziono miast"
      },
      tips: {
        title: "Wskazówki dotyczące Prywatności",
        encrypted: "Wszystkie wiadomości są domyślnie szyfrowane end-to-end",
        blocked: "Zablokowani użytkownicy nie mogą zobaczyć Twojego profilu ani wysłać Ci wiadomości",
        namePrivacy: "Twoje prawdziwe imię i dane kontaktowe nigdy nie są udostępniane",
        deleteAccount: "Możesz usunąć swoje konto i dane w dowolnym momencie"
      },
      legal: {
        privacyPolicy: "Polityka Prywatności",
        termsOfService: "Regulamin"
      },
      alerts: {
        loadError: "Nie udało się załadować ustawień prywatności",
        updateError: "Nie udało się zaktualizować ustawienia prywatności. Spróbuj ponownie.",
        permissionDenied: "Odmowa Uprawnień",
        permissionDeniedMessage: "Uprawnienia lokalizacji są wymagane do aktualizacji Twojej lokalizacji. Możesz je włączyć w ustawieniach urządzenia.",
        preciseLocationRequired: "Wymagana Dokładna Lokalizacja",
        preciseLocationMessage: "Dokładność lokalizacji jest zbyt niska ({{accuracy}} metrów). Włącz \"Dokładną Lokalizację\" dla Accord w Ustawieniach iPhone'a:\n\n1. Otwórz Ustawienia\n2. Przewiń do Accord\n3. Dotknij Lokalizacja\n4. Włącz \"Dokładna Lokalizacja\"\n\nTo zapewnia dokładne obliczenia odległości do dopasowywania.",
        openSettings: "Otwórz Ustawienia",
        locationSuccess: "Lokalizacja zaktualizowana na {{location}}",
        locationSuccessGeneric: "Twoja lokalizacja została zaktualizowana!",
        locationError: "Nie udało się zaktualizować lokalizacji. Spróbuj ponownie."
      }
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

console.log('Done! Added privacySettings to 6 locales (he, hi, id, it, ka, pl)');
