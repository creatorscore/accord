/**
 * Shared translation utility for Edge Functions
 *
 * This provides localized notification strings for push notifications.
 * Supports 19 languages with fallback to English.
 */

// All notification translations embedded for Edge Function use
// These are kept in sync with the client-side locale files
const translations: Record<string, Record<string, any>> = {
  en: {
    match: {
      title: "It's a Match! 💜",
      body: "You matched with {{name}}! Start chatting now."
    },
    message: {
      title: "New message from {{name}}",
      bodyText: "Sent you a message",
      bodyPhoto: "Sent you a photo",
      bodyVoice: "Sent you a voice message",
      bodyVideo: "Sent you a video"
    },
    like: {
      premiumTitle: "{{name}} likes you! 💜",
      premiumBody: "See who liked you and match instantly.",
      premiumSuperTitle: "{{name}} super liked you! ⭐",
      premiumSuperBody: "They really want to connect with you!",
      freeTitle: "Someone likes you! 💜",
      freeBody: "Upgrade to Premium to see who liked you and match instantly.",
      freeSuperTitle: "Someone super liked you! ⭐",
      freeSuperBody: "Upgrade to Premium to see who really wants to match with you."
    },
    trialExpiration: {
      threeDaysTitle: "Your free trial ends in 3 days",
      threeDaysBody: "Don't lose access to premium features! Subscribe now to keep finding your perfect match.",
      oneDayTitle: "Your free trial ends tomorrow!",
      oneDayBody: "Last chance to subscribe and keep your premium features. Tap to upgrade now.",
      todayTitle: "Your free trial ends today!",
      todayBody: "Your premium access expires tonight. Subscribe now to continue your journey to finding your perfect match."
    },
    trialEngagement: {
      day1Title: "Your Premium Trial is Active!",
      day1Body: "Unlock unlimited likes, see who liked you, send Super Likes, and more. Start exploring your premium features!",
      day3TitleWithLikes: "{{count}} {{person}} liked you!",
      day3TitleNoLikes: "You're getting noticed!",
      day3BodyWithLikes: "Tap to see who they are - this is a Premium feature you can keep!",
      day3BodyNoLikes: "Keep using Premium features to stand out and get more likes.",
      day5Title: "Only 2 Days Left in Your Trial!",
      day5BodyWithStats: "You've {{highlights}}. Don't lose access to these features!",
      day5BodyNoStats: "You've been exploring premium features. Subscribe now to keep them!",
      day6Title: "Last Day Tomorrow!",
      day6Body: "Lock in 33% savings with our annual plan before your trial ends. Your connections are waiting!"
    },
    swipesRefreshed: {
      title: "Your swipes are back! 🎉",
      body: "You have 15 new swipes to discover your perfect match. Start swiping now!"
    },
    reviews: {
      readyTitle: "Time to Review! ⭐",
      readyBody: "Share your experience with {{name}}. Your review helps build trust in our community.",
      reminderTitle: "Last Chance to Review! ⏰",
      reminderBody: "Your review window for {{name}} expires soon. Don't miss out!"
    },
    stats: {
      person: "person",
      people: "people",
      seenLikes: "seen {{count}} who liked you",
      sentSuperLikes: "sent {{count}} Super Like",
      sentSuperLikesPlural: "sent {{count}} Super Likes",
      madeMatch: "made {{count}} match",
      madeMatchesPlural: "made {{count}} matches"
    }
  },
  es: {
    match: {
      title: "¡Es un Match! 💜",
      body: "¡Hiciste match con {{name}}! Comienza a chatear ahora."
    },
    message: {
      title: "Nuevo mensaje de {{name}}",
      bodyText: "Te envió un mensaje",
      bodyPhoto: "Te envió una foto",
      bodyVoice: "Te envió un mensaje de voz",
      bodyVideo: "Te envió un video"
    },
    like: {
      premiumTitle: "¡A {{name}} le gustas! 💜",
      premiumBody: "Ve quién te dio like y haz match al instante.",
      premiumSuperTitle: "¡{{name}} te dio super like! ⭐",
      premiumSuperBody: "¡Realmente quieren conectar contigo!",
      freeTitle: "¡A alguien le gustas! 💜",
      freeBody: "Actualiza a Premium para ver quién te dio like y hacer match al instante.",
      freeSuperTitle: "¡Alguien te dio super like! ⭐",
      freeSuperBody: "Actualiza a Premium para ver quién realmente quiere hacer match contigo."
    },
    trialExpiration: {
      threeDaysTitle: "Tu prueba gratis termina en 3 días",
      threeDaysBody: "¡No pierdas acceso a las funciones premium! Suscríbete ahora para seguir encontrando tu match perfecto.",
      oneDayTitle: "¡Tu prueba gratis termina mañana!",
      oneDayBody: "Última oportunidad para suscribirte y mantener tus funciones premium. Toca para actualizar ahora.",
      todayTitle: "¡Tu prueba gratis termina hoy!",
      todayBody: "Tu acceso premium expira esta noche. Suscríbete ahora para continuar tu camino hacia tu match perfecto."
    },
    trialEngagement: {
      day1Title: "¡Tu Prueba Premium está Activa!",
      day1Body: "Desbloquea likes ilimitados, ve quién te dio like, envía Super Likes y más. ¡Comienza a explorar tus funciones premium!",
      day3TitleWithLikes: "¡{{count}} {{person}} te dieron like!",
      day3TitleNoLikes: "¡Te están notando!",
      day3BodyWithLikes: "Toca para ver quiénes son - ¡esta es una función Premium que puedes conservar!",
      day3BodyNoLikes: "Sigue usando las funciones Premium para destacar y obtener más likes.",
      day5Title: "¡Solo 2 Días Quedan en Tu Prueba!",
      day5BodyWithStats: "Has {{highlights}}. ¡No pierdas acceso a estas funciones!",
      day5BodyNoStats: "Has estado explorando funciones premium. ¡Suscríbete ahora para conservarlas!",
      day6Title: "¡Último Día Mañana!",
      day6Body: "Asegura 33% de ahorro con nuestro plan anual antes de que termine tu prueba. ¡Tus conexiones te esperan!"
    },
    swipesRefreshed: {
      title: "¡Tus swipes están de vuelta! 🎉",
      body: "Tienes 15 nuevos swipes para descubrir tu match perfecto. ¡Comienza a deslizar ahora!"
    },
    reviews: {
      readyTitle: "¡Hora de Reseñar! ⭐",
      readyBody: "Comparte tu experiencia con {{name}}. Tu reseña ayuda a construir confianza en nuestra comunidad.",
      reminderTitle: "¡Última Oportunidad para Reseñar! ⏰",
      reminderBody: "Tu ventana de reseña para {{name}} expira pronto. ¡No te lo pierdas!"
    },
    stats: {
      person: "persona",
      people: "personas",
      seenLikes: "visto {{count}} que te dieron like",
      sentSuperLikes: "enviado {{count}} Super Like",
      sentSuperLikesPlural: "enviado {{count}} Super Likes",
      madeMatch: "hecho {{count}} match",
      madeMatchesPlural: "hecho {{count}} matches"
    }
  },
  fr: {
    match: {
      title: "C'est un Match ! 💜",
      body: "Tu as matché avec {{name}} ! Commence à discuter maintenant."
    },
    message: {
      title: "Nouveau message de {{name}}",
      bodyText: "T'a envoyé un message",
      bodyPhoto: "T'a envoyé une photo",
      bodyVoice: "T'a envoyé un message vocal",
      bodyVideo: "T'a envoyé une vidéo"
    },
    like: {
      premiumTitle: "{{name}} t'aime bien ! 💜",
      premiumBody: "Vois qui t'a liké et matche instantanément.",
      premiumSuperTitle: "{{name}} t'a super liké ! ⭐",
      premiumSuperBody: "Cette personne veut vraiment se connecter avec toi !",
      freeTitle: "Quelqu'un t'aime bien ! 💜",
      freeBody: "Passe à Premium pour voir qui t'a liké et matcher instantanément.",
      freeSuperTitle: "Quelqu'un t'a super liké ! ⭐",
      freeSuperBody: "Passe à Premium pour voir qui veut vraiment matcher avec toi."
    },
    trialExpiration: {
      threeDaysTitle: "Ton essai gratuit se termine dans 3 jours",
      threeDaysBody: "Ne perds pas l'accès aux fonctionnalités premium ! Abonne-toi maintenant pour continuer à trouver ton match parfait.",
      oneDayTitle: "Ton essai gratuit se termine demain !",
      oneDayBody: "Dernière chance de t'abonner et de garder tes fonctionnalités premium. Appuie pour passer à Premium.",
      todayTitle: "Ton essai gratuit se termine aujourd'hui !",
      todayBody: "Ton accès premium expire ce soir. Abonne-toi maintenant pour continuer ton parcours vers ton match parfait."
    },
    trialEngagement: {
      day1Title: "Ton Essai Premium est Actif !",
      day1Body: "Débloque les likes illimités, vois qui t'a liké, envoie des Super Likes et plus. Commence à explorer tes fonctionnalités premium !",
      day3TitleWithLikes: "{{count}} {{person}} t'ont liké !",
      day3TitleNoLikes: "Tu te fais remarquer !",
      day3BodyWithLikes: "Appuie pour voir qui c'est - c'est une fonctionnalité Premium que tu peux garder !",
      day3BodyNoLikes: "Continue d'utiliser les fonctionnalités Premium pour te démarquer et obtenir plus de likes.",
      day5Title: "Plus que 2 Jours dans Ton Essai !",
      day5BodyWithStats: "Tu as {{highlights}}. Ne perds pas l'accès à ces fonctionnalités !",
      day5BodyNoStats: "Tu as exploré les fonctionnalités premium. Abonne-toi maintenant pour les garder !",
      day6Title: "Dernier Jour Demain !",
      day6Body: "Profite de 33% de réduction avec notre plan annuel avant la fin de ton essai. Tes connexions t'attendent !"
    },
    swipesRefreshed: {
      title: "Tes swipes sont de retour ! 🎉",
      body: "Tu as 15 nouveaux swipes pour découvrir ton match parfait. Commence à swiper maintenant !"
    },
    reviews: {
      readyTitle: "C'est l'Heure de l'Avis ! ⭐",
      readyBody: "Partage ton expérience avec {{name}}. Ton avis aide à construire la confiance dans notre communauté.",
      reminderTitle: "Dernière Chance de Donner Ton Avis ! ⏰",
      reminderBody: "Ta fenêtre d'avis pour {{name}} expire bientôt. Ne manque pas ça !"
    },
    stats: {
      person: "personne",
      people: "personnes",
      seenLikes: "vu {{count}} qui t'ont liké",
      sentSuperLikes: "envoyé {{count}} Super Like",
      sentSuperLikesPlural: "envoyé {{count}} Super Likes",
      madeMatch: "fait {{count}} match",
      madeMatchesPlural: "fait {{count}} matchs"
    }
  },
  de: {
    match: {
      title: "Es ist ein Match! 💜",
      body: "Du hast ein Match mit {{name}}! Beginne jetzt zu chatten."
    },
    message: {
      title: "Neue Nachricht von {{name}}",
      bodyText: "Hat dir eine Nachricht geschickt",
      bodyPhoto: "Hat dir ein Foto geschickt",
      bodyVoice: "Hat dir eine Sprachnachricht geschickt",
      bodyVideo: "Hat dir ein Video geschickt"
    },
    like: {
      premiumTitle: "{{name}} mag dich! 💜",
      premiumBody: "Sieh wer dich geliked hat und matche sofort.",
      premiumSuperTitle: "{{name}} hat dich super geliked! ⭐",
      premiumSuperBody: "Diese Person möchte sich unbedingt mit dir verbinden!",
      freeTitle: "Jemand mag dich! 💜",
      freeBody: "Upgrade auf Premium um zu sehen wer dich geliked hat und sofort zu matchen.",
      freeSuperTitle: "Jemand hat dich super geliked! ⭐",
      freeSuperBody: "Upgrade auf Premium um zu sehen wer wirklich mit dir matchen möchte."
    },
    trialExpiration: {
      threeDaysTitle: "Deine Testphase endet in 3 Tagen",
      threeDaysBody: "Verliere nicht den Zugang zu Premium-Funktionen! Abonniere jetzt um weiter dein perfektes Match zu finden.",
      oneDayTitle: "Deine Testphase endet morgen!",
      oneDayBody: "Letzte Chance zu abonnieren und deine Premium-Funktionen zu behalten. Tippe zum Upgraden.",
      todayTitle: "Deine Testphase endet heute!",
      todayBody: "Dein Premium-Zugang läuft heute Nacht ab. Abonniere jetzt um deine Reise zu deinem perfekten Match fortzusetzen."
    },
    trialEngagement: {
      day1Title: "Deine Premium-Testphase ist Aktiv!",
      day1Body: "Entsperre unbegrenzte Likes, sieh wer dich geliked hat, sende Super Likes und mehr. Beginne deine Premium-Funktionen zu erkunden!",
      day3TitleWithLikes: "{{count}} {{person}} haben dich geliked!",
      day3TitleNoLikes: "Du wirst bemerkt!",
      day3BodyWithLikes: "Tippe um zu sehen wer es ist - das ist eine Premium-Funktion die du behalten kannst!",
      day3BodyNoLikes: "Nutze weiter Premium-Funktionen um aufzufallen und mehr Likes zu bekommen.",
      day5Title: "Nur noch 2 Tage in deiner Testphase!",
      day5BodyWithStats: "Du hast {{highlights}}. Verliere nicht den Zugang zu diesen Funktionen!",
      day5BodyNoStats: "Du hast Premium-Funktionen erkundet. Abonniere jetzt um sie zu behalten!",
      day6Title: "Letzter Tag Morgen!",
      day6Body: "Sichere dir 33% Ersparnis mit unserem Jahresplan bevor deine Testphase endet. Deine Verbindungen warten!"
    },
    swipesRefreshed: {
      title: "Deine Swipes sind zurück! 🎉",
      body: "Du hast 15 neue Swipes um dein perfektes Match zu entdecken. Beginne jetzt zu swipen!"
    },
    reviews: {
      readyTitle: "Zeit für eine Bewertung! ⭐",
      readyBody: "Teile deine Erfahrung mit {{name}}. Deine Bewertung hilft Vertrauen in unserer Community aufzubauen.",
      reminderTitle: "Letzte Chance zu Bewerten! ⏰",
      reminderBody: "Dein Bewertungsfenster für {{name}} läuft bald ab. Verpasse es nicht!"
    },
    stats: {
      person: "Person",
      people: "Personen",
      seenLikes: "{{count}} gesehen die dich geliked haben",
      sentSuperLikes: "{{count}} Super Like gesendet",
      sentSuperLikesPlural: "{{count}} Super Likes gesendet",
      madeMatch: "{{count}} Match gemacht",
      madeMatchesPlural: "{{count}} Matches gemacht"
    }
  },
  ar: {
    match: {
      title: "إنه تطابق! 💜",
      body: "تطابقت مع {{name}}! ابدأ المحادثة الآن."
    },
    message: {
      title: "رسالة جديدة من {{name}}",
      bodyText: "أرسل لك رسالة",
      bodyPhoto: "أرسل لك صورة",
      bodyVoice: "أرسل لك رسالة صوتية",
      bodyVideo: "أرسل لك فيديو"
    },
    like: {
      premiumTitle: "{{name}} أعجب بك! 💜",
      premiumBody: "شاهد من أعجب بك وتطابق فوراً.",
      premiumSuperTitle: "{{name}} أعجب بك بشدة! ⭐",
      premiumSuperBody: "يريدون حقاً التواصل معك!",
      freeTitle: "شخص ما أعجب بك! 💜",
      freeBody: "قم بالترقية إلى بريميوم لترى من أعجب بك وتطابق فوراً.",
      freeSuperTitle: "شخص ما أعجب بك بشدة! ⭐",
      freeSuperBody: "قم بالترقية إلى بريميوم لترى من يريد حقاً التطابق معك."
    },
    trialExpiration: {
      threeDaysTitle: "تنتهي فترتك التجريبية خلال 3 أيام",
      threeDaysBody: "لا تفقد الوصول إلى الميزات المميزة! اشترك الآن لمواصلة البحث عن تطابقك المثالي.",
      oneDayTitle: "تنتهي فترتك التجريبية غداً!",
      oneDayBody: "فرصة أخيرة للاشتراك والحفاظ على ميزاتك المميزة. اضغط للترقية الآن.",
      todayTitle: "تنتهي فترتك التجريبية اليوم!",
      todayBody: "ينتهي وصولك المميز الليلة. اشترك الآن لمواصلة رحلتك نحو تطابقك المثالي."
    },
    trialEngagement: {
      day1Title: "فترتك التجريبية المميزة نشطة!",
      day1Body: "افتح الإعجابات غير المحدودة، شاهد من أعجب بك، أرسل إعجابات فائقة والمزيد. ابدأ باستكشاف ميزاتك المميزة!",
      day3TitleWithLikes: "{{count}} {{person}} أعجبوا بك!",
      day3TitleNoLikes: "أنت تلفت الانتباه!",
      day3BodyWithLikes: "اضغط لترى من هم - هذه ميزة بريميوم يمكنك الاحتفاظ بها!",
      day3BodyNoLikes: "استمر في استخدام ميزات بريميوم للتميز والحصول على المزيد من الإعجابات.",
      day5Title: "باقي يومان فقط في فترتك التجريبية!",
      day5BodyWithStats: "لقد {{highlights}}. لا تفقد الوصول إلى هذه الميزات!",
      day5BodyNoStats: "لقد استكشفت الميزات المميزة. اشترك الآن للاحتفاظ بها!",
      day6Title: "آخر يوم غداً!",
      day6Body: "احصل على توفير 33% مع خطتنا السنوية قبل انتهاء فترتك التجريبية. تطابقاتك في انتظارك!"
    },
    swipesRefreshed: {
      title: "عادت سحباتك! 🎉",
      body: "لديك 15 سحبة جديدة لاكتشاف تطابقك المثالي. ابدأ السحب الآن!"
    },
    reviews: {
      readyTitle: "حان وقت التقييم! ⭐",
      readyBody: "شارك تجربتك مع {{name}}. تقييمك يساعد في بناء الثقة في مجتمعنا.",
      reminderTitle: "فرصة أخيرة للتقييم! ⏰",
      reminderBody: "نافذة تقييمك لـ {{name}} ستنتهي قريباً. لا تفوتها!"
    },
    stats: {
      person: "شخص",
      people: "أشخاص",
      seenLikes: "شاهدت {{count}} أعجبوا بك",
      sentSuperLikes: "أرسلت {{count}} إعجاب فائق",
      sentSuperLikesPlural: "أرسلت {{count}} إعجابات فائقة",
      madeMatch: "حققت {{count}} تطابق",
      madeMatchesPlural: "حققت {{count}} تطابقات"
    }
  },
  hi: {
    match: {
      title: "यह एक मैच है! 💜",
      body: "आपका {{name}} से मैच हुआ! अभी चैट शुरू करें।"
    },
    message: {
      title: "{{name}} से नया संदेश",
      bodyText: "आपको एक संदेश भेजा",
      bodyPhoto: "आपको एक फोटो भेजी",
      bodyVoice: "आपको एक वॉइस मैसेज भेजा",
      bodyVideo: "आपको एक वीडियो भेजा"
    },
    like: {
      premiumTitle: "{{name}} को आप पसंद हैं! 💜",
      premiumBody: "देखें किसने आपको पसंद किया और तुरंत मैच करें।",
      premiumSuperTitle: "{{name}} ने आपको सुपर लाइक किया! ⭐",
      premiumSuperBody: "वे वाकई आपसे जुड़ना चाहते हैं!",
      freeTitle: "किसी को आप पसंद हैं! 💜",
      freeBody: "प्रीमियम में अपग्रेड करें और देखें किसने आपको पसंद किया।",
      freeSuperTitle: "किसी ने आपको सुपर लाइक किया! ⭐",
      freeSuperBody: "प्रीमियम में अपग्रेड करें और देखें कौन वाकई आपसे मैच करना चाहता है।"
    },
    trialExpiration: {
      threeDaysTitle: "आपका मुफ्त ट्रायल 3 दिनों में समाप्त होगा",
      threeDaysBody: "प्रीमियम फीचर्स का एक्सेस न खोएं! अभी सब्सक्राइब करें।",
      oneDayTitle: "आपका मुफ्त ट्रायल कल समाप्त होगा!",
      oneDayBody: "सब्सक्राइब करने का आखिरी मौका। अभी अपग्रेड करें।",
      todayTitle: "आपका मुफ्त ट्रायल आज समाप्त होगा!",
      todayBody: "आपका प्रीमियम एक्सेस आज रात समाप्त होगा। अभी सब्सक्राइब करें।"
    },
    trialEngagement: {
      day1Title: "आपका प्रीमियम ट्रायल एक्टिव है!",
      day1Body: "अनलिमिटेड लाइक्स, देखें किसने आपको लाइक किया, सुपर लाइक्स भेजें। प्रीमियम फीचर्स एक्सप्लोर करें!",
      day3TitleWithLikes: "{{count}} {{person}} ने आपको लाइक किया!",
      day3TitleNoLikes: "आप नोटिस हो रहे हैं!",
      day3BodyWithLikes: "देखें कौन हैं वे - यह प्रीमियम फीचर है जो आप रख सकते हैं!",
      day3BodyNoLikes: "प्रीमियम फीचर्स का उपयोग जारी रखें।",
      day5Title: "आपके ट्रायल में सिर्फ 2 दिन बाकी!",
      day5BodyWithStats: "आपने {{highlights}}। इन फीचर्स का एक्सेस न खोएं!",
      day5BodyNoStats: "आपने प्रीमियम फीचर्स एक्सप्लोर किए। अभी सब्सक्राइब करें!",
      day6Title: "कल आखिरी दिन!",
      day6Body: "वार्षिक प्लान पर 33% बचाएं। आपके कनेक्शन इंतज़ार कर रहे हैं!"
    },
    swipesRefreshed: {
      title: "आपके स्वाइप्स वापस आ गए! 🎉",
      body: "आपके पास 15 नए स्वाइप्स हैं। अभी स्वाइप करना शुरू करें!"
    },
    reviews: {
      readyTitle: "रिव्यू का समय! ⭐",
      readyBody: "{{name}} के साथ अपना अनुभव साझा करें।",
      reminderTitle: "रिव्यू का आखिरी मौका! ⏰",
      reminderBody: "{{name}} के लिए आपकी रिव्यू विंडो जल्द समाप्त होगी।"
    },
    stats: {
      person: "व्यक्ति",
      people: "लोग",
      seenLikes: "{{count}} को देखा जिन्होंने आपको लाइक किया",
      sentSuperLikes: "{{count}} सुपर लाइक भेजा",
      sentSuperLikesPlural: "{{count}} सुपर लाइक्स भेजे",
      madeMatch: "{{count}} मैच किया",
      madeMatchesPlural: "{{count}} मैच किए"
    }
  },
  pt: {
    match: {
      title: "É um Match! 💜",
      body: "Você deu match com {{name}}! Comece a conversar agora."
    },
    message: {
      title: "Nova mensagem de {{name}}",
      bodyText: "Enviou uma mensagem",
      bodyPhoto: "Enviou uma foto",
      bodyVoice: "Enviou uma mensagem de voz",
      bodyVideo: "Enviou um vídeo"
    },
    like: {
      premiumTitle: "{{name}} gostou de você! 💜",
      premiumBody: "Veja quem curtiu você e dê match instantaneamente.",
      premiumSuperTitle: "{{name}} te deu super like! ⭐",
      premiumSuperBody: "Essa pessoa quer muito se conectar com você!",
      freeTitle: "Alguém gostou de você! 💜",
      freeBody: "Atualize para Premium para ver quem curtiu você e dar match instantaneamente.",
      freeSuperTitle: "Alguém te deu super like! ⭐",
      freeSuperBody: "Atualize para Premium para ver quem realmente quer dar match com você."
    },
    trialExpiration: {
      threeDaysTitle: "Seu teste grátis termina em 3 dias",
      threeDaysBody: "Não perca acesso aos recursos premium! Assine agora para continuar encontrando seu match perfeito.",
      oneDayTitle: "Seu teste grátis termina amanhã!",
      oneDayBody: "Última chance de assinar e manter seus recursos premium. Toque para atualizar agora.",
      todayTitle: "Seu teste grátis termina hoje!",
      todayBody: "Seu acesso premium expira hoje à noite. Assine agora para continuar sua jornada."
    },
    trialEngagement: {
      day1Title: "Seu Teste Premium está Ativo!",
      day1Body: "Desbloqueie curtidas ilimitadas, veja quem curtiu você, envie Super Likes e muito mais. Comece a explorar seus recursos premium!",
      day3TitleWithLikes: "{{count}} {{person}} curtiram você!",
      day3TitleNoLikes: "Você está sendo notado!",
      day3BodyWithLikes: "Toque para ver quem são - este é um recurso Premium que você pode manter!",
      day3BodyNoLikes: "Continue usando recursos Premium para se destacar e receber mais curtidas.",
      day5Title: "Apenas 2 Dias Restantes no Seu Teste!",
      day5BodyWithStats: "Você {{highlights}}. Não perca acesso a esses recursos!",
      day5BodyNoStats: "Você explorou recursos premium. Assine agora para mantê-los!",
      day6Title: "Último Dia Amanhã!",
      day6Body: "Garanta 33% de desconto com nosso plano anual antes que seu teste termine. Suas conexões estão esperando!"
    },
    swipesRefreshed: {
      title: "Seus swipes estão de volta! 🎉",
      body: "Você tem 15 novos swipes para descobrir seu match perfeito. Comece a deslizar agora!"
    },
    reviews: {
      readyTitle: "Hora de Avaliar! ⭐",
      readyBody: "Compartilhe sua experiência com {{name}}. Sua avaliação ajuda a construir confiança em nossa comunidade.",
      reminderTitle: "Última Chance de Avaliar! ⏰",
      reminderBody: "Sua janela de avaliação para {{name}} expira em breve. Não perca!"
    },
    stats: {
      person: "pessoa",
      people: "pessoas",
      seenLikes: "viu {{count}} que curtiram você",
      sentSuperLikes: "enviou {{count}} Super Like",
      sentSuperLikesPlural: "enviou {{count}} Super Likes",
      madeMatch: "fez {{count}} match",
      madeMatchesPlural: "fez {{count}} matches"
    }
  },
  ru: {
    match: {
      title: "Это Совпадение! 💜",
      body: "У вас совпадение с {{name}}! Начните общаться сейчас."
    },
    message: {
      title: "Новое сообщение от {{name}}",
      bodyText: "Отправил(а) вам сообщение",
      bodyPhoto: "Отправил(а) вам фото",
      bodyVoice: "Отправил(а) вам голосовое сообщение",
      bodyVideo: "Отправил(а) вам видео"
    },
    like: {
      premiumTitle: "Вы понравились {{name}}! 💜",
      premiumBody: "Посмотрите, кто вас лайкнул, и совпадите мгновенно.",
      premiumSuperTitle: "{{name}} поставил(а) вам супер-лайк! ⭐",
      premiumSuperBody: "Этот человек очень хочет с вами познакомиться!",
      freeTitle: "Вы кому-то понравились! 💜",
      freeBody: "Перейдите на Премиум, чтобы увидеть, кто вас лайкнул.",
      freeSuperTitle: "Кто-то поставил вам супер-лайк! ⭐",
      freeSuperBody: "Перейдите на Премиум, чтобы увидеть, кто хочет с вами совпасть."
    },
    trialExpiration: {
      threeDaysTitle: "Ваш бесплатный период заканчивается через 3 дня",
      threeDaysBody: "Не потеряйте доступ к премиум-функциям! Подпишитесь сейчас.",
      oneDayTitle: "Ваш бесплатный период заканчивается завтра!",
      oneDayBody: "Последний шанс подписаться. Нажмите, чтобы обновить.",
      todayTitle: "Ваш бесплатный период заканчивается сегодня!",
      todayBody: "Ваш премиум-доступ истекает сегодня ночью. Подпишитесь сейчас."
    },
    trialEngagement: {
      day1Title: "Ваш Премиум-пробный период активен!",
      day1Body: "Разблокируйте безлимитные лайки, смотрите кто вас лайкнул, отправляйте Супер-лайки и многое другое!",
      day3TitleWithLikes: "{{count}} {{person}} лайкнули вас!",
      day3TitleNoLikes: "Вас замечают!",
      day3BodyWithLikes: "Нажмите, чтобы увидеть кто - это премиум-функция, которую вы можете сохранить!",
      day3BodyNoLikes: "Продолжайте использовать премиум-функции, чтобы выделяться.",
      day5Title: "Осталось только 2 дня пробного периода!",
      day5BodyWithStats: "Вы {{highlights}}. Не потеряйте доступ к этим функциям!",
      day5BodyNoStats: "Вы изучили премиум-функции. Подпишитесь сейчас, чтобы сохранить их!",
      day6Title: "Завтра последний день!",
      day6Body: "Получите скидку 33% с годовым планом. Ваши знакомства ждут!"
    },
    swipesRefreshed: {
      title: "Ваши свайпы вернулись! 🎉",
      body: "У вас есть 15 новых свайпов. Начните свайпать сейчас!"
    },
    reviews: {
      readyTitle: "Время для отзыва! ⭐",
      readyBody: "Поделитесь своим опытом с {{name}}.",
      reminderTitle: "Последний шанс оставить отзыв! ⏰",
      reminderBody: "Окно отзыва для {{name}} скоро закроется."
    },
    stats: {
      person: "человек",
      people: "человек",
      seenLikes: "увидели {{count}}, кто вас лайкнул",
      sentSuperLikes: "отправили {{count}} Супер-лайк",
      sentSuperLikesPlural: "отправили {{count}} Супер-лайков",
      madeMatch: "совпали {{count}} раз",
      madeMatchesPlural: "совпали {{count}} раз"
    }
  },
  zh: {
    match: {
      title: "配对成功！💜",
      body: "你和 {{name}} 配对成功！现在开始聊天吧。"
    },
    message: {
      title: "{{name}} 发来新消息",
      bodyText: "给你发送了一条消息",
      bodyPhoto: "给你发送了一张照片",
      bodyVoice: "给你发送了一条语音消息",
      bodyVideo: "给你发送了一个视频"
    },
    like: {
      premiumTitle: "{{name}} 喜欢你！💜",
      premiumBody: "查看谁喜欢了你，立即配对。",
      premiumSuperTitle: "{{name}} 超级喜欢你！⭐",
      premiumSuperBody: "他们真的很想和你联系！",
      freeTitle: "有人喜欢你！💜",
      freeBody: "升级到高级版，查看谁喜欢了你并立即配对。",
      freeSuperTitle: "有人超级喜欢你！⭐",
      freeSuperBody: "升级到高级版，看看谁真的想和你配对。"
    },
    trialExpiration: {
      threeDaysTitle: "你的免费试用还有3天到期",
      threeDaysBody: "不要失去高级功能的访问权限！立即订阅继续寻找你的完美配对。",
      oneDayTitle: "你的免费试用明天到期！",
      oneDayBody: "订阅的最后机会。点击立即升级。",
      todayTitle: "你的免费试用今天到期！",
      todayBody: "你的高级访问权限今晚到期。立即订阅继续你的旅程。"
    },
    trialEngagement: {
      day1Title: "你的高级试用已激活！",
      day1Body: "解锁无限喜欢，查看谁喜欢了你，发送超级喜欢等等。开始探索你的高级功能！",
      day3TitleWithLikes: "{{count}}{{person}}喜欢了你！",
      day3TitleNoLikes: "你正在被注意到！",
      day3BodyWithLikes: "点击查看他们是谁 - 这是你可以保留的高级功能！",
      day3BodyNoLikes: "继续使用高级功能来脱颖而出并获得更多喜欢。",
      day5Title: "试用期只剩2天了！",
      day5BodyWithStats: "你已经{{highlights}}。不要失去这些功能的访问权限！",
      day5BodyNoStats: "你已经探索了高级功能。立即订阅以保留它们！",
      day6Title: "明天是最后一天！",
      day6Body: "在试用结束前锁定年度计划33%的折扣。你的配对正在等待！"
    },
    swipesRefreshed: {
      title: "你的滑动次数已恢复！🎉",
      body: "你有15次新的滑动机会来发现你的完美配对。现在开始滑动吧！"
    },
    reviews: {
      readyTitle: "是时候评价了！⭐",
      readyBody: "分享你与 {{name}} 的体验。你的评价有助于建立社区信任。",
      reminderTitle: "评价的最后机会！⏰",
      reminderBody: "你对 {{name}} 的评价窗口即将关闭。不要错过！"
    },
    stats: {
      person: "人",
      people: "人",
      seenLikes: "看到了{{count}}个喜欢你的人",
      sentSuperLikes: "发送了{{count}}个超级喜欢",
      sentSuperLikesPlural: "发送了{{count}}个超级喜欢",
      madeMatch: "配对了{{count}}次",
      madeMatchesPlural: "配对了{{count}}次"
    }
  },
  tr: {
    match: {
      title: "Eşleşme Var! 💜",
      body: "{{name}} ile eşleştin! Şimdi sohbet etmeye başla."
    },
    message: {
      title: "{{name}} yeni mesaj gönderdi",
      bodyText: "Sana bir mesaj gönderdi",
      bodyPhoto: "Sana bir fotoğraf gönderdi",
      bodyVoice: "Sana bir sesli mesaj gönderdi",
      bodyVideo: "Sana bir video gönderdi"
    },
    like: {
      premiumTitle: "{{name}} seni beğendi! 💜",
      premiumBody: "Seni kimin beğendiğini gör ve anında eşleş.",
      premiumSuperTitle: "{{name}} seni süper beğendi! ⭐",
      premiumSuperBody: "Seninle gerçekten bağlantı kurmak istiyorlar!",
      freeTitle: "Biri seni beğendi! 💜",
      freeBody: "Premium'a yükselt ve seni kimin beğendiğini gör.",
      freeSuperTitle: "Biri seni süper beğendi! ⭐",
      freeSuperBody: "Premium'a yükselt ve seninle eşleşmek isteyeni gör."
    },
    trialExpiration: {
      threeDaysTitle: "Ücretsiz denemen 3 gün içinde bitiyor",
      threeDaysBody: "Premium özelliklere erişimi kaybetme! Şimdi abone ol.",
      oneDayTitle: "Ücretsiz denemen yarın bitiyor!",
      oneDayBody: "Abone olmak için son şans. Şimdi yükselt.",
      todayTitle: "Ücretsiz denemen bugün bitiyor!",
      todayBody: "Premium erişimin bu gece sona eriyor. Şimdi abone ol."
    },
    trialEngagement: {
      day1Title: "Premium Denemen Aktif!",
      day1Body: "Sınırsız beğenileri aç, seni kimin beğendiğini gör, Süper Beğeni gönder ve daha fazlası!",
      day3TitleWithLikes: "{{count}} {{person}} seni beğendi!",
      day3TitleNoLikes: "Fark ediliyorsun!",
      day3BodyWithLikes: "Kim olduklarını görmek için dokun - bu koruyabileceğin bir Premium özellik!",
      day3BodyNoLikes: "Öne çıkmak için Premium özelliklerini kullanmaya devam et.",
      day5Title: "Deneme süresinde sadece 2 gün kaldı!",
      day5BodyWithStats: "{{highlights}}. Bu özelliklere erişimi kaybetme!",
      day5BodyNoStats: "Premium özellikleri keşfettin. Şimdi abone ol!",
      day6Title: "Yarın son gün!",
      day6Body: "Denemen bitmeden yıllık planda %33 tasarruf et. Bağlantıların seni bekliyor!"
    },
    swipesRefreshed: {
      title: "Kaydırmalar geri döndü! 🎉",
      body: "Mükemmel eşleşmeni bulmak için 15 yeni kaydırman var. Şimdi kaydırmaya başla!"
    },
    reviews: {
      readyTitle: "Değerlendirme Zamanı! ⭐",
      readyBody: "{{name}} ile deneyimini paylaş.",
      reminderTitle: "Değerlendirme İçin Son Şans! ⏰",
      reminderBody: "{{name}} için değerlendirme süren yakında bitiyor."
    },
    stats: {
      person: "kişi",
      people: "kişi",
      seenLikes: "seni beğenen {{count}} kişiyi gördün",
      sentSuperLikes: "{{count}} Süper Beğeni gönderdin",
      sentSuperLikesPlural: "{{count}} Süper Beğeni gönderdin",
      madeMatch: "{{count}} eşleşme yaptın",
      madeMatchesPlural: "{{count}} eşleşme yaptın"
    }
  },
  it: {
    match: {
      title: "È un Match! 💜",
      body: "Hai fatto match con {{name}}! Inizia a chattare ora."
    },
    message: {
      title: "Nuovo messaggio da {{name}}",
      bodyText: "Ti ha inviato un messaggio",
      bodyPhoto: "Ti ha inviato una foto",
      bodyVoice: "Ti ha inviato un messaggio vocale",
      bodyVideo: "Ti ha inviato un video"
    },
    like: {
      premiumTitle: "Piaci a {{name}}! 💜",
      premiumBody: "Scopri chi ti ha messo like e fai match istantaneamente.",
      premiumSuperTitle: "{{name}} ti ha messo super like! ⭐",
      premiumSuperBody: "Vuole davvero connettersi con te!",
      freeTitle: "Piaci a qualcuno! 💜",
      freeBody: "Passa a Premium per vedere chi ti ha messo like e fare match istantaneamente.",
      freeSuperTitle: "Qualcuno ti ha messo super like! ⭐",
      freeSuperBody: "Passa a Premium per vedere chi vuole davvero fare match con te."
    },
    trialExpiration: {
      threeDaysTitle: "La tua prova gratuita termina tra 3 giorni",
      threeDaysBody: "Non perdere l'accesso alle funzionalità premium! Abbonati ora.",
      oneDayTitle: "La tua prova gratuita termina domani!",
      oneDayBody: "Ultima possibilità di abbonarti. Tocca per fare l'upgrade ora.",
      todayTitle: "La tua prova gratuita termina oggi!",
      todayBody: "Il tuo accesso premium scade stanotte. Abbonati ora."
    },
    trialEngagement: {
      day1Title: "La Tua Prova Premium è Attiva!",
      day1Body: "Sblocca like illimitati, scopri chi ti ha messo like, invia Super Like e altro ancora!",
      day3TitleWithLikes: "{{count}} {{person}} ti hanno messo like!",
      day3TitleNoLikes: "Ti stanno notando!",
      day3BodyWithLikes: "Tocca per vedere chi sono - è una funzionalità Premium che puoi mantenere!",
      day3BodyNoLikes: "Continua a usare le funzionalità Premium per distinguerti.",
      day5Title: "Solo 2 giorni rimasti nella tua prova!",
      day5BodyWithStats: "Hai {{highlights}}. Non perdere l'accesso a queste funzionalità!",
      day5BodyNoStats: "Hai esplorato le funzionalità premium. Abbonati ora per mantenerle!",
      day6Title: "Ultimo giorno domani!",
      day6Body: "Assicurati il 33% di sconto con il piano annuale. Le tue connessioni ti aspettano!"
    },
    swipesRefreshed: {
      title: "I tuoi swipe sono tornati! 🎉",
      body: "Hai 15 nuovi swipe per scoprire il tuo match perfetto. Inizia a scorrere ora!"
    },
    reviews: {
      readyTitle: "È ora di recensire! ⭐",
      readyBody: "Condividi la tua esperienza con {{name}}.",
      reminderTitle: "Ultima possibilità di recensire! ⏰",
      reminderBody: "La tua finestra di recensione per {{name}} sta per scadere."
    },
    stats: {
      person: "persona",
      people: "persone",
      seenLikes: "visto {{count}} che ti hanno messo like",
      sentSuperLikes: "inviato {{count}} Super Like",
      sentSuperLikesPlural: "inviato {{count}} Super Like",
      madeMatch: "fatto {{count}} match",
      madeMatchesPlural: "fatto {{count}} match"
    }
  },
  pl: {
    match: {
      title: "Masz Dopasowanie! 💜",
      body: "Dopasowałeś się z {{name}}! Zacznij teraz rozmawiać."
    },
    message: {
      title: "Nowa wiadomość od {{name}}",
      bodyText: "Wysłał(a) ci wiadomość",
      bodyPhoto: "Wysłał(a) ci zdjęcie",
      bodyVoice: "Wysłał(a) ci wiadomość głosową",
      bodyVideo: "Wysłał(a) ci film"
    },
    like: {
      premiumTitle: "{{name}} cię lubi! 💜",
      premiumBody: "Zobacz, kto cię polubił i dopasuj się natychmiast.",
      premiumSuperTitle: "{{name}} dał(a) ci super like! ⭐",
      premiumSuperBody: "Naprawdę chcą się z tobą połączyć!",
      freeTitle: "Ktoś cię lubi! 💜",
      freeBody: "Przejdź na Premium, aby zobaczyć kto cię polubił.",
      freeSuperTitle: "Ktoś dał ci super like! ⭐",
      freeSuperBody: "Przejdź na Premium, aby zobaczyć kto naprawdę chce się z tobą dopasować."
    },
    trialExpiration: {
      threeDaysTitle: "Twój bezpłatny okres próbny kończy się za 3 dni",
      threeDaysBody: "Nie trać dostępu do funkcji premium! Subskrybuj teraz.",
      oneDayTitle: "Twój bezpłatny okres próbny kończy się jutro!",
      oneDayBody: "Ostatnia szansa na subskrypcję. Dotknij, aby ulepszyć.",
      todayTitle: "Twój bezpłatny okres próbny kończy się dzisiaj!",
      todayBody: "Twój dostęp premium wygasa dziś w nocy. Subskrybuj teraz."
    },
    trialEngagement: {
      day1Title: "Twój Okres Próbny Premium jest Aktywny!",
      day1Body: "Odblokuj nieograniczone polubienia, zobacz kto cię polubił, wysyłaj Super Like i więcej!",
      day3TitleWithLikes: "{{count}} {{person}} polubiło cię!",
      day3TitleNoLikes: "Zauważają cię!",
      day3BodyWithLikes: "Dotknij, aby zobaczyć kto - to funkcja Premium, którą możesz zachować!",
      day3BodyNoLikes: "Kontynuuj korzystanie z funkcji Premium, aby się wyróżnić.",
      day5Title: "Zostały tylko 2 dni okresu próbnego!",
      day5BodyWithStats: "Już {{highlights}}. Nie trać dostępu do tych funkcji!",
      day5BodyNoStats: "Odkryłeś funkcje premium. Subskrybuj teraz, aby je zachować!",
      day6Title: "Jutro ostatni dzień!",
      day6Body: "Zdobądź 33% zniżki z planem rocznym. Twoje połączenia czekają!"
    },
    swipesRefreshed: {
      title: "Twoje przesunięcia wróciły! 🎉",
      body: "Masz 15 nowych przesunięć, aby odkryć idealne dopasowanie. Zacznij przesuwać teraz!"
    },
    reviews: {
      readyTitle: "Czas na Recenzję! ⭐",
      readyBody: "Podziel się swoim doświadczeniem z {{name}}.",
      reminderTitle: "Ostatnia Szansa na Recenzję! ⏰",
      reminderBody: "Twoje okno recenzji dla {{name}} wkrótce się zamknie."
    },
    stats: {
      person: "osoba",
      people: "osób",
      seenLikes: "zobaczyłeś {{count}}, którzy cię polubili",
      sentSuperLikes: "wysłałeś {{count}} Super Like",
      sentSuperLikesPlural: "wysłałeś {{count}} Super Like'ów",
      madeMatch: "dopasowałeś się {{count}} raz",
      madeMatchesPlural: "dopasowałeś się {{count}} razy"
    }
  },
  uk: {
    match: {
      title: "Це Збіг! 💜",
      body: "Ви збіглися з {{name}}! Почніть спілкуватися зараз."
    },
    message: {
      title: "Нове повідомлення від {{name}}",
      bodyText: "Надіслав(ла) вам повідомлення",
      bodyPhoto: "Надіслав(ла) вам фото",
      bodyVoice: "Надіслав(ла) вам голосове повідомлення",
      bodyVideo: "Надіслав(ла) вам відео"
    },
    like: {
      premiumTitle: "{{name}} вподобав(ла) вас! 💜",
      premiumBody: "Подивіться, хто вас вподобав, і збігніться миттєво.",
      premiumSuperTitle: "{{name}} супер вподобав(ла) вас! ⭐",
      premiumSuperBody: "Вони дуже хочуть з вами зв'язатися!",
      freeTitle: "Хтось вас вподобав! 💜",
      freeBody: "Оновіться до Преміум, щоб побачити, хто вас вподобав.",
      freeSuperTitle: "Хтось супер вподобав вас! ⭐",
      freeSuperBody: "Оновіться до Преміум, щоб побачити, хто хоче з вами збігтися."
    },
    trialExpiration: {
      threeDaysTitle: "Ваш безкоштовний пробний період закінчується через 3 дні",
      threeDaysBody: "Не втрачайте доступ до преміум-функцій! Підпишіться зараз.",
      oneDayTitle: "Ваш безкоштовний пробний період закінчується завтра!",
      oneDayBody: "Останній шанс підписатися. Натисніть для оновлення.",
      todayTitle: "Ваш безкоштовний пробний період закінчується сьогодні!",
      todayBody: "Ваш преміум-доступ закінчується сьогодні вночі. Підпишіться зараз."
    },
    trialEngagement: {
      day1Title: "Ваш Преміум Пробний Період Активний!",
      day1Body: "Розблокуйте необмежені вподобання, дивіться хто вас вподобав, надсилайте Супер Лайки і більше!",
      day3TitleWithLikes: "{{count}} {{person}} вподобали вас!",
      day3TitleNoLikes: "Вас помічають!",
      day3BodyWithLikes: "Натисніть, щоб побачити хто - це преміум-функція, яку ви можете зберегти!",
      day3BodyNoLikes: "Продовжуйте використовувати преміум-функції, щоб виділитися.",
      day5Title: "Залишилося лише 2 дні пробного періоду!",
      day5BodyWithStats: "Ви {{highlights}}. Не втрачайте доступ до цих функцій!",
      day5BodyNoStats: "Ви дослідили преміум-функції. Підпишіться зараз, щоб їх зберегти!",
      day6Title: "Завтра останній день!",
      day6Body: "Отримайте знижку 33% з річним планом. Ваші знайомства чекають!"
    },
    swipesRefreshed: {
      title: "Ваші свайпи повернулися! 🎉",
      body: "У вас є 15 нових свайпів. Почніть свайпати зараз!"
    },
    reviews: {
      readyTitle: "Час для відгуку! ⭐",
      readyBody: "Поділіться своїм досвідом з {{name}}.",
      reminderTitle: "Останній шанс залишити відгук! ⏰",
      reminderBody: "Вікно відгуку для {{name}} скоро закриється."
    },
    stats: {
      person: "людина",
      people: "людей",
      seenLikes: "побачили {{count}}, хто вас вподобав",
      sentSuperLikes: "надіслали {{count}} Супер Лайк",
      sentSuperLikesPlural: "надіслали {{count}} Супер Лайків",
      madeMatch: "збіглися {{count}} раз",
      madeMatchesPlural: "збіглися {{count}} разів"
    }
  },
  he: {
    match: {
      title: "יש התאמה! 💜",
      body: "יש לך התאמה עם {{name}}! התחילו לשוחח עכשיו."
    },
    message: {
      title: "הודעה חדשה מ{{name}}",
      bodyText: "שלח לך הודעה",
      bodyPhoto: "שלח לך תמונה",
      bodyVoice: "שלח לך הודעה קולית",
      bodyVideo: "שלח לך סרטון"
    },
    like: {
      premiumTitle: "{{name}} אוהב אותך! 💜",
      premiumBody: "ראה מי אהב אותך ועשה התאמה מיידית.",
      premiumSuperTitle: "{{name}} סופר אהב אותך! ⭐",
      premiumSuperBody: "הם באמת רוצים להתחבר איתך!",
      freeTitle: "מישהו אוהב אותך! 💜",
      freeBody: "שדרג לפרימיום כדי לראות מי אהב אותך.",
      freeSuperTitle: "מישהו סופר אהב אותך! ⭐",
      freeSuperBody: "שדרג לפרימיום כדי לראות מי באמת רוצה להתאים איתך."
    },
    trialExpiration: {
      threeDaysTitle: "תקופת הניסיון שלך מסתיימת בעוד 3 ימים",
      threeDaysBody: "אל תאבד גישה לתכונות פרימיום! הירשם עכשיו.",
      oneDayTitle: "תקופת הניסיון שלך מסתיימת מחר!",
      oneDayBody: "הזדמנות אחרונה להירשם. הקש לשדרוג.",
      todayTitle: "תקופת הניסיון שלך מסתיימת היום!",
      todayBody: "גישת הפרימיום שלך מסתיימת הלילה. הירשם עכשיו."
    },
    trialEngagement: {
      day1Title: "תקופת הניסיון הפרימיום שלך פעילה!",
      day1Body: "פתח לייקים ללא הגבלה, ראה מי אהב אותך, שלח סופר לייקים ועוד!",
      day3TitleWithLikes: "{{count}} {{person}} אהבו אותך!",
      day3TitleNoLikes: "אתה מקבל תשומת לב!",
      day3BodyWithLikes: "הקש לראות מי הם - זו תכונת פרימיום שתוכל לשמור!",
      day3BodyNoLikes: "המשך להשתמש בתכונות פרימיום כדי להתבלט.",
      day5Title: "נשארו רק יומיים בתקופת הניסיון!",
      day5BodyWithStats: "{{highlights}}. אל תאבד גישה לתכונות אלה!",
      day5BodyNoStats: "גילית תכונות פרימיום. הירשם עכשיו כדי לשמור אותן!",
      day6Title: "מחר היום האחרון!",
      day6Body: "קבל 33% הנחה עם התוכנית השנתית. ההתאמות שלך מחכות!"
    },
    swipesRefreshed: {
      title: "ההחלקות שלך חזרו! 🎉",
      body: "יש לך 15 החלקות חדשות. התחל להחליק עכשיו!"
    },
    reviews: {
      readyTitle: "הגיע הזמן לסקירה! ⭐",
      readyBody: "שתף את החוויה שלך עם {{name}}.",
      reminderTitle: "הזדמנות אחרונה לסקור! ⏰",
      reminderBody: "חלון הסקירה שלך ל{{name}} עומד להיסגר."
    },
    stats: {
      person: "אדם",
      people: "אנשים",
      seenLikes: "ראית {{count}} שאהבו אותך",
      sentSuperLikes: "שלחת {{count}} סופר לייק",
      sentSuperLikesPlural: "שלחת {{count}} סופר לייקים",
      madeMatch: "עשית {{count}} התאמה",
      madeMatchesPlural: "עשית {{count}} התאמות"
    }
  },
  fa: {
    match: {
      title: "یک مچ! 💜",
      body: "شما با {{name}} مچ شدید! همین الان شروع به چت کنید."
    },
    message: {
      title: "پیام جدید از {{name}}",
      bodyText: "برایت پیام فرستاد",
      bodyPhoto: "برایت عکس فرستاد",
      bodyVoice: "برایت پیام صوتی فرستاد",
      bodyVideo: "برایت ویدیو فرستاد"
    },
    like: {
      premiumTitle: "{{name}} تو را لایک کرد! 💜",
      premiumBody: "ببین کی تو را لایک کرده و فوراً مچ شو.",
      premiumSuperTitle: "{{name}} تو را سوپر لایک کرد! ⭐",
      premiumSuperBody: "آنها واقعاً می‌خواهند با تو ارتباط برقرار کنند!",
      freeTitle: "کسی تو را لایک کرد! 💜",
      freeBody: "به پرمیوم ارتقا بده تا ببینی کی تو را لایک کرده.",
      freeSuperTitle: "کسی تو را سوپر لایک کرد! ⭐",
      freeSuperBody: "به پرمیوم ارتقا بده تا ببینی کی واقعاً می‌خواهد با تو مچ شود."
    },
    trialExpiration: {
      threeDaysTitle: "دوره آزمایشی رایگان شما تا ۳ روز دیگر تمام می‌شود",
      threeDaysBody: "دسترسی به ویژگی‌های پرمیوم را از دست ندهید! همین الان اشتراک بگیرید.",
      oneDayTitle: "دوره آزمایشی رایگان شما فردا تمام می‌شود!",
      oneDayBody: "آخرین فرصت برای اشتراک. برای ارتقا ضربه بزنید.",
      todayTitle: "دوره آزمایشی رایگان شما امروز تمام می‌شود!",
      todayBody: "دسترسی پرمیوم شما امشب منقضی می‌شود. همین الان اشتراک بگیرید."
    },
    trialEngagement: {
      day1Title: "دوره آزمایشی پرمیوم شما فعال است!",
      day1Body: "لایک‌های نامحدود، ببینید کی شما را لایک کرده، سوپر لایک بفرستید و بیشتر!",
      day3TitleWithLikes: "{{count}} {{person}} شما را لایک کردند!",
      day3TitleNoLikes: "شما مورد توجه هستید!",
      day3BodyWithLikes: "ضربه بزنید تا ببینید چه کسانی هستند - این یک ویژگی پرمیوم است که می‌توانید نگه دارید!",
      day3BodyNoLikes: "به استفاده از ویژگی‌های پرمیوم ادامه دهید تا متمایز شوید.",
      day5Title: "فقط ۲ روز در دوره آزمایشی باقی مانده!",
      day5BodyWithStats: "شما {{highlights}}. دسترسی به این ویژگی‌ها را از دست ندهید!",
      day5BodyNoStats: "شما ویژگی‌های پرمیوم را کشف کردید. همین الان اشتراک بگیرید تا آنها را نگه دارید!",
      day6Title: "فردا آخرین روز است!",
      day6Body: "با طرح سالانه ۳۳٪ تخفیف بگیرید. ارتباطات شما منتظر هستند!"
    },
    swipesRefreshed: {
      title: "سوایپ‌های شما برگشتند! 🎉",
      body: "شما ۱۵ سوایپ جدید دارید. همین الان شروع به سوایپ کنید!"
    },
    reviews: {
      readyTitle: "وقت نظر دادن است! ⭐",
      readyBody: "تجربه خود با {{name}} را به اشتراک بگذارید.",
      reminderTitle: "آخرین فرصت برای نظر دادن! ⏰",
      reminderBody: "پنجره نظر شما برای {{name}} به زودی بسته می‌شود."
    },
    stats: {
      person: "نفر",
      people: "نفر",
      seenLikes: "{{count}} نفر که شما را لایک کردند دیدید",
      sentSuperLikes: "{{count}} سوپر لایک فرستادید",
      sentSuperLikesPlural: "{{count}} سوپر لایک فرستادید",
      madeMatch: "{{count}} مچ کردید",
      madeMatchesPlural: "{{count}} مچ کردید"
    }
  },
  ur: {
    match: {
      title: "میچ ہو گیا! 💜",
      body: "آپ کا {{name}} سے میچ ہو گیا! ابھی چیٹ شروع کریں۔"
    },
    message: {
      title: "{{name}} کی طرف سے نیا پیغام",
      bodyText: "آپ کو پیغام بھیجا",
      bodyPhoto: "آپ کو تصویر بھیجی",
      bodyVoice: "آپ کو وائس میسج بھیجا",
      bodyVideo: "آپ کو ویڈیو بھیجی"
    },
    like: {
      premiumTitle: "{{name}} آپ کو پسند کرتے ہیں! 💜",
      premiumBody: "دیکھیں کس نے آپ کو لائک کیا اور فوری میچ کریں۔",
      premiumSuperTitle: "{{name}} نے آپ کو سپر لائک کیا! ⭐",
      premiumSuperBody: "وہ واقعی آپ سے جڑنا چاہتے ہیں!",
      freeTitle: "کسی نے آپ کو پسند کیا! 💜",
      freeBody: "پریمیم میں اپگریڈ کریں اور دیکھیں کس نے آپ کو لائک کیا۔",
      freeSuperTitle: "کسی نے آپ کو سپر لائک کیا! ⭐",
      freeSuperBody: "پریمیم میں اپگریڈ کریں اور دیکھیں کون آپ سے میچ کرنا چاہتا ہے۔"
    },
    trialExpiration: {
      threeDaysTitle: "آپ کا مفت ٹرائل 3 دنوں میں ختم ہو رہا ہے",
      threeDaysBody: "پریمیم فیچرز تک رسائی نہ کھوئیں! ابھی سبسکرائب کریں۔",
      oneDayTitle: "آپ کا مفت ٹرائل کل ختم ہو رہا ہے!",
      oneDayBody: "سبسکرائب کرنے کا آخری موقع۔ اپگریڈ کے لیے ٹیپ کریں۔",
      todayTitle: "آپ کا مفت ٹرائل آج ختم ہو رہا ہے!",
      todayBody: "آپ کی پریمیم رسائی آج رات ختم ہو رہی ہے۔ ابھی سبسکرائب کریں۔"
    },
    trialEngagement: {
      day1Title: "آپ کا پریمیم ٹرائل ایکٹو ہے!",
      day1Body: "لامحدود لائکس، دیکھیں کس نے آپ کو لائک کیا، سپر لائکس بھیجیں اور مزید!",
      day3TitleWithLikes: "{{count}} {{person}} نے آپ کو لائک کیا!",
      day3TitleNoLikes: "آپ نوٹس ہو رہے ہیں!",
      day3BodyWithLikes: "دیکھنے کے لیے ٹیپ کریں کون ہیں - یہ پریمیم فیچر ہے جو آپ رکھ سکتے ہیں!",
      day3BodyNoLikes: "پریمیم فیچرز استعمال کرتے رہیں۔",
      day5Title: "آپ کے ٹرائل میں صرف 2 دن باقی ہیں!",
      day5BodyWithStats: "آپ نے {{highlights}}۔ ان فیچرز تک رسائی نہ کھوئیں!",
      day5BodyNoStats: "آپ نے پریمیم فیچرز دریافت کیے۔ ابھی سبسکرائب کریں!",
      day6Title: "کل آخری دن ہے!",
      day6Body: "سالانہ پلان پر 33% بچائیں۔ آپ کے کنیکشنز انتظار کر رہے ہیں!"
    },
    swipesRefreshed: {
      title: "آپ کے سوائپس واپس آ گئے! 🎉",
      body: "آپ کے پاس 15 نئے سوائپس ہیں۔ ابھی سوائپ کرنا شروع کریں!"
    },
    reviews: {
      readyTitle: "ریویو کا وقت! ⭐",
      readyBody: "{{name}} کے ساتھ اپنا تجربہ شیئر کریں۔",
      reminderTitle: "ریویو کا آخری موقع! ⏰",
      reminderBody: "{{name}} کے لیے آپ کی ریویو ونڈو جلد بند ہو رہی ہے۔"
    },
    stats: {
      person: "شخص",
      people: "لوگ",
      seenLikes: "{{count}} کو دیکھا جنہوں نے آپ کو لائک کیا",
      sentSuperLikes: "{{count}} سپر لائک بھیجا",
      sentSuperLikesPlural: "{{count}} سپر لائکس بھیجے",
      madeMatch: "{{count}} میچ کیا",
      madeMatchesPlural: "{{count}} میچز کیے"
    }
  },
  bn: {
    match: {
      title: "ম্যাচ হয়েছে! 💜",
      body: "আপনি {{name}} এর সাথে ম্যাচ করেছেন! এখনই চ্যাট শুরু করুন।"
    },
    message: {
      title: "{{name}} থেকে নতুন বার্তা",
      bodyText: "আপনাকে একটি বার্তা পাঠিয়েছে",
      bodyPhoto: "আপনাকে একটি ছবি পাঠিয়েছে",
      bodyVoice: "আপনাকে একটি ভয়েস মেসেজ পাঠিয়েছে",
      bodyVideo: "আপনাকে একটি ভিডিও পাঠিয়েছে"
    },
    like: {
      premiumTitle: "{{name}} আপনাকে পছন্দ করেছে! 💜",
      premiumBody: "দেখুন কে আপনাকে লাইক করেছে এবং তাৎক্ষণিক ম্যাচ করুন।",
      premiumSuperTitle: "{{name}} আপনাকে সুপার লাইক করেছে! ⭐",
      premiumSuperBody: "তারা সত্যিই আপনার সাথে সংযোগ করতে চায়!",
      freeTitle: "কেউ আপনাকে পছন্দ করেছে! 💜",
      freeBody: "প্রিমিয়ামে আপগ্রেড করুন এবং দেখুন কে আপনাকে লাইক করেছে।",
      freeSuperTitle: "কেউ আপনাকে সুপার লাইক করেছে! ⭐",
      freeSuperBody: "প্রিমিয়ামে আপগ্রেড করুন এবং দেখুন কে সত্যিই আপনার সাথে ম্যাচ করতে চায়।"
    },
    trialExpiration: {
      threeDaysTitle: "আপনার বিনামূল্যে ট্রায়াল ৩ দিনে শেষ হচ্ছে",
      threeDaysBody: "প্রিমিয়াম ফিচারগুলিতে অ্যাক্সেস হারাবেন না! এখনই সাবস্ক্রাইব করুন।",
      oneDayTitle: "আপনার বিনামূল্যে ট্রায়াল আগামীকাল শেষ হচ্ছে!",
      oneDayBody: "সাবস্ক্রাইব করার শেষ সুযোগ। আপগ্রেড করতে ট্যাপ করুন।",
      todayTitle: "আপনার বিনামূল্যে ট্রায়াল আজ শেষ হচ্ছে!",
      todayBody: "আপনার প্রিমিয়াম অ্যাক্সেস আজ রাতে শেষ হচ্ছে। এখনই সাবস্ক্রাইব করুন।"
    },
    trialEngagement: {
      day1Title: "আপনার প্রিমিয়াম ট্রায়াল সক্রিয়!",
      day1Body: "সীমাহীন লাইক, দেখুন কে আপনাকে লাইক করেছে, সুপার লাইক পাঠান এবং আরও অনেক কিছু!",
      day3TitleWithLikes: "{{count}} {{person}} আপনাকে লাইক করেছে!",
      day3TitleNoLikes: "আপনি লক্ষ্য করা হচ্ছেন!",
      day3BodyWithLikes: "দেখতে ট্যাপ করুন তারা কে - এটি একটি প্রিমিয়াম ফিচার যা আপনি রাখতে পারেন!",
      day3BodyNoLikes: "প্রিমিয়াম ফিচার ব্যবহার করতে থাকুন।",
      day5Title: "আপনার ট্রায়ালে মাত্র ২ দিন বাকি!",
      day5BodyWithStats: "আপনি {{highlights}}। এই ফিচারগুলিতে অ্যাক্সেস হারাবেন না!",
      day5BodyNoStats: "আপনি প্রিমিয়াম ফিচার অন্বেষণ করেছেন। এখনই সাবস্ক্রাইব করুন!",
      day6Title: "আগামীকাল শেষ দিন!",
      day6Body: "বার্ষিক প্ল্যানে ৩৩% সাশ্রয় করুন। আপনার সংযোগগুলি অপেক্ষা করছে!"
    },
    swipesRefreshed: {
      title: "আপনার সোয়াইপগুলি ফিরে এসেছে! 🎉",
      body: "আপনার কাছে ১৫টি নতুন সোয়াইপ আছে। এখনই সোয়াইপ করা শুরু করুন!"
    },
    reviews: {
      readyTitle: "রিভিউ করার সময়! ⭐",
      readyBody: "{{name}} এর সাথে আপনার অভিজ্ঞতা শেয়ার করুন।",
      reminderTitle: "রিভিউ করার শেষ সুযোগ! ⏰",
      reminderBody: "{{name}} এর জন্য আপনার রিভিউ উইন্ডো শীঘ্রই বন্ধ হচ্ছে।"
    },
    stats: {
      person: "জন",
      people: "জন",
      seenLikes: "{{count}} জনকে দেখেছেন যারা আপনাকে লাইক করেছে",
      sentSuperLikes: "{{count}}টি সুপার লাইক পাঠিয়েছেন",
      sentSuperLikesPlural: "{{count}}টি সুপার লাইক পাঠিয়েছেন",
      madeMatch: "{{count}}টি ম্যাচ করেছেন",
      madeMatchesPlural: "{{count}}টি ম্যাচ করেছেন"
    }
  },
  id: {
    match: {
      title: "Cocok! 💜",
      body: "Kamu cocok dengan {{name}}! Mulai mengobrol sekarang."
    },
    message: {
      title: "Pesan baru dari {{name}}",
      bodyText: "Mengirim pesan",
      bodyPhoto: "Mengirim foto",
      bodyVoice: "Mengirim pesan suara",
      bodyVideo: "Mengirim video"
    },
    like: {
      premiumTitle: "{{name}} menyukaimu! 💜",
      premiumBody: "Lihat siapa yang menyukaimu dan cocokkan langsung.",
      premiumSuperTitle: "{{name}} sangat menyukaimu! ⭐",
      premiumSuperBody: "Mereka sangat ingin terhubung denganmu!",
      freeTitle: "Seseorang menyukaimu! 💜",
      freeBody: "Upgrade ke Premium untuk melihat siapa yang menyukaimu.",
      freeSuperTitle: "Seseorang sangat menyukaimu! ⭐",
      freeSuperBody: "Upgrade ke Premium untuk melihat siapa yang ingin cocok denganmu."
    },
    trialExpiration: {
      threeDaysTitle: "Uji coba gratis berakhir dalam 3 hari",
      threeDaysBody: "Jangan kehilangan akses ke fitur premium! Berlangganan sekarang.",
      oneDayTitle: "Uji coba gratis berakhir besok!",
      oneDayBody: "Kesempatan terakhir untuk berlangganan. Ketuk untuk upgrade.",
      todayTitle: "Uji coba gratis berakhir hari ini!",
      todayBody: "Akses premium berakhir malam ini. Berlangganan sekarang."
    },
    trialEngagement: {
      day1Title: "Uji Coba Premium Aktif!",
      day1Body: "Buka like tak terbatas, lihat siapa yang menyukaimu, kirim Super Like dan lainnya!",
      day3TitleWithLikes: "{{count}} {{person}} menyukaimu!",
      day3TitleNoLikes: "Kamu diperhatikan!",
      day3BodyWithLikes: "Ketuk untuk melihat siapa mereka - ini fitur Premium yang bisa kamu simpan!",
      day3BodyNoLikes: "Terus gunakan fitur Premium untuk menonjol.",
      day5Title: "Hanya 2 hari tersisa di uji coba!",
      day5BodyWithStats: "Kamu telah {{highlights}}. Jangan kehilangan akses ke fitur ini!",
      day5BodyNoStats: "Kamu telah menjelajahi fitur premium. Berlangganan sekarang!",
      day6Title: "Besok hari terakhir!",
      day6Body: "Dapatkan diskon 33% dengan paket tahunan. Koneksimu menunggu!"
    },
    swipesRefreshed: {
      title: "Geseranmu kembali! 🎉",
      body: "Kamu punya 15 geseran baru. Mulai menggeser sekarang!"
    },
    reviews: {
      readyTitle: "Waktunya Review! ⭐",
      readyBody: "Bagikan pengalamanmu dengan {{name}}.",
      reminderTitle: "Kesempatan Terakhir Review! ⏰",
      reminderBody: "Jendela review untuk {{name}} akan segera ditutup."
    },
    stats: {
      person: "orang",
      people: "orang",
      seenLikes: "melihat {{count}} yang menyukaimu",
      sentSuperLikes: "mengirim {{count}} Super Like",
      sentSuperLikesPlural: "mengirim {{count}} Super Like",
      madeMatch: "membuat {{count}} cocok",
      madeMatchesPlural: "membuat {{count}} cocok"
    }
  },
  ka: {
    match: {
      title: "ეს შესაბამისობაა! 💜",
      body: "თქვენ დაემთხვიეთ {{name}}-ს! დაიწყეთ საუბარი ახლავე."
    },
    message: {
      title: "ახალი შეტყობინება {{name}}-სგან",
      bodyText: "გამოგიგზავნათ შეტყობინება",
      bodyPhoto: "გამოგიგზავნათ ფოტო",
      bodyVoice: "გამოგიგზავნათ ხმოვანი შეტყობინება",
      bodyVideo: "გამოგიგზავნათ ვიდეო"
    },
    like: {
      premiumTitle: "{{name}}-ს მოეწონეთ! 💜",
      premiumBody: "ნახეთ ვინ მოგეწონათ და დაემთხვიეთ მყისიერად.",
      premiumSuperTitle: "{{name}}-მ სუპერ მოიწონა! ⭐",
      premiumSuperBody: "მათ ნამდვილად სურთ თქვენთან დაკავშირება!",
      freeTitle: "ვინმეს მოეწონეთ! 💜",
      freeBody: "განაახლეთ პრემიუმზე რომ ნახოთ ვინ მოგეწონათ.",
      freeSuperTitle: "ვინმემ სუპერ მოიწონა! ⭐",
      freeSuperBody: "განაახლეთ პრემიუმზე რომ ნახოთ ვის სურს თქვენთან შესაბამისობა."
    },
    trialExpiration: {
      threeDaysTitle: "თქვენი უფასო საცდელი პერიოდი მთავრდება 3 დღეში",
      threeDaysBody: "არ დაკარგოთ პრემიუმ ფუნქციებზე წვდომა! გამოიწერეთ ახლავე.",
      oneDayTitle: "თქვენი უფასო საცდელი პერიოდი მთავრდება ხვალ!",
      oneDayBody: "ბოლო შანსი გამოწერისთვის. შეეხეთ განახლებისთვის.",
      todayTitle: "თქვენი უფასო საცდელი პერიოდი მთავრდება დღეს!",
      todayBody: "თქვენი პრემიუმ წვდომა მთავრდება დღეს ღამით. გამოიწერეთ ახლავე."
    },
    trialEngagement: {
      day1Title: "თქვენი პრემიუმ საცდელი პერიოდი აქტიურია!",
      day1Body: "გახსენით შეუზღუდავი მოწონებები, ნახეთ ვინ მოგეწონათ, გაგზავნეთ სუპერ მოწონებები და მეტი!",
      day3TitleWithLikes: "{{count}} {{person}} მოგეწონათ!",
      day3TitleNoLikes: "თქვენ შენიშნავენ!",
      day3BodyWithLikes: "შეეხეთ რომ ნახოთ ვინ არიან - ეს პრემიუმ ფუნქციაა რომელიც შეგიძლიათ შეინახოთ!",
      day3BodyNoLikes: "განაგრძეთ პრემიუმ ფუნქციების გამოყენება გამოსარჩევად.",
      day5Title: "მხოლოდ 2 დღე დარჩა საცდელ პერიოდში!",
      day5BodyWithStats: "თქვენ {{highlights}}. არ დაკარგოთ ამ ფუნქციებზე წვდომა!",
      day5BodyNoStats: "თქვენ შეისწავლეთ პრემიუმ ფუნქციები. გამოიწერეთ ახლავე!",
      day6Title: "ხვალ ბოლო დღეა!",
      day6Body: "მიიღეთ 33% ფასდაკლება წლიური გეგმით. თქვენი კავშირები გელოდებათ!"
    },
    swipesRefreshed: {
      title: "თქვენი გადაფურცლები დაბრუნდა! 🎉",
      body: "თქვენ გაქვთ 15 ახალი გადაფურცვლა. დაიწყეთ გადაფურცვლა ახლავე!"
    },
    reviews: {
      readyTitle: "მიმოხილვის დრო! ⭐",
      readyBody: "გააზიარეთ თქვენი გამოცდილება {{name}}-თან.",
      reminderTitle: "ბოლო შანსი მიმოხილვისთვის! ⏰",
      reminderBody: "თქვენი მიმოხილვის ფანჯარა {{name}}-სთვის მალე იხურება."
    },
    stats: {
      person: "ადამიანი",
      people: "ადამიანი",
      seenLikes: "ნახეთ {{count}} ვინც მოგეწონათ",
      sentSuperLikes: "გაგზავნეთ {{count}} სუპერ მოწონება",
      sentSuperLikesPlural: "გაგზავნეთ {{count}} სუპერ მოწონება",
      madeMatch: "დაემთხვიეთ {{count}} ჯერ",
      madeMatchesPlural: "დაემთხვიეთ {{count}} ჯერ"
    }
  }
};

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, any>, path: string): string | undefined {
  const keys = path.split('.');
  let current: any = obj;

  for (const key of keys) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[key];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Interpolate variables in a string
 * Replaces {{variable}} with the corresponding value from the variables object
 */
function interpolate(text: string, variables: Record<string, string | number>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Normalize language code to a supported language
 * Handles codes like 'en-US' -> 'en', 'zh-CN' -> 'zh'
 */
function normalizeLanguageCode(code: string | null | undefined): string {
  if (!code) return 'en';

  // Get base language code (e.g., 'en-US' -> 'en')
  const baseCode = code.split('-')[0].toLowerCase();

  // Check if we have translations for this language
  if (translations[baseCode]) {
    return baseCode;
  }

  // Default to English
  return 'en';
}

/**
 * Translate a notification string
 *
 * @param languageCode - The user's preferred language (e.g., 'en', 'es', 'ar')
 * @param key - Dot-notation key (e.g., 'match.title', 'like.premiumBody')
 * @param variables - Optional variables for interpolation (e.g., { name: 'John' })
 * @returns The translated string, falling back to English if not found
 *
 * @example
 * t('es', 'match.title') // "¡Es un Match! 💜"
 * t('en', 'match.body', { name: 'John' }) // "You matched with John! Start chatting now."
 * t('ar', 'like.premiumTitle', { name: 'Ahmed' }) // "Ahmed أعجب بك! 💜"
 */
export function t(
  languageCode: string | null | undefined,
  key: string,
  variables: Record<string, string | number> = {}
): string {
  const normalizedCode = normalizeLanguageCode(languageCode);

  // Try to get the translation in the user's language
  let translation = getNestedValue(translations[normalizedCode], key);

  // Fall back to English if not found
  if (!translation && normalizedCode !== 'en') {
    translation = getNestedValue(translations.en, key);
  }

  // If still not found, return the key itself
  if (!translation) {
    console.warn(`[translations] Missing translation for key: ${key}`);
    return key;
  }

  // Interpolate variables
  return interpolate(translation, variables);
}

/**
 * Get the stats person/people word based on count
 */
export function getPersonWord(languageCode: string | null | undefined, count: number): string {
  return count === 1
    ? t(languageCode, 'stats.person')
    : t(languageCode, 'stats.people');
}

/**
 * Build engagement highlights string for day 5 notification
 */
export function buildEngagementHighlights(
  languageCode: string | null | undefined,
  stats: { likesReceived: number; superLikesSent: number; matchesMade: number }
): string {
  const lang = normalizeLanguageCode(languageCode);
  const highlights: string[] = [];

  if (stats.likesReceived > 0) {
    highlights.push(t(lang, 'stats.seenLikes', { count: stats.likesReceived }));
  }
  if (stats.superLikesSent > 0) {
    const key = stats.superLikesSent === 1 ? 'stats.sentSuperLikes' : 'stats.sentSuperLikesPlural';
    highlights.push(t(lang, key, { count: stats.superLikesSent }));
  }
  if (stats.matchesMade > 0) {
    const key = stats.matchesMade === 1 ? 'stats.madeMatch' : 'stats.madeMatchesPlural';
    highlights.push(t(lang, key, { count: stats.matchesMade }));
  }

  // Join with 'and' in the appropriate language
  if (highlights.length === 0) return '';
  if (highlights.length === 1) return highlights[0];

  // Simple join - could be enhanced with proper localized conjunctions
  return highlights.join(' and ');
}

export { translations };
