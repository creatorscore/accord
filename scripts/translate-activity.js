#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Activity center translations for all 18 locales
const translations = {
  ar: {
    profile: { activityCenter: "مركز النشاط", activityCenterFeature: "مركز النشاط" },
    activity: {
      item: {
        likeReceived: "{{name}} أعجب بملفك الشخصي",
        likeReceivedDeleted: "مستخدم أعجب بك غادر Accord",
        likeReceivedSubtitle: "اضغط لرؤية ملفه الشخصي",
        superLikeReceived: "{{name}} أعجب بك بشدة!",
        superLikeReceivedDeleted: "مستخدم أعجب بك بشدة غادر Accord",
        superLikeReceivedSubtitle: "هم حقاً معجبون بك!",
        likeSent: "أعجبت بـ {{name}}",
        likeSentDeleted: "أعجبت بمستخدم غادر Accord",
        likeSentSubtitle: "في انتظار إعجابهم بالمقابل",
        superLikeSent: "أرسلت Super Like لـ {{name}}",
        superLikeSentDeleted: "أرسلت Super Like لمستخدم غادر Accord",
        superLikeSentSubtitle: "في انتظار إعجابهم بالمقابل",
        matched: "تطابقت مع {{name}}!",
        matchedDeleted: "تطابق سابق غادر Accord",
        matchedSubtitle: "اضغط لبدء المحادثة",
        matchedDeletedSubtitle: "هذه المحادثة لم تعد متاحة",
        messageReceived: "رسالة جديدة من {{name}}",
        messageReceivedDeleted: "رسالة من مستخدم غادر Accord",
        messageReceivedDeletedSubtitle: "هذه المحادثة لم تعد متاحة",
        newMessage: "رسالة جديدة",
        reviewReceived: "تلقيت تقييم {{rating}} نجوم",
        reviewReceivedGeneric: "تلقيت تقييماً جديداً",
        profileView: "{{name}} شاهد ملفك الشخصي",
        profileViewDeleted: "مستخدم شاهد ملفك الشخصي غادر Accord",
        profileViewMultiple: "{{count}} أشخاص شاهدوا ملفك الشخصي",
        verificationApproved: "تم التحقق من ملفك الشخصي!",
        verificationApprovedSubtitle: "لديك الآن شارة التحقق",
        someone: "شخص ما",
        defaultName: "شخص ما"
      },
      time: { justNow: "الآن", minutesAgo: "منذ {{count}} د", hoursAgo: "منذ {{count}} س", yesterday: "أمس", daysAgo: "منذ {{count}} ي" }
    }
  },
  fa: {
    profile: { activityCenter: "مرکز فعالیت", activityCenterFeature: "مرکز فعالیت" },
    activity: {
      item: {
        likeReceived: "{{name}} پروفایل شما را پسندید",
        likeReceivedDeleted: "کاربری که شما را پسندید Accord را ترک کرده است",
        likeReceivedSubtitle: "برای دیدن پروفایلشان ضربه بزنید",
        superLikeReceived: "{{name}} شما را Super Like کرد!",
        superLikeReceivedDeleted: "کاربری که شما را Super Like کرد Accord را ترک کرده است",
        superLikeReceivedSubtitle: "آنها واقعاً شما را دوست دارند!",
        likeSent: "شما {{name}} را پسندیدید",
        likeSentDeleted: "شما کاربری را که Accord را ترک کرده پسندیدید",
        likeSentSubtitle: "در انتظار پسند آنها",
        superLikeSent: "شما به {{name}} Super Like فرستادید",
        superLikeSentDeleted: "شما به کاربری که Accord را ترک کرده Super Like فرستادید",
        superLikeSentSubtitle: "در انتظار پسند آنها",
        matched: "شما با {{name}} مچ شدید!",
        matchedDeleted: "یک مچ سابق Accord را ترک کرده است",
        matchedSubtitle: "برای شروع گفتگو ضربه بزنید",
        matchedDeletedSubtitle: "این مکالمه دیگر در دسترس نیست",
        messageReceived: "پیام جدید از {{name}}",
        messageReceivedDeleted: "پیام از کاربری که Accord را ترک کرده",
        messageReceivedDeletedSubtitle: "این مکالمه دیگر در دسترس نیست",
        newMessage: "پیام جدید",
        reviewReceived: "شما یک نظر {{rating}} ستاره دریافت کردید",
        reviewReceivedGeneric: "شما یک نظر جدید دریافت کردید",
        profileView: "{{name}} پروفایل شما را دید",
        profileViewDeleted: "کاربری که پروفایل شما را دید Accord را ترک کرده",
        profileViewMultiple: "{{count}} نفر پروفایل شما را دیدند",
        verificationApproved: "پروفایل شما تأیید شد!",
        verificationApprovedSubtitle: "شما اکنون نشان تأیید دارید",
        someone: "کسی",
        defaultName: "کسی"
      },
      time: { justNow: "همین الان", minutesAgo: "{{count}} دقیقه پیش", hoursAgo: "{{count}} ساعت پیش", yesterday: "دیروز", daysAgo: "{{count}} روز پیش" }
    }
  },
  he: {
    profile: { activityCenter: "מרכז הפעילות", activityCenterFeature: "מרכז הפעילות" },
    activity: {
      item: {
        likeReceived: "{{name}} אהב/ה את הפרופיל שלך",
        likeReceivedDeleted: "משתמש/ת שאהב/ה אותך עזב/ה את Accord",
        likeReceivedSubtitle: "הקש/י כדי לראות את הפרופיל",
        superLikeReceived: "{{name}} שלח/ה לך Super Like!",
        superLikeReceivedDeleted: "משתמש/ת ששלח/ה לך Super Like עזב/ה את Accord",
        superLikeReceivedSubtitle: "הם ממש אוהבים אותך!",
        likeSent: "אהבת את {{name}}",
        likeSentDeleted: "אהבת משתמש/ת שעזב/ה את Accord",
        likeSentSubtitle: "מחכים שהם יאהבו אותך בחזרה",
        superLikeSent: "שלחת Super Like ל-{{name}}",
        superLikeSentDeleted: "שלחת Super Like למשתמש/ת שעזב/ה את Accord",
        superLikeSentSubtitle: "מחכים שהם יאהבו אותך בחזרה",
        matched: "יש לך התאמה עם {{name}}!",
        matchedDeleted: "התאמה קודמת עזב/ה את Accord",
        matchedSubtitle: "הקש/י כדי להתחיל לשוחח",
        matchedDeletedSubtitle: "השיחה הזו כבר לא זמינה",
        messageReceived: "הודעה חדשה מ-{{name}}",
        messageReceivedDeleted: "הודעה ממשתמש/ת שעזב/ה את Accord",
        messageReceivedDeletedSubtitle: "השיחה הזו כבר לא זמינה",
        newMessage: "הודעה חדשה",
        reviewReceived: "קיבלת ביקורת של {{rating}} כוכבים",
        reviewReceivedGeneric: "קיבלת ביקורת חדשה",
        profileView: "{{name}} צפה בפרופיל שלך",
        profileViewDeleted: "משתמש/ת שצפה בפרופיל שלך עזב/ה את Accord",
        profileViewMultiple: "{{count}} אנשים צפו בפרופיל שלך",
        verificationApproved: "הפרופיל שלך אומת!",
        verificationApprovedSubtitle: "יש לך עכשיו תג מאומת",
        someone: "מישהו",
        defaultName: "מישהו"
      },
      time: { justNow: "עכשיו", minutesAgo: "לפני {{count}} ד׳", hoursAgo: "לפני {{count}} ש׳", yesterday: "אתמול", daysAgo: "לפני {{count}} ימים" }
    }
  },
  ur: {
    profile: { activityCenter: "سرگرمی مرکز", activityCenterFeature: "سرگرمی مرکز" },
    activity: {
      item: {
        likeReceived: "{{name}} نے آپ کی پروفائل پسند کی",
        likeReceivedDeleted: "ایک صارف جس نے آپ کو پسند کیا Accord چھوڑ چکا ہے",
        likeReceivedSubtitle: "ان کی پروفائل دیکھنے کے لیے ٹیپ کریں",
        superLikeReceived: "{{name}} نے آپ کو Super Like کیا!",
        superLikeReceivedDeleted: "ایک صارف جس نے آپ کو Super Like کیا Accord چھوڑ چکا ہے",
        superLikeReceivedSubtitle: "وہ واقعی آپ کو پسند کرتے ہیں!",
        likeSent: "آپ نے {{name}} کو پسند کیا",
        likeSentDeleted: "آپ نے ایک صارف کو پسند کیا جس نے Accord چھوڑ دیا",
        likeSentSubtitle: "ان کی پسندیدگی کا انتظار ہے",
        superLikeSent: "آپ نے {{name}} کو Super Like بھیجا",
        superLikeSentDeleted: "آپ نے ایک صارف کو Super Like بھیجا جس نے Accord چھوڑ دیا",
        superLikeSentSubtitle: "ان کی پسندیدگی کا انتظار ہے",
        matched: "آپ کا {{name}} سے میچ ہو گیا!",
        matchedDeleted: "ایک سابقہ میچ Accord چھوڑ چکا ہے",
        matchedSubtitle: "بات چیت شروع کرنے کے لیے ٹیپ کریں",
        matchedDeletedSubtitle: "یہ گفتگو اب دستیاب نہیں ہے",
        messageReceived: "{{name}} کی طرف سے نیا پیغام",
        messageReceivedDeleted: "ایک صارف کی طرف سے پیغام جس نے Accord چھوڑ دیا",
        messageReceivedDeletedSubtitle: "یہ گفتگو اب دستیاب نہیں ہے",
        newMessage: "نیا پیغام",
        reviewReceived: "آپ کو {{rating}} ستاروں کا جائزہ ملا",
        reviewReceivedGeneric: "آپ کو ایک نیا جائزہ ملا",
        profileView: "{{name}} نے آپ کی پروفائل دیکھی",
        profileViewDeleted: "ایک صارف جس نے آپ کی پروفائل دیکھی Accord چھوڑ چکا ہے",
        profileViewMultiple: "{{count}} لوگوں نے آپ کی پروفائل دیکھی",
        verificationApproved: "آپ کی پروفائل تصدیق شدہ ہے!",
        verificationApprovedSubtitle: "آپ کے پاس اب تصدیقی بیج ہے",
        someone: "کوئی",
        defaultName: "کوئی"
      },
      time: { justNow: "ابھی", minutesAgo: "{{count}} منٹ پہلے", hoursAgo: "{{count}} گھنٹے پہلے", yesterday: "کل", daysAgo: "{{count}} دن پہلے" }
    }
  },
  bn: {
    profile: { activityCenter: "কার্যকলাপ কেন্দ্র", activityCenterFeature: "কার্যকলাপ কেন্দ্র" },
    activity: {
      item: {
        likeReceived: "{{name}} আপনার প্রোফাইল পছন্দ করেছে",
        likeReceivedDeleted: "একজন ব্যবহারকারী যিনি আপনাকে পছন্দ করেছিলেন Accord ছেড়ে গেছেন",
        likeReceivedSubtitle: "তাদের প্রোফাইল দেখতে ট্যাপ করুন",
        superLikeReceived: "{{name}} আপনাকে Super Like করেছে!",
        superLikeReceivedDeleted: "একজন ব্যবহারকারী যিনি আপনাকে Super Like করেছিলেন Accord ছেড়ে গেছেন",
        superLikeReceivedSubtitle: "তারা সত্যিই আপনাকে পছন্দ করে!",
        likeSent: "আপনি {{name}} কে পছন্দ করেছেন",
        likeSentDeleted: "আপনি একজন ব্যবহারকারীকে পছন্দ করেছিলেন যিনি Accord ছেড়ে গেছেন",
        likeSentSubtitle: "তাদের পছন্দের অপেক্ষায়",
        superLikeSent: "আপনি {{name}} কে Super Like করেছেন",
        superLikeSentDeleted: "আপনি একজন ব্যবহারকারীকে Super Like করেছিলেন যিনি Accord ছেড়ে গেছেন",
        superLikeSentSubtitle: "তাদের পছন্দের অপেক্ষায়",
        matched: "আপনি {{name}} এর সাথে ম্যাচ হয়েছেন!",
        matchedDeleted: "একজন আগের ম্যাচ Accord ছেড়ে গেছেন",
        matchedSubtitle: "চ্যাট শুরু করতে ট্যাপ করুন",
        matchedDeletedSubtitle: "এই কথোপকথন আর উপলব্ধ নেই",
        messageReceived: "{{name}} থেকে নতুন বার্তা",
        messageReceivedDeleted: "একজন ব্যবহারকারীর বার্তা যিনি Accord ছেড়ে গেছেন",
        messageReceivedDeletedSubtitle: "এই কথোপকথন আর উপলব্ধ নেই",
        newMessage: "নতুন বার্তা",
        reviewReceived: "আপনি {{rating}}-তারা রিভিউ পেয়েছেন",
        reviewReceivedGeneric: "আপনি একটি নতুন রিভিউ পেয়েছেন",
        profileView: "{{name}} আপনার প্রোফাইল দেখেছে",
        profileViewDeleted: "একজন ব্যবহারকারী যিনি আপনার প্রোফাইল দেখেছিলেন Accord ছেড়ে গেছেন",
        profileViewMultiple: "{{count}} জন আপনার প্রোফাইল দেখেছে",
        verificationApproved: "আপনার প্রোফাইল যাচাই হয়েছে!",
        verificationApprovedSubtitle: "আপনার এখন যাচাইকৃত ব্যাজ আছে",
        someone: "কেউ",
        defaultName: "কেউ"
      },
      time: { justNow: "এইমাত্র", minutesAgo: "{{count}} মিনিট আগে", hoursAgo: "{{count}} ঘণ্টা আগে", yesterday: "গতকাল", daysAgo: "{{count}} দিন আগে" }
    }
  },
  de: {
    profile: { activityCenter: "Aktivitätszentrum", activityCenterFeature: "Aktivitätszentrum" },
    activity: {
      item: {
        likeReceived: "{{name}} gefällt dein Profil",
        likeReceivedDeleted: "Ein Nutzer, der dich mochte, hat Accord verlassen",
        likeReceivedSubtitle: "Tippe, um das Profil zu sehen",
        superLikeReceived: "{{name}} hat dir ein Super Like gegeben!",
        superLikeReceivedDeleted: "Ein Nutzer, der dir ein Super Like gab, hat Accord verlassen",
        superLikeReceivedSubtitle: "Du gefällst ihnen wirklich!",
        likeSent: "Du magst {{name}}",
        likeSentDeleted: "Du mochtest einen Nutzer, der Accord verlassen hat",
        likeSentSubtitle: "Warten auf ihr Like zurück",
        superLikeSent: "Du hast {{name}} ein Super Like gegeben",
        superLikeSentDeleted: "Du hast einem Nutzer ein Super Like gegeben, der Accord verlassen hat",
        superLikeSentSubtitle: "Warten auf ihr Like zurück",
        matched: "Du hast ein Match mit {{name}}!",
        matchedDeleted: "Ein ehemaliges Match hat Accord verlassen",
        matchedSubtitle: "Tippe, um zu chatten",
        matchedDeletedSubtitle: "Diese Unterhaltung ist nicht mehr verfügbar",
        messageReceived: "Neue Nachricht von {{name}}",
        messageReceivedDeleted: "Nachricht von einem Nutzer, der Accord verlassen hat",
        messageReceivedDeletedSubtitle: "Diese Unterhaltung ist nicht mehr verfügbar",
        newMessage: "Neue Nachricht",
        reviewReceived: "Du hast eine {{rating}}-Sterne-Bewertung erhalten",
        reviewReceivedGeneric: "Du hast eine neue Bewertung erhalten",
        profileView: "{{name}} hat dein Profil angesehen",
        profileViewDeleted: "Ein Nutzer, der dein Profil ansah, hat Accord verlassen",
        profileViewMultiple: "{{count}} Personen haben dein Profil angesehen",
        verificationApproved: "Dein Profil ist jetzt verifiziert!",
        verificationApprovedSubtitle: "Du hast jetzt ein Verifizierungsabzeichen",
        someone: "Jemand",
        defaultName: "jemand"
      },
      time: { justNow: "Gerade eben", minutesAgo: "vor {{count}}m", hoursAgo: "vor {{count}}h", yesterday: "Gestern", daysAgo: "vor {{count}}T" }
    }
  },
  es: {
    profile: { activityCenter: "Centro de Actividad", activityCenterFeature: "Centro de Actividad" },
    activity: {
      item: {
        likeReceived: "A {{name}} le gustó tu perfil",
        likeReceivedDeleted: "Un usuario que te dio like dejó Accord",
        likeReceivedSubtitle: "Toca para ver su perfil",
        superLikeReceived: "¡{{name}} te dio Super Like!",
        superLikeReceivedDeleted: "Un usuario que te dio Super Like dejó Accord",
        superLikeReceivedSubtitle: "¡Le gustas mucho!",
        likeSent: "Te gustó {{name}}",
        likeSentDeleted: "Le diste like a un usuario que dejó Accord",
        likeSentSubtitle: "Esperando que te den like de vuelta",
        superLikeSent: "Le diste Super Like a {{name}}",
        superLikeSentDeleted: "Le diste Super Like a un usuario que dejó Accord",
        superLikeSentSubtitle: "Esperando que te den like de vuelta",
        matched: "¡Hiciste match con {{name}}!",
        matchedDeleted: "Un match anterior dejó Accord",
        matchedSubtitle: "Toca para empezar a chatear",
        matchedDeletedSubtitle: "Esta conversación ya no está disponible",
        messageReceived: "Nuevo mensaje de {{name}}",
        messageReceivedDeleted: "Mensaje de un usuario que dejó Accord",
        messageReceivedDeletedSubtitle: "Esta conversación ya no está disponible",
        newMessage: "Nuevo mensaje",
        reviewReceived: "Recibiste una reseña de {{rating}} estrellas",
        reviewReceivedGeneric: "Recibiste una nueva reseña",
        profileView: "{{name}} vio tu perfil",
        profileViewDeleted: "Un usuario que vio tu perfil dejó Accord",
        profileViewMultiple: "{{count}} personas vieron tu perfil",
        verificationApproved: "¡Tu perfil está verificado!",
        verificationApprovedSubtitle: "Ahora tienes una insignia de verificación",
        someone: "Alguien",
        defaultName: "alguien"
      },
      time: { justNow: "Ahora", minutesAgo: "hace {{count}}m", hoursAgo: "hace {{count}}h", yesterday: "Ayer", daysAgo: "hace {{count}}d" }
    }
  },
  fr: {
    profile: { activityCenter: "Centre d'activité", activityCenterFeature: "Centre d'activité" },
    activity: {
      item: {
        likeReceived: "{{name}} a aimé votre profil",
        likeReceivedDeleted: "Un utilisateur qui vous a aimé a quitté Accord",
        likeReceivedSubtitle: "Appuyez pour voir son profil",
        superLikeReceived: "{{name}} vous a envoyé un Super Like !",
        superLikeReceivedDeleted: "Un utilisateur qui vous a envoyé un Super Like a quitté Accord",
        superLikeReceivedSubtitle: "Vous lui plaisez vraiment !",
        likeSent: "Vous avez aimé {{name}}",
        likeSentDeleted: "Vous avez aimé un utilisateur qui a quitté Accord",
        likeSentSubtitle: "En attente de leur like en retour",
        superLikeSent: "Vous avez envoyé un Super Like à {{name}}",
        superLikeSentDeleted: "Vous avez envoyé un Super Like à un utilisateur qui a quitté Accord",
        superLikeSentSubtitle: "En attente de leur like en retour",
        matched: "Vous avez matché avec {{name}} !",
        matchedDeleted: "Un ancien match a quitté Accord",
        matchedSubtitle: "Appuyez pour commencer à discuter",
        matchedDeletedSubtitle: "Cette conversation n'est plus disponible",
        messageReceived: "Nouveau message de {{name}}",
        messageReceivedDeleted: "Message d'un utilisateur qui a quitté Accord",
        messageReceivedDeletedSubtitle: "Cette conversation n'est plus disponible",
        newMessage: "Nouveau message",
        reviewReceived: "Vous avez reçu un avis de {{rating}} étoiles",
        reviewReceivedGeneric: "Vous avez reçu un nouvel avis",
        profileView: "{{name}} a consulté votre profil",
        profileViewDeleted: "Un utilisateur qui a consulté votre profil a quitté Accord",
        profileViewMultiple: "{{count}} personnes ont consulté votre profil",
        verificationApproved: "Votre profil est maintenant vérifié !",
        verificationApprovedSubtitle: "Vous avez maintenant un badge de vérification",
        someone: "Quelqu'un",
        defaultName: "quelqu'un"
      },
      time: { justNow: "À l'instant", minutesAgo: "il y a {{count}}m", hoursAgo: "il y a {{count}}h", yesterday: "Hier", daysAgo: "il y a {{count}}j" }
    }
  },
  it: {
    profile: { activityCenter: "Centro Attività", activityCenterFeature: "Centro Attività" },
    activity: {
      item: {
        likeReceived: "A {{name}} piace il tuo profilo",
        likeReceivedDeleted: "Un utente che ti ha messo like ha lasciato Accord",
        likeReceivedSubtitle: "Tocca per vedere il profilo",
        superLikeReceived: "{{name}} ti ha messo Super Like!",
        superLikeReceivedDeleted: "Un utente che ti ha messo Super Like ha lasciato Accord",
        superLikeReceivedSubtitle: "Gli piaci davvero!",
        likeSent: "Ti piace {{name}}",
        likeSentDeleted: "Hai messo like a un utente che ha lasciato Accord",
        likeSentSubtitle: "In attesa del loro like di ritorno",
        superLikeSent: "Hai messo Super Like a {{name}}",
        superLikeSentDeleted: "Hai messo Super Like a un utente che ha lasciato Accord",
        superLikeSentSubtitle: "In attesa del loro like di ritorno",
        matched: "Hai fatto match con {{name}}!",
        matchedDeleted: "Un ex match ha lasciato Accord",
        matchedSubtitle: "Tocca per iniziare a chattare",
        matchedDeletedSubtitle: "Questa conversazione non è più disponibile",
        messageReceived: "Nuovo messaggio da {{name}}",
        messageReceivedDeleted: "Messaggio da un utente che ha lasciato Accord",
        messageReceivedDeletedSubtitle: "Questa conversazione non è più disponibile",
        newMessage: "Nuovo messaggio",
        reviewReceived: "Hai ricevuto una recensione di {{rating}} stelle",
        reviewReceivedGeneric: "Hai ricevuto una nuova recensione",
        profileView: "{{name}} ha visto il tuo profilo",
        profileViewDeleted: "Un utente che ha visto il tuo profilo ha lasciato Accord",
        profileViewMultiple: "{{count}} persone hanno visto il tuo profilo",
        verificationApproved: "Il tuo profilo è ora verificato!",
        verificationApprovedSubtitle: "Ora hai un badge di verifica",
        someone: "Qualcuno",
        defaultName: "qualcuno"
      },
      time: { justNow: "Adesso", minutesAgo: "{{count}}m fa", hoursAgo: "{{count}}h fa", yesterday: "Ieri", daysAgo: "{{count}}g fa" }
    }
  },
  pt: {
    profile: { activityCenter: "Centro de Atividade", activityCenterFeature: "Centro de Atividade" },
    activity: {
      item: {
        likeReceived: "{{name}} curtiu seu perfil",
        likeReceivedDeleted: "Um usuário que curtiu você saiu do Accord",
        likeReceivedSubtitle: "Toque para ver o perfil",
        superLikeReceived: "{{name}} te deu Super Like!",
        superLikeReceivedDeleted: "Um usuário que te deu Super Like saiu do Accord",
        superLikeReceivedSubtitle: "Eles realmente gostam de você!",
        likeSent: "Você curtiu {{name}}",
        likeSentDeleted: "Você curtiu um usuário que saiu do Accord",
        likeSentSubtitle: "Esperando a curtida de volta",
        superLikeSent: "Você deu Super Like em {{name}}",
        superLikeSentDeleted: "Você deu Super Like em um usuário que saiu do Accord",
        superLikeSentSubtitle: "Esperando a curtida de volta",
        matched: "Você deu match com {{name}}!",
        matchedDeleted: "Um match anterior saiu do Accord",
        matchedSubtitle: "Toque para começar a conversar",
        matchedDeletedSubtitle: "Esta conversa não está mais disponível",
        messageReceived: "Nova mensagem de {{name}}",
        messageReceivedDeleted: "Mensagem de um usuário que saiu do Accord",
        messageReceivedDeletedSubtitle: "Esta conversa não está mais disponível",
        newMessage: "Nova mensagem",
        reviewReceived: "Você recebeu uma avaliação de {{rating}} estrelas",
        reviewReceivedGeneric: "Você recebeu uma nova avaliação",
        profileView: "{{name}} viu seu perfil",
        profileViewDeleted: "Um usuário que viu seu perfil saiu do Accord",
        profileViewMultiple: "{{count}} pessoas viram seu perfil",
        verificationApproved: "Seu perfil foi verificado!",
        verificationApprovedSubtitle: "Você agora tem um selo de verificação",
        someone: "Alguém",
        defaultName: "alguém"
      },
      time: { justNow: "Agora", minutesAgo: "{{count}}m atrás", hoursAgo: "{{count}}h atrás", yesterday: "Ontem", daysAgo: "{{count}}d atrás" }
    }
  },
  ru: {
    profile: { activityCenter: "Центр активности", activityCenterFeature: "Центр активности" },
    activity: {
      item: {
        likeReceived: "{{name}} понравился ваш профиль",
        likeReceivedDeleted: "Пользователь, которому вы понравились, покинул Accord",
        likeReceivedSubtitle: "Нажмите, чтобы увидеть профиль",
        superLikeReceived: "{{name}} отправил вам Super Like!",
        superLikeReceivedDeleted: "Пользователь, отправивший Super Like, покинул Accord",
        superLikeReceivedSubtitle: "Вы им очень нравитесь!",
        likeSent: "Вам понравился {{name}}",
        likeSentDeleted: "Вам понравился пользователь, который покинул Accord",
        likeSentSubtitle: "Ожидание ответного лайка",
        superLikeSent: "Вы отправили Super Like {{name}}",
        superLikeSentDeleted: "Вы отправили Super Like пользователю, который покинул Accord",
        superLikeSentSubtitle: "Ожидание ответного лайка",
        matched: "У вас совпадение с {{name}}!",
        matchedDeleted: "Бывший мэтч покинул Accord",
        matchedSubtitle: "Нажмите, чтобы начать общение",
        matchedDeletedSubtitle: "Этот разговор больше недоступен",
        messageReceived: "Новое сообщение от {{name}}",
        messageReceivedDeleted: "Сообщение от пользователя, покинувшего Accord",
        messageReceivedDeletedSubtitle: "Этот разговор больше недоступен",
        newMessage: "Новое сообщение",
        reviewReceived: "Вы получили отзыв на {{rating}} звёзд",
        reviewReceivedGeneric: "Вы получили новый отзыв",
        profileView: "{{name}} просмотрел ваш профиль",
        profileViewDeleted: "Пользователь, просмотревший ваш профиль, покинул Accord",
        profileViewMultiple: "{{count}} человек просмотрели ваш профиль",
        verificationApproved: "Ваш профиль подтверждён!",
        verificationApprovedSubtitle: "Теперь у вас есть значок подтверждения",
        someone: "Кто-то",
        defaultName: "кто-то"
      },
      time: { justNow: "Только что", minutesAgo: "{{count}} мин назад", hoursAgo: "{{count}} ч назад", yesterday: "Вчера", daysAgo: "{{count}} дн назад" }
    }
  },
  tr: {
    profile: { activityCenter: "Etkinlik Merkezi", activityCenterFeature: "Etkinlik Merkezi" },
    activity: {
      item: {
        likeReceived: "{{name}} profilini beğendi",
        likeReceivedDeleted: "Seni beğenen bir kullanıcı Accord'dan ayrıldı",
        likeReceivedSubtitle: "Profilini görmek için dokun",
        superLikeReceived: "{{name}} sana Super Like gönderdi!",
        superLikeReceivedDeleted: "Sana Super Like gönderen bir kullanıcı Accord'dan ayrıldı",
        superLikeReceivedSubtitle: "Seni gerçekten beğeniyorlar!",
        likeSent: "{{name}} beğendin",
        likeSentDeleted: "Accord'dan ayrılan bir kullanıcıyı beğendin",
        likeSentSubtitle: "Karşılık beğeni bekleniyor",
        superLikeSent: "{{name}} kullanıcısına Super Like gönderdin",
        superLikeSentDeleted: "Accord'dan ayrılan bir kullanıcıya Super Like gönderdin",
        superLikeSentSubtitle: "Karşılık beğeni bekleniyor",
        matched: "{{name}} ile eşleştin!",
        matchedDeleted: "Eski bir eşleşme Accord'dan ayrıldı",
        matchedSubtitle: "Sohbet başlatmak için dokun",
        matchedDeletedSubtitle: "Bu sohbet artık mevcut değil",
        messageReceived: "{{name}} adlı kişiden yeni mesaj",
        messageReceivedDeleted: "Accord'dan ayrılan bir kullanıcıdan mesaj",
        messageReceivedDeletedSubtitle: "Bu sohbet artık mevcut değil",
        newMessage: "Yeni mesaj",
        reviewReceived: "{{rating}} yıldızlı bir değerlendirme aldın",
        reviewReceivedGeneric: "Yeni bir değerlendirme aldın",
        profileView: "{{name}} profilini görüntüledi",
        profileViewDeleted: "Profilini görüntüleyen bir kullanıcı Accord'dan ayrıldı",
        profileViewMultiple: "{{count}} kişi profilini görüntüledi",
        verificationApproved: "Profilin artık doğrulanmış!",
        verificationApprovedSubtitle: "Artık doğrulanmış rozetin var",
        someone: "Biri",
        defaultName: "biri"
      },
      time: { justNow: "Az önce", minutesAgo: "{{count}}dk önce", hoursAgo: "{{count}}sa önce", yesterday: "Dün", daysAgo: "{{count}}g önce" }
    }
  },
  uk: {
    profile: { activityCenter: "Центр активності", activityCenterFeature: "Центр активності" },
    activity: {
      item: {
        likeReceived: "{{name}} вподобав ваш профіль",
        likeReceivedDeleted: "Користувач, якому ви сподобались, залишив Accord",
        likeReceivedSubtitle: "Натисніть, щоб переглянути профіль",
        superLikeReceived: "{{name}} надіслав вам Super Like!",
        superLikeReceivedDeleted: "Користувач, що надіслав Super Like, залишив Accord",
        superLikeReceivedSubtitle: "Ви їм дуже подобаєтесь!",
        likeSent: "Вам сподобався {{name}}",
        likeSentDeleted: "Вам сподобався користувач, який залишив Accord",
        likeSentSubtitle: "Очікуємо на відповідний лайк",
        superLikeSent: "Ви надіслали Super Like {{name}}",
        superLikeSentDeleted: "Ви надіслали Super Like користувачу, який залишив Accord",
        superLikeSentSubtitle: "Очікуємо на відповідний лайк",
        matched: "У вас збіг з {{name}}!",
        matchedDeleted: "Колишній збіг залишив Accord",
        matchedSubtitle: "Натисніть, щоб почати спілкування",
        matchedDeletedSubtitle: "Ця розмова більше недоступна",
        messageReceived: "Нове повідомлення від {{name}}",
        messageReceivedDeleted: "Повідомлення від користувача, який залишив Accord",
        messageReceivedDeletedSubtitle: "Ця розмова більше недоступна",
        newMessage: "Нове повідомлення",
        reviewReceived: "Ви отримали відгук на {{rating}} зірок",
        reviewReceivedGeneric: "Ви отримали новий відгук",
        profileView: "{{name}} переглянув ваш профіль",
        profileViewDeleted: "Користувач, що переглянув ваш профіль, залишив Accord",
        profileViewMultiple: "{{count}} людей переглянули ваш профіль",
        verificationApproved: "Ваш профіль підтверджено!",
        verificationApprovedSubtitle: "Тепер у вас є значок підтвердження",
        someone: "Хтось",
        defaultName: "хтось"
      },
      time: { justNow: "Щойно", minutesAgo: "{{count}} хв тому", hoursAgo: "{{count}} год тому", yesterday: "Вчора", daysAgo: "{{count}} дн тому" }
    }
  },
  pl: {
    profile: { activityCenter: "Centrum Aktywności", activityCenterFeature: "Centrum Aktywności" },
    activity: {
      item: {
        likeReceived: "{{name}} polubił/a Twój profil",
        likeReceivedDeleted: "Użytkownik, który Cię polubił, opuścił Accord",
        likeReceivedSubtitle: "Stuknij, aby zobaczyć profil",
        superLikeReceived: "{{name}} wysłał/a Ci Super Like!",
        superLikeReceivedDeleted: "Użytkownik, który wysłał Ci Super Like, opuścił Accord",
        superLikeReceivedSubtitle: "Naprawdę Cię lubią!",
        likeSent: "Polubiłeś/aś {{name}}",
        likeSentDeleted: "Polubiłeś/aś użytkownika, który opuścił Accord",
        likeSentSubtitle: "Czekamy na ich polubienie",
        superLikeSent: "Wysłałeś/aś Super Like do {{name}}",
        superLikeSentDeleted: "Wysłałeś/aś Super Like użytkownikowi, który opuścił Accord",
        superLikeSentSubtitle: "Czekamy na ich polubienie",
        matched: "Dopasowałeś/aś się z {{name}}!",
        matchedDeleted: "Poprzednie dopasowanie opuściło Accord",
        matchedSubtitle: "Stuknij, aby rozpocząć czat",
        matchedDeletedSubtitle: "Ta rozmowa nie jest już dostępna",
        messageReceived: "Nowa wiadomość od {{name}}",
        messageReceivedDeleted: "Wiadomość od użytkownika, który opuścił Accord",
        messageReceivedDeletedSubtitle: "Ta rozmowa nie jest już dostępna",
        newMessage: "Nowa wiadomość",
        reviewReceived: "Otrzymałeś/aś opinię {{rating}} gwiazdek",
        reviewReceivedGeneric: "Otrzymałeś/aś nową opinię",
        profileView: "{{name}} obejrzał/a Twój profil",
        profileViewDeleted: "Użytkownik, który obejrzał Twój profil, opuścił Accord",
        profileViewMultiple: "{{count}} osób obejrzało Twój profil",
        verificationApproved: "Twój profil jest zweryfikowany!",
        verificationApprovedSubtitle: "Masz teraz odznakę weryfikacji",
        someone: "Ktoś",
        defaultName: "ktoś"
      },
      time: { justNow: "Przed chwilą", minutesAgo: "{{count}} min temu", hoursAgo: "{{count}} godz. temu", yesterday: "Wczoraj", daysAgo: "{{count}} dn. temu" }
    }
  },
  hi: {
    profile: { activityCenter: "गतिविधि केंद्र", activityCenterFeature: "गतिविधि केंद्र" },
    activity: {
      item: {
        likeReceived: "{{name}} को आपकी प्रोफ़ाइल पसंद आई",
        likeReceivedDeleted: "एक उपयोगकर्ता जिसने आपको पसंद किया Accord छोड़ चुका है",
        likeReceivedSubtitle: "प्रोफ़ाइल देखने के लिए टैप करें",
        superLikeReceived: "{{name}} ने आपको Super Like भेजा!",
        superLikeReceivedDeleted: "एक उपयोगकर्ता जिसने आपको Super Like भेजा Accord छोड़ चुका है",
        superLikeReceivedSubtitle: "आप उन्हें बहुत पसंद हैं!",
        likeSent: "आपने {{name}} को पसंद किया",
        likeSentDeleted: "आपने एक उपयोगकर्ता को पसंद किया जो Accord छोड़ चुका है",
        likeSentSubtitle: "उनके लाइक का इंतज़ार",
        superLikeSent: "आपने {{name}} को Super Like भेजा",
        superLikeSentDeleted: "आपने एक उपयोगकर्ता को Super Like भेजा जो Accord छोड़ चुका है",
        superLikeSentSubtitle: "उनके लाइक का इंतज़ार",
        matched: "{{name}} से आपका मैच हुआ!",
        matchedDeleted: "एक पूर्व मैच Accord छोड़ चुका है",
        matchedSubtitle: "चैट शुरू करने के लिए टैप करें",
        matchedDeletedSubtitle: "यह बातचीत अब उपलब्ध नहीं है",
        messageReceived: "{{name}} से नया संदेश",
        messageReceivedDeleted: "एक उपयोगकर्ता का संदेश जो Accord छोड़ चुका है",
        messageReceivedDeletedSubtitle: "यह बातचीत अब उपलब्ध नहीं है",
        newMessage: "नया संदेश",
        reviewReceived: "आपको {{rating}}-स्टार समीक्षा मिली",
        reviewReceivedGeneric: "आपको एक नई समीक्षा मिली",
        profileView: "{{name}} ने आपकी प्रोफ़ाइल देखी",
        profileViewDeleted: "एक उपयोगकर्ता जिसने आपकी प्रोफ़ाइल देखी Accord छोड़ चुका है",
        profileViewMultiple: "{{count}} लोगों ने आपकी प्रोफ़ाइल देखी",
        verificationApproved: "आपकी प्रोफ़ाइल सत्यापित हो गई!",
        verificationApprovedSubtitle: "अब आपके पास सत्यापन बैज है",
        someone: "कोई",
        defaultName: "कोई"
      },
      time: { justNow: "अभी", minutesAgo: "{{count}} मिनट पहले", hoursAgo: "{{count}} घंटे पहले", yesterday: "कल", daysAgo: "{{count}} दिन पहले" }
    }
  },
  id: {
    profile: { activityCenter: "Pusat Aktivitas", activityCenterFeature: "Pusat Aktivitas" },
    activity: {
      item: {
        likeReceived: "{{name}} menyukai profil Anda",
        likeReceivedDeleted: "Pengguna yang menyukai Anda telah meninggalkan Accord",
        likeReceivedSubtitle: "Ketuk untuk melihat profil mereka",
        superLikeReceived: "{{name}} memberi Anda Super Like!",
        superLikeReceivedDeleted: "Pengguna yang memberi Super Like telah meninggalkan Accord",
        superLikeReceivedSubtitle: "Mereka benar-benar menyukai Anda!",
        likeSent: "Anda menyukai {{name}}",
        likeSentDeleted: "Anda menyukai pengguna yang telah meninggalkan Accord",
        likeSentSubtitle: "Menunggu mereka menyukai Anda kembali",
        superLikeSent: "Anda memberi Super Like ke {{name}}",
        superLikeSentDeleted: "Anda memberi Super Like ke pengguna yang telah meninggalkan Accord",
        superLikeSentSubtitle: "Menunggu mereka menyukai Anda kembali",
        matched: "Anda cocok dengan {{name}}!",
        matchedDeleted: "Kecocokan sebelumnya telah meninggalkan Accord",
        matchedSubtitle: "Ketuk untuk mulai mengobrol",
        matchedDeletedSubtitle: "Percakapan ini tidak lagi tersedia",
        messageReceived: "Pesan baru dari {{name}}",
        messageReceivedDeleted: "Pesan dari pengguna yang telah meninggalkan Accord",
        messageReceivedDeletedSubtitle: "Percakapan ini tidak lagi tersedia",
        newMessage: "Pesan baru",
        reviewReceived: "Anda menerima ulasan {{rating}} bintang",
        reviewReceivedGeneric: "Anda menerima ulasan baru",
        profileView: "{{name}} melihat profil Anda",
        profileViewDeleted: "Pengguna yang melihat profil Anda telah meninggalkan Accord",
        profileViewMultiple: "{{count}} orang melihat profil Anda",
        verificationApproved: "Profil Anda sekarang terverifikasi!",
        verificationApprovedSubtitle: "Anda sekarang memiliki lencana verifikasi",
        someone: "Seseorang",
        defaultName: "seseorang"
      },
      time: { justNow: "Baru saja", minutesAgo: "{{count}}m lalu", hoursAgo: "{{count}}j lalu", yesterday: "Kemarin", daysAgo: "{{count}}h lalu" }
    }
  },
  ka: {
    profile: { activityCenter: "აქტივობის ცენტრი", activityCenterFeature: "აქტივობის ცენტრი" },
    activity: {
      item: {
        likeReceived: "{{name}}-ს მოეწონა თქვენი პროფილი",
        likeReceivedDeleted: "მომხმარებელმა, რომელსაც მოეწონეთ, დატოვა Accord",
        likeReceivedSubtitle: "შეეხეთ პროფილის სანახავად",
        superLikeReceived: "{{name}}-მ გამოგიგზავნათ Super Like!",
        superLikeReceivedDeleted: "მომხმარებელმა, რომელმაც Super Like გამოგიგზავნათ, დატოვა Accord",
        superLikeReceivedSubtitle: "თქვენ მართლა მოსწონხართ!",
        likeSent: "მოგეწონათ {{name}}",
        likeSentDeleted: "მოგეწონათ მომხმარებელი, რომელმაც დატოვა Accord",
        likeSentSubtitle: "მათი მოწონების მოლოდინში",
        superLikeSent: "გაუგზავნეთ Super Like {{name}}-ს",
        superLikeSentDeleted: "გაუგზავნეთ Super Like მომხმარებელს, რომელმაც დატოვა Accord",
        superLikeSentSubtitle: "მათი მოწონების მოლოდინში",
        matched: "დაემთხვიეთ {{name}}-ს!",
        matchedDeleted: "ყოფილმა მატჩმა დატოვა Accord",
        matchedSubtitle: "შეეხეთ ჩატის დასაწყებად",
        matchedDeletedSubtitle: "ეს საუბარი აღარ არის ხელმისაწვდომი",
        messageReceived: "ახალი შეტყობინება {{name}}-სგან",
        messageReceivedDeleted: "შეტყობინება მომხმარებლისგან, რომელმაც დატოვა Accord",
        messageReceivedDeletedSubtitle: "ეს საუბარი აღარ არის ხელმისაწვდომი",
        newMessage: "ახალი შეტყობინება",
        reviewReceived: "მიიღეთ {{rating}}-ვარსკვლავიანი მიმოხილვა",
        reviewReceivedGeneric: "მიიღეთ ახალი მიმოხილვა",
        profileView: "{{name}}-მ ნახა თქვენი პროფილი",
        profileViewDeleted: "მომხმარებელმა, რომელმაც ნახა თქვენი პროფილი, დატოვა Accord",
        profileViewMultiple: "{{count}} ადამიანმა ნახა თქვენი პროფილი",
        verificationApproved: "თქვენი პროფილი დადასტურებულია!",
        verificationApprovedSubtitle: "ახლა გაქვთ დადასტურების ბეჯი",
        someone: "ვიღაც",
        defaultName: "ვიღაც"
      },
      time: { justNow: "ახლახანს", minutesAgo: "{{count}} წთ წინ", hoursAgo: "{{count}} სთ წინ", yesterday: "გუშინ", daysAgo: "{{count}} დღის წინ" }
    }
  },
  zh: {
    profile: { activityCenter: "活动中心", activityCenterFeature: "活动中心" },
    activity: {
      item: {
        likeReceived: "{{name}} 喜欢了你的个人资料",
        likeReceivedDeleted: "一位喜欢过你的用户已离开 Accord",
        likeReceivedSubtitle: "点击查看他们的个人资料",
        superLikeReceived: "{{name}} 给你发了 Super Like！",
        superLikeReceivedDeleted: "一位给你发过 Super Like 的用户已离开 Accord",
        superLikeReceivedSubtitle: "他们真的很喜欢你！",
        likeSent: "你喜欢了 {{name}}",
        likeSentDeleted: "你喜欢的一位用户已离开 Accord",
        likeSentSubtitle: "等待他们回应喜欢",
        superLikeSent: "你给 {{name}} 发了 Super Like",
        superLikeSentDeleted: "你给一位已离开 Accord 的用户发了 Super Like",
        superLikeSentSubtitle: "等待他们回应喜欢",
        matched: "你和 {{name}} 配对成功！",
        matchedDeleted: "一位前匹配对象已离开 Accord",
        matchedSubtitle: "点击开始聊天",
        matchedDeletedSubtitle: "此对话已不可用",
        messageReceived: "来自 {{name}} 的新消息",
        messageReceivedDeleted: "来自已离开 Accord 的用户的消息",
        messageReceivedDeletedSubtitle: "此对话已不可用",
        newMessage: "新消息",
        reviewReceived: "你收到了 {{rating}} 星评价",
        reviewReceivedGeneric: "你收到了一条新评价",
        profileView: "{{name}} 查看了你的个人资料",
        profileViewDeleted: "一位查看过你个人资料的用户已离开 Accord",
        profileViewMultiple: "{{count}} 人查看了你的个人资料",
        verificationApproved: "你的个人资料已验证！",
        verificationApprovedSubtitle: "你现在拥有验证徽章",
        someone: "有人",
        defaultName: "某人"
      },
      time: { justNow: "刚刚", minutesAgo: "{{count}}分钟前", hoursAgo: "{{count}}小时前", yesterday: "昨天", daysAgo: "{{count}}天前" }
    }
  }
};

// Deep merge helper
function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], value);
    } else {
      if (target[key] === undefined) target[key] = value;
    }
  }
  return target;
}

const localesDir = path.join(__dirname, '..', 'locales');

for (const [lang, trans] of Object.entries(translations)) {
  const filePath = path.join(localesDir, `${lang}.json`);
  const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  deepMerge(existing, trans);
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  console.log(`✅ ${lang}.json updated`);
}

console.log('\nDone! All 18 locales updated with activity center translations.');
