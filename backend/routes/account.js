// Hesap route'ları: site oluşturma, davet koduyla katılma, giriş, oturum sahibini sorgulama,
// telefonun push bildirim adresini (push token) kaydetme/silme, hesabı kalıcı olarak silme ve şifremi unuttum.
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const Site = require('../models/Site');
const User = require('../models/User');
const Building = require('../models/Building');
const Flat = require('../models/Flat');
const DeletedAccount = require('../models/DeletedAccount');
const validate = require('../middleware/validate');
const crypto = require('node:crypto');
const { registerLimiter, loginLimiter, codeLimiter, emailLimiter } = require('../middleware/rateLimits');
const { sendEmail } = require('../services/email');
const { requireAuth, REMOVED_FROM_FLAT, PASSWORD_CHANGED } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
// disconnectUser: hesap silinince veya şifre sıfırlanınca aynı hesabın başka telefonlardaki
// soket bağlantısını kapatmak için (önce olay gönderir, telefon oturumu kapatıp mesajı gösterir).
const { disconnectUser } = require('../socket');
const { detachResident } = require('../services/flat');

const router = express.Router();

// Giriş yapan kullanıcıya verilen JWT (kimlik kartı). İçinde sadece kullanıcı id'si var;
// site ve rol bilgisi her istekte veritabanından okunur (eski/sahte bilgiye güvenilmez).
// 7 gün sonra geçersiz olur, kullanıcı tekrar giriş yapar.
function createToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// Giriş, katılma ve otomatik giriş route'larının ortak cevabı: kullanıcı, site ve (sakinse) daire.
// Site ve daire, kullanıcının kendi siteId/flatId'si ile aranır (site izolasyonu).
// Site silinmişse null döner; route'lar bunu "oturum geçersiz" sayar.
async function sessionInfo(user) {
  const site = await Site.findById(user.siteId).lean();
  if (!site) return null;

  let flat = null;
  if (user.flatId) {
    const d = await Flat.findOne({ _id: user.flatId, siteId: user.siteId }).lean();
    const building = d && (await Building.findOne({ _id: d.buildingId, siteId: user.siteId }).lean());
    if (building) flat = { id: d._id, name: `${building.name}${d.flatNumber}` }; // örn. "A3"
  }

  return {
    // _id: veritabanı kaydından gelirse; id: requireAuth'un hazırladığı req.user'dan gelirse.
    user: { id: user._id ?? user.id, name: user.name, email: user.email, role: user.role },
    site: { id: site._id, name: site.name },
    flat,
  };
}

// Hesap formlarındaki ortak alan kuralları: boş alan, geçersiz e-posta, kısa şifre kabul edilmez.
// Şifre en fazla 72 karakter: bcrypt 72 bayttan sonrasını dikkate almaz.
const accountFields = {
  name: z.string({ error: 'Ad girilmeli' }).trim().min(2, 'Ad en az 2 karakter olmalı').max(50, 'Ad en fazla 50 karakter olabilir'),
  // Önce boşluklar silinip küçük harfe çevrilir, sonra e-posta biçimi kontrol edilir.
  email: z.string({ error: 'E-posta girilmeli' }).trim().toLowerCase().max(254, 'E-posta çok uzun').pipe(z.email('Geçerli bir e-posta adresi girin')),
  password: z.string({ error: 'Şifre girilmeli' }).min(8, 'Şifre en az 8 karakter olmalı').max(72, 'Şifre en fazla 72 karakter olabilir'),
};

// Site oluşturma formu: hesap alanları + site adı.
const createSiteSchema = z.object({
  ...accountFields,
  siteName: z.string({ error: 'Site adı girilmeli' }).trim().min(2, 'Site adı en az 2 karakter olmalı').max(80, 'Site adı en fazla 80 karakter olabilir'),
});

