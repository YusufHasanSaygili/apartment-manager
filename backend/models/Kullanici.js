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
    // Kişinin oturduğu daire. Sakin davet koduyla katılırken bağlanır; sakin sadece bu dairenin verisini
    // görebilir, bu yüzden istekten değil buradan okunur. Yönetici için: devirle yönetici olan kişinin dairesi
    // burada kalır (ileride yöneticiliği devrederse bu daireye sakin olarak döner); siteyi kuran yönetici için null.
    daireId: { type: mongoose.Schema.Types.ObjectId, ref: 'Daire', default: null },
    // Daireye giriş tarihi: kişi bu daireye ne zaman sakin olarak geldi (davet koduyla katılma veya yönetici devri).
    // Aidat hesapları "hangi aydan itibaren ödemesi gerekiyor?" sorusunu buna göre cevaplar. Bu alan eklenmeden
    // önce katılan sakinlerde boştur (null); o zaman hesap açma tarihi (createdAt) kullanılır (bkz. daireyeGirisTarihi).
    daireyeGiris: { type: Date, default: null },
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

// Bir kullanıcının daireye giriş tarihini verir: daireyeGiris doluysa o, değilse hesap açma tarihi.
// Sorgularda ikisi de seçilmelidir: .select('daireyeGiris createdAt').
// statics: modelin kendisine eklenen yardımcı fonksiyon (Kullanici.daireyeGirisTarihi(k) diye çağrılır).
kullaniciSemasi.statics.daireyeGirisTarihi = (k) => k.daireyeGiris ?? k.createdAt;

module.exports = mongoose.model('Kullanici', kullaniciSemasi);
