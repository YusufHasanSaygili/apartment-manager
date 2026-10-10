// Daire modeli: her bağımsız bölüm. Sakin, dairesinin davet koduyla uygulamaya katılır.
const mongoose = require('mongoose');

const flatSchema = new mongoose.Schema({
  // Site izolasyonu için her sorgu siteId ile filtrelenir (index: hızlı arama).
  siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
  buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
  flatNumber: { type: Number, required: true }, // binadaki sıra numarası: A3 için 3
  // 6 haneli davet kodu. Sakin katılırken sadece kodu girer (site seçmez), bu yüzden
  // kod TÜM uygulamada benzersiz olmalıdır (unique index).
  inviteCode: { type: String, required: true, unique: true },
  // Kod tek kullanımlıktır: bir sakin katılınca true olur ve kod bir daha kabul edilmez.
  inviteCodeUsed: { type: Boolean, default: false },
  // Dairede oturan sakinin hesabı (henüz kimse katılmadıysa null).
  residentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
});

// Aynı binada aynı numaralı iki daire olamaz.
flatSchema.index({ buildingId: 1, flatNumber: 1 }, { unique: true });

module.exports = mongoose.model('Flat', flatSchema);