// POST /api/account/create-site
// Kim kullanabilir: herkes (giriş gerekmez). Yeni bir site ve o sitenin yönetici hesabını
// oluşturur, giriş için token döner. registerLimiter: aynı IP'den çok sayıda hesap açılmasını engeller.
// validate: gövdeyi yukarıdaki şemayla kontrol eder; uymazsa route'a hiç girilmeden 400 döner.
// Sıra önemli: önce deneme sınırı, sonra doğrulama; sınırı aşan istek hiç doğrulanmaz.
router.post('/create-site', registerLimiter, validate(createSiteSchema), async (req, res) => {
  const { name, email, password, siteName } = req.body;

  // Site yöneticiyi, yönetici de siteyi gösterdiği için iki id önceden üretilir.
  const siteId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  // Transaction: site ve kullanıcı ya birlikte kaydedilir ya hiç kaydedilmez.
  // Örneğin e-posta zaten kayıtlıysa yarım kalmış, yöneticisiz bir site oluşmaz.
  await mongoose.connection.transaction(async (session) => {
    // Bu e-postanın eski bir "silinen hesap" izi varsa kaldırılır (kişi yeni hesap açtı, eski mesaj artık geçersiz).
    await DeletedAccount.deleteOne({ emailHash: DeletedAccount.hashEmail(email) }, { session });
    await Site.create([{ _id: siteId, name: siteName, managerId: userId }], { session });
    await User.create(
      [{ _id: userId, siteId, name, email, password, role: 'manager' }],
      { session }
    );
  });

  // 201: yeni kayıt oluşturuldu. Şifre hash'i cevaba hiç eklenmez.
  res.status(201).json({
    token: createToken(userId),
    user: { id: userId, name, email, role: 'manager' },
    site: { id: siteId, name: siteName },
    flat: null, // yöneticinin dairesi yok
  });
});

// Davet koduyla katılma formu: 6 haneli kod + hesap alanları.
const joinSchema = z.object({
  inviteCode: z
    .string({ error: 'Davet kodu girilmeli' })
    .trim()
    .regex(/^\d{6}$/, 'Davet kodu 6 haneli bir sayı olmalı'),
  ...accountFields,
});

// POST /api/account/join
// Kim kullanabilir: herkes (giriş gerekmez). Sakin dairesinin davet koduyla hesap açar;
// hesap kodun ait olduğu siteye ve daireye otomatik bağlanır. codeLimiter: kod tahmin etmeye
// çalışan hatalı denemeleri sınırlar. Sıra yine önemli: önce deneme sınırı, sonra validate.
router.post('/join', codeLimiter, validate(joinSchema), async (req, res) => {
  const { inviteCode, name, email, password } = req.body;
  const userId = new mongoose.Types.ObjectId();

  // Transaction: kodu "kullanıldı" yapmak ve hesabı açmak birlikte olur. Hesap açılamazsa
  // (örn. e-posta zaten kayıtlı) kod da kullanılmamış haline geri döner.
  await mongoose.connection.transaction(async (session) => {
    // TEK KULLANIMLIK KOD: "kullanılmamış bu kodu bul VE kullanıldı yap" tek bir veritabanı
    // işlemidir. Aynı kodu aynı anda iki kişi gönderse bile sadece biri başarılı olur.
    // $ne: true → "true olmayan": alan false olan VE bu alan eklenmeden önce oluşturulmuş
    // (alanı hiç olmayan) daireler de bulunur.
    // returnDocument: 'after' → güncellenmiş daire döner; session → işlem transaction'ın parçası olur.
    const flat = await Flat.findOneAndUpdate(
      { inviteCode, inviteCodeUsed: { $ne: true } },
      { inviteCodeUsed: true, residentId: userId },
      { session, returnDocument: 'after' }
    );
    // Kod yoksa da kullanılmışsa da aynı mesaj: hangi kodların var olduğu belli edilmez.
    if (!flat) {
      throw new ApiError(400, 'Davet kodu geçersiz veya kullanılmış.');
    }

    // Bu e-postanın eski bir "silinen hesap" izi varsa kaldırılır (kişi yeni dairesine yeni hesapla katıldı).
    await DeletedAccount.deleteOne({ emailHash: DeletedAccount.hashEmail(email) }, { session });
    // siteId ve flatId istekten değil, kodun ait olduğu daireden alınır.
    await User.create(
      // moveInDate: sakinin bu daireye geldiği an; aidat hesapları bu aydan itibaren ödeme bekler.
      [{ _id: userId, siteId: flat.siteId, flatId: flat._id, moveInDate: new Date(), name, email, password, role: 'resident' }],
      { session }
    );
  });

  // Cevap giriş route'uyla aynı biçimdedir (token + kullanıcı + site + daire); mobil uygulama
  // bununla sakini doğrudan oturum açmış olarak sakin ana ekranına geçirir.
  const user = await User.findById(userId).lean();
  const info = await sessionInfo(user);
  // Site bu arada silinmişse (çok düşük ihtimal) eksik cevap gönderilmez.
  if (!info) throw new ApiError(400, 'Davet kodu geçersiz veya kullanılmış.');
  res.status(201).json({ token: createToken(userId), ...info });
});

