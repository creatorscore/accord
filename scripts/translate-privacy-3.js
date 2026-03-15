/**
 * Adds privacySettings translations to locales: pt, ru, tr, uk, ur, zh
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
  pt: {
    privacySettings: {
      title: "Configurações de Privacidade",
      loading: "Carregando configurações...",
      infoBannerTitle: "Sua Privacidade Importa",
      infoBannerText: "Controle como os outros veem você no Accord. As alterações entram em vigor imediatamente.",
      sections: {
        profileVisibility: "Visibilidade do Perfil",
        verification: "Verificação",
        activityPrivacy: "Privacidade de Atividade",
        location: "Localização"
      },
      photoBlur: {
        title: "Desfoque de Fotos",
        description: "Desfoque suas fotos até que você faça match com alguém"
      },
      incognitoMode: {
        title: "Modo Anônimo",
        description: "Oculte seu perfil da descoberta. Apenas usuários com match podem ver você.",
        requiresPremium: " Requer Premium."
      },
      hideLastActive: {
        title: "Ocultar Última Atividade",
        description: "Não mostrar quando você esteve ativo pela última vez no Accord"
      },
      hideDistance: {
        title: "Ocultar Distância Exata",
        description: "Mostrar apenas cidade/país, ocultar distância precisa dos outros",
        warning: "Os outros verão sua cidade/país, mas não sua distância exata. Você ainda pode filtrar matches por distância."
      },
      location: {
        title: "Atualizar Localização",
        description: "Use GPS ou pesquise sua cidade para definir sua localização",
        current: "Atual: {{location}}",
        useGps: "Usar GPS",
        searchCity: "Pesquisar Cidade",
        searchPlaceholder: "Pesquisar cidade ou país...",
        noCitiesFound: "Nenhuma cidade encontrada"
      },
      tips: {
        title: "Dicas de Privacidade",
        encrypted: "Todas as mensagens são criptografadas de ponta a ponta por padrão",
        blocked: "Usuários bloqueados não podem ver seu perfil ou enviar mensagens",
        namePrivacy: "Seu nome real e informações de contato nunca são compartilhados",
        deleteAccount: "Você pode excluir sua conta e dados a qualquer momento"
      },
      legal: {
        privacyPolicy: "Política de Privacidade",
        termsOfService: "Termos de Serviço"
      },
      alerts: {
        loadError: "Falha ao carregar configurações de privacidade",
        updateError: "Falha ao atualizar configuração de privacidade. Por favor, tente novamente.",
        permissionDenied: "Permissão Negada",
        permissionDeniedMessage: "A permissão de localização é necessária para atualizar sua localização. Você pode ativá-la nas configurações do seu dispositivo.",
        preciseLocationRequired: "Localização Precisa Necessária",
        preciseLocationMessage: "A precisão da localização é muito baixa ({{accuracy}} metros). Por favor, ative \"Localização Precisa\" para o Accord nas configurações do seu iPhone:\n\n1. Abra Ajustes\n2. Role até Accord\n3. Toque em Localização\n4. Ative \"Localização Precisa\"\n\nIsso garante cálculos de distância precisos para o matching.",
        openSettings: "Abrir Ajustes",
        locationSuccess: "Localização atualizada para {{location}}",
        locationSuccessGeneric: "Sua localização foi atualizada!",
        locationError: "Falha ao atualizar localização. Por favor, tente novamente."
      }
    }
  },
  ru: {
    privacySettings: {
      title: "Настройки конфиденциальности",
      loading: "Загрузка настроек...",
      infoBannerTitle: "Ваша конфиденциальность важна",
      infoBannerText: "Контролируйте, как другие видят вас на Accord. Изменения вступают в силу немедленно.",
      sections: {
        profileVisibility: "Видимость профиля",
        verification: "Верификация",
        activityPrivacy: "Конфиденциальность активности",
        location: "Местоположение"
      },
      photoBlur: {
        title: "Размытие фото",
        description: "Размывайте свои фотографии, пока не найдёте совпадение"
      },
      incognitoMode: {
        title: "Режим инкогнито",
        description: "Скройте свой профиль из поиска. Только совпавшие пользователи смогут вас видеть.",
        requiresPremium: " Требуется Premium."
      },
      hideLastActive: {
        title: "Скрыть последнюю активность",
        description: "Не показывать, когда вы последний раз были активны на Accord"
      },
      hideDistance: {
        title: "Скрыть точное расстояние",
        description: "Показывать только город/страну, скрывая точное расстояние от других",
        warning: "Другие увидят ваш город/страну, но не точное расстояние. Вы по-прежнему можете фильтровать совпадения по расстоянию."
      },
      location: {
        title: "Обновить местоположение",
        description: "Используйте GPS или найдите свой город, чтобы задать местоположение",
        current: "Текущее: {{location}}",
        useGps: "Использовать GPS",
        searchCity: "Найти город",
        searchPlaceholder: "Поиск города или страны...",
        noCitiesFound: "Города не найдены"
      },
      tips: {
        title: "Советы по конфиденциальности",
        encrypted: "Все сообщения по умолчанию защищены сквозным шифрованием",
        blocked: "Заблокированные пользователи не могут видеть ваш профиль или писать вам",
        namePrivacy: "Ваше настоящее имя и контактная информация никогда не передаются",
        deleteAccount: "Вы можете удалить свой аккаунт и данные в любое время"
      },
      legal: {
        privacyPolicy: "Политика конфиденциальности",
        termsOfService: "Условия использования"
      },
      alerts: {
        loadError: "Не удалось загрузить настройки конфиденциальности",
        updateError: "Не удалось обновить настройку конфиденциальности. Пожалуйста, попробуйте снова.",
        permissionDenied: "Разрешение отклонено",
        permissionDeniedMessage: "Для обновления местоположения требуется разрешение на определение геолокации. Вы можете включить его в настройках устройства.",
        preciseLocationRequired: "Требуется точное местоположение",
        preciseLocationMessage: "Точность определения местоположения слишком низкая ({{accuracy}} метров). Пожалуйста, включите «Точное местоположение» для Accord в настройках iPhone:\n\n1. Откройте Настройки\n2. Прокрутите до Accord\n3. Нажмите Геолокация\n4. Включите «Точное местоположение»\n\nЭто обеспечит точный расчёт расстояния для подбора пар.",
        openSettings: "Открыть Настройки",
        locationSuccess: "Местоположение обновлено на {{location}}",
        locationSuccessGeneric: "Ваше местоположение обновлено!",
        locationError: "Не удалось обновить местоположение. Пожалуйста, попробуйте снова."
      }
    }
  },
  tr: {
    privacySettings: {
      title: "Gizlilik Ayarları",
      loading: "Ayarlar yükleniyor...",
      infoBannerTitle: "Gizliliğiniz Önemli",
      infoBannerText: "Accord'da başkalarının sizi nasıl gördüğünü kontrol edin. Değişiklikler anında geçerli olur.",
      sections: {
        profileVisibility: "Profil Görünürlüğü",
        verification: "Doğrulama",
        activityPrivacy: "Etkinlik Gizliliği",
        location: "Konum"
      },
      photoBlur: {
        title: "Fotoğraf Bulanıklaştırma",
        description: "Biriyle eşleşene kadar fotoğraflarınızı bulanıklaştırın"
      },
      incognitoMode: {
        title: "Gizli Mod",
        description: "Profilinizi keşiften gizleyin. Yalnızca eşleşen kullanıcılar sizi görebilir.",
        requiresPremium: " Premium gerektirir."
      },
      hideLastActive: {
        title: "Son Aktifliği Gizle",
        description: "Accord'da en son ne zaman aktif olduğunuzu göstermeyin"
      },
      hideDistance: {
        title: "Tam Mesafeyi Gizle",
        description: "Yalnızca şehir/ülke göster, diğerlerinden tam mesafeyi gizle",
        warning: "Diğerleri şehrinizi/ülkenizi görecek ancak tam mesafenizi göremeyecek. Eşleşmeleri mesafeye göre filtrelemeye devam edebilirsiniz."
      },
      location: {
        title: "Konumu Güncelle",
        description: "Konumunuzu ayarlamak için GPS kullanın veya şehrinizi arayın",
        current: "Mevcut: {{location}}",
        useGps: "GPS Kullan",
        searchCity: "Şehir Ara",
        searchPlaceholder: "Şehir veya ülke ara...",
        noCitiesFound: "Şehir bulunamadı"
      },
      tips: {
        title: "Gizlilik İpuçları",
        encrypted: "Tüm mesajlar varsayılan olarak uçtan uca şifrelenmiştir",
        blocked: "Engellenen kullanıcılar profilinizi göremez veya size mesaj gönderemez",
        namePrivacy: "Gerçek adınız ve iletişim bilgileriniz asla paylaşılmaz",
        deleteAccount: "Hesabınızı ve verilerinizi istediğiniz zaman silebilirsiniz"
      },
      legal: {
        privacyPolicy: "Gizlilik Politikası",
        termsOfService: "Hizmet Şartları"
      },
      alerts: {
        loadError: "Gizlilik ayarları yüklenemedi",
        updateError: "Gizlilik ayarı güncellenemedi. Lütfen tekrar deneyin.",
        permissionDenied: "İzin Reddedildi",
        permissionDeniedMessage: "Konumunuzu güncellemek için konum izni gereklidir. Cihaz ayarlarınızdan etkinleştirebilirsiniz.",
        preciseLocationRequired: "Hassas Konum Gerekli",
        preciseLocationMessage: "Konum doğruluğu çok düşük ({{accuracy}} metre). Lütfen iPhone Ayarlarınızda Accord için \"Hassas Konum\"u etkinleştirin:\n\n1. Ayarlar'ı açın\n2. Accord'a gidin\n3. Konum'a dokunun\n4. \"Hassas Konum\"u etkinleştirin\n\nBu, eşleştirme için doğru mesafe hesaplamalarını sağlar.",
        openSettings: "Ayarları Aç",
        locationSuccess: "Konum {{location}} olarak güncellendi",
        locationSuccessGeneric: "Konumunuz güncellendi!",
        locationError: "Konum güncellenemedi. Lütfen tekrar deneyin."
      }
    }
  },
  uk: {
    privacySettings: {
      title: "Налаштування конфіденційності",
      loading: "Завантаження налаштувань...",
      infoBannerTitle: "Ваша конфіденційність важлива",
      infoBannerText: "Контролюйте, як інші бачать вас на Accord. Зміни набувають чинності негайно.",
      sections: {
        profileVisibility: "Видимість профілю",
        verification: "Верифікація",
        activityPrivacy: "Конфіденційність активності",
        location: "Місцезнаходження"
      },
      photoBlur: {
        title: "Розмиття фото",
        description: "Розмивайте свої фотографії, поки не знайдете збіг"
      },
      incognitoMode: {
        title: "Режим інкогніто",
        description: "Сховайте свій профіль від пошуку. Тільки користувачі зі збігом зможуть вас бачити.",
        requiresPremium: " Потрібен Premium."
      },
      hideLastActive: {
        title: "Сховати останню активність",
        description: "Не показувати, коли ви востаннє були активні на Accord"
      },
      hideDistance: {
        title: "Сховати точну відстань",
        description: "Показувати тільки місто/країну, приховуючи точну відстань від інших",
        warning: "Інші бачитимуть ваше місто/країну, але не точну відстань. Ви все ще можете фільтрувати збіги за відстанню."
      },
      location: {
        title: "Оновити місцезнаходження",
        description: "Використовуйте GPS або знайдіть своє місто, щоб задати місцезнаходження",
        current: "Поточне: {{location}}",
        useGps: "Використати GPS",
        searchCity: "Знайти місто",
        searchPlaceholder: "Пошук міста або країни...",
        noCitiesFound: "Міст не знайдено"
      },
      tips: {
        title: "Поради щодо конфіденційності",
        encrypted: "Усі повідомлення за замовчуванням захищені наскрізним шифруванням",
        blocked: "Заблоковані користувачі не можуть бачити ваш профіль або писати вам",
        namePrivacy: "Ваше справжнє ім'я та контактна інформація ніколи не передаються",
        deleteAccount: "Ви можете видалити свій акаунт і дані в будь-який час"
      },
      legal: {
        privacyPolicy: "Політика конфіденційності",
        termsOfService: "Умови використання"
      },
      alerts: {
        loadError: "Не вдалося завантажити налаштування конфіденційності",
        updateError: "Не вдалося оновити налаштування конфіденційності. Будь ласка, спробуйте знову.",
        permissionDenied: "Дозвіл відхилено",
        permissionDeniedMessage: "Для оновлення місцезнаходження потрібен дозвіл на визначення геолокації. Ви можете увімкнути його в налаштуваннях пристрою.",
        preciseLocationRequired: "Потрібне точне місцезнаходження",
        preciseLocationMessage: "Точність визначення місцезнаходження занадто низька ({{accuracy}} метрів). Будь ласка, увімкніть «Точне місцезнаходження» для Accord у налаштуваннях iPhone:\n\n1. Відкрийте Налаштування\n2. Прокрутіть до Accord\n3. Натисніть Геолокація\n4. Увімкніть «Точне місцезнаходження»\n\nЦе забезпечить точний розрахунок відстані для підбору пар.",
        openSettings: "Відкрити Налаштування",
        locationSuccess: "Місцезнаходження оновлено на {{location}}",
        locationSuccessGeneric: "Ваше місцезнаходження оновлено!",
        locationError: "Не вдалося оновити місцезнаходження. Будь ласка, спробуйте знову."
      }
    }
  },
  ur: {
    privacySettings: {
      title: "رازداری کی ترتیبات",
      loading: "ترتیبات لوڈ ہو رہی ہیں...",
      infoBannerTitle: "آپ کی رازداری اہم ہے",
      infoBannerText: "کنٹرول کریں کہ دوسرے آپ کو ایکارڈ پر کیسے دیکھتے ہیں۔ تبدیلیاں فوری طور پر نافذ ہو جاتی ہیں۔",
      sections: {
        profileVisibility: "پروفائل کی مرئیت",
        verification: "تصدیق",
        activityPrivacy: "سرگرمی کی رازداری",
        location: "مقام"
      },
      photoBlur: {
        title: "فوٹو بلر",
        description: "جب تک آپ کسی سے میچ نہیں ہو جاتے اپنی تصاویر دھندلی رکھیں"
      },
      incognitoMode: {
        title: "انکوگنیٹو موڈ",
        description: "اپنے پروفائل کو دریافت سے چھپائیں۔ صرف میچ شدہ صارفین آپ کو دیکھ سکتے ہیں۔",
        requiresPremium: " پریمیم ضروری ہے۔"
      },
      hideLastActive: {
        title: "آخری سرگرمی چھپائیں",
        description: "یہ نہ دکھائیں کہ آپ آخری بار ایکارڈ پر کب متحرک تھے"
      },
      hideDistance: {
        title: "صحیح فاصلہ چھپائیں",
        description: "صرف شہر/ملک دکھائیں، دوسروں سے صحیح فاصلہ چھپائیں",
        warning: "دوسرے آپ کا شہر/ملک دیکھ سکیں گے لیکن آپ کا صحیح فاصلہ نہیں۔ آپ پھر بھی فاصلے کے مطابق میچز فلٹر کر سکتے ہیں۔"
      },
      location: {
        title: "مقام اپ ڈیٹ کریں",
        description: "اپنا مقام سیٹ کرنے کے لیے GPS استعمال کریں یا اپنا شہر تلاش کریں",
        current: "موجودہ: {{location}}",
        useGps: "GPS استعمال کریں",
        searchCity: "شہر تلاش کریں",
        searchPlaceholder: "شہر یا ملک تلاش کریں...",
        noCitiesFound: "کوئی شہر نہیں ملا"
      },
      tips: {
        title: "رازداری کی تجاویز",
        encrypted: "تمام پیغامات بطور ڈیفالٹ اینڈ ٹو اینڈ انکرپٹڈ ہیں",
        blocked: "بلاک شدہ صارفین آپ کا پروفائل نہیں دیکھ سکتے اور نہ ہی آپ کو پیغام بھیج سکتے ہیں",
        namePrivacy: "آپ کا اصل نام اور رابطے کی معلومات کبھی شیئر نہیں کی جاتیں",
        deleteAccount: "آپ کسی بھی وقت اپنا اکاؤنٹ اور ڈیٹا حذف کر سکتے ہیں"
      },
      legal: {
        privacyPolicy: "رازداری کی پالیسی",
        termsOfService: "سروس کی شرائط"
      },
      alerts: {
        loadError: "رازداری کی ترتیبات لوڈ کرنے میں ناکامی",
        updateError: "رازداری کی ترتیب اپ ڈیٹ کرنے میں ناکامی۔ براہ کرم دوبارہ کوشش کریں۔",
        permissionDenied: "اجازت مسترد",
        permissionDeniedMessage: "اپنا مقام اپ ڈیٹ کرنے کے لیے مقام کی اجازت ضروری ہے۔ آپ اسے اپنے آلے کی ترتیبات میں فعال کر سکتے ہیں۔",
        preciseLocationRequired: "درست مقام ضروری ہے",
        preciseLocationMessage: "مقام کی درستگی بہت کم ہے ({{accuracy}} میٹر)۔ براہ کرم اپنے آئی فون کی ترتیبات میں ایکارڈ کے لیے \"درست مقام\" فعال کریں:\n\n1. ترتیبات کھولیں\n2. ایکارڈ تک سکرول کریں\n3. مقام پر ٹیپ کریں\n4. \"درست مقام\" فعال کریں\n\nیہ میچنگ کے لیے فاصلے کے درست حساب کو یقینی بناتا ہے۔",
        openSettings: "ترتیبات کھولیں",
        locationSuccess: "مقام {{location}} میں اپ ڈیٹ ہو گیا",
        locationSuccessGeneric: "آپ کا مقام اپ ڈیٹ ہو گیا ہے!",
        locationError: "مقام اپ ڈیٹ کرنے میں ناکامی۔ براہ کرم دوبارہ کوشش کریں۔"
      }
    }
  },
  zh: {
    privacySettings: {
      title: "隐私设置",
      loading: "加载设置中...",
      infoBannerTitle: "您的隐私很重要",
      infoBannerText: "控制其他人在Accord上如何看到您。更改立即生效。",
      sections: {
        profileVisibility: "个人资料可见性",
        verification: "验证",
        activityPrivacy: "活动隐私",
        location: "位置"
      },
      photoBlur: {
        title: "照片模糊",
        description: "在与某人匹配之前模糊您的照片"
      },
      incognitoMode: {
        title: "隐身模式",
        description: "在发现中隐藏您的个人资料。只有匹配的用户才能看到您。",
        requiresPremium: " 需要Premium。"
      },
      hideLastActive: {
        title: "隐藏最后活跃时间",
        description: "不显示您上次在Accord上活跃的时间"
      },
      hideDistance: {
        title: "隐藏精确距离",
        description: "仅显示城市/国家，对他人隐藏精确距离",
        warning: "其他人将看到您的城市/国家，但看不到您的精确距离。您仍然可以按距离筛选匹配。"
      },
      location: {
        title: "更新位置",
        description: "使用GPS或搜索您的城市来设置您的位置",
        current: "当前：{{location}}",
        useGps: "使用GPS",
        searchCity: "搜索城市",
        searchPlaceholder: "搜索城市或国家...",
        noCitiesFound: "未找到城市"
      },
      tips: {
        title: "隐私提示",
        encrypted: "所有消息默认采用端到端加密",
        blocked: "被屏蔽的用户无法查看您的个人资料或向您发送消息",
        namePrivacy: "您的真实姓名和联系信息永远不会被共享",
        deleteAccount: "您可以随时删除您的账户和数据"
      },
      legal: {
        privacyPolicy: "隐私政策",
        termsOfService: "服务条款"
      },
      alerts: {
        loadError: "加载隐私设置失败",
        updateError: "更新隐私设置失败。请重试。",
        permissionDenied: "权限被拒绝",
        permissionDeniedMessage: "更新您的位置需要位置权限。您可以在设备设置中启用它。",
        preciseLocationRequired: "需要精确位置",
        preciseLocationMessage: "位置精度太低（{{accuracy}}米）。请在iPhone设置中为Accord启用\u201c精确位置\u201d：\n\n1. 打开设置\n2. 滚动到Accord\n3. 点击位置\n4. 启用\u201c精确位置\u201d\n\n这可确保匹配时的距离计算准确。",
        openSettings: "打开设置",
        locationSuccess: "位置已更新为{{location}}",
        locationSuccessGeneric: "您的位置已更新！",
        locationError: "更新位置失败。请重试。"
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

console.log('Done! Added privacySettings to 6 locales (batch 3)');
