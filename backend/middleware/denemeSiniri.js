// Deneme sınırı (rate limit): aynı IP adresinden belli bir sürede gelebilecek istek
// sayısını sınırlar. Sunucuyu aşırı istekle yormayı ve otomatik denemeleri engeller.
// Giriş, kayıt ve kod girme için daha sıkı sınırlar ilgili görevlerde eklenecek.
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

module.exports = { genelSinir };
