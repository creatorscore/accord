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
    chat: { blockedConfirmation: "لقد حظرت {{name}}" },
    moderation: {
      menu: { reportUser: "الإبلاغ عن المستخدم", unmatch: "إلغاء التوافق", blockUser: "حظر المستخدم" },
      report: {
        title: "الإبلاغ عن {{name}}",
        subtitle: "يرجى اختيار سبب الإبلاغ عن هذا المستخدم:",
        reasons: {
          blackmail: "ابتزاز / مشاركة لقطات الشاشة", blackmailDescription: "شخص ما شارك لقطة شاشة لملفك الشخصي مع العلامة المائية",
          inappropriateContent: "محتوى غير لائق", inappropriateContentDescription: "الصور أو السيرة الذاتية أو الرسائل تحتوي على محتوى غير لائق",
          harassment: "تحرش", harassmentDescription: "سلوك تهديدي أو مضايقة أو تنمر",
          fakeProfile: "ملف شخصي مزيف", fakeProfileDescription: "يبدو أن الملف الشخصي مزيف أو ينتحل شخصية شخص آخر",
          scam: "احتيال", scamDescription: "طلب أموال أو يبدو أنه عملية احتيال",
          spam: "رسائل مزعجة", spamDescription: "إرسال رسائل مزعجة أو ترويجية",
          underage: "مستخدم قاصر", underageDescription: "يبدو أن المستخدم أقل من 18 عامًا",
          hateSpeech: "خطاب كراهية", hateSpeechDescription: "لغة تمييزية أو كراهية",
          other: "أخرى", otherDescription: "سبب آخر غير مدرج أعلاه"
        },
        evidencePhotos: "صور الأدلة", upload: "رفع",
        evidenceInfo: "قم برفع لقطات شاشة تظهر ملفك الشخصي مع العلامة المائية المرئية. ابحث عن النص الخافت في الزوايا.",
        explainWhy: "اشرح سبب الإبلاغ", explainHint: "يرجى وصف السلوك أو المحتوى المحدد الذي ينتهك إرشاداتنا.",
        explainPlaceholder: "ماذا فعل هذا المستخدم؟ كن محددًا...",
        charsNeeded: "{{count}} حرفًا إضافيًا مطلوبًا", charsCount: "{{count}}/500",
        privacyNotice: "بلاغك مجهول الهوية. لن يتم إخطار المستخدم المُبلَّغ عنه.",
        submitReport: "إرسال البلاغ",
        permissionRequired: "الإذن مطلوب", permissionMessage: "يرجى السماح بالوصول إلى مكتبة الصور لرفع الأدلة.",
        uploadFailed: "فشل الرفع", uploadFailedMessage: "فشل رفع صورة أو أكثر. يرجى المحاولة مرة أخرى.",
        selectPhotoError: "فشل اختيار الصور. يرجى المحاولة مرة أخرى.",
        selectReasonError: "يرجى اختيار سبب للإبلاغ",
        explanationRequired: "التوضيح مطلوب", explanationRequiredMessage: "يرجى تقديم توضيح مفصل (20 حرفًا على الأقل) لسبب إبلاغك عن هذا المستخدم.",
        evidenceRequired: "الأدلة مطلوبة", evidenceRequiredMessage: "بلاغات الابتزاز تتطلب أدلة لقطات شاشة. يرجى رفع صورة واحدة على الأقل.",
        mustBeLoggedIn: "يجب تسجيل الدخول للإبلاغ عن مستخدم",
        submitted: "تم إرسال البلاغ", submittedMessage: "شكرًا لمساعدتنا في الحفاظ على أمان Accord. سيراجع فريق الإشراف هذا البلاغ.",
        submitError: "فشل إرسال البلاغ. يرجى المحاولة مرة أخرى."
      },
      reportAlt: {
        title: "الإبلاغ عن {{name}}", subtitle: "ساعدنا في الحفاظ على أمان Accord",
        whyReporting: "لماذا تبلّغ عن هذا الملف الشخصي؟", provideDetails: "يرجى تقديم التفاصيل",
        detailsPlaceholder: "ساعدنا في فهم ما حدث (10 أحرف كحد أدنى)",
        evidenceInfo: "قم برفع لقطات شاشة تظهر ملفك الشخصي مع العلامة المائية. هذا يساعدنا في تحديد من شاركها.",
        evidenceRequiredMessage: "بلاغات الابتزاز تتطلب أدلة لقطات شاشة. يرجى رفع صورة واحدة على الأقل.",
        infoNotice: "يتم مراجعة البلاغات من قبل فريقنا. البلاغات الكاذبة قد تؤدي إلى تعليق الحساب.",
        reasons: { blackmail: "ابتزاز / مشاركة لقطات شاشة", harassment: "تحرش أو تنمر", fakeProfile: "ملف شخصي مزيف أو احتيال", inappropriateContent: "صور أو رسائل غير لائقة", spam: "رسائل مزعجة أو ترويجية", underage: "مستخدم قاصر", safetyConcern: "مخاوف أمنية", other: "أخرى" }
      },
      block: {
        title: "حظر {{name}}؟", description: "حظر هذا المستخدم سيؤدي إلى:",
        hideProfile: "إخفاء ملفك الشخصي عنهم", preventMessages: "منعهم من إرسال رسائل إليك",
        deleteMessages: "حذف جميع الرسائل نهائيًا (لا يمكن التراجع)", noNotification: "لن يتم إخطارهم",
        unblockNote: "يمكنك إلغاء الحظر لاحقًا في الإعدادات ← المستخدمون المحظورون",
        blockUser: "حظر المستخدم", alreadyBlocked: "محظور بالفعل", alreadyBlockedMessage: "لقد حظرت هذا المستخدم بالفعل.",
        userBlocked: "تم حظر المستخدم", userBlockedMessage: "تم حظر {{name}}. تم حذف محادثتك نهائيًا ولم يعد بإمكانهم رؤية ملفك الشخصي.",
        mustBeLoggedIn: "يجب تسجيل الدخول لحظر مستخدم", error: "فشل حظر المستخدم. يرجى المحاولة مرة أخرى."
      },
      blockAlt: {
        title: "حظر {{name}}؟", description: "حظر {{name}} سيؤدي إلى:",
        removeMatches: "إزالتهم من توافقاتك", hideProfile: "إخفاء ملفك الشخصي عنهم",
        preventMatching: "منع التوافق المستقبلي", deleteMessages: "حذف جميع الرسائل نهائيًا (لا يمكن التراجع)", block: "حظر"
      },
      unmatch: {
        title: "إلغاء التوافق مع {{name}}؟", description: "سينهي هذا محادثتك مع {{name}}. قد تتمكنان من رؤية بعضكما في الاكتشاف مرة أخرى.",
        privacy: "لن يتم إخطار {{name}} بإلغاء التوافق", button: "إلغاء التوافق", needToBlock: "هل تحتاج إلى الحظر بدلاً من ذلك؟",
        successTitle: "تم إلغاء التوافق", successMessage: "لقد ألغيت التوافق مع {{name}}", errorMessage: "فشل إلغاء التوافق. يرجى المحاولة مرة أخرى."
      }
    }
  },
  fa: {
    chat: { blockedConfirmation: "شما {{name}} را مسدود کردید" },
    moderation: {
      menu: { reportUser: "گزارش کاربر", unmatch: "لغو تطابق", blockUser: "مسدود کردن کاربر" },
      report: {
        title: "گزارش {{name}}", subtitle: "لطفاً دلیل گزارش این کاربر را انتخاب کنید:",
        reasons: {
          blackmail: "باج‌گیری / اشتراک‌گذاری اسکرین‌شات", blackmailDescription: "کسی اسکرین‌شات پروفایل شما را با واترمارک به اشتراک گذاشته",
          inappropriateContent: "محتوای نامناسب", inappropriateContentDescription: "عکس‌ها، بیوگرافی یا پیام‌ها حاوی محتوای نامناسب هستند",
          harassment: "آزار و اذیت", harassmentDescription: "رفتار تهدیدآمیز، آزاردهنده یا زورگویانه",
          fakeProfile: "پروفایل جعلی", fakeProfileDescription: "به نظر می‌رسد پروفایل جعلی است یا هویت کسی را جعل کرده",
          scam: "کلاهبرداری", scamDescription: "درخواست پول یا به نظر کلاهبرداری می‌رسد",
          spam: "هرزنامه", spamDescription: "ارسال پیام‌های هرزنامه یا تبلیغاتی",
          underage: "کاربر زیر سن قانونی", underageDescription: "به نظر می‌رسد کاربر زیر ۱۸ سال است",
          hateSpeech: "سخنان نفرت‌انگیز", hateSpeechDescription: "زبان تبعیض‌آمیز یا نفرت‌انگیز",
          other: "سایر", otherDescription: "دلیل دیگری که در بالا ذکر نشده"
        },
        evidencePhotos: "عکس‌های مدرک", upload: "آپلود",
        evidenceInfo: "اسکرین‌شات‌هایی آپلود کنید که پروفایل شما را با واترمارک نشان می‌دهد.",
        explainWhy: "دلیل گزارش خود را توضیح دهید", explainHint: "لطفاً رفتار یا محتوای خاصی که قوانین ما را نقض می‌کند توصیف کنید.",
        explainPlaceholder: "این کاربر چه کاری انجام داده؟ دقیق باشید...",
        charsNeeded: "{{count}} کاراکتر دیگر لازم است", charsCount: "{{count}}/500",
        privacyNotice: "گزارش شما ناشناس است. کاربر گزارش‌شده مطلع نخواهد شد.",
        submitReport: "ارسال گزارش",
        permissionRequired: "مجوز لازم است", permissionMessage: "لطفاً اجازه دسترسی به کتابخانه عکس را بدهید.",
        uploadFailed: "آپلود ناموفق", uploadFailedMessage: "آپلود یک یا چند عکس ناموفق بود. لطفاً دوباره تلاش کنید.",
        selectPhotoError: "انتخاب عکس ناموفق بود. لطفاً دوباره تلاش کنید.",
        selectReasonError: "لطفاً دلیلی برای گزارش انتخاب کنید",
        explanationRequired: "توضیح لازم است", explanationRequiredMessage: "لطفاً توضیح مفصلی (حداقل ۲۰ کاراکتر) ارائه دهید.",
        evidenceRequired: "مدرک لازم است", evidenceRequiredMessage: "گزارش‌های باج‌گیری نیاز به مدرک اسکرین‌شات دارند.",
        mustBeLoggedIn: "برای گزارش کاربر باید وارد شوید",
        submitted: "گزارش ارسال شد", submittedMessage: "از کمک شما برای ایمن نگه داشتن Accord متشکریم. تیم ما این گزارش را بررسی خواهد کرد.",
        submitError: "ارسال گزارش ناموفق بود. لطفاً دوباره تلاش کنید."
      },
      reportAlt: {
        title: "گزارش {{name}}", subtitle: "به ما کمک کنید Accord را ایمن نگه داریم",
        whyReporting: "چرا این پروفایل را گزارش می‌دهید؟", provideDetails: "لطفاً جزئیات ارائه دهید",
        detailsPlaceholder: "به ما کمک کنید بفهمیم چه اتفاقی افتاده (حداقل ۱۰ کاراکتر)",
        evidenceInfo: "اسکرین‌شات‌هایی آپلود کنید که پروفایل شما را با واترمارک نشان می‌دهد.",
        evidenceRequiredMessage: "گزارش‌های باج‌گیری نیاز به مدرک اسکرین‌شات دارند.",
        infoNotice: "گزارش‌ها توسط تیم ما بررسی می‌شوند. گزارش‌های نادرست ممکن است منجر به تعلیق حساب شود.",
        reasons: { blackmail: "باج‌گیری / اشتراک‌گذاری اسکرین‌شات", harassment: "آزار و اذیت یا زورگویی", fakeProfile: "پروفایل جعلی یا کلاهبرداری", inappropriateContent: "عکس‌ها یا پیام‌های نامناسب", spam: "هرزنامه یا تبلیغات", underage: "کاربر زیر سن قانونی", safetyConcern: "نگرانی ایمنی", other: "سایر" }
      },
      block: {
        title: "مسدود کردن {{name}}؟", description: "مسدود کردن این کاربر باعث می‌شود:",
        hideProfile: "پنهان شدن پروفایل شما از آن‌ها", preventMessages: "جلوگیری از ارسال پیام به شما",
        deleteMessages: "حذف دائمی همه پیام‌ها (قابل بازگشت نیست)", noNotification: "آن‌ها مطلع نخواهند شد",
        unblockNote: "می‌توانید بعداً در تنظیمات ← کاربران مسدودشده رفع انسداد کنید",
        blockUser: "مسدود کردن کاربر", alreadyBlocked: "قبلاً مسدود شده", alreadyBlockedMessage: "شما قبلاً این کاربر را مسدود کرده‌اید.",
        userBlocked: "کاربر مسدود شد", userBlockedMessage: "{{name}} مسدود شد. مکالمه شما برای همیشه حذف شده و آن‌ها دیگر نمی‌توانند پروفایل شما را ببینند.",
        mustBeLoggedIn: "برای مسدود کردن کاربر باید وارد شوید", error: "مسدود کردن کاربر ناموفق بود. لطفاً دوباره تلاش کنید."
      },
      blockAlt: {
        title: "مسدود کردن {{name}}؟", description: "مسدود کردن {{name}} باعث می‌شود:",
        removeMatches: "حذف از تطابق‌های شما", hideProfile: "پنهان شدن پروفایل شما از آن‌ها",
        preventMatching: "جلوگیری از تطابق آینده", deleteMessages: "حذف دائمی همه پیام‌ها (قابل بازگشت نیست)", block: "مسدود کردن"
      },
      unmatch: {
        title: "لغو تطابق با {{name}}؟", description: "این مکالمه شما با {{name}} را پایان می‌دهد. ممکن است دوباره در کاوش همدیگر را ببینید.",
        privacy: "{{name}} از لغو تطابق مطلع نخواهد شد", button: "لغو تطابق", needToBlock: "نیاز به مسدود کردن دارید؟",
        successTitle: "تطابق لغو شد", successMessage: "شما تطابق با {{name}} را لغو کردید", errorMessage: "لغو تطابق ناموفق بود. لطفاً دوباره تلاش کنید."
      }
    }
  },
  he: {
    chat: { blockedConfirmation: "חסמת את {{name}}" },
    moderation: {
      menu: { reportUser: "דווח על משתמש", unmatch: "בטל התאמה", blockUser: "חסום משתמש" },
      report: {
        title: "דווח על {{name}}", subtitle: "אנא בחר את הסיבה לדיווח על משתמש זה:",
        reasons: {
          blackmail: "סחיטה / שיתוף צילומי מסך", blackmailDescription: "מישהו שיתף צילום מסך של הפרופיל שלך עם סימן מים",
          inappropriateContent: "תוכן לא הולם", inappropriateContentDescription: "תמונות, ביוגרפיה או הודעות מכילים תוכן לא הולם",
          harassment: "הטרדה", harassmentDescription: "התנהגות מאיימת, מטרידה או מבריונית",
          fakeProfile: "פרופיל מזויף", fakeProfileDescription: "הפרופיל נראה מזויף או מתחזה למישהו",
          scam: "הונאה", scamDescription: "מבקש כסף או נראה כהונאה",
          spam: "ספאם", spamDescription: "שליחת הודעות ספאם או פרסומיות",
          underage: "משתמש קטין", underageDescription: "המשתמש נראה מתחת לגיל 18",
          hateSpeech: "דברי שנאה", hateSpeechDescription: "שפה מפלה או שנאה",
          other: "אחר", otherDescription: "סיבה אחרת שלא מופיעה למעלה"
        },
        evidencePhotos: "תמונות ראיה", upload: "העלה",
        evidenceInfo: "העלה צילומי מסך שמציגים את הפרופיל שלך עם סימן המים הנראה.",
        explainWhy: "הסבר מדוע אתה מדווח", explainHint: "אנא תאר את ההתנהגות או התוכן הספציפי שמפר את ההנחיות שלנו.",
        explainPlaceholder: "מה עשה המשתמש הזה? היה ספציפי...",
        charsNeeded: "נדרשים עוד {{count}} תווים", charsCount: "{{count}}/500",
        privacyNotice: "הדיווח שלך אנונימי. המשתמש המדווח לא יקבל הודעה.",
        submitReport: "שלח דיווח",
        permissionRequired: "נדרשת הרשאה", permissionMessage: "אנא אפשר גישה לספריית התמונות להעלאת ראיות.",
        uploadFailed: "ההעלאה נכשלה", uploadFailedMessage: "העלאת תמונה אחת או יותר נכשלה. אנא נסה שוב.",
        selectPhotoError: "בחירת תמונות נכשלה. אנא נסה שוב.",
        selectReasonError: "אנא בחר סיבה לדיווח",
        explanationRequired: "נדרש הסבר", explanationRequiredMessage: "אנא ספק הסבר מפורט (לפחות 20 תווים) מדוע אתה מדווח על משתמש זה.",
        evidenceRequired: "נדרשות ראיות", evidenceRequiredMessage: "דיווחי סחיטה דורשים ראיות צילומי מסך.",
        mustBeLoggedIn: "עליך להיות מחובר כדי לדווח על משתמש",
        submitted: "הדיווח נשלח", submittedMessage: "תודה שעזרת לנו לשמור על Accord בטוח. צוות הפיקוח שלנו יבדוק דיווח זה.",
        submitError: "שליחת הדיווח נכשלה. אנא נסה שוב."
      },
      reportAlt: {
        title: "דווח על {{name}}", subtitle: "עזור לנו לשמור על Accord בטוח",
        whyReporting: "מדוע אתה מדווח על פרופיל זה?", provideDetails: "אנא ספק פרטים",
        detailsPlaceholder: "עזור לנו להבין מה קרה (מינימום 10 תווים)",
        evidenceInfo: "העלה צילומי מסך שמציגים את הפרופיל שלך עם סימן המים.",
        evidenceRequiredMessage: "דיווחי סחיטה דורשים ראיות צילומי מסך.",
        infoNotice: "דיווחים נבדקים על ידי הצוות שלנו. דיווחים כוזבים עלולים לגרום להשעיית חשבון.",
        reasons: { blackmail: "סחיטה / שיתוף צילומי מסך", harassment: "הטרדה או בריונות", fakeProfile: "פרופיל מזויף או הונאה", inappropriateContent: "תמונות או הודעות לא הולמות", spam: "ספאם או שידול", underage: "משתמש קטין", safetyConcern: "חשש בטיחותי", other: "אחר" }
      },
      block: {
        title: "לחסום את {{name}}?", description: "חסימת משתמש זה תגרום ל:",
        hideProfile: "הסתרת הפרופיל שלך מהם", preventMessages: "מניעת שליחת הודעות אליך",
        deleteMessages: "מחיקת כל ההודעות לצמיתות (לא ניתן לבטל)", noNotification: "הם לא יקבלו הודעה",
        unblockNote: "ניתן לבטל חסימה מאוחר יותר בהגדרות ← משתמשים חסומים",
        blockUser: "חסום משתמש", alreadyBlocked: "כבר חסום", alreadyBlockedMessage: "כבר חסמת משתמש זה.",
        userBlocked: "המשתמש נחסם", userBlockedMessage: "{{name}} נחסם. השיחה שלך נמחקה לצמיתות והם לא יכולים עוד לראות את הפרופיל שלך.",
        mustBeLoggedIn: "עליך להיות מחובר כדי לחסום משתמש", error: "חסימת המשתמש נכשלה. אנא נסה שוב."
      },
      blockAlt: {
        title: "לחסום את {{name}}?", description: "חסימת {{name}} תגרום ל:",
        removeMatches: "הסרתם מההתאמות שלך", hideProfile: "הסתרת הפרופיל שלך מהם",
        preventMatching: "מניעת התאמות עתידיות", deleteMessages: "מחיקת כל ההודעות לצמיתות (לא ניתן לבטל)", block: "חסום"
      },
      unmatch: {
        title: "לבטל התאמה עם {{name}}?", description: "פעולה זו תסיים את השיחה שלך עם {{name}}. ייתכן שתראו אחד את השני שוב בגילוי.",
        privacy: "{{name}} לא יקבל הודעה על ביטול ההתאמה", button: "בטל התאמה", needToBlock: "צריך לחסום במקום?",
        successTitle: "ההתאמה בוטלה", successMessage: "ביטלת את ההתאמה עם {{name}}", errorMessage: "ביטול ההתאמה נכשל. אנא נסה שוב."
      }
    }
  },
  ur: {
    chat: { blockedConfirmation: "آپ نے {{name}} کو بلاک کر دیا" },
    moderation: {
      menu: { reportUser: "صارف کی رپورٹ کریں", unmatch: "میچ ختم کریں", blockUser: "صارف کو بلاک کریں" },
      report: {
        title: "{{name}} کی رپورٹ کریں", subtitle: "براہ کرم اس صارف کی رپورٹ کی وجہ منتخب کریں:",
        reasons: {
          blackmail: "بلیک میل / اسکرین شاٹ شیئرنگ", blackmailDescription: "کسی نے آپ کی پروفائل کا واٹر مارک والا اسکرین شاٹ شیئر کیا",
          inappropriateContent: "نامناسب مواد", inappropriateContentDescription: "تصاویر، بائیو، یا پیغامات میں نامناسب مواد ہے",
          harassment: "ہراسانی", harassmentDescription: "دھمکی آمیز، ہراساں کرنے والا، یا غنڈہ گردی کا رویہ",
          fakeProfile: "جعلی پروفائل", fakeProfileDescription: "پروفائل جعلی لگتا ہے یا کسی کی نقالی کر رہا ہے",
          scam: "دھوکہ دہی", scamDescription: "پیسے مانگ رہا ہے یا دھوکہ لگتا ہے",
          spam: "اسپام", spamDescription: "اسپام یا پروموشنل پیغامات بھیجنا",
          underage: "کم عمر صارف", underageDescription: "صارف 18 سال سے کم لگتا ہے",
          hateSpeech: "نفرت انگیز تقریر", hateSpeechDescription: "امتیازی یا نفرت انگیز زبان",
          other: "دیگر", otherDescription: "اوپر درج نہ کی گئی دوسری وجہ"
        },
        evidencePhotos: "ثبوت کی تصاویر", upload: "اپلوڈ",
        evidenceInfo: "اسکرین شاٹس اپلوڈ کریں جو آپ کی پروفائل کو واٹر مارک کے ساتھ دکھائیں۔",
        explainWhy: "رپورٹ کی وجہ بیان کریں", explainHint: "براہ کرم مخصوص رویے یا مواد کی وضاحت کریں جو ہماری رہنما اصولوں کی خلاف ورزی کرتا ہے۔",
        explainPlaceholder: "اس صارف نے کیا کیا؟ تفصیل سے بتائیں...",
        charsNeeded: "مزید {{count}} حروف درکار ہیں", charsCount: "{{count}}/500",
        privacyNotice: "آپ کی رپورٹ گمنام ہے۔ رپورٹ شدہ صارف کو مطلع نہیں کیا جائے گا۔",
        submitReport: "رپورٹ جمع کرائیں",
        permissionRequired: "اجازت درکار ہے", permissionMessage: "ثبوت اپلوڈ کرنے کے لیے فوٹو لائبریری تک رسائی کی اجازت دیں۔",
        uploadFailed: "اپلوڈ ناکام", uploadFailedMessage: "ایک یا زیادہ تصاویر اپلوڈ نہیں ہو سکیں۔ دوبارہ کوشش کریں۔",
        selectPhotoError: "تصاویر منتخب نہیں ہو سکیں۔ دوبارہ کوشش کریں۔",
        selectReasonError: "براہ کرم رپورٹ کی وجہ منتخب کریں",
        explanationRequired: "وضاحت ضروری ہے", explanationRequiredMessage: "براہ کرم تفصیلی وضاحت فراہم کریں (کم از کم 20 حروف)۔",
        evidenceRequired: "ثبوت ضروری ہے", evidenceRequiredMessage: "بلیک میل رپورٹس کے لیے اسکرین شاٹ ثبوت ضروری ہے۔",
        mustBeLoggedIn: "صارف کی رپورٹ کرنے کے لیے لاگ ان ہونا ضروری ہے",
        submitted: "رپورٹ جمع ہو گئی", submittedMessage: "Accord کو محفوظ رکھنے میں مدد کا شکریہ۔ ہماری ٹیم اس رپورٹ کا جائزہ لے گی۔",
        submitError: "رپورٹ جمع نہیں ہو سکی۔ دوبارہ کوشش کریں۔"
      },
      reportAlt: {
        title: "{{name}} کی رپورٹ کریں", subtitle: "Accord کو محفوظ رکھنے میں ہماری مدد کریں",
        whyReporting: "آپ اس پروفائل کی رپورٹ کیوں کر رہے ہیں؟", provideDetails: "براہ کرم تفصیلات فراہم کریں",
        detailsPlaceholder: "ہمیں سمجھنے میں مدد کریں کیا ہوا (کم از کم 10 حروف)",
        evidenceInfo: "اسکرین شاٹس اپلوڈ کریں جو آپ کی پروفائل کو واٹر مارک کے ساتھ دکھائیں۔",
        evidenceRequiredMessage: "بلیک میل رپورٹس کے لیے اسکرین شاٹ ثبوت ضروری ہے۔",
        infoNotice: "رپورٹس ہماری ٹیم کے ذریعے جائزہ لی جاتی ہیں۔ جھوٹی رپورٹس اکاؤنٹ معطلی کا سبب بن سکتی ہیں۔",
        reasons: { blackmail: "بلیک میل / اسکرین شاٹ شیئرنگ", harassment: "ہراسانی یا غنڈہ گردی", fakeProfile: "جعلی پروفائل یا دھوکہ", inappropriateContent: "نامناسب تصاویر یا پیغامات", spam: "اسپام یا سولیسیٹیشن", underage: "کم عمر صارف", safetyConcern: "حفاظتی خدشہ", other: "دیگر" }
      },
      block: {
        title: "{{name}} کو بلاک کریں؟", description: "اس صارف کو بلاک کرنے سے:",
        hideProfile: "آپ کی پروفائل ان سے چھپ جائے گی", preventMessages: "وہ آپ کو پیغام نہیں بھیج سکیں گے",
        deleteMessages: "تمام پیغامات مستقل طور پر حذف ہو جائیں گے (واپس نہیں ہو سکتے)", noNotification: "انہیں مطلع نہیں کیا جائے گا",
        unblockNote: "آپ بعد میں سیٹنگز ← بلاک شدہ صارفین میں ان بلاک کر سکتے ہیں",
        blockUser: "صارف کو بلاک کریں", alreadyBlocked: "پہلے سے بلاک", alreadyBlockedMessage: "آپ نے پہلے ہی اس صارف کو بلاک کر رکھا ہے۔",
        userBlocked: "صارف بلاک ہو گیا", userBlockedMessage: "{{name}} بلاک ہو گیا۔ آپ کی گفتگو مستقل طور پر حذف ہو گئی ہے اور وہ اب آپ کی پروفائل نہیں دیکھ سکتے۔",
        mustBeLoggedIn: "صارف کو بلاک کرنے کے لیے لاگ ان ہونا ضروری ہے", error: "صارف کو بلاک نہیں کیا جا سکا۔ دوبارہ کوشش کریں۔"
      },
      blockAlt: {
        title: "{{name}} کو بلاک کریں؟", description: "{{name}} کو بلاک کرنے سے:",
        removeMatches: "آپ کے میچز سے ہٹا دیا جائے گا", hideProfile: "آپ کی پروفائل ان سے چھپ جائے گی",
        preventMatching: "مستقبل کے میچنگ سے روکا جائے گا", deleteMessages: "تمام پیغامات مستقل طور پر حذف ہو جائیں گے (واپس نہیں ہو سکتے)", block: "بلاک کریں"
      },
      unmatch: {
        title: "{{name}} سے میچ ختم کریں؟", description: "یہ {{name}} کے ساتھ آپ کی گفتگو ختم کر دے گا۔ آپ دوبارہ ڈسکوری میں ایک دوسرے کو دیکھ سکتے ہیں۔",
        privacy: "{{name}} کو میچ ختم ہونے کی اطلاع نہیں دی جائے گی", button: "میچ ختم کریں", needToBlock: "بلاک کرنے کی ضرورت ہے؟",
        successTitle: "میچ ختم ہو گیا", successMessage: "آپ نے {{name}} سے میچ ختم کر دیا", errorMessage: "میچ ختم نہیں ہو سکا۔ دوبارہ کوشش کریں۔"
      }
    }
  },
  bn: {
    chat: { blockedConfirmation: "আপনি {{name}}-কে ব্লক করেছেন" },
    moderation: {
      menu: { reportUser: "ব্যবহারকারীকে রিপোর্ট করুন", unmatch: "আনম্যাচ করুন", blockUser: "ব্যবহারকারীকে ব্লক করুন" },
      report: {
        title: "{{name}}-কে রিপোর্ট করুন", subtitle: "এই ব্যবহারকারীকে রিপোর্ট করার কারণ নির্বাচন করুন:",
        reasons: {
          blackmail: "ব্ল্যাকমেইল / স্ক্রিনশট শেয়ারিং", blackmailDescription: "কেউ আপনার ওয়াটারমার্কযুক্ত প্রোফাইলের স্ক্রিনশট শেয়ার করেছে",
          inappropriateContent: "অনুপযুক্ত কন্টেন্ট", inappropriateContentDescription: "ছবি, বায়ো বা মেসেজে অনুপযুক্ত কন্টেন্ট রয়েছে",
          harassment: "হয়রানি", harassmentDescription: "হুমকি, হয়রানি বা বুলিং আচরণ",
          fakeProfile: "ভুয়া প্রোফাইল", fakeProfileDescription: "প্রোফাইলটি ভুয়া বা কারো ছদ্মবেশ ধারণ করছে বলে মনে হচ্ছে",
          scam: "প্রতারণা", scamDescription: "টাকা চাইছে বা প্রতারণা মনে হচ্ছে",
          spam: "স্প্যাম", spamDescription: "স্প্যাম বা প্রচারমূলক মেসেজ পাঠানো",
          underage: "অপ্রাপ্তবয়স্ক ব্যবহারকারী", underageDescription: "ব্যবহারকারী ১৮ বছরের কম বলে মনে হচ্ছে",
          hateSpeech: "ঘৃণামূলক বক্তব্য", hateSpeechDescription: "বৈষম্যমূলক বা ঘৃণাত্মক ভাষা",
          other: "অন্যান্য", otherDescription: "উপরে তালিকাভুক্ত নয় এমন অন্য কারণ"
        },
        evidencePhotos: "প্রমাণের ছবি", upload: "আপলোড",
        evidenceInfo: "ওয়াটারমার্কসহ আপনার প্রোফাইল দেখায় এমন স্ক্রিনশট আপলোড করুন।",
        explainWhy: "রিপোর্ট করার কারণ ব্যাখ্যা করুন", explainHint: "আমাদের নির্দেশিকা লঙ্ঘন করে এমন নির্দিষ্ট আচরণ বা কন্টেন্ট বর্ণনা করুন।",
        explainPlaceholder: "এই ব্যবহারকারী কী করেছে? নির্দিষ্ট করে বলুন...",
        charsNeeded: "আরও {{count}}টি অক্ষর প্রয়োজন", charsCount: "{{count}}/500",
        privacyNotice: "আপনার রিপোর্ট বেনামে। রিপোর্ট করা ব্যবহারকারীকে জানানো হবে না।",
        submitReport: "রিপোর্ট জমা দিন",
        permissionRequired: "অনুমতি প্রয়োজন", permissionMessage: "প্রমাণ আপলোড করতে ফটো লাইব্রেরিতে অ্যাক্সেসের অনুমতি দিন।",
        uploadFailed: "আপলোড ব্যর্থ", uploadFailedMessage: "এক বা একাধিক ছবি আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",
        selectPhotoError: "ছবি নির্বাচন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",
        selectReasonError: "রিপোর্ট করার একটি কারণ নির্বাচন করুন",
        explanationRequired: "ব্যাখ্যা প্রয়োজন", explanationRequiredMessage: "কেন রিপোর্ট করছেন তার বিস্তারিত ব্যাখ্যা দিন (কমপক্ষে ২০ অক্ষর)।",
        evidenceRequired: "প্রমাণ প্রয়োজন", evidenceRequiredMessage: "ব্ল্যাকমেইল রিপোর্টের জন্য স্ক্রিনশট প্রমাণ প্রয়োজন।",
        mustBeLoggedIn: "ব্যবহারকারীকে রিপোর্ট করতে লগ ইন করতে হবে",
        submitted: "রিপোর্ট জমা হয়েছে", submittedMessage: "Accord নিরাপদ রাখতে সাহায্য করার জন্য ধন্যবাদ। আমাদের দল এই রিপোর্ট পর্যালোচনা করবে।",
        submitError: "রিপোর্ট জমা দেওয়া যায়নি। আবার চেষ্টা করুন।"
      },
      reportAlt: {
        title: "{{name}}-কে রিপোর্ট করুন", subtitle: "Accord নিরাপদ রাখতে আমাদের সাহায্য করুন",
        whyReporting: "আপনি কেন এই প্রোফাইল রিপোর্ট করছেন?", provideDetails: "বিবরণ দিন",
        detailsPlaceholder: "কী ঘটেছে তা বুঝতে আমাদের সাহায্য করুন (কমপক্ষে ১০ অক্ষর)",
        evidenceInfo: "ওয়াটারমার্কসহ আপনার প্রোফাইল দেখায় এমন স্ক্রিনশট আপলোড করুন।",
        evidenceRequiredMessage: "ব্ল্যাকমেইল রিপোর্টের জন্য স্ক্রিনশট প্রমাণ প্রয়োজন।",
        infoNotice: "রিপোর্ট আমাদের দল পর্যালোচনা করে। মিথ্যা রিপোর্ট অ্যাকাউন্ট স্থগিত করতে পারে।",
        reasons: { blackmail: "ব্ল্যাকমেইল / স্ক্রিনশট শেয়ারিং", harassment: "হয়রানি বা বুলিং", fakeProfile: "ভুয়া প্রোফাইল বা প্রতারণা", inappropriateContent: "অনুপযুক্ত ছবি বা মেসেজ", spam: "স্প্যাম বা সলিসিটেশন", underage: "অপ্রাপ্তবয়স্ক ব্যবহারকারী", safetyConcern: "নিরাপত্তা উদ্বেগ", other: "অন্যান্য" }
      },
      block: {
        title: "{{name}}-কে ব্লক করবেন?", description: "এই ব্যবহারকারীকে ব্লক করলে:",
        hideProfile: "আপনার প্রোফাইল তাদের থেকে লুকানো হবে", preventMessages: "তারা আপনাকে মেসেজ করতে পারবে না",
        deleteMessages: "সব মেসেজ স্থায়ীভাবে মুছে যাবে (পূর্বাবস্থায় ফেরানো যাবে না)", noNotification: "তাদের জানানো হবে না",
        unblockNote: "আপনি পরে সেটিংস ← ব্লক করা ব্যবহারকারী থেকে আনব্লক করতে পারেন",
        blockUser: "ব্যবহারকারীকে ব্লক করুন", alreadyBlocked: "ইতিমধ্যে ব্লক করা", alreadyBlockedMessage: "আপনি ইতিমধ্যে এই ব্যবহারকারীকে ব্লক করেছেন।",
        userBlocked: "ব্যবহারকারী ব্লক হয়েছে", userBlockedMessage: "{{name}} ব্লক হয়েছে। আপনার কথোপকথন স্থায়ীভাবে মুছে গেছে এবং তারা আর আপনার প্রোফাইল দেখতে পারবে না।",
        mustBeLoggedIn: "ব্যবহারকারীকে ব্লক করতে লগ ইন করতে হবে", error: "ব্যবহারকারীকে ব্লক করা যায়নি। আবার চেষ্টা করুন।"
      },
      blockAlt: {
        title: "{{name}}-কে ব্লক করবেন?", description: "{{name}}-কে ব্লক করলে:",
        removeMatches: "আপনার ম্যাচ থেকে সরানো হবে", hideProfile: "আপনার প্রোফাইল তাদের থেকে লুকানো হবে",
        preventMatching: "ভবিষ্যত ম্যাচিং রোধ করা হবে", deleteMessages: "সব মেসেজ স্থায়ীভাবে মুছে যাবে (পূর্বাবস্থায় ফেরানো যাবে না)", block: "ব্লক করুন"
      },
      unmatch: {
        title: "{{name}}-এর সাথে আনম্যাচ করবেন?", description: "এটি {{name}}-এর সাথে আপনার কথোপকথন শেষ করবে। আপনারা আবার ডিসকভারিতে একে অপরকে দেখতে পারেন।",
        privacy: "{{name}}-কে আনম্যাচের বিষয়ে জানানো হবে না", button: "আনম্যাচ করুন", needToBlock: "ব্লক করতে চান?",
        successTitle: "আনম্যাচ হয়েছে", successMessage: "আপনি {{name}}-এর সাথে আনম্যাচ করেছেন", errorMessage: "আনম্যাচ করা যায়নি। আবার চেষ্টা করুন।"
      }
    }
  },
  hi: {
    chat: { blockedConfirmation: "आपने {{name}} को ब्लॉक कर दिया" },
    moderation: {
      menu: { reportUser: "उपयोगकर्ता की रिपोर्ट करें", unmatch: "अनमैच करें", blockUser: "उपयोगकर्ता को ब्लॉक करें" },
      report: {
        title: "{{name}} की रिपोर्ट करें", subtitle: "कृपया इस उपयोगकर्ता की रिपोर्ट करने का कारण चुनें:",
        reasons: {
          blackmail: "ब्लैकमेल / स्क्रीनशॉट शेयरिंग", blackmailDescription: "किसी ने आपकी वॉटरमार्क वाली प्रोफ़ाइल का स्क्रीनशॉट शेयर किया",
          inappropriateContent: "अनुचित सामग्री", inappropriateContentDescription: "फ़ोटो, बायो या मैसेज में अनुचित सामग्री है",
          harassment: "उत्पीड़न", harassmentDescription: "धमकी, उत्पीड़न या बुलिंग व्यवहार",
          fakeProfile: "नकली प्रोफ़ाइल", fakeProfileDescription: "प्रोफ़ाइल नकली लगती है या किसी की नकल कर रही है",
          scam: "धोखाधड़ी", scamDescription: "पैसे माँग रहा है या धोखाधड़ी लगती है",
          spam: "स्पैम", spamDescription: "स्पैम या प्रचार संदेश भेजना",
          underage: "नाबालिग उपयोगकर्ता", underageDescription: "उपयोगकर्ता 18 वर्ष से कम लगता है",
          hateSpeech: "घृणा भाषण", hateSpeechDescription: "भेदभावपूर्ण या घृणास्पद भाषा",
          other: "अन्य", otherDescription: "ऊपर सूचीबद्ध नहीं किया गया अन्य कारण"
        },
        evidencePhotos: "सबूत की तस्वीरें", upload: "अपलोड",
        evidenceInfo: "वॉटरमार्क वाली अपनी प्रोफ़ाइल दिखाने वाले स्क्रीनशॉट अपलोड करें।",
        explainWhy: "रिपोर्ट का कारण बताएं", explainHint: "कृपया उस विशिष्ट व्यवहार या सामग्री का वर्णन करें जो हमारे दिशानिर्देशों का उल्लंघन करती है।",
        explainPlaceholder: "इस उपयोगकर्ता ने क्या किया? विस्तार से बताएं...",
        charsNeeded: "{{count}} और अक्षर चाहिए", charsCount: "{{count}}/500",
        privacyNotice: "आपकी रिपोर्ट गुमनाम है। रिपोर्ट किए गए उपयोगकर्ता को सूचित नहीं किया जाएगा।",
        submitReport: "रिपोर्ट जमा करें",
        permissionRequired: "अनुमति आवश्यक", permissionMessage: "सबूत अपलोड करने के लिए फ़ोटो लाइब्रेरी तक पहुँच की अनुमति दें।",
        uploadFailed: "अपलोड विफल", uploadFailedMessage: "एक या अधिक फ़ोटो अपलोड नहीं हो सकीं। पुनः प्रयास करें।",
        selectPhotoError: "फ़ोटो चुनने में विफल। पुनः प्रयास करें।",
        selectReasonError: "कृपया रिपोर्ट का कारण चुनें",
        explanationRequired: "स्पष्टीकरण आवश्यक", explanationRequiredMessage: "कृपया विस्तृत स्पष्टीकरण दें (कम से कम 20 अक्षर)।",
        evidenceRequired: "सबूत आवश्यक", evidenceRequiredMessage: "ब्लैकमेल रिपोर्ट के लिए स्क्रीनशॉट सबूत आवश्यक है।",
        mustBeLoggedIn: "उपयोगकर्ता की रिपोर्ट करने के लिए लॉग इन करना होगा",
        submitted: "रिपोर्ट जमा हो गई", submittedMessage: "Accord को सुरक्षित रखने में मदद करने के लिए धन्यवाद। हमारी टीम इस रिपोर्ट की समीक्षा करेगी।",
        submitError: "रिपोर्ट जमा नहीं हो सकी। पुनः प्रयास करें।"
      },
      reportAlt: {
        title: "{{name}} की रिपोर्ट करें", subtitle: "Accord को सुरक्षित रखने में हमारी मदद करें",
        whyReporting: "आप इस प्रोफ़ाइल की रिपोर्ट क्यों कर रहे हैं?", provideDetails: "कृपया विवरण दें",
        detailsPlaceholder: "क्या हुआ यह समझने में हमारी मदद करें (कम से कम 10 अक्षर)",
        evidenceInfo: "वॉटरमार्क वाली अपनी प्रोफ़ाइल दिखाने वाले स्क्रीनशॉट अपलोड करें।",
        evidenceRequiredMessage: "ब्लैकमेल रिपोर्ट के लिए स्क्रीनशॉट सबूत आवश्यक है।",
        infoNotice: "रिपोर्ट हमारी टीम द्वारा समीक्षा की जाती हैं। झूठी रिपोर्ट से खाता निलंबन हो सकता है।",
        reasons: { blackmail: "ब्लैकमेल / स्क्रीनशॉट शेयरिंग", harassment: "उत्पीड़न या बुलिंग", fakeProfile: "नकली प्रोफ़ाइल या धोखाधड़ी", inappropriateContent: "अनुचित फ़ोटो या मैसेज", spam: "स्पैम या सॉलिसिटेशन", underage: "नाबालिग उपयोगकर्ता", safetyConcern: "सुरक्षा चिंता", other: "अन्य" }
      },
      block: {
        title: "{{name}} को ब्लॉक करें?", description: "इस उपयोगकर्ता को ब्लॉक करने से:",
        hideProfile: "आपकी प्रोफ़ाइल उनसे छिप जाएगी", preventMessages: "वे आपको मैसेज नहीं कर पाएंगे",
        deleteMessages: "सभी मैसेज स्थायी रूप से हटा दिए जाएंगे (वापस नहीं किया जा सकता)", noNotification: "उन्हें सूचित नहीं किया जाएगा",
        unblockNote: "आप बाद में सेटिंग्स ← ब्लॉक किए गए उपयोगकर्ता में अनब्लॉक कर सकते हैं",
        blockUser: "उपयोगकर्ता को ब्लॉक करें", alreadyBlocked: "पहले से ब्लॉक", alreadyBlockedMessage: "आपने पहले ही इस उपयोगकर्ता को ब्लॉक कर रखा है।",
        userBlocked: "उपयोगकर्ता ब्लॉक हो गया", userBlockedMessage: "{{name}} ब्लॉक हो गया। आपकी बातचीत स्थायी रूप से हटा दी गई है और वे अब आपकी प्रोफ़ाइल नहीं देख सकते।",
        mustBeLoggedIn: "उपयोगकर्ता को ब्लॉक करने के लिए लॉग इन करना होगा", error: "उपयोगकर्ता को ब्लॉक नहीं किया जा सका। पुनः प्रयास करें।"
      },
      blockAlt: {
        title: "{{name}} को ब्लॉक करें?", description: "{{name}} को ब्लॉक करने से:",
        removeMatches: "आपके मैचों से हटा दिया जाएगा", hideProfile: "आपकी प्रोफ़ाइल उनसे छिप जाएगी",
        preventMatching: "भविष्य की मैचिंग रोकी जाएगी", deleteMessages: "सभी मैसेज स्थायी रूप से हटा दिए जाएंगे (वापस नहीं किया जा सकता)", block: "ब्लॉक करें"
      },
      unmatch: {
        title: "{{name}} से अनमैच करें?", description: "यह {{name}} के साथ आपकी बातचीत समाप्त कर देगा। आप फिर से डिस्कवरी में एक दूसरे को देख सकते हैं।",
        privacy: "{{name}} को अनमैच की सूचना नहीं दी जाएगी", button: "अनमैच करें", needToBlock: "ब्लॉक करना चाहते हैं?",
        successTitle: "अनमैच हो गया", successMessage: "आपने {{name}} से अनमैच कर दिया", errorMessage: "अनमैच नहीं हो सका। पुनः प्रयास करें।"
      }
    }
  }
};

const localesDir = path.join(__dirname, '..', 'locales');
for (const [locale, trans] of Object.entries(translations)) {
  const filePath = path.join(localesDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  deepMerge(data, trans);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`✅ ${locale}.json updated`);
}
console.log('\nBatch 1 done (ar, fa, he, ur, bn, hi)');
