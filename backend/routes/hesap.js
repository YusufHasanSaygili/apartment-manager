// Hesap route'ları: site oluşturma (ve ileriki görevlerde giriş, davetle katılma).
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const Site = require('../models/Site');
const Kullanici = require('../models/Kullanici');
const dogrula = require('../middleware/dogrula');
const { kayitSiniri } = require('../middleware/denemeSiniri');

const router = express.Router();

// Giriş yapan kullanıcıya verilen JWT (kimlik kartı). İçinde sadece kullanıcı id'si var;
// site ve rol bilgisi her istekte veritabanından okunur (eski/sahte bilgiye güvenilmez).
// 7 gün sonra geçersiz olur, kullanıcı tekrar giriş yapar.
function tokenUret(kullaniciId) {
  return jwt.sign({ id: kullaniciId }, process.env.JWT_ANAHTARI, { expiresIn: '7d' });
}

// Site oluşturma formunun kuralları: boş alan, geçersiz e-posta, kısa şifre kabul edilmez.
// Şifre en fazla 72 karakter: bcrypt 72 bayttan sonrasını dikkate almaz.
const siteOlusturSemasi = z.object({
  ad: z.string({ error: 'Ad girilmeli' }).trim().min(2, 'Ad en az 2 karakter olmalı').max(50, 'Ad en fazla 50 karakter olabilir'),
  // Önce boşluklar silinip küçük harfe çevrilir, sonra e-posta biçimi kontrol edilir.
  eposta: z.string({ error: 'E-posta girilmeli' }).trim().toLowerCase().max(254, 'E-posta çok uzun').pipe(z.email('Geçerli bir e-posta adresi girin')),
  sifre: z.string({ error: 'Şifre girilmeli' }).min(8, 'Şifre en az 8 karakter olmalı').max(72, 'Şifre en fazla 72 karakter olabilir'),
  siteAdi: z.string({ error: 'Site adı girilmeli' }).trim().min(2, 'Site adı en az 2 karakter olmalı').max(80, 'Site adı en fazla 80 karakter olabilir'),
});

// POST /api/hesap/site-olustur
// Kim kullanabilir: herkes (giriş gerekmez). Yeni bir site ve o sitenin yönetici hesabını
// oluşturur, giriş için token döner. kayitSiniri: aynı IP'den çok sayıda hesap açılmasını engeller.
// dogrula: gövdeyi yukarıdaki şemayla kontrol eder; uymazsa route'a hiç girilmeden 400 döner.
// Sıra önemli: önce deneme sınırı, sonra doğrulama; sınırı aşan istek hiç doğrulanmaz.
router.post('/site-olustur', kayitSiniri, dogrula(siteOlusturSemasi), async (req, res) => {
  const { ad, eposta, sifre, siteAdi } = req.body;

  // Site yöneticiyi, yönetici de siteyi gösterdiği için iki id önceden üretilir.
  const siteId = new mongoose.Types.ObjectId();
  const kullaniciId = new mongoose.Types.ObjectId();

  // Transaction: site ve kullanıcı ya birlikte kaydedilir ya hiç kaydedilmez.
  // Örneğin e-posta zaten kayıtlıysa yarım kalmış, yöneticisiz bir site oluşmaz.
  await mongoose.connection.transaction(async (session) => {
    await Site.create([{ _id: siteId, ad: siteAdi, yoneticiId: kullaniciId }], { session });
    await Kullanici.create(
      [{ _id: kullaniciId, siteId, ad, eposta, sifre, rol: 'yonetici' }],
      { session }
    );
  });

  // 201: yeni kayıt oluşturuldu. Şifre hash'i cevaba hiç eklenmez.
  res.status(201).json({
    token: tokenUret(kullaniciId),
    kullanici: { id: kullaniciId, ad, eposta, rol: 'yonetici' },
    site: { id: siteId, ad: siteAdi },
  });
});

module.exports = router;
