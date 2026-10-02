// Aidat modeli: sakinin "aidatı verdim" bildirimi. Yönetici onaylayınca o ay ödenmiş sayılır.
const mongoose = require('mongoose');

const aidatSemasi = new mongoose.Schema(
  {
    // Site izolasyonu: her sorgu siteId ile, sakin sorguları ayrıca daireId ile filtrelenir.
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    daireId: { type: mongoose.Schema.Types.ObjectId, ref: 'Daire', required: true },
    ay: { type: Number, required: true, min: 1, max: 12 },
    yil: { type: Number, required: true },
    tutar: { type: Number, required: true, min: 0.01, max: 99999.99 }, // TL
    odemeYontemi: { type: String, enum: ['banka', 'elden'], required: true },
    aciklama: { type: String, trim: true, maxlength: 200, default: '' },
    // bekliyor → yönetici henüz bakmadı; onaylandi → ödendi; reddedildi → sakin tekrar bildirebilir.
    durum: { type: String, enum: ['bekliyor', 'onaylandi', 'reddedildi'], default: 'bekliyor' },
  },
  // tarih: bildirimin gönderildiği an (otomatik eklenir).
  { timestamps: { createdAt: 'tarih', updatedAt: false } }
);

// Sakinin geçmişini hızlı listelemek için: daireye göre, yeniden eskiye.
aidatSemasi.index({ siteId: 1, daireId: 1, tarih: -1 });

// Aynı daire + aynı ay için aynı anda sadece BİR "bekliyor" veya "onaylandi" kayıt olabilir.
// partialFilterExpression: kural sadece bu iki durumdaki kayıtlara uygulanır; reddedilen
// kayıtlar sayılmaz, böylece reddedilen aya yeniden bildirim gönderilebilir.
// Uygulama kontrolüne ek olarak veritabanı seviyesinde garanti verir (butona iki kez basılsa bile).
aidatSemasi.index(
  { daireId: 1, yil: 1, ay: 1 },
  { unique: true, partialFilterExpression: { durum: { $in: ['bekliyor', 'onaylandi'] } } }
);

module.exports = mongoose.model('Aidat', aidatSemasi);
