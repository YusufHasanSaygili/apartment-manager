// Socket.io (anlık bağlantı) kurulumu: telefonlarla sunucu arasında sürekli açık bir bağlantı tutar.
// Normal API'de telefon sorar, sunucu cevaplar; soket bağlantısında ise sunucu yeni bir mesaj olduğunda
// telefona KENDİSİ haber verebilir. Böylece mesajlar sayfa yenilemeden anında düşer.
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Kullanici = require('./models/Kullanici');
const SilinenHesap = require('./models/SilinenHesap');
const { DAIREDEN_CIKARILDI, SIFRE_DEGISTI } = require('./middleware/kimlik');

// Sunucu tarafındaki Socket.io nesnesi; soketiBaslat çağrılınca oluşturulur.
let io = null;

// Her kullanıcının kişisel odasının adı. Oda: aynı anda birden fazla bağlantıya (örn. kullanıcının
// iki telefonu) tek seferde mesaj göndermeye yarayan gruptur.
const odaAdi = (kullaniciId) => `kullanici:${kullaniciId}`;

// httpSunucu: Express'in üzerinde çalıştığı HTTP sunucusu (Socket.io aynı portu paylaşır).
// corsAdresleri: API ile aynı CORS kuralı; mobil uygulama CORS'tan etkilenmez, web sitelerine izin yoktur.
function soketiBaslat(httpSunucu, corsAdresleri) {
  io = new Server(httpSunucu, { cors: { origin: corsAdresleri.length > 0 ? corsAdresleri : false } });

  // GİRİŞ KONTROLÜ (middleware): her bağlantı kabul edilmeden önce burada token doğrulanır.
  // Telefon bağlanırken token'ını { auth: { token } } ile gönderir. Token yoksa, sahteyse, süresi
  // dolmuşsa, hesap silinmişse veya şifre token verildikten sonra değişmişse bağlantı reddedilir (next(new Error(...))).
  // iat: token'ın verildiği an; şifre değişme zamanıyla karşılaştırmak için token'dan okunur.
  io.use(async (socket, next) => {
    try {
      const { id, iat } = jwt.verify(socket.handshake.auth?.token, process.env.JWT_ANAHTARI);
      const kullanici = await Kullanici.findById(id).select('_id sifreDegisme').lean();
      // Daireden çıkarılan sakinin hesabı silinmiştir; bağlantı reddedilir. hata.data.kod: telefon bu reddi diğer
      // bağlantı hatalarından ayırt edip oturumu kapatabilsin diye eklenir (telefon kapalıyken çıkarılan sakin,
      // uygulamayı açınca hemen bilgilendirilir).
      const cikarildi = !kullanici && (await SilinenHesap.exists({ kullaniciId: id }));
      if (!kullanici && !cikarildi) return next(new Error('Oturum geçersiz'));
      if (cikarildi) {
        const hata = new Error(DAIREDEN_CIKARILDI);
        hata.data = { kod: 'DAIREDEN_CIKARILDI' };
        return next(hata);
      }
      // Şifre değiştikten önce verilmiş token ile anlık bağlantı da kurulamaz (girisGerekli ile aynı kural).
      // hata.data.kod: telefon kapalıyken şifre değiştiyse, uygulama açılınca soket bu kodu görür ve oturumu hemen kapatır.
      if (Kullanici.tokenEskiMi(kullanici, iat)) {
        const hata = new Error(SIFRE_DEGISTI);
        hata.data = { kod: 'SIFRE_DEGISTI' };
        return next(hata);
      }
      // Kullanıcının kimliği bağlantıya yazılır; oda bu bilgiyle seçilir (istekten alınmaz).
      socket.data.kullaniciId = String(kullanici._id);
      next();
    } catch {
      next(new Error('Oturum geçersiz'));
    }
  });

  // 'connection' olayı: bir telefon bağlantıyı başarıyla açınca çalışır. socket = o tek telefonun bağlantısı.
  // Bağlantı kabul edilince kullanıcı SADECE kendi kişisel odasına alınır. Hangi odaya gireceğini
  // telefon seçemez; bu yüzden kimse başka birinin mesajlarını dinleyemez.
  io.on('connection', (socket) => {
    socket.join(odaAdi(socket.data.kullaniciId));
  });
}

// Bir kullanıcının bağlı tüm cihazlarına anlık olay gönderir (örn. 'yeniMesaj').
// Kullanıcı o an bağlı değilse olay kaybolur; telefon bağlanınca mesajları API'den yeniden çeker.
// emit: olayı adı ve verisiyle gönderir; telefonda soket.on(olay, ...) ile dinlenir.
// io?. : soket henüz başlatılmadıysa (io null) hata vermeden hiçbir şey yapmaz; mesaj yine veritabanına kaydedilmiş olur.
function kullaniciyaGonder(kullaniciId, olay, veri) {
  io?.to(odaAdi(String(kullaniciId))).emit(olay, veri);
}

// Bir kullanıcının açık tüm bağlantılarını kapatır (örn. sakin daireden çıkarıldı, hesap silindi, şifre sıfırlandı).
// Kapatmadan önce olay gönderilir: telefon bunu alınca oturumu kapatır ve mesajı gösterir.
// Sunucu tarafından kapatılan bağlantıya Socket.io kendiliğinden yeniden bağlanmaz.
function kullaniciyiKopar(kullaniciId, olay, veri) {
  const oda = odaAdi(String(kullaniciId));
  io?.to(oda).emit(olay, veri);
  io?.in(oda).disconnectSockets();
}

module.exports = { soketiBaslat, kullaniciyaGonder, kullaniciyiKopar };
