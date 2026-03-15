/**
 * Adds safetyCenter translations to locales: pt, ru, tr, uk, ur, zh
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
    safetyCenter: {
      title: "Centro de Segurança",
      subtitle: "Fique seguro no Accord",
      safetyTipsTitle: "Dicas de Segurança",
      crisisResourcesTitle: "Recursos de Crise",
      crisisResourcesDescription: "Se você ou alguém que conhece está em perigo, entre em contato com estes recursos.",
      visitWebsite: "Visitar site",
      quickActionsTitle: "Ações Rápidas",
      footerText: "Sua segurança é nossa maior prioridade. Se você se sentir inseguro, não hesite em nos contatar ou usar os recursos acima.",
      alerts: {
        callTitle: "Ligar para {{name}}",
        callMessage: "Deseja ligar para {{phone}}?",
        call: "Ligar",
        emailUs: "Envie-nos um email para hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "Usuários Bloqueados",
        blockedUsersDesc: "Gerencie sua lista de usuários bloqueados",
        privacySettings: "Configurações de Privacidade",
        privacySettingsDesc: "Controle sua privacidade e visibilidade",
        contactSupport: "Contatar Suporte",
        contactSupportDesc: "Reporte preocupações de segurança à nossa equipe"
      },
      tips: {
        meetSafely: {
          title: "Encontrar com Segurança",
          description: "Sempre encontre-se em lugares públicos nos primeiros encontros",
          expanded: "Ao encontrar alguém pela primeira vez:\n\n• Escolha um local público como um café, restaurante ou parque\n• Informe um amigo ou familiar para onde está indo\n• Compartilhe sua localização com alguém de confiança\n• Providencie seu próprio transporte\n• Fique sóbrio e alerta\n• Confie em seus instintos - se algo parecer errado, vá embora"
        },
        protectInfo: {
          title: "Proteja suas Informações",
          description: "Mantenha detalhes pessoais privados até construir confiança",
          expanded: "Proteja-se online:\n\n• Não compartilhe endereço residencial, local de trabalho ou informações financeiras\n• Tenha cuidado ao compartilhar seu número de telefone\n• Evite compartilhar detalhes de identificação cedo demais\n• Use as mensagens dentro do Accord até se sentir confortável\n• Nunca envie dinheiro para alguém que não conheceu\n• Desconfie de qualquer pessoa pedindo ajuda financeira"
        },
        verifyIdentity: {
          title: "Verificar Identidade",
          description: "Use videochamadas antes de encontrar pessoalmente",
          expanded: "Verifique se está falando com uma pessoa real:\n\n• Solicite uma videochamada antes do encontro\n• Procure perfis verificados (marca azul)\n• Tenha cuidado com perfis com apenas uma foto\n• Observe inconsistências na história deles\n• Faça uma busca reversa de imagem se suspeitar\n• Denuncie perfis falsos ou suspeitos imediatamente"
        },
        lgbtqSafety: {
          title: "Segurança LGBTQ+",
          description: "Considerações de segurança específicas para nossa comunidade",
          expanded: "Ficar seguro como pessoa LGBTQ+:\n\n• Seja seletivo sobre quem sabe do seu acordo\n• Considere as configurações de privacidade cuidadosamente\n• Esteja ciente das leis e atitudes locais\n• Tenha uma estratégia de saída se se sentir inseguro\n• Conecte-se com recursos LGBTQ+ em sua área\n• Confie em sua comunidade - estamos aqui para nos apoiar"
        },
        legalProtection: {
          title: "Proteção Legal",
          description: "Considere acordos formais para casamentos lavanda",
          expanded: "Proteja-se legalmente:\n\n• Consulte um advogado de família amigável ao LGBTQ+\n• Considere um acordo pré-nupcial\n• Documente seu acordo por escrito\n• Entenda as implicações de imigração, se aplicável\n• Conheça seus direitos sobre propriedade e finanças\n• Mantenha os acordos confidenciais e seguros"
        },
        mentalHealth: {
          title: "Saúde Mental",
          description: "Cuide do seu bem-estar emocional",
          expanded: "Priorize sua saúde mental:\n\n• Estabeleça limites e expectativas claras\n• Comunique-se aberta e honestamente\n• Procure terapia ou aconselhamento se necessário\n• Conecte-se com grupos de apoio LGBTQ+\n• Lembre-se que você merece respeito e gentileza\n• Faça pausas do aplicativo quando necessário"
        },
        reportBlock: {
          title: "Denunciar e Bloquear",
          description: "Use nossas ferramentas de segurança para se proteger",
          expanded: "Fique seguro no Accord:\n\n• Bloqueie usuários que fazem você se sentir desconfortável\n• Denuncie assédio, ameaças ou comportamento suspeito\n• Analisamos todas as denúncias em 24 horas\n• Suas denúncias são anônimas\n• Violações graves resultam em encerramento da conta\n• Contate-nos diretamente para preocupações urgentes de segurança"
        }
      },
      resources: {
        trevor: { name: "The Trevor Project", description: "Suporte em crise 24/7 para jovens LGBTQ+" },
        transLifeline: { name: "Trans Lifeline", description: "Suporte para pessoas transgênero" },
        glbtHotline: { name: "LGBT National Hotline", description: "Suporte entre pares e recursos locais" },
        rainn: { name: "RAINN", description: "Suporte a agressão sexual" }
      }
    }
  },
  ru: {
    safetyCenter: {
      title: "Центр безопасности",
      subtitle: "Будьте в безопасности на Accord",
      safetyTipsTitle: "Советы по безопасности",
      crisisResourcesTitle: "Кризисные ресурсы",
      crisisResourcesDescription: "Если вы или кто-то из ваших знакомых в опасности, пожалуйста, обратитесь к этим ресурсам.",
      visitWebsite: "Посетить сайт",
      quickActionsTitle: "Быстрые действия",
      footerText: "Ваша безопасность — наш главный приоритет. Если вы чувствуете себя в опасности, не стесняйтесь обращаться к нам или к ресурсам выше.",
      alerts: {
        callTitle: "Позвонить {{name}}",
        callMessage: "Вы хотите позвонить по номеру {{phone}}?",
        call: "Позвонить",
        emailUs: "Напишите нам на hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "Заблокированные пользователи",
        blockedUsersDesc: "Управляйте списком заблокированных пользователей",
        privacySettings: "Настройки конфиденциальности",
        privacySettingsDesc: "Контролируйте конфиденциальность и видимость",
        contactSupport: "Связаться с поддержкой",
        contactSupportDesc: "Сообщите о проблемах безопасности нашей команде"
      },
      tips: {
        meetSafely: {
          title: "Безопасные встречи",
          description: "Всегда встречайтесь в общественных местах на первых свиданиях",
          expanded: "При первой встрече с кем-либо:\n\n• Выберите общественное место: кафе, ресторан или парк\n• Сообщите другу или родственнику, куда вы идёте\n• Поделитесь своим местоположением с тем, кому доверяете\n• Организуйте собственный транспорт\n• Оставайтесь трезвыми и внимательными\n• Доверяйте интуиции — если что-то не так, уходите"
        },
        protectInfo: {
          title: "Защитите свою информацию",
          description: "Храните личные данные в секрете, пока не установите доверие",
          expanded: "Защитите себя в интернете:\n\n• Не сообщайте домашний адрес, место работы или финансовую информацию\n• Будьте осторожны при передаче номера телефона\n• Избегайте раннего раскрытия идентифицирующих данных\n• Используйте встроенные сообщения Accord, пока не почувствуете себя комфортно\n• Никогда не отправляйте деньги тому, с кем не встречались\n• Остерегайтесь тех, кто просит финансовую помощь"
        },
        verifyIdentity: {
          title: "Проверка личности",
          description: "Используйте видеозвонки перед личной встречей",
          expanded: "Убедитесь, что общаетесь с реальным человеком:\n\n• Попросите видеозвонок перед встречей\n• Ищите верифицированные профили (синяя галочка)\n• Будьте осторожны с профилями, имеющими только одно фото\n• Обращайте внимание на несоответствия в их рассказе\n• Проведите обратный поиск изображения при подозрении\n• Немедленно сообщайте о фальшивых или подозрительных профилях"
        },
        lgbtqSafety: {
          title: "Безопасность ЛГБТК+",
          description: "Особые соображения безопасности для нашего сообщества",
          expanded: "Безопасность как ЛГБТК+ человека:\n\n• Будьте избирательны, кому рассказываете о своей договорённости\n• Тщательно продумайте настройки конфиденциальности\n• Учитывайте местные законы и отношение общества\n• Имейте план отхода, если почувствуете себя в опасности\n• Свяжитесь с ЛГБТК+ ресурсами в вашем регионе\n• Доверяйте сообществу — мы здесь, чтобы поддерживать друг друга"
        },
        legalProtection: {
          title: "Правовая защита",
          description: "Рассмотрите формальные соглашения для лавандовых браков",
          expanded: "Защитите себя юридически:\n\n• Проконсультируйтесь с ЛГБТК+-дружественным семейным адвокатом\n• Рассмотрите брачный контракт\n• Задокументируйте вашу договорённость в письменной форме\n• Разберитесь с иммиграционными последствиями, если применимо\n• Знайте свои права в отношении собственности и финансов\n• Храните соглашения конфиденциально и безопасно"
        },
        mentalHealth: {
          title: "Психическое здоровье",
          description: "Заботьтесь о своём эмоциональном благополучии",
          expanded: "Приоритизируйте психическое здоровье:\n\n• Установите чёткие границы и ожидания\n• Общайтесь открыто и честно\n• Обратитесь к терапевту или консультанту при необходимости\n• Свяжитесь с группами поддержки ЛГБТК+\n• Помните, что вы заслуживаете уважения и доброты\n• Делайте перерывы от приложения, когда нужно"
        },
        reportBlock: {
          title: "Жалоба и блокировка",
          description: "Используйте наши инструменты безопасности для самозащиты",
          expanded: "Будьте в безопасности на Accord:\n\n• Блокируйте пользователей, которые вызывают дискомфорт\n• Сообщайте о домогательствах, угрозах или подозрительном поведении\n• Мы рассматриваем все жалобы в течение 24 часов\n• Ваши жалобы анонимны\n• Серьёзные нарушения приводят к удалению аккаунта\n• Свяжитесь с нами напрямую по срочным вопросам безопасности"
        }
      },
      resources: {
        trevor: { name: "The Trevor Project", description: "Кризисная поддержка 24/7 для ЛГБТК+ молодёжи" },
        transLifeline: { name: "Trans Lifeline", description: "Поддержка трансгендерных людей" },
        glbtHotline: { name: "Национальная горячая линия ЛГБТ", description: "Поддержка сверстников и местные ресурсы" },
        rainn: { name: "RAINN", description: "Помощь при сексуальном насилии" }
      }
    }
  },
  tr: {
    safetyCenter: {
      title: "Güvenlik Merkezi",
      subtitle: "Accord'da güvende kalın",
      safetyTipsTitle: "Güvenlik İpuçları",
      crisisResourcesTitle: "Kriz Kaynakları",
      crisisResourcesDescription: "Siz veya tanıdığınız biri tehlikedeyse, lütfen bu kaynaklara başvurun.",
      visitWebsite: "Siteyi Ziyaret Et",
      quickActionsTitle: "Hızlı İşlemler",
      footerText: "Güvenliğiniz en büyük önceliğimizdir. Kendinizi güvensiz hissederseniz, bize veya yukarıdaki kaynaklara başvurmaktan çekinmeyin.",
      alerts: {
        callTitle: "{{name}} ara",
        callMessage: "{{phone}} numarasını aramak istiyor musunuz?",
        call: "Ara",
        emailUs: "Bize hello@joinaccord.app adresinden yazın"
      },
      actions: {
        blockedUsers: "Engellenen Kullanıcılar",
        blockedUsersDesc: "Engellenen kullanıcı listenizi yönetin",
        privacySettings: "Gizlilik Ayarları",
        privacySettingsDesc: "Gizliliğinizi ve görünürlüğünüzü kontrol edin",
        contactSupport: "Destek ile İletişim",
        contactSupportDesc: "Güvenlik endişelerinizi ekibimize bildirin"
      },
      tips: {
        meetSafely: {
          title: "Güvenli Buluşma",
          description: "İlk birkaç buluşmada her zaman halka açık yerlerde buluşun",
          expanded: "Birisiyle ilk kez buluşurken:\n\n• Kafe, restoran veya park gibi halka açık bir yer seçin\n• Bir arkadaşınıza veya aile üyenize nereye gittiğinizi söyleyin\n• Konumunuzu güvendiğiniz biriyle paylaşın\n• Kendi ulaşımınızı ayarlayın\n• Ayık ve dikkatli kalın\n• İçgüdülerinize güvenin - bir şey yanlış hissediyorsa, ayrılın"
        },
        protectInfo: {
          title: "Bilgilerinizi Koruyun",
          description: "Güven oluşana kadar kişisel bilgileri gizli tutun",
          expanded: "Çevrimiçi kendinizi koruyun:\n\n• Ev adresinizi, iş yerinizi veya finansal bilgilerinizi paylaşmayın\n• Telefon numaranızı paylaşırken dikkatli olun\n• Tanımlayıcı bilgileri erken paylaşmaktan kaçının\n• Kendinizi rahat hissedene kadar Accord'un uygulama içi mesajlaşmasını kullanın\n• Tanışmadığınız birine asla para göndermeyin\n• Finansal yardım isteyen herkese karşı dikkatli olun"
        },
        verifyIdentity: {
          title: "Kimlik Doğrulama",
          description: "Yüz yüze buluşmadan önce görüntülü arama yapın",
          expanded: "Gerçek bir kişiyle konuştuğunuzu doğrulayın:\n\n• Buluşmadan önce görüntülü arama isteyin\n• Doğrulanmış profilleri arayın (mavi onay işareti)\n• Sadece bir fotoğrafı olan profillere karşı dikkatli olun\n• Hikayelerindeki tutarsızlıklara dikkat edin\n• Şüpheleniyorsanız ters görsel arama yapın\n• Sahte veya şüpheli profilleri hemen bildirin"
        },
        lgbtqSafety: {
          title: "LGBTQ+ Güvenliği",
          description: "Topluluğumuz için özel güvenlik değerlendirmeleri",
          expanded: "LGBTQ+ birey olarak güvende kalmak:\n\n• Düzenlemenizi kimin bildiği konusunda seçici olun\n• Gizlilik ayarlarını dikkatlice değerlendirin\n• Yerel yasalar ve tutumlar hakkında bilgi sahibi olun\n• Güvensiz hissederseniz bir çıkış stratejisi bulundurun\n• Bölgenizdeki LGBTQ+ kaynaklarıyla bağlantı kurun\n• Topluluğunuza güvenin - birbirimizi desteklemek için buradayız"
        },
        legalProtection: {
          title: "Yasal Koruma",
          description: "Lavanta evlilikleri için resmi anlaşmaları değerlendirin",
          expanded: "Kendinizi yasal olarak koruyun:\n\n• LGBTQ+ dostu bir aile hukukçusuna danışın\n• Evlilik öncesi sözleşme düşünün\n• Düzenlemenizi yazılı olarak belgeleyin\n• Varsa göçmenlik etkilerini anlayın\n• Mülkiyet ve mali konulardaki haklarınızı bilin\n• Anlaşmaları gizli ve güvenli tutun"
        },
        mentalHealth: {
          title: "Ruh Sağlığı",
          description: "Duygusal sağlığınıza özen gösterin",
          expanded: "Ruh sağlığınızı önceliklendirin:\n\n• Net sınırlar ve beklentiler belirleyin\n• Açık ve dürüst iletişim kurun\n• Gerekirse terapi veya danışmanlık alın\n• LGBTQ+ destek gruplarıyla bağlantı kurun\n• Saygı ve nezaketi hak ettiğinizi unutmayın\n• Gerektiğinde uygulamadan mola verin"
        },
        reportBlock: {
          title: "Bildir ve Engelle",
          description: "Kendinizi korumak için güvenlik araçlarımızı kullanın",
          expanded: "Accord'da güvende kalın:\n\n• Sizi rahatsız eden kullanıcıları engelleyin\n• Taciz, tehdit veya şüpheli davranışları bildirin\n• Tüm bildirimleri 24 saat içinde inceliyoruz\n• Bildirimleriniz anonimdir\n• Ciddi ihlaller hesap kapatmayla sonuçlanır\n• Acil güvenlik endişeleri için doğrudan bizimle iletişime geçin"
        }
      },
      resources: {
        trevor: { name: "The Trevor Project", description: "LGBTQ+ gençler için 7/24 kriz desteği" },
        transLifeline: { name: "Trans Lifeline", description: "Transgender bireyler için destek" },
        glbtHotline: { name: "LGBT Ulusal Yardım Hattı", description: "Akran desteği ve yerel kaynaklar" },
        rainn: { name: "RAINN", description: "Cinsel saldırı desteği" }
      }
    }
  },
  uk: {
    safetyCenter: {
      title: "Центр безпеки",
      subtitle: "Будьте в безпеці на Accord",
      safetyTipsTitle: "Поради з безпеки",
      crisisResourcesTitle: "Кризові ресурси",
      crisisResourcesDescription: "Якщо ви або хтось із ваших знайомих у небезпеці, будь ласка, зверніться до цих ресурсів.",
      visitWebsite: "Відвідати сайт",
      quickActionsTitle: "Швидкі дії",
      footerText: "Ваша безпека — наш головний пріоритет. Якщо ви відчуваєте себе небезпечно, не вагайтеся звертатися до нас або до ресурсів вище.",
      alerts: {
        callTitle: "Зателефонувати {{name}}",
        callMessage: "Бажаєте зателефонувати на {{phone}}?",
        call: "Зателефонувати",
        emailUs: "Напишіть нам на hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "Заблоковані користувачі",
        blockedUsersDesc: "Керуйте списком заблокованих користувачів",
        privacySettings: "Налаштування конфіденційності",
        privacySettingsDesc: "Контролюйте конфіденційність та видимість",
        contactSupport: "Зв'язатися з підтримкою",
        contactSupportDesc: "Повідомте про проблеми безпеки нашій команді"
      },
      tips: {
        meetSafely: {
          title: "Безпечні зустрічі",
          description: "Завжди зустрічайтеся в громадських місцях на перших побаченнях",
          expanded: "При першій зустрічі з кимось:\n\n• Оберіть громадське місце: кафе, ресторан або парк\n• Повідомте другу або члену сім'ї, куди ви йдете\n• Поділіться своїм місцезнаходженням з кимось, кому довіряєте\n• Організуйте власний транспорт\n• Залишайтеся тверезими та уважними\n• Довіряйте інтуїції — якщо щось не так, йдіть"
        },
        protectInfo: {
          title: "Захистіть свою інформацію",
          description: "Зберігайте особисті дані в таємниці, поки не встановите довіру",
          expanded: "Захистіть себе в інтернеті:\n\n• Не повідомляйте домашню адресу, місце роботи або фінансову інформацію\n• Будьте обережні при наданні номера телефону\n• Уникайте раннього розкриття ідентифікуючих даних\n• Використовуйте вбудовані повідомлення Accord, поки не відчуєте себе комфортно\n• Ніколи не надсилайте гроші тому, з ким не зустрічалися\n• Остерігайтеся тих, хто просить фінансову допомогу"
        },
        verifyIdentity: {
          title: "Перевірка особи",
          description: "Використовуйте відеодзвінки перед особистою зустріччю",
          expanded: "Переконайтеся, що спілкуєтеся з реальною людиною:\n\n• Попросіть відеодзвінок перед зустріччю\n• Шукайте верифіковані профілі (синя галочка)\n• Будьте обережні з профілями, що мають лише одне фото\n• Звертайте увагу на невідповідності в їхній розповіді\n• Виконайте зворотний пошук зображення при підозрі\n• Негайно повідомляйте про фальшиві або підозрілі профілі"
        },
        lgbtqSafety: {
          title: "Безпека ЛГБТК+",
          description: "Особливі міркування безпеки для нашої спільноти",
          expanded: "Безпека як ЛГБТК+ людини:\n\n• Будьте вибірковими, кому розповідаєте про свою домовленість\n• Ретельно обміркуйте налаштування конфіденційності\n• Враховуйте місцеві закони та ставлення суспільства\n• Майте план відступу, якщо відчуєте себе небезпечно\n• Зв'яжіться з ЛГБТК+ ресурсами у вашому регіоні\n• Довіряйте спільноті — ми тут, щоб підтримувати одне одного"
        },
        legalProtection: {
          title: "Правовий захист",
          description: "Розгляньте формальні угоди для лавандових шлюбів",
          expanded: "Захистіть себе юридично:\n\n• Проконсультуйтеся з ЛГБТК+-дружнім сімейним адвокатом\n• Розгляньте шлюбний контракт\n• Задокументуйте вашу домовленість у письмовій формі\n• Розберіться з імміграційними наслідками, якщо це стосується\n• Знайте свої права щодо власності та фінансів\n• Зберігайте угоди конфіденційно та безпечно"
        },
        mentalHealth: {
          title: "Психічне здоров'я",
          description: "Дбайте про своє емоційне благополуччя",
          expanded: "Пріоритизуйте психічне здоров'я:\n\n• Встановіть чіткі межі та очікування\n• Спілкуйтеся відкрито та чесно\n• Зверніться до терапевта або консультанта за потреби\n• Зв'яжіться з групами підтримки ЛГБТК+\n• Пам'ятайте, що ви заслуговуєте поваги та доброти\n• Робіть перерви від додатку, коли потрібно"
        },
        reportBlock: {
          title: "Повідомити та заблокувати",
          description: "Використовуйте наші інструменти безпеки для самозахисту",
          expanded: "Будьте в безпеці на Accord:\n\n• Блокуйте користувачів, які викликають дискомфорт\n• Повідомляйте про домагання, погрози або підозрілу поведінку\n• Ми розглядаємо всі скарги протягом 24 годин\n• Ваші скарги анонімні\n• Серйозні порушення призводять до видалення акаунту\n• Зв'яжіться з нами напряму з терміновими питаннями безпеки"
        }
      },
      resources: {
        trevor: { name: "The Trevor Project", description: "Кризова підтримка 24/7 для ЛГБТК+ молоді" },
        transLifeline: { name: "Trans Lifeline", description: "Підтримка трансгендерних людей" },
        glbtHotline: { name: "Національна гаряча лінія ЛГБТ", description: "Підтримка однолітків та місцеві ресурси" },
        rainn: { name: "RAINN", description: "Допомога при сексуальному насильстві" }
      }
    }
  },
  ur: {
    safetyCenter: {
      title: "سیفٹی سینٹر",
      subtitle: "ایکارڈ پر محفوظ رہیں",
      safetyTipsTitle: "حفاظتی تجاویز",
      crisisResourcesTitle: "بحرانی وسائل",
      crisisResourcesDescription: "اگر آپ یا آپ کا کوئی جاننے والا خطرے میں ہے تو براہ کرم ان وسائل سے رابطہ کریں۔",
      visitWebsite: "ویب سائٹ دیکھیں",
      quickActionsTitle: "فوری اقدامات",
      footerText: "آپ کی حفاظت ہماری اولین ترجیح ہے۔ اگر آپ کبھی غیر محفوظ محسوس کریں تو ہم سے یا اوپر دیے گئے وسائل سے رابطہ کرنے میں ہچکچاہٹ محسوس نہ کریں۔",
      alerts: {
        callTitle: "{{name}} کو کال کریں",
        callMessage: "کیا آپ {{phone}} پر کال کرنا چاہتے ہیں؟",
        call: "کال کریں",
        emailUs: "ہمیں hello@joinaccord.app پر ای میل کریں"
      },
      actions: {
        blockedUsers: "بلاک شدہ صارفین",
        blockedUsersDesc: "اپنی بلاک فہرست کا انتظام کریں",
        privacySettings: "رازداری کی ترتیبات",
        privacySettingsDesc: "اپنی رازداری اور مرئیت کو کنٹرول کریں",
        contactSupport: "سپورٹ سے رابطہ",
        contactSupportDesc: "ہماری ٹیم کو حفاظتی خدشات کی اطلاع دیں"
      },
      tips: {
        meetSafely: {
          title: "محفوظ طریقے سے ملیں",
          description: "پہلی چند ملاقاتوں میں ہمیشہ عوامی مقامات پر ملیں",
          expanded: "پہلی بار کسی سے ملتے وقت:\n\n• عوامی مقام جیسے کیفے، ریستوراں یا پارک کا انتخاب کریں\n• کسی دوست یا خاندان کے فرد کو بتائیں کہ آپ کہاں جا رہے ہیں\n• اپنا مقام کسی قابل اعتماد شخص کے ساتھ شیئر کریں\n• اپنی نقل و حمل کا خود انتظام کریں\n• ہوشیار اور چوکنا رہیں\n• اپنی فطرت پر بھروسہ کریں - اگر کچھ غلط لگے تو چلے جائیں"
        },
        protectInfo: {
          title: "اپنی معلومات کی حفاظت کریں",
          description: "اعتماد قائم ہونے تک ذاتی تفصیلات نجی رکھیں",
          expanded: "آن لائن اپنی حفاظت کریں:\n\n• گھر کا پتہ، کام کی جگہ یا مالی معلومات شیئر نہ کریں\n• فون نمبر شیئر کرتے وقت محتاط رہیں\n• شناختی تفصیلات جلد شیئر کرنے سے گریز کریں\n• آرام دہ محسوس ہونے تک ایکارڈ کی ان-ایپ میسجنگ استعمال کریں\n• جس سے نہیں ملے اسے کبھی پیسے نہ بھیجیں\n• مالی مدد مانگنے والوں سے محتاط رہیں"
        },
        verifyIdentity: {
          title: "شناخت کی تصدیق",
          description: "ذاتی طور پر ملنے سے پہلے ویڈیو کال استعمال کریں",
          expanded: "تصدیق کریں کہ آپ ایک حقیقی شخص سے بات کر رہے ہیں:\n\n• ملنے سے پہلے ویڈیو کال کی درخواست کریں\n• تصدیق شدہ پروفائلز تلاش کریں (نیلا نشان)\n• صرف ایک تصویر والے پروفائلز سے محتاط رہیں\n• ان کی کہانی میں تضادات پر نظر رکھیں\n• شک ہو تو ریورس امیج سرچ کریں\n• جعلی یا مشکوک پروفائلز کی فوری اطلاع دیں"
        },
        lgbtqSafety: {
          title: "LGBTQ+ حفاظت",
          description: "ہماری کمیونٹی کے لیے مخصوص حفاظتی تحفظات",
          expanded: "LGBTQ+ فرد کے طور پر محفوظ رہنا:\n\n• منتخب رہیں کہ کون آپ کے انتظام کے بارے میں جانتا ہے\n• رازداری کی ترتیبات پر احتیاط سے غور کریں\n• مقامی قوانین اور رویوں سے آگاہ رہیں\n• اگر غیر محفوظ محسوس ہو تو نکلنے کی حکمت عملی رکھیں\n• اپنے علاقے میں LGBTQ+ وسائل سے جڑیں\n• اپنی کمیونٹی پر بھروسہ کریں - ہم ایک دوسرے کی مدد کے لیے یہاں ہیں"
        },
        legalProtection: {
          title: "قانونی تحفظ",
          description: "لیونڈر شادیوں کے لیے باضابطہ معاہدوں پر غور کریں",
          expanded: "قانونی طور پر اپنی حفاظت کریں:\n\n• LGBTQ+ دوست خاندانی وکیل سے مشورہ کریں\n• شادی سے پہلے کے معاہدے پر غور کریں\n• اپنے انتظام کو تحریری طور پر دستاویز کریں\n• اگر لاگو ہو تو امیگریشن کے مضمرات کو سمجھیں\n• جائیداد اور مالیات کے بارے میں اپنے حقوق جانیں\n• معاہدوں کو خفیہ اور محفوظ رکھیں"
        },
        mentalHealth: {
          title: "ذہنی صحت",
          description: "اپنی جذباتی صحت کا خیال رکھیں",
          expanded: "اپنی ذہنی صحت کو ترجیح دیں:\n\n• واضح حدود اور توقعات مقرر کریں\n• کھل کر اور ایمانداری سے بات چیت کریں\n• ضرورت پڑنے پر تھراپی یا مشاورت حاصل کریں\n• LGBTQ+ سپورٹ گروپس سے جڑیں\n• یاد رکھیں کہ آپ عزت اور مہربانی کے مستحق ہیں\n• ضرورت پڑنے پر ایپ سے وقفہ لیں"
        },
        reportBlock: {
          title: "رپورٹ اور بلاک",
          description: "اپنی حفاظت کے لیے ہمارے حفاظتی ٹولز استعمال کریں",
          expanded: "ایکارڈ پر محفوظ رہیں:\n\n• آپ کو تکلیف دینے والے صارفین کو بلاک کریں\n• ایذا رسانی، دھمکیوں یا مشکوک رویے کی اطلاع دیں\n• ہم 24 گھنٹوں میں تمام رپورٹس کا جائزہ لیتے ہیں\n• آپ کی رپورٹس گمنام ہیں\n• سنگین خلاف ورزیوں کا نتیجہ اکاؤنٹ بند ہونا ہے\n• فوری حفاظتی خدشات کے لیے براہ راست ہم سے رابطہ کریں"
        }
      },
      resources: {
        trevor: { name: "دی ٹریور پروجیکٹ", description: "LGBTQ+ نوجوانوں کے لیے 24/7 بحرانی مدد" },
        transLifeline: { name: "ٹرانس لائف لائن", description: "ٹرانسجینڈر افراد کے لیے مدد" },
        glbtHotline: { name: "LGBT قومی ہاٹ لائن", description: "ساتھیوں کی مدد اور مقامی وسائل" },
        rainn: { name: "RAINN", description: "جنسی حملے کی مدد" }
      }
    }
  },
  zh: {
    safetyCenter: {
      title: "安全中心",
      subtitle: "在Accord上保持安全",
      safetyTipsTitle: "安全提示",
      crisisResourcesTitle: "危机资源",
      crisisResourcesDescription: "如果您或您认识的人处于危险中，请联系这些资源。",
      visitWebsite: "访问网站",
      quickActionsTitle: "快捷操作",
      footerText: "您的安全是我们的首要任务。如果您感到不安全，请随时联系我们或上述资源。",
      alerts: {
        callTitle: "拨打{{name}}",
        callMessage: "您要拨打{{phone}}吗？",
        call: "拨打",
        emailUs: "发邮件至 hello@joinaccord.app"
      },
      actions: {
        blockedUsers: "已屏蔽用户",
        blockedUsersDesc: "管理您的屏蔽列表",
        privacySettings: "隐私设置",
        privacySettingsDesc: "控制您的隐私和可见性",
        contactSupport: "联系客服",
        contactSupportDesc: "向我们的团队报告安全问题"
      },
      tips: {
        meetSafely: {
          title: "安全见面",
          description: "前几次约会务必在公共场所见面",
          expanded: "第一次见面时：\n\n• 选择咖啡馆、餐厅或公园等公共场所\n• 告诉朋友或家人你要去哪里\n• 与信任的人分享你的位置\n• 自行安排交通\n• 保持清醒和警觉\n• 相信你的直觉——如果感觉不对，就离开"
        },
        protectInfo: {
          title: "保护您的信息",
          description: "在建立信任之前保持个人信息私密",
          expanded: "在线保护自己：\n\n• 不要分享家庭地址、工作地点或财务信息\n• 分享电话号码时要谨慎\n• 避免过早分享身份信息\n• 在感到舒适之前使用Accord的应用内消息\n• 永远不要给未见过面的人汇款\n• 警惕任何要求经济帮助的人"
        },
        verifyIdentity: {
          title: "验证身份",
          description: "在见面之前使用视频通话",
          expanded: "确认您在与真实的人交谈：\n\n• 见面前要求视频通话\n• 寻找已验证的个人资料（蓝色勾号）\n• 对只有一张照片的个人资料保持警惕\n• 注意他们故事中的不一致之处\n• 如有怀疑进行反向图片搜索\n• 立即举报虚假或可疑的个人资料"
        },
        lgbtqSafety: {
          title: "LGBTQ+安全",
          description: "我们社区的特定安全考虑",
          expanded: "作为LGBTQ+人士保持安全：\n\n• 谨慎选择谁知道你的安排\n• 仔细考虑隐私设置\n• 了解当地法律和态度\n• 如果感到不安全，准备好退出策略\n• 与所在地区的LGBTQ+资源联系\n• 信任你的社区——我们在这里互相支持"
        },
        legalProtection: {
          title: "法律保护",
          description: "考虑为薰衣草婚姻签订正式协议",
          expanded: "从法律上保护自己：\n\n• 咨询对LGBTQ+友好的家庭律师\n• 考虑婚前协议\n• 以书面形式记录您的安排\n• 了解移民方面的影响（如适用）\n• 了解您在财产和财务方面的权利\n• 保持协议的保密和安全"
        },
        mentalHealth: {
          title: "心理健康",
          description: "关注您的情感健康",
          expanded: "优先考虑心理健康：\n\n• 设定明确的界限和期望\n• 坦诚沟通\n• 需要时寻求治疗或咨询\n• 与LGBTQ+支持小组联系\n• 记住你值得被尊重和善待\n• 需要时从应用中休息一下"
        },
        reportBlock: {
          title: "举报与屏蔽",
          description: "使用我们的安全工具保护自己",
          expanded: "在Accord上保持安全：\n\n• 屏蔽让您不舒服的用户\n• 举报骚扰、威胁或可疑行为\n• 我们在24小时内审查所有举报\n• 您的举报是匿名的\n• 严重违规将导致账号终止\n• 如有紧急安全问题请直接联系我们"
        }
      },
      resources: {
        trevor: { name: "特雷弗项目", description: "LGBTQ+青少年24/7危机支持" },
        transLifeline: { name: "跨性别生命线", description: "跨性别人士支持" },
        glbtHotline: { name: "LGBT全国热线", description: "同伴支持和本地资源" },
        rainn: { name: "RAINN", description: "性侵支持" }
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

console.log('Done! Added safetyCenter to 6 locales (batch 3)');
