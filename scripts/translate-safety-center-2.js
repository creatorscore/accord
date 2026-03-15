/**
 * Adds safetyCenter translations to locales: he, hi, id, it, ka, pl
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
    safetyCenter: {
      title: "מרכז הבטיחות",
      subtitle: "הישארו בטוחים באקורד",
      safetyTipsTitle: "טיפים לבטיחות",
      crisisResourcesTitle: "משאבי חירום",
      crisisResourcesDescription: "אם אתם או מישהו שאתם מכירים בסכנה, אנא פנו למשאבים אלה.",
      visitWebsite: "בקרו באתר",
      quickActionsTitle: "פעולות מהירות",
      footerText: "הבטיחות שלכם היא העדיפות העליונה שלנו. אם אתם מרגישים לא בטוחים, אל תהססו לפנות אלינו או למשאבים שלמעלה.",
      alerts: {
        callTitle: "התקשרו ל-{{name}}",
        callMessage: "האם ברצונכם להתקשר ל-{{phone}}?",
        call: "התקשרו",
        emailUs: "שלחו לנו מייל ל-hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "משתמשים חסומים",
        blockedUsersDesc: "נהלו את רשימת המשתמשים החסומים",
        privacySettings: "הגדרות פרטיות",
        privacySettingsDesc: "שלטו בפרטיות ובנראות שלכם",
        contactSupport: "צרו קשר עם התמיכה",
        contactSupportDesc: "דווחו על חששות בטיחות לצוות שלנו"
      },
      tips: {
        meetSafely: {
          title: "להיפגש בביטחון",
          description: "תמיד היפגשו במקומות ציבוריים בפגישות הראשונות",
          expanded: "כשפוגשים מישהו בפעם הראשונה:\n\n• בחרו מקום ציבורי כמו בית קפה, מסעדה או פארק\n• ספרו לחבר או בן משפחה לאן אתם הולכים\n• שתפו את המיקום שלכם עם מישהו שאתם סומכים עליו\n• ארגנו תחבורה משלכם\n• הישארו פיכחים וערניים\n• סמכו על האינסטינקט שלכם - אם משהו מרגיש לא נכון, עזבו"
        },
        protectInfo: {
          title: "הגנו על המידע שלכם",
          description: "שמרו על פרטים אישיים עד שנבנה אמון",
          expanded: "הגנו על עצמכם באינטרנט:\n\n• אל תשתפו כתובת בית, מקום עבודה או מידע פיננסי\n• היזהרו בשיתוף מספר הטלפון\n• הימנעו משיתוף פרטים מזהים מוקדם מדי\n• השתמשו בהודעות באפליקציה של אקורד עד שתרגישו בנוח\n• לעולם אל תשלחו כסף למישהו שלא פגשתם\n• היזהרו ממי שמבקש עזרה כספית"
        },
        verifyIdentity: {
          title: "אמתו זהות",
          description: "השתמשו בשיחות וידאו לפני פגישה אישית",
          expanded: "וודאו שאתם מדברים עם אדם אמיתי:\n\n• בקשו שיחת וידאו לפני הפגישה\n• חפשו פרופילים מאומתים (סימן וי כחול)\n• היזהרו מפרופילים עם תמונה אחת בלבד\n• שימו לב לסתירות בסיפור שלהם\n• בצעו חיפוש תמונה הפוך אם אתם חושדים\n• דווחו מיד על פרופילים מזויפים או חשודים"
        },
        lgbtqSafety: {
          title: "בטיחות LGBTQ+",
          description: "שיקולי בטיחות ספציפיים לקהילה שלנו",
          expanded: "להישאר בטוחים כאדם LGBTQ+:\n\n• היו סלקטיביים לגבי מי יודע על ההסדר שלכם\n• שקלו הגדרות פרטיות בקפידה\n• היו מודעים לחוקים ולגישות מקומיות\n• החזיקו תוכנית יציאה אם אתם מרגישים לא בטוחים\n• התחברו למשאבי LGBTQ+ באזור שלכם\n• סמכו על הקהילה - אנחנו כאן כדי לתמוך אחד בשני"
        },
        legalProtection: {
          title: "הגנה משפטית",
          description: "שקלו הסכמים רשמיים לנישואי לבנדר",
          expanded: "הגנו על עצמכם משפטית:\n\n• התייעצו עם עורך דין למשפחה ידידותי ל-LGBTQ+\n• שקלו הסכם קדם-נישואין\n• תעדו את ההסדר שלכם בכתב\n• הבינו את ההשלכות בנושא הגירה אם רלוונטי\n• דעו את זכויותיכם לגבי רכוש וכספים\n• שמרו על הסכמים חסויים ומאובטחים"
        },
        mentalHealth: {
          title: "בריאות נפשית",
          description: "דאגו לרווחה הרגשית שלכם",
          expanded: "תנו עדיפות לבריאות הנפשית:\n\n• הגדירו גבולות וציפיות ברורים\n• תקשרו בפתיחות ובכנות\n• פנו לטיפול או ייעוץ במידת הצורך\n• התחברו לקבוצות תמיכה של LGBTQ+\n• זכרו שמגיע לכם כבוד ואדיבות\n• קחו הפסקות מהאפליקציה כשצריך"
        },
        reportBlock: {
          title: "דווחו וחסמו",
          description: "השתמשו בכלי הבטיחות שלנו להגנה עצמית",
          expanded: "הישארו בטוחים באקורד:\n\n• חסמו משתמשים שגורמים לכם אי נוחות\n• דווחו על הטרדה, איומים או התנהגות חשודה\n• אנחנו בודקים את כל הדיווחים תוך 24 שעות\n• הדיווחים שלכם אנונימיים\n• הפרות חמורות מובילות לסגירת חשבון\n• צרו איתנו קשר ישירות בנושאי בטיחות דחופים"
        }
      },
      resources: {
        trevor: { name: "פרויקט טרבור", description: "תמיכה במשבר 24/7 לצעירי LGBTQ+" },
        transLifeline: { name: "קו החיים לטרנסג'נדרים", description: "תמיכה לאנשים טרנסג'נדרים" },
        glbtHotline: { name: "הקו החם הלאומי ל-LGBT", description: "תמיכת עמיתים ומשאבים מקומיים" },
        rainn: { name: "RAINN", description: "תמיכה בתקיפה מינית" }
      }
    }
  },
  hi: {
    safetyCenter: {
      title: "सुरक्षा केंद्र",
      subtitle: "अकॉर्ड पर सुरक्षित रहें",
      safetyTipsTitle: "सुरक्षा सुझाव",
      crisisResourcesTitle: "संकट संसाधन",
      crisisResourcesDescription: "अगर आप या आपका कोई जानने वाला खतरे में है, तो कृपया इन संसाधनों से संपर्क करें।",
      visitWebsite: "वेबसाइट देखें",
      quickActionsTitle: "त्वरित कार्रवाई",
      footerText: "आपकी सुरक्षा हमारी सर्वोच्च प्राथमिकता है। अगर आप कभी असुरक्षित महसूस करें, तो हमसे या ऊपर दिए गए संसाधनों से संपर्क करने में संकोच न करें।",
      alerts: {
        callTitle: "{{name}} को कॉल करें",
        callMessage: "क्या आप {{phone}} पर कॉल करना चाहते हैं?",
        call: "कॉल करें",
        emailUs: "हमें hello@joinaccord.app पर ईमेल करें"
      },
      actions: {
        blockedUsers: "ब्लॉक किए गए उपयोगकर्ता",
        blockedUsersDesc: "अपनी ब्लॉक सूची प्रबंधित करें",
        privacySettings: "गोपनीयता सेटिंग्स",
        privacySettingsDesc: "अपनी गोपनीयता और दृश्यता नियंत्रित करें",
        contactSupport: "सहायता से संपर्क करें",
        contactSupportDesc: "हमारी टीम को सुरक्षा चिंताओं की रिपोर्ट करें"
      },
      tips: {
        meetSafely: {
          title: "सुरक्षित रूप से मिलें",
          description: "पहली कुछ डेट्स में हमेशा सार्वजनिक स्थानों पर मिलें",
          expanded: "पहली बार किसी से मिलते समय:\n\n• कैफे, रेस्तरां या पार्क जैसी सार्वजनिक जगह चुनें\n• किसी दोस्त या परिवार के सदस्य को बताएं कि आप कहाँ जा रहे हैं\n• किसी विश्वसनीय व्यक्ति के साथ अपना स्थान साझा करें\n• अपना परिवहन खुद व्यवस्थित करें\n• सतर्क और सावधान रहें\n• अपनी अंतर्ज्ञान पर भरोसा करें - अगर कुछ गलत लगे तो चले जाएं"
        },
        protectInfo: {
          title: "अपनी जानकारी सुरक्षित रखें",
          description: "विश्वास बनने तक व्यक्तिगत विवरण निजी रखें",
          expanded: "ऑनलाइन अपनी सुरक्षा करें:\n\n• अपना घर का पता, कार्यस्थल या वित्तीय जानकारी साझा न करें\n• फोन नंबर साझा करते समय सावधान रहें\n• पहचान विवरण जल्दी साझा करने से बचें\n• सहज महसूस होने तक अकॉर्ड की इन-ऐप मैसेजिंग का उपयोग करें\n• जिससे मिले नहीं उसे कभी पैसे न भेजें\n• वित्तीय मदद मांगने वालों से सावधान रहें"
        },
        verifyIdentity: {
          title: "पहचान सत्यापित करें",
          description: "व्यक्तिगत रूप से मिलने से पहले वीडियो कॉल का उपयोग करें",
          expanded: "सत्यापित करें कि आप एक वास्तविक व्यक्ति से बात कर रहे हैं:\n\n• मिलने से पहले वीडियो कॉल का अनुरोध करें\n• सत्यापित प्रोफाइल देखें (नीला चेकमार्क)\n• केवल एक फोटो वाले प्रोफाइल से सावधान रहें\n• उनकी कहानी में विसंगतियों पर ध्यान दें\n• संदेह होने पर रिवर्स इमेज सर्च करें\n• नकली या संदिग्ध प्रोफाइल तुरंत रिपोर्ट करें"
        },
        lgbtqSafety: {
          title: "LGBTQ+ सुरक्षा",
          description: "हमारे समुदाय के लिए विशिष्ट सुरक्षा विचार",
          expanded: "LGBTQ+ व्यक्ति के रूप में सुरक्षित रहना:\n\n• चुनिंदा लोगों को ही अपनी व्यवस्था के बारे में बताएं\n• गोपनीयता सेटिंग्स पर सावधानी से विचार करें\n• स्थानीय कानूनों और दृष्टिकोणों के बारे में जागरूक रहें\n• असुरक्षित महसूस करने पर निकास योजना रखें\n• अपने क्षेत्र में LGBTQ+ संसाधनों से जुड़ें\n• अपने समुदाय पर भरोसा करें - हम एक-दूसरे का समर्थन करने के लिए हैं"
        },
        legalProtection: {
          title: "कानूनी सुरक्षा",
          description: "लैवेंडर विवाह के लिए औपचारिक समझौतों पर विचार करें",
          expanded: "कानूनी रूप से अपनी सुरक्षा करें:\n\n• LGBTQ+-अनुकूल पारिवारिक वकील से परामर्श करें\n• प्रीनप्शियल एग्रीमेंट पर विचार करें\n• अपनी व्यवस्था को लिखित में दर्ज करें\n• लागू होने पर आव्रजन प्रभावों को समझें\n• संपत्ति और वित्त के बारे में अपने अधिकार जानें\n• समझौतों को गोपनीय और सुरक्षित रखें"
        },
        mentalHealth: {
          title: "मानसिक स्वास्थ्य",
          description: "अपनी भावनात्मक भलाई का ध्यान रखें",
          expanded: "अपने मानसिक स्वास्थ्य को प्राथमिकता दें:\n\n• स्पष्ट सीमाएं और अपेक्षाएं निर्धारित करें\n• खुले और ईमानदार रूप से संवाद करें\n• जरूरत पड़ने पर थेरेपी या परामर्श लें\n• LGBTQ+ सहायता समूहों से जुड़ें\n• याद रखें कि आप सम्मान और दयालुता के हकदार हैं\n• जरूरत पड़ने पर ऐप से ब्रेक लें"
        },
        reportBlock: {
          title: "रिपोर्ट और ब्लॉक करें",
          description: "अपनी सुरक्षा के लिए हमारे सुरक्षा उपकरणों का उपयोग करें",
          expanded: "अकॉर्ड पर सुरक्षित रहें:\n\n• असहज करने वाले उपयोगकर्ताओं को ब्लॉक करें\n• उत्पीड़न, धमकी या संदिग्ध व्यवहार की रिपोर्ट करें\n• हम 24 घंटे के भीतर सभी रिपोर्ट की समीक्षा करते हैं\n• आपकी रिपोर्ट गुमनाम होती हैं\n• गंभीर उल्लंघन से खाता बंद होता है\n• तत्काल सुरक्षा चिंताओं के लिए सीधे हमसे संपर्क करें"
        }
      },
      resources: {
        trevor: { name: "द ट्रेवर प्रोजेक्ट", description: "LGBTQ+ युवाओं के लिए 24/7 संकट सहायता" },
        transLifeline: { name: "ट्रांस लाइफलाइन", description: "ट्रांसजेंडर लोगों के लिए सहायता" },
        glbtHotline: { name: "LGBT राष्ट्रीय हॉटलाइन", description: "सहकर्मी सहायता और स्थानीय संसाधन" },
        rainn: { name: "RAINN", description: "यौन उत्पीड़न सहायता" }
      }
    }
  },
  id: {
    safetyCenter: {
      title: "Pusat Keamanan",
      subtitle: "Tetap aman di Accord",
      safetyTipsTitle: "Tips Keamanan",
      crisisResourcesTitle: "Sumber Daya Krisis",
      crisisResourcesDescription: "Jika Anda atau seseorang yang Anda kenal dalam bahaya, silakan hubungi sumber daya ini.",
      visitWebsite: "Kunjungi Situs",
      quickActionsTitle: "Tindakan Cepat",
      footerText: "Keamanan Anda adalah prioritas utama kami. Jika Anda merasa tidak aman, jangan ragu untuk menghubungi kami atau sumber daya di atas.",
      alerts: {
        callTitle: "Hubungi {{name}}",
        callMessage: "Apakah Anda ingin menghubungi {{phone}}?",
        call: "Hubungi",
        emailUs: "Email kami di hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "Pengguna Diblokir",
        blockedUsersDesc: "Kelola daftar pengguna yang diblokir",
        privacySettings: "Pengaturan Privasi",
        privacySettingsDesc: "Kontrol privasi dan visibilitas Anda",
        contactSupport: "Hubungi Dukungan",
        contactSupportDesc: "Laporkan masalah keamanan kepada tim kami"
      },
      tips: {
        meetSafely: {
          title: "Bertemu dengan Aman",
          description: "Selalu bertemu di tempat umum untuk beberapa kencan pertama",
          expanded: "Saat bertemu seseorang untuk pertama kali:\n\n• Pilih lokasi umum seperti kafe, restoran, atau taman\n• Beritahu teman atau anggota keluarga ke mana Anda pergi\n• Bagikan lokasi Anda dengan seseorang yang Anda percaya\n• Atur transportasi Anda sendiri\n• Tetap waspada dan sadar\n• Percaya insting Anda - jika sesuatu terasa salah, pergi"
        },
        protectInfo: {
          title: "Lindungi Informasi Anda",
          description: "Jaga detail pribadi tetap privat sampai kepercayaan terbangun",
          expanded: "Lindungi diri Anda secara online:\n\n• Jangan bagikan alamat rumah, tempat kerja, atau informasi keuangan\n• Berhati-hatilah saat membagikan nomor telepon\n• Hindari membagikan detail identitas terlalu dini\n• Gunakan pesan dalam aplikasi Accord sampai Anda merasa nyaman\n• Jangan pernah mengirim uang ke seseorang yang belum pernah Anda temui\n• Waspadai siapa pun yang meminta bantuan keuangan"
        },
        verifyIdentity: {
          title: "Verifikasi Identitas",
          description: "Gunakan panggilan video sebelum bertemu langsung",
          expanded: "Verifikasi bahwa Anda berbicara dengan orang nyata:\n\n• Minta panggilan video sebelum bertemu\n• Cari profil terverifikasi (tanda centang biru)\n• Berhati-hatilah dengan profil yang hanya memiliki satu foto\n• Perhatikan ketidakkonsistenan dalam cerita mereka\n• Lakukan pencarian gambar terbalik jika Anda curiga\n• Laporkan profil palsu atau mencurigakan segera"
        },
        lgbtqSafety: {
          title: "Keamanan LGBTQ+",
          description: "Pertimbangan keamanan khusus untuk komunitas kami",
          expanded: "Tetap aman sebagai orang LGBTQ+:\n\n• Selektif tentang siapa yang tahu tentang pengaturan Anda\n• Pertimbangkan pengaturan privasi dengan hati-hati\n• Waspadai hukum dan sikap lokal\n• Miliki strategi keluar jika Anda merasa tidak aman\n• Terhubung dengan sumber daya LGBTQ+ di daerah Anda\n• Percaya pada komunitas Anda - kami di sini untuk saling mendukung"
        },
        legalProtection: {
          title: "Perlindungan Hukum",
          description: "Pertimbangkan perjanjian formal untuk pernikahan lavender",
          expanded: "Lindungi diri Anda secara hukum:\n\n• Konsultasikan dengan pengacara keluarga yang ramah LGBTQ+\n• Pertimbangkan perjanjian pranikah\n• Dokumentasikan pengaturan Anda secara tertulis\n• Pahami implikasi imigrasi jika berlaku\n• Ketahui hak Anda terkait properti dan keuangan\n• Jaga perjanjian tetap rahasia dan aman"
        },
        mentalHealth: {
          title: "Kesehatan Mental",
          description: "Jaga kesejahteraan emosional Anda",
          expanded: "Prioritaskan kesehatan mental Anda:\n\n• Tetapkan batasan dan ekspektasi yang jelas\n• Berkomunikasi secara terbuka dan jujur\n• Cari terapi atau konseling jika diperlukan\n• Terhubung dengan kelompok dukungan LGBTQ+\n• Ingat bahwa Anda layak mendapat rasa hormat dan kebaikan\n• Ambil istirahat dari aplikasi saat diperlukan"
        },
        reportBlock: {
          title: "Laporkan & Blokir",
          description: "Gunakan alat keamanan kami untuk melindungi diri Anda",
          expanded: "Tetap aman di Accord:\n\n• Blokir pengguna yang membuat Anda tidak nyaman\n• Laporkan pelecehan, ancaman, atau perilaku mencurigakan\n• Kami meninjau semua laporan dalam 24 jam\n• Laporan Anda anonim\n• Pelanggaran serius mengakibatkan penghentian akun\n• Hubungi kami langsung untuk masalah keamanan mendesak"
        }
      },
      resources: {
        trevor: { name: "The Trevor Project", description: "Dukungan krisis 24/7 untuk pemuda LGBTQ+" },
        transLifeline: { name: "Trans Lifeline", description: "Dukungan untuk orang transgender" },
        glbtHotline: { name: "LGBT National Hotline", description: "Dukungan sesama dan sumber daya lokal" },
        rainn: { name: "RAINN", description: "Dukungan kekerasan seksual" }
      }
    }
  },
  it: {
    safetyCenter: {
      title: "Centro Sicurezza",
      subtitle: "Resta al sicuro su Accord",
      safetyTipsTitle: "Consigli di Sicurezza",
      crisisResourcesTitle: "Risorse di Crisi",
      crisisResourcesDescription: "Se tu o qualcuno che conosci è in pericolo, contatta queste risorse.",
      visitWebsite: "Visita il sito",
      quickActionsTitle: "Azioni Rapide",
      footerText: "La tua sicurezza è la nostra massima priorità. Se ti senti in pericolo, non esitare a contattarci o a utilizzare le risorse sopra.",
      alerts: {
        callTitle: "Chiama {{name}}",
        callMessage: "Vuoi chiamare {{phone}}?",
        call: "Chiama",
        emailUs: "Scrivici a hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "Utenti Bloccati",
        blockedUsersDesc: "Gestisci la tua lista di utenti bloccati",
        privacySettings: "Impostazioni Privacy",
        privacySettingsDesc: "Controlla la tua privacy e visibilità",
        contactSupport: "Contatta il Supporto",
        contactSupportDesc: "Segnala problemi di sicurezza al nostro team"
      },
      tips: {
        meetSafely: {
          title: "Incontrarsi in Sicurezza",
          description: "Incontratevi sempre in luoghi pubblici per i primi appuntamenti",
          expanded: "Quando incontri qualcuno per la prima volta:\n\n• Scegli un luogo pubblico come un caffè, ristorante o parco\n• Informa un amico o familiare dove stai andando\n• Condividi la tua posizione con qualcuno di fiducia\n• Organizza il tuo trasporto\n• Resta sobrio e attento\n• Fidati del tuo istinto - se qualcosa non va, vattene"
        },
        protectInfo: {
          title: "Proteggi le tue Informazioni",
          description: "Mantieni privati i dati personali finché non si stabilisce fiducia",
          expanded: "Proteggiti online:\n\n• Non condividere indirizzo di casa, posto di lavoro o informazioni finanziarie\n• Sii cauto nel condividere il numero di telefono\n• Evita di condividere dettagli identificativi troppo presto\n• Usa la messaggistica in-app di Accord finché non ti senti a tuo agio\n• Non inviare mai denaro a qualcuno che non hai incontrato\n• Diffida di chiunque chieda aiuto finanziario"
        },
        verifyIdentity: {
          title: "Verifica l'Identità",
          description: "Usa videochiamate prima di incontrarvi di persona",
          expanded: "Verifica di parlare con una persona reale:\n\n• Richiedi una videochiamata prima dell'incontro\n• Cerca profili verificati (spunta blu)\n• Sii cauto con profili che hanno solo una foto\n• Fai attenzione a incongruenze nella loro storia\n• Fai una ricerca inversa dell'immagine se sospetti\n• Segnala immediatamente profili falsi o sospetti"
        },
        lgbtqSafety: {
          title: "Sicurezza LGBTQ+",
          description: "Considerazioni di sicurezza specifiche per la nostra comunità",
          expanded: "Restare al sicuro come persona LGBTQ+:\n\n• Sii selettivo su chi conosce il tuo accordo\n• Considera attentamente le impostazioni privacy\n• Sii consapevole delle leggi e degli atteggiamenti locali\n• Abbi una strategia di uscita se ti senti insicuro\n• Connettiti con risorse LGBTQ+ nella tua zona\n• Fidati della tua comunità - siamo qui per sostenerci a vicenda"
        },
        legalProtection: {
          title: "Protezione Legale",
          description: "Considera accordi formali per matrimoni lavanda",
          expanded: "Proteggiti legalmente:\n\n• Consulta un avvocato di famiglia amico degli LGBTQ+\n• Considera un accordo prematrimoniale\n• Documenta il tuo accordo per iscritto\n• Comprendi le implicazioni sull'immigrazione se applicabile\n• Conosci i tuoi diritti riguardo proprietà e finanze\n• Mantieni gli accordi confidenziali e sicuri"
        },
        mentalHealth: {
          title: "Salute Mentale",
          description: "Prenditi cura del tuo benessere emotivo",
          expanded: "Dai priorità alla tua salute mentale:\n\n• Stabilisci confini e aspettative chiare\n• Comunica apertamente e onestamente\n• Cerca terapia o consulenza se necessario\n• Connettiti con gruppi di supporto LGBTQ+\n• Ricorda che meriti rispetto e gentilezza\n• Prenditi pause dall'app quando necessario"
        },
        reportBlock: {
          title: "Segnala e Blocca",
          description: "Usa i nostri strumenti di sicurezza per proteggerti",
          expanded: "Resta al sicuro su Accord:\n\n• Blocca gli utenti che ti mettono a disagio\n• Segnala molestie, minacce o comportamenti sospetti\n• Esaminiamo tutte le segnalazioni entro 24 ore\n• Le tue segnalazioni sono anonime\n• Le violazioni gravi comportano la chiusura dell'account\n• Contattaci direttamente per urgenze di sicurezza"
        }
      },
      resources: {
        trevor: { name: "The Trevor Project", description: "Supporto in crisi 24/7 per giovani LGBTQ+" },
        transLifeline: { name: "Trans Lifeline", description: "Supporto per persone transgender" },
        glbtHotline: { name: "LGBT National Hotline", description: "Supporto tra pari e risorse locali" },
        rainn: { name: "RAINN", description: "Supporto per aggressione sessuale" }
      }
    }
  },
  ka: {
    safetyCenter: {
      title: "უსაფრთხოების ცენტრი",
      subtitle: "დარჩით უსაფრთხოდ Accord-ზე",
      safetyTipsTitle: "უსაფრთხოების რჩევები",
      crisisResourcesTitle: "კრიზისული რესურსები",
      crisisResourcesDescription: "თუ თქვენ ან ვინმე, ვინც იცნობთ, საფრთხეშია, გთხოვთ მიმართოთ ამ რესურსებს.",
      visitWebsite: "ეწვიეთ ვებსაიტს",
      quickActionsTitle: "სწრაფი მოქმედებები",
      footerText: "თქვენი უსაფრთხოება ჩვენი უმთავრესი პრიორიტეტია. თუ ოდესმე თავს არაუსაფრთხოდ იგრძნობთ, ნუ მოგერიდებათ დაგვიკავშირდეთ ან ზემოთ მოცემულ რესურსებს.",
      alerts: {
        callTitle: "დარეკვა {{name}}-ს",
        callMessage: "გსურთ დარეკვა {{phone}}-ზე?",
        call: "დარეკვა",
        emailUs: "მოგვწერეთ hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "დაბლოკილი მომხმარებლები",
        blockedUsersDesc: "მართეთ დაბლოკილი მომხმარებლების სია",
        privacySettings: "კონფიდენციალურობის პარამეტრები",
        privacySettingsDesc: "აკონტროლეთ თქვენი კონფიდენციალურობა და ხილვადობა",
        contactSupport: "დაუკავშირდით მხარდაჭერას",
        contactSupportDesc: "შეატყობინეთ უსაფრთხოების შეშფოთებები ჩვენს გუნდს"
      },
      tips: {
        meetSafely: {
          title: "შეხვდით უსაფრთხოდ",
          description: "პირველ რამდენიმე პაემანზე ყოველთვის საჯარო ადგილებში შეხვდით",
          expanded: "როცა ვინმეს პირველად ხვდებით:\n\n• აირჩიეთ საჯარო ადგილი, როგორიცაა კაფე, რესტორანი ან პარკი\n• უთხარით მეგობარს ან ოჯახის წევრს სად მიდიხართ\n• გაუზიარეთ თქვენი მდებარეობა სანდო ადამიანს\n• თავად მოაწყვეთ ტრანსპორტი\n• იყავით ფხიზლად და ყურადღებით\n• ენდეთ ინსტინქტს - თუ რაღაც არასწორად მოგეჩვენათ, წადით"
        },
        protectInfo: {
          title: "დაიცავით თქვენი ინფორმაცია",
          description: "შეინახეთ პირადი დეტალები კონფიდენციალურად ნდობის ჩამოყალიბებამდე",
          expanded: "დაიცავით თავი ონლაინ:\n\n• არ გაუზიაროთ სახლის მისამართი, სამუშაო ადგილი ან ფინანსური ინფორმაცია\n• ფრთხილად იყავით ტელეფონის ნომრის გაზიარებისას\n• მოერიდეთ იდენტიფიკაციის დეტალების ადრე გაზიარებას\n• გამოიყენეთ Accord-ის აპში შეტყობინებები სანამ კომფორტულად არ იგრძნობთ\n• არასოდეს გაუგზავნოთ ფული ვინმეს, ვისაც არ შეხვედრიხართ\n• ფრთხილად იყავით მათთან, ვინც ფინანსურ დახმარებას ითხოვს"
        },
        verifyIdentity: {
          title: "დაადასტურეთ ვინაობა",
          description: "გამოიყენეთ ვიდეოზარი პირადად შეხვედრამდე",
          expanded: "დაადასტურეთ, რომ ნამდვილ ადამიანთან საუბრობთ:\n\n• მოითხოვეთ ვიდეოზარი შეხვედრამდე\n• მოძებნეთ ვერიფიცირებული პროფილები (ლურჯი ნიშანი)\n• ფრთხილად იყავით მხოლოდ ერთი ფოტოს მქონე პროფილებთან\n• ყურადღება მიაქციეთ შეუსაბამობებს მათ ისტორიაში\n• ეჭვის შემთხვევაში გააკეთეთ სურათის საპირისპირო ძებნა\n• დაუყოვნებლივ შეატყობინეთ ყალბი ან საეჭვო პროფილების შესახებ"
        },
        lgbtqSafety: {
          title: "LGBTQ+ უსაფრთხოება",
          description: "ჩვენი საზოგადოებისთვის სპეციფიკური უსაფრთხოების გათვალისწინება",
          expanded: "LGBTQ+ ადამიანად უსაფრთხოდ ყოფნა:\n\n• შერჩევით მიუდექით, ვინ იცის თქვენი მოწყობის შესახებ\n• ფრთხილად განიხილეთ კონფიდენციალურობის პარამეტრები\n• იყავით ინფორმირებული ადგილობრივი კანონებისა და დამოკიდებულებების შესახებ\n• გქონდეთ გასვლის სტრატეგია, თუ თავს არაუსაფრთხოდ იგრძნობთ\n• დაუკავშირდით LGBTQ+ რესურსებს თქვენს რეგიონში\n• ენდეთ თქვენს საზოგადოებას - ჩვენ ერთმანეთის მხარდაჭერისთვის ვართ აქ"
        },
        legalProtection: {
          title: "სამართლებრივი დაცვა",
          description: "განიხილეთ ფორმალური შეთანხმებები ლავანდის ქორწინებისთვის",
          expanded: "დაიცავით თავი სამართლებრივად:\n\n• გაიარეთ კონსულტაცია LGBTQ+-მეგობრულ საოჯახო ადვოკატთან\n• განიხილეთ ქორწინებამდელი შეთანხმება\n• წერილობით დააფიქსირეთ თქვენი მოწყობა\n• გაიგეთ იმიგრაციის შედეგები, თუ ეს შესაბამისია\n• იცოდეთ თქვენი უფლებები ქონებისა და ფინანსების შესახებ\n• შეინახეთ შეთანხმებები კონფიდენციალურად და უსაფრთხოდ"
        },
        mentalHealth: {
          title: "ფსიქიკური ჯანმრთელობა",
          description: "იზრუნეთ თქვენს ემოციურ კეთილდღეობაზე",
          expanded: "პრიორიტეტი მიანიჭეთ ფსიქიკურ ჯანმრთელობას:\n\n• დაადგინეთ მკაფიო საზღვრები და მოლოდინები\n• ურთიერთობა იყოს ღია და პატიოსანი\n• საჭიროების შემთხვევაში მიმართეთ თერაპიას ან კონსულტაციას\n• დაუკავშირდით LGBTQ+ მხარდაჭერის ჯგუფებს\n• გახსოვდეთ, რომ იმსახურებთ პატივისცემასა და სიკეთეს\n• საჭიროებისამებრ შეისვენეთ აპლიკაციიდან"
        },
        reportBlock: {
          title: "შეატყობინეთ და დაბლოკეთ",
          description: "გამოიყენეთ ჩვენი უსაფრთხოების ინსტრუმენტები თავდაცვისთვის",
          expanded: "დარჩით უსაფრთხოდ Accord-ზე:\n\n• დაბლოკეთ მომხმარებლები, რომლებიც არაკომფორტულად გაგრძნობინებენ\n• შეატყობინეთ შევიწროება, მუქარა ან საეჭვო ქცევა\n• ჩვენ ვიხილავთ ყველა შეტყობინებას 24 საათის განმავლობაში\n• თქვენი შეტყობინებები ანონიმურია\n• სერიოზული დარღვევები იწვევს ანგარიშის გაუქმებას\n• გადაუდებელი უსაფრთხოების საკითხებისთვის პირდაპირ დაგვიკავშირდით"
        }
      },
      resources: {
        trevor: { name: "The Trevor Project", description: "24/7 კრიზისული მხარდაჭერა LGBTQ+ ახალგაზრდებისთვის" },
        transLifeline: { name: "Trans Lifeline", description: "მხარდაჭერა ტრანსგენდერი ადამიანებისთვის" },
        glbtHotline: { name: "LGBT ეროვნული ცხელი ხაზი", description: "თანატოლების მხარდაჭერა და ადგილობრივი რესურსები" },
        rainn: { name: "RAINN", description: "სექსუალური ძალადობის მხარდაჭერა" }
      }
    }
  },
  pl: {
    safetyCenter: {
      title: "Centrum Bezpieczeństwa",
      subtitle: "Bądź bezpieczny na Accord",
      safetyTipsTitle: "Wskazówki Bezpieczeństwa",
      crisisResourcesTitle: "Zasoby Kryzysowe",
      crisisResourcesDescription: "Jeśli Ty lub ktoś, kogo znasz, jest w niebezpieczeństwie, skontaktuj się z tymi zasobami.",
      visitWebsite: "Odwiedź stronę",
      quickActionsTitle: "Szybkie Akcje",
      footerText: "Twoje bezpieczeństwo jest naszym najwyższym priorytetem. Jeśli kiedykolwiek poczujesz się niebezpiecznie, nie wahaj się skontaktować z nami lub powyższymi zasobami.",
      alerts: {
        callTitle: "Zadzwoń do {{name}}",
        callMessage: "Czy chcesz zadzwonić pod {{phone}}?",
        call: "Zadzwoń",
        emailUs: "Napisz do nas na hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "Zablokowani Użytkownicy",
        blockedUsersDesc: "Zarządzaj listą zablokowanych użytkowników",
        privacySettings: "Ustawienia Prywatności",
        privacySettingsDesc: "Kontroluj swoją prywatność i widoczność",
        contactSupport: "Skontaktuj się z Pomocą",
        contactSupportDesc: "Zgłoś problemy bezpieczeństwa naszemu zespołowi"
      },
      tips: {
        meetSafely: {
          title: "Bezpieczne Spotkania",
          description: "Zawsze spotykaj się w miejscach publicznych na pierwszych randkach",
          expanded: "Gdy spotykasz kogoś po raz pierwszy:\n\n• Wybierz miejsce publiczne, takie jak kawiarnia, restauracja lub park\n• Powiedz przyjacielowi lub członkowi rodziny, dokąd idziesz\n• Udostępnij swoją lokalizację komuś zaufanemu\n• Zorganizuj własny transport\n• Bądź trzeźwy i czujny\n• Ufaj instynktowi - jeśli coś czujesz nie tak, odejdź"
        },
        protectInfo: {
          title: "Chroń Swoje Informacje",
          description: "Zachowaj prywatność danych osobowych do momentu zbudowania zaufania",
          expanded: "Chroń się online:\n\n• Nie udostępniaj adresu domowego, miejsca pracy ani informacji finansowych\n• Bądź ostrożny przy udostępnianiu numeru telefonu\n• Unikaj udostępniania danych identyfikacyjnych zbyt wcześnie\n• Używaj wiadomości w aplikacji Accord, dopóki nie poczujesz się komfortowo\n• Nigdy nie wysyłaj pieniędzy komuś, kogo nie spotkałeś\n• Uważaj na każdego, kto prosi o pomoc finansową"
        },
        verifyIdentity: {
          title: "Zweryfikuj Tożsamość",
          description: "Użyj połączeń wideo przed spotkaniem osobiście",
          expanded: "Upewnij się, że rozmawiasz z prawdziwą osobą:\n\n• Poproś o rozmowę wideo przed spotkaniem\n• Szukaj zweryfikowanych profili (niebieska ptaszka)\n• Bądź ostrożny wobec profili z tylko jednym zdjęciem\n• Zwracaj uwagę na niespójności w ich historii\n• Wykonaj wyszukiwanie odwrotne obrazu, jeśli masz podejrzenia\n• Natychmiast zgłoś fałszywe lub podejrzane profile"
        },
        lgbtqSafety: {
          title: "Bezpieczeństwo LGBTQ+",
          description: "Specyficzne kwestie bezpieczeństwa dla naszej społeczności",
          expanded: "Bezpieczeństwo jako osoba LGBTQ+:\n\n• Bądź selektywny, kto wie o Twoim porozumieniu\n• Starannie rozważ ustawienia prywatności\n• Bądź świadomy lokalnych przepisów i postaw\n• Miej strategię wyjścia, jeśli poczujesz się niebezpiecznie\n• Połącz się z zasobami LGBTQ+ w swojej okolicy\n• Ufaj swojej społeczności - jesteśmy tu, by się wspierać"
        },
        legalProtection: {
          title: "Ochrona Prawna",
          description: "Rozważ formalne umowy dla małżeństw lawendowych",
          expanded: "Chroń się prawnie:\n\n• Skonsultuj się z prawnikiem rodzinnym przyjaznym LGBTQ+\n• Rozważ umowę przedmałżeńską\n• Udokumentuj swoje porozumienie na piśmie\n• Zrozum konsekwencje imigracyjne, jeśli dotyczy\n• Znaj swoje prawa dotyczące własności i finansów\n• Zachowaj umowy w poufności i bezpieczeństwie"
        },
        mentalHealth: {
          title: "Zdrowie Psychiczne",
          description: "Zadbaj o swoje samopoczucie emocjonalne",
          expanded: "Priorytetyzuj swoje zdrowie psychiczne:\n\n• Ustal jasne granice i oczekiwania\n• Komunikuj się otwarcie i szczerze\n• Szukaj terapii lub poradnictwa, jeśli to potrzebne\n• Połącz się z grupami wsparcia LGBTQ+\n• Pamiętaj, że zasługujesz na szacunek i życzliwość\n• Rób przerwy od aplikacji, gdy to potrzebne"
        },
        reportBlock: {
          title: "Zgłoś i Zablokuj",
          description: "Użyj naszych narzędzi bezpieczeństwa, by się chronić",
          expanded: "Bądź bezpieczny na Accord:\n\n• Blokuj użytkowników, którzy sprawiają, że czujesz się niekomfortowo\n• Zgłaszaj nękanie, groźby lub podejrzane zachowania\n• Przeglądamy wszystkie zgłoszenia w ciągu 24 godzin\n• Twoje zgłoszenia są anonimowe\n• Poważne naruszenia skutkują usunięciem konta\n• Skontaktuj się z nami bezpośrednio w pilnych sprawach bezpieczeństwa"
        }
      },
      resources: {
        trevor: { name: "The Trevor Project", description: "Wsparcie kryzysowe 24/7 dla młodzieży LGBTQ+" },
        transLifeline: { name: "Trans Lifeline", description: "Wsparcie dla osób transpłciowych" },
        glbtHotline: { name: "LGBT National Hotline", description: "Wsparcie rówieśnicze i lokalne zasoby" },
        rainn: { name: "RAINN", description: "Wsparcie dla ofiar przemocy seksualnej" }
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

console.log('Done! Added safetyCenter to 6 locales (batch 2)');
