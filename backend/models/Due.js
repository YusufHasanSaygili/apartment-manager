// Aidat modeli: sakinin "aidatı verdim" bildirimi. Yönetici onaylayınca o ay ödenmiş sayılır.
// Yönetici bir ayı elle "ödendi" işaretlerse de buraya onaylı bir kayıt yazılır (paymentMethod: 'manager').
const mongoose = require('mongoose');

const dueSchema = new mongoose.Schema(
  {
    // Site izolasyonu: her sorgu siteId ile, sakin sorguları ayrıca flatId ile filtrelenir.
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    flatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flat', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    // TL. Elle işaretlemede sitenin aidat tutarı yazılır; tutar belirlenmemişse 0 olabilir.
    amount: { type: Number, required: true, min: 0, max: 99999.99 },
    // 'bank' (banka havalesi) / 'cash' (elden) → sakinin bildirimi; 'manager' → yönetici takvimden elle "ödendi" işaretledi.
    paymentMethod: { type: String, enum: ['bank', 'cash', 'manager'], required: true },
    note: { type: String, trim: true, maxlength: 200, default: '' },
    // 'pending' → yönetici henüz bakmadı; 'approved' → ödendi; 'rejected' → sakin tekrar bildirebilir.
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  // date: bildirimin gönderildiği an (otomatik eklenir).
  { timestamps: { createdAt: 'date', updatedAt: false } }
);

// Sakinin geçmişini hızlı listelemek için: daireye göre, yeniden eskiye.
dueSchema.index({ siteId: 1, flatId: 1, date: -1 });

// Aynı daire + aynı ay için aynı anda sadece BİR 'pending' veya 'approved' kayıt olabilir.
// partialFilterExpression: kural sadece bu iki durumdaki kayıtlara uygulanır; reddedilen
// kayıtlar sayılmaz, böylece reddedilen aya yeniden bildirim gönderilebilir.
// Uygulama kontrolüne ek olarak veritabanı seviyesinde garanti verir (butona iki kez basılsa bile).
dueSchema.index(
  { flatId: 1, year: 1, month: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'approved'] } } }
);

// Bir tarihi "ay sırası" sayısına çevirir: yıl × 12 + ay. İki ayı tek bir sayıyla karşılaştırmayı sağlar
// (büyük olan daha ileri bir ay). Örn. Aralık 2026 → 2026 × 12 + 12. Ay, sunucunun saat dilimine göre bulunur.
dueSchema.statics.monthIndex = (date) => date.getFullYear() * 12 + date.getMonth() + 1;

// Bir dairenin seçilen yıldaki 12 ayının durumunu hesaplar (takvim ekranı için).
// Yönetici ve sakin route'ları aynı hesabı kullansın diye modelde tek yerde tanımlı (statics).
// Her ay için: 'paid' (onaylı kayıt var), 'pending' (onay bekleyen var), 'unpaid' (sakin varken ödenmemiş)
// veya 'empty' (ödeme kaydı yok ve o ay dairede sakin yoktu: hiç sakin yok ya da sakin daha sonra katıldı).
// joinDate: dairedeki sakinin hesabını açtığı tarih; dairede sakin yoksa null.
dueSchema.statics.yearlyCalendar = async function (siteId, flatId, year, joinDate) {
  // Reddedilenler durumu etkilemez; siteId filtresi site izolasyonu için.
  const records = await this.find({ siteId, flatId, year, status: { $in: ['pending', 'approved'] } }).lean();
  const byMonth = new Map(records.map((k) => [k.month, k]));

  // Sakinin katıldığı ayın sırası; sakin yoksa Infinity (hiçbir ay "katıldıktan sonra" sayılmaz).
  const joinIndex = joinDate ? this.monthIndex(joinDate) : Infinity;

  return Array.from({ length: 12 }, (_, i) => {
    const record = byMonth.get(i + 1);
    if (!record) return { month: i + 1, status: year * 12 + i + 1 < joinIndex ? 'empty' : 'unpaid' };
    return {
      month: i + 1,
      status: record.status === 'approved' ? 'paid' : 'pending',
      amount: record.amount,
      paymentMethod: record.paymentMethod,
    };
  });
};

module.exports = mongoose.model('Due', dueSchema);
