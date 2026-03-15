/**
 * Adds safetyCenter translations to locales: ar, bn, de, es, fa, fr
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
    safetyCenter: {
      title: "مركز السلامة",
      subtitle: "ابقَ آمنًا على أكورد",
      safetyTipsTitle: "نصائح السلامة",
      crisisResourcesTitle: "موارد الأزمات",
      crisisResourcesDescription: "إذا كنت أنت أو شخص تعرفه في خطر، يرجى التواصل مع هذه الموارد.",
      visitWebsite: "زيارة الموقع",
      quickActionsTitle: "إجراءات سريعة",
      footerText: "سلامتك هي أولويتنا القصوى. إذا شعرت بعدم الأمان، لا تتردد في التواصل معنا أو مع الموارد أعلاه.",
      alerts: {
        callTitle: "اتصل بـ {{name}}",
        callMessage: "هل تريد الاتصال بـ {{phone}}؟",
        call: "اتصل",
        emailUs: "راسلنا على hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "المستخدمون المحظورون",
        blockedUsersDesc: "إدارة قائمة المستخدمين المحظورين",
        privacySettings: "إعدادات الخصوصية",
        privacySettingsDesc: "تحكم في خصوصيتك وظهورك",
        contactSupport: "اتصل بالدعم",
        contactSupportDesc: "أبلغ عن مخاوف السلامة لفريقنا"
      },
      tips: {
        meetSafely: {
          title: "الالتقاء بأمان",
          description: "التقِ دائمًا في أماكن عامة في المواعيد الأولى",
          expanded: "عند مقابلة شخص لأول مرة:\n\n• اختر مكانًا عامًا مثل مقهى أو مطعم أو حديقة\n• أخبر صديقًا أو فردًا من العائلة أين أنت ذاهب\n• شارك موقعك مع شخص تثق به\n• رتّب وسيلة النقل الخاصة بك\n• ابقَ متيقظًا ومنتبهًا\n• ثق بغرائزك - إذا شعرت بشيء خاطئ، غادر"
        },
        protectInfo: {
          title: "حماية معلوماتك",
          description: "حافظ على خصوصية التفاصيل الشخصية حتى تبني الثقة",
          expanded: "احمِ نفسك عبر الإنترنت:\n\n• لا تشارك عنوان منزلك أو مكان عملك أو معلوماتك المالية\n• كن حذرًا عند مشاركة رقم هاتفك\n• تجنب مشاركة التفاصيل الشخصية مبكرًا\n• استخدم رسائل أكورد داخل التطبيق حتى تشعر بالراحة\n• لا ترسل أموالًا لشخص لم تقابله\n• احذر من أي شخص يطلب مساعدة مالية"
        },
        verifyIdentity: {
          title: "التحقق من الهوية",
          description: "استخدم مكالمات الفيديو قبل اللقاء شخصيًا",
          expanded: "تحقق من أنك تتحدث مع شخص حقيقي:\n\n• اطلب مكالمة فيديو قبل اللقاء\n• ابحث عن الملفات الشخصية الموثقة (علامة التحقق الزرقاء)\n• كن حذرًا من الملفات التي تحتوي على صورة واحدة فقط\n• انتبه للتناقضات في قصتهم\n• قم ببحث عكسي عن الصورة إذا كنت مشككًا\n• أبلغ عن الملفات المزيفة أو المشبوهة فورًا"
        },
        lgbtqSafety: {
          title: "سلامة مجتمع الميم+",
          description: "اعتبارات سلامة خاصة لمجتمعنا",
          expanded: "البقاء آمنًا كشخص من مجتمع الميم+:\n\n• كن انتقائيًا بشأن من يعرف ترتيبك\n• فكّر في إعدادات الخصوصية بعناية\n• كن على دراية بالقوانين والمواقف المحلية\n• احتفظ بخطة خروج إذا شعرت بعدم الأمان\n• تواصل مع موارد مجتمع الميم+ في منطقتك\n• ثق بمجتمعك - نحن هنا لدعم بعضنا البعض"
        },
        legalProtection: {
          title: "الحماية القانونية",
          description: "فكّر في اتفاقيات رسمية لزيجات اللافندر",
          expanded: "احمِ نفسك قانونيًا:\n\n• استشر محاميًا صديقًا لمجتمع الميم+ في قانون الأسرة\n• فكّر في اتفاقية ما قبل الزواج\n• وثّق ترتيبك كتابيًا\n• افهم الآثار المترتبة على الهجرة إن وُجدت\n• اعرف حقوقك فيما يتعلق بالممتلكات والمال\n• حافظ على سرية الاتفاقيات وأمانها"
        },
        mentalHealth: {
          title: "الصحة النفسية",
          description: "اعتنِ بصحتك العاطفية",
          expanded: "أعطِ الأولوية لصحتك النفسية:\n\n• ضع حدودًا وتوقعات واضحة\n• تواصل بصراحة وأمانة\n• اطلب العلاج أو الاستشارة إذا لزم الأمر\n• تواصل مع مجموعات دعم مجتمع الميم+\n• تذكر أنك تستحق الاحترام واللطف\n• خذ استراحات من التطبيق عند الحاجة"
        },
        reportBlock: {
          title: "الإبلاغ والحظر",
          description: "استخدم أدوات السلامة لحماية نفسك",
          expanded: "حافظ على سلامتك على أكورد:\n\n• احظر المستخدمين الذين يجعلونك غير مرتاح\n• أبلغ عن التحرش أو التهديدات أو السلوك المشبوه\n• نراجع جميع البلاغات خلال 24 ساعة\n• بلاغاتك مجهولة الهوية\n• الانتهاكات الخطيرة تؤدي إلى إنهاء الحساب\n• تواصل معنا مباشرة لمخاوف السلامة العاجلة"
        }
      },
      resources: {
        trevor: { name: "مشروع تريفور", description: "دعم الأزمات على مدار الساعة لشباب مجتمع الميم+" },
        transLifeline: { name: "خط حياة العابرين", description: "دعم للأشخاص المتحولين جنسيًا" },
        glbtHotline: { name: "الخط الساخن الوطني للمثليين", description: "دعم الأقران والموارد المحلية" },
        rainn: { name: "RAINN", description: "دعم الاعتداء الجنسي" }
      }
    }
  },
  bn: {
    safetyCenter: {
      title: "নিরাপত্তা কেন্দ্র",
      subtitle: "অ্যাকর্ডে নিরাপদ থাকুন",
      safetyTipsTitle: "নিরাপত্তা টিপস",
      crisisResourcesTitle: "সংকট সম্পদ",
      crisisResourcesDescription: "আপনি বা আপনার পরিচিত কেউ যদি বিপদে থাকেন, দয়া করে এই সম্পদগুলিতে যোগাযোগ করুন।",
      visitWebsite: "ওয়েবসাইট দেখুন",
      quickActionsTitle: "দ্রুত কার্যক্রম",
      footerText: "আপনার নিরাপত্তা আমাদের সর্বোচ্চ অগ্রাধিকার। আপনি যদি কখনো অনিরাপদ বোধ করেন, আমাদের বা উপরের সম্পদগুলিতে যোগাযোগ করতে দ্বিধা করবেন না।",
      alerts: {
        callTitle: "{{name}}-এ কল করুন",
        callMessage: "আপনি কি {{phone}} নম্বরে কল করতে চান?",
        call: "কল",
        emailUs: "আমাদের ইমেইল করুন hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "ব্লক করা ব্যবহারকারী",
        blockedUsersDesc: "আপনার ব্লক তালিকা পরিচালনা করুন",
        privacySettings: "গোপনীয়তা সেটিংস",
        privacySettingsDesc: "আপনার গোপনীয়তা ও দৃশ্যমানতা নিয়ন্ত্রণ করুন",
        contactSupport: "সহায়তায় যোগাযোগ",
        contactSupportDesc: "আমাদের দলকে নিরাপত্তা উদ্বেগ জানান"
      },
      tips: {
        meetSafely: {
          title: "নিরাপদে দেখা করুন",
          description: "প্রথম কয়েকটি তারিখে সর্বদা পাবলিক জায়গায় দেখা করুন",
          expanded: "প্রথমবার কারো সাথে দেখা করার সময়:\n\n• ক্যাফে, রেস্তোরাঁ বা পার্কের মতো পাবলিক জায়গা বেছে নিন\n• বন্ধু বা পরিবারের সদস্যকে জানান আপনি কোথায় যাচ্ছেন\n• বিশ্বস্ত কারো সাথে আপনার লোকেশন শেয়ার করুন\n• নিজের পরিবহন ব্যবস্থা করুন\n• সতর্ক ও সচেতন থাকুন\n• আপনার অনুভূতিকে বিশ্বাস করুন - কিছু ভুল মনে হলে চলে যান"
        },
        protectInfo: {
          title: "তথ্য সুরক্ষিত রাখুন",
          description: "বিশ্বাস তৈরি না হওয়া পর্যন্ত ব্যক্তিগত তথ্য গোপন রাখুন",
          expanded: "অনলাইনে নিজেকে রক্ষা করুন:\n\n• বাড়ির ঠিকানা, কর্মস্থল বা আর্থিক তথ্য শেয়ার করবেন না\n• ফোন নম্বর শেয়ার করতে সতর্ক থাকুন\n• খুব তাড়াতাড়ি শনাক্তকারী তথ্য শেয়ার করা এড়িয়ে চলুন\n• আরামদায়ক না হওয়া পর্যন্ত অ্যাকর্ডের ইন-অ্যাপ মেসেজিং ব্যবহার করুন\n• যাকে দেখা করেননি তাকে টাকা পাঠাবেন না\n• আর্থিক সাহায্য চাওয়া কারো বিষয়ে সতর্ক থাকুন"
        },
        verifyIdentity: {
          title: "পরিচয় যাচাই",
          description: "ব্যক্তিগতভাবে দেখা করার আগে ভিডিও কল ব্যবহার করুন",
          expanded: "আপনি একজন আসল ব্যক্তির সাথে কথা বলছেন তা যাচাই করুন:\n\n• দেখা করার আগে ভিডিও কলের অনুরোধ করুন\n• যাচাইকৃত প্রোফাইল দেখুন (নীল চেকমার্ক)\n• শুধুমাত্র একটি ছবির প্রোফাইলে সতর্ক থাকুন\n• তাদের গল্পে অসঙ্গতি লক্ষ্য করুন\n• সন্দেহ হলে রিভার্স ইমেজ সার্চ করুন\n• ভুয়া বা সন্দেহজনক প্রোফাইল অবিলম্বে রিপোর্ট করুন"
        },
        lgbtqSafety: {
          title: "LGBTQ+ নিরাপত্তা",
          description: "আমাদের সম্প্রদায়ের জন্য নির্দিষ্ট নিরাপত্তা বিবেচনা",
          expanded: "LGBTQ+ ব্যক্তি হিসেবে নিরাপদ থাকা:\n\n• কে আপনার ব্যবস্থা জানবে তা সতর্কভাবে নির্বাচন করুন\n• গোপনীয়তা সেটিংস সাবধানে বিবেচনা করুন\n• স্থানীয় আইন ও মনোভাব সম্পর্কে সচেতন থাকুন\n• অনিরাপদ বোধ করলে বেরিয়ে আসার পরিকল্পনা রাখুন\n• আপনার এলাকায় LGBTQ+ সম্পদের সাথে যোগাযোগ করুন\n• আপনার সম্প্রদায়কে বিশ্বাস করুন - আমরা একে অপরকে সমর্থন করতে এখানে আছি"
        },
        legalProtection: {
          title: "আইনি সুরক্ষা",
          description: "ল্যাভেন্ডার বিবাহের জন্য আনুষ্ঠানিক চুক্তি বিবেচনা করুন",
          expanded: "আইনিভাবে নিজেকে রক্ষা করুন:\n\n• LGBTQ+-বান্ধব পারিবারিক আইনজীবীর পরামর্শ নিন\n• প্রি-নাপশিয়াল চুক্তি বিবেচনা করুন\n• আপনার ব্যবস্থা লিখিতভাবে নথিভুক্ত করুন\n• প্রযোজ্য হলে অভিবাসনের প্রভাব বুঝুন\n• সম্পত্তি ও অর্থ সংক্রান্ত আপনার অধিকার জানুন\n• চুক্তি গোপনীয় ও সুরক্ষিত রাখুন"
        },
        mentalHealth: {
          title: "মানসিক স্বাস্থ্য",
          description: "আপনার মানসিক সুস্থতার যত্ন নিন",
          expanded: "আপনার মানসিক স্বাস্থ্যকে অগ্রাধিকার দিন:\n\n• স্পষ্ট সীমানা ও প্রত্যাশা নির্ধারণ করুন\n• খোলামেলা ও সৎভাবে যোগাযোগ করুন\n• প্রয়োজনে থেরাপি বা কাউন্সেলিং নিন\n• LGBTQ+ সহায়তা গোষ্ঠীর সাথে যোগাযোগ করুন\n• মনে রাখুন আপনি সম্মান ও দয়ার যোগ্য\n• প্রয়োজনে অ্যাপ থেকে বিরতি নিন"
        },
        reportBlock: {
          title: "রিপোর্ট ও ব্লক",
          description: "নিজেকে রক্ষা করতে আমাদের নিরাপত্তা সরঞ্জাম ব্যবহার করুন",
          expanded: "অ্যাকর্ডে নিরাপদ থাকুন:\n\n• অস্বস্তিকর ব্যবহারকারীদের ব্লক করুন\n• হয়রানি, হুমকি বা সন্দেহজনক আচরণ রিপোর্ট করুন\n• আমরা ২৪ ঘণ্টার মধ্যে সব রিপোর্ট পর্যালোচনা করি\n• আপনার রিপোর্ট বেনামী\n• গুরুতর লঙ্ঘনে অ্যাকাউন্ট বন্ধ হয়\n• জরুরি নিরাপত্তা উদ্বেগের জন্য সরাসরি যোগাযোগ করুন"
        }
      },
      resources: {
        trevor: { name: "দ্য ট্রেভর প্রজেক্ট", description: "LGBTQ+ যুবকদের জন্য ২৪/৭ সংকট সহায়তা" },
        transLifeline: { name: "ট্রান্স লাইফলাইন", description: "ট্রান্সজেন্ডার ব্যক্তিদের জন্য সহায়তা" },
        glbtHotline: { name: "LGBT জাতীয় হটলাইন", description: "সমকক্ষ সহায়তা ও স্থানীয় সম্পদ" },
        rainn: { name: "RAINN", description: "যৌন নিপীড়ন সহায়তা" }
      }
    }
  },
  de: {
    safetyCenter: {
      title: "Sicherheitszentrum",
      subtitle: "Bleib sicher auf Accord",
      safetyTipsTitle: "Sicherheitstipps",
      crisisResourcesTitle: "Krisenressourcen",
      crisisResourcesDescription: "Wenn du oder jemand den du kennst in Gefahr ist, wende dich bitte an diese Ressourcen.",
      visitWebsite: "Website besuchen",
      quickActionsTitle: "Schnellaktionen",
      footerText: "Deine Sicherheit hat für uns höchste Priorität. Wenn du dich jemals unsicher fühlst, zögere nicht, uns oder die oben genannten Ressourcen zu kontaktieren.",
      alerts: {
        callTitle: "{{name}} anrufen",
        callMessage: "Möchtest du {{phone}} anrufen?",
        call: "Anrufen",
        emailUs: "Schreib uns an hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "Blockierte Nutzer",
        blockedUsersDesc: "Verwalte deine Liste blockierter Nutzer",
        privacySettings: "Datenschutzeinstellungen",
        privacySettingsDesc: "Kontrolliere deine Privatsphäre und Sichtbarkeit",
        contactSupport: "Support kontaktieren",
        contactSupportDesc: "Melde Sicherheitsbedenken an unser Team"
      },
      tips: {
        meetSafely: {
          title: "Sicher treffen",
          description: "Triff dich bei den ersten Dates immer an öffentlichen Orten",
          expanded: "Wenn du jemanden zum ersten Mal triffst:\n\n• Wähle einen öffentlichen Ort wie ein Café, Restaurant oder Park\n• Informiere einen Freund oder ein Familienmitglied, wohin du gehst\n• Teile deinen Standort mit jemandem, dem du vertraust\n• Organisiere deine eigene Anreise\n• Bleib nüchtern und aufmerksam\n• Vertraue deinem Instinkt - wenn sich etwas falsch anfühlt, geh"
        },
        protectInfo: {
          title: "Informationen schützen",
          description: "Halte persönliche Details privat, bis Vertrauen aufgebaut ist",
          expanded: "Schütze dich online:\n\n• Teile nicht deine Adresse, deinen Arbeitsplatz oder Finanzinformationen\n• Sei vorsichtig beim Teilen deiner Telefonnummer\n• Vermeide es, identifizierende Details zu früh zu teilen\n• Nutze Accords In-App-Messaging, bis du dich wohlfühlst\n• Sende niemals Geld an jemanden, den du nicht getroffen hast\n• Sei misstrauisch gegenüber jedem, der um finanzielle Hilfe bittet"
        },
        verifyIdentity: {
          title: "Identität verifizieren",
          description: "Nutze Videoanrufe vor einem persönlichen Treffen",
          expanded: "Überprüfe, ob du mit einer echten Person sprichst:\n\n• Bitte vor dem Treffen um einen Videoanruf\n• Achte auf verifizierte Profile (blaues Häkchen)\n• Sei vorsichtig bei Profilen mit nur einem Foto\n• Achte auf Unstimmigkeiten in ihrer Geschichte\n• Mache eine umgekehrte Bildersuche bei Verdacht\n• Melde gefälschte oder verdächtige Profile sofort"
        },
        lgbtqSafety: {
          title: "LGBTQ+ Sicherheit",
          description: "Spezifische Sicherheitsaspekte für unsere Community",
          expanded: "Sicher bleiben als LGBTQ+ Person:\n\n• Sei wählerisch, wer von deiner Vereinbarung weiß\n• Berücksichtige Datenschutzeinstellungen sorgfältig\n• Sei dir lokaler Gesetze und Einstellungen bewusst\n• Habe eine Ausstiegsstrategie, wenn du dich unsicher fühlst\n• Verbinde dich mit LGBTQ+-Ressourcen in deiner Gegend\n• Vertraue deiner Community - wir sind füreinander da"
        },
        legalProtection: {
          title: "Rechtlicher Schutz",
          description: "Erwäge formelle Vereinbarungen für Lavendel-Ehen",
          expanded: "Schütze dich rechtlich:\n\n• Konsultiere einen LGBTQ+-freundlichen Familienanwalt\n• Erwäge einen Ehevertrag\n• Dokumentiere eure Vereinbarung schriftlich\n• Verstehe mögliche Einwanderungsauswirkungen\n• Kenne deine Rechte bezüglich Eigentum und Finanzen\n• Halte Vereinbarungen vertraulich und sicher"
        },
        mentalHealth: {
          title: "Psychische Gesundheit",
          description: "Kümmere dich um dein emotionales Wohlbefinden",
          expanded: "Priorisiere deine psychische Gesundheit:\n\n• Setze klare Grenzen und Erwartungen\n• Kommuniziere offen und ehrlich\n• Suche bei Bedarf Therapie oder Beratung\n• Verbinde dich mit LGBTQ+-Unterstützungsgruppen\n• Denk daran, dass du Respekt und Freundlichkeit verdienst\n• Mache bei Bedarf Pausen von der App"
        },
        reportBlock: {
          title: "Melden & Blockieren",
          description: "Nutze unsere Sicherheitstools zum Selbstschutz",
          expanded: "Bleib sicher auf Accord:\n\n• Blockiere Nutzer, die dir unangenehm sind\n• Melde Belästigung, Drohungen oder verdächtiges Verhalten\n• Wir prüfen alle Meldungen innerhalb von 24 Stunden\n• Deine Meldungen sind anonym\n• Schwere Verstöße führen zur Kontosperrung\n• Kontaktiere uns direkt bei dringenden Sicherheitsbedenken"
        }
      },
      resources: {
        trevor: { name: "The Trevor Project", description: "24/7 Krisenunterstützung für LGBTQ+ Jugendliche" },
        transLifeline: { name: "Trans Lifeline", description: "Unterstützung für Transgender-Personen" },
        glbtHotline: { name: "LGBT National Hotline", description: "Peer-Support und lokale Ressourcen" },
        rainn: { name: "RAINN", description: "Unterstützung bei sexuellen Übergriffen" }
      }
    }
  },
  es: {
    safetyCenter: {
      title: "Centro de Seguridad",
      subtitle: "Mantente seguro en Accord",
      safetyTipsTitle: "Consejos de Seguridad",
      crisisResourcesTitle: "Recursos de Crisis",
      crisisResourcesDescription: "Si tú o alguien que conoces está en peligro, por favor contacta estos recursos.",
      visitWebsite: "Visitar sitio web",
      quickActionsTitle: "Acciones Rápidas",
      footerText: "Tu seguridad es nuestra máxima prioridad. Si alguna vez te sientes inseguro, no dudes en contactarnos o a los recursos anteriores.",
      alerts: {
        callTitle: "Llamar a {{name}}",
        callMessage: "¿Quieres llamar al {{phone}}?",
        call: "Llamar",
        emailUs: "Escríbenos a hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "Usuarios Bloqueados",
        blockedUsersDesc: "Administra tu lista de usuarios bloqueados",
        privacySettings: "Configuración de Privacidad",
        privacySettingsDesc: "Controla tu privacidad y visibilidad",
        contactSupport: "Contactar Soporte",
        contactSupportDesc: "Reporta problemas de seguridad a nuestro equipo"
      },
      tips: {
        meetSafely: {
          title: "Conocerse con Seguridad",
          description: "Siempre reúnete en lugares públicos para las primeras citas",
          expanded: "Al conocer a alguien por primera vez:\n\n• Elige un lugar público como un café, restaurante o parque\n• Dile a un amigo o familiar a dónde vas\n• Comparte tu ubicación con alguien de confianza\n• Organiza tu propio transporte\n• Mantente sobrio y alerta\n• Confía en tus instintos - si algo se siente mal, vete"
        },
        protectInfo: {
          title: "Protege tu Información",
          description: "Mantén tus datos personales privados hasta generar confianza",
          expanded: "Protégete en línea:\n\n• No compartas tu dirección, lugar de trabajo o información financiera\n• Sé cauteloso al compartir tu número de teléfono\n• Evita compartir detalles identificativos demasiado pronto\n• Usa la mensajería dentro de Accord hasta que te sientas cómodo\n• Nunca envíes dinero a alguien que no has conocido\n• Desconfía de quien pida ayuda financiera"
        },
        verifyIdentity: {
          title: "Verificar Identidad",
          description: "Usa videollamadas antes de conocerse en persona",
          expanded: "Verifica que hablas con una persona real:\n\n• Solicita una videollamada antes de reunirte\n• Busca perfiles verificados (marca azul)\n• Sé cauteloso con perfiles que tienen solo una foto\n• Observa inconsistencias en su historia\n• Haz una búsqueda inversa de imagen si sospechas\n• Reporta perfiles falsos o sospechosos inmediatamente"
        },
        lgbtqSafety: {
          title: "Seguridad LGBTQ+",
          description: "Consideraciones de seguridad específicas para nuestra comunidad",
          expanded: "Mantenerse seguro como persona LGBTQ+:\n\n• Sé selectivo sobre quién conoce tu acuerdo\n• Considera la configuración de privacidad cuidadosamente\n• Conoce las leyes y actitudes locales\n• Ten una estrategia de salida si te sientes inseguro\n• Conéctate con recursos LGBTQ+ en tu área\n• Confía en tu comunidad - estamos aquí para apoyarnos"
        },
        legalProtection: {
          title: "Protección Legal",
          description: "Considera acuerdos formales para matrimonios lavanda",
          expanded: "Protégete legalmente:\n\n• Consulta un abogado familiar amigable con LGBTQ+\n• Considera un acuerdo prenupcial\n• Documenta tu acuerdo por escrito\n• Comprende las implicaciones migratorias si aplica\n• Conoce tus derechos sobre propiedades y finanzas\n• Mantén los acuerdos confidenciales y seguros"
        },
        mentalHealth: {
          title: "Salud Mental",
          description: "Cuida tu bienestar emocional",
          expanded: "Prioriza tu salud mental:\n\n• Establece límites y expectativas claras\n• Comunícate abierta y honestamente\n• Busca terapia o asesoramiento si es necesario\n• Conéctate con grupos de apoyo LGBTQ+\n• Recuerda que mereces respeto y amabilidad\n• Toma descansos de la app cuando lo necesites"
        },
        reportBlock: {
          title: "Reportar y Bloquear",
          description: "Usa nuestras herramientas de seguridad para protegerte",
          expanded: "Mantente seguro en Accord:\n\n• Bloquea usuarios que te hagan sentir incómodo\n• Reporta acoso, amenazas o comportamiento sospechoso\n• Revisamos todos los reportes en 24 horas\n• Tus reportes son anónimos\n• Las violaciones graves resultan en eliminación de cuenta\n• Contáctanos directamente para problemas urgentes de seguridad"
        }
      },
      resources: {
        trevor: { name: "The Trevor Project", description: "Apoyo en crisis 24/7 para jóvenes LGBTQ+" },
        transLifeline: { name: "Trans Lifeline", description: "Apoyo para personas transgénero" },
        glbtHotline: { name: "LGBT National Hotline", description: "Apoyo entre pares y recursos locales" },
        rainn: { name: "RAINN", description: "Apoyo ante agresión sexual" }
      }
    }
  },
  fa: {
    safetyCenter: {
      title: "مرکز ایمنی",
      subtitle: "در اکورد امن بمانید",
      safetyTipsTitle: "نکات ایمنی",
      crisisResourcesTitle: "منابع بحران",
      crisisResourcesDescription: "اگر شما یا کسی که می‌شناسید در خطر است، لطفاً با این منابع تماس بگیرید.",
      visitWebsite: "بازدید از وب‌سایت",
      quickActionsTitle: "اقدامات سریع",
      footerText: "ایمنی شما بالاترین اولویت ماست. اگر احساس ناامنی می‌کنید، در تماس با ما یا منابع بالا تردید نکنید.",
      alerts: {
        callTitle: "تماس با {{name}}",
        callMessage: "آیا می‌خواهید با {{phone}} تماس بگیرید؟",
        call: "تماس",
        emailUs: "به hello@joinaccord.app ایمیل بزنید"
      },
      actions: {
        blockedUsers: "کاربران مسدود شده",
        blockedUsersDesc: "مدیریت لیست کاربران مسدود شده",
        privacySettings: "تنظیمات حریم خصوصی",
        privacySettingsDesc: "حریم خصوصی و نمایش خود را کنترل کنید",
        contactSupport: "تماس با پشتیبانی",
        contactSupportDesc: "نگرانی‌های ایمنی را به تیم ما گزارش دهید"
      },
      tips: {
        meetSafely: {
          title: "ملاقات امن",
          description: "همیشه در چند قرار اول در مکان‌های عمومی ملاقات کنید",
          expanded: "هنگام ملاقات با کسی برای اولین بار:\n\n• مکان عمومی مانند کافه، رستوران یا پارک انتخاب کنید\n• به دوست یا عضو خانواده بگویید کجا می‌روید\n• موقعیت مکانی خود را با کسی که به او اعتماد دارید به اشتراک بگذارید\n• حمل و نقل خود را ترتیب دهید\n• هوشیار و مراقب بمانید\n• به غریزه خود اعتماد کنید - اگر چیزی درست نیست، ترک کنید"
        },
        protectInfo: {
          title: "حفاظت از اطلاعات",
          description: "جزئیات شخصی را تا ایجاد اعتماد خصوصی نگه دارید",
          expanded: "از خود آنلاین محافظت کنید:\n\n• آدرس خانه، محل کار یا اطلاعات مالی خود را به اشتراک نگذارید\n• در اشتراک‌گذاری شماره تلفن احتیاط کنید\n• از اشتراک‌گذاری زودهنگام جزئیات شناسایی اجتناب کنید\n• تا زمان راحتی از پیام‌رسان داخلی اکورد استفاده کنید\n• هرگز به کسی که ملاقات نکرده‌اید پول نفرستید\n• مراقب کسانی باشید که درخواست کمک مالی دارند"
        },
        verifyIdentity: {
          title: "تأیید هویت",
          description: "قبل از ملاقات حضوری از تماس تصویری استفاده کنید",
          expanded: "تأیید کنید که با یک شخص واقعی صحبت می‌کنید:\n\n• قبل از ملاقات درخواست تماس تصویری کنید\n• پروفایل‌های تأیید شده را جستجو کنید (تیک آبی)\n• مراقب پروفایل‌هایی با فقط یک عکس باشید\n• تناقضات در داستانشان را زیر نظر بگیرید\n• اگر مشکوک هستید جستجوی معکوس تصویر انجام دهید\n• پروفایل‌های جعلی یا مشکوک را فوراً گزارش دهید"
        },
        lgbtqSafety: {
          title: "ایمنی LGBTQ+",
          description: "ملاحظات ایمنی ویژه برای جامعه ما",
          expanded: "امن ماندن به عنوان یک فرد LGBTQ+:\n\n• در مورد اینکه چه کسی از ترتیب شما مطلع است انتخابی باشید\n• تنظیمات حریم خصوصی را با دقت در نظر بگیرید\n• از قوانین و نگرش‌های محلی آگاه باشید\n• اگر احساس ناامنی کردید یک استراتژی خروج داشته باشید\n• با منابع LGBTQ+ در منطقه خود ارتباط برقرار کنید\n• به جامعه خود اعتماد کنید - ما اینجا هستیم تا از یکدیگر حمایت کنیم"
        },
        legalProtection: {
          title: "حمایت قانونی",
          description: "برای ازدواج‌های لاوندر توافق‌نامه‌های رسمی را در نظر بگیرید",
          expanded: "از خود به صورت قانونی محافظت کنید:\n\n• با یک وکیل خانواده دوست‌دار LGBTQ+ مشورت کنید\n• توافق‌نامه پیش از ازدواج را در نظر بگیرید\n• ترتیب خود را به صورت مکتوب ثبت کنید\n• پیامدهای مهاجرتی را در صورت وجود درک کنید\n• حقوق خود درباره دارایی و مالی را بشناسید\n• توافق‌نامه‌ها را محرمانه و امن نگه دارید"
        },
        mentalHealth: {
          title: "سلامت روان",
          description: "از سلامت عاطفی خود مراقبت کنید",
          expanded: "سلامت روان خود را در اولویت قرار دهید:\n\n• مرزها و انتظارات واضح تعیین کنید\n• آشکارا و صادقانه ارتباط برقرار کنید\n• در صورت نیاز درمان یا مشاوره بگیرید\n• با گروه‌های حمایت LGBTQ+ ارتباط برقرار کنید\n• به یاد داشته باشید که شایسته احترام و مهربانی هستید\n• در صورت نیاز از اپلیکیشن استراحت بگیرید"
        },
        reportBlock: {
          title: "گزارش و مسدود",
          description: "از ابزارهای ایمنی ما برای محافظت از خود استفاده کنید",
          expanded: "در اکورد امن بمانید:\n\n• کاربرانی که شما را ناراحت می‌کنند مسدود کنید\n• آزار، تهدید یا رفتار مشکوک را گزارش دهید\n• ما همه گزارش‌ها را ظرف ۲۴ ساعت بررسی می‌کنیم\n• گزارش‌های شما ناشناس هستند\n• تخلفات جدی منجر به بسته شدن حساب می‌شود\n• برای نگرانی‌های فوری ایمنی مستقیماً با ما تماس بگیرید"
        }
      },
      resources: {
        trevor: { name: "پروژه ترور", description: "حمایت بحران ۲۴/۷ برای جوانان LGBTQ+" },
        transLifeline: { name: "خط زندگی ترنس", description: "حمایت از افراد تراجنسیتی" },
        glbtHotline: { name: "خط تلفن ملی LGBT", description: "حمایت همتایان و منابع محلی" },
        rainn: { name: "RAINN", description: "حمایت از تجاوز جنسی" }
      }
    }
  },
  fr: {
    safetyCenter: {
      title: "Centre de Sécurité",
      subtitle: "Restez en sécurité sur Accord",
      safetyTipsTitle: "Conseils de Sécurité",
      crisisResourcesTitle: "Ressources de Crise",
      crisisResourcesDescription: "Si vous ou quelqu'un que vous connaissez êtes en danger, veuillez contacter ces ressources.",
      visitWebsite: "Visiter le site",
      quickActionsTitle: "Actions Rapides",
      footerText: "Votre sécurité est notre priorité absolue. Si vous vous sentez en danger, n'hésitez pas à nous contacter ou à utiliser les ressources ci-dessus.",
      alerts: {
        callTitle: "Appeler {{name}}",
        callMessage: "Voulez-vous appeler le {{phone}} ?",
        call: "Appeler",
        emailUs: "Écrivez-nous à hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "Utilisateurs Bloqués",
        blockedUsersDesc: "Gérez votre liste d'utilisateurs bloqués",
        privacySettings: "Paramètres de Confidentialité",
        privacySettingsDesc: "Contrôlez votre confidentialité et visibilité",
        contactSupport: "Contacter le Support",
        contactSupportDesc: "Signalez vos préoccupations de sécurité à notre équipe"
      },
      tips: {
        meetSafely: {
          title: "Rencontrer en Sécurité",
          description: "Rencontrez-vous toujours dans des lieux publics pour les premiers rendez-vous",
          expanded: "Lors d'une première rencontre :\n\n• Choisissez un lieu public comme un café, restaurant ou parc\n• Informez un ami ou un membre de votre famille de votre destination\n• Partagez votre position avec quelqu'un de confiance\n• Organisez votre propre transport\n• Restez sobre et vigilant\n• Fiez-vous à votre instinct - si quelque chose semble bizarre, partez"
        },
        protectInfo: {
          title: "Protéger vos Informations",
          description: "Gardez vos informations personnelles privées jusqu'à établir la confiance",
          expanded: "Protégez-vous en ligne :\n\n• Ne partagez pas votre adresse, lieu de travail ou informations financières\n• Soyez prudent en partageant votre numéro de téléphone\n• Évitez de partager des détails identifiants trop tôt\n• Utilisez la messagerie intégrée d'Accord jusqu'à vous sentir à l'aise\n• N'envoyez jamais d'argent à quelqu'un que vous n'avez pas rencontré\n• Méfiez-vous de quiconque demandant une aide financière"
        },
        verifyIdentity: {
          title: "Vérifier l'Identité",
          description: "Utilisez les appels vidéo avant de vous rencontrer en personne",
          expanded: "Vérifiez que vous parlez à une vraie personne :\n\n• Demandez un appel vidéo avant la rencontre\n• Recherchez les profils vérifiés (coche bleue)\n• Soyez prudent avec les profils n'ayant qu'une seule photo\n• Surveillez les incohérences dans leur histoire\n• Faites une recherche d'image inversée en cas de doute\n• Signalez immédiatement les profils faux ou suspects"
        },
        lgbtqSafety: {
          title: "Sécurité LGBTQ+",
          description: "Considérations de sécurité spécifiques pour notre communauté",
          expanded: "Rester en sécurité en tant que personne LGBTQ+ :\n\n• Soyez sélectif sur qui connaît votre arrangement\n• Réfléchissez soigneusement aux paramètres de confidentialité\n• Soyez conscient des lois et attitudes locales\n• Ayez une stratégie de sortie si vous vous sentez en danger\n• Connectez-vous aux ressources LGBTQ+ de votre région\n• Faites confiance à votre communauté - nous sommes là pour nous soutenir"
        },
        legalProtection: {
          title: "Protection Juridique",
          description: "Envisagez des accords formels pour les mariages lavande",
          expanded: "Protégez-vous juridiquement :\n\n• Consultez un avocat familial favorable aux LGBTQ+\n• Envisagez un contrat de mariage\n• Documentez votre arrangement par écrit\n• Comprenez les implications en matière d'immigration le cas échéant\n• Connaissez vos droits concernant la propriété et les finances\n• Gardez les accords confidentiels et sécurisés"
        },
        mentalHealth: {
          title: "Santé Mentale",
          description: "Prenez soin de votre bien-être émotionnel",
          expanded: "Priorisez votre santé mentale :\n\n• Établissez des limites et des attentes claires\n• Communiquez ouvertement et honnêtement\n• Cherchez une thérapie ou un conseil si nécessaire\n• Connectez-vous avec des groupes de soutien LGBTQ+\n• Rappelez-vous que vous méritez le respect et la bienveillance\n• Faites des pauses de l'application quand nécessaire"
        },
        reportBlock: {
          title: "Signaler et Bloquer",
          description: "Utilisez nos outils de sécurité pour vous protéger",
          expanded: "Restez en sécurité sur Accord :\n\n• Bloquez les utilisateurs qui vous mettent mal à l'aise\n• Signalez le harcèlement, les menaces ou les comportements suspects\n• Nous examinons tous les signalements sous 24 heures\n• Vos signalements sont anonymes\n• Les violations graves entraînent la suppression du compte\n• Contactez-nous directement pour les urgences de sécurité"
        }
      },
      resources: {
        trevor: { name: "The Trevor Project", description: "Soutien de crise 24h/24 pour les jeunes LGBTQ+" },
        transLifeline: { name: "Trans Lifeline", description: "Soutien pour les personnes transgenres" },
        glbtHotline: { name: "LGBT National Hotline", description: "Soutien par les pairs et ressources locales" },
        rainn: { name: "RAINN", description: "Soutien aux agressions sexuelles" }
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

console.log('Done! Added safetyCenter to 6 locales (batch 1)');
