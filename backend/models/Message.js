// Mesaj modeli: yönetici ile sakin arasındaki birebir yazışmalar (WhatsApp benzeri düz metin).
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    // Mesajın ait olduğu site: her sorgu bu alanla filtrelenir, başka sitenin mesajı görülemez.
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    // gonderenId / aliciId: mesajı yazan ve alan kullanıcı. Gönderen her zaman token'dan alınır,
    // böylece kimse başkası adına mesaj kaydedemez.
    gonderenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kullanici', required: true },
    aliciId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kullanici', required: true },
    // icerik: düz metin; trim baştaki/sondaki boşlukları siler, maxlength aşırı uzun mesajı veritabanı seviyesinde de engeller.
    icerik: { type: String, required: true, trim: true, maxlength: 1000 },
    // okundu: alıcı mesajı gördü mü. false → gönderende ✓ (iletildi), true → ✓✓ (görüldü) görünür.
    okundu: { type: Boolean, default: false },
  },
  // tarih: mesajın gönderildiği an (otomatik eklenir).
  { timestamps: { createdAt: 'tarih', updatedAt: false } }
);

// İki kişi arasındaki sohbeti tarihe göre hızlı getirmek için.
messageSchema.index({ siteId: 1, gonderenId: 1, aliciId: 1, tarih: -1 });

module.exports = mongoose.model('Mesaj', messageSchema);
