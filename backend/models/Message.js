// Mesaj modeli: yönetici ile sakin arasındaki birebir yazışmalar (WhatsApp benzeri düz metin).
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    // Mesajın ait olduğu site: her sorgu bu alanla filtrelenir, başka sitenin mesajı görülemez.
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    // senderId / recipientId: mesajı yazan ve alan kullanıcı. Gönderen her zaman token'dan alınır,
    // böylece kimse başkası adına mesaj kaydedemez.
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // content: düz metin; trim baştaki/sondaki boşlukları siler, maxlength aşırı uzun mesajı veritabanı seviyesinde de engeller.
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    // read: alıcı mesajı gördü mü. false → gönderende ✓ (iletildi), true → ✓✓ (görüldü) görünür.
    read: { type: Boolean, default: false },
  },
  // date: mesajın gönderildiği an (otomatik eklenir).
  { timestamps: { createdAt: 'date', updatedAt: false } }
);

// İki kişi arasındaki sohbeti tarihe göre hızlı getirmek için.
messageSchema.index({ siteId: 1, senderId: 1, recipientId: 1, date: -1 });

module.exports = mongoose.model('Message', messageSchema);
