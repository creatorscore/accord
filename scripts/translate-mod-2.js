const fs = require('fs');
const path = require('path');
function deepMerge(t, s) { for (const k of Object.keys(s)) { if (s[k] && typeof s[k]==='object' && !Array.isArray(s[k])) { if (!t[k]) t[k]={}; deepMerge(t[k],s[k]); } else { t[k]=s[k]; } } return t; }

const T = {
  de: {
    chat: { blockedConfirmation: "Du hast {{name}} blockiert" },
    moderation: {
      menu: { reportUser: "Benutzer melden", unmatch: "Entmatchen", blockUser: "Benutzer blockieren" },
      report: {
        title: "{{name}} melden", subtitle: "Bitte wähle den Grund für die Meldung dieses Benutzers:",
        reasons: { blackmail: "Erpressung / Screenshot-Weitergabe", blackmailDescription: "Jemand hat deinen Screenshot mit Wasserzeichen geteilt", inappropriateContent: "Unangemessener Inhalt", inappropriateContentDescription: "Fotos, Bio oder Nachrichten enthalten unangemessene Inhalte", harassment: "Belästigung", harassmentDescription: "Bedrohliches, belästigendes oder mobbendes Verhalten", fakeProfile: "Fake-Profil", fakeProfileDescription: "Das Profil scheint gefälscht oder eine Identitätsübernahme zu sein", scam: "Betrug", scamDescription: "Bittet um Geld oder scheint ein Betrug zu sein", spam: "Spam", spamDescription: "Spam- oder Werbenachrichten senden", underage: "Minderjähriger Benutzer", underageDescription: "Benutzer scheint unter 18 zu sein", hateSpeech: "Hassrede", hateSpeechDescription: "Diskriminierende oder hasserfüllte Sprache", other: "Sonstiges", otherDescription: "Anderer Grund, der oben nicht aufgeführt ist" },
        evidencePhotos: "Beweisfotos", upload: "Hochladen", evidenceInfo: "Lade Screenshots hoch, die dein Profil mit sichtbarem Wasserzeichen zeigen.",
        explainWhy: "Erkläre, warum du meldest", explainHint: "Bitte beschreibe das spezifische Verhalten oder den Inhalt, der gegen unsere Richtlinien verstößt.", explainPlaceholder: "Was hat dieser Benutzer getan? Sei konkret...",
        charsNeeded: "Noch {{count}} Zeichen nötig", charsCount: "{{count}}/500", privacyNotice: "Deine Meldung ist anonym. Der gemeldete Benutzer wird nicht benachrichtigt.", submitReport: "Meldung absenden",
        permissionRequired: "Berechtigung erforderlich", permissionMessage: "Bitte erlaube den Zugriff auf die Fotobibliothek zum Hochladen von Beweisen.", uploadFailed: "Hochladen fehlgeschlagen", uploadFailedMessage: "Ein oder mehrere Fotos konnten nicht hochgeladen werden. Bitte versuche es erneut.", selectPhotoError: "Fotos konnten nicht ausgewählt werden. Bitte versuche es erneut.", selectReasonError: "Bitte wähle einen Grund für die Meldung",
        explanationRequired: "Erklärung erforderlich", explanationRequiredMessage: "Bitte gib eine detaillierte Erklärung ab (mindestens 20 Zeichen).", evidenceRequired: "Beweise erforderlich", evidenceRequiredMessage: "Erpressungsmeldungen erfordern Screenshot-Beweise.", mustBeLoggedIn: "Du musst angemeldet sein, um einen Benutzer zu melden",
        submitted: "Meldung eingereicht", submittedMessage: "Danke, dass du hilfst, Accord sicher zu halten. Unser Team wird diese Meldung prüfen.", submitError: "Meldung konnte nicht eingereicht werden. Bitte versuche es erneut."
      },
      reportAlt: {
        title: "{{name}} melden", subtitle: "Hilf uns, Accord sicher zu halten", whyReporting: "Warum meldest du dieses Profil?", provideDetails: "Bitte gib Details an", detailsPlaceholder: "Hilf uns zu verstehen, was passiert ist (mindestens 10 Zeichen)", evidenceInfo: "Lade Screenshots hoch, die dein Profil mit Wasserzeichen zeigen.", evidenceRequiredMessage: "Erpressungsmeldungen erfordern Screenshot-Beweise.", infoNotice: "Meldungen werden von unserem Team geprüft. Falsche Meldungen können zur Kontosperrung führen.",
        reasons: { blackmail: "Erpressung / Screenshot-Weitergabe", harassment: "Belästigung oder Mobbing", fakeProfile: "Fake-Profil oder Betrug", inappropriateContent: "Unangemessene Fotos oder Nachrichten", spam: "Spam oder Werbung", underage: "Minderjähriger Benutzer", safetyConcern: "Sicherheitsbedenken", other: "Sonstiges" }
      },
      block: {
        title: "{{name}} blockieren?", description: "Das Blockieren dieses Benutzers wird:", hideProfile: "Dein Profil vor ihnen verbergen", preventMessages: "Verhindern, dass sie dir Nachrichten senden", deleteMessages: "Alle Nachrichten dauerhaft löschen (kann nicht rückgängig gemacht werden)", noNotification: "Sie werden nicht benachrichtigt", unblockNote: "Du kannst sie später in Einstellungen → Blockierte Benutzer entsperren",
        blockUser: "Benutzer blockieren", alreadyBlocked: "Bereits blockiert", alreadyBlockedMessage: "Du hast diesen Benutzer bereits blockiert.", userBlocked: "Benutzer blockiert", userBlockedMessage: "{{name}} wurde blockiert. Deine Unterhaltung wurde dauerhaft gelöscht und sie können dein Profil nicht mehr sehen.", mustBeLoggedIn: "Du musst angemeldet sein, um einen Benutzer zu blockieren", error: "Benutzer konnte nicht blockiert werden. Bitte versuche es erneut."
      },
      blockAlt: { title: "{{name}} blockieren?", description: "{{name}} zu blockieren wird:", removeMatches: "Sie aus deinen Matches entfernen", hideProfile: "Dein Profil vor ihnen verbergen", preventMatching: "Zukünftiges Matching verhindern", deleteMessages: "Alle Nachrichten dauerhaft löschen (kann nicht rückgängig gemacht werden)", block: "Blockieren" },
      unmatch: { title: "{{name}} entmatchen?", description: "Dies beendet deine Unterhaltung mit {{name}}. Ihr könnt euch möglicherweise wieder in der Entdeckung sehen.", privacy: "{{name}} wird nicht über das Entmatchen benachrichtigt", button: "Entmatchen", needToBlock: "Stattdessen blockieren?", successTitle: "Entmatcht", successMessage: "Du hast {{name}} entmatcht", errorMessage: "Entmatchen fehlgeschlagen. Bitte versuche es erneut." }
    }
  },
  es: {
    chat: { blockedConfirmation: "Has bloqueado a {{name}}" },
    moderation: {
      menu: { reportUser: "Reportar usuario", unmatch: "Deshacer match", blockUser: "Bloquear usuario" },
      report: {
        title: "Reportar a {{name}}", subtitle: "Por favor selecciona la razón por la que reportas a este usuario:",
        reasons: { blackmail: "Chantaje / Compartir capturas", blackmailDescription: "Alguien compartió una captura de tu perfil con marca de agua", inappropriateContent: "Contenido inapropiado", inappropriateContentDescription: "Fotos, biografía o mensajes contienen contenido inapropiado", harassment: "Acoso", harassmentDescription: "Comportamiento amenazante, acosador o de intimidación", fakeProfile: "Perfil falso", fakeProfileDescription: "El perfil parece ser falso o suplanta identidad", scam: "Estafa", scamDescription: "Pide dinero o parece ser una estafa", spam: "Spam", spamDescription: "Envío de mensajes spam o promocionales", underage: "Usuario menor de edad", underageDescription: "El usuario parece ser menor de 18 años", hateSpeech: "Discurso de odio", hateSpeechDescription: "Lenguaje discriminatorio o de odio", other: "Otro", otherDescription: "Otra razón no listada arriba" },
        evidencePhotos: "Fotos de evidencia", upload: "Subir", evidenceInfo: "Sube capturas de pantalla que muestren tu perfil con la marca de agua visible.",
        explainWhy: "Explica por qué reportas", explainHint: "Por favor describe el comportamiento o contenido específico que viola nuestras directrices.", explainPlaceholder: "¿Qué hizo este usuario? Sé específico...",
        charsNeeded: "Se necesitan {{count}} caracteres más", charsCount: "{{count}}/500", privacyNotice: "Tu reporte es anónimo. El usuario reportado no será notificado.", submitReport: "Enviar reporte",
        permissionRequired: "Permiso requerido", permissionMessage: "Por favor permite el acceso a tu biblioteca de fotos para subir evidencia.", uploadFailed: "Error al subir", uploadFailedMessage: "No se pudieron subir una o más fotos. Inténtalo de nuevo.", selectPhotoError: "No se pudieron seleccionar fotos. Inténtalo de nuevo.", selectReasonError: "Por favor selecciona una razón para el reporte",
        explanationRequired: "Explicación requerida", explanationRequiredMessage: "Por favor proporciona una explicación detallada (al menos 20 caracteres).", evidenceRequired: "Evidencia requerida", evidenceRequiredMessage: "Los reportes de chantaje requieren evidencia de capturas de pantalla.", mustBeLoggedIn: "Debes iniciar sesión para reportar un usuario",
        submitted: "Reporte enviado", submittedMessage: "Gracias por ayudar a mantener Accord seguro. Nuestro equipo revisará este reporte.", submitError: "No se pudo enviar el reporte. Inténtalo de nuevo."
      },
      reportAlt: {
        title: "Reportar a {{name}}", subtitle: "Ayúdanos a mantener Accord seguro", whyReporting: "¿Por qué reportas este perfil?", provideDetails: "Por favor proporciona detalles", detailsPlaceholder: "Ayúdanos a entender qué pasó (mínimo 10 caracteres)", evidenceInfo: "Sube capturas que muestren tu perfil con marca de agua.", evidenceRequiredMessage: "Los reportes de chantaje requieren evidencia de capturas.", infoNotice: "Los reportes son revisados por nuestro equipo. Reportes falsos pueden resultar en suspensión de cuenta.",
        reasons: { blackmail: "Chantaje / Compartir capturas", harassment: "Acoso o intimidación", fakeProfile: "Perfil falso o estafa", inappropriateContent: "Fotos o mensajes inapropiados", spam: "Spam o solicitudes", underage: "Usuario menor de edad", safetyConcern: "Preocupación de seguridad", other: "Otro" }
      },
      block: {
        title: "¿Bloquear a {{name}}?", description: "Bloquear a este usuario:", hideProfile: "Ocultará tu perfil de ellos", preventMessages: "Evitará que te envíen mensajes", deleteMessages: "Eliminará permanentemente todos los mensajes (no se puede deshacer)", noNotification: "No serán notificados", unblockNote: "Puedes desbloquearlos después en Configuración → Usuarios bloqueados",
        blockUser: "Bloquear usuario", alreadyBlocked: "Ya bloqueado", alreadyBlockedMessage: "Ya has bloqueado a este usuario.", userBlocked: "Usuario bloqueado", userBlockedMessage: "{{name}} ha sido bloqueado. Tu conversación ha sido eliminada permanentemente y ya no pueden ver tu perfil.", mustBeLoggedIn: "Debes iniciar sesión para bloquear un usuario", error: "No se pudo bloquear al usuario. Inténtalo de nuevo."
      },
      blockAlt: { title: "¿Bloquear a {{name}}?", description: "Bloquear a {{name}}:", removeMatches: "Los eliminará de tus matches", hideProfile: "Ocultará tu perfil de ellos", preventMatching: "Evitará futuros matches", deleteMessages: "Eliminará permanentemente todos los mensajes (no se puede deshacer)", block: "Bloquear" },
      unmatch: { title: "¿Deshacer match con {{name}}?", description: "Esto terminará tu conversación con {{name}}. Podrían verse de nuevo en descubrimiento.", privacy: "{{name}} no será notificado del desmatch", button: "Deshacer match", needToBlock: "¿Necesitas bloquear en su lugar?", successTitle: "Match deshecho", successMessage: "Has deshecho el match con {{name}}", errorMessage: "No se pudo deshacer el match. Inténtalo de nuevo." }
    }
  },
  fr: {
    chat: { blockedConfirmation: "Vous avez bloqué {{name}}" },
    moderation: {
      menu: { reportUser: "Signaler l'utilisateur", unmatch: "Annuler le match", blockUser: "Bloquer l'utilisateur" },
      report: {
        title: "Signaler {{name}}", subtitle: "Veuillez sélectionner la raison du signalement :",
        reasons: { blackmail: "Chantage / Partage de captures d'écran", blackmailDescription: "Quelqu'un a partagé une capture d'écran de votre profil avec filigrane", inappropriateContent: "Contenu inapproprié", inappropriateContentDescription: "Photos, bio ou messages contiennent du contenu inapproprié", harassment: "Harcèlement", harassmentDescription: "Comportement menaçant, harcelant ou intimidant", fakeProfile: "Faux profil", fakeProfileDescription: "Le profil semble faux ou usurpe l'identité de quelqu'un", scam: "Arnaque", scamDescription: "Demande de l'argent ou semble être une arnaque", spam: "Spam", spamDescription: "Envoi de messages spam ou promotionnels", underage: "Utilisateur mineur", underageDescription: "L'utilisateur semble avoir moins de 18 ans", hateSpeech: "Discours haineux", hateSpeechDescription: "Langage discriminatoire ou haineux", other: "Autre", otherDescription: "Autre raison non listée ci-dessus" },
        evidencePhotos: "Photos de preuves", upload: "Télécharger", evidenceInfo: "Téléchargez des captures d'écran montrant votre profil avec le filigrane visible.",
        explainWhy: "Expliquez pourquoi vous signalez", explainHint: "Veuillez décrire le comportement ou contenu spécifique qui enfreint nos règles.", explainPlaceholder: "Qu'a fait cet utilisateur ? Soyez précis...",
        charsNeeded: "{{count}} caractères supplémentaires nécessaires", charsCount: "{{count}}/500", privacyNotice: "Votre signalement est anonyme. L'utilisateur signalé ne sera pas notifié.", submitReport: "Envoyer le signalement",
        permissionRequired: "Permission requise", permissionMessage: "Veuillez autoriser l'accès à votre photothèque pour télécharger des preuves.", uploadFailed: "Échec du téléchargement", uploadFailedMessage: "Le téléchargement d'une ou plusieurs photos a échoué. Veuillez réessayer.", selectPhotoError: "Impossible de sélectionner les photos. Veuillez réessayer.", selectReasonError: "Veuillez sélectionner une raison pour le signalement",
        explanationRequired: "Explication requise", explanationRequiredMessage: "Veuillez fournir une explication détaillée (au moins 20 caractères).", evidenceRequired: "Preuves requises", evidenceRequiredMessage: "Les signalements de chantage nécessitent des preuves par capture d'écran.", mustBeLoggedIn: "Vous devez être connecté pour signaler un utilisateur",
        submitted: "Signalement envoyé", submittedMessage: "Merci de nous aider à garder Accord sûr. Notre équipe examinera ce signalement.", submitError: "Impossible d'envoyer le signalement. Veuillez réessayer."
      },
      reportAlt: {
        title: "Signaler {{name}}", subtitle: "Aidez-nous à garder Accord sûr", whyReporting: "Pourquoi signalez-vous ce profil ?", provideDetails: "Veuillez fournir des détails", detailsPlaceholder: "Aidez-nous à comprendre ce qui s'est passé (minimum 10 caractères)", evidenceInfo: "Téléchargez des captures montrant votre profil avec filigrane.", evidenceRequiredMessage: "Les signalements de chantage nécessitent des preuves.", infoNotice: "Les signalements sont examinés par notre équipe. Les faux signalements peuvent entraîner la suspension du compte.",
        reasons: { blackmail: "Chantage / Partage de captures", harassment: "Harcèlement ou intimidation", fakeProfile: "Faux profil ou arnaque", inappropriateContent: "Photos ou messages inappropriés", spam: "Spam ou sollicitation", underage: "Utilisateur mineur", safetyConcern: "Préoccupation de sécurité", other: "Autre" }
      },
      block: {
        title: "Bloquer {{name}} ?", description: "Bloquer cet utilisateur va :", hideProfile: "Cacher votre profil à cette personne", preventMessages: "L'empêcher de vous envoyer des messages", deleteMessages: "Supprimer définitivement tous les messages (irréversible)", noNotification: "Cette personne ne sera pas notifiée", unblockNote: "Vous pouvez débloquer plus tard dans Paramètres → Utilisateurs bloqués",
        blockUser: "Bloquer l'utilisateur", alreadyBlocked: "Déjà bloqué", alreadyBlockedMessage: "Vous avez déjà bloqué cet utilisateur.", userBlocked: "Utilisateur bloqué", userBlockedMessage: "{{name}} a été bloqué. Votre conversation a été définitivement supprimée et cette personne ne peut plus voir votre profil.", mustBeLoggedIn: "Vous devez être connecté pour bloquer un utilisateur", error: "Impossible de bloquer l'utilisateur. Veuillez réessayer."
      },
      blockAlt: { title: "Bloquer {{name}} ?", description: "Bloquer {{name}} va :", removeMatches: "Le retirer de vos matchs", hideProfile: "Cacher votre profil", preventMatching: "Empêcher les futurs matchs", deleteMessages: "Supprimer définitivement tous les messages (irréversible)", block: "Bloquer" },
      unmatch: { title: "Annuler le match avec {{name}} ?", description: "Cela mettra fin à votre conversation avec {{name}}. Vous pourriez vous revoir dans la découverte.", privacy: "{{name}} ne sera pas notifié de l'annulation", button: "Annuler le match", needToBlock: "Besoin de bloquer plutôt ?", successTitle: "Match annulé", successMessage: "Vous avez annulé le match avec {{name}}", errorMessage: "Impossible d'annuler le match. Veuillez réessayer." }
    }
  },
  it: {
    chat: { blockedConfirmation: "Hai bloccato {{name}}" },
    moderation: {
      menu: { reportUser: "Segnala utente", unmatch: "Annulla match", blockUser: "Blocca utente" },
      report: {
        title: "Segnala {{name}}", subtitle: "Seleziona il motivo della segnalazione:",
        reasons: { blackmail: "Ricatto / Condivisione screenshot", blackmailDescription: "Qualcuno ha condiviso uno screenshot del tuo profilo con filigrana", inappropriateContent: "Contenuto inappropriato", inappropriateContentDescription: "Foto, bio o messaggi contengono contenuti inappropriati", harassment: "Molestie", harassmentDescription: "Comportamento minaccioso, molesto o di bullismo", fakeProfile: "Profilo falso", fakeProfileDescription: "Il profilo sembra falso o sta impersonando qualcuno", scam: "Truffa", scamDescription: "Chiede denaro o sembra una truffa", spam: "Spam", spamDescription: "Invio di messaggi spam o promozionali", underage: "Utente minorenne", underageDescription: "L'utente sembra avere meno di 18 anni", hateSpeech: "Discorso d'odio", hateSpeechDescription: "Linguaggio discriminatorio o di odio", other: "Altro", otherDescription: "Altro motivo non elencato sopra" },
        evidencePhotos: "Foto di prova", upload: "Carica", evidenceInfo: "Carica screenshot che mostrano il tuo profilo con la filigrana visibile.",
        explainWhy: "Spiega perché stai segnalando", explainHint: "Descrivi il comportamento o contenuto specifico che viola le nostre linee guida.", explainPlaceholder: "Cosa ha fatto questo utente? Sii specifico...",
        charsNeeded: "Servono ancora {{count}} caratteri", charsCount: "{{count}}/500", privacyNotice: "La tua segnalazione è anonima. L'utente segnalato non verrà avvisato.", submitReport: "Invia segnalazione",
        permissionRequired: "Permesso richiesto", permissionMessage: "Consenti l'accesso alla libreria foto per caricare le prove.", uploadFailed: "Caricamento fallito", uploadFailedMessage: "Impossibile caricare una o più foto. Riprova.", selectPhotoError: "Impossibile selezionare le foto. Riprova.", selectReasonError: "Seleziona un motivo per la segnalazione",
        explanationRequired: "Spiegazione richiesta", explanationRequiredMessage: "Fornisci una spiegazione dettagliata (almeno 20 caratteri).", evidenceRequired: "Prove richieste", evidenceRequiredMessage: "Le segnalazioni di ricatto richiedono prove con screenshot.", mustBeLoggedIn: "Devi effettuare l'accesso per segnalare un utente",
        submitted: "Segnalazione inviata", submittedMessage: "Grazie per aiutarci a mantenere Accord sicuro. Il nostro team esaminerà questa segnalazione.", submitError: "Impossibile inviare la segnalazione. Riprova."
      },
      reportAlt: {
        title: "Segnala {{name}}", subtitle: "Aiutaci a mantenere Accord sicuro", whyReporting: "Perché stai segnalando questo profilo?", provideDetails: "Fornisci dettagli", detailsPlaceholder: "Aiutaci a capire cosa è successo (minimo 10 caratteri)", evidenceInfo: "Carica screenshot che mostrano il tuo profilo con filigrana.", evidenceRequiredMessage: "Le segnalazioni di ricatto richiedono prove con screenshot.", infoNotice: "Le segnalazioni vengono esaminate dal nostro team. Segnalazioni false possono portare alla sospensione dell'account.",
        reasons: { blackmail: "Ricatto / Condivisione screenshot", harassment: "Molestie o bullismo", fakeProfile: "Profilo falso o truffa", inappropriateContent: "Foto o messaggi inappropriati", spam: "Spam o sollecitazione", underage: "Utente minorenne", safetyConcern: "Preoccupazione per la sicurezza", other: "Altro" }
      },
      block: {
        title: "Bloccare {{name}}?", description: "Bloccare questo utente:", hideProfile: "Nasconderà il tuo profilo da loro", preventMessages: "Impedirà loro di inviarti messaggi", deleteMessages: "Eliminerà permanentemente tutti i messaggi (irreversibile)", noNotification: "Non verranno avvisati", unblockNote: "Puoi sbloccarli in seguito in Impostazioni → Utenti bloccati",
        blockUser: "Blocca utente", alreadyBlocked: "Già bloccato", alreadyBlockedMessage: "Hai già bloccato questo utente.", userBlocked: "Utente bloccato", userBlockedMessage: "{{name}} è stato bloccato. La conversazione è stata eliminata permanentemente e non possono più vedere il tuo profilo.", mustBeLoggedIn: "Devi effettuare l'accesso per bloccare un utente", error: "Impossibile bloccare l'utente. Riprova."
      },
      blockAlt: { title: "Bloccare {{name}}?", description: "Bloccare {{name}}:", removeMatches: "Rimuoverli dai tuoi match", hideProfile: "Nascondere il tuo profilo", preventMatching: "Impedire futuri match", deleteMessages: "Eliminare permanentemente tutti i messaggi (irreversibile)", block: "Blocca" },
      unmatch: { title: "Annullare il match con {{name}}?", description: "Questo terminerà la conversazione con {{name}}. Potreste rivedervi nella scoperta.", privacy: "{{name}} non verrà avvisato dell'annullamento", button: "Annulla match", needToBlock: "Hai bisogno di bloccare invece?", successTitle: "Match annullato", successMessage: "Hai annullato il match con {{name}}", errorMessage: "Impossibile annullare il match. Riprova." }
    }
  },
  pt: {
    chat: { blockedConfirmation: "Você bloqueou {{name}}" },
    moderation: {
      menu: { reportUser: "Denunciar usuário", unmatch: "Desfazer match", blockUser: "Bloquear usuário" },
      report: {
        title: "Denunciar {{name}}", subtitle: "Selecione o motivo da denúncia:",
        reasons: { blackmail: "Chantagem / Compartilhamento de capturas", blackmailDescription: "Alguém compartilhou uma captura do seu perfil com marca d'água", inappropriateContent: "Conteúdo impróprio", inappropriateContentDescription: "Fotos, bio ou mensagens contêm conteúdo impróprio", harassment: "Assédio", harassmentDescription: "Comportamento ameaçador, assediador ou de bullying", fakeProfile: "Perfil falso", fakeProfileDescription: "O perfil parece falso ou está se passando por alguém", scam: "Golpe", scamDescription: "Pede dinheiro ou parece ser um golpe", spam: "Spam", spamDescription: "Envio de mensagens spam ou promocionais", underage: "Usuário menor de idade", underageDescription: "O usuário parece ter menos de 18 anos", hateSpeech: "Discurso de ódio", hateSpeechDescription: "Linguagem discriminatória ou de ódio", other: "Outro", otherDescription: "Outro motivo não listado acima" },
        evidencePhotos: "Fotos de evidência", upload: "Enviar", evidenceInfo: "Envie capturas de tela mostrando seu perfil com a marca d'água visível.",
        explainWhy: "Explique por que está denunciando", explainHint: "Descreva o comportamento ou conteúdo específico que viola nossas diretrizes.", explainPlaceholder: "O que este usuário fez? Seja específico...",
        charsNeeded: "Mais {{count}} caracteres necessários", charsCount: "{{count}}/500", privacyNotice: "Sua denúncia é anônima. O usuário denunciado não será notificado.", submitReport: "Enviar denúncia",
        permissionRequired: "Permissão necessária", permissionMessage: "Permita o acesso à biblioteca de fotos para enviar evidências.", uploadFailed: "Falha no envio", uploadFailedMessage: "Não foi possível enviar uma ou mais fotos. Tente novamente.", selectPhotoError: "Não foi possível selecionar fotos. Tente novamente.", selectReasonError: "Selecione um motivo para a denúncia",
        explanationRequired: "Explicação necessária", explanationRequiredMessage: "Forneça uma explicação detalhada (pelo menos 20 caracteres).", evidenceRequired: "Evidência necessária", evidenceRequiredMessage: "Denúncias de chantagem requerem evidência de capturas de tela.", mustBeLoggedIn: "Você precisa estar logado para denunciar um usuário",
        submitted: "Denúncia enviada", submittedMessage: "Obrigado por ajudar a manter o Accord seguro. Nossa equipe analisará esta denúncia.", submitError: "Não foi possível enviar a denúncia. Tente novamente."
      },
      reportAlt: {
        title: "Denunciar {{name}}", subtitle: "Ajude-nos a manter o Accord seguro", whyReporting: "Por que você está denunciando este perfil?", provideDetails: "Forneça detalhes", detailsPlaceholder: "Ajude-nos a entender o que aconteceu (mínimo 10 caracteres)", evidenceInfo: "Envie capturas mostrando seu perfil com marca d'água.", evidenceRequiredMessage: "Denúncias de chantagem requerem evidência de capturas.", infoNotice: "Denúncias são analisadas por nossa equipe. Denúncias falsas podem resultar em suspensão da conta.",
        reasons: { blackmail: "Chantagem / Compartilhamento de capturas", harassment: "Assédio ou bullying", fakeProfile: "Perfil falso ou golpe", inappropriateContent: "Fotos ou mensagens impróprias", spam: "Spam ou solicitação", underage: "Usuário menor de idade", safetyConcern: "Preocupação de segurança", other: "Outro" }
      },
      block: {
        title: "Bloquear {{name}}?", description: "Bloquear este usuário vai:", hideProfile: "Ocultar seu perfil dele", preventMessages: "Impedir que envie mensagens", deleteMessages: "Excluir permanentemente todas as mensagens (irreversível)", noNotification: "Eles não serão notificados", unblockNote: "Você pode desbloquear depois em Configurações → Usuários bloqueados",
        blockUser: "Bloquear usuário", alreadyBlocked: "Já bloqueado", alreadyBlockedMessage: "Você já bloqueou este usuário.", userBlocked: "Usuário bloqueado", userBlockedMessage: "{{name}} foi bloqueado. Sua conversa foi excluída permanentemente e eles não podem mais ver seu perfil.", mustBeLoggedIn: "Você precisa estar logado para bloquear um usuário", error: "Não foi possível bloquear o usuário. Tente novamente."
      },
      blockAlt: { title: "Bloquear {{name}}?", description: "Bloquear {{name}} vai:", removeMatches: "Removê-lo dos seus matches", hideProfile: "Ocultar seu perfil", preventMatching: "Impedir futuros matches", deleteMessages: "Excluir permanentemente todas as mensagens (irreversível)", block: "Bloquear" },
      unmatch: { title: "Desfazer match com {{name}}?", description: "Isso encerrará sua conversa com {{name}}. Vocês podem se ver novamente na descoberta.", privacy: "{{name}} não será notificado do desmatch", button: "Desfazer match", needToBlock: "Precisa bloquear em vez disso?", successTitle: "Match desfeito", successMessage: "Você desfez o match com {{name}}", errorMessage: "Não foi possível desfazer o match. Tente novamente." }
    }
  },
  ru: {
    chat: { blockedConfirmation: "Вы заблокировали {{name}}" },
    moderation: {
      menu: { reportUser: "Пожаловаться", unmatch: "Отменить совпадение", blockUser: "Заблокировать" },
      report: {
        title: "Пожаловаться на {{name}}", subtitle: "Выберите причину жалобы:",
        reasons: { blackmail: "Шантаж / Распространение скриншотов", blackmailDescription: "Кто-то распространил скриншот вашего профиля с водяным знаком", inappropriateContent: "Неприемлемый контент", inappropriateContentDescription: "Фото, биография или сообщения содержат неприемлемый контент", harassment: "Домогательства", harassmentDescription: "Угрожающее, преследующее или запугивающее поведение", fakeProfile: "Фейковый профиль", fakeProfileDescription: "Профиль кажется фейковым или выдаёт себя за другого", scam: "Мошенничество", scamDescription: "Просит деньги или похоже на мошенничество", spam: "Спам", spamDescription: "Отправка спама или рекламных сообщений", underage: "Несовершеннолетний", underageDescription: "Пользователь выглядит моложе 18 лет", hateSpeech: "Разжигание ненависти", hateSpeechDescription: "Дискриминационная или ненавистническая речь", other: "Другое", otherDescription: "Другая причина, не указанная выше" },
        evidencePhotos: "Фото-доказательства", upload: "Загрузить", evidenceInfo: "Загрузите скриншоты, показывающие ваш профиль с видимым водяным знаком.",
        explainWhy: "Объясните причину жалобы", explainHint: "Опишите конкретное поведение или контент, нарушающий наши правила.", explainPlaceholder: "Что сделал этот пользователь? Будьте конкретны...",
        charsNeeded: "Нужно ещё {{count}} символов", charsCount: "{{count}}/500", privacyNotice: "Ваша жалоба анонимна. Пользователь не будет уведомлён.", submitReport: "Отправить жалобу",
        permissionRequired: "Требуется разрешение", permissionMessage: "Разрешите доступ к фотобиблиотеке для загрузки доказательств.", uploadFailed: "Ошибка загрузки", uploadFailedMessage: "Не удалось загрузить одно или несколько фото. Попробуйте снова.", selectPhotoError: "Не удалось выбрать фото. Попробуйте снова.", selectReasonError: "Выберите причину жалобы",
        explanationRequired: "Требуется объяснение", explanationRequiredMessage: "Предоставьте подробное объяснение (минимум 20 символов).", evidenceRequired: "Требуются доказательства", evidenceRequiredMessage: "Жалобы на шантаж требуют скриншотов в качестве доказательств.", mustBeLoggedIn: "Войдите в аккаунт, чтобы пожаловаться",
        submitted: "Жалоба отправлена", submittedMessage: "Спасибо за помощь в обеспечении безопасности Accord. Наша команда рассмотрит эту жалобу.", submitError: "Не удалось отправить жалобу. Попробуйте снова."
      },
      reportAlt: {
        title: "Пожаловаться на {{name}}", subtitle: "Помогите нам сохранить Accord безопасным", whyReporting: "Почему вы жалуетесь на этот профиль?", provideDetails: "Предоставьте подробности", detailsPlaceholder: "Помогите нам понять, что произошло (минимум 10 символов)", evidenceInfo: "Загрузите скриншоты с водяным знаком.", evidenceRequiredMessage: "Жалобы на шантаж требуют скриншотов.", infoNotice: "Жалобы рассматриваются нашей командой. Ложные жалобы могут привести к блокировке аккаунта.",
        reasons: { blackmail: "Шантаж / Распространение скриншотов", harassment: "Домогательства или травля", fakeProfile: "Фейковый профиль или мошенничество", inappropriateContent: "Неприемлемые фото или сообщения", spam: "Спам или навязывание", underage: "Несовершеннолетний", safetyConcern: "Проблема безопасности", other: "Другое" }
      },
      block: {
        title: "Заблокировать {{name}}?", description: "Блокировка этого пользователя:", hideProfile: "Скроет ваш профиль от него", preventMessages: "Запретит отправлять вам сообщения", deleteMessages: "Навсегда удалит все сообщения (нельзя отменить)", noNotification: "Он не будет уведомлён", unblockNote: "Разблокировать можно позже в Настройки → Заблокированные",
        blockUser: "Заблокировать", alreadyBlocked: "Уже заблокирован", alreadyBlockedMessage: "Вы уже заблокировали этого пользователя.", userBlocked: "Пользователь заблокирован", userBlockedMessage: "{{name}} заблокирован. Ваша переписка навсегда удалена, и он больше не может видеть ваш профиль.", mustBeLoggedIn: "Войдите, чтобы заблокировать", error: "Не удалось заблокировать. Попробуйте снова."
      },
      blockAlt: { title: "Заблокировать {{name}}?", description: "Блокировка {{name}}:", removeMatches: "Удалит из ваших совпадений", hideProfile: "Скроет ваш профиль", preventMatching: "Предотвратит будущие совпадения", deleteMessages: "Навсегда удалит все сообщения (нельзя отменить)", block: "Заблокировать" },
      unmatch: { title: "Отменить совпадение с {{name}}?", description: "Это завершит вашу переписку с {{name}}. Вы можете снова встретиться в поиске.", privacy: "{{name}} не будет уведомлён об отмене", button: "Отменить совпадение", needToBlock: "Нужно заблокировать?", successTitle: "Совпадение отменено", successMessage: "Вы отменили совпадение с {{name}}", errorMessage: "Не удалось отменить совпадение. Попробуйте снова." }
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
console.log('\nBatch 2 done (de, es, fr, it, pt, ru)');
