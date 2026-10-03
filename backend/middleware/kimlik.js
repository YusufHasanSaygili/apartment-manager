// Kimlik ve yetki middleware'leri: korumalı route'larda isteği kimin attığını bulur
// ve o kişinin bu işlemi yapmaya yetkisi olup olmadığını kontrol eder.
const jwt = require('jsonwebtoken');
const Kullanici = require('../models/Kullanici');
const { ApiHatasi } = require('./hataYonetimi');

// Daireden çıkarılan sakinin her yerde (giriş, istekler, soket) gördüğü ortak mesaj.
const DAIREDEN_CIKARILDI = 'Bu hesap daireden çıkarılmıştır. Yeni dairenize katılmak için yöneticinizden davet kodu isteyin.';

// girisGerekli: sadece giriş yapmış kullanıcıların geçebileceği route'lara konur.
// Mobil uygulama her istekte "Authorization: Bearer <token>" başlığı gönderir.
// throw ile fırlatılan ApiHatasi'ni Express 5 otomatik yakalar ve merkezi hata
// middleware'ine (hataYonetimi) iletir; kullanıcıya { mesaj } biçiminde cevap döner.
async function girisGerekli(req, res, next) {
  const [tur, token] = (req.headers.authorization || '').split(' ');
  if (tur !== 'Bearer' || !token) {
    throw new ApiHatasi(401, 'Bu işlem için giriş yapmalısınız.');
  }

  // Token'ın imzası ve süresi kontrol edilir. Sahte veya süresi dolmuş token hata verir.
  let icerik;
  try {
    icerik = jwt.verify(token, process.env.JWT_ANAHTARI);
  } catch {
    throw new ApiHatasi(401, 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.');
  }

  // Kullanıcı her istekte veritabanından okunur: hesap silinmiş veya rolü değişmişse
  // eski token ile işlem yapılamaz.
  const kullanici = await Kullanici.findById(icerik.id).lean();
  if (!kullanici) {
    throw new ApiHatasi(401, 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.');
  }
  // Yönetici bu sakini daireden çıkardıysa (daireId boşaldıysa) hesap artık hiçbir işlem yapamaz.
  // 401 döner: telefon bunu görünce oturumu kapatır ve mesajı gösterir.
  if (kullanici.rol === 'sakin' && !kullanici.daireId) {
    throw new ApiHatasi(401, DAIREDEN_CIKARILDI);
  }

  // SİTE İZOLASYONU: route'lar siteId ve rolü SADECE buradan (veritabanındaki kayıttan) alır,
  // asla istek gövdesinden veya adresten almaz. Böylece kimse başka bir sitenin verisine
  // istek gövdesine farklı bir siteId yazarak ulaşamaz.
  req.kullanici = {
    id: kullanici._id,
    siteId: kullanici.siteId,
    rol: kullanici.rol,
    daireId: kullanici.daireId, // sakinin dairesi (yönetici için null)
    ad: kullanici.ad,
    eposta: kullanici.eposta,
  };
  next();
}

// sadeceYonetici: yönetici işlemlerine (daire kurulumu, aidat onayı, duyuru...) konur.
// girisGerekli'den SONRA kullanılır; sakin bu route'lara istek atarsa 403 (yasak) alır.
// Kontrol backend'de yapılır, çünkü ekranda butonu gizlemek tek başına güvenlik sağlamaz.
function sadeceYonetici(req, res, next) {
  if (req.kullanici.rol !== 'yonetici') {
    throw new ApiHatasi(403, 'Bu işlemi sadece site yöneticisi yapabilir.');
  }
  next();
}

// sadeceSakin: sakin işlemlerine (aidat bildirimi...) konur. girisGerekli'den SONRA kullanılır.
// Dairesine bağlı olmayan bir hesap (yönetici veya daireden çıkarılmış sakin) 403 alır.
function sadeceSakin(req, res, next) {
  if (req.kullanici.rol !== 'sakin' || !req.kullanici.daireId) {
    throw new ApiHatasi(403, 'Bu işlemi sadece daire sakini yapabilir.');
  }
  next();
}

module.exports = { girisGerekli, sadeceYonetici, sadeceSakin, DAIREDEN_CIKARILDI };