// Giriş formunun kuralları. Şifrede uzunluk kuralı yok: yanlış şifre zaten aşağıda reddedilir.
const loginSchema = z.object({
  email: z.string({ error: 'E-posta girilmeli' }).trim().toLowerCase().max(254, 'E-posta çok uzun'),
  password: z.string({ error: 'Şifre girilmeli' }).min(1, 'Şifre girilmeli').max(72, 'Şifre çok uzun'),
});

// Kullanıcı bulunamazsa da bcrypt karşılaştırması yapılsın diye kullanılan sahte hash.
// Böylece cevap süresi "böyle bir e-posta var mı" bilgisini sızdırmaz.
// Sunucu açılırken bir kez üretilir (gerçek bir hash olmalı ki karşılaştırma gerçekten yapılsın).
const DUMMY_HASH = bcrypt.hashSync('no-user', 12);

// POST /api/account/login
// Kim kullanabilir: herkes. E-posta ve şifre doğruysa token ve kullanıcı/site bilgisini döner.
// loginLimiter: hatalı denemeleri sınırlar (şifre tahmin saldırısına karşı).
// Sıra yine önemli: önce deneme sınırı, sonra validate ile gövde kontrolü.
router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  // select('+password'): şifre hash'i normalde sorgulara gelmez, sadece burada karşılaştırma için alınır.
  const user = await User.findOne({ email }).select('+password');
  // bcrypt.compare: girilen şifreyi hash'leyip kayıtlı hash ile karşılaştırır (şifre çözülmez).
  const passwordValid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

  // Hesap yoksa ama bu e-posta daireden çıkarıldığı için silinen bir hesaba aitse nedeni söylenir.
  // Yazılan e-postanın özeti (HMAC-SHA256) alınıp DeletedAccount izleriyle karşılaştırılır; e-postanın kendisi
  // hiçbir yerde saklanmadığı için iz kişisel bilgi taşımaz. 403 (yasak): giriş bu hesap için artık mümkün değil.
  // Bilinçli tercih (kullanıcı kararı): hesap silindiği için şifre kontrol edilemez; e-postayı bilen biri o kişinin
  // son 30 gün içinde daireden çıkarıldığını öğrenebilir. İz 30 gün sonra silindiği için bu süreyle sınırlıdır.
  if (!user && (await DeletedAccount.exists({ emailHash: DeletedAccount.hashEmail(email) }))) {
    throw new ApiError(403, REMOVED_FROM_FLAT);
  }
  // E-posta mı şifre mi yanlış, bilinçli olarak söylenmez: saldırgan hangi e-postaların
  // kayıtlı olduğunu öğrenemez.
  if (!user || !passwordValid) {
    throw new ApiError(401, 'E-posta veya şifre hatalı.');
  }

  const info = await sessionInfo(user);
  // Sitesi silinmiş bir hesapla giriş yapılamaz (sunucu hata vermesin diye kontrol).
  if (!info) throw new ApiError(401, 'E-posta veya şifre hatalı.');

  res.json({ token: createToken(user._id), ...info });
});

// Push token kuralı: Expo'nun verdiği biçimde olmalı (başka bir adrese bildirim gönderilemesin).
const pushTokenSchema = z.object({
  token: z
    .string({ error: 'Token girilmeli' })
    .max(200, 'Token geçersiz')
    .regex(/^Expo(nent)?PushToken\[.+\]$/, 'Token geçersiz'),
});

