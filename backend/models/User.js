// Kullanıcı modeli: yönetici ve sakin hesapları. Her hesap tek bir siteye bağlıdır (siteId).
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
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
    // önce katılan sakinlerde boştur (null); o zaman hesap açma tarihi (createdAt) kullanılır (bkz. moveInDateOf).
    daireyeGiris: { type: Date, default: null },
    // Telefonun Expo push adresi ("ExponentPushToken[...]"). Bildirim bu adrese gönderilir.
    // Giriş yapınca kaydedilir, çıkış yapınca silinir (çıkış yapmış telefona bildirim gitmesin).
    pushToken: { type: String, default: null },
    // Şifremi unuttum: e-postaya gönderilen 6 haneli kodun bcrypt hash'i (kodun kendisi saklanmaz, şifre gibi).
    // select: false → sorgularda varsayılan olarak gelmez, yanlışlıkla cevapla dışarı gönderilemez.
    sifirlamaKodu: { type: String, default: null, select: false },
    // Kodun son geçerlilik anı (gönderildikten 15 dakika sonra); bu andan sonra kod kabul edilmez.
    sifirlamaSonTarih: { type: Date, default: null },
    // Bu kod için yapılan yanlış deneme sayısı; 5'e ulaşınca kod iptal edilir (tahmin edilmesin diye).
    sifirlamaDeneme: { type: Number, default: 0 },
    // Şifrenin en son değiştirildiği an. Bu andan ÖNCE verilmiş oturumlar (token'lar) geçersiz sayılır:
    // şifresi çalınan biri şifresini değiştirince, çalan kişinin telefonundaki oturum da kapanır.
    sifreDegisme: { type: Date, default: null },
  },
  { timestamps: true }
);

// Kaydetmeden önce şifreyi bcrypt ile hash'ler; veritabanına asla düz şifre yazılmaz.
// isModified: sadece şifre yeni girildiyse veya değiştiyse hash'ler (ad değişince tekrar hash'lemez).
// 12: hash'in "maliyeti"; yükseldikçe kaba kuvvetle şifre denemek zorlaşır.
userSchema.pre('save', async function () {
  if (!this.isModified('sifre')) return;
  this.sifre = await bcrypt.hash(this.sifre, 12);
});

// Bir kullanıcının daireye giriş tarihini verir: daireyeGiris doluysa o, değilse hesap açma tarihi.
// Sorgularda ikisi de seçilmelidir: .select('daireyeGiris createdAt').
// statics: modelin kendisine eklenen yardımcı fonksiyon (User.moveInDateOf(k) diye çağrılır).
userSchema.statics.moveInDateOf = (k) => k.daireyeGiris ?? k.createdAt;

// Token şifre değişmeden ÖNCE mi verildi? iat: token'ın verildiği an (saniye cinsinden, JWT'nin kendisi ekler).
// Saniyeye yuvarlanarak karşılaştırılır: şifre değiştikten hemen sonra (aynı saniyede) verilen yeni token geçerli kalsın.
// Bunun bedeli: şifre değişmeden önce ama aynı saniye içinde verilmiş bir token da geçerli kalır (kabul edilen çok küçük risk).
userSchema.statics.isTokenStale = (k, iat) =>
  Boolean(k.sifreDegisme) && iat < Math.floor(new Date(k.sifreDegisme).getTime() / 1000);

module.exports = mongoose.model('Kullanici', userSchema);
