const fs = require('fs');
const path = require('path');
function deepMerge(t, s) { for (const k of Object.keys(s)) { if (s[k] && typeof s[k]==='object' && !Array.isArray(s[k])) { if (!t[k]) t[k]={}; deepMerge(t[k],s[k]); } else { t[k]=s[k]; } } return t; }

const T = {
  tr: {
    chat: { blockedConfirmation: "{{name}} adlı kişiyi engellediniz" },
    moderation: {
      menu: { reportUser: "Kullanıcıyı Bildir", unmatch: "Eşleşmeyi İptal Et", blockUser: "Kullanıcıyı Engelle" },
      report: {
        title: "{{name}} Adlı Kişiyi Bildir", subtitle: "Bu kullanıcıyı bildirme nedeninizi seçin:",
        reasons: { blackmail: "Şantaj / Ekran Görüntüsü Paylaşımı", blackmailDescription: "Birisi filigranı olan profil ekran görüntünüzü paylaştı", inappropriateContent: "Uygunsuz İçerik", inappropriateContentDescription: "Fotoğraflar, biyografi veya mesajlar uygunsuz içerik barındırıyor", harassment: "Taciz", harassmentDescription: "Tehdit edici, taciz edici veya zorba davranış", fakeProfile: "Sahte Profil", fakeProfileDescription: "Profil sahte görünüyor veya başka birinin kimliğine bürünüyor", scam: "Dolandırıcılık", scamDescription: "Para istiyor veya dolandırıcılık gibi görünüyor", spam: "Spam", spamDescription: "Spam veya tanıtım mesajları gönderiyor", underage: "Reşit Olmayan Kullanıcı", underageDescription: "Kullanıcı 18 yaşından küçük görünüyor", hateSpeech: "Nefret Söylemi", hateSpeechDescription: "Ayrımcı veya nefret dolu dil", other: "Diğer", otherDescription: "Yukarıda listelenmeyen başka bir neden" },
        evidencePhotos: "Kanıt Fotoğrafları", upload: "Yükle", evidenceInfo: "Profilinizi filigranla gösteren ekran görüntüleri yükleyin.",
        explainWhy: "Bildirme nedeninizi açıklayın", explainHint: "Kurallarımızı ihlal eden belirli davranış veya içeriği açıklayın.", explainPlaceholder: "Bu kullanıcı ne yaptı? Ayrıntılı olun...",
        charsNeeded: "{{count}} karakter daha gerekli", charsCount: "{{count}}/500", privacyNotice: "Bildiriminiz anonimdir. Bildirilen kullanıcı bilgilendirilmeyecektir.", submitReport: "Bildirimi Gönder",
        permissionRequired: "İzin Gerekli", permissionMessage: "Kanıt yüklemek için fotoğraf kitaplığına erişim izni verin.", uploadFailed: "Yükleme Başarısız", uploadFailedMessage: "Bir veya daha fazla fotoğraf yüklenemedi. Tekrar deneyin.", selectPhotoError: "Fotoğraflar seçilemedi. Tekrar deneyin.", selectReasonError: "Bildirme için bir neden seçin",
        explanationRequired: "Açıklama Gerekli", explanationRequiredMessage: "Ayrıntılı bir açıklama girin (en az 20 karakter).", evidenceRequired: "Kanıt Gerekli", evidenceRequiredMessage: "Şantaj bildirimleri ekran görüntüsü kanıtı gerektirir.", mustBeLoggedIn: "Kullanıcı bildirmek için giriş yapmalısınız",
        submitted: "Bildirim Gönderildi", submittedMessage: "Accord'u güvende tutmaya yardımcı olduğunuz için teşekkürler. Ekibimiz bu bildirimi inceleyecektir.", submitError: "Bildirim gönderilemedi. Tekrar deneyin."
      },
      reportAlt: {
        title: "{{name}} Adlı Kişiyi Bildir", subtitle: "Accord'u güvende tutmamıza yardım edin", whyReporting: "Bu profili neden bildiriyorsunuz?", provideDetails: "Ayrıntıları belirtin", detailsPlaceholder: "Ne olduğunu anlamamıza yardımcı olun (en az 10 karakter)", evidenceInfo: "Profilinizi filigranla gösteren ekran görüntüleri yükleyin.", evidenceRequiredMessage: "Şantaj bildirimleri ekran görüntüsü kanıtı gerektirir.", infoNotice: "Bildirimler ekibimiz tarafından incelenir. Yanlış bildirimler hesap askıya alınmasıyla sonuçlanabilir.",
        reasons: { blackmail: "Şantaj / Ekran görüntüsü paylaşımı", harassment: "Taciz veya zorbalık", fakeProfile: "Sahte profil veya dolandırıcılık", inappropriateContent: "Uygunsuz fotoğraf veya mesajlar", spam: "Spam veya istenmeyen iletişim", underage: "Reşit olmayan kullanıcı", safetyConcern: "Güvenlik endişesi", other: "Diğer" }
      },
      block: {
        title: "{{name}} engellensin mi?", description: "Bu kullanıcıyı engellemek:", hideProfile: "Profilinizi onlardan gizler", preventMessages: "Size mesaj göndermelerini engeller", deleteMessages: "Tüm mesajları kalıcı olarak siler (geri alınamaz)", noNotification: "Bilgilendirilmeyecekler", unblockNote: "Daha sonra Ayarlar → Engellenen Kullanıcılar'dan engeli kaldırabilirsiniz",
        blockUser: "Kullanıcıyı Engelle", alreadyBlocked: "Zaten Engellendi", alreadyBlockedMessage: "Bu kullanıcıyı zaten engellediniz.", userBlocked: "Kullanıcı Engellendi", userBlockedMessage: "{{name}} engellendi. Konuşmanız kalıcı olarak silindi ve artık profilinizi göremezler.", mustBeLoggedIn: "Kullanıcı engellemek için giriş yapmalısınız", error: "Kullanıcı engellenemedi. Tekrar deneyin."
      },
      blockAlt: { title: "{{name}} engellensin mi?", description: "{{name}} engellemek:", removeMatches: "Eşleşmelerinizden kaldırır", hideProfile: "Profilinizi onlardan gizler", preventMatching: "Gelecek eşleşmeleri engeller", deleteMessages: "Tüm mesajları kalıcı olarak siler (geri alınamaz)", block: "Engelle" },
      unmatch: { title: "{{name}} ile eşleşme iptal edilsin mi?", description: "Bu, {{name}} ile konuşmanızı sonlandıracaktır. Keşifte tekrar karşılaşabilirsiniz.", privacy: "{{name}} eşleşme iptali hakkında bilgilendirilmeyecek", button: "Eşleşmeyi İptal Et", needToBlock: "Engellemek mi istiyorsunuz?", successTitle: "Eşleşme İptal Edildi", successMessage: "{{name}} ile eşleşmeyi iptal ettiniz", errorMessage: "Eşleşme iptal edilemedi. Tekrar deneyin." }
    }
  },
  uk: {
    chat: { blockedConfirmation: "Ви заблокували {{name}}" },
    moderation: {
      menu: { reportUser: "Поскаржитись", unmatch: "Скасувати збіг", blockUser: "Заблокувати" },
      report: {
        title: "Поскаржитись на {{name}}", subtitle: "Оберіть причину скарги:",
        reasons: { blackmail: "Шантаж / Поширення скріншотів", blackmailDescription: "Хтось поширив скріншот вашого профілю з водяним знаком", inappropriateContent: "Неприйнятний вміст", inappropriateContentDescription: "Фото, біографія або повідомлення містять неприйнятний вміст", harassment: "Переслідування", harassmentDescription: "Загрозливе, переслідувальне або залякувальне поводження", fakeProfile: "Фейковий профіль", fakeProfileDescription: "Профіль виглядає фейковим або видає себе за іншого", scam: "Шахрайство", scamDescription: "Просить гроші або схоже на шахрайство", spam: "Спам", spamDescription: "Надсилання спаму або рекламних повідомлень", underage: "Неповнолітній", underageDescription: "Користувач виглядає молодшим за 18 років", hateSpeech: "Мова ворожнечі", hateSpeechDescription: "Дискримінаційна або ненависницька мова", other: "Інше", otherDescription: "Інша причина, не зазначена вище" },
        evidencePhotos: "Фото-докази", upload: "Завантажити", evidenceInfo: "Завантажте скріншоти, що показують ваш профіль з видимим водяним знаком.",
        explainWhy: "Поясніть причину скарги", explainHint: "Опишіть конкретну поведінку або вміст, що порушує наші правила.", explainPlaceholder: "Що зробив цей користувач? Будьте конкретними...",
        charsNeeded: "Потрібно ще {{count}} символів", charsCount: "{{count}}/500", privacyNotice: "Ваша скарга анонімна. Користувач не буде повідомлений.", submitReport: "Надіслати скаргу",
        permissionRequired: "Потрібен дозвіл", permissionMessage: "Дозвольте доступ до фотобібліотеки для завантаження доказів.", uploadFailed: "Помилка завантаження", uploadFailedMessage: "Не вдалося завантажити одне або кілька фото. Спробуйте знову.", selectPhotoError: "Не вдалося вибрати фото. Спробуйте знову.", selectReasonError: "Оберіть причину скарги",
        explanationRequired: "Потрібне пояснення", explanationRequiredMessage: "Надайте детальне пояснення (мінімум 20 символів).", evidenceRequired: "Потрібні докази", evidenceRequiredMessage: "Скарги на шантаж потребують скріншотів як доказів.", mustBeLoggedIn: "Увійдіть, щоб поскаржитись",
        submitted: "Скаргу надіслано", submittedMessage: "Дякуємо за допомогу у забезпеченні безпеки Accord. Наша команда розгляне цю скаргу.", submitError: "Не вдалося надіслати скаргу. Спробуйте знову."
      },
      reportAlt: {
        title: "Поскаржитись на {{name}}", subtitle: "Допоможіть нам зберегти Accord безпечним", whyReporting: "Чому ви скаржитесь на цей профіль?", provideDetails: "Надайте деталі", detailsPlaceholder: "Допоможіть нам зрозуміти, що сталося (мінімум 10 символів)", evidenceInfo: "Завантажте скріншоти з водяним знаком.", evidenceRequiredMessage: "Скарги на шантаж потребують скріншотів.", infoNotice: "Скарги розглядаються нашою командою. Неправдиві скарги можуть призвести до блокування акаунту.",
        reasons: { blackmail: "Шантаж / Поширення скріншотів", harassment: "Переслідування або цькування", fakeProfile: "Фейковий профіль або шахрайство", inappropriateContent: "Неприйнятні фото або повідомлення", spam: "Спам або нав'язування", underage: "Неповнолітній", safetyConcern: "Проблема безпеки", other: "Інше" }
      },
      block: {
        title: "Заблокувати {{name}}?", description: "Блокування цього користувача:", hideProfile: "Сховає ваш профіль від нього", preventMessages: "Заборонить надсилати вам повідомлення", deleteMessages: "Назавжди видалить всі повідомлення (не можна скасувати)", noNotification: "Він не буде повідомлений", unblockNote: "Розблокувати можна пізніше в Налаштування → Заблоковані",
        blockUser: "Заблокувати", alreadyBlocked: "Вже заблокований", alreadyBlockedMessage: "Ви вже заблокували цього користувача.", userBlocked: "Користувача заблоковано", userBlockedMessage: "{{name}} заблоковано. Ваше листування назавжди видалено, і він більше не може бачити ваш профіль.", mustBeLoggedIn: "Увійдіть, щоб заблокувати", error: "Не вдалося заблокувати. Спробуйте знову."
      },
      blockAlt: { title: "Заблокувати {{name}}?", description: "Блокування {{name}}:", removeMatches: "Видалить з ваших збігів", hideProfile: "Сховає ваш профіль", preventMatching: "Запобіжить майбутнім збігам", deleteMessages: "Назавжди видалить всі повідомлення (не можна скасувати)", block: "Заблокувати" },
      unmatch: { title: "Скасувати збіг з {{name}}?", description: "Це завершить ваше листування з {{name}}. Ви можете знову зустрітися в пошуку.", privacy: "{{name}} не буде повідомлений про скасування", button: "Скасувати збіг", needToBlock: "Потрібно заблокувати?", successTitle: "Збіг скасовано", successMessage: "Ви скасували збіг з {{name}}", errorMessage: "Не вдалося скасувати збіг. Спробуйте знову." }
    }
  },
  pl: {
    chat: { blockedConfirmation: "Zablokowałeś/aś {{name}}" },
    moderation: {
      menu: { reportUser: "Zgłoś użytkownika", unmatch: "Cofnij dopasowanie", blockUser: "Zablokuj użytkownika" },
      report: {
        title: "Zgłoś {{name}}", subtitle: "Wybierz powód zgłoszenia tego użytkownika:",
        reasons: { blackmail: "Szantaż / Udostępnianie zrzutów ekranu", blackmailDescription: "Ktoś udostępnił zrzut ekranu twojego profilu ze znakiem wodnym", inappropriateContent: "Nieodpowiednia treść", inappropriateContentDescription: "Zdjęcia, bio lub wiadomości zawierają nieodpowiednie treści", harassment: "Nękanie", harassmentDescription: "Grożenie, nękanie lub zastraszanie", fakeProfile: "Fałszywy profil", fakeProfileDescription: "Profil wydaje się fałszywy lub podszywa się pod kogoś", scam: "Oszustwo", scamDescription: "Prosi o pieniądze lub wygląda na oszustwo", spam: "Spam", spamDescription: "Wysyłanie spamu lub wiadomości promocyjnych", underage: "Nieletni użytkownik", underageDescription: "Użytkownik wydaje się mieć mniej niż 18 lat", hateSpeech: "Mowa nienawiści", hateSpeechDescription: "Dyskryminujący lub nienawistny język", other: "Inne", otherDescription: "Inny powód niewymieniony powyżej" },
        evidencePhotos: "Zdjęcia dowodowe", upload: "Prześlij", evidenceInfo: "Prześlij zrzuty ekranu pokazujące twój profil z widocznym znakiem wodnym.",
        explainWhy: "Wyjaśnij powód zgłoszenia", explainHint: "Opisz konkretne zachowanie lub treść naruszającą nasze zasady.", explainPlaceholder: "Co zrobił ten użytkownik? Bądź konkretny...",
        charsNeeded: "Potrzeba jeszcze {{count}} znaków", charsCount: "{{count}}/500", privacyNotice: "Twoje zgłoszenie jest anonimowe. Zgłoszony użytkownik nie zostanie powiadomiony.", submitReport: "Wyślij zgłoszenie",
        permissionRequired: "Wymagane pozwolenie", permissionMessage: "Zezwól na dostęp do biblioteki zdjęć, aby przesłać dowody.", uploadFailed: "Przesyłanie nie powiodło się", uploadFailedMessage: "Nie udało się przesłać jednego lub więcej zdjęć. Spróbuj ponownie.", selectPhotoError: "Nie udało się wybrać zdjęć. Spróbuj ponownie.", selectReasonError: "Wybierz powód zgłoszenia",
        explanationRequired: "Wymagane wyjaśnienie", explanationRequiredMessage: "Podaj szczegółowe wyjaśnienie (co najmniej 20 znaków).", evidenceRequired: "Wymagane dowody", evidenceRequiredMessage: "Zgłoszenia szantażu wymagają dowodów w postaci zrzutów ekranu.", mustBeLoggedIn: "Musisz być zalogowany, aby zgłosić użytkownika",
        submitted: "Zgłoszenie wysłane", submittedMessage: "Dziękujemy za pomoc w utrzymaniu bezpieczeństwa Accord. Nasz zespół sprawdzi to zgłoszenie.", submitError: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie."
      },
      reportAlt: {
        title: "Zgłoś {{name}}", subtitle: "Pomóż nam utrzymać Accord bezpiecznym", whyReporting: "Dlaczego zgłaszasz ten profil?", provideDetails: "Podaj szczegóły", detailsPlaceholder: "Pomóż nam zrozumieć, co się stało (minimum 10 znaków)", evidenceInfo: "Prześlij zrzuty ekranu ze znakiem wodnym.", evidenceRequiredMessage: "Zgłoszenia szantażu wymagają zrzutów ekranu.", infoNotice: "Zgłoszenia są sprawdzane przez nasz zespół. Fałszywe zgłoszenia mogą skutkować zawieszeniem konta.",
        reasons: { blackmail: "Szantaż / Udostępnianie zrzutów", harassment: "Nękanie lub zastraszanie", fakeProfile: "Fałszywy profil lub oszustwo", inappropriateContent: "Nieodpowiednie zdjęcia lub wiadomości", spam: "Spam lub nagabywanie", underage: "Nieletni użytkownik", safetyConcern: "Obawy dotyczące bezpieczeństwa", other: "Inne" }
      },
      block: {
        title: "Zablokować {{name}}?", description: "Zablokowanie tego użytkownika:", hideProfile: "Ukryje twój profil przed nim", preventMessages: "Uniemożliwi wysyłanie ci wiadomości", deleteMessages: "Trwale usunie wszystkie wiadomości (nie można cofnąć)", noNotification: "Nie zostanie powiadomiony", unblockNote: "Możesz odblokować później w Ustawienia → Zablokowani użytkownicy",
        blockUser: "Zablokuj użytkownika", alreadyBlocked: "Już zablokowany", alreadyBlockedMessage: "Już zablokowałeś tego użytkownika.", userBlocked: "Użytkownik zablokowany", userBlockedMessage: "{{name}} został zablokowany. Twoja rozmowa została trwale usunięta i nie mogą już widzieć twojego profilu.", mustBeLoggedIn: "Musisz być zalogowany, aby zablokować", error: "Nie udało się zablokować. Spróbuj ponownie."
      },
      blockAlt: { title: "Zablokować {{name}}?", description: "Zablokowanie {{name}}:", removeMatches: "Usunie z twoich dopasowań", hideProfile: "Ukryje twój profil", preventMatching: "Zapobiegnie przyszłym dopasowaniom", deleteMessages: "Trwale usunie wszystkie wiadomości (nie można cofnąć)", block: "Zablokuj" },
      unmatch: { title: "Cofnąć dopasowanie z {{name}}?", description: "To zakończy twoją rozmowę z {{name}}. Możecie się znowu zobaczyć w odkrywaniu.", privacy: "{{name}} nie zostanie powiadomiony o cofnięciu", button: "Cofnij dopasowanie", needToBlock: "Chcesz zablokować?", successTitle: "Dopasowanie cofnięte", successMessage: "Cofnąłeś dopasowanie z {{name}}", errorMessage: "Nie udało się cofnąć dopasowania. Spróbuj ponownie." }
    }
  },
  id: {
    chat: { blockedConfirmation: "Anda telah memblokir {{name}}" },
    moderation: {
      menu: { reportUser: "Laporkan Pengguna", unmatch: "Batalkan Kecocokan", blockUser: "Blokir Pengguna" },
      report: {
        title: "Laporkan {{name}}", subtitle: "Pilih alasan melaporkan pengguna ini:",
        reasons: { blackmail: "Pemerasan / Berbagi Tangkapan Layar", blackmailDescription: "Seseorang membagikan tangkapan layar profil Anda dengan watermark", inappropriateContent: "Konten Tidak Pantas", inappropriateContentDescription: "Foto, bio, atau pesan berisi konten tidak pantas", harassment: "Pelecehan", harassmentDescription: "Perilaku mengancam, melecehkan, atau mengintimidasi", fakeProfile: "Profil Palsu", fakeProfileDescription: "Profil tampak palsu atau meniru identitas orang lain", scam: "Penipuan", scamDescription: "Meminta uang atau tampak sebagai penipuan", spam: "Spam", spamDescription: "Mengirim pesan spam atau promosi", underage: "Pengguna Di Bawah Umur", underageDescription: "Pengguna tampak berusia di bawah 18 tahun", hateSpeech: "Ujaran Kebencian", hateSpeechDescription: "Bahasa diskriminatif atau penuh kebencian", other: "Lainnya", otherDescription: "Alasan lain yang tidak tercantum di atas" },
        evidencePhotos: "Foto Bukti", upload: "Unggah", evidenceInfo: "Unggah tangkapan layar yang menunjukkan profil Anda dengan watermark terlihat.",
        explainWhy: "Jelaskan alasan pelaporan", explainHint: "Jelaskan perilaku atau konten spesifik yang melanggar pedoman kami.", explainPlaceholder: "Apa yang dilakukan pengguna ini? Jelaskan secara spesifik...",
        charsNeeded: "Butuh {{count}} karakter lagi", charsCount: "{{count}}/500", privacyNotice: "Laporan Anda anonim. Pengguna yang dilaporkan tidak akan diberitahu.", submitReport: "Kirim Laporan",
        permissionRequired: "Izin Diperlukan", permissionMessage: "Izinkan akses ke perpustakaan foto untuk mengunggah bukti.", uploadFailed: "Gagal Mengunggah", uploadFailedMessage: "Gagal mengunggah satu atau lebih foto. Coba lagi.", selectPhotoError: "Gagal memilih foto. Coba lagi.", selectReasonError: "Pilih alasan pelaporan",
        explanationRequired: "Penjelasan Diperlukan", explanationRequiredMessage: "Berikan penjelasan detail (minimal 20 karakter).", evidenceRequired: "Bukti Diperlukan", evidenceRequiredMessage: "Laporan pemerasan memerlukan bukti tangkapan layar.", mustBeLoggedIn: "Anda harus masuk untuk melaporkan pengguna",
        submitted: "Laporan Terkirim", submittedMessage: "Terima kasih telah membantu menjaga Accord tetap aman. Tim kami akan meninjau laporan ini.", submitError: "Gagal mengirim laporan. Coba lagi."
      },
      reportAlt: {
        title: "Laporkan {{name}}", subtitle: "Bantu kami menjaga Accord tetap aman", whyReporting: "Mengapa Anda melaporkan profil ini?", provideDetails: "Berikan detail", detailsPlaceholder: "Bantu kami memahami apa yang terjadi (minimal 10 karakter)", evidenceInfo: "Unggah tangkapan layar dengan watermark.", evidenceRequiredMessage: "Laporan pemerasan memerlukan bukti tangkapan layar.", infoNotice: "Laporan ditinjau oleh tim kami. Laporan palsu dapat mengakibatkan penangguhan akun.",
        reasons: { blackmail: "Pemerasan / Berbagi tangkapan layar", harassment: "Pelecehan atau intimidasi", fakeProfile: "Profil palsu atau penipuan", inappropriateContent: "Foto atau pesan tidak pantas", spam: "Spam atau ajakan", underage: "Pengguna di bawah umur", safetyConcern: "Masalah keamanan", other: "Lainnya" }
      },
      block: {
        title: "Blokir {{name}}?", description: "Memblokir pengguna ini akan:", hideProfile: "Menyembunyikan profil Anda dari mereka", preventMessages: "Mencegah mereka mengirim pesan", deleteMessages: "Menghapus semua pesan secara permanen (tidak dapat dibatalkan)", noNotification: "Mereka tidak akan diberitahu", unblockNote: "Anda dapat membuka blokir nanti di Pengaturan → Pengguna Diblokir",
        blockUser: "Blokir Pengguna", alreadyBlocked: "Sudah Diblokir", alreadyBlockedMessage: "Anda sudah memblokir pengguna ini.", userBlocked: "Pengguna Diblokir", userBlockedMessage: "{{name}} telah diblokir. Percakapan Anda telah dihapus secara permanen dan mereka tidak dapat melihat profil Anda lagi.", mustBeLoggedIn: "Anda harus masuk untuk memblokir pengguna", error: "Gagal memblokir pengguna. Coba lagi."
      },
      blockAlt: { title: "Blokir {{name}}?", description: "Memblokir {{name}} akan:", removeMatches: "Menghapus dari kecocokan Anda", hideProfile: "Menyembunyikan profil Anda", preventMatching: "Mencegah kecocokan di masa depan", deleteMessages: "Menghapus semua pesan secara permanen (tidak dapat dibatalkan)", block: "Blokir" },
      unmatch: { title: "Batalkan kecocokan dengan {{name}}?", description: "Ini akan mengakhiri percakapan Anda dengan {{name}}. Anda mungkin saling melihat lagi di penemuan.", privacy: "{{name}} tidak akan diberitahu tentang pembatalan", button: "Batalkan Kecocokan", needToBlock: "Perlu memblokir?", successTitle: "Kecocokan Dibatalkan", successMessage: "Anda telah membatalkan kecocokan dengan {{name}}", errorMessage: "Gagal membatalkan kecocokan. Coba lagi." }
    }
  },
  ka: {
    chat: { blockedConfirmation: "თქვენ დაბლოკეთ {{name}}" },
    moderation: {
      menu: { reportUser: "მომხმარებლის შეტყობინება", unmatch: "შესაბამისობის გაუქმება", blockUser: "მომხმარებლის დაბლოკვა" },
      report: {
        title: "{{name}}-ს შეტყობინება", subtitle: "აირჩიეთ ამ მომხმარებლის შეტყობინების მიზეზი:",
        reasons: { blackmail: "შანტაჟი / სკრინშოტის გაზიარება", blackmailDescription: "ვიღაცამ გააზიარა თქვენი პროფილის სკრინშოტი წყლის ნიშნით", inappropriateContent: "შეუსაბამო კონტენტი", inappropriateContentDescription: "ფოტოები, ბიო ან შეტყობინებები შეიცავს შეუსაბამო კონტენტს", harassment: "შევიწროება", harassmentDescription: "მუქარის, შევიწროების ან ბულინგის ქცევა", fakeProfile: "ყალბი პროფილი", fakeProfileDescription: "პროფილი ყალბი ჩანს ან ვიღაცას ასახავს", scam: "თაღლითობა", scamDescription: "ფულს ითხოვს ან თაღლითობას ჰგავს", spam: "სპამი", spamDescription: "სპამის ან სარეკლამო შეტყობინებების გაგზავნა", underage: "არასრულწლოვანი", underageDescription: "მომხმარებელი 18 წლამდე ჩანს", hateSpeech: "სიძულვილის ენა", hateSpeechDescription: "დისკრიმინაციული ან სიძულვილით სავსე ენა", other: "სხვა", otherDescription: "სხვა მიზეზი, რომელიც ზემოთ არ არის მითითებული" },
        evidencePhotos: "მტკიცებულების ფოტოები", upload: "ატვირთვა", evidenceInfo: "ატვირთეთ სკრინშოტები, რომლებიც აჩვენებს თქვენს პროფილს წყლის ნიშნით.",
        explainWhy: "ახსენით შეტყობინების მიზეზი", explainHint: "აღწერეთ კონკრეტული ქცევა ან კონტენტი, რომელიც არღვევს ჩვენს წესებს.", explainPlaceholder: "რა გააკეთა ამ მომხმარებელმა? იყავით კონკრეტული...",
        charsNeeded: "კიდევ {{count}} სიმბოლო საჭიროა", charsCount: "{{count}}/500", privacyNotice: "თქვენი შეტყობინება ანონიმურია. შეტყობინებული მომხმარებელი არ იქნება ინფორმირებული.", submitReport: "შეტყობინების გაგზავნა",
        permissionRequired: "ნებართვა საჭიროა", permissionMessage: "მტკიცებულების ასატვირთად დაუშვით ფოტო ბიბლიოთეკაზე წვდომა.", uploadFailed: "ატვირთვა ვერ მოხერხდა", uploadFailedMessage: "ერთი ან მეტი ფოტოს ატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.", selectPhotoError: "ფოტოების შერჩევა ვერ მოხერხდა. სცადეთ ხელახლა.", selectReasonError: "აირჩიეთ შეტყობინების მიზეზი",
        explanationRequired: "ახსნა საჭიროა", explanationRequiredMessage: "მიუთითეთ დეტალური ახსნა (მინიმუმ 20 სიმბოლო).", evidenceRequired: "მტკიცებულება საჭიროა", evidenceRequiredMessage: "შანტაჟის შეტყობინებები საჭიროებს სკრინშოტის მტკიცებულებას.", mustBeLoggedIn: "შესვლა საჭიროა მომხმარებლის შესატყობინებლად",
        submitted: "შეტყობინება გაიგზავნა", submittedMessage: "გმადლობთ Accord-ის უსაფრთხოების შენარჩუნებაში დახმარებისთვის. ჩვენი გუნდი განიხილავს ამ შეტყობინებას.", submitError: "შეტყობინების გაგზავნა ვერ მოხერხდა. სცადეთ ხელახლა."
      },
      reportAlt: {
        title: "{{name}}-ს შეტყობინება", subtitle: "დაგვეხმარეთ Accord-ის უსაფრთხოების შენარჩუნებაში", whyReporting: "რატომ აცხადებთ შეტყობინებას ამ პროფილზე?", provideDetails: "მიუთითეთ დეტალები", detailsPlaceholder: "დაგვეხმარეთ გავიგოთ რა მოხდა (მინიმუმ 10 სიმბოლო)", evidenceInfo: "ატვირთეთ სკრინშოტები წყლის ნიშნით.", evidenceRequiredMessage: "შანტაჟის შეტყობინებები საჭიროებს სკრინშოტის მტკიცებულებას.", infoNotice: "შეტყობინებებს ჩვენი გუნდი განიხილავს. ყალბმა შეტყობინებებმა შეიძლება გამოიწვიოს ანგარიშის შეჩერება.",
        reasons: { blackmail: "შანტაჟი / სკრინშოტის გაზიარება", harassment: "შევიწროება ან ბულინგი", fakeProfile: "ყალბი პროფილი ან თაღლითობა", inappropriateContent: "შეუსაბამო ფოტოები ან შეტყობინებები", spam: "სპამი ან მოთხოვნა", underage: "არასრულწლოვანი", safetyConcern: "უსაფრთხოების შეშფოთება", other: "სხვა" }
      },
      block: {
        title: "დაბლოკოთ {{name}}?", description: "ამ მომხმარებლის დაბლოკვა:", hideProfile: "დამალავს თქვენს პროფილს მისგან", preventMessages: "ხელს შეუშლის შეტყობინებების გაგზავნას", deleteMessages: "სამუდამოდ წაშლის ყველა შეტყობინებას (ვერ გააუქმებთ)", noNotification: "ის არ იქნება ინფორმირებული", unblockNote: "შეგიძლიათ მოგვიანებით განბლოკოთ პარამეტრები → დაბლოკილი მომხმარებლები",
        blockUser: "მომხმარებლის დაბლოკვა", alreadyBlocked: "უკვე დაბლოკილია", alreadyBlockedMessage: "თქვენ უკვე დაბლოკეთ ეს მომხმარებელი.", userBlocked: "მომხმარებელი დაბლოკილია", userBlockedMessage: "{{name}} დაბლოკილია. თქვენი საუბარი სამუდამოდ წაიშალა და ის ვეღარ ხედავს თქვენს პროფილს.", mustBeLoggedIn: "შესვლა საჭიროა დასაბლოკად", error: "დაბლოკვა ვერ მოხერხდა. სცადეთ ხელახლა."
      },
      blockAlt: { title: "დაბლოკოთ {{name}}?", description: "{{name}}-ს დაბლოკვა:", removeMatches: "წაშლის თქვენი შესაბამისობებიდან", hideProfile: "დამალავს თქვენს პროფილს", preventMatching: "ხელს შეუშლის მომავალ შესაბამისობებს", deleteMessages: "სამუდამოდ წაშლის ყველა შეტყობინებას (ვერ გააუქმებთ)", block: "დაბლოკვა" },
      unmatch: { title: "გააუქმოთ შესაბამისობა {{name}}-თან?", description: "ეს დაასრულებს თქვენს საუბარს {{name}}-თან. შეიძლება კვლავ ერთმანეთი ნახოთ აღმოჩენაში.", privacy: "{{name}} არ იქნება ინფორმირებული გაუქმების შესახებ", button: "შესაბამისობის გაუქმება", needToBlock: "დაბლოკვა გჭირდებათ?", successTitle: "შესაბამისობა გაუქმებულია", successMessage: "თქვენ გააუქმეთ შესაბამისობა {{name}}-თან", errorMessage: "შესაბამისობის გაუქმება ვერ მოხერხდა. სცადეთ ხელახლა." }
    }
  },
  zh: {
    chat: { blockedConfirmation: "你已屏蔽 {{name}}" },
    moderation: {
      menu: { reportUser: "举报用户", unmatch: "取消匹配", blockUser: "屏蔽用户" },
      report: {
        title: "举报 {{name}}", subtitle: "请选择举报此用户的原因：",
        reasons: { blackmail: "勒索 / 分享截图", blackmailDescription: "有人分享了带水印的个人资料截图", inappropriateContent: "不当内容", inappropriateContentDescription: "照片、简介或消息包含不当内容", harassment: "骚扰", harassmentDescription: "威胁、骚扰或霸凌行为", fakeProfile: "虚假个人资料", fakeProfileDescription: "个人资料似乎是虚假的或冒充他人", scam: "诈骗", scamDescription: "索要金钱或疑似诈骗", spam: "垃圾信息", spamDescription: "发送垃圾信息或推广消息", underage: "未成年用户", underageDescription: "用户似乎不满18岁", hateSpeech: "仇恨言论", hateSpeechDescription: "歧视性或仇恨性语言", other: "其他", otherDescription: "以上未列出的其他原因" },
        evidencePhotos: "证据照片", upload: "上传", evidenceInfo: "上传显示您的个人资料带水印的截图。",
        explainWhy: "解释举报原因", explainHint: "请描述违反我们准则的具体行为或内容。", explainPlaceholder: "这个用户做了什么？请具体说明...",
        charsNeeded: "还需要 {{count}} 个字符", charsCount: "{{count}}/500", privacyNotice: "您的举报是匿名的。被举报的用户不会收到通知。", submitReport: "提交举报",
        permissionRequired: "需要权限", permissionMessage: "请允许访问照片库以上传证据。", uploadFailed: "上传失败", uploadFailedMessage: "一张或多张照片上传失败。请重试。", selectPhotoError: "选择照片失败。请重试。", selectReasonError: "请选择举报原因",
        explanationRequired: "需要说明", explanationRequiredMessage: "请提供详细说明（至少20个字符）。", evidenceRequired: "需要证据", evidenceRequiredMessage: "勒索举报需要截图证据。", mustBeLoggedIn: "您必须登录才能举报用户",
        submitted: "举报已提交", submittedMessage: "感谢您帮助保持 Accord 的安全。我们的团队将审核此举报。", submitError: "提交举报失败。请重试。"
      },
      reportAlt: {
        title: "举报 {{name}}", subtitle: "帮助我们保持 Accord 的安全", whyReporting: "您为什么举报此个人资料？", provideDetails: "请提供详情", detailsPlaceholder: "帮助我们了解发生了什么（至少10个字符）", evidenceInfo: "上传带水印的个人资料截图。", evidenceRequiredMessage: "勒索举报需要截图证据。", infoNotice: "举报由我们的团队审核。虚假举报可能导致账户被暂停。",
        reasons: { blackmail: "勒索 / 分享截图", harassment: "骚扰或霸凌", fakeProfile: "虚假个人资料或诈骗", inappropriateContent: "不当照片或消息", spam: "垃圾信息或推销", underage: "未成年用户", safetyConcern: "安全问题", other: "其他" }
      },
      block: {
        title: "屏蔽 {{name}}？", description: "屏蔽此用户将会：", hideProfile: "对其隐藏您的个人资料", preventMessages: "阻止其向您发送消息", deleteMessages: "永久删除所有消息（无法撤销）", noNotification: "对方不会收到通知", unblockNote: "您可以稍后在设置 → 已屏蔽用户中取消屏蔽",
        blockUser: "屏蔽用户", alreadyBlocked: "已屏蔽", alreadyBlockedMessage: "您已经屏蔽了此用户。", userBlocked: "用户已屏蔽", userBlockedMessage: "{{name}} 已被屏蔽。您的对话已被永久删除，对方无法再看到您的个人资料。", mustBeLoggedIn: "您必须登录才能屏蔽用户", error: "屏蔽用户失败。请重试。"
      },
      blockAlt: { title: "屏蔽 {{name}}？", description: "屏蔽 {{name}} 将会：", removeMatches: "从您的匹配中移除", hideProfile: "隐藏您的个人资料", preventMatching: "阻止未来匹配", deleteMessages: "永久删除所有消息（无法撤销）", block: "屏蔽" },
      unmatch: { title: "取消与 {{name}} 的匹配？", description: "这将结束您与 {{name}} 的对话。你们可能会在发现中再次看到彼此。", privacy: "{{name}} 不会收到取消匹配的通知", button: "取消匹配", needToBlock: "需要屏蔽吗？", successTitle: "已取消匹配", successMessage: "您已取消与 {{name}} 的匹配", errorMessage: "取消匹配失败。请重试。" }
    }
  }
};

const localesDir = path.join(__dirname, '..', 'locales');
for (const [locale, trans] of Object.entries(T)) {
  const fp = path.join(localesDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  deepMerge(data, trans);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n');
  console.log(`✅ ${locale}.json updated`);
}
console.log('\nBatch 3 done (tr, uk, pl, id, ka, zh)');
