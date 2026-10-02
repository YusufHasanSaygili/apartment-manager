// Aidat yönetim route'ları (yönetici tarafı): bekleyen "aidatı verdim" bildirimlerini görme,
// onaylama, reddetme ve seçilen aya göre renkli daire haritası.
const express = require('express');
const { z } = require('zod');
const Aidat = require('../models/Aidat');
const Bina = require('../models/Bina');
const Daire = require('../models/Daire');
const Kullanici = require('../models/Kullanici');
const dogrula = require('../middleware/dogrula');
const { girisGerekli, sadeceYonetici } = require('../middleware/kimlik');
const { ApiHatasi } = require('../middleware/hataYonetimi');

const router = express.Router();

// Bu dosyadaki tüm route'lar sadece giriş yapmış YÖNETİCİ içindir.
// siteId her zaman req.kullanici'dan alınır: yönetici sadece kendi sitesinin bildirimlerini görür ve değiştirir.
router.use(girisGerekli, sadeceYonetici);

// GET /api/yonetim/aidatlar/bekleyen
// Kim kullanabilir: yönetici. Sitesindeki onay bekleyen bildirimleri, en eski en üstte olacak şekilde
// döner (önce gelen önce işlensin). Her bildirime daire adı (örn. "A3") ve sakinin adı eklenir.
router.get('/bekleyen', async (req, res) => {
  const { siteId } = req.kullanici;

  // Site verisinin tamamı siteId ile filtrelenir. Daire/bina/sakin adları tek tek değil,
  // toplu sorgularla alınır (her bildirim için ayrı sorgu atmak yavaş olurdu).
  const [bildirimler, daireler, binalar, sakinler] = await Promise.all([
    Aidat.find({ siteId, durum: 'bekliyor' }).sort({ tarih: 1 }).lean(),
    Daire.find({ siteId }).select('binaId daireNo').lean(),
    Bina.find({ siteId }).select('ad').lean(),
    Kullanici.find({ siteId, rol: 'sakin' }).select('ad daireId').lean(),
  ]);

  // id → ad eşlemeleri (Map): bir bildirimin dairesini ve sakinini hızlıca bulmak için.
  const binaAdi = new Map(binalar.map((b) => [String(b._id), b.ad]));
  const daireAdi = new Map(daireler.map((d) => [String(d._id), `${binaAdi.get(String(d.binaId))}${d.daireNo}`]));
  const sakinAdi = new Map(sakinler.map((k) => [String(k.daireId), k.ad]));

  res.json(
    bildirimler.map((a) => ({
      id: a._id,
      daire: daireAdi.get(String(a.daireId)) ?? '—',
      sakin: sakinAdi.get(String(a.daireId)) ?? '—', // sakin hesabını sildiyse ad bulunmaz
      ay: a.ay,
      yil: a.yil,
      tutar: a.tutar,
      odemeYontemi: a.odemeYontemi,
      aciklama: a.aciklama,
      tarih: a.tarih,
    }))
  );
});

// Harita isteğinin kuralları: adresteki ?ay=10&yil=2026. Adres parametreleri metin olarak gelir;
// z.coerce metni sayıya çevirip sonra kontrol eder.
const haritaSemasi = z.object({
  ay: z.coerce.number({ error: 'Ay geçersiz' }).int().min(1, 'Ay geçersiz').max(12, 'Ay geçersiz'),
  yil: z.coerce.number({ error: 'Yıl geçersiz' }).int().min(2000, 'Yıl geçersiz').max(2100, 'Yıl geçersiz'),
});

