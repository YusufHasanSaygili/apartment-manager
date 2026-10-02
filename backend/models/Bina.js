// Bina modeli: sitedeki her blok (A, B, C...). Daireler binaId ile bir binaya bağlanır.
const mongoose = require('mongoose');

const binaSemasi = new mongoose.Schema({
  // Binanın ait olduğu site. Site izolasyonu için her sorgu bu alanla filtrelenir.
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  ad: { type: String, required: true }, // 'A', 'B', 'C'...
});

// Aynı sitede aynı adla iki bina olamaz (örn. iki tane "A" bloğu).
// Kurulum iki kez aynı anda gönderilse bile veritabanı ikinciyi reddeder.
binaSemasi.index({ siteId: 1, ad: 1 }, { unique: true });

module.exports = mongoose.model('Bina', binaSemasi);
