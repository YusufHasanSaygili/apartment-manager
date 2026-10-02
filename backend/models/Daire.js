// Daire modeli: her bağımsız bölüm. Sakin, dairesinin davet koduyla uygulamaya katılır.
const mongoose = require('mongoose');

const daireSemasi = new mongoose.Schema({
  // Site izolasyonu için her sorgu siteId ile filtrelenir (index: hızlı arama).
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
  binaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bina', required: true },
  daireNo: { type: Number, required: true }, // binadaki sıra numarası: A3 için 3
  // 6 haneli davet kodu. Sakin katılırken sadece kodu girer (site seçmez), bu yüzden
  // kod TÜM uygulamada benzersiz olmalıdır (unique index).
  davetKodu: { type: String, required: true, unique: true },
  // Kod tek kullanımlıktır: bir sakin katılınca true olur ve kod bir daha kabul edilmez.
  davetKoduKullanildi: { type: Boolean, default: false },
  // Dairede oturan sakinin hesabı (henüz kimse katılmadıysa null).
  sakinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kullanici', default: null },
});

// Aynı binada aynı numaralı iki daire olamaz.
daireSemasi.index({ binaId: 1, daireNo: 1 }, { unique: true });

module.exports = mongoose.model('Daire', daireSemasi);
