// Aidat modeli: sakinin "aidatı verdim" bildirimi. Yönetici onaylayınca o ay ödenmiş sayılır.
// Yönetici bir ayı elle "ödendi" işaretlerse de buraya onaylı bir kayıt yazılır (odemeYontemi: 'yonetici').
const mongoose = require('mongoose');

const dueSchema = new mongoose.Schema(
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
dueSchema.index({ siteId: 1, daireId: 1, tarih: -1 });

// Aynı daire + aynı ay için aynı anda sadece BİR "bekliyor" veya "onaylandi" kayıt olabilir.
// partialFilterExpression: kural sadece bu iki durumdaki kayıtlara uygulanır; reddedilen
// kayıtlar sayılmaz, böylece reddedilen aya yeniden bildirim gönderilebilir.
// Uygulama kontrolüne ek olarak veritabanı seviyesinde garanti verir (butona iki kez basılsa bile).
dueSchema.index(
  { daireId: 1, yil: 1, ay: 1 },
  { unique: true, partialFilterExpression: { durum: { $in: ['bekliyor', 'onaylandi'] } } }
);

// Bir tarihi "ay sırası" sayısına çevirir: yıl × 12 + ay. İki ayı tek bir sayıyla karşılaştırmayı sağlar
// (büyük olan daha ileri bir ay). Örn. Aralık 2026 → 2026 × 12 + 12. Ay, sunucunun saat dilimine göre bulunur.
dueSchema.statics.monthIndex = (date) => date.getFullYear() * 12 + date.getMonth() + 1;

// Bir dairenin seçilen yıldaki 12 ayının durumunu hesaplar (takvim ekranı için).
// Yönetici ve sakin route'ları aynı hesabı kullansın diye modelde tek yerde tanımlı (statics).
// Her ay için: odendi (onaylı kayıt var), bekliyor (onay bekleyen var), odenmedi (sakin varken ödenmemiş)
// veya bos (ödeme kaydı yok ve o ay dairede sakin yoktu: hiç sakin yok ya da sakin daha sonra katıldı).
// joinDate: dairedeki sakinin hesabını açtığı tarih; dairede sakin yoksa null.
dueSchema.statics.yearlyCalendar = async function (siteId, flatId, year, joinDate) {
  // Reddedilenler durumu etkilemez; siteId filtresi site izolasyonu için.
  const records = await this.find({ siteId, daireId: flatId, yil: year, durum: { $in: ['bekliyor', 'onaylandi'] } }).lean();
  const byMonth = new Map(records.map((k) => [k.ay, k]));

  // Sakinin katıldığı ayın sırası; sakin yoksa Infinity (hiçbir ay "katıldıktan sonra" sayılmaz).
  const joinIndex = joinDate ? this.monthIndex(joinDate) : Infinity;

  return Array.from({ length: 12 }, (_, i) => {
    const record = byMonth.get(i + 1);
    if (!record) return { ay: i + 1, durum: year * 12 + i + 1 < joinIndex ? 'bos' : 'odenmedi' };
    return {
      ay: i + 1,
      durum: record.durum === 'onaylandi' ? 'odendi' : 'bekliyor',
      tutar: record.tutar,
      odemeYontemi: record.odemeYontemi,
    };
  });
};

module.exports = mongoose.model('Aidat', dueSchema);
