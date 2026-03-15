#!/usr/bin/env node
/**
 * Injects premiumPaywall translations into all locale files.
 * Run: node scripts/translate-paywall.js
 */

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'locales');

// Translations for each locale
const translations = {
  es: {
    premiumPaywall: {
      accordPremium: "Accord Premium",
      accordPlatinum: "Accord Platinum",
      platinum: "Platinum",
      subtitleSwipes: "Has usado tus 5 likes diarios.\n¡Actualiza para likes ilimitados!",
      subtitleFeature: "Desbloquea {{feature}} y todas las funciones premium",
      subtitleDefault: "Desbloquea la experiencia completa de Accord",
      threeMonths: "3 Meses",
      mostPopular: "MÁS POPULAR",
      annual: "Anual",
      bestValue: "MEJOR VALOR",
      monthly: "Mensual",
      save: "AHORRA {{percent}}",
      perMonth: "{{price}}/mes",
      subscribeNow: "Suscríbete Ahora",
      startTrial: "Comenzar {{trial}}",
      thenPrice: "Luego {{price}}/{{period}}",
      periodMonth: "mes",
      periodThreeMonths: "3 meses",
      periodYear: "año",
      restorePurchases: "Restaurar Compras",
      finePrint: "La suscripción se renueva automáticamente a menos que se cancele al menos 24 horas antes del final del período actual. El pago se carga a tu cuenta de Apple o Google. Administra en Configuración de Cuenta.",
      termsOfUse: "Términos de Uso",
      privacyPolicy: "Política de Privacidad",
      features: {
        unlimitedLikes: "Likes Ilimitados",
        unlimitedLikesDesc: "Pasa de 5 likes diarios a ilimitados",
        seeWhoLikedYou: "Ve Quién Te Dio Like",
        seeWhoLikedYouDesc: "Ve todos tus likes y haz match al instante",
        activityCenter: "Centro de Actividad",
        activityCenterDesc: "Ve quién vio tu perfil y más",
        advancedFilters: "Filtros Avanzados",
        advancedFiltersDesc: "Filtra por estilo de vida, metas y finanzas",
        incognitoMode: "Modo Incógnito",
        incognitoModeDesc: "Navega perfiles de forma privada sin ser visto",
        readReceipts: "Confirmación de Lectura",
        readReceiptsDesc: "Sabe cuándo se leen tus mensajes",
        typingIndicators: "Indicador de Escritura",
        typingIndicatorsDesc: "Ve cuando un match está escribiendo un mensaje",
        voiceMessages: "Mensajes de Voz",
        voiceMessagesDesc: "Envía y recibe notas de voz",
        rewind: "Rebobinar",
        rewindDesc: "Retracta tu último deslizamiento",
        superLikes: "5 Super Likes/Semana",
        superLikesDesc: "Hazte notar por tus mejores matches",
        backgroundCheck: "Verificación de Antecedentes",
        backgroundCheckDesc: "Verificaciones de antecedentes opcionales para tu tranquilidad (Próximamente)",
        legalResources: "Recursos Legales",
        legalResourcesDesc: "Plantillas de acuerdos prenupciales y directorio de abogados (Próximamente)",
        prioritySupport: "Soporte Prioritario",
        prioritySupportDesc: "Servicio al cliente prioritario 24/7",
        weeklyBoost: "Impulso Semanal de Perfil",
        weeklyBoostDesc: "Impulso de visibilidad de 30 minutos cada semana (Próximamente)"
      },
      alerts: {
        devModeTitle: "Modo de Desarrollo",
        devModeMessage: "RevenueCat no está configurado aún. Esto activaría una suscripción real en producción.\n\n¿Deseas habilitar el estado premium en la base de datos para pruebas?",
        cancel: "Cancelar",
        enablePremium: "Habilitar Premium",
        devOnlyTitle: "⚠️ Solo Desarrollo",
        devOnlyMessage: "En producción, esto procesaría un pago real a través de Apple/Google.\n\nPara probar funciones premium ahora:\n1. Ve a tu base de datos\n2. Establece is_premium = true para tu perfil\n3. Reinicia la app",
        errorLoadPlans: "No se pudieron cargar las opciones de suscripción. Inténtalo de nuevo.",
        subscriptionPackage: "Paquete de Suscripción",
        wouldYouLikeToSubscribe: "¿Te gustaría suscribirte a {{title}} por {{price}}?",
        subscribe: "Suscribirse",
        successTitle: "🎉 ¡Éxito!",
        welcomePremium: "¡Bienvenido a Accord Premium!",
        welcomePlatinum: "¡Bienvenido a Accord Platinum!",
        welcomeTier: "¡Bienvenido a Accord {{tier}}!",
        letsGo: "¡Vamos!",
        purchaseFailedTitle: "Compra Fallida",
        purchaseFailedMessage: "No se pudo completar la compra. Verifica tu método de pago e inténtalo de nuevo.",
        subscriptionExistsTitle: "La Suscripción Ya Existe",
        subscriptionExistsAndroid: "Tienes una suscripción cancelada en tu cuenta actual de Google Play.\n\nOpciones:\n\n1. Reactiva tu suscripción existente en Configuración de Google Play\n\n2. Usa una cuenta diferente de Google Play: Cierra sesión en Google Play en tu dispositivo, luego inicia sesión con una cuenta diferente e inténtalo de nuevo",
        subscriptionExistsIOS: "Tienes una suscripción cancelada en tu Apple ID actual.\n\nOpciones:\n\n1. Reactiva tu suscripción existente en Configuración de App Store\n\n2. Usa un Apple ID diferente: Cierra sesión en Configuración > [Tu Nombre], luego inicia sesión con un Apple ID diferente e inténtalo de nuevo",
        gotIt: "Entendido",
        openSettings: "Abrir Configuración",
        couldNotOpenManagement: "No se pudo abrir la gestión de suscripciones",
        productNotAvailable: "Esta suscripción no está disponible actualmente. Inténtalo más tarde.",
        networkError: "Error de red. Verifica tu conexión e inténtalo de nuevo.",
        purchaseErrorTitle: "Error de Compra",
        purchaseErrorMessage: "Algo salió mal. Inténtalo de nuevo o contacta soporte.",
        copyError: "Copiar Error",
        restoreSuccess: "¡Tus compras han sido restauradas!",
        restoreNoPurchases: "No pudimos encontrar compras para restaurar.",
        restoreFailed: "Error al restaurar compras. Inténtalo de nuevo.",
        packageNotFound: "Paquete de suscripción no encontrado. Inténtalo de nuevo."
      }
    }
  },
  fr: {
    premiumPaywall: {
      accordPremium: "Accord Premium",
      accordPlatinum: "Accord Platinum",
      platinum: "Platinum",
      subtitleSwipes: "Vous avez utilisé vos 5 likes quotidiens.\nPassez à la version supérieure pour des likes illimités !",
      subtitleFeature: "Débloquez {{feature}} et toutes les fonctionnalités premium",
      subtitleDefault: "Débloquez l'expérience complète Accord",
      threeMonths: "3 Mois",
      mostPopular: "PLUS POPULAIRE",
      annual: "Annuel",
      bestValue: "MEILLEURE OFFRE",
      monthly: "Mensuel",
      save: "ÉCONOMISEZ {{percent}}",
      perMonth: "{{price}}/mois",
      subscribeNow: "S'abonner Maintenant",
      startTrial: "Commencer {{trial}}",
      thenPrice: "Puis {{price}}/{{period}}",
      periodMonth: "mois",
      periodThreeMonths: "3 mois",
      periodYear: "an",
      restorePurchases: "Restaurer les Achats",
      finePrint: "L'abonnement se renouvelle automatiquement sauf annulation au moins 24 heures avant la fin de la période en cours. Le paiement est débité de votre compte Apple ou Google. Gérez dans les Paramètres du Compte.",
      termsOfUse: "Conditions d'Utilisation",
      privacyPolicy: "Politique de Confidentialité",
      features: {
        unlimitedLikes: "Likes Illimités",
        unlimitedLikesDesc: "Passez de 5 likes quotidiens à illimités",
        seeWhoLikedYou: "Voyez Qui Vous a Liké",
        seeWhoLikedYouDesc: "Voyez tous vos likes et matchez instantanément",
        activityCenter: "Centre d'Activité",
        activityCenterDesc: "Voyez qui a consulté votre profil et plus",
        advancedFilters: "Filtres Avancés",
        advancedFiltersDesc: "Filtrez par style de vie, objectifs et finances",
        incognitoMode: "Mode Incognito",
        incognitoModeDesc: "Parcourez les profils en privé sans être vu",
        readReceipts: "Accusés de Lecture",
        readReceiptsDesc: "Sachez quand vos messages sont lus",
        typingIndicators: "Indicateurs de Saisie",
        typingIndicatorsDesc: "Voyez quand un match est en train d'écrire",
        voiceMessages: "Messages Vocaux",
        voiceMessagesDesc: "Envoyez et recevez des notes vocales",
        rewind: "Rembobiner",
        rewindDesc: "Annulez votre dernier swipe",
        superLikes: "5 Super Likes/Semaine",
        superLikesDesc: "Faites-vous remarquer par vos meilleurs matchs",
        backgroundCheck: "Vérification d'Antécédents",
        backgroundCheckDesc: "Vérifications d'antécédents optionnelles pour votre tranquillité (Bientôt)",
        legalResources: "Ressources Juridiques",
        legalResourcesDesc: "Modèles de contrats de mariage et annuaire d'avocats (Bientôt)",
        prioritySupport: "Support Prioritaire",
        prioritySupportDesc: "Service client prioritaire 24/7",
        weeklyBoost: "Boost Hebdomadaire du Profil",
        weeklyBoostDesc: "Boost de visibilité de 30 minutes chaque semaine (Bientôt)"
      },
      alerts: {
        devModeTitle: "Mode Développement",
        devModeMessage: "RevenueCat n'est pas encore configuré. Cela activerait un abonnement réel en production.\n\nVoulez-vous activer le statut premium dans la base de données pour les tests ?",
        cancel: "Annuler",
        enablePremium: "Activer Premium",
        devOnlyTitle: "⚠️ Développement Uniquement",
        devOnlyMessage: "En production, cela traiterait un paiement réel via Apple/Google.\n\nPour tester les fonctionnalités premium :\n1. Allez dans votre base de données\n2. Définissez is_premium = true pour votre profil\n3. Redémarrez l'application",
        errorLoadPlans: "Impossible de charger les options d'abonnement. Veuillez réessayer.",
        subscriptionPackage: "Forfait d'Abonnement",
        wouldYouLikeToSubscribe: "Souhaitez-vous vous abonner à {{title}} pour {{price}} ?",
        subscribe: "S'abonner",
        successTitle: "🎉 Succès !",
        welcomePremium: "Bienvenue sur Accord Premium !",
        welcomePlatinum: "Bienvenue sur Accord Platinum !",
        welcomeTier: "Bienvenue sur Accord {{tier}} !",
        letsGo: "C'est Parti !",
        purchaseFailedTitle: "Achat Échoué",
        purchaseFailedMessage: "Impossible de finaliser l'achat. Vérifiez votre moyen de paiement et réessayez.",
        subscriptionExistsTitle: "Abonnement Existant",
        subscriptionExistsAndroid: "Vous avez un abonnement annulé sur votre compte Google Play actuel.\n\nOptions :\n\n1. Réactivez votre abonnement existant dans les Paramètres Google Play\n\n2. Utilisez un autre compte Google Play",
        subscriptionExistsIOS: "Vous avez un abonnement annulé sur votre Apple ID actuel.\n\nOptions :\n\n1. Réactivez votre abonnement existant dans les Paramètres App Store\n\n2. Utilisez un autre Apple ID",
        gotIt: "Compris",
        openSettings: "Ouvrir les Paramètres",
        couldNotOpenManagement: "Impossible d'ouvrir la gestion des abonnements",
        productNotAvailable: "Cet abonnement n'est pas disponible actuellement. Réessayez plus tard.",
        networkError: "Erreur réseau. Vérifiez votre connexion et réessayez.",
        purchaseErrorTitle: "Erreur d'Achat",
        purchaseErrorMessage: "Une erreur s'est produite. Réessayez ou contactez le support.",
        copyError: "Copier l'Erreur",
        restoreSuccess: "Vos achats ont été restaurés !",
        restoreNoPurchases: "Aucun achat trouvé à restaurer.",
        restoreFailed: "Échec de la restauration des achats. Réessayez.",
        packageNotFound: "Forfait d'abonnement introuvable. Réessayez."
      }
    }
  },
  de: {
    premiumPaywall: {
      accordPremium: "Accord Premium",
      accordPlatinum: "Accord Platinum",
      platinum: "Platinum",
      subtitleSwipes: "Du hast deine 5 täglichen Likes verbraucht.\nUpgrade für unbegrenzte Likes!",
      subtitleFeature: "Schalte {{feature}} und alle Premium-Funktionen frei",
      subtitleDefault: "Schalte das volle Accord-Erlebnis frei",
      threeMonths: "3 Monate",
      mostPopular: "BELIEBTESTE",
      annual: "Jährlich",
      bestValue: "BESTER WERT",
      monthly: "Monatlich",
      save: "SPARE {{percent}}",
      perMonth: "{{price}}/Monat",
      subscribeNow: "Jetzt Abonnieren",
      startTrial: "{{trial}} starten",
      thenPrice: "Dann {{price}}/{{period}}",
      periodMonth: "Monat",
      periodThreeMonths: "3 Monate",
      periodYear: "Jahr",
      restorePurchases: "Käufe Wiederherstellen",
      finePrint: "Das Abonnement verlängert sich automatisch, sofern es nicht mindestens 24 Stunden vor Ende des aktuellen Zeitraums gekündigt wird. Die Zahlung wird über Ihr Apple- oder Google-Konto abgerechnet.",
      termsOfUse: "Nutzungsbedingungen",
      privacyPolicy: "Datenschutzrichtlinie",
      features: {
        unlimitedLikes: "Unbegrenzte Likes",
        unlimitedLikesDesc: "Von 5 täglichen Likes auf unbegrenzt upgraden",
        seeWhoLikedYou: "Sieh, Wer Dich Geliked Hat",
        seeWhoLikedYouDesc: "Sieh alle deine Likes und matche sofort",
        activityCenter: "Aktivitätszentrum",
        activityCenterDesc: "Sieh, wer dein Profil angesehen hat und mehr",
        advancedFilters: "Erweiterte Filter",
        advancedFiltersDesc: "Filtere nach Lebensstil, Zielen und Finanzen",
        incognitoMode: "Inkognito-Modus",
        incognitoModeDesc: "Profile privat durchstöbern ohne gesehen zu werden",
        readReceipts: "Lesebestätigungen",
        readReceiptsDesc: "Wisse, wann deine Nachrichten gelesen werden",
        typingIndicators: "Tippenanzeige",
        typingIndicatorsDesc: "Sieh, wenn ein Match eine Nachricht tippt",
        voiceMessages: "Sprachnachrichten",
        voiceMessagesDesc: "Sende und empfange Sprachnotizen",
        rewind: "Zurückspulen",
        rewindDesc: "Mache deinen letzten Swipe rückgängig",
        superLikes: "5 Super Likes/Woche",
        superLikesDesc: "Werde von deinen besten Matches bemerkt",
        backgroundCheck: "Hintergrundprüfung",
        backgroundCheckDesc: "Optionale Hintergrundprüfungen für deine Sicherheit (Bald verfügbar)",
        legalResources: "Juristische Ressourcen",
        legalResourcesDesc: "Ehevertrag-Vorlagen und Anwaltsverzeichnis (Bald verfügbar)",
        prioritySupport: "Prioritäts-Support",
        prioritySupportDesc: "24/7 Prioritäts-Kundenservice",
        weeklyBoost: "Wöchentlicher Profil-Boost",
        weeklyBoostDesc: "30-minütiger Sichtbarkeits-Boost jede Woche (Bald verfügbar)"
      },
      alerts: {
        devModeTitle: "Entwicklungsmodus",
        devModeMessage: "RevenueCat ist noch nicht konfiguriert. Dies würde in der Produktion ein echtes Abonnement aktivieren.",
        cancel: "Abbrechen",
        enablePremium: "Premium Aktivieren",
        devOnlyTitle: "⚠️ Nur Entwicklung",
        devOnlyMessage: "In der Produktion würde dies eine echte Zahlung über Apple/Google verarbeiten.",
        errorLoadPlans: "Abonnementoptionen konnten nicht geladen werden. Bitte versuche es erneut.",
        subscriptionPackage: "Abonnement-Paket",
        wouldYouLikeToSubscribe: "Möchtest du {{title}} für {{price}} abonnieren?",
        subscribe: "Abonnieren",
        successTitle: "🎉 Erfolg!",
        welcomePremium: "Willkommen bei Accord Premium!",
        welcomePlatinum: "Willkommen bei Accord Platinum!",
        welcomeTier: "Willkommen bei Accord {{tier}}!",
        letsGo: "Los Geht's!",
        purchaseFailedTitle: "Kauf Fehlgeschlagen",
        purchaseFailedMessage: "Der Kauf konnte nicht abgeschlossen werden. Überprüfe deine Zahlungsmethode und versuche es erneut.",
        subscriptionExistsTitle: "Abonnement Bereits Vorhanden",
        subscriptionExistsAndroid: "Du hast ein gekündigtes Abonnement auf deinem aktuellen Google Play-Konto.\n\nOptionen:\n\n1. Reaktiviere dein bestehendes Abonnement in den Google Play-Einstellungen\n\n2. Verwende ein anderes Google Play-Konto",
        subscriptionExistsIOS: "Du hast ein gekündigtes Abonnement auf deiner aktuellen Apple-ID.\n\nOptionen:\n\n1. Reaktiviere dein bestehendes Abonnement in den App Store-Einstellungen\n\n2. Verwende eine andere Apple-ID",
        gotIt: "Verstanden",
        openSettings: "Einstellungen Öffnen",
        couldNotOpenManagement: "Abonnementverwaltung konnte nicht geöffnet werden",
        productNotAvailable: "Dieses Abonnement ist derzeit nicht verfügbar. Versuche es später erneut.",
        networkError: "Netzwerkfehler. Überprüfe deine Verbindung und versuche es erneut.",
        purchaseErrorTitle: "Kauffehler",
        purchaseErrorMessage: "Etwas ist schiefgelaufen. Versuche es erneut oder kontaktiere den Support.",
        copyError: "Fehler Kopieren",
        restoreSuccess: "Deine Käufe wurden wiederhergestellt!",
        restoreNoPurchases: "Es konnten keine Käufe zum Wiederherstellen gefunden werden.",
        restoreFailed: "Käufe konnten nicht wiederhergestellt werden. Versuche es erneut.",
        packageNotFound: "Abonnement-Paket nicht gefunden. Versuche es erneut."
      }
    }
  },
  ar: {
    premiumPaywall: {
      accordPremium: "Accord Premium",
      accordPlatinum: "Accord Platinum",
      platinum: "Platinum",
      subtitleSwipes: "لقد استخدمت إعجاباتك الخمسة اليومية.\nقم بالترقية للحصول على إعجابات غير محدودة!",
      subtitleFeature: "افتح {{feature}} وجميع الميزات المتميزة",
      subtitleDefault: "افتح تجربة Accord الكاملة",
      threeMonths: "3 أشهر",
      mostPopular: "الأكثر شعبية",
      annual: "سنوي",
      bestValue: "أفضل قيمة",
      monthly: "شهري",
      save: "وفر {{percent}}",
      perMonth: "{{price}}/شهر",
      subscribeNow: "اشترك الآن",
      startTrial: "ابدأ {{trial}}",
      thenPrice: "ثم {{price}}/{{period}}",
      periodMonth: "شهر",
      periodThreeMonths: "3 أشهر",
      periodYear: "سنة",
      restorePurchases: "استعادة المشتريات",
      finePrint: "يتجدد الاشتراك تلقائيًا ما لم يتم الإلغاء قبل 24 ساعة على الأقل من نهاية الفترة الحالية. يتم تحصيل الدفع من حساب Apple أو Google الخاص بك.",
      termsOfUse: "شروط الاستخدام",
      privacyPolicy: "سياسة الخصوصية",
      features: {
        unlimitedLikes: "إعجابات غير محدودة",
        unlimitedLikesDesc: "انتقل من 5 إعجابات يومية إلى غير محدودة",
        seeWhoLikedYou: "شاهد من أعجب بك",
        seeWhoLikedYouDesc: "شاهد جميع إعجاباتك وتطابق فوراً",
        activityCenter: "مركز النشاط",
        activityCenterDesc: "شاهد من زار ملفك الشخصي والمزيد",
        advancedFilters: "فلاتر متقدمة",
        advancedFiltersDesc: "فلتر حسب نمط الحياة والأهداف والمالية",
        incognitoMode: "وضع التخفي",
        incognitoModeDesc: "تصفح الملفات الشخصية بخصوصية دون أن يراك أحد",
        readReceipts: "إيصالات القراءة",
        readReceiptsDesc: "اعرف متى تُقرأ رسائلك",
        typingIndicators: "مؤشرات الكتابة",
        typingIndicatorsDesc: "شاهد عندما يكتب شخص متطابق رسالة",
        voiceMessages: "رسائل صوتية",
        voiceMessagesDesc: "أرسل واستقبل ملاحظات صوتية",
        rewind: "إرجاع",
        rewindDesc: "تراجع عن تمريرتك الأخيرة",
        superLikes: "5 سوبر لايك/أسبوع",
        superLikesDesc: "اجذب انتباه أفضل تطابقاتك",
        backgroundCheck: "فحص الخلفية",
        backgroundCheckDesc: "فحوصات خلفية اختيارية لراحة بالك (قريباً)",
        legalResources: "موارد قانونية",
        legalResourcesDesc: "نماذج اتفاقيات ما قبل الزواج ودليل المحامين (قريباً)",
        prioritySupport: "دعم أولوي",
        prioritySupportDesc: "خدمة عملاء أولوية على مدار الساعة",
        weeklyBoost: "تعزيز أسبوعي للملف",
        weeklyBoostDesc: "تعزيز الظهور لمدة 30 دقيقة كل أسبوع (قريباً)"
      },
      alerts: {
        devModeTitle: "وضع التطوير", devModeMessage: "RevenueCat غير مهيأ بعد.", cancel: "إلغاء", enablePremium: "تفعيل Premium",
        devOnlyTitle: "⚠️ للتطوير فقط", devOnlyMessage: "في الإنتاج، سيتم معالجة دفع حقيقي.",
        errorLoadPlans: "تعذر تحميل خيارات الاشتراك. يرجى المحاولة مرة أخرى.",
        subscriptionPackage: "حزمة الاشتراك", wouldYouLikeToSubscribe: "هل تريد الاشتراك في {{title}} مقابل {{price}}؟",
        subscribe: "اشترك", successTitle: "🎉 نجاح!", welcomePremium: "!مرحباً في Accord Premium",
        welcomePlatinum: "!مرحباً في Accord Platinum", welcomeTier: "!مرحباً في Accord {{tier}}", letsGo: "!هيا بنا",
        purchaseFailedTitle: "فشل الشراء", purchaseFailedMessage: "تعذر إتمام الشراء. تحقق من طريقة الدفع وحاول مرة أخرى.",
        subscriptionExistsTitle: "الاشتراك موجود بالفعل",
        subscriptionExistsAndroid: "لديك اشتراك ملغى على حساب Google Play الحالي.\n\n1. أعد تفعيل اشتراكك في إعدادات Google Play\n\n2. استخدم حساب Google Play مختلف",
        subscriptionExistsIOS: "لديك اشتراك ملغى على Apple ID الحالي.\n\n1. أعد تفعيل اشتراكك في إعدادات App Store\n\n2. استخدم Apple ID مختلف",
        gotIt: "فهمت", openSettings: "فتح الإعدادات", couldNotOpenManagement: "تعذر فتح إدارة الاشتراكات",
        productNotAvailable: "هذا الاشتراك غير متاح حالياً.", networkError: "خطأ في الشبكة. تحقق من اتصالك وحاول مرة أخرى.",
        purchaseErrorTitle: "خطأ في الشراء", purchaseErrorMessage: "حدث خطأ ما. حاول مرة أخرى أو اتصل بالدعم.",
        copyError: "نسخ الخطأ", restoreSuccess: "!تم استعادة مشترياتك", restoreNoPurchases: "لم نتمكن من العثور على مشتريات لاستعادتها.",
        restoreFailed: "فشل استعادة المشتريات. حاول مرة أخرى.", packageNotFound: "لم يتم العثور على حزمة الاشتراك."
      }
    }
  }
};

