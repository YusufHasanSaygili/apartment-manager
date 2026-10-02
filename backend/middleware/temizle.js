// MongoDB sorgu enjeksiyonu koruması.
// Saldırgan şifre yerine { "$ne": "" } gibi bir nesne gönderirse MongoDB bunu
// "boş olmayan herhangi bir şifre" diye yorumlayabilir. Bu middleware, gelen verideki
// "$" ile başlayan veya "." içeren anahtarları siler; böylece veri sorgu operatörüne dönüşemez.

// Nesnenin içini (iç içe nesneler ve diziler dahil) gezip tehlikeli anahtarları siler.
function anahtarlariTemizle(veri) {
  if (veri && typeof veri === 'object') {
    for (const anahtar of Object.keys(veri)) {
      if (anahtar.startsWith('$') || anahtar.includes('.')) {
        delete veri[anahtar];
      } else {
        anahtarlariTemizle(veri[anahtar]);
      }
    }
  }
  return veri;
}

// Her istekte body ve query temizlenir. (req.params temizlenmez: URL parametreleri
// her zaman metindir, nesne olamaz; ayrıca bu aşamada henüz doldurulmamıştır.)
function temizle(req, res, next) {
  anahtarlariTemizle(req.body);

  // Express 5'te req.query her okunuşta yeniden üretilir; temizlenmiş halini
  // kalıcı yapmak için req.query'yi temiz kopyayla değiştiriyoruz.
  Object.defineProperty(req, 'query', {
    value: anahtarlariTemizle({ ...req.query }),
    writable: true,
    configurable: true,
  });

  next();
}

module.exports = temizle;
