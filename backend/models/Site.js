// Site modeli: uygulamada kurulan her site/apartman için bir kayıt.
// Diğer tüm modeller (kullanıcı, daire, aidat...) siteId ile bir siteye bağlanır;
// böylece her sitenin verisi birbirinden ayrı tutulur.
const mongoose = require('mongoose');

const siteSemasi = new mongoose.Schema(
  {
    ad: { type: String, required: true, trim: true, maxlength: 80 },
    // Sitenin şu anki yöneticisi. Yönetici devrinde (Görev 6.2) bu alan değişir.
    yoneticiId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kullanici', required: true },
  },
  // Oluşturulma tarihi otomatik eklenir; alan adı veri modelindeki gibi "olusturmaTarihi".
  { timestamps: { createdAt: 'olusturmaTarihi', updatedAt: false } }
);

module.exports = mongoose.model('Site', siteSemasi);