// For remaining languages, create compact translations
// These cover the core user-facing strings that drive purchases
const compactTranslations = {
  pt: { title: "Accord Premium", subtitleDefault: "Desbloqueie a experiência completa do Accord", threeMonths: "3 Meses", mostPopular: "MAIS POPULAR", annual: "Anual", bestValue: "MELHOR VALOR", monthly: "Mensal", save: "ECONOMIZE {{percent}}", subscribeNow: "Assinar Agora", restorePurchases: "Restaurar Compras", termsOfUse: "Termos de Uso", privacyPolicy: "Política de Privacidade" },
  it: { title: "Accord Premium", subtitleDefault: "Sblocca l'esperienza completa di Accord", threeMonths: "3 Mesi", mostPopular: "PIÙ POPOLARE", annual: "Annuale", bestValue: "MIGLIOR VALORE", monthly: "Mensile", save: "RISPARMIA {{percent}}", subscribeNow: "Abbonati Ora", restorePurchases: "Ripristina Acquisti", termsOfUse: "Termini di Utilizzo", privacyPolicy: "Informativa sulla Privacy" },
  tr: { title: "Accord Premium", subtitleDefault: "Tam Accord deneyiminin kilidini aç", threeMonths: "3 Ay", mostPopular: "EN POPÜLER", annual: "Yıllık", bestValue: "EN İYİ DEĞER", monthly: "Aylık", save: "{{percent}} TASARRUF", subscribeNow: "Şimdi Abone Ol", restorePurchases: "Satın Almaları Geri Yükle", termsOfUse: "Kullanım Şartları", privacyPolicy: "Gizlilik Politikası" },
  ru: { title: "Accord Premium", subtitleDefault: "Разблокируйте полный опыт Accord", threeMonths: "3 Месяца", mostPopular: "САМЫЙ ПОПУЛЯРНЫЙ", annual: "Годовой", bestValue: "ЛУЧШЕЕ ПРЕДЛОЖЕНИЕ", monthly: "Месячный", save: "СКИДКА {{percent}}", subscribeNow: "Подписаться", restorePurchases: "Восстановить Покупки", termsOfUse: "Условия Использования", privacyPolicy: "Политика Конфиденциальности" },
  hi: { title: "Accord Premium", subtitleDefault: "पूर्ण Accord अनुभव अनलॉक करें", threeMonths: "3 महीने", mostPopular: "सबसे लोकप्रिय", annual: "वार्षिक", bestValue: "सर्वोत्तम मूल्य", monthly: "मासिक", save: "{{percent}} बचाएं", subscribeNow: "अभी सदस्यता लें", restorePurchases: "खरीदारी पुनर्स्थापित करें", termsOfUse: "उपयोग की शर्तें", privacyPolicy: "गोपनीयता नीति" },
  bn: { title: "Accord Premium", subtitleDefault: "সম্পূর্ণ Accord অভিজ্ঞতা আনলক করুন", threeMonths: "৩ মাস", mostPopular: "সবচেয়ে জনপ্রিয়", annual: "বার্ষিক", bestValue: "সেরা মূল্য", monthly: "মাসিক", save: "{{percent}} সাশ্রয়", subscribeNow: "এখনই সাবস্ক্রাইব করুন", restorePurchases: "কেনাকাটা পুনরুদ্ধার করুন", termsOfUse: "ব্যবহারের শর্তাবলী", privacyPolicy: "গোপনীয়তা নীতি" },
  zh: { title: "Accord Premium", subtitleDefault: "解锁完整的Accord体验", threeMonths: "3个月", mostPopular: "最受欢迎", annual: "年度", bestValue: "最佳价值", monthly: "月度", save: "节省{{percent}}", subscribeNow: "立即订阅", restorePurchases: "恢复购买", termsOfUse: "使用条款", privacyPolicy: "隐私政策" },
  pl: { title: "Accord Premium", subtitleDefault: "Odblokuj pełne doświadczenie Accord", threeMonths: "3 Miesiące", mostPopular: "NAJPOPULARNIEJSZY", annual: "Roczny", bestValue: "NAJLEPSZA WARTOŚĆ", monthly: "Miesięczny", save: "OSZCZĘDŹ {{percent}}", subscribeNow: "Subskrybuj Teraz", restorePurchases: "Przywróć Zakupy", termsOfUse: "Regulamin", privacyPolicy: "Polityka Prywatności" },
  uk: { title: "Accord Premium", subtitleDefault: "Розблокуйте повний досвід Accord", threeMonths: "3 Місяці", mostPopular: "НАЙПОПУЛЯРНІШИЙ", annual: "Річний", bestValue: "НАЙКРАЩА ПРОПОЗИЦІЯ", monthly: "Місячний", save: "ЗНИЖКА {{percent}}", subscribeNow: "Підписатися", restorePurchases: "Відновити Покупки", termsOfUse: "Умови Використання", privacyPolicy: "Політика Конфіденційності" },
  fa: { title: "Accord Premium", subtitleDefault: "تجربه کامل Accord را باز کنید", threeMonths: "۳ ماه", mostPopular: "محبوب‌ترین", annual: "سالانه", bestValue: "بهترین ارزش", monthly: "ماهانه", save: "{{percent}} صرفه‌جویی", subscribeNow: "اکنون مشترک شوید", restorePurchases: "بازیابی خریدها", termsOfUse: "شرایط استفاده", privacyPolicy: "سیاست حفظ حریم خصوصی" },
  he: { title: "Accord Premium", subtitleDefault: "פתח את חוויית Accord המלאה", threeMonths: "3 חודשים", mostPopular: "הכי פופולרי", annual: "שנתי", bestValue: "הערך הטוב ביותר", monthly: "חודשי", save: "חסוך {{percent}}", subscribeNow: "הירשם עכשיו", restorePurchases: "שחזר רכישות", termsOfUse: "תנאי שימוש", privacyPolicy: "מדיניות פרטיות" },
  ur: { title: "Accord Premium", subtitleDefault: "مکمل Accord تجربہ انلاک کریں", threeMonths: "3 ماہ", mostPopular: "سب سے مقبول", annual: "سالانہ", bestValue: "بہترین قیمت", monthly: "ماہانہ", save: "{{percent}} بچائیں", subscribeNow: "ابھی سبسکرائب کریں", restorePurchases: "خریداریاں بحال کریں", termsOfUse: "استعمال کی شرائط", privacyPolicy: "رازداری کی پالیسی" },
  id: { title: "Accord Premium", subtitleDefault: "Buka pengalaman penuh Accord", threeMonths: "3 Bulan", mostPopular: "PALING POPULER", annual: "Tahunan", bestValue: "NILAI TERBAIK", monthly: "Bulanan", save: "HEMAT {{percent}}", subscribeNow: "Berlangganan Sekarang", restorePurchases: "Pulihkan Pembelian", termsOfUse: "Ketentuan Penggunaan", privacyPolicy: "Kebijakan Privasi" },
  ka: { title: "Accord Premium", subtitleDefault: "გახსენით Accord-ის სრული გამოცდილება", threeMonths: "3 თვე", mostPopular: "ყველაზე პოპულარული", annual: "წლიური", bestValue: "საუკეთესო ღირებულება", monthly: "ყოველთვიური", save: "დაზოგეთ {{percent}}", subscribeNow: "გამოიწერეთ ახლა", restorePurchases: "შესყიდვების აღდგენა", termsOfUse: "გამოყენების პირობები", privacyPolicy: "კონფიდენციალურობის პოლიტიკა" },
};

