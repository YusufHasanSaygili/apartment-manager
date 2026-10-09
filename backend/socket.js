// Socket.io (anlık bağlantı) kurulumu: telefonlarla sunucu arasında sürekli açık bir bağlantı tutar.
// Normal API'de telefon sorar, sunucu cevaplar; soket bağlantısında ise sunucu yeni bir mesaj olduğunda
// telefona KENDİSİ haber verebilir. Böylece mesajlar sayfa yenilemeden anında düşer.
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const DeletedAccount = require('./models/DeletedAccount');
const { DAIREDEN_CIKARILDI: REMOVED_FROM_FLAT, SIFRE_DEGISTI: PASSWORD_CHANGED } = require('./middleware/auth');

// Sunucu tarafındaki Socket.io nesnesi; startSocket çağrılınca oluşturulur.
let io = null;

// Her kullanıcının kişisel odasının adı. Oda: aynı anda birden fazla bağlantıya (örn. kullanıcının
// iki telefonu) tek seferde mesaj göndermeye yarayan gruptur.
const roomName = (userId) => `kullanici:${userId}`;

// httpServer: Express'in üzerinde çalıştığı HTTP sunucusu (Socket.io aynı portu paylaşır).
// corsOrigins: API ile aynı CORS kuralı; mobil uygulama CORS'tan etkilenmez, web sitelerine izin yoktur.
function startSocket(httpServer, corsOrigins) {
  io = new Server(httpServer, { cors: { origin: corsOrigins.length > 0 ? corsOrigins : false } });

  // GİRİŞ KONTROLÜ (middleware): her bağlantı kabul edilmeden önce burada token doğrulanır.
  // Telefon bağlanırken token'ını { auth: { token } } ile gönderir. Token yoksa, sahteyse, süresi
  // dolmuşsa, hesap silinmişse veya şifre token verildikten sonra değişmişse bağlantı reddedilir (next(new Error(...))).
  // iat: token'ın verildiği an; şifre değişme zamanıyla karşılaştırmak için token'dan okunur.
  io.use(async (socket, next) => {
    try {
      const { id, iat } = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      const user = await User.findById(id).select('_id sifreDegisme').lean();
      // Daireden çıkarılan sakinin hesabı silinmiştir; bağlantı reddedilir. error.data.kod: telefon bu reddi diğer
      // bağlantı hatalarından ayırt edip oturumu kapatabilsin diye eklenir (telefon kapalıyken çıkarılan sakin,
      // uygulamayı açınca hemen bilgilendirilir).
      const removed = !user && (await DeletedAccount.exists({ kullaniciId: id }));
      if (!user && !removed) return next(new Error('Oturum geçersiz'));
      if (removed) {
        const error = new Error(REMOVED_FROM_FLAT);
        error.data = { kod: 'DAIREDEN_CIKARILDI' };
        return next(error);
      }
      // Şifre değiştikten önce verilmiş token ile anlık bağlantı da kurulamaz (requireAuth ile aynı kural).
      // error.data.kod: telefon kapalıyken şifre değiştiyse, uygulama açılınca soket bu kodu görür ve oturumu hemen kapatır.
      if (User.isTokenStale(user, iat)) {
        const error = new Error(PASSWORD_CHANGED);
        error.data = { kod: 'SIFRE_DEGISTI' };
        return next(error);
      }
      // Kullanıcının kimliği bağlantıya yazılır; oda bu bilgiyle seçilir (istekten alınmaz).
      socket.data.kullaniciId = String(user._id);
      next();
    } catch {
      next(new Error('Oturum geçersiz'));
    }
  });

  // 'connection' olayı: bir telefon bağlantıyı başarıyla açınca çalışır. socket = o tek telefonun bağlantısı.
  // Bağlantı kabul edilince kullanıcı SADECE kendi kişisel odasına alınır. Hangi odaya gireceğini
  // telefon seçemez; bu yüzden kimse başka birinin mesajlarını dinleyemez.
  io.on('connection', (socket) => {
    socket.join(roomName(socket.data.kullaniciId));
  });
}

// Bir kullanıcının bağlı tüm cihazlarına anlık olay gönderir (örn. 'yeniMesaj').
// Kullanıcı o an bağlı değilse olay kaybolur; telefon bağlanınca mesajları API'den yeniden çeker.
// emit: olayı adı ve verisiyle gönderir; telefonda soket.on(olay, ...) ile dinlenir.
// io?. : soket henüz başlatılmadıysa (io null) hata vermeden hiçbir şey yapmaz; mesaj yine veritabanına kaydedilmiş olur.
function sendToUser(userId, event, payload) {
  io?.to(roomName(String(userId))).emit(event, payload);
}

// Bir kullanıcının açık tüm bağlantılarını kapatır (örn. sakin daireden çıkarıldı, hesap silindi, şifre sıfırlandı).
// Kapatmadan önce olay gönderilir: telefon bunu alınca oturumu kapatır ve mesajı gösterir.
// Sunucu tarafından kapatılan bağlantıya Socket.io kendiliğinden yeniden bağlanmaz.
function disconnectUser(userId, event, payload) {
  const room = roomName(String(userId));
  io?.to(room).emit(event, payload);
  io?.in(room).disconnectSockets();
}

module.exports = { startSocket, sendToUser, disconnectUser };