// PUT /api/account/push-token
// Kim kullanabilir: giriş yapmış herkes. Telefonun push adresini kullanıcının hesabına kaydeder;
// duyuru vb. bildirimler bu adrese gönderilir. Aynı telefon daha önce başka bir hesapta kayıtlıysa
// oradan silinir (telefonda önce A sonra B giriş yaptıysa, A'nın bildirimleri bu telefona gelmesin).
// O temizlikte siteId filtresi bilerek yok: telefon başka sitedeki bir hesapta kayıtlı olabilir.
// Sadece pushToken alanı null yapılır, başka sitenin hiçbir verisi okunmaz veya cevapta gönderilmez.
// Kendi hesabı ise istekten değil token'dan gelen req.user.id ile güncellenir.
router.put('/push-token', requireAuth, validate(pushTokenSchema), async (req, res) => {
  const { token } = req.body;
  await User.updateMany({ pushToken: token, _id: { $ne: req.user.id } }, { pushToken: null });
  await User.updateOne({ _id: req.user.id }, { pushToken: token });
  res.status(204).end();
});

// DELETE /api/account/push-token
// Kim kullanabilir: giriş yapmış herkes. Çıkış yaparken çağrılır; bu hesaba artık bildirim gitmez.
router.delete('/push-token', requireAuth, async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { pushToken: null });
  res.status(204).end();
});

