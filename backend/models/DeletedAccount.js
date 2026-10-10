// Silinen hesap izi: yönetici bir sakini daireden çıkarınca hesabı tamamen silinir (ad, e-posta, şifre).
// Kişi sonra giriş yapmaya çalışırsa "Daireden çıkarıldığınız için hesabınız silinmiştir" diyebilmek için
// geriye sadece bu iz kalır. İz kişisel bilgi içermez ve 30 gün sonra veritabanından kendiliğinden silinir.
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const deletedAccountSchema = new mongoose.Schema({
  // E-postanın özeti (HMAC-SHA256): e-postanın kendisi düz metin olarak saklanmaz. Girişte yazılan e-postanın
  // özeti aynı yöntemle alınıp karşılaştırılabilir.
  emailHash: { type: String, required: true, unique: true },
  // Silinen hesabın kimliği: telefonda eski oturum (token) açık kalmışsa, o token'la gelen istekte de
  // aynı mesaj gösterilebilsin diye (token'ın içinde sadece bu kimlik vardır).
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  // expires: MongoDB'nin TTL (yaşam süresi) özelliği; kayıt oluşturulduktan 30 gün sonra kendiliğinden silinir.
  date: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

// E-postayı özete çevirir (küçük harfe çevrilip boşluklar silinerek: girişteki e-postayla aynı biçimde).
// HMAC: özet, sunucunun gizli anahtarıyla (.env'deki JWT_SECRET) alınır. Düz SHA-256 olsaydı, veritabanı
// sızdığında elinde e-posta listesi olan biri özetleri tek tek eşleştirebilirdi; anahtar olmadan bu yapılamaz.
// statics: modelin kendisine eklenen yardımcı fonksiyon (DeletedAccount.hashEmail(email) diye çağrılır).
deletedAccountSchema.statics.hashEmail = (email) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(email.trim().toLowerCase()).digest('hex');

module.exports = mongoose.model('DeletedAccount', deletedAccountSchema);