// GET /api/yonetim/aidatlar/harita?ay=10&yil=2026
// Kim kullanabilir: yönetici. Seçilen ay için sitedeki her dairenin aidat durumunu bina bina döner:
//   odendi   → o ay için onaylanmış bildirim var (yeşil)
//   bekliyor → onay bekleyen bildirim var (sarı)
//   odenmedi → bildirim yok veya sadece reddedilmiş bildirim var, dairede sakin var (kırmızı)
//   bos      → dairede henüz sakin yok ve ödeme kaydı da yok (gri)
// Sıra önemli: önce (router.use ile) giriş ve yönetici kontrolü, sonra dogrula ile ay/yıl kontrolü yapılır;
// geçersiz ay/yıl gelirse istek veritabanına hiç gitmeden 400 hatası döner.
router.get('/harita', dogrula(haritaSemasi, 'query'), async (req, res) => {
  const { siteId } = req.kullanici;
  const { ay, yil } = req.query;

  // Reddedilen bildirimler durumu etkilemediği için hiç alınmaz.
  const [binalar, daireler, aidatlar] = await Promise.all([
    Bina.find({ siteId }).sort({ ad: 1 }).lean(),
    Daire.find({ siteId }).sort({ daireNo: 1 }).select('binaId daireNo davetKoduKullanildi').lean(),
    Aidat.find({ siteId, ay, yil, durum: { $in: ['bekliyor', 'onaylandi'] } }).select('daireId durum').lean(),
  ]);

  // daireId → o ayki durum ('bekliyor' veya 'onaylandi'). Bir dairede ikisinden en fazla biri olabilir.
  const aidatDurumu = new Map(aidatlar.map((a) => [String(a.daireId), a.durum]));

  // Her dairenin rengini belirleyen durum hesabı.
  const durumBul = (d) => {
    const kayit = aidatDurumu.get(String(d._id));
    if (kayit === 'onaylandi') return 'odendi';
    if (kayit === 'bekliyor') return 'bekliyor';
    return d.davetKoduKullanildi ? 'odenmedi' : 'bos';
  };

  // Daireler bina bina gruplanır. binaId bir ObjectId olduğu için === yerine .equals ile karşılaştırılır
  // (=== iki ayrı nesneyi karşılaştırır ve hep false döner).
  const ozet = { odendi: 0, bekliyor: 0, odenmedi: 0, bos: 0 };
  const sonuc = binalar.map((bina) => ({
    id: bina._id,
    ad: bina.ad,
    daireler: daireler
      .filter((d) => d.binaId.equals(bina._id))
      .map((d) => {
        const durum = durumBul(d);
        ozet[durum] += 1; // alttaki "Ödedi 12 · Bekliyor 3..." özeti için sayılır
        return { id: d._id, ad: `${bina.ad}${d.daireNo}`, durum };
      }),
  }));

  res.json({ binalar: sonuc, ozet });
});

// Bekleyen bir bildirimin durumunu değiştirir. Sadece yöneticinin KENDİ sitesindeki ve hâlâ
// "bekliyor" olan bildirim değişir; tek bir veritabanı işlemiyle bulunup güncellenir.
// Neden tek işlem: butona iki kez basılırsa veya iki cihazdan aynı anda işlenirse, ilki durumu
// değiştirdiği için ikincisi "bekliyor" kaydı bulamaz ve 404 alır (bildirim iki kez sonuçlanmaz).
// Başka sitenin bildirimi, olmayan bir id veya zaten sonuçlanmış bildirim → 404 (var olduğu belli edilmez).
async function durumDegistir(req, res, yeniDurum) {
  const aidat = await Aidat.findOneAndUpdate(
    { _id: req.params.id, siteId: req.kullanici.siteId, durum: 'bekliyor' },
    { durum: yeniDurum },
    { returnDocument: 'after' } // güncellenmiş hali döner (yeni durum cevapta gönderilsin diye)
  );
  if (!aidat) {
    throw new ApiHatasi(404, 'Bildirim bulunamadı veya zaten sonuçlandırılmış.');
  }
  res.json({ id: aidat._id, durum: aidat.durum });
}

// POST /api/yonetim/aidatlar/:id/onayla
// Kim kullanabilir: yönetici. Bildirimi onaylar; o ay o daire için "ödendi" sayılır.
// Aynı daire + ay için ikinci bir onaylı kayıt oluşamaz: Aidat modelindeki kural bir ayda
// tek bekleyen/onaylı kayda izin verir.
// durumDegistir async olduğu için 404 hatası Express 5 tarafından yakalanıp merkezi hata yakalayıcıya gider.
router.post('/:id/onayla', (req, res) => durumDegistir(req, res, 'onaylandi'));

// POST /api/yonetim/aidatlar/:id/reddet
// Kim kullanabilir: yönetici. Bildirimi reddeder; sakin aynı ay için yeniden bildirim gönderebilir.
router.post('/:id/reddet', (req, res) => durumDegistir(req, res, 'reddedildi'));

module.exports = router;