// GET /api/account/me
// Kim kullanabilir: giriş yapmış herkes. Token'ın sahibini, sitesini ve (sakinse) dairesini döner.
// Mobil uygulama açılışta kayıtlı token'ın hâlâ geçerli olup olmadığını bununla kontrol eder.
router.get('/me', requireAuth, async (req, res) => {
  // Bilgiler requireAuth'un veritabanından doldurduğu req.user'dan alınır, istekten değil.
  const info = await sessionInfo(req.user);
  // Site silinmişse oturum geçersiz sayılır; mobil uygulama kayıtlı token'ı siler.
  if (!info) throw new ApiError(401, 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.');

  res.json(info);
});

// Şifremi unuttum formlarının kuralları. E-posta, giriş formundakiyle aynı biçimde işlenir (küçük harf, boşluksuz).
const requestCodeSchema = z.object({ email: accountFields.email });
const resetSchema = z.object({
  email: accountFields.email,
  code: z.string({ error: 'Kod girilmeli' }).trim().regex(/^\d{6}$/, 'Kod 6 haneli bir sayı olmalı'),
  newPassword: accountFields.password, // en az 8, en fazla 72 karakter (kayıttaki kuralla aynı)
});

// Kodun geçerlilik süresi (15 dakika) ve izin verilen yanlış deneme sayısı.
const CODE_LIFETIME = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
// Hangi e-postaların kayıtlı olduğu belli olmasın diye kod isteğine HER ZAMAN aynı cevap döner.
const CODE_SENT_MESSAGE = 'Bu e-posta kayıtlıysa 6 haneli bir kod gönderildi. Gelen kutunuzu ve spam klasörünü kontrol edin.';

// POST /api/account/password-reset/request-code
// Kim kullanabilir: herkes (giriş gerekmez). E-posta kayıtlıysa 6 haneli bir kod üretir, hash'ini 15 dakika
// geçerli olarak kaydeder ve kodu e-postaya gönderir. emailLimiter: başkalarının kutusunu doldurmayı engeller.
router.post('/password-reset/request-code', emailLimiter, validate(requestCodeSchema), async (req, res) => {
  const { email } = req.body;
  // Cevap HEMEN ve her durumda aynı döner: e-posta kayıtlı olsun olmasın aynı mesaj ve aynı süre.
  // (E-postanın gönderilmesi birkaç saniye sürer; bekleseydik kayıtlı e-postalar daha geç cevap alırdı.)
  res.json({ message: CODE_SENT_MESSAGE });

  try {
    const user = await User.findOne({ email });
    if (!user) return;
    // crypto.randomInt: tahmin edilemeyen 6 haneli kod; padStart: "048213" gibi başı sıfırlı kodlar 6 hane kalsın.
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    // Kodun kendisi değil bcrypt hash'i saklanır; yeni kod istenirse eskisi geçersiz olur ve deneme sayacı sıfırlanır.
    user.resetCode = await bcrypt.hash(code, 10);
    user.resetExpiresAt = new Date(Date.now() + CODE_LIFETIME);
    user.resetAttempts = 0;
    await user.save();
    await sendEmail({
      to: email,
      subject: 'Apartmanım şifre sıfırlama kodunuz',
      text: `Merhaba ${user.name},\n\nŞifre sıfırlama kodunuz: ${code}\n\nKod 15 dakika geçerlidir ve bir kez kullanılabilir. Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın; şifreniz değişmez.\n\nApartmanım`,
    });
  } catch (error) {
    // Cevap zaten gönderildiği için hata kullanıcıya iletilemez; sunucu konsoluna yazılır (kod/şifre yazılmaz).
    console.error('Şifre sıfırlama e-postası gönderilemedi:', error.message);
  }
});

// POST /api/account/password-reset
// Kim kullanabilir: herkes (giriş gerekmez). E-posta + 6 haneli kod + yeni şifre alır. Kod doğru ve süresi
// geçmemişse şifre değişir, kod silinir (tek kullanımlık) ve kullanıcı doğrudan giriş yapmış olur (token döner).
// codeLimiter: hatalı denemeleri IP başına sınırlar; ayrıca her kod için en fazla 5 yanlış deneme hakkı vardır.
router.post('/password-reset', codeLimiter, validate(resetSchema), async (req, res) => {
  const { email, code, newPassword } = req.body;
  const INVALID_CODE_MESSAGE = 'Kod hatalı veya süresi dolmuş. Yeni kod isteyebilirsiniz.';

  // '+resetCode': modelde select: false olan kod hash'i, karşılaştırma için bu sorguda özellikle istenir.
  const user = await User.findOne({ email }).select('+resetCode');
  // Kod her durumda bcrypt ile karşılaştırılır (kayıtsız e-postada sahte hash ile): cevap süresi aynı kalır,
  // "bu e-posta kayıtlı mı?" sorusu cevabın ne kadar sürdüğünden anlaşılamaz (girişteki yöntemle aynı).
  const codeValid = await bcrypt.compare(code, user?.resetCode ?? DUMMY_HASH);
  // Kayıtlı olmayan e-posta, hiç kod istenmemiş veya süresi dolmuş kod: hepsi aynı mesajı alır.
  // Deneme hakkı bitmiş kod da geçersizdir (aynı anda gönderilen istekler sayacı 5'in üstüne çıkarmış olabilir).
  if (
    !user?.resetCode ||
    user.resetExpiresAt < new Date() ||
    user.resetAttempts >= MAX_ATTEMPTS
  ) {
    throw new ApiError(400, INVALID_CODE_MESSAGE);
  }

  if (!codeValid) {
    // Yanlış kod: deneme sayısı artar; 5'e ulaşınca kod tamamen iptal edilir (kalan haklarla tahmin edilemesin).
    // $inc: sayaç veritabanında tek adımda artırılır. Önce okuyup sonra yazsaydık, aynı anda gelen istekler
    // aynı eski değeri okuyup 5'ten fazla deneme yapabilirdi. returnDocument 'after': artırılmış değer döner.
    const current = await User.findOneAndUpdate(
      { _id: user._id },
      { $inc: { resetAttempts: 1 } },
      { returnDocument: 'after' }
    );
    if (current.resetAttempts >= MAX_ATTEMPTS) {
      await User.updateOne({ _id: user._id }, { resetCode: null, resetExpiresAt: null });
    }
    throw new ApiError(400, INVALID_CODE_MESSAGE);
  }

  // Doğru kod: yeni şifre atanır (modeldeki pre('save') onu bcrypt ile hash'ler), kod silinir.
  user.password = newPassword;
  user.resetCode = null;
  user.resetExpiresAt = null;
  user.resetAttempts = 0;
  // passwordChangedAt: bu andan önce verilmiş tüm oturumlar (başka telefonlardaki dahil) geçersiz olur.
  user.passwordChangedAt = new Date();
  await user.save();
  // O an açık olan diğer telefonlara haber verilir ve bağlantıları kapatılır; uygulama oturumu kapatıp mesajı gösterir.
  disconnectUser(user._id, 'passwordChanged', { message: PASSWORD_CHANGED });

  // Şifre değişti; kullanıcı ayrıca giriş yapmak zorunda kalmasın diye oturum bilgisi ve token döner.
  const info = await sessionInfo(user);
  // Kullanıcının sitesi silinmişse oturum açılamaz; token verilmez.
  if (!info) throw new ApiError(400, INVALID_CODE_MESSAGE);
  res.json({ token: createToken(user._id), ...info });
});

// Hesap silme formunun kuralı: şifre tekrar girilmeli.
const deleteAccountSchema = z.object({
  password: z.string({ error: 'Şifre girilmeli' }).min(1, 'Şifre girilmeli').max(72, 'Şifre çok uzun'),
});

// DELETE /api/account
// Kim kullanabilir: giriş yapmış SAKİN (yönetici önce yöneticiliği devretmelidir → 403).
// Hesabı kalıcı olarak siler. Şifre tekrar istenir: telefonu eline alan başka biri hesabı silemesin.
// - Silinenler: kişisel veriler (ad, e-posta, şifre, bildirim adresi; yani hesabın kendisi) ve kişinin mesajları.
// - Korunanlar: aidat kayıtları. Kişiye değil daireye bağlı oldukları için (flatId) yönetici takviminde durmaya devam eder.
// - Daire boşaltılır ve yeni davet kodu alır; dairenin yeni sakini yeni kodla katılır.
// Hepsi tek transaction'da yapılır (ya hepsi ya hiçbiri).
// loginLimiter: şifre karşılaştırıldığı için girişteki deneme sınırı burada da uygulanır (şifre tahminine karşı).
router.delete('/', loginLimiter, requireAuth, validate(deleteAccountSchema), async (req, res) => {
  // id, siteId ve role istekten değil, requireAuth'un token'dan bulduğu veritabanı kaydından gelir.
  const { id, siteId, role } = req.user;
  // YETKİ KONTROLÜ: mobil ekran yöneticiye silme formunu hiç göstermez ama asıl engel burasıdır.
  // Yönetici silinirse site yöneticisiz kalırdı; bu yüzden önce devir şarttır.
  if (role === 'manager') {
    throw new ApiError(403, 'Yönetici hesabı silinemez. Önce yöneticiliği bir sakine devredin.');
  }

  // select('+password'): şifre hash'i normalde sorgulara gelmez, sadece karşılaştırma için alınır.
  // Yanlış şifrede 400 döner (401 değil): 401 telefonda oturumu kapatırdı, kullanıcı sadece tekrar denemeli.
  const user = await User.findById(id).select('+password flatId');
  // Aynı hesap az önce başka bir telefondan silindiyse kayıt yoktur (sunucu hata vermesin diye kontrol).
  if (!user) throw new ApiError(401, 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.');
  if (!(await bcrypt.compare(req.body.password, user.password))) {
    throw new ApiError(400, 'Şifre hatalı.');
  }

  // Hesap ve mesajlar silinir, daire boşaltılıp yeni kod alır; kendi silen sakin için iz bırakılmaz.
  // residentId: id → daire gerçekten bu kişiye kayıtlıysa sıfırlanır (bu arada daireye başkası geldiyse dokunulmaz).
  // flatId kontrolü sadece güvenlik önlemi; sakinde hep doludur. Ayrıntılar services/flat.js içindeki detachResident'ta.
  await detachResident({
    siteId,
    resident: user,
    flatFilter: user.flatId ? { _id: user.flatId, residentId: id } : null,
  });

  // Aynı hesap başka bir telefonda da açıksa o uygulamaya haber verilir ve bağlantısı kapatılır.
  disconnectUser(id, 'accountDeleted', { message: 'Hesabınız ve kişisel bilgileriniz silindi.' });
  // 204: işlem başarılı, cevapta gönderilecek veri yok.
  res.status(204).end();
});

module.exports = router;
