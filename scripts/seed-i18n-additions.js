#!/usr/bin/env node
/**
 * Adds the latest batch of translation keys to all 19 non-English locale files.
 *
 * Keys added:
 *   - common.errorBoundary.{title,message,restart}
 *   - common.update.{forcedTitle,softTitle,forcedBody,softBody,updateButton,notNow,
 *       nativeTitleRequired,nativeTitleAvailable,nativeBodyRequired,nativeBodyAvailable,
 *       nativeUpdateNow,nativeLater}
 *   - discover.match.{itsA,exclamation,bothLiked,sendMessage,keepBrowsing}
 *   - toast.{newMessageFrom,userLikesYou,someoneLikesYou,tapToSeeProfile,
 *       upgradeToSeePremium,reactedWith,tapToViewConversation}
 *   - matches.{matchCountTitle,matchCountSubtitleFree,matchCountSubtitleWarning,matchCountSubtitleFull}
 *
 * Run: node scripts/seed-i18n-additions.js
 */

const fs = require('fs');
const path = require('path');

const LOCALES = [
  'ar', 'bn', 'de', 'es', 'fa', 'fr', 'he', 'hi', 'id', 'it',
  'ka', 'pl', 'pt', 'ru', 'tr', 'uk', 'ur', 'zh',
];