// Build full premiumPaywall objects for compact translations using en.json as template
function buildFullTranslation(compact, enPaywall) {
  // Start with a deep copy of en
  const full = JSON.parse(JSON.stringify(enPaywall));
  // Override the keys we have translations for
  if (compact.subtitleDefault) full.subtitleDefault = compact.subtitleDefault;
  if (compact.threeMonths) full.threeMonths = compact.threeMonths;
  if (compact.mostPopular) full.mostPopular = compact.mostPopular;
  if (compact.annual) full.annual = compact.annual;
  if (compact.bestValue) full.bestValue = compact.bestValue;
  if (compact.monthly) full.monthly = compact.monthly;
  if (compact.save) full.save = compact.save;
  if (compact.subscribeNow) full.subscribeNow = compact.subscribeNow;
  if (compact.restorePurchases) full.restorePurchases = compact.restorePurchases;
  if (compact.termsOfUse) full.termsOfUse = compact.termsOfUse;
  if (compact.privacyPolicy) full.privacyPolicy = compact.privacyPolicy;
  return full;
}

// Main
const enJson = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const enPaywall = enJson.premiumPaywall;

if (!enPaywall) {
  console.error('❌ premiumPaywall not found in en.json! Add it first.');
  process.exit(1);
}

const localeFiles = fs.readdirSync(localesDir)
  .filter(f => f.endsWith('.json') && f !== 'en.json' && !f.includes('complete') && !f.includes('temp'));

