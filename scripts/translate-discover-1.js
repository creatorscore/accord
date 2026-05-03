/**
 * Translates discover, filters (new keys), and verification sections
 * for locales: ar, bn, de, es, fa, fr
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
    discover: {
      dailyLimitTitle: 'تم الوصول للحد اليومي',
      dailyLimitMessage: 'لقد استخدمت جميع الإعجابات الخمسة اليوم. قم بالترقية للحصول على إعجابات غير محدودة!',
      quickFilter: {
        age: 'العمر',
        datingIntentions: 'نوايا المواعدة',
        activeToday: 'نشط اليوم'
      },
      ageSlider: {
        ageRange: 'نطاق العمر: {{min}} - {{max}}',
        minimum: 'الحد الأدنى: {{value}}',
        maximum: 'الحد الأقصى: {{value}}'
      },
      search: {
        placeholder: "ابحث بكلمة مفتاحية (مثل: 'سفر'، 'نباتي')",
        button: 'بحث',
        tip: 'أعجب أو مرر للمتابعة. امسح البحث لرؤية جميع الملفات.',
        noResults: 'لا توجد نتائج لـ "{{keyword}}"',
        noResultsHint: 'جرب كلمات مفتاحية مختلفة أو عدّل الفلاتر للعثور على المزيد.',
        clearSearch: 'مسح البحث'
      },
      emptyState: {
        allCaughtUp: 'لقد شاهدت الكل',
        checkBack: 'ينضم أشخاص جدد كل يوم.\nعد قريبًا أو وسّع تفضيلاتك.'
      },
      premiumCta: {
        goPremium: 'اشترك بريميوم',
        description: 'شاهد من أعجب بك، إعجابات غير محدودة، والمزيد.',
        upgrade: 'ترقية'
      },
      recommendations: {
        expandReach: 'وسّع نطاقك',
        increaseDistance: 'زد المسافة بمقدار {{count}} ميل',
        widenAge: 'وسّع نطاق العمر بمقدار {{count}} سنة',
        includeGender: 'أضف {{gender}}',
        searchGlobally: 'ابحث عالميًا',
        expandSearch: 'وسّع بحثك',
        newProfilesK: '{{count}}ك+ ملفات شخصية جديدة',
        newProfiles: '{{count}} ملفات شخصية جديدة',
        newProfileSingular: 'ملف شخصي جديد واحد',
        updatePreferencesTitle: 'تحديث التفضيلات؟',
        updatePreferencesMessage: 'إضافة "{{gender}}" إلى تفضيلات الجنس؟ يمكنك تغيير هذا في أي وقت من الإعدادات > تفضيلات المطابقة.',
        add: 'إضافة'
      },
      banner: {
        photoBlurTitle: 'لماذا بعض الصور ضبابية',
        photoBlurDescription: 'بعض المستخدمين يفعّلون تمويه الصور في إعدادات الخصوصية لحماية هويتهم حتى المطابقة. ستظهر الصور بعد التواصل!',
        profileHidden: 'الملف الشخصي مخفي',
        profileHiddenDescription: 'ملفك الشخصي مخفي مؤقتًا. اضغط لرفع صور جديدة.',
        completeProfileToMatch: 'أكمل ملفك للمطابقة',
        completeProfile: 'أكمل ملفك الشخصي',
        completeProfilePreview: 'يمكنك التصفح بحرية! أكمل التسجيل لبدء الإعجاب والمطابقة.',
        completeProfileDefault: 'أكمل الإعداد لبدء المطابقة. يمكنك التصفح لكن لا يمكنك الإعجاب أو الظهور بعد.'
      },
      premiumLocation: {
        title: 'افتح البحث العالمي',
        description: 'لديك تفضيلات موقع محفوظة تتطلب بريميوم:',
        searchGlobally: 'ابحث عالميًا عن المطابقات',
        matchCities: 'تطابق في مدن محددة',
        upgradeMessage: 'قم بالترقية إلى بريميوم لتفعيل هذه الميزات والعثور على مطابقات في أي مكان في العالم.',
        upgradeToPremium: 'ترقية إلى بريميوم',
        maybeLater: 'ربما لاحقًا'
      }
    },
    filters: {
      basicFilters: 'الفلاتر الأساسية',
      minimum: 'الحد الأدنى',
      maximum: 'الحد الأقصى',
      activeToday: 'نشط اليوم',
      activeTodayDescription: 'عرض المستخدمين النشطين خلال 24 ساعة فقط',
      showBlurred: 'عرض الصور الضبابية',
      showBlurredDescription: 'تضمين الملفات ذات تمويه الصور',
      advancedFilters: 'فلاتر متقدمة',
      identityBackground: 'الهوية والخلفية',
      gender: 'الجنس',
      ethnicity: 'العرق',
      sexualOrientation: 'التوجه الجنسي',
      physicalPersonality: 'الجسدية والشخصية',
      heightRange: 'نطاق الطول',
      zodiacSign: 'البرج',
      mbtiPersonality: 'نوع شخصية MBTI',
      loveLanguage: 'لغة الحب',
      lifestyle: 'نمط الحياة',
      languagesSpoken: 'اللغات المنطوقة',
      smoking: 'التدخين',
      drinking: 'الشرب',
      pets: 'الحيوانات الأليفة',
      marriageIntentions: 'نوايا الزواج',
      primaryReason: 'السبب الرئيسي',
      relationshipType: 'نوع العلاقة',
      wantsChildren: 'يريد أطفال',
      housingPreference: 'تفضيل السكن',
      financialArrangement: 'الترتيب المالي'
    },
    verification: {
      alreadyVerified: 'تم التحقق مسبقًا',
      alreadyVerifiedMessage: 'صورك محققة بالفعل!',
      tooManyAttempts: 'محاولات كثيرة جدًا',
      tooManyAttemptsMessage: 'لقد تجاوزت الحد الأقصى لمحاولات التحقق (5). يرجى التواصل مع الدعم على hello@joinaccord.app.',
      tooManyAttemptsMessageShort: 'لقد تجاوزت الحد الأقصى لمحاولات التحقق. يرجى التواصل مع الدعم.',
      cameraPermission: 'إذن الكاميرا مطلوب',
      cameraPermissionMessage: 'يرجى السماح بالوصول للكاميرا لالتقاط سيلفي التحقق.',
      selfieError: 'خطأ في السيلفي',
      selfieErrorMessage: 'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
      success: 'تم تحقق الصور!',
      successMessage: 'تم التحقق من صورك!\n\nنسبة التطابق: {{similarity}}%\n\nملفك الشخصي يعرض الآن شارة التحقق.',
      awesome: 'رائع!',
      unsuccessful: 'التحقق غير ناجح',
      unsuccessfulMessage: '{{message}}\n\nلتحسين فرصك:\n\n• التقط السيلفي في ضوء نهاري ساطع\n• تأكد أن صورتك الرئيسية حديثة\n• واجه الكاميرا مباشرة\n• أزل النظارات الشمسية والقبعات\n• تجنب الظلال على وجهك',
      tryAgain: 'حاول مرة أخرى',
      noPhotos: 'لا توجد صور',
      noPhotosMessage: 'يرجى رفع صور للملف الشخصي قبل التحقق.',
      profileNotFound: 'الملف الشخصي غير موجود. يرجى المحاولة مرة أخرى.',
      error: 'خطأ في التحقق',
      errorMessage: 'فشل التحقق. يرجى المحاولة لاحقًا.',
      statusVerified: 'محقق',
      statusProcessing: 'جارٍ المعالجة...',
      statusFailed: 'فشل',
      statusNotVerified: 'غير محقق',
      title: 'تحقق الصور',
      verifiedDescription: 'صورك محققة! هذا يُظهر للمستخدمين الآخرين أن صور ملفك تمثلك بدقة.',
      unverifiedDescription: 'تحقق من صورك بالتقاط سيلفي. سنقارنها بصور ملفك باستخدام التعرف على الوجه.',
      beforeYouStart: 'قبل البدء',
      beforeYouStartDescription: 'تأكد أن صورتك الرئيسية (الصورة الأولى) حديثة وواضحة لوجهك. سيتم مقارنة السيلفي بصور ملفك.',
      attemptsUsed: 'المحاولات المستخدمة: {{count}} / 5',
      unsuccessfulBanner: 'التحقق غير ناجح',
      unsuccessfulBannerMessage: 'السيلفي لم يتطابق مع صور ملفك بشكل كافٍ. للحصول على أفضل النتائج، التقط السيلفي في ضوء نهاري ساطع وتأكد أن صورتك الرئيسية حديثة وواضحة.',
      verifying: 'جارٍ التحقق...',
      takeVerificationSelfie: 'التقط سيلفي التحقق',
      forBestResults: 'للحصول على أفضل النتائج:',
      tips: {
        daylight: 'التقط السيلفي في ضوء نهاري ساطع وطبيعي',
        faceCamera: 'واجه الكاميرا مباشرة بتعبير محايد',
        recentPhoto: 'تأكد أن صورتك الرئيسية حديثة وتظهر وجهك بوضوح',
        removeCoverings: 'أزل النظارات الشمسية والقبعات وأغطية الوجه',
        avoidShadows: 'تجنب الظلال القاسية أو البيئات ذات الإضاءة الخلفية',
        mustMatch: 'يجب أن يتطابق السيلفي مع الشخص في صور ملفك'
      },
      photosVerified: 'تم تحقق الصور!',
      verifiedBadgeMessage: 'شارة التحقق تظهر الآن على ملفك. هذا يساعد في بناء الثقة مع المطابقات المحتملة.',
      freeForAll: 'مجاني لجميع المستخدمين'
    }
  },
  bn: {
    discover: {
      dailyLimitTitle: 'দৈনিক সীমা পৌঁছেছে',
      dailyLimitMessage: 'আজকের ৫টি লাইক শেষ হয়েছে। আনলিমিটেডের জন্য আপগ্রেড করুন!',
      quickFilter: {
        age: 'বয়স',
        datingIntentions: 'ডেটিং উদ্দেশ্য',
        activeToday: 'আজ সক্রিয়'
      },
      ageSlider: {
        ageRange: 'বয়সের পরিসর: {{min}} - {{max}}',
        minimum: 'সর্বনিম্ন: {{value}}',
        maximum: 'সর্বোচ্চ: {{value}}'
      },
      search: {
        placeholder: "কীওয়ার্ড দিয়ে খুঁজুন (যেমন: 'ভ্রমণ', 'নিরামিষ')",
        button: 'খুঁজুন',
        tip: 'খোঁজা চালিয়ে যেতে লাইক বা পাস করুন। সব প্রোফাইল দেখতে সার্চ মুছুন।',
        noResults: '"{{keyword}}" এর জন্য কোনো ফলাফল নেই',
        noResultsHint: 'আরো ম্যাচ খুঁজতে ভিন্ন কীওয়ার্ড ব্যবহার করুন বা ফিল্টার পরিবর্তন করুন।',
        clearSearch: 'সার্চ মুছুন'
      },
      emptyState: {
        allCaughtUp: 'আপনি সব দেখেছেন',
        checkBack: 'প্রতিদিন নতুন মানুষ যোগ দেয়।\nশীঘ্রই আবার দেখুন বা পছন্দ বাড়ান।'
      },
      premiumCta: {
        goPremium: 'প্রিমিয়াম নিন',
        description: 'কে আপনাকে লাইক করেছে দেখুন, আনলিমিটেড লাইক, এবং আরো।',
        upgrade: 'আপগ্রেড'
      },
      recommendations: {
        expandReach: 'আপনার পরিসর বাড়ান',
        increaseDistance: 'দূরত্ব {{count}} মাইল বাড়ান',
        widenAge: 'বয়সের পরিসর {{count}} বছর বাড়ান',
        includeGender: '{{gender}} অন্তর্ভুক্ত করুন',
        searchGlobally: 'বিশ্বব্যাপী খুঁজুন',
        expandSearch: 'আপনার অনুসন্ধান বাড়ান',
        newProfilesK: '{{count}}হাজার+ নতুন প্রোফাইল',
        newProfiles: '{{count}}টি নতুন প্রোফাইল',
        newProfileSingular: '১টি নতুন প্রোফাইল',
        updatePreferencesTitle: 'পছন্দ আপডেট করবেন?',
        updatePreferencesMessage: 'আপনার জেন্ডার পছন্দে "{{gender}}" যোগ করবেন? আপনি সেটিংস > ম্যাচিং পছন্দ থেকে যেকোনো সময় পরিবর্তন করতে পারেন।',
        add: 'যোগ করুন'
      },
      banner: {
        photoBlurTitle: 'কিছু ছবি ঝাপসা কেন',
        photoBlurDescription: 'কিছু ব্যবহারকারী ম্যাচ না হওয়া পর্যন্ত পরিচয় রক্ষার জন্য ফটো ব্লার সক্রিয় করেন। সংযোগের পর ছবি দেখা যাবে!',
        profileHidden: 'প্রোফাইল লুকানো',
        profileHiddenDescription: 'আপনার প্রোফাইল সাময়িকভাবে লুকানো। নতুন ছবি আপলোড করতে ট্যাপ করুন।',
        completeProfileToMatch: 'ম্যাচ করতে প্রোফাইল সম্পূর্ণ করুন',
        completeProfile: 'আপনার প্রোফাইল সম্পূর্ণ করুন',
        completeProfilePreview: 'আপনি স্বাধীনভাবে ব্রাউজ করতে পারেন! লাইক ও ম্যাচিং শুরু করতে অনবোর্ডিং সম্পূর্ণ করুন।',
        completeProfileDefault: 'ম্যাচিং শুরু করতে সেটআপ সম্পূর্ণ করুন। আপনি ব্রাউজ করতে পারেন কিন্তু লাইক করতে বা দেখা যেতে পারবেন না।'
      },
      premiumLocation: {
        title: 'গ্লোবাল সার্চ আনলক করুন',
        description: 'আপনার সংরক্ষিত লোকেশন পছন্দে প্রিমিয়াম প্রয়োজন:',
        searchGlobally: 'বিশ্বব্যাপী ম্যাচ খুঁজুন',
        matchCities: 'নির্দিষ্ট শহরে ম্যাচ করুন',
        upgradeMessage: 'এই ফিচারগুলো সক্রিয় করতে এবং বিশ্বের যেকোনো জায়গায় ম্যাচ খুঁজতে প্রিমিয়ামে আপগ্রেড করুন।',
        upgradeToPremium: 'প্রিমিয়ামে আপগ্রেড',
        maybeLater: 'পরে হয়তো'
      }
    },
    filters: {
      basicFilters: 'মৌলিক ফিল্টার',
      minimum: 'সর্বনিম্ন',
      maximum: 'সর্বোচ্চ',
      activeToday: 'আজ সক্রিয়',
      activeTodayDescription: 'শুধু গত ২৪ ঘণ্টায় সক্রিয় ব্যবহারকারী দেখান',
      showBlurred: 'ঝাপসা ছবি দেখান',
      showBlurredDescription: 'ফটো ব্লার সক্রিয় প্রোফাইল অন্তর্ভুক্ত করুন',
      advancedFilters: 'উন্নত ফিল্টার',
      identityBackground: 'পরিচয় ও পটভূমি',
      gender: 'লিঙ্গ',
      ethnicity: 'জাতিগত পরিচয়',
      sexualOrientation: 'যৌন অভিমুখিতা',
      physicalPersonality: 'শারীরিক ও ব্যক্তিত্ব',
      heightRange: 'উচ্চতার পরিসর',
      zodiacSign: 'রাশিচক্র',
      mbtiPersonality: 'MBTI ব্যক্তিত্বের ধরন',
      loveLanguage: 'ভালোবাসার ভাষা',
      lifestyle: 'জীবনধারা',
      languagesSpoken: 'কথ্য ভাষা',
      smoking: 'ধূমপান',
      drinking: 'মদ্যপান',
      pets: 'পোষা প্রাণী',
      marriageIntentions: 'বিবাহের উদ্দেশ্য',
      primaryReason: 'প্রাথমিক কারণ',
      relationshipType: 'সম্পর্কের ধরন',
      wantsChildren: 'সন্তান চান',
      housingPreference: 'বাসস্থান পছন্দ',
      financialArrangement: 'আর্থিক ব্যবস্থা'
    },
    verification: {
      alreadyVerified: 'ইতিমধ্যে যাচাইকৃত',
      alreadyVerifiedMessage: 'আপনার ছবি ইতিমধ্যে যাচাইকৃত!',
      tooManyAttempts: 'অনেক বেশি প্রচেষ্টা',
      tooManyAttemptsMessage: 'আপনি সর্বোচ্চ যাচাই প্রচেষ্টা (৫) অতিক্রম করেছেন। অনুগ্রহ করে hello@joinaccord.app এ যোগাযোগ করুন।',
      tooManyAttemptsMessageShort: 'আপনি সর্বোচ্চ যাচাই প্রচেষ্টা অতিক্রম করেছেন। অনুগ্রহ করে সাপোর্টে যোগাযোগ করুন।',
      cameraPermission: 'ক্যামেরা অনুমতি প্রয়োজন',
      cameraPermissionMessage: 'যাচাই সেলফি তুলতে অনুগ্রহ করে ক্যামেরা অ্যাক্সেস দিন।',
      selfieError: 'সেলফি ত্রুটি',
      selfieErrorMessage: 'কিছু ভুল হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
      success: 'ছবি যাচাইকৃত!',
      successMessage: 'আপনার ছবি যাচাই হয়েছে!\n\nম্যাচ আত্মবিশ্বাস: {{similarity}}%\n\nআপনার প্রোফাইলে এখন যাচাই ব্যাজ দেখাচ্ছে।',
      awesome: 'দারুণ!',
      unsuccessful: 'যাচাই ব্যর্থ',
      unsuccessfulMessage: '{{message}}\n\nআপনার সুযোগ উন্নত করতে:\n\n• উজ্জ্বল প্রাকৃতিক আলোতে সেলফি তুলুন\n• আপনার প্রাথমিক প্রোফাইল ছবি সাম্প্রতিক রাখুন\n• সরাসরি ক্যামেরার দিকে তাকান\n• সানগ্লাস, টুপি বা মাস্ক সরান\n• মুখে ছায়া এড়িয়ে চলুন',
      tryAgain: 'আবার চেষ্টা করুন',
      noPhotos: 'কোনো প্রোফাইল ছবি নেই',
      noPhotosMessage: 'যাচাই করার আগে অনুগ্রহ করে প্রোফাইল ছবি আপলোড করুন।',
      profileNotFound: 'প্রোফাইল পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
      error: 'যাচাই ত্রুটি',
      errorMessage: 'যাচাই ব্যর্থ হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।',
      statusVerified: 'যাচাইকৃত',
      statusProcessing: 'প্রক্রিয়াকরণ হচ্ছে...',
      statusFailed: 'ব্যর্থ',
      statusNotVerified: 'যাচাই হয়নি',
      title: 'ছবি যাচাই',
      verifiedDescription: 'আপনার ছবি যাচাইকৃত! এটি অন্য ব্যবহারকারীদের দেখায় যে আপনার প্রোফাইল ছবি আপনাকে সঠিকভাবে উপস্থাপন করে।',
      unverifiedDescription: 'সেলফি তুলে আপনার ছবি যাচাই করুন। আমরা ফেস রিকগনিশন ব্যবহার করে আপনার প্রোফাইল ছবির সাথে তুলনা করব।',
      beforeYouStart: 'শুরু করার আগে',
      beforeYouStartDescription: 'নিশ্চিত করুন আপনার প্রাথমিক প্রোফাইল ছবি (প্রথম ছবি) সাম্প্রতিক এবং আপনার মুখের স্পষ্ট ছবি। সেলফি আপনার প্রোফাইল ছবির সাথে তুলনা করা হবে।',
      attemptsUsed: 'ব্যবহৃত প্রচেষ্টা: {{count}} / ৫',
      unsuccessfulBanner: 'যাচাই ব্যর্থ',
      unsuccessfulBannerMessage: 'সেলফি আপনার প্রোফাইল ছবির সাথে যথেষ্ট মেলেনি। সেরা ফলাফলের জন্য, উজ্জ্বল প্রাকৃতিক আলোতে সেলফি তুলুন এবং আপনার প্রাথমিক প্রোফাইল ছবি সাম্প্রতিক ও স্পষ্ট রাখুন।',
      verifying: 'যাচাই হচ্ছে...',
      takeVerificationSelfie: 'যাচাই সেলফি তুলুন',
      forBestResults: 'সেরা ফলাফলের জন্য:',
      tips: {
        daylight: 'উজ্জ্বল, প্রাকৃতিক দিনের আলোতে সেলফি তুলুন',
        faceCamera: 'নিরপেক্ষ অভিব্যক্তি সহ সরাসরি ক্যামেরার দিকে তাকান',
        recentPhoto: 'নিশ্চিত করুন আপনার প্রাথমিক প্রোফাইল ছবি সাম্প্রতিক এবং মুখ স্পষ্টভাবে দেখায়',
        removeCoverings: 'সানগ্লাস, টুপি এবং মুখ ঢাকা সরান',
        avoidShadows: 'কঠোর ছায়া বা ব্যাকলিট পরিবেশ এড়িয়ে চলুন',
        mustMatch: 'আপনার সেলফি অবশ্যই প্রোফাইল ছবির ব্যক্তির সাথে মিলতে হবে'
      },
      photosVerified: 'ছবি যাচাইকৃত!',
      verifiedBadgeMessage: 'আপনার যাচাই ব্যাজ এখন প্রোফাইলে দেখাচ্ছে। এটি সম্ভাব্য ম্যাচের সাথে বিশ্বাস গড়তে সাহায্য করে।',
      freeForAll: 'সকল ব্যবহারকারীর জন্য বিনামূল্যে'
    }
  },
  de: {
    discover: {
      dailyLimitTitle: 'Tageslimit erreicht',
      dailyLimitMessage: 'Du hast alle 5 Likes für heute aufgebraucht. Upgrade für unbegrenzte!',
      quickFilter: {
        age: 'Alter',
        datingIntentions: 'Dating-Absichten',
        activeToday: 'Heute aktiv'
      },
      ageSlider: {
        ageRange: 'Altersbereich: {{min}} - {{max}}',
        minimum: 'Minimum: {{value}}',
        maximum: 'Maximum: {{value}}'
      },
      search: {
        placeholder: "Suche nach Stichwort (z.B. 'Reisen', 'vegan')",
        button: 'Suchen',
        tip: 'Like oder überspringe, um weiterzusuchen. Suche löschen, um alle Profile zu sehen.',
        noResults: 'Keine Ergebnisse für "{{keyword}}"',
        noResultsHint: 'Versuche andere Stichwörter oder passe deine Filter an.',
        clearSearch: 'Suche löschen'
      },
      emptyState: {
        allCaughtUp: 'Du bist auf dem neuesten Stand',
        checkBack: 'Jeden Tag kommen neue Leute dazu.\nSchau bald wieder vorbei oder erweitere deine Präferenzen.'
      },
      premiumCta: {
        goPremium: 'Premium werden',
        description: 'Sieh, wer dich geliked hat, unbegrenzte Likes und mehr.',
        upgrade: 'Upgrade'
      },
      recommendations: {
        expandReach: 'Erweitere deine Reichweite',
        increaseDistance: 'Entfernung um {{count}} Meilen erhöhen',
        widenAge: 'Altersbereich um {{count}} Jahre erweitern',
        includeGender: '{{gender}} einschließen',
        searchGlobally: 'Global suchen',
        expandSearch: 'Suche erweitern',
        newProfilesK: '{{count}}k+ neue Profile',
        newProfiles: '{{count}} neue Profile',
        newProfileSingular: '1 neues Profil',
        updatePreferencesTitle: 'Präferenzen aktualisieren?',
        updatePreferencesMessage: '"{{gender}}" zu deinen Geschlechtspräferenzen hinzufügen? Du kannst dies jederzeit unter Einstellungen > Matching-Präferenzen ändern.',
        add: 'Hinzufügen'
      },
      banner: {
        photoBlurTitle: 'Warum einige Fotos unscharf sind',
        photoBlurDescription: 'Einige Nutzer aktivieren Foto-Unschärfe in ihren Datenschutzeinstellungen, um ihre Identität bis zum Match zu schützen. Fotos werden nach der Verbindung sichtbar!',
        profileHidden: 'Profil versteckt',
        profileHiddenDescription: 'Dein Profil ist vorübergehend versteckt. Tippe, um neue Fotos hochzuladen.',
        completeProfileToMatch: 'Vervollständige dein Profil zum Matchen',
        completeProfile: 'Vervollständige dein Profil',
        completeProfilePreview: 'Du kannst frei stöbern! Schließe das Onboarding ab, um mit dem Liken und Matchen zu beginnen.',
        completeProfileDefault: 'Schließe die Einrichtung ab, um mit dem Matchen zu beginnen. Du kannst stöbern, aber noch nicht liken oder gesehen werden.'
      },
      premiumLocation: {
        title: 'Globale Suche freischalten',
        description: 'Du hast gespeicherte Standortpräferenzen, die Premium erfordern:',
        searchGlobally: 'Global nach Matches suchen',
        matchCities: 'In bestimmten Städten matchen',
        upgradeMessage: 'Upgrade auf Premium, um diese Funktionen zu aktivieren und überall auf der Welt Matches zu finden.',
        upgradeToPremium: 'Auf Premium upgraden',
        maybeLater: 'Vielleicht später'
      }
    },
    filters: {
      basicFilters: 'Grundfilter',
      minimum: 'Minimum',
      maximum: 'Maximum',
      activeToday: 'Heute aktiv',
      activeTodayDescription: 'Nur Nutzer anzeigen, die in den letzten 24 Stunden aktiv waren',
      showBlurred: 'Unscharfe Fotos anzeigen',
      showBlurredDescription: 'Profile mit aktivierter Foto-Unschärfe einschließen',
      advancedFilters: 'Erweiterte Filter',
      identityBackground: 'Identität & Hintergrund',
      gender: 'Geschlecht',
      ethnicity: 'Ethnizität',
      sexualOrientation: 'Sexuelle Orientierung',
      physicalPersonality: 'Körperlich & Persönlichkeit',
      heightRange: 'Größenbereich',
      zodiacSign: 'Sternzeichen',
      mbtiPersonality: 'MBTI-Persönlichkeitstyp',
      loveLanguage: 'Liebessprache',
      lifestyle: 'Lebensstil',
      languagesSpoken: 'Gesprochene Sprachen',
      smoking: 'Rauchen',
      drinking: 'Trinken',
      pets: 'Haustiere',
      marriageIntentions: 'Heiratsabsichten',
      primaryReason: 'Hauptgrund',
      relationshipType: 'Beziehungstyp',
      wantsChildren: 'Kinderwunsch',
      housingPreference: 'Wohnpräferenz',
      financialArrangement: 'Finanzielle Vereinbarung'
    },
    verification: {
      alreadyVerified: 'Bereits verifiziert',
      alreadyVerifiedMessage: 'Deine Fotos sind bereits verifiziert!',
      tooManyAttempts: 'Zu viele Versuche',
      tooManyAttemptsMessage: 'Du hast die maximale Anzahl an Verifizierungsversuchen (5) überschritten. Bitte kontaktiere den Support unter hello@joinaccord.app.',
      tooManyAttemptsMessageShort: 'Du hast die maximale Anzahl an Verifizierungsversuchen überschritten. Bitte kontaktiere den Support.',
      cameraPermission: 'Kameraberechtigung erforderlich',
      cameraPermissionMessage: 'Bitte erlaube den Kamerazugriff für ein Verifizierungs-Selfie.',
      selfieError: 'Selfie-Fehler',
      selfieErrorMessage: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
      success: 'Fotos verifiziert!',
      successMessage: 'Deine Fotos wurden verifiziert!\n\nÜbereinstimmung: {{similarity}}%\n\nDein Profil zeigt jetzt ein Verifizierungsabzeichen.',
      awesome: 'Super!',
      unsuccessful: 'Verifizierung nicht erfolgreich',
      unsuccessfulMessage: '{{message}}\n\nUm deine Chancen zu verbessern:\n\n• Mache dein Selfie bei hellem, natürlichem Tageslicht\n• Stelle sicher, dass dein primäres Profilfoto aktuell ist\n• Schaue direkt in die Kamera\n• Entferne Sonnenbrillen, Hüte oder Masken\n• Vermeide Schatten im Gesicht',
      tryAgain: 'Erneut versuchen',
      noPhotos: 'Keine Profilfotos',
      noPhotosMessage: 'Bitte lade Profilfotos hoch, bevor du verifizierst.',
      profileNotFound: 'Profil nicht gefunden. Bitte versuche es erneut.',
      error: 'Verifizierungsfehler',
      errorMessage: 'Verifizierung fehlgeschlagen. Bitte versuche es später erneut.',
      statusVerified: 'Verifiziert',
      statusProcessing: 'Wird verarbeitet...',
      statusFailed: 'Fehlgeschlagen',
      statusNotVerified: 'Nicht verifiziert',
      title: 'Foto-Verifizierung',
      verifiedDescription: 'Deine Fotos sind verifiziert! Dies zeigt anderen Nutzern, dass deine Profilbilder dich genau darstellen.',
      unverifiedDescription: 'Verifiziere deine Fotos mit einem Selfie. Wir vergleichen es mit deinen Profilfotos mittels Gesichtserkennung.',
      beforeYouStart: 'Bevor du beginnst',
      beforeYouStartDescription: 'Stelle sicher, dass dein primäres Profilfoto (erstes Foto) ein aktuelles, klares Foto deines Gesichts ist. Das Selfie wird mit deinen Profilfotos verglichen.',
      attemptsUsed: 'Versuche verwendet: {{count}} / 5',
      unsuccessfulBanner: 'Verifizierung nicht erfolgreich',
      unsuccessfulBannerMessage: 'Das Selfie stimmte nicht ausreichend mit deinen Profilfotos überein. Für beste Ergebnisse mache dein Selfie bei hellem Tageslicht und stelle sicher, dass dein primäres Profilfoto aktuell und klar ist.',
      verifying: 'Verifizierung läuft...',
      takeVerificationSelfie: 'Verifizierungs-Selfie aufnehmen',
      forBestResults: 'Für beste Ergebnisse:',
      tips: {
        daylight: 'Mache dein Selfie bei hellem, natürlichem Tageslicht',
        faceCamera: 'Schaue direkt in die Kamera mit neutralem Gesichtsausdruck',
        recentPhoto: 'Stelle sicher, dass dein primäres Profilfoto aktuell ist und dein Gesicht klar zeigt',
        removeCoverings: 'Entferne Sonnenbrillen, Hüte und Gesichtsbedeckungen',
        avoidShadows: 'Vermeide harte Schatten oder Gegenlicht',
        mustMatch: 'Dein Selfie muss mit der Person auf deinen Profilfotos übereinstimmen'
      },
      photosVerified: 'Fotos verifiziert!',
      verifiedBadgeMessage: 'Dein Verifizierungsabzeichen wird jetzt auf deinem Profil angezeigt. Dies hilft, Vertrauen bei potenziellen Matches aufzubauen.',
      freeForAll: 'Kostenlos für alle Nutzer'
    }
  },
  es: {
    discover: {
      dailyLimitTitle: 'Límite diario alcanzado',
      dailyLimitMessage: '¡Has usado los 5 likes de hoy. Actualiza para likes ilimitados!',
      quickFilter: {
        age: 'Edad',
        datingIntentions: 'Intenciones de citas',
        activeToday: 'Activo hoy'
      },
      ageSlider: {
        ageRange: 'Rango de edad: {{min}} - {{max}}',
        minimum: 'Mínimo: {{value}}',
        maximum: 'Máximo: {{value}}'
      },
      search: {
        placeholder: "Buscar por palabra clave (ej. 'viajes', 'vegano')",
        button: 'Buscar',
        tip: 'Da like o pasa para seguir buscando. Borra la búsqueda para ver todos los perfiles.',
        noResults: 'Sin resultados para "{{keyword}}"',
        noResultsHint: 'Prueba diferentes palabras clave o ajusta tus filtros para encontrar más coincidencias.',
        clearSearch: 'Borrar búsqueda'
      },
      emptyState: {
        allCaughtUp: 'Estás al día',
        checkBack: 'Nuevas personas se unen cada día.\nVuelve pronto o amplía tus preferencias.'
      },
      premiumCta: {
        goPremium: 'Hazte Premium',
        description: 'Ve quién te dio like, likes ilimitados y más.',
        upgrade: 'Actualizar'
      },
      recommendations: {
        expandReach: 'Amplía tu alcance',
        increaseDistance: 'Aumentar distancia en {{count}} mi',
        widenAge: 'Ampliar rango de edad en {{count}} años',
        includeGender: 'Incluir {{gender}}',
        searchGlobally: 'Buscar globalmente',
        expandSearch: 'Ampliar tu búsqueda',
        newProfilesK: '{{count}}k+ perfiles nuevos',
        newProfiles: '{{count}} perfiles nuevos',
        newProfileSingular: '1 perfil nuevo',
        updatePreferencesTitle: '¿Actualizar preferencias?',
        updatePreferencesMessage: '¿Agregar "{{gender}}" a tus preferencias de género? Puedes cambiarlo en cualquier momento en Configuración > Preferencias de coincidencia.',
        add: 'Agregar'
      },
      banner: {
        photoBlurTitle: 'Por qué algunas fotos están borrosas',
        photoBlurDescription: 'Algunos usuarios activan el desenfoque de fotos en su configuración de privacidad para proteger su identidad hasta hacer match. ¡Las fotos se revelarán al conectar!',
        profileHidden: 'Perfil oculto',
        profileHiddenDescription: 'Tu perfil está temporalmente oculto. Toca para subir nuevas fotos.',
        completeProfileToMatch: 'Completa tu perfil para hacer match',
        completeProfile: 'Completa tu perfil',
        completeProfilePreview: '¡Puedes navegar libremente! Completa el registro para empezar a dar likes y hacer match.',
        completeProfileDefault: 'Termina la configuración para empezar a hacer match. Puedes navegar pero no puedes dar likes ni ser visto aún.'
      },
      premiumLocation: {
        title: 'Desbloquear búsqueda global',
        description: 'Tienes preferencias de ubicación guardadas que requieren Premium:',
        searchGlobally: 'Buscar coincidencias globalmente',
        matchCities: 'Hacer match en ciudades específicas',
        upgradeMessage: 'Actualiza a Premium para activar estas funciones y encontrar coincidencias en cualquier parte del mundo.',
        upgradeToPremium: 'Actualizar a Premium',
        maybeLater: 'Quizás después'
      }
    },
    filters: {
      basicFilters: 'Filtros básicos',
      minimum: 'Mínimo',
      maximum: 'Máximo',
      activeToday: 'Activo hoy',
      activeTodayDescription: 'Solo mostrar usuarios activos en las últimas 24 horas',
      showBlurred: 'Mostrar fotos borrosas',
      showBlurredDescription: 'Incluir perfiles con desenfoque de fotos activado',
      advancedFilters: 'Filtros avanzados',
      identityBackground: 'Identidad y origen',
      gender: 'Género',
      ethnicity: 'Etnicidad',
      sexualOrientation: 'Orientación sexual',
      physicalPersonality: 'Físico y personalidad',
      heightRange: 'Rango de altura',
      zodiacSign: 'Signo zodiacal',
      mbtiPersonality: 'Tipo de personalidad MBTI',
      loveLanguage: 'Lenguaje del amor',
      lifestyle: 'Estilo de vida',
      languagesSpoken: 'Idiomas hablados',
      smoking: 'Fumar',
      drinking: 'Beber',
      pets: 'Mascotas',
      marriageIntentions: 'Intenciones matrimoniales',
      primaryReason: 'Razón principal',
      relationshipType: 'Tipo de relación',
      wantsChildren: 'Quiere hijos',
      housingPreference: 'Preferencia de vivienda',
      financialArrangement: 'Acuerdo financiero'
    },
    verification: {
      alreadyVerified: 'Ya verificado',
      alreadyVerifiedMessage: '¡Tus fotos ya están verificadas!',
      tooManyAttempts: 'Demasiados intentos',
      tooManyAttemptsMessage: 'Has excedido el número máximo de intentos de verificación (5). Por favor contacta soporte en hello@joinaccord.app.',
      tooManyAttemptsMessageShort: 'Has excedido el número máximo de intentos de verificación. Por favor contacta soporte.',
      cameraPermission: 'Permiso de cámara requerido',
      cameraPermissionMessage: 'Por favor permite el acceso a la cámara para tomar un selfie de verificación.',
      selfieError: 'Error de selfie',
      selfieErrorMessage: 'Algo salió mal. Por favor intenta de nuevo.',
      success: '¡Fotos verificadas!',
      successMessage: '¡Tus fotos han sido verificadas!\n\nConfianza de coincidencia: {{similarity}}%\n\nTu perfil ahora muestra una insignia verificada.',
      awesome: '¡Genial!',
      unsuccessful: 'Verificación no exitosa',
      unsuccessfulMessage: '{{message}}\n\nPara mejorar tus posibilidades:\n\n• Toma tu selfie con luz natural brillante\n• Asegúrate de que tu foto principal sea reciente\n• Mira directamente a la cámara\n• Quítate gafas de sol, gorros o máscaras\n• Evita sombras en tu cara',
      tryAgain: 'Intentar de nuevo',
      noPhotos: 'Sin fotos de perfil',
      noPhotosMessage: 'Por favor sube fotos de perfil antes de verificar.',
      profileNotFound: 'Perfil no encontrado. Por favor intenta de nuevo.',
      error: 'Error de verificación',
      errorMessage: 'La verificación falló. Por favor intenta más tarde.',
      statusVerified: 'Verificado',
      statusProcessing: 'Procesando...',
      statusFailed: 'Fallido',
      statusNotVerified: 'No verificado',
      title: 'Verificación de fotos',
      verifiedDescription: '¡Tus fotos están verificadas! Esto muestra a otros usuarios que tus fotos de perfil te representan con precisión.',
      unverifiedDescription: 'Verifica tus fotos tomando un selfie. Compararemos con tus fotos de perfil usando reconocimiento facial.',
      beforeYouStart: 'Antes de empezar',
      beforeYouStartDescription: 'Asegúrate de que tu foto principal (primera foto) sea una foto reciente y clara de tu cara. El selfie se comparará con tus fotos de perfil.',
      attemptsUsed: 'Intentos usados: {{count}} / 5',
      unsuccessfulBanner: 'Verificación no exitosa',
      unsuccessfulBannerMessage: 'El selfie no coincidió suficientemente con tus fotos de perfil. Para mejores resultados, toma tu selfie con luz natural brillante y asegúrate de que tu foto principal sea reciente y clara.',
      verifying: 'Verificando...',
      takeVerificationSelfie: 'Tomar selfie de verificación',
      forBestResults: 'Para mejores resultados:',
      tips: {
        daylight: 'Toma tu selfie con luz natural brillante',
        faceCamera: 'Mira directamente a la cámara con expresión neutral',
        recentPhoto: 'Asegúrate de que tu foto principal sea reciente y muestre tu cara claramente',
        removeCoverings: 'Quítate gafas de sol, gorros y coberturas faciales',
        avoidShadows: 'Evita sombras fuertes o ambientes con contraluz',
        mustMatch: 'Tu selfie debe coincidir con la persona en tus fotos de perfil'
      },
      photosVerified: '¡Fotos verificadas!',
      verifiedBadgeMessage: 'Tu insignia verificada ahora se muestra en tu perfil. Esto ayuda a generar confianza con posibles coincidencias.',
      freeForAll: 'Gratis para todos los usuarios'
    }
  },
  fa: {
    discover: {
      dailyLimitTitle: 'به حد روزانه رسیدید',
      dailyLimitMessage: 'شما هر ۵ لایک امروز را استفاده کرده‌اید. برای نامحدود ارتقا دهید!',
      quickFilter: {
        age: 'سن',
        datingIntentions: 'اهداف آشنایی',
        activeToday: 'فعال امروز'
      },
      ageSlider: {
        ageRange: 'محدوده سنی: {{min}} - {{max}}',
        minimum: 'حداقل: {{value}}',
        maximum: 'حداکثر: {{value}}'
      },
      search: {
        placeholder: "جستجو با کلمه کلیدی (مثل: 'سفر'، 'گیاه‌خوار')",
        button: 'جستجو',
        tip: 'لایک یا رد کنید تا جستجو ادامه یابد. جستجو را پاک کنید تا همه پروفایل‌ها را ببینید.',
        noResults: 'نتیجه‌ای برای "{{keyword}}" یافت نشد',
        noResultsHint: 'کلمات کلیدی دیگر را امتحان کنید یا فیلترها را تنظیم کنید.',
        clearSearch: 'پاک کردن جستجو'
      },
      emptyState: {
        allCaughtUp: 'همه را دیدید',
        checkBack: 'هر روز افراد جدید می‌پیوندند.\nبه زودی برگردید یا ترجیحات خود را گسترش دهید.'
      },
      premiumCta: {
        goPremium: 'پریمیوم شوید',
        description: 'ببینید چه کسی شما را لایک کرده، لایک نامحدود و بیشتر.',
        upgrade: 'ارتقا'
      },
      recommendations: {
        expandReach: 'دامنه خود را گسترش دهید',
        increaseDistance: 'افزایش فاصله به میزان {{count}} مایل',
        widenAge: 'گسترش محدوده سنی به میزان {{count}} سال',
        includeGender: 'شامل {{gender}}',
        searchGlobally: 'جستجوی جهانی',
        expandSearch: 'جستجوی خود را گسترش دهید',
        newProfilesK: '{{count}}هزار+ پروفایل جدید',
        newProfiles: '{{count}} پروفایل جدید',
        newProfileSingular: '۱ پروفایل جدید',
        updatePreferencesTitle: 'ترجیحات به‌روز شود؟',
        updatePreferencesMessage: '"{{gender}}" به ترجیحات جنسیتی اضافه شود؟ می‌توانید هر زمان از تنظیمات > ترجیحات تطابق تغییر دهید.',
        add: 'افزودن'
      },
      banner: {
        photoBlurTitle: 'چرا برخی عکس‌ها تار هستند',
        photoBlurDescription: 'برخی کاربران تار کردن عکس را در تنظیمات حریم خصوصی فعال می‌کنند تا هویتشان تا تطابق محافظت شود. عکس‌ها پس از اتصال نمایان می‌شوند!',
        profileHidden: 'پروفایل پنهان',
        profileHiddenDescription: 'پروفایل شما موقتاً پنهان است. برای آپلود عکس‌های جدید ضربه بزنید.',
        completeProfileToMatch: 'پروفایل خود را برای تطابق کامل کنید',
        completeProfile: 'پروفایل خود را کامل کنید',
        completeProfilePreview: 'می‌توانید آزادانه مرور کنید! برای شروع لایک و تطابق، ثبت‌نام را کامل کنید.',
        completeProfileDefault: 'برای شروع تطابق، تنظیمات را کامل کنید. می‌توانید مرور کنید اما هنوز نمی‌توانید لایک کنید یا دیده شوید.'
      },
      premiumLocation: {
        title: 'جستجوی جهانی را باز کنید',
        description: 'شما ترجیحات مکانی ذخیره شده دارید که نیاز به پریمیوم دارند:',
        searchGlobally: 'جستجوی جهانی برای تطابق‌ها',
        matchCities: 'تطابق در شهرهای خاص',
        upgradeMessage: 'برای فعال‌سازی این ویژگی‌ها و یافتن تطابق در هر جای جهان به پریمیوم ارتقا دهید.',
        upgradeToPremium: 'ارتقا به پریمیوم',
        maybeLater: 'شاید بعداً'
      }
    },
    filters: {
      basicFilters: 'فیلترهای اولیه',
      minimum: 'حداقل',
      maximum: 'حداکثر',
      activeToday: 'فعال امروز',
      activeTodayDescription: 'فقط کاربران فعال در ۲۴ ساعت گذشته',
      showBlurred: 'نمایش عکس‌های تار',
      showBlurredDescription: 'شامل پروفایل‌هایی با تار کردن عکس فعال',
      advancedFilters: 'فیلترهای پیشرفته',
      identityBackground: 'هویت و پیشینه',
      gender: 'جنسیت',
      ethnicity: 'قومیت',
      sexualOrientation: 'گرایش جنسی',
      physicalPersonality: 'فیزیکی و شخصیت',
      heightRange: 'محدوده قد',
      zodiacSign: 'برج فلکی',
      mbtiPersonality: 'نوع شخصیت MBTI',
      loveLanguage: 'زبان عشق',
      lifestyle: 'سبک زندگی',
      languagesSpoken: 'زبان‌های صحبت شده',
      smoking: 'سیگار',
      drinking: 'نوشیدنی',
      pets: 'حیوانات خانگی',
      marriageIntentions: 'اهداف ازدواج',
      primaryReason: 'دلیل اصلی',
      relationshipType: 'نوع رابطه',
      wantsChildren: 'فرزند می‌خواهد',
      housingPreference: 'ترجیح مسکن',
      financialArrangement: 'توافق مالی'
    },
    verification: {
      alreadyVerified: 'قبلاً تأیید شده',
      alreadyVerifiedMessage: 'عکس‌های شما قبلاً تأیید شده‌اند!',
      tooManyAttempts: 'تلاش‌های زیاد',
      tooManyAttemptsMessage: 'شما از حداکثر تلاش‌های تأیید (۵) فراتر رفته‌اید. لطفاً با پشتیبانی تماس بگیرید hello@joinaccord.app.',
      tooManyAttemptsMessageShort: 'شما از حداکثر تلاش‌های تأیید فراتر رفته‌اید. لطفاً با پشتیبانی تماس بگیرید.',
      cameraPermission: 'مجوز دوربین لازم است',
      cameraPermissionMessage: 'لطفاً دسترسی دوربین را برای گرفتن سلفی تأیید اجازه دهید.',
      selfieError: 'خطای سلفی',
      selfieErrorMessage: 'مشکلی پیش آمد. لطفاً دوباره تلاش کنید.',
      success: 'عکس‌ها تأیید شدند!',
      successMessage: 'عکس‌های شما تأیید شدند!\n\nاطمینان تطابق: {{similarity}}%\n\nپروفایل شما اکنون نشان تأیید را نمایش می‌دهد.',
      awesome: 'عالی!',
      unsuccessful: 'تأیید ناموفق',
      unsuccessfulMessage: '{{message}}\n\nبرای بهبود شانس:\n\n• سلفی را در نور طبیعی روشن بگیرید\n• مطمئن شوید عکس اصلی پروفایل اخیر است\n• مستقیماً به دوربین نگاه کنید\n• عینک آفتابی، کلاه یا ماسک را بردارید\n• از سایه روی صورت اجتناب کنید',
      tryAgain: 'دوباره تلاش کنید',
      noPhotos: 'بدون عکس پروفایل',
      noPhotosMessage: 'لطفاً قبل از تأیید، عکس‌های پروفایل آپلود کنید.',
      profileNotFound: 'پروفایل یافت نشد. لطفاً دوباره تلاش کنید.',
      error: 'خطای تأیید',
      errorMessage: 'تأیید ناموفق بود. لطفاً بعداً دوباره تلاش کنید.',
      statusVerified: 'تأیید شده',
      statusProcessing: 'در حال پردازش...',
      statusFailed: 'ناموفق',
      statusNotVerified: 'تأیید نشده',
      title: 'تأیید عکس',
      verifiedDescription: 'عکس‌های شما تأیید شده‌اند! این به کاربران دیگر نشان می‌دهد که عکس‌های پروفایل شما دقیقاً شما را نشان می‌دهند.',
      unverifiedDescription: 'با گرفتن سلفی عکس‌هایتان را تأیید کنید. ما آن را با عکس‌های پروفایلتان با تشخیص چهره مقایسه می‌کنیم.',
      beforeYouStart: 'قبل از شروع',
      beforeYouStartDescription: 'مطمئن شوید عکس اصلی پروفایل (عکس اول) یک عکس اخیر و واضح از صورت شماست. سلفی با عکس‌های پروفایل شما مقایسه خواهد شد.',
      attemptsUsed: 'تلاش‌های استفاده شده: {{count}} / ۵',
      unsuccessfulBanner: 'تأیید ناموفق',
      unsuccessfulBannerMessage: 'سلفی به اندازه کافی با عکس‌های پروفایل شما مطابقت نداشت. برای بهترین نتایج، سلفی را در نور طبیعی روشن بگیرید و مطمئن شوید عکس اصلی پروفایل اخیر و واضح است.',
      verifying: 'در حال تأیید...',
      takeVerificationSelfie: 'گرفتن سلفی تأیید',
      forBestResults: 'برای بهترین نتایج:',
      tips: {
        daylight: 'سلفی را در نور طبیعی روشن روز بگیرید',
        faceCamera: 'مستقیماً با حالت خنثی به دوربین نگاه کنید',
        recentPhoto: 'مطمئن شوید عکس اصلی پروفایل اخیر است و صورتتان را واضح نشان می‌دهد',
        removeCoverings: 'عینک آفتابی، کلاه و پوشش‌های صورت را بردارید',
        avoidShadows: 'از سایه‌های سخت یا محیط‌های نور پشتی اجتناب کنید',
        mustMatch: 'سلفی شما باید با شخص در عکس‌های پروفایل مطابقت داشته باشد'
      },
      photosVerified: 'عکس‌ها تأیید شدند!',
      verifiedBadgeMessage: 'نشان تأیید شما اکنون روی پروفایلتان نمایش داده می‌شود. این به ایجاد اعتماد با تطابق‌های احتمالی کمک می‌کند.',
      freeForAll: 'رایگان برای همه کاربران'
    }
  },
  fr: {
    discover: {
      dailyLimitTitle: 'Limite quotidienne atteinte',
      dailyLimitMessage: 'Vous avez utilisé les 5 likes du jour. Passez à la version premium pour des likes illimités !',
      quickFilter: {
        age: 'Âge',
        datingIntentions: 'Intentions de rencontre',
        activeToday: 'Actif aujourd\'hui'
      },
      ageSlider: {
        ageRange: 'Tranche d\'âge : {{min}} - {{max}}',
        minimum: 'Minimum : {{value}}',
        maximum: 'Maximum : {{value}}'
      },
      search: {
        placeholder: "Rechercher par mot-clé (ex. 'voyage', 'végan')",
        button: 'Rechercher',
        tip: 'Likez ou passez pour continuer la recherche. Effacez la recherche pour voir tous les profils.',
        noResults: 'Aucun résultat pour "{{keyword}}"',
        noResultsHint: 'Essayez d\'autres mots-clés ou ajustez vos filtres pour trouver plus de correspondances.',
        clearSearch: 'Effacer la recherche'
      },
      emptyState: {
        allCaughtUp: 'Vous êtes à jour',
        checkBack: 'De nouvelles personnes s\'inscrivent chaque jour.\nRevenez bientôt ou élargissez vos préférences.'
      },
      premiumCta: {
        goPremium: 'Passer Premium',
        description: 'Voyez qui vous a liké, likes illimités et plus.',
        upgrade: 'Mettre à niveau'
      },
      recommendations: {
        expandReach: 'Élargissez votre portée',
        increaseDistance: 'Augmenter la distance de {{count}} mi',
        widenAge: 'Élargir la tranche d\'âge de {{count}} ans',
        includeGender: 'Inclure {{gender}}',
        searchGlobally: 'Rechercher globalement',
        expandSearch: 'Élargir votre recherche',
        newProfilesK: '{{count}}k+ nouveaux profils',
        newProfiles: '{{count}} nouveaux profils',
        newProfileSingular: '1 nouveau profil',
        updatePreferencesTitle: 'Mettre à jour les préférences ?',
        updatePreferencesMessage: 'Ajouter "{{gender}}" à vos préférences de genre ? Vous pouvez modifier cela à tout moment dans Paramètres > Préférences de correspondance.',
        add: 'Ajouter'
      },
      banner: {
        photoBlurTitle: 'Pourquoi certaines photos sont floues',
        photoBlurDescription: 'Certains utilisateurs activent le flou photo dans leurs paramètres de confidentialité pour protéger leur identité jusqu\'au match. Les photos seront révélées après connexion !',
        profileHidden: 'Profil masqué',
        profileHiddenDescription: 'Votre profil est temporairement masqué. Appuyez pour télécharger de nouvelles photos.',
        completeProfileToMatch: 'Complétez votre profil pour matcher',
        completeProfile: 'Complétez votre profil',
        completeProfilePreview: 'Vous pouvez naviguer librement ! Complétez l\'inscription pour commencer à liker et matcher.',
        completeProfileDefault: 'Terminez la configuration pour commencer à matcher. Vous pouvez naviguer mais ne pouvez pas encore liker ou être vu.'
      },
      premiumLocation: {
        title: 'Débloquer la recherche mondiale',
        description: 'Vous avez des préférences de localisation enregistrées qui nécessitent Premium :',
        searchGlobally: 'Rechercher des correspondances dans le monde entier',
        matchCities: 'Matcher dans des villes spécifiques',
        upgradeMessage: 'Passez à Premium pour activer ces fonctionnalités et trouver des correspondances partout dans le monde.',
        upgradeToPremium: 'Passer à Premium',
        maybeLater: 'Peut-être plus tard'
      }
    },
    filters: {
      basicFilters: 'Filtres de base',
      minimum: 'Minimum',
      maximum: 'Maximum',
      activeToday: 'Actif aujourd\'hui',
      activeTodayDescription: 'Afficher uniquement les utilisateurs actifs dans les dernières 24 heures',
      showBlurred: 'Afficher les photos floues',
      showBlurredDescription: 'Inclure les profils avec le flou photo activé',
      advancedFilters: 'Filtres avancés',
      identityBackground: 'Identité et parcours',
      gender: 'Genre',
      ethnicity: 'Ethnicité',
      sexualOrientation: 'Orientation sexuelle',
      physicalPersonality: 'Physique et personnalité',
      heightRange: 'Plage de taille',
      zodiacSign: 'Signe du zodiaque',
      mbtiPersonality: 'Type de personnalité MBTI',
      loveLanguage: 'Langage amoureux',
      lifestyle: 'Mode de vie',
      languagesSpoken: 'Langues parlées',
      smoking: 'Tabac',
      drinking: 'Alcool',
      pets: 'Animaux',
      marriageIntentions: 'Intentions matrimoniales',
      primaryReason: 'Raison principale',
      relationshipType: 'Type de relation',
      wantsChildren: 'Souhaite des enfants',
      housingPreference: 'Préférence de logement',
      financialArrangement: 'Arrangement financier'
    },
    verification: {
      alreadyVerified: 'Déjà vérifié',
      alreadyVerifiedMessage: 'Vos photos sont déjà vérifiées !',
      tooManyAttempts: 'Trop de tentatives',
      tooManyAttemptsMessage: 'Vous avez dépassé le nombre maximum de tentatives de vérification (5). Veuillez contacter le support à hello@joinaccord.app.',
      tooManyAttemptsMessageShort: 'Vous avez dépassé le nombre maximum de tentatives de vérification. Veuillez contacter le support.',
      cameraPermission: 'Permission de caméra requise',
      cameraPermissionMessage: 'Veuillez autoriser l\'accès à la caméra pour prendre un selfie de vérification.',
      selfieError: 'Erreur de selfie',
      selfieErrorMessage: 'Quelque chose s\'est mal passé. Veuillez réessayer.',
      success: 'Photos vérifiées !',
      successMessage: 'Vos photos ont été vérifiées !\n\nConfiance de correspondance : {{similarity}}%\n\nVotre profil affiche maintenant un badge vérifié.',
      awesome: 'Super !',
      unsuccessful: 'Vérification non réussie',
      unsuccessfulMessage: '{{message}}\n\nPour améliorer vos chances :\n\n• Prenez votre selfie en plein jour naturel\n• Assurez-vous que votre photo principale est récente\n• Regardez directement la caméra\n• Retirez lunettes de soleil, chapeaux ou masques\n• Évitez les ombres sur votre visage',
      tryAgain: 'Réessayer',
      noPhotos: 'Pas de photos de profil',
      noPhotosMessage: 'Veuillez télécharger des photos de profil avant de vérifier.',
      profileNotFound: 'Profil non trouvé. Veuillez réessayer.',
      error: 'Erreur de vérification',
      errorMessage: 'La vérification a échoué. Veuillez réessayer plus tard.',
      statusVerified: 'Vérifié',
      statusProcessing: 'Traitement en cours...',
      statusFailed: 'Échoué',
      statusNotVerified: 'Non vérifié',
      title: 'Vérification photo',
      verifiedDescription: 'Vos photos sont vérifiées ! Cela montre aux autres utilisateurs que vos photos de profil vous représentent fidèlement.',
      unverifiedDescription: 'Vérifiez vos photos en prenant un selfie. Nous le comparerons à vos photos de profil par reconnaissance faciale.',
      beforeYouStart: 'Avant de commencer',
      beforeYouStartDescription: 'Assurez-vous que votre photo principale (première photo) est une photo récente et claire de votre visage. Le selfie sera comparé à vos photos de profil.',
      attemptsUsed: 'Tentatives utilisées : {{count}} / 5',
      unsuccessfulBanner: 'Vérification non réussie',
      unsuccessfulBannerMessage: 'Le selfie ne correspondait pas suffisamment à vos photos de profil. Pour de meilleurs résultats, prenez votre selfie en plein jour et assurez-vous que votre photo principale est récente et claire.',
      verifying: 'Vérification en cours...',
      takeVerificationSelfie: 'Prendre un selfie de vérification',
      forBestResults: 'Pour de meilleurs résultats :',
      tips: {
        daylight: 'Prenez votre selfie en plein jour naturel',
        faceCamera: 'Regardez directement la caméra avec une expression neutre',
        recentPhoto: 'Assurez-vous que votre photo principale est récente et montre clairement votre visage',
        removeCoverings: 'Retirez lunettes de soleil, chapeaux et couvre-visages',
        avoidShadows: 'Évitez les ombres dures ou les environnements à contre-jour',
        mustMatch: 'Votre selfie doit correspondre à la personne sur vos photos de profil'
      },
      photosVerified: 'Photos vérifiées !',
      verifiedBadgeMessage: 'Votre badge vérifié s\'affiche maintenant sur votre profil. Cela aide à établir la confiance avec les correspondances potentielles.',
      freeForAll: 'Gratuit pour tous les utilisateurs'
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

console.log('Done! Updated 6 locales: ar, bn, de, es, fa, fr');
