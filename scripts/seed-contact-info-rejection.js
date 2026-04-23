#!/usr/bin/env node
/**
 * Adds two new photo-rejection strings to all 19 locale files:
 *   onboardingPhotos.contactInfoDetected
 *   chat.chatPhoto.contactInfoMessage
 *
 * Triggered when AWS Rekognition DetectText finds a phone number,
 * URL, email, or social handle on an uploaded photo.
 */

const fs = require('fs');
const path = require('path');

const TRANSLATIONS = {
  en: {
    onboarding: 'This photo shows contact info like a phone number, link, email, or social handle — please upload a different photo.',
    chat: 'This photo shows contact info like a phone number, link, email, or social handle and cannot be sent.',
  },
  es: {
    onboarding: 'Esta foto muestra datos de contacto (teléfono, enlace, email o usuario de redes). Por favor, sube otra foto.',
    chat: 'Esta foto muestra datos de contacto (teléfono, enlace, email o usuario de redes) y no se puede enviar.',
  },
  fr: {
    onboarding: "Cette photo affiche des coordonnées (numéro de téléphone, lien, e-mail ou pseudo). Choisis une autre photo.",
    chat: "Cette photo affiche des coordonnées (numéro de téléphone, lien, e-mail ou pseudo) et ne peut pas être envoyée.",
  },
  de: {
    onboarding: 'Dieses Foto zeigt Kontaktdaten (Telefonnummer, Link, E-Mail oder Handle). Bitte lade ein anderes Foto hoch.',
    chat: 'Dieses Foto zeigt Kontaktdaten (Telefonnummer, Link, E-Mail oder Handle) und kann nicht gesendet werden.',
  },
  ar: {
    onboarding: 'تظهر هذه الصورة بيانات تواصل (رقم هاتف، رابط، بريد إلكتروني، أو اسم حساب). يرجى تحميل صورة أخرى.',
    chat: 'تظهر هذه الصورة بيانات تواصل (رقم هاتف، رابط، بريد إلكتروني، أو اسم حساب) ولا يمكن إرسالها.',
  },
  hi: {
    onboarding: 'इस फ़ोटो में संपर्क जानकारी (फ़ोन नंबर, लिंक, ईमेल या सोशल हैंडल) दिख रही है — कृपया दूसरी फ़ोटो अपलोड करें।',
    chat: 'इस फ़ोटो में संपर्क जानकारी (फ़ोन नंबर, लिंक, ईमेल या सोशल हैंडल) है और इसे भेजा नहीं जा सकता।',
  },
  pt: {
    onboarding: 'Esta foto mostra dados de contato (telefone, link, e-mail ou usuário de redes). Envie uma foto diferente.',
    chat: 'Esta foto mostra dados de contato (telefone, link, e-mail ou usuário de redes) e não pode ser enviada.',
  },
  ru: {
    onboarding: 'На этой фотографии указаны контактные данные (телефон, ссылка, email или ник). Загрузите другое фото.',
    chat: 'На этой фотографии указаны контактные данные (телефон, ссылка, email или ник), её нельзя отправить.',
  },
  zh: {
    onboarding: '这张照片显示了联系方式（电话、链接、邮箱或社交账号），请上传其他照片。',
    chat: '这张照片显示了联系方式（电话、链接、邮箱或社交账号），无法发送。',
  },
  tr: {
    onboarding: 'Bu fotoğrafta iletişim bilgisi (telefon, bağlantı, e-posta veya kullanıcı adı) görünüyor. Lütfen başka bir fotoğraf yükle.',
    chat: 'Bu fotoğrafta iletişim bilgisi (telefon, bağlantı, e-posta veya kullanıcı adı) var ve gönderilemez.',
  },
  it: {
    onboarding: 'Questa foto mostra dati di contatto (telefono, link, email o nome utente). Carica una foto diversa.',
    chat: 'Questa foto mostra dati di contatto (telefono, link, email o nome utente) e non può essere inviata.',
  },
  pl: {
    onboarding: 'To zdjęcie pokazuje dane kontaktowe (telefon, link, e-mail lub nick). Prześlij inne zdjęcie.',
    chat: 'To zdjęcie pokazuje dane kontaktowe (telefon, link, e-mail lub nick) i nie można go wysłać.',
  },
  uk: {
    onboarding: 'На цьому фото показано контактні дані (телефон, посилання, email або нік). Завантажте інше фото.',
    chat: 'На цьому фото показано контактні дані (телефон, посилання, email або нік) — його не можна надіслати.',
  },
  he: {
    onboarding: 'בתמונה הזו מופיעים פרטי יצירת קשר (טלפון, קישור, אימייל או שם משתמש). העלה תמונה אחרת.',
    chat: 'בתמונה הזו מופיעים פרטי יצירת קשר (טלפון, קישור, אימייל או שם משתמש) ולא ניתן לשלוח אותה.',
  },
  fa: {
    onboarding: 'این عکس اطلاعات تماس (شماره تلفن، لینک، ایمیل یا نام کاربری) را نشان می‌دهد — لطفاً عکس دیگری آپلود کنید.',
    chat: 'این عکس اطلاعات تماس (شماره تلفن، لینک، ایمیل یا نام کاربری) دارد و قابل ارسال نیست.',
  },
  ur: {
    onboarding: 'اس تصویر میں رابطے کی معلومات (فون نمبر، لنک، ای میل یا سوشل ہینڈل) نظر آ رہی ہے۔ براہ کرم دوسری تصویر اپ لوڈ کریں۔',
    chat: 'اس تصویر میں رابطے کی معلومات (فون نمبر، لنک، ای میل یا سوشل ہینڈل) ہے اور اسے بھیجا نہیں جا سکتا۔',
  },
  bn: {
    onboarding: 'এই ছবিতে যোগাযোগের তথ্য (ফোন নম্বর, লিঙ্ক, ইমেল বা সোশ্যাল হ্যান্ডেল) দেখা যাচ্ছে — দয়া করে অন্য ছবি আপলোড করুন।',
    chat: 'এই ছবিতে যোগাযোগের তথ্য (ফোন নম্বর, লিঙ্ক, ইমেল বা সোশ্যাল হ্যান্ডেল) রয়েছে এবং এটি পাঠানো যাবে না।',
  },
  id: {
    onboarding: 'Foto ini menampilkan info kontak (nomor telepon, tautan, email, atau nama akun). Silakan unggah foto lain.',
    chat: 'Foto ini menampilkan info kontak (nomor telepon, tautan, email, atau nama akun) dan tidak dapat dikirim.',
  },
  ka: {
    onboarding: 'ამ ფოტოზე ჩანს საკონტაქტო ინფორმაცია (ტელეფონი, ბმული, ელფოსტა ან სოციალური ანგარიში) — გთხოვთ, ატვირთოთ სხვა ფოტო.',
    chat: 'ამ ფოტოზე ჩანს საკონტაქტო ინფორმაცია (ტელეფონი, ბმული, ელფოსტა ან სოციალური ანგარიში) და ვერ გაიგზავნება.',
  },
};

const localesDir = path.join(__dirname, '..', 'locales');
let patched = 0;

for (const [lang, strings] of Object.entries(TRANSLATIONS)) {
  const p = path.join(localesDir, `${lang}.json`);
  if (!fs.existsSync(p)) {
    console.warn(`  skip ${lang}.json (not found)`);
    continue;
  }
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));

  json.onboardingPhotos = json.onboardingPhotos || {};
  json.onboardingPhotos.contactInfoDetected = strings.onboarding;

  json.chat = json.chat || {};
  json.chat.chatPhoto = json.chat.chatPhoto || {};
  json.chat.chatPhoto.contactInfoMessage = strings.chat;

  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
  patched++;
  console.log(`  ${lang}.json: patched (2 keys)`);
}

console.log(`\nDone. Patched ${patched} locale file(s) with contact-info rejection copy.`);
