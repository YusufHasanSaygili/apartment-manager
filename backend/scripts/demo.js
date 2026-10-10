// Demo verisi betiği: sunum için dolu bir örnek site ("Lale Sitesi") kurar.
// Çalıştırma: backend klasöründe `npm run demo`. Sunucunun açık olması gerekmez; veritabanına doğrudan bağlanır.
// (npm betiği `node --env-file=.env` ile çalışır; MONGODB_URI gibi ayarlar .env'den gelir.)
// Her çalıştığında önce eski demo sitesini (ve sadece onu) siler, sonra baştan kurar; diğer sitelere dokunmaz.
// Tarihler bugüne göre hesaplanır: betik hangi gün çalışırsa çalışsın harita "bu ay" için üç renkli görünür.
const dns = require('node:dns');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Site = require('../models/Site');
const User = require('../models/User');
const Building = require('../models/Building');
const Flat = require('../models/Flat');
const Due = require('../models/Due');
const Announcement = require('../models/Announcement');
const Message = require('../models/Message');
const RecurringAnnouncement = require('../models/RecurringAnnouncement');
const { generateInviteCodes } = require('../services/inviteCode');

// server.js'teki gibi: .env'de DNS_SERVERS varsa Atlas adresi bu DNS sunucularıyla çözülür
// (bazı bilgisayarlarda yerel DNS "mongodb+srv" kaydını çözemiyor: querySrv ECONNREFUSED).
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));
}

// Demo hesaplarının ortak şifresi ve demo sitesini tanımak için kullanılan yönetici e-postası.
// Sadece demo içindir; README'de de yazılıdır.
const PASSWORD = 'Demo1234';
const MANAGER_EMAIL = 'lale.yonetici@ornek.com';
const DUE_AMOUNT = 1500;
const FLATS_PER_BUILDING = 8; // her binada (A1–A8, B1–B8)

// Sakinler: hangi dairede oturdukları ve aidat geçmişleri.
// missingMonths: ödenmemiş geçmiş aylar (kaç ay önce); joinedMonthsAgo: daireye kaç ay önce geldi (verilmezse 9);
// manualMonth: yöneticinin elle "ödendi" işaretlediği ay (kaç ay önce);
// thisMonth: bu ayın aidatının durumu (null = hiç bildirim yok → haritada kırmızı).
const RESIDENTS = [
  { flat: 'A1', name: 'Mehmet Demir', thisMonth: { status: 'approved', method: 'bank', note: 'Ziraat Bankası havale' } },
  { flat: 'A2', name: 'Fatma Şahin', manualMonth: 2, thisMonth: { status: 'approved', method: 'cash', note: '' } },
  { flat: 'A3', name: 'Elif Arslan', thisMonth: { status: 'pending', method: 'bank', note: "Garanti'den havale yaptım" } },
  { flat: 'A5', name: 'Can Yıldız', thisMonth: { status: 'pending', method: 'cash', note: 'Kapıcıya bıraktım' } },
  { flat: 'A6', name: 'Selin Aydın', missingMonths: [3], thisMonth: { status: 'rejected', method: 'bank', note: 'Havale yaptım' } },
  { flat: 'A8', name: 'Burak Öztürk', thisMonth: { status: 'approved', method: 'bank', note: '' } },
  { flat: 'B1', name: 'Ayşe Koç', thisMonth: { status: 'pending', method: 'bank', note: 'İş Bankası, açıklamaya B1 yazdım' } },
  { flat: 'B2', name: 'Emre Çelik', thisMonth: { status: 'approved', method: 'cash', note: '' } },
  { flat: 'B4', name: 'Deniz Kurt', missingMonths: [1, 2], thisMonth: null },
  { flat: 'B7', name: 'Gizem Aksoy', joinedMonthsAgo: 3, thisMonth: { status: 'pending', method: 'bank', note: 'Bu ayın aidatı' } },
];

// Yardımcılar: bugünden "n ay önce"nin ay/yıl bilgisi ve "n gün / saat önce"nin tarihi.
const now = new Date();
const monthsAgo = (n) => {
  const t = new Date(now.getFullYear(), now.getMonth() - n, 1);
  return { month: t.getMonth() + 1, year: t.getFullYear(), date: t };
};
// day 0 iken hour, gece yarısından bu yana geçen saati aşmaz: "bugün"ün kayıtları düne kaymasın ("Bugün" etiketi doğru çıksın).
const daysAgo = (day, hour = 0) =>
  new Date(now.getTime() - (day * 24 + (day === 0 ? Math.min(hour, now.getHours()) : hour)) * 60 * 60 * 1000);

// Sakinin demo e-postası: "A3" → lale.a3@ornek.com
const residentEmail = (flat) => `lale.${flat.toLowerCase()}@ornek.com`;

