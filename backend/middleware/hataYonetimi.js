// Merkezi hata yönetimi: sunucudaki tüm hatalar burada toplanır ve mobil uygulamaya
// her zaman aynı biçimde ({ mesaj }) döner. Böylece mobil taraf hatayı tek bir yerden
// okuyup kullanıcıya gösterebilir; sunucu da hata yüzünden çökmez.

// ApiHatasi: route'larda bilerek fırlatılan hatalar için (örn. 404 "Bulunamadı").
// Hem kullanıcıya gösterilecek mesajı hem de HTTP durum kodunu taşır.
class ApiHatasi extends Error {
  constructor(durumKodu, mesaj) {
    super(mesaj);
    this.durumKodu = durumKodu;
  }
}

// Tanımlı olmayan bir adrese istek gelirse çalışır ve 404 hatası üretir.
function bulunamadi(req, res, next) {
  next(new ApiHatasi(404, 'Bulunamadı'));
}

// Hata yakalayıcı: Express 4 parametreli middleware'i hata yakalayıcı olarak tanır.
// Express 5'te async route'larda fırlatılan hatalar da otomatik olarak buraya gelir.
// eslint-disable-next-line no-unused-vars
function hataYakalayici(err, req, res, next) {
  // Cevabın bir kısmı zaten gönderildiyse ikinci cevap yazılamaz; Express'e devredilir.
  if (res.headersSent) {
    return next(err);
  }

  // Bizim bilerek fırlattığımız hata: mesajı olduğu gibi kullanıcıya iletilir.
  if (err instanceof ApiHatasi) {
    return res.status(err.durumKodu).json({ mesaj: err.message });
  }

  // express.json() bozuk JSON'u okuyamadı (örn. eksik tırnak, yarım gövde).
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ mesaj: 'İstek verisi okunamadı (geçersiz JSON).' });
  }

  // İstek gövdesi server.js'deki boyut sınırını aştı.
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ mesaj: 'Gönderilen veri çok büyük.' });
  }

  // Express'in kendi ürettiği diğer istek hataları (desteklenmeyen karakter seti vb.).
  // expose: true → hata kullanıcıya gösterilebilir, iç bilgi içermez.
  if (err.expose && err.status) {
    return res.status(err.status).json({ mesaj: 'İstek işlenemedi.' });
  }

  // MongoDB 11000: benzersiz (unique) olması gereken bir değer zaten kayıtlı.
  // 409 (çakışma) döner; hata loglanmaz çünkü içinde kullanıcının e-postası bulunur.
  if (err.code === 11000) {
    const mesaj = err.keyPattern?.eposta
      ? 'Bu e-posta adresiyle zaten bir hesap var.'
      : 'Bu kayıt zaten mevcut.';
    return res.status(409).json({ mesaj });
  }

  // Mongoose: geçersiz kimlik (ObjectId) gönderildi. Kaydın varlığını belli etmemek
  // için "bulunamadı" denir (site izolasyonu kuralı).
  if (err.name === 'CastError') {
    return res.status(404).json({ mesaj: 'Bulunamadı' });
  }

  // Mongoose: şemaya uymayan veri kaydedilmeye çalışıldı.
  if (err.name === 'ValidationError') {
    return res.status(400).json({ mesaj: 'Gönderilen bilgiler geçersiz.' });
  }

  // Beklenmeyen hata: ayrıntı sadece sunucu konsoluna yazılır, kullanıcıya iç bilgi
  // (dosya yolu, veritabanı hatası vb.) sızdırılmaz.
  console.error('Beklenmeyen hata:', err);
  return res.status(500).json({ mesaj: 'Sunucuda bir hata oluştu. Lütfen tekrar deneyin.' });
}

module.exports = { ApiHatasi, bulunamadi, hataYakalayici };
