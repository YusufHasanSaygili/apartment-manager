// Aidat modeli: sakinin "aidatı verdim" bildirimi. Yönetici onaylayınca o ay ödenmiş sayılır.
// Yönetici bir ayı elle "ödendi" işaretlerse de buraya onaylı bir kayıt yazılır (odemeYontemi: 'yonetici').
const mongoose = require('mongoose');

const aidatSemasi = new mongoose.Schema(
  {
    // Site izolasyonu: her sorgu siteId ile, sakin sorguları ayrıca daireId ile filtrelenir.
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    daireId: { type: mongoose.Schema.Types.ObjectId, ref: 'Daire', required: true },
    ay: { type: Number, required: true, min: 1, max: 12 },
    yil: { type: Number, required: true },
    // TL. Elle işaretlemede sitenin aidat tutarı yazılır; tutar belirlenmemişse 0 olabilir.
    tutar: { type: Number, required: true, min: 0, max: 99999.99 },
    // banka / elden → sakinin bildirimi; yonetici → yönetici takvimden elle "ödendi" işaretledi.
    odemeYontemi: { type: String, enum: ['banka', 'elden', 'yonetici'], required: true },
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

// Bir dairenin seçilen yıldaki 12 ayının durumunu hesaplar (takvim ekranı için).
// Yönetici ve sakin route'ları aynı hesabı kullansın diye modelde tek yerde tanımlı (statics).
// Her ay için: odendi (onaylı kayıt var), bekliyor (onay bekleyen var) veya odenmedi.
aidatSemasi.statics.yillikTakvim = async function (siteId, daireId, yil) {
  // Reddedilenler durumu etkilemez; siteId filtresi site izolasyonu için.
  const kayitlar = await this.find({ siteId, daireId, yil, durum: { $in: ['bekliyor', 'onaylandi'] } }).lean();
  const ayaGore = new Map(kayitlar.map((k) => [k.ay, k]));

  return Array.from({ length: 12 }, (_, i) => {
    const kayit = ayaGore.get(i + 1);
    if (!kayit) return { ay: i + 1, durum: 'odenmedi' };
    return {
      ay: i + 1,
      durum: kayit.durum === 'onaylandi' ? 'odendi' : 'bekliyor',
      tutar: kayit.tutar,
      odemeYontemi: kayit.odemeYontemi,
    };
  });
};

module.exports = mongoose.model('Aidat', aidatSemasi);