// Eski demo sitesini ve ona bağlı her şeyi siler. Demo sitesi, demo hesaplarından herhangi birinin (yönetici veya
// sakin) sitesi olarak bulunur: sunumda yöneticilik devredilip yöneticinin hesabı silinse bile site yine bulunur.
// Her sorgu bu siteId'lerle filtrelenir; demo hesabı olmayan başka bir sitenin verisi silinmez.
async function deleteOldDemo() {
  const emails = [MANAGER_EMAIL, ...RESIDENTS.map((s) => residentEmail(s.flat))];
  const siteIds = await User.distinct('siteId', { email: { $in: emails } });
  if (siteIds.length === 0) return;
  const filter = { siteId: { $in: siteIds } };
  await Promise.all([User, Building, Flat, Due, Announcement, Message, RecurringAnnouncement].map((Model) => Model.deleteMany(filter)));
  await Site.deleteMany({ _id: { $in: siteIds } });
  console.log('Eski demo sitesi silindi.');
}

async function seedDemo() {
  // Şifre bir kez hash'lenir ve tüm demo hesaplarında kullanılır. Kullanıcılar aşağıda User.collection.insertOne ile
  // (Mongoose'u atlayıp doğrudan veritabanı sürücüsüyle) eklenir; böylece createdAt geçmiş bir tarih olabilir. Bu yol
  // modeldeki pre('save') kancasını (kayıttan önce şifreyi hash'leyen fonksiyon) çalıştırmaz, bu yüzden şifre burada
  // elle hash'lenir (düz metin asla saklanmaz). Şema doğrulaması ve varsayılan değerler de çalışmaz; tüm alanlar elle yazılır.
  const password = await bcrypt.hash(PASSWORD, 12);

  // Site ve yöneticisi birbirini gösterdiği için id'ler önceden üretilir. Önce yönetici eklenir: betik arada
  // yarıda kalsa bile site, yöneticinin e-postasıyla bulunup bir sonraki çalıştırmada silinebilir.
  const siteId = new mongoose.Types.ObjectId();
  const managerId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id: managerId,
    siteId,
    name: 'Zeynep Kaya',
    email: MANAGER_EMAIL,
    password,
    role: 'manager',
    flatId: null,
    moveInDate: null,
    pushToken: null,
    resetAttempts: 0,
    createdAt: monthsAgo(10).date,
    updatedAt: monthsAgo(10).date,
  });
  await Site.create({ _id: siteId, name: 'Lale Sitesi', managerId, dueAmount: DUE_AMOUNT });

  // Binalar (A, B) ve daireler; her daireye benzersiz davet kodu
  const buildings = await Building.insertMany([{ siteId, name: 'A' }, { siteId, name: 'B' }]);
  const codes = generateInviteCodes(buildings.length * FLATS_PER_BUILDING);
  const flats = await Flat.insertMany(
    buildings.flatMap((building, b) =>
      Array.from({ length: FLATS_PER_BUILDING }, (_, i) => ({
        siteId,
        buildingId: building._id,
        flatNumber: i + 1,
        inviteCode: codes[b * FLATS_PER_BUILDING + i],
      })),
    ),
  );
  // "A3" → daire kaydı (sakinleri yerleştirmek için)
  const findFlat = (name) => flats.find((d) => buildings.find((b) => b._id.equals(d.buildingId)).name + d.flatNumber === name);

  // Sakin hesapları: her biri kendi dairesine bağlanır, dairenin davet kodu kullanılmış olur
  const dues = [];
  const residents = {};
  for (const s of RESIDENTS) {
    const flat = findFlat(s.flat);
    const joinedMonthsAgo = s.joinedMonthsAgo ?? 9;
    const userId = new mongoose.Types.ObjectId();
    residents[s.flat] = userId;
    await User.collection.insertOne({
      _id: userId,
      siteId,
      name: s.name,
      email: residentEmail(s.flat),
      password,
      role: 'resident',
      flatId: flat._id,
      moveInDate: monthsAgo(joinedMonthsAgo).date,
      pushToken: null,
      resetAttempts: 0,
      createdAt: monthsAgo(joinedMonthsAgo).date,
      updatedAt: monthsAgo(joinedMonthsAgo).date,
    });
    await Flat.updateOne({ _id: flat._id, siteId }, { inviteCodeUsed: true, residentId: userId });

    // Geçmiş aylar: katıldığı aydan geçen aya kadar, eksik aylar hariç hepsi onaylanmış.
    // manualMonth: o ay yöneticinin elle "ödendi" işaretlediği ay (paymentMethod 'manager').
    for (let n = joinedMonthsAgo; n >= 1; n--) {
      if (s.missingMonths?.includes(n)) continue;
      const { month, year, date } = monthsAgo(n);
      const manual = s.manualMonth === n;
      dues.push({
        siteId,
        flatId: flat._id,
        month,
        year,
        amount: DUE_AMOUNT,
        paymentMethod: manual ? 'manager' : n % 2 ? 'bank' : 'cash',
        note: '',
        status: 'approved',
        date: new Date(date.getTime() + 3 * 24 * 60 * 60 * 1000),
      });
    }
    // Bu ay: reddedilen bildirimden sonra sakin henüz yenisini göndermemiş olabilir (A6 → haritada kırmızı)
    if (s.thisMonth) {
      const { month, year } = monthsAgo(0);
      dues.push({
        siteId,
        flatId: flat._id,
        month,
        year,
        amount: DUE_AMOUNT,
        paymentMethod: s.thisMonth.method,
        note: s.thisMonth.note,
        status: s.thisMonth.status,
        // Bugün içinde birkaç saat önce: bildirimler farklı saatlerde gelmiş gibi görünsün diye saatler dağıtılır
        date: daysAgo(0, dues.length % 20),
      });
    }
  }
  // collection.insertMany: Mongoose'un otomatik date alanı yerine yukarıda hesaplanan geçmiş tarihler yazılsın diye
  // doğrudan veritabanı sürücüsüyle eklenir.
  await Due.collection.insertMany(dues);

  // Duyurular: biri bugün (listede "Bugün" etiketi ve sakin ana ekranında "yeni duyuru" sayısı görünsün diye)
  await Announcement.collection.insertMany([
    { siteId, title: 'Asansör bakımı', content: 'Bugün 14:00–16:00 arası A Blok asansörü bakımda olacaktır. Anlayışınız için teşekkürler.', date: daysAgo(0, 2) },
    { siteId, title: 'Su kesintisi', content: 'İSKİ çalışması nedeniyle perşembe 09:00–13:00 arası sular kesik olacaktır.', date: daysAgo(3, 5) },
    { siteId, title: 'Genel kurul toplantısı', content: 'Yıllık genel kurul ayın 20\'sinde saat 19:00\'da sığınak toplantı odasında yapılacaktır.', date: daysAgo(10, 3) },
    { siteId, title: 'Bahçe düzenlemesi', content: 'Ön bahçeye yeni çiçekler dikildi, çocukların çimlere basmamasına dikkat edelim.', date: daysAgo(20, 6) },
  ]);

  // Tekrarlayan duyuru: her pazartesi 08:00'de "Çöp günü" duyurusu otomatik yayınlanır
  await RecurringAnnouncement.create({
    siteId,
    title: 'Çöp günü',
    content: 'Bugün geri dönüşüm günü. Lütfen kâğıt ve plastikleri mavi konteynere atınız.',
    days: [1],
    hour: 8,
    minute: 0,
  });

  // Mesajlar: yönetici ile üç sakin arasında. A3'ün son mesajı okunmamış (yöneticide okunmamış sayısı görünür).
  const message = (sender, recipient, content, day, hour, read = true) => ({ siteId, senderId: sender, recipientId: recipient, content, read, date: daysAgo(day, hour) });
  const Y = managerId;
  await Message.collection.insertMany([
    message(residents.A3, Y, 'Merhaba Zeynep Hanım, bu ayın aidatını havaleyle gönderdim.', 1, 5),
    message(Y, residents.A3, 'Merhaba Elif Hanım, teşekkürler. Hesaba düşünce onaylayacağım.', 1, 4),
    message(residents.A3, Y, 'Bir de mutfakta su sızıntısı var, tesisatçının numarasını alabilir miyim?', 0, 3, false),
    message(Y, residents.B4, 'Deniz Bey merhaba, son iki ayın aidatı görünmüyor. Bilginize.', 2, 6),
    message(residents.B4, Y, 'Haklısınız, bu hafta sonu hepsini birden ödeyeceğim.', 2, 2),
    message(residents.A1, Y, 'Otopark kapısının kumandası çalışmıyor.', 5, 1),
    message(Y, residents.A1, 'Servisi aradım, yarın geliyorlar.', 4, 8),
  ]);

  return { flatCount: flats.length, residentCount: RESIDENTS.length, dueCount: dues.length };
}

// Ana akış: bağlan → eski demoyu sil → yenisini kur → bağlantıyı kapat. Hata olursa mesaj yazılır, çıkış kodu 1 olur.
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await deleteOldDemo();
    const result = await seedDemo();
    console.log(`Demo sitesi kuruldu: ${result.flatCount} daire, ${result.residentCount} sakin, ${result.dueCount} aidat kaydı.`);
    console.log(`Yönetici: ${MANAGER_EMAIL}  ·  Sakinler: lale.a1@ornek.com, lale.a3@ornek.com ...  ·  Şifre: ${PASSWORD}`);
  } catch (error) {
    console.error('Demo verisi kurulamadı:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
