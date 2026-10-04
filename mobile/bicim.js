// Ortak biçimlendirme yardımcıları: ay adları, para tutarları ve tarihler her ekranda aynı görünsün diye.

export const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

// ay 1–12 → "Ekim 2026"
export const ayAdi = (ay, yil) => `${AY_ADLARI[ay - 1]} ${yil}`;

// Para biçimlendirici bir kez oluşturulur ve tekrar kullanılır (her çağrıda yeniden oluşturmak yavaştır).
// tr-TR: Türkçe biçim → 1500.5 sayısı "₺1.500,50" olarak gösterilir.
const paraBicimlendirici = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
export const paraBicimi = (tutar) => paraBicimlendirici.format(tutar);

// Tarih biçimlendirici (bir kez oluşturulur): sunucudan gelen tarih → "2 Eki 2026 19:57"
const tarihBicimlendirici = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
export const tarihBicimi = (tarih) => tarihBicimlendirici.format(new Date(tarih));

// Sadece saat: "21:04" (sohbet balonlarında; günü, balonların üstündeki gün ayıracı gösterir)
const saatBicimlendirici = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });
export const saatBicimi = (tarih) => saatBicimlendirici.format(new Date(tarih));

// Gün ayıracı yazısı: bugünse "Bugün", dünse "Dün", daha eskiyse "2 Ekim 2026"
const gunBicimlendirici = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
export const gunEtiketi = (tarih) => {
  // toDateString saati atıp sadece günü verir ("Sun Oct 04 2026"); iki tarih aynı gün mü diye böyle karşılaştırılır.
  // Dün için bugünün tarihinden 1 gün geri gidilip tekrar karşılaştırılır.
  const gun = new Date(tarih).toDateString();
  const bugun = new Date();
  if (gun === bugun.toDateString()) return 'Bugün';
  bugun.setDate(bugun.getDate() - 1);
  if (gun === bugun.toDateString()) return 'Dün';
  return gunBicimlendirici.format(new Date(tarih));
};

// Kullanıcının yazdığı Türkçe tutar metnini sayıya çevirir: "1.500,50" → 1500.5
// Binlik ayıracı noktalar silinir, ondalık virgülü noktaya çevrilir. Geçersizse NaN döner.
export const tutarOku = (metin) => Number(metin.replace(/\./g, '').replace(',', '.'));

// Tutar kutusuna yazılırken sadece rakam ve TEK virgül kalır, virgülden sonra en fazla 2 hane.
// Birçok Android klavyesinde ondalık tuşu nokta olduğu için nokta da virgüle çevrilir
// ("750.5" → "750,5"); yoksa nokta silinir ve tutar 10 kat büyük olurdu ("7505").
export const tutarTemizle = (metin) => {
  const [tam, ...kalan] = metin.replace(/\./g, ',').replace(/[^\d,]/g, '').split(',');
  return kalan.length ? `${tam},${kalan.join('').slice(0, 2)}` : tam;
};

// Sayıyı kutuda gösterilecek Türkçe metne çevirir: 750 → "750", 750.5 → "750,50"
export const tutarMetni = (tutar) =>
  tutar == null ? '' : Number.isInteger(tutar) ? String(tutar) : tutar.toFixed(2).replace('.', ',');

// Göreli gün: "Bugün", "Dün", "3 gün önce"; 30 günden eskiyse tarih ("2 Eyl 2026"). Duyuru kartlarında kullanılır.
const kisaTarih = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
export const goreliGun = (tarih) => {
  // gece: tarihi o günün gece yarısına (00:00) çeker; böylece saat farkı değil takvim günü farkı hesaplanır
  // (dün 23:00 ile bugün 01:00 arası 2 saat olsa da "Dün" çıkar). 86400000 = bir gündeki milisaniye.
  const gece = (t) => new Date(new Date(t).toDateString()).getTime();
  const fark = Math.round((gece(Date.now()) - gece(tarih)) / 86400000);
  if (fark <= 0) return 'Bugün';
  if (fark === 1) return 'Dün';
  return fark < 30 ? `${fark} gün önce` : kisaTarih.format(new Date(tarih));
};

// Duyuru kartının tarih bloğu: { gun: "04", ay: "EKİ" }
const ayKisa = new Intl.DateTimeFormat('tr-TR', { month: 'short' });
export const tarihBlogu = (tarih) => {
  const t = new Date(tarih);
  return { gun: String(t.getDate()).padStart(2, '0'), ay: ayKisa.format(t).toLocaleUpperCase('tr-TR') };
};
