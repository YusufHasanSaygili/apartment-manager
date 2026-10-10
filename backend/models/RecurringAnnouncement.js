// Tekrarlayan duyuru modeli: yöneticinin belirli günlerde ve saatte kendiliğinden yayınlanmasını
// istediği duyurular ("Her pazartesi 08:00 — Çöp günü"). Vakti gelince normal bir Duyuru oluşturulur
// ve sitedeki herkese push bildirim gider (bkz. services/recurringAnnouncements.js).
const mongoose = require('mongoose');

const recurringAnnouncementSchema = new mongoose.Schema(
  {
    // Site izolasyonu: duyuru sadece bu sitenin duyuru listesine düşer ve bu sitenin sakinlerine gider.
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    // days: duyurunun yayınlanacağı haftanın günleri. JavaScript'teki gibi 0 = Pazar, 1 = Pazartesi ... 6 = Cumartesi.
    // Birden fazla gün seçilebilir; 7 günün hepsi seçilirse "her gün" demektir.
    days: { type: [{ type: Number, min: 0, max: 6 }], required: true },
    // Yayınlanma saati (Türkiye saatiyle): saat 0–23, dakika 0–59. Örn. 08:30 → saat 8, dakika 30.
    hour: { type: Number, required: true, min: 0, max: 23 },
    minute: { type: Number, required: true, min: 0, max: 59 },
    // lastSentAt: en son ne zaman yayınlandığı. Sunucu aynı dakika içinde yeniden başlarsa duyuru
    // ikinci kez yayınlanmasın diye kontrol edilir; ekranda "son gönderim" bilgisi olarak da gösterilir.
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Zamanlanmış görev her dakika "şu gün ve saatte yayınlanacak duyuru var mı?" diye arar; bu index o aramayı hızlandırır.
recurringAnnouncementSchema.index({ days: 1, hour: 1, minute: 1 });

module.exports = mongoose.model('RecurringAnnouncement', recurringAnnouncementSchema);
