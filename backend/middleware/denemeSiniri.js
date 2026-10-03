// Deneme sınırı (rate limit): aynı IP adresinden belli bir sürede gelebilecek istek
// sayısını sınırlar. Sunucuyu aşırı istekle yormayı ve otomatik denemeleri engeller.
const { rateLimit } = require('express-rate-limit');

// Genel sınır: bir IP 15 dakikada en fazla 300 istek atabilir; aşarsa 429 hatası alır.
const genelSinir = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  // Kalan hak bilgisini standart "RateLimit" başlığıyla gönderir, eski başlıkları kapatır.
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Sınır aşılınca dönen cevap; diğer hatalarla aynı { mesaj } biçiminde.
  message: { mesaj: 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.' },
});

// Kayıt sınırı: bir IP 15 dakikada en fazla 10 hesap/site oluşturma denemesi yapabilir.
// Botların toplu sahte hesap açmasını engeller; normal bir kullanıcı bu sınıra takılmaz.
const kayitSiniri = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mesaj: 'Çok fazla kayıt denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.' },
});

// Giriş sınırı: bir IP 15 dakikada en fazla 10 HATALI giriş denemesi yapabilir.
// Şifreyi deneme-yanılma ile bulmaya çalışan saldırıları yavaşlatır.
// skipSuccessfulRequests: başarılı girişler sayılmaz, normal kullanıcı sınıra takılmaz.
const girisSiniri = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mesaj: 'Çok fazla hatalı giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.' },
});

// Davet kodu sınırı: bir IP 15 dakikada en fazla 10 HATALI kod deneyebilir.
// 6 haneli kodların deneme-yanılma ile bulunmasını pratikte imkânsız hale getirir.
const kodSiniri = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { mesaj: 'Çok fazla hatalı kod denemesi. Lütfen 15 dakika sonra tekrar deneyin.' },
});

module.exports = { genelSinir, kayitSiniri, girisSiniri, kodSiniri };
