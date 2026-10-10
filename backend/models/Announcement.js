// Duyuru modeli: yöneticinin tüm siteye yaptığı duyurular ("Bugün çöp günü", "Tadilat olacak").
const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    // Duyurunun ait olduğu site: sakinler sadece kendi sitelerinin duyurularını görür.
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  // date: duyurunun yapıldığı an (otomatik eklenir).
  { timestamps: { createdAt: 'date', updatedAt: false } }
);

// Bir sitenin duyurularını yeniden eskiye hızlı listelemek için.
announcementSchema.index({ siteId: 1, date: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
