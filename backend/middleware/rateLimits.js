// Deneme sınırı (rate limit): aynı IP adresinden belli bir sürede gelebilecek istek
// sayısını sınırlar. Sunucuyu aşırı istekle yormayı ve otomatik denemeleri engeller.
const { rateLimit } = require('express-rate-limit');

// Genel sınır: bir IP 15 dakikada en fazla 300 istek atabilir; aşarsa 429 hatası alır.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  // Kalan hak bilgisini standart "RateLimit" başlığıyla gönderir, eski başlıkları kapatır.
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Sınır aşılınca dönen cevap; diğer hatalarla aynı { message } biçiminde.
  message: { message: 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.' },
});

// Kayıt sınırı: bir IP 15 dakikada en fazla 10 hesap/site oluşturma denemesi yapabilir.
// Botların toplu sahte hesap açmasını engeller; normal bir kullanıcı bu sınıra takılmaz.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Çok fazla kayıt denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.' },
});

// Giriş sınırı: bir IP 15 dakikada en fazla 10 HATALI giriş denemesi yapabilir.
// Şifreyi deneme-yanılma ile bulmaya çalışan saldırıları yavaşlatır.
// skipSuccessfulRequests: başarılı girişler sayılmaz, normal kullanıcı sınıra takılmaz.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Çok fazla hatalı giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.' },
});

// Davet kodu sınırı: bir IP 15 dakikada en fazla 10 HATALI kod deneyebilir.
// 6 haneli kodların deneme-yanılma ile bulunmasını pratikte imkânsız hale getirir.
const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Çok fazla hatalı kod denemesi. Lütfen 15 dakika sonra tekrar deneyin.' },
});

// E-posta sınırı: bir IP 15 dakikada en fazla 5 "şifre sıfırlama kodu gönder" isteği atabilir.
// Uygulamanın başkalarının e-posta kutusunu kodla doldurmak (spam) için kullanılmasını engeller.
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Çok fazla kod istendi. Lütfen 15 dakika sonra tekrar deneyin.' },
});

module.exports = { generalLimiter, registerLimiter, loginLimiter, codeLimiter, emailLimiter };
