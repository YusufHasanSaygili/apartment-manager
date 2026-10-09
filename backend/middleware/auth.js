// Kimlik ve yetki middleware'leri: korumalı route'larda isteği kimin attığını bulur
// ve o kişinin bu işlemi yapmaya yetkisi olup olmadığını kontrol eder.
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DeletedAccount = require('../models/DeletedAccount');
const { ApiError } = require('./errorHandler');

// Şifre değiştirildikten sonra eski oturumların gördüğü mesaj.
const PASSWORD_CHANGED = 'Şifreniz değiştirildi. Lütfen yeni şifrenizle giriş yapın.';

// Daireden çıkarılan (ve bu yüzden hesabı silinen) sakinin her yerde (giriş, istekler, soket) gördüğü ortak mesaj.
const REMOVED_FROM_FLAT = 'Daireden çıkarıldığınız için hesabınız silinmiştir. Yeni dairenize katılmak için yöneticinizden davet kodu isteyin.';

// requireAuth: sadece giriş yapmış kullanıcıların geçebileceği route'lara konur.
// Mobil uygulama her istekte "Authorization: Bearer <token>" başlığı gönderir.
// throw ile fırlatılan ApiError'ı Express 5 otomatik yakalar ve merkezi hata
// middleware'ine (errorHandler) iletir; kullanıcıya { mesaj } biçiminde cevap döner.
async function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Bu işlem için giriş yapmalısınız.');
  }

  // Token'ın imzası ve süresi kontrol edilir. Sahte veya süresi dolmuş token hata verir.
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.');
  }

  // Kullanıcı her istekte veritabanından okunur: hesap silinmiş veya rolü değişmişse
  // eski token ile işlem yapılamaz.
  const user = await User.findById(payload.id).lean();
  if (!user) {
    // Hesap, sakin daireden çıkarıldığı için silindiyse telefondaki eski oturuma bunun nedeni söylenir.
    const removed = await DeletedAccount.exists({ kullaniciId: payload.id });
    throw new ApiError(401, removed ? REMOVED_FROM_FLAT : 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.');
  }
  // Ek güvenlik: daireye bağlı olmayan bir sakin hesabı (normalde olmaz; daireden çıkarılan hesap silinir) işlem yapamaz.
  // 401 döner: telefon bunu görünce oturumu kapatır ve mesajı gösterir.
  if (user.rol === 'sakin' && !user.daireId) {
    throw new ApiError(401, REMOVED_FROM_FLAT);
  }

  // Token, şifre değiştirilmeden önce verildiyse geçersizdir (örn. şifresi çalınan kişi şifresini sıfırladı;
  // çalan kişinin elindeki eski oturum artık kullanılamaz). 401: telefon oturumu kapatır ve mesajı gösterir.
  if (User.isTokenStale(user, payload.iat)) {
    throw new ApiError(401, PASSWORD_CHANGED);
  }

  // SİTE İZOLASYONU: route'lar siteId ve rolü SADECE buradan (veritabanındaki kayıttan) alır,
  // asla istek gövdesinden veya adresten almaz. Böylece kimse başka bir sitenin verisine
  // istek gövdesine farklı bir siteId yazarak ulaşamaz.
  req.kullanici = {
    id: user._id,
    siteId: user.siteId,
    rol: user.rol,
    daireId: user.daireId, // oturduğu daire (siteyi kuran yönetici için null; devirle yönetici olanda dolu)
    ad: user.ad,
    eposta: user.eposta,
  };
  next();
}

// managerOnly: yönetici işlemlerine (daire kurulumu, aidat onayı, duyuru...) konur.
// requireAuth'den SONRA kullanılır; sakin bu route'lara istek atarsa 403 (yasak) alır.
// Kontrol backend'de yapılır, çünkü ekranda butonu gizlemek tek başına güvenlik sağlamaz.
function managerOnly(req, res, next) {
  if (req.kullanici.rol !== 'yonetici') {
    throw new ApiError(403, 'Bu işlemi sadece site yöneticisi yapabilir.');
  }
  next();
}

// residentOnly: sakin işlemlerine (aidat bildirimi...) konur. requireAuth'den SONRA kullanılır.
// Dairesine bağlı olmayan bir hesap (yönetici veya ek güvenlik olarak dairesiz kalmış bir sakin) 403 alır.
function residentOnly(req, res, next) {
  if (req.kullanici.rol !== 'sakin' || !req.kullanici.daireId) {
    throw new ApiError(403, 'Bu işlemi sadece daire sakini yapabilir.');
  }
  next();
}

module.exports = { requireAuth, managerOnly, residentOnly, DAIREDEN_CIKARILDI: REMOVED_FROM_FLAT, SIFRE_DEGISTI: PASSWORD_CHANGED };
