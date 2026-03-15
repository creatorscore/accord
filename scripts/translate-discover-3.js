/**
 * Translates discover, filters (new keys), and verification sections
 * for locales: pt, ru, tr, uk, ur, zh
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
    discover: {
      dailyLimitTitle: 'Limite diário atingido',
      dailyLimitMessage: 'Você usou todos os 5 likes de hoje. Atualize para likes ilimitados!',
      quickFilter: {
        age: 'Idade',
        datingIntentions: 'Intenções de namoro',
        activeToday: 'Ativo hoje'
      },
      ageSlider: {
        ageRange: 'Faixa etária: {{min}} - {{max}}',
        minimum: 'Mínimo: {{value}}',
        maximum: 'Máximo: {{value}}'
      },
      search: {
        placeholder: "Buscar por palavra-chave (ex. 'viagem', 'vegano')",
        button: 'Buscar',
        tip: 'Curta ou passe para continuar buscando. Limpe a busca para ver todos os perfis.',
        noResults: 'Sem resultados para "{{keyword}}"',
        noResultsHint: 'Tente palavras-chave diferentes ou ajuste seus filtros para encontrar mais combinações.',
        clearSearch: 'Limpar busca'
      },
      emptyState: {
        allCaughtUp: 'Você está em dia',
        checkBack: 'Novas pessoas entram todos os dias.\nVolte em breve ou amplie suas preferências.'
      },
      premiumCta: {
        goPremium: 'Seja Premium',
        description: 'Veja quem curtiu você, likes ilimitados e mais.',
        upgrade: 'Atualizar'
      },
      recommendations: {
        expandReach: 'Amplie seu alcance',
        increaseDistance: 'Aumentar distância em {{count}} mi',
        widenAge: 'Ampliar faixa etária em {{count}} anos',
        includeGender: 'Incluir {{gender}}',
        searchGlobally: 'Buscar globalmente',
        expandSearch: 'Ampliar sua busca',
        newProfilesK: '{{count}}mil+ novos perfis',
        newProfiles: '{{count}} novos perfis',
        newProfileSingular: '1 novo perfil',
        updatePreferencesTitle: 'Atualizar preferências?',
        updatePreferencesMessage: 'Adicionar "{{gender}}" às suas preferências de gênero? Você pode mudar a qualquer momento em Configurações > Preferências de combinação.',
        add: 'Adicionar'
      },
      banner: {
        photoBlurTitle: 'Por que algumas fotos estão desfocadas',
        photoBlurDescription: 'Alguns usuários ativam o desfoque de fotos nas configurações de privacidade para proteger sua identidade até combinar. As fotos serão reveladas após a conexão!',
        profileHidden: 'Perfil oculto',
        profileHiddenDescription: 'Seu perfil está temporariamente oculto. Toque para enviar novas fotos.',
        completeProfileToMatch: 'Complete seu perfil para combinar',
        completeProfile: 'Complete seu perfil',
        completeProfilePreview: 'Você pode navegar livremente! Complete o cadastro para começar a curtir e combinar.',
        completeProfileDefault: 'Termine a configuração para começar a combinar. Você pode navegar, mas não pode curtir ou ser visto ainda.'
      },
      premiumLocation: {
        title: 'Desbloqueie a busca global',
        description: 'Você tem preferências de localização salvas que requerem Premium:',
        searchGlobally: 'Buscar combinações globalmente',
        matchCities: 'Combinar em cidades específicas',
        upgradeMessage: 'Atualize para Premium para ativar esses recursos e encontrar combinações em qualquer lugar do mundo.',
        upgradeToPremium: 'Atualizar para Premium',
        maybeLater: 'Talvez depois'
      }
    },
    filters: {
      basicFilters: 'Filtros básicos',
      minimum: 'Mínimo',
      maximum: 'Máximo',
      activeToday: 'Ativo hoje',
      activeTodayDescription: 'Mostrar apenas usuários ativos nas últimas 24 horas',
      showBlurred: 'Mostrar fotos desfocadas',
      showBlurredDescription: 'Incluir perfis com desfoque de foto ativado',
      advancedFilters: 'Filtros avançados',
      identityBackground: 'Identidade e origem',
      gender: 'Gênero',
      ethnicity: 'Etnia',
      sexualOrientation: 'Orientação sexual',
      physicalPersonality: 'Físico e personalidade',
      heightRange: 'Faixa de altura',
      zodiacSign: 'Signo do zodíaco',
      mbtiPersonality: 'Tipo de personalidade MBTI',
      loveLanguage: 'Linguagem do amor',
      lifestyle: 'Estilo de vida',
      languagesSpoken: 'Idiomas falados',
      smoking: 'Fumante',
      drinking: 'Bebida',
      pets: 'Animais de estimação',
      marriageIntentions: 'Intenções matrimoniais',
      primaryReason: 'Motivo principal',
      relationshipType: 'Tipo de relacionamento',
      wantsChildren: 'Quer filhos',
      housingPreference: 'Preferência de moradia',
      financialArrangement: 'Acordo financeiro'
    },
    verification: {
      alreadyVerified: 'Já verificado',
      alreadyVerifiedMessage: 'Suas fotos já estão verificadas!',
      tooManyAttempts: 'Muitas tentativas',
      tooManyAttemptsMessage: 'Você excedeu o número máximo de tentativas de verificação (5). Entre em contato com o suporte em hello@joinaccord.app.',
      tooManyAttemptsMessageShort: 'Você excedeu o número máximo de tentativas de verificação. Entre em contato com o suporte.',
      cameraPermission: 'Permissão da câmera necessária',
      cameraPermissionMessage: 'Permita o acesso à câmera para tirar uma selfie de verificação.',
      selfieError: 'Erro na selfie',
      selfieErrorMessage: 'Algo deu errado. Tente novamente.',
      success: 'Fotos verificadas!',
      successMessage: 'Suas fotos foram verificadas!\n\nConfiança de combinação: {{similarity}}%\n\nSeu perfil agora mostra um selo verificado.',
      awesome: 'Incrível!',
      unsuccessful: 'Verificação não bem-sucedida',
      unsuccessfulMessage: '{{message}}\n\nPara melhorar suas chances:\n\n• Tire sua selfie com luz natural brilhante\n• Certifique-se de que sua foto principal é recente\n• Olhe diretamente para a câmera\n• Remova óculos de sol, bonés ou máscaras\n• Evite sombras no rosto',
      tryAgain: 'Tentar novamente',
      noPhotos: 'Sem fotos de perfil',
      noPhotosMessage: 'Envie fotos de perfil antes de verificar.',
      profileNotFound: 'Perfil não encontrado. Tente novamente.',
      error: 'Erro de verificação',
      errorMessage: 'A verificação falhou. Tente novamente mais tarde.',
      statusVerified: 'Verificado',
      statusProcessing: 'Processando...',
      statusFailed: 'Falhou',
      statusNotVerified: 'Não verificado',
      title: 'Verificação de fotos',
      verifiedDescription: 'Suas fotos estão verificadas! Isso mostra a outros usuários que suas fotos de perfil representam você com precisão.',
      unverifiedDescription: 'Verifique suas fotos tirando uma selfie. Compararemos com suas fotos de perfil usando reconhecimento facial.',
      beforeYouStart: 'Antes de começar',
      beforeYouStartDescription: 'Certifique-se de que sua foto principal (primeira foto) é uma foto recente e clara do seu rosto. A selfie será comparada com suas fotos de perfil.',
      attemptsUsed: 'Tentativas usadas: {{count}} / 5',
      unsuccessfulBanner: 'Verificação não bem-sucedida',
      unsuccessfulBannerMessage: 'A selfie não correspondeu suficientemente às suas fotos de perfil. Para melhores resultados, tire sua selfie com luz natural brilhante e certifique-se de que sua foto principal é recente e clara.',
      verifying: 'Verificando...',
      takeVerificationSelfie: 'Tirar selfie de verificação',
      forBestResults: 'Para melhores resultados:',
      tips: {
        daylight: 'Tire sua selfie com luz natural brilhante',
        faceCamera: 'Olhe diretamente para a câmera com expressão neutra',
        recentPhoto: 'Certifique-se de que sua foto principal é recente e mostra seu rosto claramente',
        removeCoverings: 'Remova óculos de sol, bonés e coberturas faciais',
        avoidShadows: 'Evite sombras fortes ou ambientes com contraluz',
        mustMatch: 'Sua selfie deve corresponder à pessoa nas fotos de perfil'
      },
      photosVerified: 'Fotos verificadas!',
      verifiedBadgeMessage: 'Seu selo verificado agora está visível no perfil. Isso ajuda a construir confiança com combinações potenciais.',
      freeForAll: 'Gratuito para todos os usuários'
    }
  },
  ru: {
    discover: {
      dailyLimitTitle: 'Дневной лимит исчерпан',
      dailyLimitMessage: 'Вы использовали все 5 лайков на сегодня. Обновите для безлимитных!',
      quickFilter: {
        age: 'Возраст',
        datingIntentions: 'Намерения знакомства',
        activeToday: 'Активен сегодня'
      },
      ageSlider: {
        ageRange: 'Возрастной диапазон: {{min}} - {{max}}',
        minimum: 'Минимум: {{value}}',
        maximum: 'Максимум: {{value}}'
      },
      search: {
        placeholder: "Поиск по ключевому слову (напр. 'путешествия', 'веган')",
        button: 'Поиск',
        tip: 'Лайкните или пропустите, чтобы продолжить поиск. Очистите поиск, чтобы увидеть все профили.',
        noResults: 'Нет результатов для "{{keyword}}"',
        noResultsHint: 'Попробуйте другие ключевые слова или настройте фильтры для поиска большего количества совпадений.',
        clearSearch: 'Очистить поиск'
      },
      emptyState: {
        allCaughtUp: 'Вы всё просмотрели',
        checkBack: 'Каждый день присоединяются новые люди.\nЗагляните позже или расширьте свои предпочтения.'
      },
      premiumCta: {
        goPremium: 'Стать Премиум',
        description: 'Узнайте, кто вас лайкнул, безлимитные лайки и многое другое.',
        upgrade: 'Обновить'
      },
      recommendations: {
        expandReach: 'Расширьте свой охват',
        increaseDistance: 'Увеличить расстояние на {{count}} миль',
        widenAge: 'Расширить возрастной диапазон на {{count}} лет',
        includeGender: 'Включить {{gender}}',
        searchGlobally: 'Искать по всему миру',
        expandSearch: 'Расширить поиск',
        newProfilesK: '{{count}}тыс.+ новых профилей',
        newProfiles: '{{count}} новых профилей',
        newProfileSingular: '1 новый профиль',
        updatePreferencesTitle: 'Обновить предпочтения?',
        updatePreferencesMessage: 'Добавить "{{gender}}" в предпочтения пола? Вы можете изменить это в любое время в Настройки > Предпочтения совпадений.',
        add: 'Добавить'
      },
      banner: {
        photoBlurTitle: 'Почему некоторые фото размыты',
        photoBlurDescription: 'Некоторые пользователи включают размытие фото в настройках конфиденциальности для защиты своей личности до совпадения. Фото откроются после подключения!',
        profileHidden: 'Профиль скрыт',
        profileHiddenDescription: 'Ваш профиль временно скрыт. Нажмите, чтобы загрузить новые фото.',
        completeProfileToMatch: 'Заполните профиль для поиска пар',
        completeProfile: 'Заполните свой профиль',
        completeProfilePreview: 'Вы можете свободно просматривать! Завершите регистрацию, чтобы начать ставить лайки и находить пары.',
        completeProfileDefault: 'Завершите настройку, чтобы начать поиск пар. Вы можете просматривать, но пока не можете ставить лайки или быть видимым.'
      },
      premiumLocation: {
        title: 'Разблокируйте глобальный поиск',
        description: 'У вас есть сохранённые предпочтения местоположения, для которых нужен Премиум:',
        searchGlobally: 'Искать совпадения по всему миру',
        matchCities: 'Искать пары в конкретных городах',
        upgradeMessage: 'Обновите до Премиум, чтобы активировать эти функции и находить совпадения в любой точке мира.',
        upgradeToPremium: 'Обновить до Премиум',
        maybeLater: 'Может быть позже'
      }
    },
    filters: {
      basicFilters: 'Основные фильтры',
      minimum: 'Минимум',
      maximum: 'Максимум',
      activeToday: 'Активен сегодня',
      activeTodayDescription: 'Показывать только пользователей, активных за последние 24 часа',
      showBlurred: 'Показать размытые фото',
      showBlurredDescription: 'Включить профили с размытием фото',
      advancedFilters: 'Расширенные фильтры',
      identityBackground: 'Идентичность и происхождение',
      gender: 'Пол',
      ethnicity: 'Этническая принадлежность',
      sexualOrientation: 'Сексуальная ориентация',
      physicalPersonality: 'Физические данные и личность',
      heightRange: 'Диапазон роста',
      zodiacSign: 'Знак зодиака',
      mbtiPersonality: 'Тип личности MBTI',
      loveLanguage: 'Язык любви',
      lifestyle: 'Образ жизни',
      languagesSpoken: 'Языки',
      smoking: 'Курение',
      drinking: 'Алкоголь',
      pets: 'Домашние животные',
      marriageIntentions: 'Намерения по браку',
      primaryReason: 'Основная причина',
      relationshipType: 'Тип отношений',
      wantsChildren: 'Хочет детей',
      housingPreference: 'Предпочтение жилья',
      financialArrangement: 'Финансовое соглашение'
    },
    verification: {
      alreadyVerified: 'Уже подтверждено',
      alreadyVerifiedMessage: 'Ваши фото уже подтверждены!',
      tooManyAttempts: 'Слишком много попыток',
      tooManyAttemptsMessage: 'Вы превысили максимальное количество попыток верификации (5). Обратитесь в поддержку hello@joinaccord.app.',
      tooManyAttemptsMessageShort: 'Вы превысили максимальное количество попыток верификации. Обратитесь в поддержку.',
      cameraPermission: 'Требуется разрешение камеры',
      cameraPermissionMessage: 'Разрешите доступ к камере для верификационного селфи.',
      selfieError: 'Ошибка селфи',
      selfieErrorMessage: 'Что-то пошло не так. Попробуйте снова.',
      success: 'Фото подтверждены!',
      successMessage: 'Ваши фото подтверждены!\n\nУверенность совпадения: {{similarity}}%\n\nВаш профиль теперь показывает значок верификации.',
      awesome: 'Отлично!',
      unsuccessful: 'Верификация не удалась',
      unsuccessfulMessage: '{{message}}\n\nЧтобы повысить шансы:\n\n• Сделайте селфи при ярком естественном дневном свете\n• Убедитесь, что основное фото профиля актуально\n• Смотрите прямо в камеру\n• Снимите солнцезащитные очки, головные уборы или маски\n• Избегайте теней на лице',
      tryAgain: 'Попробовать снова',
      noPhotos: 'Нет фото профиля',
      noPhotosMessage: 'Загрузите фото профиля перед верификацией.',
      profileNotFound: 'Профиль не найден. Попробуйте снова.',
      error: 'Ошибка верификации',
      errorMessage: 'Верификация не удалась. Попробуйте позже.',
      statusVerified: 'Подтверждено',
      statusProcessing: 'Обработка...',
      statusFailed: 'Не удалось',
      statusNotVerified: 'Не подтверждено',
      title: 'Верификация фото',
      verifiedDescription: 'Ваши фото подтверждены! Это показывает другим пользователям, что фото профиля точно вас представляют.',
      unverifiedDescription: 'Подтвердите фото, сделав селфи. Мы сравним его с фото вашего профиля с помощью распознавания лиц.',
      beforeYouStart: 'Перед началом',
      beforeYouStartDescription: 'Убедитесь, что основное фото профиля (первое фото) — это актуальное, чёткое фото вашего лица. Селфи будет сравнено с фото профиля.',
      attemptsUsed: 'Использовано попыток: {{count}} / 5',
      unsuccessfulBanner: 'Верификация не удалась',
      unsuccessfulBannerMessage: 'Селфи недостаточно совпало с фото профиля. Для лучших результатов сделайте селфи при ярком естественном свете и убедитесь, что основное фото актуально и чёткое.',
      verifying: 'Верификация...',
      takeVerificationSelfie: 'Сделать верификационное селфи',
      forBestResults: 'Для лучших результатов:',
      tips: {
        daylight: 'Сделайте селфи при ярком, естественном дневном свете',
        faceCamera: 'Смотрите прямо в камеру с нейтральным выражением лица',
        recentPhoto: 'Убедитесь, что основное фото профиля актуально и чётко показывает лицо',
        removeCoverings: 'Снимите солнцезащитные очки, головные уборы и маски',
        avoidShadows: 'Избегайте резких теней или контрового освещения',
        mustMatch: 'Ваше селфи должно совпадать с человеком на фото профиля'
      },
      photosVerified: 'Фото подтверждены!',
      verifiedBadgeMessage: 'Ваш значок верификации теперь отображается в профиле. Это помогает укрепить доверие с потенциальными парами.',
      freeForAll: 'Бесплатно для всех пользователей'
    }
  },
  tr: {
    discover: {
      dailyLimitTitle: 'Günlük limite ulaşıldı',
      dailyLimitMessage: 'Bugünkü 5 beğeniyi kullandınız. Sınırsız için yükseltin!',
      quickFilter: {
        age: 'Yaş',
        datingIntentions: 'Tanışma Niyetleri',
        activeToday: 'Bugün Aktif'
      },
      ageSlider: {
        ageRange: 'Yaş Aralığı: {{min}} - {{max}}',
        minimum: 'Minimum: {{value}}',
        maximum: 'Maksimum: {{value}}'
      },
      search: {
        placeholder: "Anahtar kelimeyle ara (ör. 'seyahat', 'vegan')",
        button: 'Ara',
        tip: 'Aramaya devam etmek için beğen veya geç. Tüm profilleri görmek için aramayı temizle.',
        noResults: '"{{keyword}}" için sonuç bulunamadı',
        noResultsHint: 'Farklı anahtar kelimeler deneyin veya daha fazla eşleşme bulmak için filtrelerinizi ayarlayın.',
        clearSearch: 'Aramayı Temizle'
      },
      emptyState: {
        allCaughtUp: 'Hepsini gördünüz',
        checkBack: 'Her gün yeni insanlar katılıyor.\nYakında tekrar bakın veya tercihlerinizi genişletin.'
      },
      premiumCta: {
        goPremium: 'Premium Ol',
        description: 'Sizi kimin beğendiğini görün, sınırsız beğeni ve daha fazlası.',
        upgrade: 'Yükselt'
      },
      recommendations: {
        expandReach: 'Erişiminizi Genişletin',
        increaseDistance: 'Mesafeyi {{count}} mil artır',
        widenAge: 'Yaş aralığını {{count}} yıl genişlet',
        includeGender: '{{gender}} dahil et',
        searchGlobally: 'Küresel ara',
        expandSearch: 'Aramanızı genişletin',
        newProfilesK: '{{count}}bin+ yeni profil',
        newProfiles: '{{count}} yeni profil',
        newProfileSingular: '1 yeni profil',
        updatePreferencesTitle: 'Tercihler güncellensin mi?',
        updatePreferencesMessage: 'Cinsiyet tercihlerinize "{{gender}}" eklensin mi? Bunu istediğiniz zaman Ayarlar > Eşleşme Tercihleri\'nden değiştirebilirsiniz.',
        add: 'Ekle'
      },
      banner: {
        photoBlurTitle: 'Neden Bazı Fotoğraflar Bulanık',
        photoBlurDescription: 'Bazı kullanıcılar eşleşene kadar kimliklerini korumak için gizlilik ayarlarında fotoğraf bulanıklığını etkinleştirir. Bağlantı kurulunca fotoğraflar görünür!',
        profileHidden: 'Profil Gizli',
        profileHiddenDescription: 'Profiliniz geçici olarak gizli. Yeni fotoğraf yüklemek için dokunun.',
        completeProfileToMatch: 'Eşleşmek İçin Profilinizi Tamamlayın',
        completeProfile: 'Profilinizi Tamamlayın',
        completeProfilePreview: 'Özgürce gezinebilirsiniz! Beğenmeye ve eşleşmeye başlamak için kaydı tamamlayın.',
        completeProfileDefault: 'Eşleşmeye başlamak için kurulumu tamamlayın. Gezinebilirsiniz ama henüz beğenemez veya görünemezsiniz.'
      },
      premiumLocation: {
        title: 'Küresel Aramayı Aç',
        description: 'Premium gerektiren kayıtlı konum tercihleriniz var:',
        searchGlobally: 'Küresel olarak eşleşme ara',
        matchCities: 'Belirli şehirlerde eşleş',
        upgradeMessage: 'Bu özellikleri etkinleştirmek ve dünyanın her yerinde eşleşme bulmak için Premium\'a yükseltin.',
        upgradeToPremium: 'Premium\'a Yükselt',
        maybeLater: 'Belki Sonra'
      }
    },
    filters: {
      basicFilters: 'Temel Filtreler',
      minimum: 'Minimum',
      maximum: 'Maksimum',
      activeToday: 'Bugün Aktif',
      activeTodayDescription: 'Yalnızca son 24 saatte aktif kullanıcıları göster',
      showBlurred: 'Bulanık Fotoğrafları Göster',
      showBlurredDescription: 'Fotoğraf bulanıklığı etkin profilleri dahil et',
      advancedFilters: 'Gelişmiş Filtreler',
      identityBackground: 'Kimlik ve Geçmiş',
      gender: 'Cinsiyet',
      ethnicity: 'Etnik Köken',
      sexualOrientation: 'Cinsel Yönelim',
      physicalPersonality: 'Fiziksel ve Kişilik',
      heightRange: 'Boy Aralığı',
      zodiacSign: 'Burç',
      mbtiPersonality: 'MBTI Kişilik Tipi',
      loveLanguage: 'Aşk Dili',
      lifestyle: 'Yaşam Tarzı',
      languagesSpoken: 'Konuşulan Diller',
      smoking: 'Sigara',
      drinking: 'Alkol',
      pets: 'Evcil Hayvanlar',
      marriageIntentions: 'Evlilik Niyetleri',
      primaryReason: 'Ana Sebep',
      relationshipType: 'İlişki Türü',
      wantsChildren: 'Çocuk İstiyor',
      housingPreference: 'Konut Tercihi',
      financialArrangement: 'Mali Düzenleme'
    },
    verification: {
      alreadyVerified: 'Zaten Doğrulanmış',
      alreadyVerifiedMessage: 'Fotoğraflarınız zaten doğrulanmış!',
      tooManyAttempts: 'Çok Fazla Deneme',
      tooManyAttemptsMessage: 'Maksimum doğrulama deneme sayısını (5) aştınız. Lütfen hello@joinaccord.app adresinden destek ile iletişime geçin.',
      tooManyAttemptsMessageShort: 'Maksimum doğrulama deneme sayısını aştınız. Lütfen destek ile iletişime geçin.',
      cameraPermission: 'Kamera İzni Gerekli',
      cameraPermissionMessage: 'Doğrulama selfisi çekmek için lütfen kamera erişimine izin verin.',
      selfieError: 'Selfie Hatası',
      selfieErrorMessage: 'Bir şeyler yanlış gitti. Lütfen tekrar deneyin.',
      success: 'Fotoğraflar Doğrulandı!',
      successMessage: 'Fotoğraflarınız doğrulandı!\n\nEşleşme güveni: {{similarity}}%\n\nProfiliniz artık doğrulanmış rozeti gösteriyor.',
      awesome: 'Harika!',
      unsuccessful: 'Doğrulama Başarısız',
      unsuccessfulMessage: '{{message}}\n\nŞansınızı artırmak için:\n\n• Selfienizi parlak, doğal gün ışığında çekin\n• Ana profil fotoğrafınızın güncel olduğundan emin olun\n• Doğrudan kameraya bakın\n• Güneş gözlüğü, şapka veya maske çıkarın\n• Yüzünüzdeki gölgelerden kaçının',
      tryAgain: 'Tekrar Dene',
      noPhotos: 'Profil Fotoğrafı Yok',
      noPhotosMessage: 'Doğrulamadan önce lütfen profil fotoğrafları yükleyin.',
      profileNotFound: 'Profil bulunamadı. Lütfen tekrar deneyin.',
      error: 'Doğrulama Hatası',
      errorMessage: 'Doğrulama başarısız. Lütfen daha sonra tekrar deneyin.',
      statusVerified: 'Doğrulanmış',
      statusProcessing: 'İşleniyor...',
      statusFailed: 'Başarısız',
      statusNotVerified: 'Doğrulanmamış',
      title: 'Fotoğraf Doğrulama',
      verifiedDescription: 'Fotoğraflarınız doğrulanmış! Bu, diğer kullanıcılara profil fotoğraflarınızın sizi doğru temsil ettiğini gösterir.',
      unverifiedDescription: 'Selfie çekerek fotoğraflarınızı doğrulayın. Yüz tanıma kullanarak profil fotoğraflarınızla karşılaştıracağız.',
      beforeYouStart: 'Başlamadan Önce',
      beforeYouStartDescription: 'Ana profil fotoğrafınızın (ilk fotoğraf) yüzünüzün güncel ve net bir fotoğrafı olduğundan emin olun. Selfie, profil fotoğraflarınızla karşılaştırılacaktır.',
      attemptsUsed: 'Kullanılan denemeler: {{count}} / 5',
      unsuccessfulBanner: 'Doğrulama Başarısız',
      unsuccessfulBannerMessage: 'Selfie, profil fotoğraflarınızla yeterince eşleşmedi. En iyi sonuçlar için, selfienizi parlak doğal gün ışığında çekin ve ana profil fotoğrafınızın güncel ve net olduğundan emin olun.',
      verifying: 'Doğrulanıyor...',
      takeVerificationSelfie: 'Doğrulama Selfisi Çek',
      forBestResults: 'En iyi sonuçlar için:',
      tips: {
        daylight: 'Selfienizi parlak, doğal gün ışığında çekin',
        faceCamera: 'Doğal bir ifadeyle doğrudan kameraya bakın',
        recentPhoto: 'Ana profil fotoğrafınızın güncel olduğundan ve yüzünüzü net gösterdiğinden emin olun',
        removeCoverings: 'Güneş gözlüğü, şapka ve yüz örtülerini çıkarın',
        avoidShadows: 'Sert gölgelerden veya arka ışıklı ortamlardan kaçının',
        mustMatch: 'Selfieniz profil fotoğraflarınızdaki kişiyle eşleşmelidir'
      },
      photosVerified: 'Fotoğraflar Doğrulandı!',
      verifiedBadgeMessage: 'Doğrulanmış rozetiniz artık profilinizdegörünüyor. Bu, potansiyel eşleşmelerle güven oluşturmaya yardımcı olur.',
      freeForAll: 'Tüm kullanıcılar için ücretsiz'
    }
  },
  uk: {
    discover: {
      dailyLimitTitle: 'Денний ліміт вичерпано',
      dailyLimitMessage: 'Ви використали всі 5 вподобань на сьогодні. Оновіть для необмежених!',
      quickFilter: {
        age: 'Вік',
        datingIntentions: 'Наміри знайомства',
        activeToday: 'Активний сьогодні'
      },
      ageSlider: {
        ageRange: 'Віковий діапазон: {{min}} - {{max}}',
        minimum: 'Мінімум: {{value}}',
        maximum: 'Максимум: {{value}}'
      },
      search: {
        placeholder: "Пошук за ключовим словом (напр. 'подорожі', 'веган')",
        button: 'Пошук',
        tip: 'Вподобайте або пропустіть, щоб продовжити пошук. Очистіть пошук, щоб побачити всі профілі.',
        noResults: 'Немає результатів для "{{keyword}}"',
        noResultsHint: 'Спробуйте інші ключові слова або налаштуйте фільтри для пошуку більшої кількості збігів.',
        clearSearch: 'Очистити пошук'
      },
      emptyState: {
        allCaughtUp: 'Ви все переглянули',
        checkBack: 'Щодня приєднуються нові люди.\nЗавітайте пізніше або розширте свої вподобання.'
      },
      premiumCta: {
        goPremium: 'Стати Преміум',
        description: 'Дізнайтесь, хто вас вподобав, необмежені вподобання та більше.',
        upgrade: 'Оновити'
      },
      recommendations: {
        expandReach: 'Розширте свій охоплення',
        increaseDistance: 'Збільшити відстань на {{count}} миль',
        widenAge: 'Розширити віковий діапазон на {{count}} років',
        includeGender: 'Включити {{gender}}',
        searchGlobally: 'Шукати по всьому світу',
        expandSearch: 'Розширити пошук',
        newProfilesK: '{{count}}тис.+ нових профілів',
        newProfiles: '{{count}} нових профілів',
        newProfileSingular: '1 новий профіль',
        updatePreferencesTitle: 'Оновити вподобання?',
        updatePreferencesMessage: 'Додати "{{gender}}" до вподобань статі? Ви можете змінити це будь-коли в Налаштування > Вподобання збігів.',
        add: 'Додати'
      },
      banner: {
        photoBlurTitle: 'Чому деякі фото розмиті',
        photoBlurDescription: 'Деякі користувачі вмикають розмиття фото в налаштуваннях конфіденційності для захисту своєї особистості до збігу. Фото відкриються після з\'єднання!',
        profileHidden: 'Профіль прихований',
        profileHiddenDescription: 'Ваш профіль тимчасово прихований. Натисніть, щоб завантажити нові фото.',
        completeProfileToMatch: 'Заповніть профіль для пошуку пар',
        completeProfile: 'Заповніть свій профіль',
        completeProfilePreview: 'Ви можете вільно переглядати! Завершіть реєстрацію, щоб почати вподобувати та знаходити пари.',
        completeProfileDefault: 'Завершіть налаштування, щоб почати пошук пар. Ви можете переглядати, але поки не можете вподобувати або бути видимим.'
      },
      premiumLocation: {
        title: 'Розблокуйте глобальний пошук',
        description: 'У вас є збережені вподобання місцезнаходження, які потребують Преміум:',
        searchGlobally: 'Шукати збіги по всьому світу',
        matchCities: 'Шукати пари в конкретних містах',
        upgradeMessage: 'Оновіть до Преміум, щоб активувати ці функції та знаходити збіги в будь-якій точці світу.',
        upgradeToPremium: 'Оновити до Преміум',
        maybeLater: 'Можливо пізніше'
      }
    },
    filters: {
      basicFilters: 'Основні фільтри',
      minimum: 'Мінімум',
      maximum: 'Максимум',
      activeToday: 'Активний сьогодні',
      activeTodayDescription: 'Показувати лише користувачів, активних за останні 24 години',
      showBlurred: 'Показати розмиті фото',
      showBlurredDescription: 'Включити профілі з розмиттям фото',
      advancedFilters: 'Розширені фільтри',
      identityBackground: 'Ідентичність та походження',
      gender: 'Стать',
      ethnicity: 'Етнічна приналежність',
      sexualOrientation: 'Сексуальна орієнтація',
      physicalPersonality: 'Фізичні дані та особистість',
      heightRange: 'Діапазон зросту',
      zodiacSign: 'Знак зодіаку',
      mbtiPersonality: 'Тип особистості MBTI',
      loveLanguage: 'Мова кохання',
      lifestyle: 'Спосіб життя',
      languagesSpoken: 'Мови',
      smoking: 'Куріння',
      drinking: 'Алкоголь',
      pets: 'Домашні тварини',
      marriageIntentions: 'Наміри щодо шлюбу',
      primaryReason: 'Основна причина',
      relationshipType: 'Тип стосунків',
      wantsChildren: 'Хоче дітей',
      housingPreference: 'Житлові вподобання',
      financialArrangement: 'Фінансова домовленість'
    },
    verification: {
      alreadyVerified: 'Вже підтверджено',
      alreadyVerifiedMessage: 'Ваші фото вже підтверджені!',
      tooManyAttempts: 'Забагато спроб',
      tooManyAttemptsMessage: 'Ви перевищили максимальну кількість спроб верифікації (5). Зверніться до підтримки hello@joinaccord.app.',
      tooManyAttemptsMessageShort: 'Ви перевищили максимальну кількість спроб верифікації. Зверніться до підтримки.',
      cameraPermission: 'Потрібен дозвіл камери',
      cameraPermissionMessage: 'Дозвольте доступ до камери для верифікаційного селфі.',
      selfieError: 'Помилка селфі',
      selfieErrorMessage: 'Щось пішло не так. Спробуйте знову.',
      success: 'Фото підтверджені!',
      successMessage: 'Ваші фото підтверджені!\n\nВпевненість збігу: {{similarity}}%\n\nВаш профіль тепер показує значок верифікації.',
      awesome: 'Чудово!',
      unsuccessful: 'Верифікація невдала',
      unsuccessfulMessage: '{{message}}\n\nЩоб підвищити шанси:\n\n• Зробіть селфі при яскравому природному денному світлі\n• Переконайтесь, що основне фото профілю актуальне\n• Дивіться прямо в камеру\n• Зніміть сонцезахисні окуляри, капелюхи або маски\n• Уникайте тіней на обличчі',
      tryAgain: 'Спробувати знову',
      noPhotos: 'Немає фото профілю',
      noPhotosMessage: 'Завантажте фото профілю перед верифікацією.',
      profileNotFound: 'Профіль не знайдено. Спробуйте знову.',
      error: 'Помилка верифікації',
      errorMessage: 'Верифікація не вдалася. Спробуйте пізніше.',
      statusVerified: 'Підтверджено',
      statusProcessing: 'Обробка...',
      statusFailed: 'Невдача',
      statusNotVerified: 'Не підтверджено',
      title: 'Верифікація фото',
      verifiedDescription: 'Ваші фото підтверджені! Це показує іншим користувачам, що фото профілю точно вас представляють.',
      unverifiedDescription: 'Підтвердіть фото, зробивши селфі. Ми порівняємо його з фото вашого профілю за допомогою розпізнавання облич.',
      beforeYouStart: 'Перед початком',
      beforeYouStartDescription: 'Переконайтесь, що основне фото профілю (перше фото) — це актуальне, чітке фото вашого обличчя. Селфі буде порівняно з фото профілю.',
      attemptsUsed: 'Використано спроб: {{count}} / 5',
      unsuccessfulBanner: 'Верифікація невдала',
      unsuccessfulBannerMessage: 'Селфі недостатньо збіглося з фото профілю. Для кращих результатів зробіть селфі при яскравому природному світлі та переконайтесь, що основне фото актуальне та чітке.',
      verifying: 'Верифікація...',
      takeVerificationSelfie: 'Зробити верифікаційне селфі',
      forBestResults: 'Для кращих результатів:',
      tips: {
        daylight: 'Зробіть селфі при яскравому, природному денному світлі',
        faceCamera: 'Дивіться прямо в камеру з нейтральним виразом обличчя',
        recentPhoto: 'Переконайтесь, що основне фото профілю актуальне та чітко показує обличчя',
        removeCoverings: 'Зніміть сонцезахисні окуляри, капелюхи та маски',
        avoidShadows: 'Уникайте різких тіней або контрового освітлення',
        mustMatch: 'Ваше селфі повинно збігатися з людиною на фото профілю'
      },
      photosVerified: 'Фото підтверджені!',
      verifiedBadgeMessage: 'Ваш значок верифікації тепер відображається на профілі. Це допомагає зміцнити довіру з потенційними парами.',
      freeForAll: 'Безкоштовно для всіх користувачів'
    }
  },
  ur: {
    discover: {
      dailyLimitTitle: 'روزانہ حد تک پہنچ گئے',
      dailyLimitMessage: 'آپ نے آج کی 5 لائکس استعمال کر لی ہیں۔ لامحدود کے لیے اپ گریڈ کریں!',
      quickFilter: {
        age: 'عمر',
        datingIntentions: 'ڈیٹنگ کے ارادے',
        activeToday: 'آج فعال'
      },
      ageSlider: {
        ageRange: 'عمر کی حد: {{min}} - {{max}}',
        minimum: 'کم از کم: {{value}}',
        maximum: 'زیادہ سے زیادہ: {{value}}'
      },
      search: {
        placeholder: "کلیدی لفظ سے تلاش کریں (مثلاً 'سفر'، 'سبزی خور')",
        button: 'تلاش کریں',
        tip: 'تلاش جاری رکھنے کے لیے لائک یا پاس کریں۔ تمام پروفائلز دیکھنے کے لیے تلاش صاف کریں۔',
        noResults: '"{{keyword}}" کے لیے کوئی نتائج نہیں',
        noResultsHint: 'مختلف کلیدی الفاظ آزمائیں یا مزید مماثلتیں تلاش کرنے کے لیے فلٹرز ایڈجسٹ کریں۔',
        clearSearch: 'تلاش صاف کریں'
      },
      emptyState: {
        allCaughtUp: 'آپ نے سب دیکھ لیا',
        checkBack: 'ہر روز نئے لوگ شامل ہوتے ہیں۔\nجلد واپس آئیں یا اپنی ترجیحات بڑھائیں۔'
      },
      premiumCta: {
        goPremium: 'پریمیم بنیں',
        description: 'دیکھیں کس نے آپ کو لائک کیا، لامحدود لائکس، اور مزید۔',
        upgrade: 'اپ گریڈ'
      },
      recommendations: {
        expandReach: 'اپنی رسائی بڑھائیں',
        increaseDistance: 'فاصلہ {{count}} میل بڑھائیں',
        widenAge: 'عمر کی حد {{count}} سال بڑھائیں',
        includeGender: '{{gender}} شامل کریں',
        searchGlobally: 'عالمی سطح پر تلاش کریں',
        expandSearch: 'اپنی تلاش بڑھائیں',
        newProfilesK: '{{count}}ہزار+ نئے پروفائلز',
        newProfiles: '{{count}} نئے پروفائلز',
        newProfileSingular: '1 نیا پروفائل',
        updatePreferencesTitle: 'ترجیحات اپ ڈیٹ کریں؟',
        updatePreferencesMessage: 'اپنی صنفی ترجیحات میں "{{gender}}" شامل کریں؟ آپ کسی بھی وقت سیٹنگز > مماثلت ترجیحات سے تبدیل کر سکتے ہیں۔',
        add: 'شامل کریں'
      },
      banner: {
        photoBlurTitle: 'کچھ تصاویر دھندلی کیوں ہیں',
        photoBlurDescription: 'کچھ صارفین مماثلت تک اپنی شناخت کی حفاظت کے لیے پرائیویسی سیٹنگز میں فوٹو بلر فعال کرتے ہیں۔ جڑنے کے بعد تصاویر ظاہر ہوں گی!',
        profileHidden: 'پروفائل چھپا ہوا',
        profileHiddenDescription: 'آپ کا پروفائل عارضی طور پر چھپا ہوا ہے۔ نئی تصاویر اپ لوڈ کرنے کے لیے ٹیپ کریں۔',
        completeProfileToMatch: 'مماثلت کے لیے پروفائل مکمل کریں',
        completeProfile: 'اپنا پروفائل مکمل کریں',
        completeProfilePreview: 'آپ آزادی سے براؤز کر سکتے ہیں! لائک اور مماثلت شروع کرنے کے لیے آن بورڈنگ مکمل کریں۔',
        completeProfileDefault: 'مماثلت شروع کرنے کے لیے سیٹ اپ مکمل کریں۔ آپ براؤز کر سکتے ہیں لیکن ابھی لائک یا نظر نہیں آ سکتے۔'
      },
      premiumLocation: {
        title: 'عالمی تلاش کھولیں',
        description: 'آپ کی محفوظ مقام کی ترجیحات کے لیے پریمیم درکار ہے:',
        searchGlobally: 'عالمی سطح پر مماثلتیں تلاش کریں',
        matchCities: 'مخصوص شہروں میں مماثلت کریں',
        upgradeMessage: 'ان خصوصیات کو فعال کرنے اور دنیا میں کہیں بھی مماثلتیں تلاش کرنے کے لیے پریمیم میں اپ گریڈ کریں۔',
        upgradeToPremium: 'پریمیم میں اپ گریڈ',
        maybeLater: 'شاید بعد میں'
      }
    },
    filters: {
      basicFilters: 'بنیادی فلٹرز',
      minimum: 'کم از کم',
      maximum: 'زیادہ سے زیادہ',
      activeToday: 'آج فعال',
      activeTodayDescription: 'صرف پچھلے 24 گھنٹوں میں فعال صارفین دکھائیں',
      showBlurred: 'دھندلی تصاویر دکھائیں',
      showBlurredDescription: 'فوٹو بلر فعال پروفائلز شامل کریں',
      advancedFilters: 'جدید فلٹرز',
      identityBackground: 'شناخت اور پس منظر',
      gender: 'صنف',
      ethnicity: 'نسلی پس منظر',
      sexualOrientation: 'جنسی رجحان',
      physicalPersonality: 'جسمانی اور شخصیت',
      heightRange: 'قد کی حد',
      zodiacSign: 'برج',
      mbtiPersonality: 'MBTI شخصیت کی قسم',
      loveLanguage: 'محبت کی زبان',
      lifestyle: 'طرز زندگی',
      languagesSpoken: 'بولی جانے والی زبانیں',
      smoking: 'تمباکو نوشی',
      drinking: 'شراب نوشی',
      pets: 'پالتو جانور',
      marriageIntentions: 'شادی کے ارادے',
      primaryReason: 'بنیادی وجہ',
      relationshipType: 'تعلق کی قسم',
      wantsChildren: 'بچے چاہتے ہیں',
      housingPreference: 'رہائش کی ترجیح',
      financialArrangement: 'مالی انتظام'
    },
    verification: {
      alreadyVerified: 'پہلے سے تصدیق شدہ',
      alreadyVerifiedMessage: 'آپ کی تصاویر پہلے سے تصدیق شدہ ہیں!',
      tooManyAttempts: 'بہت زیادہ کوششیں',
      tooManyAttemptsMessage: 'آپ نے تصدیق کی زیادہ سے زیادہ کوششیں (5) عبور کر لی ہیں۔ براہ کرم hello@joinaccord.app پر سپورٹ سے رابطہ کریں۔',
      tooManyAttemptsMessageShort: 'آپ نے تصدیق کی زیادہ سے زیادہ کوششیں عبور کر لی ہیں۔ براہ کرم سپورٹ سے رابطہ کریں۔',
      cameraPermission: 'کیمرے کی اجازت درکار ہے',
      cameraPermissionMessage: 'تصدیقی سیلفی لینے کے لیے براہ کرم کیمرے تک رسائی دیں۔',
      selfieError: 'سیلفی میں خرابی',
      selfieErrorMessage: 'کچھ غلط ہو گیا۔ براہ کرم دوبارہ کوشش کریں۔',
      success: 'تصاویر تصدیق شدہ!',
      successMessage: 'آپ کی تصاویر تصدیق ہو گئی ہیں!\n\nمماثلت اعتماد: {{similarity}}%\n\nآپ کا پروفائل اب تصدیقی بیج دکھا رہا ہے۔',
      awesome: 'شاندار!',
      unsuccessful: 'تصدیق ناکام',
      unsuccessfulMessage: '{{message}}\n\nاپنے امکانات بہتر بنانے کے لیے:\n\n• روشن قدرتی دن کی روشنی میں سیلفی لیں\n• یقینی بنائیں کہ آپ کی بنیادی تصویر حالیہ ہے\n• براہ راست کیمرے کی طرف دیکھیں\n• دھوپ کے چشمے، ٹوپیاں یا ماسک اتاریں\n• چہرے پر سائے سے بچیں',
      tryAgain: 'دوبارہ کوشش کریں',
      noPhotos: 'کوئی پروفائل تصاویر نہیں',
      noPhotosMessage: 'تصدیق سے پہلے براہ کرم پروفائل تصاویر اپ لوڈ کریں۔',
      profileNotFound: 'پروفائل نہیں ملا۔ براہ کرم دوبارہ کوشش کریں۔',
      error: 'تصدیق میں خرابی',
      errorMessage: 'تصدیق ناکام ہو گئی۔ براہ کرم بعد میں دوبارہ کوشش کریں۔',
      statusVerified: 'تصدیق شدہ',
      statusProcessing: 'پراسیس ہو رہا ہے...',
      statusFailed: 'ناکام',
      statusNotVerified: 'غیر تصدیق شدہ',
      title: 'فوٹو تصدیق',
      verifiedDescription: 'آپ کی تصاویر تصدیق شدہ ہیں! یہ دوسرے صارفین کو دکھاتا ہے کہ آپ کی پروفائل تصاویر آپ کی درست نمائندگی کرتی ہیں۔',
      unverifiedDescription: 'سیلفی لے کر اپنی تصاویر کی تصدیق کریں۔ ہم چہرے کی شناخت کا استعمال کرتے ہوئے آپ کی پروفائل تصاویر سے موازنہ کریں گے۔',
      beforeYouStart: 'شروع کرنے سے پہلے',
      beforeYouStartDescription: 'یقینی بنائیں کہ آپ کی بنیادی پروفائل تصویر (پہلی تصویر) آپ کے چہرے کی حالیہ، واضح تصویر ہے۔ سیلفی کا موازنہ آپ کی پروفائل تصاویر سے کیا جائے گا۔',
      attemptsUsed: 'استعمال شدہ کوششیں: {{count}} / 5',
      unsuccessfulBanner: 'تصدیق ناکام',
      unsuccessfulBannerMessage: 'سیلفی آپ کی پروفائل تصاویر سے کافی مماثل نہیں تھی۔ بہترین نتائج کے لیے، روشن قدرتی دن کی روشنی میں سیلفی لیں اور یقینی بنائیں کہ بنیادی تصویر حالیہ اور واضح ہے۔',
      verifying: 'تصدیق ہو رہی ہے...',
      takeVerificationSelfie: 'تصدیقی سیلفی لیں',
      forBestResults: 'بہترین نتائج کے لیے:',
      tips: {
        daylight: 'روشن، قدرتی دن کی روشنی میں سیلفی لیں',
        faceCamera: 'غیر جانبدار تاثرات کے ساتھ براہ راست کیمرے کی طرف دیکھیں',
        recentPhoto: 'یقینی بنائیں کہ بنیادی پروفائل تصویر حالیہ ہے اور چہرہ واضح دکھاتی ہے',
        removeCoverings: 'دھوپ کے چشمے، ٹوپیاں اور چہرے کے پردے اتاریں',
        avoidShadows: 'سخت سائے یا پشت روشنی والے ماحول سے بچیں',
        mustMatch: 'آپ کی سیلفی پروفائل تصاویر میں شخص سے مماثل ہونی چاہیے'
      },
      photosVerified: 'تصاویر تصدیق شدہ!',
      verifiedBadgeMessage: 'آپ کا تصدیقی بیج اب پروفائل پر دکھایا جا رہا ہے۔ یہ ممکنہ مماثلتوں کے ساتھ اعتماد بنانے میں مدد کرتا ہے۔',
      freeForAll: 'تمام صارفین کے لیے مفت'
    }
  },
  zh: {
    discover: {
      dailyLimitTitle: '每日限额已达',
      dailyLimitMessage: '您今天的5个喜欢已用完。升级获取无限喜欢！',
      quickFilter: {
        age: '年龄',
        datingIntentions: '约会意图',
        activeToday: '今日活跃'
      },
      ageSlider: {
        ageRange: '年龄范围：{{min}} - {{max}}',
        minimum: '最小：{{value}}',
        maximum: '最大：{{value}}'
      },
      search: {
        placeholder: "按关键词搜索（如：'旅行'、'素食'）",
        button: '搜索',
        tip: '点赞或跳过以继续搜索。清除搜索以查看所有个人资料。',
        noResults: '未找到"{{keyword}}"的结果',
        noResultsHint: '尝试不同的关键词或调整筛选条件以找到更多匹配。',
        clearSearch: '清除搜索'
      },
      emptyState: {
        allCaughtUp: '您已浏览完毕',
        checkBack: '每天都有新人加入。\n请稍后再来或扩大您的偏好设置。'
      },
      premiumCta: {
        goPremium: '升级高级版',
        description: '查看谁喜欢了你、无限喜欢等更多功能。',
        upgrade: '升级'
      },
      recommendations: {
        expandReach: '扩大您的范围',
        increaseDistance: '增加{{count}}英里距离',
        widenAge: '扩大{{count}}岁年龄范围',
        includeGender: '包含{{gender}}',
        searchGlobally: '全球搜索',
        expandSearch: '扩大搜索范围',
        newProfilesK: '{{count}}千+新个人资料',
        newProfiles: '{{count}}个新个人资料',
        newProfileSingular: '1个新个人资料',
        updatePreferencesTitle: '更新偏好？',
        updatePreferencesMessage: '将"{{gender}}"添加到您的性别偏好中？您可以随时在设置 > 匹配偏好中更改。',
        add: '添加'
      },
      banner: {
        photoBlurTitle: '为什么有些照片模糊',
        photoBlurDescription: '一些用户在隐私设置中启用了照片模糊功能，以在匹配前保护身份。连接后照片将显示！',
        profileHidden: '个人资料已隐藏',
        profileHiddenDescription: '您的个人资料暂时隐藏。点击上传新照片。',
        completeProfileToMatch: '完善资料以开始匹配',
        completeProfile: '完善您的个人资料',
        completeProfilePreview: '您可以自由浏览！完成注册以开始点赞和匹配。',
        completeProfileDefault: '完成设置以开始匹配。您可以浏览但还不能点赞或被看到。'
      },
      premiumLocation: {
        title: '解锁全球搜索',
        description: '您有保存的位置偏好需要高级版：',
        searchGlobally: '全球搜索匹配',
        matchCities: '在特定城市匹配',
        upgradeMessage: '升级到高级版以激活这些功能，在世界任何地方找到匹配。',
        upgradeToPremium: '升级到高级版',
        maybeLater: '以后再说'
      }
    },
    filters: {
      basicFilters: '基本筛选',
      minimum: '最小',
      maximum: '最大',
      activeToday: '今日活跃',
      activeTodayDescription: '仅显示过去24小时内活跃的用户',
      showBlurred: '显示模糊照片',
      showBlurredDescription: '包含启用照片模糊的个人资料',
      advancedFilters: '高级筛选',
      identityBackground: '身份与背景',
      gender: '性别',
      ethnicity: '种族',
      sexualOrientation: '性取向',
      physicalPersonality: '体格与性格',
      heightRange: '身高范围',
      zodiacSign: '星座',
      mbtiPersonality: 'MBTI人格类型',
      loveLanguage: '爱的语言',
      lifestyle: '生活方式',
      languagesSpoken: '使用语言',
      smoking: '吸烟',
      drinking: '饮酒',
      pets: '宠物',
      marriageIntentions: '婚姻意向',
      primaryReason: '主要原因',
      relationshipType: '关系类型',
      wantsChildren: '想要孩子',
      housingPreference: '住房偏好',
      financialArrangement: '财务安排'
    },
    verification: {
      alreadyVerified: '已验证',
      alreadyVerifiedMessage: '您的照片已经验证！',
      tooManyAttempts: '尝试次数过多',
      tooManyAttemptsMessage: '您已超过最大验证尝试次数（5次）。请联系支持 hello@joinaccord.app。',
      tooManyAttemptsMessageShort: '您已超过最大验证尝试次数。请联系支持。',
      cameraPermission: '需要相机权限',
      cameraPermissionMessage: '请允许相机访问以拍摄验证自拍。',
      selfieError: '自拍错误',
      selfieErrorMessage: '出了问题。请重试。',
      success: '照片已验证！',
      successMessage: '您的照片已验证！\n\n匹配置信度：{{similarity}}%\n\n您的个人资料现在显示验证徽章。',
      awesome: '太棒了！',
      unsuccessful: '验证未成功',
      unsuccessfulMessage: '{{message}}\n\n提高成功率：\n\n• 在明亮的自然日光下拍摄自拍\n• 确保主要个人资料照片是最近的\n• 正面面对镜头\n• 摘下太阳镜、帽子或口罩\n• 避免面部阴影',
      tryAgain: '重试',
      noPhotos: '没有个人资料照片',
      noPhotosMessage: '验证前请上传个人资料照片。',
      profileNotFound: '未找到个人资料。请重试。',
      error: '验证错误',
      errorMessage: '验证失败。请稍后重试。',
      statusVerified: '已验证',
      statusProcessing: '处理中...',
      statusFailed: '失败',
      statusNotVerified: '未验证',
      title: '照片验证',
      verifiedDescription: '您的照片已验证！这向其他用户表明您的个人资料照片准确地代表了您。',
      unverifiedDescription: '通过拍摄自拍来验证您的照片。我们将使用人脸识别与您的个人资料照片进行比较。',
      beforeYouStart: '开始之前',
      beforeYouStartDescription: '确保您的主要个人资料照片（第一张照片）是您面部的最近、清晰的照片。自拍将与您的个人资料照片进行比较。',
      attemptsUsed: '已用尝试次数：{{count}} / 5',
      unsuccessfulBanner: '验证未成功',
      unsuccessfulBannerMessage: '自拍与您的个人资料照片匹配不够。为获得最佳效果，请在明亮的自然日光下拍摄自拍，并确保主要个人资料照片是最近且清晰的。',
      verifying: '验证中...',
      takeVerificationSelfie: '拍摄验证自拍',
      forBestResults: '为获得最佳效果：',
      tips: {
        daylight: '在明亮、自然的日光下拍摄自拍',
        faceCamera: '以自然表情正面面对镜头',
        recentPhoto: '确保主要个人资料照片是最近的，并清楚显示面部',
        removeCoverings: '摘下太阳镜、帽子和面部遮盖物',
        avoidShadows: '避免强烈阴影或逆光环境',
        mustMatch: '您的自拍必须与个人资料照片中的人匹配'
      },
      photosVerified: '照片已验证！',
      verifiedBadgeMessage: '您的验证徽章现在显示在个人资料上。这有助于与潜在匹配建立信任。',
      freeForAll: '所有用户免费'
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

console.log('Done! Updated 6 locales: pt, ru, tr, uk, ur, zh');
