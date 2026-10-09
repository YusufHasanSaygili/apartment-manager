// Duyuru modeli: yöneticinin tüm siteye yaptığı duyurular ("Bugün çöp günü", "Tadilat olacak").
const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    // Duyurunun ait olduğu site: sakinler sadece kendi sitelerinin duyurularını görür.
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    baslik: { type: String, required: true, trim: true, maxlength: 80 },
    icerik: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  // tarih: duyurunun yapıldığı an (otomatik eklenir).
  { timestamps: { createdAt: 'tarih', updatedAt: false } }
);

// Bir sitenin duyurularını yeniden eskiye hızlı listelemek için.
announcementSchema.index({ siteId: 1, tarih: -1 });

module.exports = mongoose.model('Duyuru', announcementSchema);
