/**
 * Adds privacySettings translations to locales: ar, bn, de, es, fa, fr
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
  ar: {
    privacySettings: {
      title: "إعدادات الخصوصية",
      loading: "جارٍ تحميل الإعدادات...",
      infoBannerTitle: "خصوصيتك مهمة",
      infoBannerText: "تحكم في كيفية رؤية الآخرين لك على أكورد. التغييرات تسري فورًا.",
      sections: {
        profileVisibility: "ظهور الملف الشخصي",
        verification: "التحقق",
        activityPrivacy: "خصوصية النشاط",
        location: "الموقع"
      },
      photoBlur: {
        title: "تمويه الصور",
        description: "قم بتمويه صورك حتى تتطابق مع شخص ما"
      },
      incognitoMode: {
        title: "وضع التخفي",
        description: "أخفِ ملفك الشخصي من الاكتشاف. فقط المستخدمون المتطابقون يمكنهم رؤيتك.",
        requiresPremium: " يتطلب الاشتراك المميز."
      },
      hideLastActive: {
        title: "إخفاء آخر نشاط",
        description: "لا تُظهر متى كنت نشطًا آخر مرة على أكورد"
      },
      hideDistance: {
        title: "إخفاء المسافة الدقيقة",
        description: "إظهار المدينة/البلد فقط، إخفاء المسافة الدقيقة عن الآخرين",
        warning: "سيرى الآخرون مدينتك/بلدك ولكن ليس مسافتك الدقيقة. لا يزال بإمكانك تصفية المطابقات حسب المسافة."
      },
      location: {
        title: "تحديث الموقع",
        description: "استخدم GPS أو ابحث عن مدينتك لتحديد موقعك",
        current: "الحالي: {{location}}",
        useGps: "استخدام GPS",
        searchCity: "البحث عن مدينة",
        searchPlaceholder: "ابحث عن مدينة أو بلد...",
        noCitiesFound: "لم يتم العثور على مدن"
      },
      tips: {
        title: "نصائح الخصوصية",
        encrypted: "جميع الرسائل مشفرة من طرف إلى طرف بشكل افتراضي",
        blocked: "المستخدمون المحظورون لا يمكنهم رؤية ملفك الشخصي أو مراسلتك",
        namePrivacy: "اسمك الحقيقي ومعلومات الاتصال لا تتم مشاركتها أبدًا",
        deleteAccount: "يمكنك حذف حسابك وبياناتك في أي وقت"
      },
      legal: {
        privacyPolicy: "سياسة الخصوصية",
        termsOfService: "شروط الخدمة"
      },
      alerts: {
        loadError: "فشل تحميل إعدادات الخصوصية",
        updateError: "فشل تحديث إعداد الخصوصية. يرجى المحاولة مرة أخرى.",
        permissionDenied: "تم رفض الإذن",
        permissionDeniedMessage: "إذن الموقع مطلوب لتحديث موقعك. يمكنك تفعيله في إعدادات جهازك.",
        preciseLocationRequired: "الموقع الدقيق مطلوب",
        preciseLocationMessage: "دقة الموقع منخفضة جدًا ({{accuracy}} متر). يرجى تفعيل \"الموقع الدقيق\" لتطبيق أكورد في إعدادات iPhone:\n\n1. افتح الإعدادات\n2. انتقل إلى أكورد\n3. اضغط على الموقع\n4. فعّل \"الموقع الدقيق\"\n\nهذا يضمن حسابات مسافة دقيقة للمطابقة.",
        openSettings: "فتح الإعدادات",
        locationSuccess: "تم تحديث الموقع إلى {{location}}",
        locationSuccessGeneric: "تم تحديث موقعك!",
        locationError: "فشل تحديث الموقع. يرجى المحاولة مرة أخرى."
      }
    }
  },
  bn: {
    privacySettings: {
      title: "গোপনীয়তা সেটিংস",
      loading: "সেটিংস লোড হচ্ছে...",
      infoBannerTitle: "আপনার গোপনীয়তা গুরুত্বপূর্ণ",
      infoBannerText: "অ্যাকর্ডে অন্যরা আপনাকে কীভাবে দেখে তা নিয়ন্ত্রণ করুন। পরিবর্তনগুলি অবিলম্বে কার্যকর হয়।",
      sections: {
        profileVisibility: "প্রোফাইল দৃশ্যমানতা",
        verification: "যাচাইকরণ",
        activityPrivacy: "কার্যকলাপের গোপনীয়তা",
        location: "অবস্থান"
      },
      photoBlur: {
        title: "ছবি ব্লার",
        description: "কারো সাথে ম্যাচ না হওয়া পর্যন্ত আপনার ছবি ব্লার করুন"
      },
      incognitoMode: {
        title: "ইনকগনিটো মোড",
        description: "আবিষ্কার থেকে আপনার প্রোফাইল লুকান। শুধুমাত্র ম্যাচ করা ব্যবহারকারীরা আপনাকে দেখতে পারবে।",
        requiresPremium: " প্রিমিয়াম প্রয়োজন।"
      },
      hideLastActive: {
        title: "শেষ সক্রিয় লুকান",
        description: "অ্যাকর্ডে আপনি সর্বশেষ কখন সক্রিয় ছিলেন তা দেখাবেন না"
      },
      hideDistance: {
        title: "সঠিক দূরত্ব লুকান",
        description: "শুধুমাত্র শহর/দেশ দেখান, অন্যদের কাছ থেকে সঠিক দূরত্ব লুকান",
        warning: "অন্যরা আপনার শহর/দেশ দেখতে পাবে কিন্তু আপনার সঠিক দূরত্ব নয়। আপনি এখনও দূরত্ব অনুসারে ম্যাচ ফিল্টার করতে পারেন।"
      },
      location: {
        title: "অবস্থান আপডেট",
        description: "আপনার অবস্থান সেট করতে GPS ব্যবহার করুন বা আপনার শহর অনুসন্ধান করুন",
        current: "বর্তমান: {{location}}",
        useGps: "GPS ব্যবহার করুন",
        searchCity: "শহর অনুসন্ধান",
        searchPlaceholder: "শহর বা দেশ অনুসন্ধান করুন...",
        noCitiesFound: "কোনো শহর পাওয়া যায়নি"
      },
      tips: {
        title: "গোপনীয়তা টিপস",
        encrypted: "সমস্ত বার্তা ডিফল্টভাবে এন্ড-টু-এন্ড এনক্রিপ্টেড",
        blocked: "ব্লক করা ব্যবহারকারীরা আপনার প্রোফাইল দেখতে বা আপনাকে বার্তা পাঠাতে পারবে না",
        namePrivacy: "আপনার আসল নাম এবং যোগাযোগের তথ্য কখনো শেয়ার করা হয় না",
        deleteAccount: "আপনি যেকোনো সময় আপনার অ্যাকাউন্ট এবং ডেটা মুছে ফেলতে পারেন"
      },
      legal: {
        privacyPolicy: "গোপনীয়তা নীতি",
        termsOfService: "পরিষেবার শর্তাবলী"
      },
      alerts: {
        loadError: "গোপনীয়তা সেটিংস লোড করতে ব্যর্থ",
        updateError: "গোপনীয়তা সেটিং আপডেট করতে ব্যর্থ। অনুগ্রহ করে আবার চেষ্টা করুন।",
        permissionDenied: "অনুমতি প্রত্যাখ্যান",
        permissionDeniedMessage: "আপনার অবস্থান আপডেট করতে অবস্থানের অনুমতি প্রয়োজন। আপনি আপনার ডিভাইস সেটিংসে এটি সক্ষম করতে পারেন।",
        preciseLocationRequired: "সুনির্দিষ্ট অবস্থান প্রয়োজন",
        preciseLocationMessage: "অবস্থানের নির্ভুলতা খুব কম ({{accuracy}} মিটার)। অনুগ্রহ করে আপনার iPhone সেটিংসে অ্যাকর্ডের জন্য \"সুনির্দিষ্ট অবস্থান\" সক্ষম করুন:\n\n1. সেটিংস খুলুন\n2. অ্যাকর্ডে স্ক্রোল করুন\n3. অবস্থানে ট্যাপ করুন\n4. \"সুনির্দিষ্ট অবস্থান\" সক্ষম করুন\n\nএটি ম্যাচিংয়ের জন্য সঠিক দূরত্ব গণনা নিশ্চিত করে।",
        openSettings: "সেটিংস খুলুন",
        locationSuccess: "অবস্থান {{location}}-এ আপডেট হয়েছে",
        locationSuccessGeneric: "আপনার অবস্থান আপডেট হয়েছে!",
        locationError: "অবস্থান আপডেট করতে ব্যর্থ। অনুগ্রহ করে আবার চেষ্টা করুন।"
      }
    }
  },
  de: {
    privacySettings: {
      title: "Datenschutzeinstellungen",
      loading: "Einstellungen werden geladen...",
      infoBannerTitle: "Deine Privatsphäre ist wichtig",
      infoBannerText: "Kontrolliere, wie andere dich auf Accord sehen. Änderungen werden sofort wirksam.",
      sections: {
        profileVisibility: "Profilsichtbarkeit",
        verification: "Verifizierung",
        activityPrivacy: "Aktivitätsprivatsphäre",
        location: "Standort"
      },
      photoBlur: {
        title: "Foto-Unschärfe",
        description: "Mache deine Fotos unscharf, bis du ein Match hast"
      },
      incognitoMode: {
        title: "Inkognito-Modus",
        description: "Verstecke dein Profil in der Entdeckung. Nur gematchte Nutzer können dich sehen.",
        requiresPremium: " Erfordert Premium."
      },
      hideLastActive: {
        title: "Letzte Aktivität verbergen",
        description: "Zeige nicht an, wann du zuletzt auf Accord aktiv warst"
      },
      hideDistance: {
        title: "Genaue Entfernung verbergen",
        description: "Zeige nur Stadt/Land an, verberge die genaue Entfernung vor anderen",
        warning: "Andere sehen deine Stadt/dein Land, aber nicht deine genaue Entfernung. Du kannst Matches weiterhin nach Entfernung filtern."
      },
      location: {
        title: "Standort aktualisieren",
        description: "Verwende GPS oder suche nach deiner Stadt, um deinen Standort festzulegen",
        current: "Aktuell: {{location}}",
        useGps: "GPS verwenden",
        searchCity: "Stadt suchen",
        searchPlaceholder: "Stadt oder Land suchen...",
        noCitiesFound: "Keine Städte gefunden"
      },
      tips: {
        title: "Datenschutztipps",
        encrypted: "Alle Nachrichten sind standardmäßig Ende-zu-Ende verschlüsselt",
        blocked: "Blockierte Nutzer können dein Profil nicht sehen oder dir Nachrichten senden",
        namePrivacy: "Dein richtiger Name und deine Kontaktdaten werden niemals geteilt",
        deleteAccount: "Du kannst dein Konto und deine Daten jederzeit löschen"
      },
      legal: {
        privacyPolicy: "Datenschutzrichtlinie",
        termsOfService: "Nutzungsbedingungen"
      },
      alerts: {
        loadError: "Datenschutzeinstellungen konnten nicht geladen werden",
        updateError: "Datenschutzeinstellung konnte nicht aktualisiert werden. Bitte versuche es erneut.",
        permissionDenied: "Berechtigung verweigert",
        permissionDeniedMessage: "Die Standortberechtigung wird benötigt, um deinen Standort zu aktualisieren. Du kannst sie in deinen Geräteeinstellungen aktivieren.",
        preciseLocationRequired: "Genauer Standort erforderlich",
        preciseLocationMessage: "Die Standortgenauigkeit ist zu niedrig ({{accuracy}} Meter). Bitte aktiviere \"Genauer Standort\" für Accord in deinen iPhone-Einstellungen:\n\n1. Öffne Einstellungen\n2. Scrolle zu Accord\n3. Tippe auf Standort\n4. Aktiviere \"Genauer Standort\"\n\nDies gewährleistet genaue Entfernungsberechnungen für das Matching.",
        openSettings: "Einstellungen öffnen",
        locationSuccess: "Standort auf {{location}} aktualisiert",
        locationSuccessGeneric: "Dein Standort wurde aktualisiert!",
        locationError: "Standort konnte nicht aktualisiert werden. Bitte versuche es erneut."
      }
    }
  },
  es: {
    privacySettings: {
      title: "Configuración de Privacidad",
      loading: "Cargando configuración...",
      infoBannerTitle: "Tu Privacidad Importa",
      infoBannerText: "Controla cómo te ven los demás en Accord. Los cambios surten efecto inmediatamente.",
      sections: {
        profileVisibility: "Visibilidad del Perfil",
        verification: "Verificación",
        activityPrivacy: "Privacidad de Actividad",
        location: "Ubicación"
      },
      photoBlur: {
        title: "Desenfoque de Fotos",
        description: "Desenfoca tus fotos hasta que hagas match con alguien"
      },
      incognitoMode: {
        title: "Modo Incógnito",
        description: "Oculta tu perfil del descubrimiento. Solo los usuarios con match pueden verte.",
        requiresPremium: " Requiere Premium."
      },
      hideLastActive: {
        title: "Ocultar Última Actividad",
        description: "No mostrar cuándo estuviste activo por última vez en Accord"
      },
      hideDistance: {
        title: "Ocultar Distancia Exacta",
        description: "Mostrar solo ciudad/país, ocultar la distancia precisa de otros",
        warning: "Otros verán tu ciudad/país pero no tu distancia exacta. Aún puedes filtrar matches por distancia."
      },
      location: {
        title: "Actualizar Ubicación",
        description: "Usa GPS o busca tu ciudad para establecer tu ubicación",
        current: "Actual: {{location}}",
        useGps: "Usar GPS",
        searchCity: "Buscar Ciudad",
        searchPlaceholder: "Buscar ciudad o país...",
        noCitiesFound: "No se encontraron ciudades"
      },
      tips: {
        title: "Consejos de Privacidad",
        encrypted: "Todos los mensajes están cifrados de extremo a extremo por defecto",
        blocked: "Los usuarios bloqueados no pueden ver tu perfil ni enviarte mensajes",
        namePrivacy: "Tu nombre real e información de contacto nunca se comparten",
        deleteAccount: "Puedes eliminar tu cuenta y datos en cualquier momento"
      },
      legal: {
        privacyPolicy: "Política de Privacidad",
        termsOfService: "Términos de Servicio"
      },
      alerts: {
        loadError: "Error al cargar la configuración de privacidad",
        updateError: "Error al actualizar la configuración de privacidad. Por favor, inténtalo de nuevo.",
        permissionDenied: "Permiso Denegado",
        permissionDeniedMessage: "Se requiere permiso de ubicación para actualizar tu ubicación. Puedes habilitarlo en la configuración de tu dispositivo.",
        preciseLocationRequired: "Ubicación Precisa Requerida",
        preciseLocationMessage: "La precisión de ubicación es demasiado baja ({{accuracy}} metros). Por favor, habilita \"Ubicación Precisa\" para Accord en la configuración de tu iPhone:\n\n1. Abre Configuración\n2. Desplázate hasta Accord\n3. Toca Ubicación\n4. Habilita \"Ubicación Precisa\"\n\nEsto garantiza cálculos de distancia precisos para el emparejamiento.",
        openSettings: "Abrir Configuración",
        locationSuccess: "Ubicación actualizada a {{location}}",
        locationSuccessGeneric: "¡Tu ubicación ha sido actualizada!",
        locationError: "Error al actualizar la ubicación. Por favor, inténtalo de nuevo."
      }
    }
  },
  fa: {
    privacySettings: {
      title: "تنظیمات حریم خصوصی",
      loading: "در حال بارگذاری تنظیمات...",
      infoBannerTitle: "حریم خصوصی شما مهم است",
      infoBannerText: "نحوه دیدن دیگران از شما در اکورد را کنترل کنید. تغییرات بلافاصله اعمال می‌شوند.",
      sections: {
        profileVisibility: "نمایش پروفایل",
        verification: "تأیید هویت",
        activityPrivacy: "حریم خصوصی فعالیت",
        location: "موقعیت مکانی"
      },
      photoBlur: {
        title: "تار کردن عکس",
        description: "عکس‌های خود را تا زمان مچ شدن با کسی تار کنید"
      },
      incognitoMode: {
        title: "حالت ناشناس",
        description: "پروفایل خود را از کاوش پنهان کنید. فقط کاربران مچ شده می‌توانند شما را ببینند.",
        requiresPremium: " نیاز به اشتراک ویژه دارد."
      },
      hideLastActive: {
        title: "پنهان کردن آخرین فعالیت",
        description: "نشان ندهید آخرین بار چه زمانی در اکورد فعال بودید"
      },
      hideDistance: {
        title: "پنهان کردن فاصله دقیق",
        description: "فقط شهر/کشور نمایش داده شود، فاصله دقیق از دیگران پنهان شود",
        warning: "دیگران شهر/کشور شما را می‌بینند اما فاصله دقیق شما را نه. شما همچنان می‌توانید مچ‌ها را بر اساس فاصله فیلتر کنید."
      },
      location: {
        title: "به‌روزرسانی موقعیت",
        description: "از GPS استفاده کنید یا شهر خود را جستجو کنید تا موقعیت خود را تنظیم کنید",
        current: "فعلی: {{location}}",
        useGps: "استفاده از GPS",
        searchCity: "جستجوی شهر",
        searchPlaceholder: "جستجوی شهر یا کشور...",
        noCitiesFound: "هیچ شهری یافت نشد"
      },
      tips: {
        title: "نکات حریم خصوصی",
        encrypted: "تمام پیام‌ها به صورت پیش‌فرض رمزنگاری سرتاسری هستند",
        blocked: "کاربران مسدود شده نمی‌توانند پروفایل شما را ببینند یا به شما پیام بدهند",
        namePrivacy: "نام واقعی و اطلاعات تماس شما هرگز به اشتراک گذاشته نمی‌شود",
        deleteAccount: "می‌توانید حساب و داده‌های خود را در هر زمان حذف کنید"
      },
      legal: {
        privacyPolicy: "سیاست حریم خصوصی",
        termsOfService: "شرایط خدمات"
      },
      alerts: {
        loadError: "بارگذاری تنظیمات حریم خصوصی ناموفق بود",
        updateError: "به‌روزرسانی تنظیمات حریم خصوصی ناموفق بود. لطفاً دوباره تلاش کنید.",
        permissionDenied: "مجوز رد شد",
        permissionDeniedMessage: "برای به‌روزرسانی موقعیت شما، مجوز موقعیت مکانی لازم است. می‌توانید آن را در تنظیمات دستگاه خود فعال کنید.",
        preciseLocationRequired: "موقعیت دقیق مورد نیاز است",
        preciseLocationMessage: "دقت موقعیت مکانی بسیار پایین است ({{accuracy}} متر). لطفاً \"موقعیت دقیق\" را برای اکورد در تنظیمات iPhone خود فعال کنید:\n\n1. تنظیمات را باز کنید\n2. به اکورد بروید\n3. روی موقعیت مکانی ضربه بزنید\n4. \"موقعیت دقیق\" را فعال کنید\n\nاین محاسبات دقیق فاصله برای مچینگ را تضمین می‌کند.",
        openSettings: "باز کردن تنظیمات",
        locationSuccess: "موقعیت به {{location}} به‌روزرسانی شد",
        locationSuccessGeneric: "موقعیت شما به‌روزرسانی شد!",
        locationError: "به‌روزرسانی موقعیت ناموفق بود. لطفاً دوباره تلاش کنید."
      }
    }
  },
  fr: {
    privacySettings: {
      title: "Paramètres de Confidentialité",
      loading: "Chargement des paramètres...",
      infoBannerTitle: "Votre Vie Privée Compte",
      infoBannerText: "Contrôlez comment les autres vous voient sur Accord. Les modifications prennent effet immédiatement.",
      sections: {
        profileVisibility: "Visibilité du Profil",
        verification: "Vérification",
        activityPrivacy: "Confidentialité de l'Activité",
        location: "Localisation"
      },
      photoBlur: {
        title: "Flou des Photos",
        description: "Floutez vos photos jusqu'à ce que vous ayez un match"
      },
      incognitoMode: {
        title: "Mode Incognito",
        description: "Masquez votre profil de la découverte. Seuls les utilisateurs matchés peuvent vous voir.",
        requiresPremium: " Nécessite Premium."
      },
      hideLastActive: {
        title: "Masquer Dernière Activité",
        description: "Ne pas afficher quand vous étiez dernièrement actif sur Accord"
      },
      hideDistance: {
        title: "Masquer la Distance Exacte",
        description: "Afficher uniquement la ville/le pays, masquer la distance précise des autres",
        warning: "Les autres verront votre ville/pays mais pas votre distance exacte. Vous pouvez toujours filtrer les matchs par distance."
      },
      location: {
        title: "Mettre à Jour la Localisation",
        description: "Utilisez le GPS ou recherchez votre ville pour définir votre localisation",
        current: "Actuel : {{location}}",
        useGps: "Utiliser le GPS",
        searchCity: "Rechercher une Ville",
        searchPlaceholder: "Rechercher une ville ou un pays...",
        noCitiesFound: "Aucune ville trouvée"
      },
      tips: {
        title: "Conseils de Confidentialité",
        encrypted: "Tous les messages sont chiffrés de bout en bout par défaut",
        blocked: "Les utilisateurs bloqués ne peuvent pas voir votre profil ni vous envoyer de messages",
        namePrivacy: "Votre vrai nom et vos coordonnées ne sont jamais partagés",
        deleteAccount: "Vous pouvez supprimer votre compte et vos données à tout moment"
      },
      legal: {
        privacyPolicy: "Politique de Confidentialité",
        termsOfService: "Conditions d'Utilisation"
      },
      alerts: {
        loadError: "Impossible de charger les paramètres de confidentialité",
        updateError: "Impossible de mettre à jour le paramètre de confidentialité. Veuillez réessayer.",
        permissionDenied: "Permission Refusée",
        permissionDeniedMessage: "L'autorisation de localisation est nécessaire pour mettre à jour votre position. Vous pouvez l'activer dans les paramètres de votre appareil.",
        preciseLocationRequired: "Localisation Précise Requise",
        preciseLocationMessage: "La précision de la localisation est trop faible ({{accuracy}} mètres). Veuillez activer « Localisation Précise » pour Accord dans les réglages de votre iPhone :\n\n1. Ouvrez Réglages\n2. Faites défiler jusqu'à Accord\n3. Appuyez sur Localisation\n4. Activez « Localisation Précise »\n\nCela garantit des calculs de distance précis pour le matching.",
        openSettings: "Ouvrir les Réglages",
        locationSuccess: "Localisation mise à jour vers {{location}}",
        locationSuccessGeneric: "Votre localisation a été mise à jour !",
        locationError: "Impossible de mettre à jour la localisation. Veuillez réessayer."
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

console.log('Done! Added privacySettings to 6 locales (batch 1)');
