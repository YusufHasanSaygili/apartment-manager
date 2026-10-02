// Kullanıcı modeli: yönetici ve sakin hesapları. Her hesap tek bir siteye bağlıdır (siteId).
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const kullaniciSemasi = new mongoose.Schema(
  {
    // Hesabın ait olduğu site. Site izolasyonunda tüm sorgular bu alana göre filtrelenir.
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true, index: true },
    ad: { type: String, required: true, trim: true, maxlength: 50 },
    // Giriş e-posta ile yapıldığı için tüm uygulamada benzersizdir (unique index).
    // lowercase: "Ali@x.com" ile "ali@x.com" aynı hesap sayılır.
    eposta: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Şifrenin hash'lenmiş hali. select: false → sorgularda varsayılan olarak gelmez,
    // böylece şifre hash'i yanlışlıkla bir cevapla dışarı gönderilemez.
    sifre: { type: String, required: true, select: false },
    // Yetki kontrolleri bu alana göre yapılır. Kayıtta istekten alınmaz, route'ta sabit verilir
    // (site oluşturan → 'yonetici'), böylece kimse kendini yönetici yapamaz.
    rol: { type: String, enum: ['yonetici', 'sakin'], required: true },
    // Sakinin dairesi (davet koduyla katılırken bağlanır). Yönetici için null.
    // Sakin sadece bu dairenin verisini görebilir; bu yüzden istekten değil buradan okunur.
    daireId: { type: mongoose.Schema.Types.ObjectId, ref: 'Daire', default: null },
    // Telefonun Expo push adresi ("ExponentPushToken[...]"). Bildirim bu adrese gönderilir.
    // Giriş yapınca kaydedilir, çıkış yapınca silinir (çıkış yapmış telefona bildirim gitmesin).
    pushToken: { type: String, default: null },
  },
  { timestamps: true }
);

// Kaydetmeden önce şifreyi bcrypt ile hash'ler; veritabanına asla düz şifre yazılmaz.
// isModified: sadece şifre yeni girildiyse veya değiştiyse hash'ler (ad değişince tekrar hash'lemez).
// 12: hash'in "maliyeti"; yükseldikçe kaba kuvvetle şifre denemek zorlaşır.
kullaniciSemasi.pre('save', async function () {
  if (!this.isModified('sifre')) return;
  this.sifre = await bcrypt.hash(this.sifre, 12);
});

module.exports = mongoose.model('Kullanici', kullaniciSemasi);