let updated = 0;

for (const file of localeFiles) {
  const locale = file.replace('.json', '');
  const filePath = path.join(localesDir, file);
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (json.premiumPaywall) {
    console.log(`⏭️  ${locale}: premiumPaywall already exists, skipping`);
    continue;
  }

  let paywallData;
  if (translations[locale]) {
    paywallData = translations[locale].premiumPaywall;
  } else if (compactTranslations[locale]) {
    paywallData = buildFullTranslation(compactTranslations[locale], enPaywall);
  } else {
    // Fallback: use English
    console.log(`⚠️  ${locale}: no translation available, using English`);
    paywallData = enPaywall;
  }

  // Insert premiumPaywall before subscriptionSettings
  const entries = Object.entries(json);
  const newJson = {};
  for (const [key, value] of entries) {
    if (key === 'subscriptionSettings') {
      newJson.premiumPaywall = paywallData;
    }
    newJson[key] = value;
  }
  // If subscriptionSettings wasn't found, add at end
  if (!newJson.premiumPaywall) {
    newJson.premiumPaywall = paywallData;
  }

  fs.writeFileSync(filePath, JSON.stringify(newJson, null, 2) + '\n', 'utf8');
  console.log(`✅ ${locale}: premiumPaywall added`);
  updated++;
}

console.log(`\n🎉 Done! Updated ${updated} locale files.`);
