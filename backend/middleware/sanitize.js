// MongoDB sorgu enjeksiyonu koruması.
// Saldırgan şifre yerine { "$ne": "" } gibi bir nesne gönderirse MongoDB bunu
// "boş olmayan herhangi bir şifre" diye yorumlayabilir. Bu middleware, gelen verideki
// "$" ile başlayan veya "." içeren anahtarları siler; böylece veri sorgu operatörüne dönüşemez.

// Nesnenin içini (iç içe nesneler ve diziler dahil) gezip tehlikeli anahtarları siler.
function sanitizeKeys(input) {
  if (input && typeof input === 'object') {
    for (const key of Object.keys(input)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete input[key];
      } else {
        sanitizeKeys(input[key]);
      }
    }
  }
  return input;
}

// Her istekte body ve query temizlenir. (req.params temizlenmez: URL parametreleri
// her zaman metindir, nesne olamaz; ayrıca bu aşamada henüz doldurulmamıştır.)
function sanitize(req, res, next) {
  sanitizeKeys(req.body);

  // Express 5'te req.query her okunuşta yeniden üretilir; temizlenmiş halini
  // kalıcı yapmak için req.query'yi temiz kopyayla değiştiriyoruz.
  Object.defineProperty(req, 'query', {
    value: sanitizeKeys({ ...req.query }),
    writable: true,
    configurable: true,
  });

  next();
}

module.exports = sanitize;
