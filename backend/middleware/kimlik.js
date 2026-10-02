// Kimlik ve yetki middleware'leri: korumalı route'larda isteği kimin attığını bulur
// ve o kişinin bu işlemi yapmaya yetkisi olup olmadığını kontrol eder.
const jwt = require('jsonwebtoken');
const Kullanici = require('../models/Kullanici');
const { ApiHatasi } = require('./hataYonetimi');

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

module.exports = { girisGerekli, sadeceYonetici };
