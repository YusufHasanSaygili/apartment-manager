// Ortak veri doğrulama middleware'i: route'a gelen veriyi bir zod şemasıyla kontrol eder.
// Veri şemaya uymuyorsa (boş alan, geçersiz ay, aşırı uzun metin vb.) istek route'a hiç
// ulaşmaz, kullanıcıya 400 hatasıyla anlaşılır bir mesaj döner.
//
// Kullanım örneği (ileriki görevlerde):
//   const sema = z.object({ ay: z.number().int().min(1).max(12) });
//   router.post('/', dogrula(sema), aidatBildir);
const { z } = require('zod');
const { ApiHatasi } = require('./hataYonetimi');

// zod'un varsayılan hata mesajları İngilizcedir; Türkçe dil paketini açıyoruz.
// Şemada özel mesaj verilirse (örn. { error: 'Ay 1 ile 12 arasında olmalı' }) o kullanılır.
z.config(z.locales.tr());

// kaynak: verinin isteğin neresinden okunacağı ('body', 'params' veya 'query').
function dogrula(sema, kaynak = 'body') {
  return (req, res, next) => {
    // safeParse: hata fırlatmak yerine { success, data, error } döner.
    const sonuc = sema.safeParse(req[kaynak] ?? {});

    if (!sonuc.success) {
      // Kullanıcıya ilk hatanın mesajı gösterilir (örn. "Ay 1 ile 12 arasında olmalı").
      return next(new ApiHatasi(400, sonuc.error.issues[0].message));
    }

    // Doğrulanmış veri isteğe geri yazılır. zod şemada olmayan alanları attığı için
    // route'a sadece beklenen alanlar ulaşır (örn. biri "rol": "yonetici" gönderemez).
    Object.defineProperty(req, kaynak, {
      value: sonuc.data,
      writable: true,
      configurable: true,
    });
    next();
  };
}

// Ortak para tutarı kuralı (aidat bildirimi ve sitenin aidat tutarı ayarı kullanır):
// 0'dan büyük, en fazla 99.999,99 TL ve en fazla 2 ondalık (kuruş) basamak.
// refine: zod'un hazır kuralı olmayan özel bir kontrol ekler.
// Tutar 100 ile çarpılınca tam sayı olmalı (750,50 → 75050). 1e-6 toleransı, bilgisayarın
// ondalık hesap hatası yüzünden (örn. 0.1 * 100 = 10.000000000000002) doğru tutarın reddedilmesini önler.
const tutarKurali = z
  .number({ error: 'Tutar bir sayı olmalı' })
  .positive("Tutar 0'dan büyük olmalı")
  .max(99999.99, 'Tutar en fazla 99.999,99 TL olabilir')
  .refine((t) => Math.abs(t * 100 - Math.round(t * 100)) < 1e-6, 'Tutar en fazla 2 kuruş basamağı içerebilir');

module.exports = dogrula;
module.exports.tutarKurali = tutarKurali;