const T = {
  ar: {
    errorBoundary: {
      title: 'عذراً! حدث خطأ ما',
      message: 'واجهنا خطأً غير متوقع. يرجى إعادة تشغيل التطبيق.',
      restart: 'إعادة تشغيل التطبيق',
    },
    update: {
      forcedTitle: 'أجرينا بعض التغييرات المهمة',
      softTitle: 'شيء جديد في انتظارك',
      forcedBody: 'هذه النسخة من أكورد لم تعد مدعومة. قم بالتحديث للحفاظ على أمان محادثاتك وتشغيل كل شيء بسلاسة.',
      softBody: 'إصدار أحدث من أكورد متاح مع تحسينات ستعجبك.',
      updateButton: 'تحديث أكورد',
      notNow: 'ليس الآن',
      nativeTitleRequired: 'التحديث مطلوب',
      nativeTitleAvailable: 'تحديث متوفر',
      nativeBodyRequired: 'يلزم تحديث أكورد للمتابعة. يرجى التحديث الآن.',
      nativeBodyAvailable: 'إصدار جديد من أكورد متاح مع تحسينات وإصلاحات للأخطاء.',
      nativeUpdateNow: 'تحديث الآن',
      nativeLater: 'لاحقاً',
    },
    match: {
      itsA: 'هذا',
      exclamation: 'توافق!',
      bothLiked: 'أنتما أعجبتما ببعضكما — أنت و{{name}}',
      sendMessage: 'أرسل رسالة',
      keepBrowsing: 'متابعة التصفح',
    },
    toast: {
      newMessageFrom: 'رسالة جديدة من {{name}}',
      userLikesYou: '{{name}} معجب بك!',
      someoneLikesYou: 'شخص ما معجب بك!',
      tapToSeeProfile: 'اضغط لرؤية ملفه الشخصي',
      upgradeToSeePremium: 'ترقّ إلى بريميوم لمعرفة من',
      reactedWith: 'تفاعل {{name}} بـ {{emoji}}',
      tapToViewConversation: 'اضغط لعرض المحادثة',
    },
    matches: {
      matchCountTitle: '{{current}} من {{limit}} توافقات نشطة',
      matchCountSubtitleFree: 'الخطة المجانية',
      matchCountSubtitleWarning: 'تكاد تمتلئ — احصل على توافقات غير محدودة',
      matchCountSubtitleFull: 'ألغِ توافقاً مع شخص ما أو ترقَّ للحصول على توافقات غير محدودة',
    },
  },

  bn: {
    errorBoundary: {
      title: 'ওহ! কিছু একটা ভুল হয়েছে',
      message: 'আমরা একটি অপ্রত্যাশিত ত্রুটির সম্মুখীন হয়েছি। অনুগ্রহ করে অ্যাপটি পুনরায় চালু করুন।',
      restart: 'অ্যাপ পুনরায় চালু করুন',
    },
    update: {
      forcedTitle: 'আমরা কিছু গুরুত্বপূর্ণ পরিবর্তন করেছি',
      softTitle: 'নতুন কিছু আপনার জন্য অপেক্ষা করছে',
      forcedBody: 'Accord-এর এই সংস্করণটি আর সমর্থিত নয়। আপনার কথোপকথন সুরক্ষিত রাখতে এবং সবকিছু মসৃণভাবে চালাতে আপডেট করুন।',
      softBody: 'Accord-এর একটি নতুন সংস্করণ উপলব্ধ যাতে আপনি উপভোগ করবেন এমন উন্নতি রয়েছে।',
      updateButton: 'Accord আপডেট করুন',
      notNow: 'এখন নয়',
      nativeTitleRequired: 'আপডেট প্রয়োজন',
      nativeTitleAvailable: 'আপডেট উপলব্ধ',
      nativeBodyRequired: 'চালিয়ে যেতে Accord-এর একটি নতুন সংস্করণ প্রয়োজন। অনুগ্রহ করে এখন আপডেট করুন।',
      nativeBodyAvailable: 'উন্নতি এবং বাগ ফিক্স সহ Accord-এর একটি নতুন সংস্করণ উপলব্ধ।',
      nativeUpdateNow: 'এখন আপডেট করুন',
      nativeLater: 'পরে',
    },
    match: {
      itsA: 'এটা একটা',
      exclamation: 'ম্যাচ!',
      bothLiked: 'আপনি এবং {{name}} একে অপরকে পছন্দ করেছেন',
      sendMessage: 'একটি বার্তা পাঠান',
      keepBrowsing: 'ব্রাউজিং চালিয়ে যান',
    },
    toast: {
      newMessageFrom: '{{name}} থেকে নতুন বার্তা',
      userLikesYou: '{{name}} আপনাকে পছন্দ করে!',
      someoneLikesYou: 'কেউ আপনাকে পছন্দ করে!',
      tapToSeeProfile: 'তাদের প্রোফাইল দেখতে ট্যাপ করুন',
      upgradeToSeePremium: 'কে তা দেখতে প্রিমিয়ামে আপগ্রেড করুন',
      reactedWith: '{{name}} {{emoji}} দিয়ে প্রতিক্রিয়া জানিয়েছে',
      tapToViewConversation: 'কথোপকথন দেখতে ট্যাপ করুন',
    },
    matches: {
      matchCountTitle: '{{limit}}-এর মধ্যে {{current}}টি সক্রিয় ম্যাচ',
      matchCountSubtitleFree: 'ফ্রি প্ল্যান',
      matchCountSubtitleWarning: 'প্রায় পূর্ণ — সীমাহীন ম্যাচ পান',
      matchCountSubtitleFull: 'কাউকে আনম্যাচ করুন বা সীমাহীনের জন্য আপগ্রেড করুন',
    },
  },

  de: {
    errorBoundary: {
      title: 'Hoppla! Etwas ist schiefgelaufen',
      message: 'Ein unerwarteter Fehler ist aufgetreten. Bitte starte die App neu.',
      restart: 'App neu starten',
    },
    update: {
      forcedTitle: 'Wir haben einige wichtige Änderungen vorgenommen',
      softTitle: 'Etwas Neues wartet auf dich',
      forcedBody: 'Diese Version von Accord wird nicht mehr unterstützt. Aktualisiere, damit deine Unterhaltungen sicher bleiben und alles reibungslos läuft.',
      softBody: 'Eine neuere Version von Accord ist verfügbar – mit Verbesserungen, die dir gefallen werden.',
      updateButton: 'Accord aktualisieren',
      notNow: 'Nicht jetzt',
      nativeTitleRequired: 'Update erforderlich',
      nativeTitleAvailable: 'Update verfügbar',
      nativeBodyRequired: 'Für Accord ist eine neue Version erforderlich, um fortzufahren. Bitte jetzt aktualisieren.',
      nativeBodyAvailable: 'Eine neue Version von Accord ist mit Verbesserungen und Fehlerbehebungen verfügbar.',
      nativeUpdateNow: 'Jetzt aktualisieren',
      nativeLater: 'Später',
    },
    match: {
      itsA: 'Es ist ein',
      exclamation: 'Match!',
      bothLiked: 'Du und {{name}} mögt euch',
      sendMessage: 'Nachricht senden',
      keepBrowsing: 'Weiter stöbern',
    },
    toast: {
      newMessageFrom: 'Neue Nachricht von {{name}}',
      userLikesYou: '{{name}} mag dich!',
      someoneLikesYou: 'Jemand mag dich!',
      tapToSeeProfile: 'Tippe, um das Profil zu sehen',
      upgradeToSeePremium: 'Upgrade auf Premium, um zu sehen, wer',
      reactedWith: '{{name}} hat mit {{emoji}} reagiert',
      tapToViewConversation: 'Tippe, um die Unterhaltung zu sehen',
    },
    matches: {
      matchCountTitle: '{{current}} von {{limit}} aktiven Matches',
      matchCountSubtitleFree: 'Kostenloser Tarif',
      matchCountSubtitleWarning: 'Fast voll – erhalte unbegrenzte Matches',
      matchCountSubtitleFull: 'Beende ein Match oder upgrade für unbegrenzte Matches',
    },
  },

  es: {
    errorBoundary: {
      title: '¡Ups! Algo salió mal',
      message: 'Encontramos un error inesperado. Intenta reiniciar la aplicación.',
      restart: 'Reiniciar app',
    },
    update: {
      forcedTitle: 'Hemos hecho algunos cambios importantes',
      softTitle: 'Algo nuevo te está esperando',
      forcedBody: 'Esta versión de Accord ya no es compatible. Actualiza para mantener tus conversaciones seguras y que todo funcione sin problemas.',
      softBody: 'Hay una versión más nueva de Accord disponible con mejoras que te gustarán.',
      updateButton: 'Actualizar Accord',
      notNow: 'Ahora no',
      nativeTitleRequired: 'Actualización requerida',
      nativeTitleAvailable: 'Actualización disponible',
      nativeBodyRequired: 'Se requiere una nueva versión de Accord para continuar. Actualiza ahora.',
      nativeBodyAvailable: 'Hay una nueva versión de Accord disponible con mejoras y correcciones de errores.',
      nativeUpdateNow: 'Actualizar ahora',
      nativeLater: 'Más tarde',
    },
    match: {
      itsA: 'Es un',
      exclamation: '¡Match!',
      bothLiked: 'A ti y a {{name}} os habéis gustado',
      sendMessage: 'Enviar mensaje',
      keepBrowsing: 'Seguir explorando',
    },
    toast: {
      newMessageFrom: 'Nuevo mensaje de {{name}}',
      userLikesYou: '¡A {{name}} le gustas!',
      someoneLikesYou: '¡A alguien le gustas!',
      tapToSeeProfile: 'Toca para ver su perfil',
      upgradeToSeePremium: 'Actualiza a Premium para ver quién',
      reactedWith: '{{name}} reaccionó con {{emoji}}',
      tapToViewConversation: 'Toca para ver la conversación',
    },
    matches: {
      matchCountTitle: '{{current}} de {{limit}} matches activos',
      matchCountSubtitleFree: 'Plan gratuito',
      matchCountSubtitleWarning: 'Casi lleno — obtén matches ilimitados',
      matchCountSubtitleFull: 'Elimina un match o actualiza para tenerlos ilimitados',
    },
  },

  fa: {
    errorBoundary: {
      title: 'اوه! مشکلی پیش آمد',
      message: 'با خطایی غیرمنتظره مواجه شدیم. لطفاً برنامه را دوباره راه‌اندازی کنید.',
      restart: 'راه‌اندازی مجدد برنامه',
    },
    update: {
      forcedTitle: 'ما تغییرات مهمی ایجاد کرده‌ایم',
      softTitle: 'چیز جدیدی در انتظار شماست',
      forcedBody: 'این نسخه از Accord دیگر پشتیبانی نمی‌شود. برای حفظ امنیت گفتگوها و اجرای روان همه چیز به‌روزرسانی کنید.',
      softBody: 'نسخه جدیدتری از Accord با بهبودهایی که از آن‌ها لذت خواهید برد در دسترس است.',
      updateButton: 'به‌روزرسانی Accord',
      notNow: 'الان نه',
      nativeTitleRequired: 'به‌روزرسانی لازم است',
      nativeTitleAvailable: 'به‌روزرسانی موجود است',
      nativeBodyRequired: 'برای ادامه به نسخه جدیدی از Accord نیاز است. لطفاً اکنون به‌روزرسانی کنید.',
      nativeBodyAvailable: 'نسخه جدیدی از Accord با بهبودها و رفع اشکالات در دسترس است.',
      nativeUpdateNow: 'اکنون به‌روزرسانی کنید',
      nativeLater: 'بعداً',
    },
    match: {
      itsA: 'این یک',
      exclamation: 'مَچ!',
      bothLiked: 'شما و {{name}} از هم خوشتان آمده است',
      sendMessage: 'ارسال پیام',
      keepBrowsing: 'ادامه مرور',
    },
    toast: {
      newMessageFrom: 'پیام جدید از {{name}}',
      userLikesYou: '{{name}} از شما خوشش می‌آید!',
      someoneLikesYou: 'کسی از شما خوشش می‌آید!',
      tapToSeeProfile: 'برای دیدن پروفایل آن‌ها ضربه بزنید',
      upgradeToSeePremium: 'برای دیدن این که چه کسی، به پریمیوم ارتقا دهید',
      reactedWith: '{{name}} با {{emoji}} واکنش نشان داد',
      tapToViewConversation: 'برای مشاهده گفتگو ضربه بزنید',
    },
    matches: {
      matchCountTitle: '{{current}} از {{limit}} مَچ فعال',
      matchCountSubtitleFree: 'طرح رایگان',
      matchCountSubtitleWarning: 'تقریباً پر شده — مَچ‌های نامحدود دریافت کنید',
      matchCountSubtitleFull: 'با کسی از حالت مَچ خارج شوید یا برای نامحدود ارتقا دهید',
    },
  },

  fr: {
    errorBoundary: {
      title: 'Oups ! Quelque chose a mal tourné',
      message: 'Une erreur inattendue s\'est produite. Essaie de redémarrer l\'application.',
      restart: 'Redémarrer l\'app',
    },
    update: {
      forcedTitle: 'Nous avons fait des changements importants',
      softTitle: 'Quelque chose de nouveau t\'attend',
      forcedBody: 'Cette version d\'Accord n\'est plus prise en charge. Mets à jour pour garder tes conversations en sécurité et tout faire fonctionner correctement.',
      softBody: 'Une version plus récente d\'Accord est disponible avec des améliorations qui te plairont.',
      updateButton: 'Mettre à jour Accord',
      notNow: 'Pas maintenant',
      nativeTitleRequired: 'Mise à jour requise',
      nativeTitleAvailable: 'Mise à jour disponible',
      nativeBodyRequired: 'Une nouvelle version d\'Accord est requise pour continuer. Mets à jour maintenant.',
      nativeBodyAvailable: 'Une nouvelle version d\'Accord est disponible avec des améliorations et des corrections de bugs.',
      nativeUpdateNow: 'Mettre à jour maintenant',
      nativeLater: 'Plus tard',
    },
    match: {
      itsA: 'C\'est un',
      exclamation: 'Match !',
      bothLiked: 'Toi et {{name}} vous êtes plu',
      sendMessage: 'Envoyer un message',
      keepBrowsing: 'Continuer à explorer',
    },
    toast: {
      newMessageFrom: 'Nouveau message de {{name}}',
      userLikesYou: '{{name}} t\'aime bien !',
      someoneLikesYou: 'Quelqu\'un t\'aime bien !',
      tapToSeeProfile: 'Touche pour voir son profil',
      upgradeToSeePremium: 'Passe à Premium pour voir qui',
      reactedWith: '{{name}} a réagi avec {{emoji}}',
      tapToViewConversation: 'Touche pour voir la conversation',
    },
    matches: {
      matchCountTitle: '{{current}} sur {{limit}} matchs actifs',
      matchCountSubtitleFree: 'Plan gratuit',
      matchCountSubtitleWarning: 'Presque plein — obtiens des matchs illimités',
      matchCountSubtitleFull: 'Termine un match ou passe au plan illimité',
    },
  },

  he: {
    errorBoundary: {
      title: 'אופס! משהו השתבש',
      message: 'נתקלנו בשגיאה בלתי צפויה. נסה להפעיל מחדש את האפליקציה.',
      restart: 'הפעל מחדש את האפליקציה',
    },
    update: {
      forcedTitle: 'ביצענו כמה שינויים חשובים',
      softTitle: 'משהו חדש מחכה לך',
      forcedBody: 'גרסה זו של Accord אינה נתמכת עוד. עדכן כדי לשמור על השיחות שלך מאובטחות ושהכל יפעל בצורה חלקה.',
      softBody: 'גרסה חדשה יותר של Accord זמינה עם שיפורים שיעשו לך טוב.',
      updateButton: 'עדכן את Accord',
      notNow: 'לא עכשיו',
      nativeTitleRequired: 'נדרש עדכון',
      nativeTitleAvailable: 'עדכון זמין',
      nativeBodyRequired: 'גרסה חדשה של Accord נדרשת כדי להמשיך. אנא עדכן עכשיו.',
      nativeBodyAvailable: 'גרסה חדשה של Accord זמינה עם שיפורים ותיקוני באגים.',
      nativeUpdateNow: 'עדכן עכשיו',
      nativeLater: 'מאוחר יותר',
    },
    match: {
      itsA: 'זה',
      exclamation: 'התאמה!',
      bothLiked: 'אתה ו{{name}} אהבתם זה את זה',
      sendMessage: 'שלח הודעה',
      keepBrowsing: 'המשך לגלוש',
    },
    toast: {
      newMessageFrom: 'הודעה חדשה מ-{{name}}',
      userLikesYou: '{{name}} אוהב אותך!',
      someoneLikesYou: 'מישהו אוהב אותך!',
      tapToSeeProfile: 'הקש כדי לראות את הפרופיל',
      upgradeToSeePremium: 'שדרג לפרימיום כדי לראות מי',
      reactedWith: '{{name}} הגיב עם {{emoji}}',
      tapToViewConversation: 'הקש כדי לראות את השיחה',
    },
    matches: {
      matchCountTitle: '{{current}} מתוך {{limit}} התאמות פעילות',
      matchCountSubtitleFree: 'תוכנית חינמית',
      matchCountSubtitleWarning: 'כמעט מלא — קבל התאמות ללא הגבלה',
      matchCountSubtitleFull: 'בטל התאמה עם מישהו או שדרג לבלתי מוגבל',
    },
  },

  hi: {
    errorBoundary: {
      title: 'उफ़! कुछ गलत हो गया',
      message: 'हमें एक अप्रत्याशित त्रुटि का सामना करना पड़ा। कृपया ऐप को पुनः आरंभ करने का प्रयास करें।',
      restart: 'ऐप पुनः आरंभ करें',
    },
    update: {
      forcedTitle: 'हमने कुछ महत्वपूर्ण बदलाव किए हैं',
      softTitle: 'कुछ नया आपका इंतज़ार कर रहा है',
      forcedBody: 'Accord का यह संस्करण अब समर्थित नहीं है। अपनी बातचीत को सुरक्षित रखने और सब कुछ सुचारू रूप से चलाने के लिए अपडेट करें।',
      softBody: 'Accord का एक नया संस्करण उपलब्ध है जिसमें आपको पसंद आने वाले सुधार हैं।',
      updateButton: 'Accord अपडेट करें',
      notNow: 'अभी नहीं',
      nativeTitleRequired: 'अपडेट आवश्यक',
      nativeTitleAvailable: 'अपडेट उपलब्ध',
      nativeBodyRequired: 'जारी रखने के लिए Accord का नया संस्करण आवश्यक है। कृपया अभी अपडेट करें।',
      nativeBodyAvailable: 'सुधार और बग फ़िक्स के साथ Accord का नया संस्करण उपलब्ध है।',
      nativeUpdateNow: 'अभी अपडेट करें',
      nativeLater: 'बाद में',
    },
    match: {
      itsA: 'यह है',
      exclamation: 'मैच!',
      bothLiked: 'आपने और {{name}} ने एक-दूसरे को पसंद किया',
      sendMessage: 'संदेश भेजें',
      keepBrowsing: 'ब्राउज़िंग जारी रखें',
    },
    toast: {
      newMessageFrom: '{{name}} से नया संदेश',
      userLikesYou: '{{name}} आपको पसंद करता है!',
      someoneLikesYou: 'कोई आपको पसंद करता है!',
      tapToSeeProfile: 'उनका प्रोफ़ाइल देखने के लिए टैप करें',
      upgradeToSeePremium: 'यह देखने के लिए कि कौन, प्रीमियम में अपग्रेड करें',
      reactedWith: '{{name}} ने {{emoji}} के साथ प्रतिक्रिया दी',
      tapToViewConversation: 'बातचीत देखने के लिए टैप करें',
    },
    matches: {
      matchCountTitle: '{{limit}} में से {{current}} सक्रिय मैच',
      matchCountSubtitleFree: 'मुफ़्त योजना',
      matchCountSubtitleWarning: 'लगभग भर गया — असीमित मैच पाएं',
      matchCountSubtitleFull: 'किसी को अनमैच करें या असीमित के लिए अपग्रेड करें',
    },
  },

  id: {
    errorBoundary: {
      title: 'Ups! Ada yang salah',
      message: 'Kami mengalami kesalahan tak terduga. Coba mulai ulang aplikasi.',
      restart: 'Mulai Ulang Aplikasi',
    },
    update: {
      forcedTitle: 'Kami telah membuat beberapa perubahan penting',
      softTitle: 'Sesuatu yang baru menunggumu',
      forcedBody: 'Versi Accord ini tidak lagi didukung. Perbarui untuk menjaga percakapanmu tetap aman dan semuanya berjalan lancar.',
      softBody: 'Versi Accord yang lebih baru tersedia dengan peningkatan yang akan kamu sukai.',
      updateButton: 'Perbarui Accord',
      notNow: 'Tidak sekarang',
      nativeTitleRequired: 'Pembaruan Diperlukan',
      nativeTitleAvailable: 'Pembaruan Tersedia',
      nativeBodyRequired: 'Versi baru Accord diperlukan untuk melanjutkan. Harap perbarui sekarang.',
      nativeBodyAvailable: 'Versi baru Accord tersedia dengan peningkatan dan perbaikan bug.',
      nativeUpdateNow: 'Perbarui Sekarang',
      nativeLater: 'Nanti',
    },
    match: {
      itsA: 'Ini',
      exclamation: 'Cocok!',
      bothLiked: 'Kamu dan {{name}} saling menyukai',
      sendMessage: 'Kirim Pesan',
      keepBrowsing: 'Lanjut Menjelajah',
    },
    toast: {
      newMessageFrom: 'Pesan baru dari {{name}}',
      userLikesYou: '{{name}} menyukaimu!',
      someoneLikesYou: 'Seseorang menyukaimu!',
      tapToSeeProfile: 'Ketuk untuk melihat profilnya',
      upgradeToSeePremium: 'Tingkatkan ke Premium untuk melihat siapa',
      reactedWith: '{{name}} bereaksi {{emoji}}',
      tapToViewConversation: 'Ketuk untuk melihat percakapan',
    },
    matches: {
      matchCountTitle: '{{current}} dari {{limit}} kecocokan aktif',
      matchCountSubtitleFree: 'Paket gratis',
      matchCountSubtitleWarning: 'Hampir penuh — dapatkan kecocokan tanpa batas',
      matchCountSubtitleFull: 'Batalkan kecocokan seseorang atau tingkatkan untuk tanpa batas',
    },
  },

  it: {
    errorBoundary: {
      title: 'Ops! Qualcosa è andato storto',
      message: 'Abbiamo riscontrato un errore inatteso. Prova a riavviare l\'app.',
      restart: 'Riavvia l\'app',
    },
    update: {
      forcedTitle: 'Abbiamo apportato alcune modifiche importanti',
      softTitle: 'Qualcosa di nuovo ti sta aspettando',
      forcedBody: 'Questa versione di Accord non è più supportata. Aggiorna per mantenere le tue conversazioni al sicuro e far funzionare tutto senza problemi.',
      softBody: 'È disponibile una versione più recente di Accord con miglioramenti che apprezzerai.',
      updateButton: 'Aggiorna Accord',
      notNow: 'Non ora',
      nativeTitleRequired: 'Aggiornamento richiesto',
      nativeTitleAvailable: 'Aggiornamento disponibile',
      nativeBodyRequired: 'È richiesta una nuova versione di Accord per continuare. Aggiorna ora.',
      nativeBodyAvailable: 'È disponibile una nuova versione di Accord con miglioramenti e correzioni di bug.',
      nativeUpdateNow: 'Aggiorna ora',
      nativeLater: 'Più tardi',
    },
    match: {
      itsA: 'È un',
      exclamation: 'Match!',
      bothLiked: 'Tu e {{name}} vi siete piaciuti',
      sendMessage: 'Invia un messaggio',
      keepBrowsing: 'Continua a esplorare',
    },
    toast: {
      newMessageFrom: 'Nuovo messaggio da {{name}}',
      userLikesYou: 'A {{name}} piaci!',
      someoneLikesYou: 'A qualcuno piaci!',
      tapToSeeProfile: 'Tocca per vedere il profilo',
      upgradeToSeePremium: 'Passa a Premium per vedere chi',
      reactedWith: '{{name}} ha reagito con {{emoji}}',
      tapToViewConversation: 'Tocca per vedere la conversazione',
    },
    matches: {
      matchCountTitle: '{{current}} di {{limit}} match attivi',
      matchCountSubtitleFree: 'Piano gratuito',
      matchCountSubtitleWarning: 'Quasi pieno — ottieni match illimitati',
      matchCountSubtitleFull: 'Annulla un match o passa al piano illimitato',
    },
  },

  ka: {
    errorBoundary: {
      title: 'უი! რაღაც არასწორად მოხდა',
      message: 'შეგვხვდა მოულოდნელი შეცდომა. გთხოვთ, სცადოთ აპის გადატვირთვა.',
      restart: 'აპის გადატვირთვა',
    },
    update: {
      forcedTitle: 'ჩვენ შევიტანეთ რამდენიმე მნიშვნელოვანი ცვლილება',
      softTitle: 'რაღაც ახალი გელოდებათ',
      forcedBody: 'Accord-ის ეს ვერსია აღარ არის მხარდაჭერილი. განაახლეთ, რათა თქვენი საუბრები დაცული იყოს და ყველაფერი შეუფერხებლად მუშაობდეს.',
      softBody: 'ხელმისაწვდომია Accord-ის უახლესი ვერსია გაუმჯობესებებით, რომლებიც მოგეწონებათ.',
      updateButton: 'Accord-ის განახლება',
      notNow: 'არა ახლა',
      nativeTitleRequired: 'საჭიროა განახლება',
      nativeTitleAvailable: 'ხელმისაწვდომია განახლება',
      nativeBodyRequired: 'გაგრძელებისთვის საჭიროა Accord-ის ახალი ვერსია. გთხოვთ, განაახლოთ ახლავე.',
      nativeBodyAvailable: 'ხელმისაწვდომია Accord-ის ახალი ვერსია გაუმჯობესებებით და შეცდომების გასწორებით.',
      nativeUpdateNow: 'ახლავე განახლება',
      nativeLater: 'მოგვიანებით',
    },
    match: {
      itsA: 'ეს არის',
      exclamation: 'დამთხვევა!',
      bothLiked: 'თქვენ და {{name}} მოეწონეთ ერთმანეთს',
      sendMessage: 'შეტყობინების გაგზავნა',
      keepBrowsing: 'დათვალიერების გაგრძელება',
    },
    toast: {
      newMessageFrom: 'ახალი შეტყობინება {{name}}-ისგან',
      userLikesYou: '{{name}}-ს მოსწონხართ!',
      someoneLikesYou: 'ვიღაცას მოსწონხართ!',
      tapToSeeProfile: 'შეეხეთ პროფილის სანახავად',
      upgradeToSeePremium: 'გადადით Premium-ზე, რომ ნახოთ ვინ',
      reactedWith: '{{name}}-მა რეაგირება მოახდინა {{emoji}}-ით',
      tapToViewConversation: 'შეეხეთ საუბრის სანახავად',
    },
    matches: {
      matchCountTitle: '{{current}} {{limit}}-დან აქტიური დამთხვევა',
      matchCountSubtitleFree: 'უფასო გეგმა',
      matchCountSubtitleWarning: 'თითქმის სავსეა — მიიღეთ შეუზღუდავი დამთხვევები',
      matchCountSubtitleFull: 'გააუქმეთ ვინმესთან დამთხვევა ან გადადით შეუზღუდავზე',
    },
  },

  pl: {
    errorBoundary: {
      title: 'Ups! Coś poszło nie tak',
      message: 'Wystąpił nieoczekiwany błąd. Spróbuj uruchomić aplikację ponownie.',
      restart: 'Uruchom ponownie',
    },
    update: {
      forcedTitle: 'Wprowadziliśmy kilka ważnych zmian',
      softTitle: 'Coś nowego na Ciebie czeka',
      forcedBody: 'Ta wersja Accord nie jest już obsługiwana. Zaktualizuj, aby zachować bezpieczeństwo rozmów i płynne działanie aplikacji.',
      softBody: 'Dostępna jest nowsza wersja Accord z ulepszeniami, które Ci się spodobają.',
      updateButton: 'Zaktualizuj Accord',
      notNow: 'Nie teraz',
      nativeTitleRequired: 'Wymagana aktualizacja',
      nativeTitleAvailable: 'Dostępna aktualizacja',
      nativeBodyRequired: 'Do kontynuowania wymagana jest nowa wersja Accord. Zaktualizuj teraz.',
      nativeBodyAvailable: 'Dostępna jest nowa wersja Accord z ulepszeniami i poprawkami błędów.',
      nativeUpdateNow: 'Zaktualizuj teraz',
      nativeLater: 'Później',
    },
    match: {
      itsA: 'To',
      exclamation: 'Dopasowanie!',
      bothLiked: 'Ty i {{name}} polubiliście się nawzajem',
      sendMessage: 'Wyślij wiadomość',
      keepBrowsing: 'Przeglądaj dalej',
    },
    toast: {
      newMessageFrom: 'Nowa wiadomość od {{name}}',
      userLikesYou: '{{name}} Cię polubił(a)!',
      someoneLikesYou: 'Ktoś Cię polubił!',
      tapToSeeProfile: 'Dotknij, aby zobaczyć profil',
      upgradeToSeePremium: 'Przejdź na Premium, aby zobaczyć kto',
      reactedWith: '{{name}} zareagował(a) {{emoji}}',
      tapToViewConversation: 'Dotknij, aby zobaczyć rozmowę',
    },
    matches: {
      matchCountTitle: '{{current}} z {{limit}} aktywnych dopasowań',
      matchCountSubtitleFree: 'Plan darmowy',
      matchCountSubtitleWarning: 'Prawie pełny — uzyskaj nieograniczone dopasowania',
      matchCountSubtitleFull: 'Zakończ dopasowanie z kimś lub przejdź na nielimitowany plan',
    },
  },

  pt: {
    errorBoundary: {
      title: 'Ops! Algo deu errado',
      message: 'Encontramos um erro inesperado. Tente reiniciar o aplicativo.',
      restart: 'Reiniciar App',
    },
    update: {
      forcedTitle: 'Fizemos algumas mudanças importantes',
      softTitle: 'Algo novo está esperando por você',
      forcedBody: 'Esta versão do Accord não é mais suportada. Atualize para manter suas conversas seguras e tudo funcionando sem problemas.',
      softBody: 'Uma versão mais recente do Accord está disponível com melhorias que você vai gostar.',
      updateButton: 'Atualizar Accord',
      notNow: 'Agora não',
      nativeTitleRequired: 'Atualização necessária',
      nativeTitleAvailable: 'Atualização disponível',
      nativeBodyRequired: 'Uma nova versão do Accord é necessária para continuar. Atualize agora.',
      nativeBodyAvailable: 'Uma nova versão do Accord está disponível com melhorias e correções de bugs.',
      nativeUpdateNow: 'Atualizar agora',
      nativeLater: 'Mais tarde',
    },
    match: {
      itsA: 'É um',
      exclamation: 'Match!',
      bothLiked: 'Você e {{name}} curtiram um ao outro',
      sendMessage: 'Enviar Mensagem',
      keepBrowsing: 'Continuar Explorando',
    },
    toast: {
      newMessageFrom: 'Nova mensagem de {{name}}',
      userLikesYou: '{{name}} curtiu você!',
      someoneLikesYou: 'Alguém curtiu você!',
      tapToSeeProfile: 'Toque para ver o perfil',
      upgradeToSeePremium: 'Atualize para Premium para ver quem',
      reactedWith: '{{name}} reagiu com {{emoji}}',
      tapToViewConversation: 'Toque para ver a conversa',
    },
    matches: {
      matchCountTitle: '{{current}} de {{limit}} matches ativos',
      matchCountSubtitleFree: 'Plano gratuito',
      matchCountSubtitleWarning: 'Quase cheio — obtenha matches ilimitados',
      matchCountSubtitleFull: 'Desfaça um match ou atualize para ilimitado',
    },
  },

  ru: {
    errorBoundary: {
      title: 'Упс! Что-то пошло не так',
      message: 'Мы столкнулись с непредвиденной ошибкой. Попробуйте перезапустить приложение.',
      restart: 'Перезапустить приложение',
    },
    update: {
      forcedTitle: 'Мы внесли важные изменения',
      softTitle: 'Вас ждёт что-то новое',
      forcedBody: 'Эта версия Accord больше не поддерживается. Обновитесь, чтобы ваши разговоры оставались защищёнными, а всё работало плавно.',
      softBody: 'Доступна более новая версия Accord с улучшениями, которые вам понравятся.',
      updateButton: 'Обновить Accord',
      notNow: 'Не сейчас',
      nativeTitleRequired: 'Требуется обновление',
      nativeTitleAvailable: 'Доступно обновление',
      nativeBodyRequired: 'Для продолжения требуется новая версия Accord. Пожалуйста, обновите сейчас.',
      nativeBodyAvailable: 'Доступна новая версия Accord с улучшениями и исправлениями ошибок.',
      nativeUpdateNow: 'Обновить сейчас',
      nativeLater: 'Позже',
    },
    match: {
      itsA: 'Это',
      exclamation: 'Совпадение!',
      bothLiked: 'Вы и {{name}} понравились друг другу',
      sendMessage: 'Отправить сообщение',
      keepBrowsing: 'Продолжить просмотр',
    },
    toast: {
      newMessageFrom: 'Новое сообщение от {{name}}',
      userLikesYou: 'Вы нравитесь {{name}}!',
      someoneLikesYou: 'Вы кому-то нравитесь!',
      tapToSeeProfile: 'Нажмите, чтобы увидеть профиль',
      upgradeToSeePremium: 'Перейдите на Premium, чтобы узнать кто',
      reactedWith: '{{name}} отреагировал(а) {{emoji}}',
      tapToViewConversation: 'Нажмите, чтобы открыть разговор',
    },
    matches: {
      matchCountTitle: '{{current}} из {{limit}} активных совпадений',
      matchCountSubtitleFree: 'Бесплатный тариф',
      matchCountSubtitleWarning: 'Почти заполнено — получите безлимитные совпадения',
      matchCountSubtitleFull: 'Отмените совпадение с кем-то или перейдите на безлимитный',
    },
  },

  tr: {
    errorBoundary: {
      title: 'Hay aksi! Bir şeyler ters gitti',
      message: 'Beklenmeyen bir hatayla karşılaştık. Lütfen uygulamayı yeniden başlatmayı deneyin.',
      restart: 'Uygulamayı Yeniden Başlat',
    },
    update: {
      forcedTitle: 'Bazı önemli değişiklikler yaptık',
      softTitle: 'Seni yeni bir şey bekliyor',
      forcedBody: 'Accord\'un bu sürümü artık desteklenmiyor. Sohbetlerinin güvende kalması ve her şeyin sorunsuz çalışması için güncelle.',
      softBody: 'Accord\'un beğeneceğin iyileştirmelerle daha yeni bir sürümü mevcut.',
      updateButton: 'Accord\'u Güncelle',
      notNow: 'Şimdi değil',
      nativeTitleRequired: 'Güncelleme Gerekli',
      nativeTitleAvailable: 'Güncelleme Mevcut',
      nativeBodyRequired: 'Devam etmek için Accord\'un yeni bir sürümü gerekli. Lütfen şimdi güncelle.',
      nativeBodyAvailable: 'İyileştirmeler ve hata düzeltmeleriyle Accord\'un yeni bir sürümü mevcut.',
      nativeUpdateNow: 'Şimdi Güncelle',
      nativeLater: 'Daha sonra',
    },
    match: {
      itsA: 'Bu bir',
      exclamation: 'Eşleşme!',
      bothLiked: 'Sen ve {{name}} birbirinizi beğendiniz',
      sendMessage: 'Mesaj Gönder',
      keepBrowsing: 'Göz Atmaya Devam Et',
    },
    toast: {
      newMessageFrom: '{{name}} kişisinden yeni mesaj',
      userLikesYou: '{{name}} seni beğendi!',
      someoneLikesYou: 'Biri seni beğendi!',
      tapToSeeProfile: 'Profilini görmek için dokun',
      upgradeToSeePremium: 'Kim olduğunu görmek için Premium\'a yükselt',
      reactedWith: '{{name}} {{emoji}} ile tepki verdi',
      tapToViewConversation: 'Sohbeti görüntülemek için dokun',
    },
    matches: {
      matchCountTitle: '{{limit}} aktif eşleşmeden {{current}} tanesi',
      matchCountSubtitleFree: 'Ücretsiz plan',
      matchCountSubtitleWarning: 'Neredeyse dolu — sınırsız eşleşme al',
      matchCountSubtitleFull: 'Birinin eşleşmesini kaldır veya sınırsıza yükselt',
    },
  },

  uk: {
    errorBoundary: {
      title: 'Ой! Щось пішло не так',
      message: 'Ми зіткнулися з несподіваною помилкою. Спробуйте перезапустити застосунок.',
      restart: 'Перезапустити застосунок',
    },
    update: {
      forcedTitle: 'Ми внесли важливі зміни',
      softTitle: 'На вас чекає щось нове',
      forcedBody: 'Ця версія Accord більше не підтримується. Оновіться, щоб ваші розмови залишалися захищеними, а все працювало плавно.',
      softBody: 'Доступна новіша версія Accord із покращеннями, які вам сподобаються.',
      updateButton: 'Оновити Accord',
      notNow: 'Не зараз',
      nativeTitleRequired: 'Потрібне оновлення',
      nativeTitleAvailable: 'Доступне оновлення',
      nativeBodyRequired: 'Для продовження потрібна нова версія Accord. Будь ласка, оновіть зараз.',
      nativeBodyAvailable: 'Доступна нова версія Accord із покращеннями та виправленнями помилок.',
      nativeUpdateNow: 'Оновити зараз',
      nativeLater: 'Пізніше',
    },
    match: {
      itsA: 'Це',
      exclamation: 'Збіг!',
      bothLiked: 'Ви та {{name}} сподобалися одне одному',
      sendMessage: 'Надіслати повідомлення',
      keepBrowsing: 'Продовжити перегляд',
    },
    toast: {
      newMessageFrom: 'Нове повідомлення від {{name}}',
      userLikesYou: 'Ви подобаєтеся {{name}}!',
      someoneLikesYou: 'Ви комусь подобаєтеся!',
      tapToSeeProfile: 'Торкніться, щоб переглянути профіль',
      upgradeToSeePremium: 'Перейдіть на Premium, щоб дізнатися, хто',
      reactedWith: '{{name}} відреагував(ла) {{emoji}}',
      tapToViewConversation: 'Торкніться, щоб переглянути розмову',
    },
    matches: {
      matchCountTitle: '{{current}} із {{limit}} активних збігів',
      matchCountSubtitleFree: 'Безкоштовний тариф',
      matchCountSubtitleWarning: 'Майже заповнено — отримайте необмежені збіги',
      matchCountSubtitleFull: 'Скасуйте збіг з кимось або перейдіть на необмежений тариф',
    },
  },

  ur: {
    errorBoundary: {
      title: 'اوہ! کچھ غلط ہو گیا',
      message: 'ہمیں ایک غیر متوقع خرابی کا سامنا ہوا۔ براہ کرم ایپ کو دوبارہ شروع کرنے کی کوشش کریں۔',
      restart: 'ایپ دوبارہ شروع کریں',
    },
    update: {
      forcedTitle: 'ہم نے کچھ اہم تبدیلیاں کی ہیں',
      softTitle: 'کچھ نیا آپ کا منتظر ہے',
      forcedBody: 'Accord کا یہ ورژن اب معاون نہیں ہے۔ اپنی گفتگوؤں کو محفوظ رکھنے اور ہر چیز کو ہموار چلانے کے لیے اپ ڈیٹ کریں۔',
      softBody: 'Accord کا ایک نیا ورژن بہتریوں کے ساتھ دستیاب ہے جو آپ کو پسند آئیں گی۔',
      updateButton: 'Accord اپ ڈیٹ کریں',
      notNow: 'ابھی نہیں',
      nativeTitleRequired: 'اپ ڈیٹ درکار',
      nativeTitleAvailable: 'اپ ڈیٹ دستیاب',
      nativeBodyRequired: 'جاری رکھنے کے لیے Accord کا نیا ورژن درکار ہے۔ براہ کرم ابھی اپ ڈیٹ کریں۔',
      nativeBodyAvailable: 'بہتریوں اور بگ فکسز کے ساتھ Accord کا نیا ورژن دستیاب ہے۔',
      nativeUpdateNow: 'ابھی اپ ڈیٹ کریں',
      nativeLater: 'بعد میں',
    },
    match: {
      itsA: 'یہ ہے ایک',
      exclamation: 'میچ!',
      bothLiked: 'آپ اور {{name}} نے ایک دوسرے کو پسند کیا',
      sendMessage: 'پیغام بھیجیں',
      keepBrowsing: 'براؤزنگ جاری رکھیں',
    },
    toast: {
      newMessageFrom: '{{name}} کی طرف سے نیا پیغام',
      userLikesYou: '{{name}} آپ کو پسند کرتا ہے!',
      someoneLikesYou: 'کوئی آپ کو پسند کرتا ہے!',
      tapToSeeProfile: 'ان کی پروفائل دیکھنے کے لیے ٹیپ کریں',
      upgradeToSeePremium: 'یہ دیکھنے کے لیے کہ کون، پریمیم میں اپ گریڈ کریں',
      reactedWith: '{{name}} نے {{emoji}} کے ساتھ ردعمل ظاہر کیا',
      tapToViewConversation: 'گفتگو دیکھنے کے لیے ٹیپ کریں',
    },
    matches: {
      matchCountTitle: '{{limit}} میں سے {{current}} فعال میچز',
      matchCountSubtitleFree: 'مفت پلان',
      matchCountSubtitleWarning: 'تقریباً بھر گیا — لامحدود میچز حاصل کریں',
      matchCountSubtitleFull: 'کسی سے میچ ختم کریں یا لامحدود کے لیے اپ گریڈ کریں',
    },
  },

  zh: {
    errorBoundary: {
      title: '糟糕！出错了',
      message: '我们遇到了意外错误。请尝试重新启动应用程序。',
      restart: '重启应用',
    },
    update: {
      forcedTitle: '我们做了一些重要的更改',
      softTitle: '有新内容在等你',
      forcedBody: '此版本的 Accord 已不再受支持。请更新以保证对话安全并让一切顺畅运行。',
      softBody: 'Accord 的较新版本已推出，包含你会喜欢的改进。',
      updateButton: '更新 Accord',
      notNow: '暂不更新',
      nativeTitleRequired: '需要更新',
      nativeTitleAvailable: '有可用更新',
      nativeBodyRequired: '需要新版本的 Accord 才能继续。请立即更新。',
      nativeBodyAvailable: 'Accord 的新版本已推出，包含改进和错误修复。',
      nativeUpdateNow: '立即更新',
      nativeLater: '稍后',
    },
    match: {
      itsA: '这是一次',
      exclamation: '匹配！',
      bothLiked: '你和 {{name}} 互相喜欢',
      sendMessage: '发送消息',
      keepBrowsing: '继续浏览',
    },
    toast: {
      newMessageFrom: '来自 {{name}} 的新消息',
      userLikesYou: '{{name}} 喜欢你！',
      someoneLikesYou: '有人喜欢你！',
      tapToSeeProfile: '点按查看他们的资料',
      upgradeToSeePremium: '升级到高级版以查看是谁',
      reactedWith: '{{name}} 以 {{emoji}} 做出反应',
      tapToViewConversation: '点按查看对话',
    },
    matches: {
      matchCountTitle: '{{limit}} 个活跃匹配中的 {{current}} 个',
      matchCountSubtitleFree: '免费方案',
      matchCountSubtitleWarning: '快满了——获取无限匹配',
      matchCountSubtitleFull: '取消与某人的匹配，或升级以获得无限匹配',
    },
  },
};

const localesDir = path.join(__dirname, '..', 'locales');

let totalKeys = 0;

for (const locale of LOCALES) {
  const filePath = path.join(localesDir, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`  skip ${locale}.json (not found)`);
    continue;
  }
  const data = T[locale];
  if (!data) {
    console.warn(`  skip ${locale} (no translations defined)`);
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(raw);

  // common.errorBoundary + common.update
  json.common = json.common || {};
  json.common.errorBoundary = data.errorBoundary;
  json.common.update = data.update;

  // discover.match
  json.discover = json.discover || {};
  json.discover.match = data.match;

  // toast.* (new keys, merge into existing toast object)
  json.toast = json.toast || {};
  Object.assign(json.toast, data.toast);

  // matches.matchCount*
  json.matches = json.matches || {};
  Object.assign(json.matches, data.matches);

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');

  const keyCount =
    Object.keys(data.errorBoundary).length +
    Object.keys(data.update).length +
    Object.keys(data.match).length +
    Object.keys(data.toast).length +
    Object.keys(data.matches).length;
  totalKeys += keyCount;
  console.log(`  ${locale}.json: +${keyCount} keys`);
}

console.log(`\nDone. ${totalKeys} total translations across ${LOCALES.length} locales.`);
