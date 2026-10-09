// Ortak biçimlendirme yardımcıları: ay adları, para tutarları ve tarihler her ekranda aynı görünsün diye.

export const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

// month 1–12 → "Ekim 2026"
export const monthLabel = (month, year) => `${MONTH_NAMES[month - 1]} ${year}`;

// Para biçimlendirici bir kez oluşturulur ve tekrar kullanılır (her çağrıda yeniden oluşturmak yavaştır).
// tr-TR: Türkçe biçim → 1500.5 sayısı "₺1.500,50" olarak gösterilir.
const moneyFormatter = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
export const formatMoney = (amount) => moneyFormatter.format(amount);

// Tarih biçimlendirici (bir kez oluşturulur): sunucudan gelen tarih → "2 Eki 2026 19:57"
const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDateTime = (date) => dateTimeFormatter.format(new Date(date));

// Sadece saat: "21:04" (sohbet balonlarında; günü, balonların üstündeki gün ayıracı gösterir)
const timeFormatter = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });
export const formatTime = (date) => timeFormatter.format(new Date(date));

// Gün ayıracı yazısı: bugünse "Bugün", dünse "Dün", daha eskiyse "2 Ekim 2026"
const dayFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
export const dayLabel = (date) => {
  // toDateString saati atıp sadece günü verir ("Sun Oct 04 2026"); iki tarih aynı gün mü diye böyle karşılaştırılır.
  // Dün için bugünün tarihinden 1 gün geri gidilip tekrar karşılaştırılır.
  const day = new Date(date).toDateString();
  const today = new Date();
  if (day === today.toDateString()) return 'Bugün';
  today.setDate(today.getDate() - 1);
  if (day === today.toDateString()) return 'Dün';
  return dayFormatter.format(new Date(date));
};

// Kullanıcının yazdığı Türkçe tutar metnini sayıya çevirir: "1.500,50" → 1500.5
// Binlik ayıracı noktalar silinir, ondalık virgülü noktaya çevrilir. Geçersizse NaN döner.
export const parseAmount = (text) => Number(text.replace(/\./g, '').replace(',', '.'));

// Tutar kutusuna yazılırken sadece rakam ve TEK virgül kalır, virgülden sonra en fazla 2 hane.
// Birçok Android klavyesinde ondalık tuşu nokta olduğu için nokta da virgüle çevrilir
// ("750.5" → "750,5"); yoksa nokta silinir ve tutar 10 kat büyük olurdu ("7505").
export const cleanAmount = (text) => {
  const [whole, ...remaining] = text.replace(/\./g, ',').replace(/[^\d,]/g, '').split(',');
  return remaining.length ? `${whole},${remaining.join('').slice(0, 2)}` : whole;
};

// Sayıyı kutuda gösterilecek Türkçe metne çevirir: 750 → "750", 750.5 → "750,50"
export const amountText = (amount) =>
  amount == null ? '' : Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace('.', ',');

// Göreli gün: "Bugün", "Dün", "3 gün önce"; 30 günden eskiyse tarih ("2 Eyl 2026"). Duyuru kartlarında kullanılır.
const shortDate = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
export const relativeDay = (date) => {
  // midnight: tarihi o günün gece yarısına (00:00) çeker; böylece saat farkı değil takvim günü farkı hesaplanır
  // (dün 23:00 ile bugün 01:00 arası 2 saat olsa da "Dün" çıkar). 86400000 = bir gündeki milisaniye.
  const midnight = (t) => new Date(new Date(t).toDateString()).getTime();
  const diff = Math.round((midnight(Date.now()) - midnight(date)) / 86400000);
  if (diff <= 0) return 'Bugün';
  if (diff === 1) return 'Dün';
  return diff < 30 ? `${diff} gün önce` : shortDate.format(new Date(date));
};

// Duyuru kartının tarih bloğu: { gun: "04", ay: "EKİ" }
const shortMonth = new Intl.DateTimeFormat('tr-TR', { month: 'short' });
export const dateBlock = (date) => {
  const t = new Date(date);
  return { gun: String(t.getDate()).padStart(2, '0'), ay: shortMonth.format(t).toLocaleUpperCase('tr-TR') };
};
