// Mesaj route'ları: yönetici ile sakin arasındaki birebir yazışma.
// Sakin sadece kendi sitesinin yöneticisiyle, yönetici sadece kendi sitesinin sakinleriyle yazışabilir.
const express = require('express');
const { z } = require('zod');
const Message = require('../models/Message');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { sendToUser } = require('../socket');
const { sendPush } = require('../services/pushNotifications');
const { flatNames } = require('../services/flat');

const router = express.Router();

// Tüm mesaj route'ları giriş gerektirir. siteId ve kullanıcı kimliği her zaman req.user'dan (token) alınır.
router.use(requireAuth);

// Konuşulmak istenen kişiyi bulur ve bu kişiyle yazışma izni olup olmadığını kontrol eder:
// - yönetici → sadece kendi sitesindeki, bir daireye bağlı sakinler
// - sakin → sadece kendi sitesinin yöneticisi
// Kişi yoksa, başka sitedeyse veya izin yoksa 404 döner (kişinin var olduğu belli edilmez).
// Geçersiz biçimdeki id CastError verir, merkezi hata yakalayıcı onu da 404'e çevirir.
async function findOtherParty(me, personId) {
  const allowedRole = me.role === 'manager' ? { role: 'resident', flatId: { $ne: null } } : { role: 'manager' };
  // pushToken da alınır: mesaj gönderilince karşı tarafa bildirim göndermek için gerekir.
  const person = await User.findOne({ _id: personId, siteId: me.siteId, ...allowedRole }).select('name pushToken').lean();
  if (!person) throw new ApiError(404, 'Kişi bulunamadı.');
  return person;
}

// Mesajı ekrana gönderilecek biçime çevirir. fromMe: mesajı isteği atan kişi mi yazdı
// (ekranda kendi mesajları sağda, karşı tarafınkiler solda gösterilir).
// senderId bir ObjectId (nesne) olduğu için === yerine .equals() ile karşılaştırılır.
// read: alıcı mesajı gördü mü; kendi mesajlarımda ✓ (iletildi) yerine ✓✓ (görüldü) göstermek için.
const formatMessage = (m, myId) => ({
  id: m._id,
  content: m.content,
  date: m.date,
  fromMe: m.senderId.equals(myId),
  read: m.read,
});

// GET /api/messages/chats
// Kim kullanabilir: giriş yapmış herkes. Yazışılabilecek kişileri, her biriyle son mesajı ile döner.
// Yönetici: sitedeki tüm sakinler (daire adıyla). Sakin: sadece sitenin yöneticisi.
// Sıralama: son mesajı en yeni olan üstte; hiç yazışılmamış kişiler altta, daire adına göre.
// unread: o kişiden gelen ve henüz okumadığım mesaj sayısı (listede rozet olarak gösterilir).
router.get('/chats', async (req, res) => {
  const { id, siteId, role } = req.user;
  let people;
  if (role === 'manager') {
    // Sakinler ve daire adları aynı anda (Promise.all) çekilir; hepsi siteId ile filtrelenir.
    // flatNames: flatId → "A5" eşlemesi (Map); her sakin için daire adını tek tek sorgu atmadan bulmayı sağlar.
    const [residents, flatName] = await Promise.all([
      User.find({ siteId, role: 'resident', flatId: { $ne: null } }).select('name flatId').lean(),
      flatNames(siteId),
    ]);
    people = residents.map((s) => ({ id: s._id, name: s.name, subtitle: flatName.get(String(s.flatId)) ?? '—' }));
  } else {
    const manager = await User.findOne({ siteId, role: 'manager' }).select('name').lean();
    people = manager ? [{ id: manager._id, name: manager.name, subtitle: 'Site yöneticisi' }] : [];
  }

  // Her sohbetin son mesajı tek bir veritabanı sorgusuyla (aggregate) bulunur:
  // 1) $match: bu sitede, benim gönderdiğim veya bana gelen mesajlar
  // 2) $sort: yeniden eskiye sıralanır
  // 3) $group: mesajlar karşı tarafa göre gruplanır ($cond: gönderen bensem karşı taraf alıcıdır,
  //    değilse gönderendir); $first sıralama yeniden eskiye olduğu için her grubun EN YENİ mesajını alır.
  //    unread: grubun içinde alıcısı ben olan ve read=false olan her mesaj için 1 eklenir ($sum).
  // Not: aggregate, find gibi metin → ObjectId dönüşümünü kendisi yapmaz; id ve siteId token'dan
  // (veritabanı kaydından) ObjectId olarak geldiği için eşleşme doğru çalışır.
  const lastMessages = await Message.aggregate([
    { $match: { siteId, $or: [{ senderId: id }, { recipientId: id }] } },
    { $sort: { date: -1 } },
    {
      $group: {
        _id: { $cond: [{ $eq: ['$senderId', id] }, '$recipientId', '$senderId'] },
        content: { $first: '$content' },
        date: { $first: '$date' },
        senderId: { $first: '$senderId' },
        unread: {
          $sum: { $cond: [{ $and: [{ $eq: ['$recipientId', id] }, { $eq: ['$read', false] }] }, 1, 0] },
        },
      },
    },
  ]);
  const lastMessage = new Map(lastMessages.map((m) => [String(m._id), m]));

  const chats = people.map((k) => {
    const m = lastMessage.get(String(k.id));
    return {
      ...k,
      lastMessage: m ? { content: m.content, date: m.date, fromMe: m.senderId.equals(id) } : null,
      unread: m?.unread ?? 0,
    };
  });
  // Son mesajı olanlar yeniden eskiye; olmayanlar daire adına göre ("A2" "A10"dan önce gelsin diye numeric).
  chats.sort((a, b) => {
    if (a.lastMessage && b.lastMessage) return b.lastMessage.date - a.lastMessage.date;
    if (a.lastMessage || b.lastMessage) return a.lastMessage ? -1 : 1;
    return a.subtitle.localeCompare(b.subtitle, 'tr', { numeric: true });
  });

  res.json(chats);
});

// GET /api/messages/:personId
// Kim kullanabilir: giriş yapmış herkes, ama sadece yazışma izni olduğu kişiyle (bkz. findOtherParty).
// İki kişi arasındaki son 100 mesajı YENİDEN ESKİYE döner (mobildeki ters çevrilmiş liste en yeniyi altta gösterir).
router.get('/:personId', async (req, res) => {
  const { id, siteId } = req.user;
  const person = await findOtherParty(req.user, req.params.personId);

  // Sadece bu iki kişi arasındaki mesajlar: ben → o veya o → ben (siteId filtresiyle birlikte).
  const messages = await Message.find({
    siteId,
    $or: [
      { senderId: id, recipientId: person._id },
      { senderId: person._id, recipientId: id },
    ],
  })
    .sort({ date: -1 })
    .limit(100)
    .lean();

  res.json(messages.map((m) => formatMessage(m, id)));
});

// PUT /api/messages/:personId/read
// Kim kullanabilir: giriş yapmış herkes, sadece yazışma izni olduğu kişi için. Sohbet ekranı açıkken
// telefon bunu çağırır: o kişiden BANA gelmiş ve okunmamış mesajlar "okundu" işaretlenir (görüldü ✓✓).
// Sadece alıcısı ben olan mesajlar değişir; kimse karşı tarafın okuma durumunu değiştiremez.
router.put('/:personId/read', async (req, res) => {
  const { id, siteId } = req.user;
  const person = await findOtherParty(req.user, req.params.personId);

  // time: işaretlemenin yapıldığı an. Bu andan SONRA gönderilen mesajlar okunmuş sayılmaz.
  const time = new Date();
  const result = await Message.updateMany(
    { siteId, senderId: person._id, recipientId: id, read: false, date: { $lte: time } },
    { read: true }
  );

  // Gerçekten yeni okunan mesaj varsa, mesajı GÖNDEREN kişiye soketle haber verilir; onun ekranında
  // bu sohbetteki mesajların ✓ işareti anında ✓✓ olur. personId: hangi sohbet olduğu (onun açısından ben).
  // time da gönderilir: telefon sadece bu andan önce gönderilmiş mesajları ✓✓ yapar; tam o sırada
  // gönderilmiş yeni bir mesaj yanlışlıkla "görüldü" görünmez.
  if (result.modifiedCount > 0) {
    sendToUser(person._id, 'messagesRead', { personId: String(id), time });
  }
  res.status(204).end();
});

// Mesaj gönderme formunun kuralları: alıcı geçerli bir kimlik olmalı, mesaj boş veya 1000 karakterden uzun olamaz.
const messageSchema = z.object({
  recipientId: z.string({ error: 'Alıcı seçilmeli' }).regex(/^[a-f\d]{24}$/i, 'Alıcı geçersiz'),
  content: z.string({ error: 'Mesaj yazılmalı' }).trim().min(1, 'Mesaj boş olamaz').max(1000, 'Mesaj en fazla 1000 karakter olabilir'),
});

// POST /api/messages
// Kim kullanabilir: giriş yapmış herkes, ama sadece yazışma izni olduğu kişiye (sakin → yönetici, yönetici → sakin).
// Gönderen ve site istekten değil token'dan alınır; kimse başkası adına veya başka siteye mesaj atamaz.
router.post('/', validate(messageSchema), async (req, res) => {
  const { id, siteId } = req.user;
  // Alıcı izinli biri değilse (başka site, başka sakin vb.) burada 404 fırlatılır ve mesaj kaydedilmez.
  const person = await findOtherParty(req.user, req.body.recipientId);

  const message = await Message.create({ siteId, senderId: id, recipientId: person._id, content: req.body.content });

  // Mesaj, Socket.io ile hem alıcının hem gönderenin (diğer cihazlarının) telefonuna anında iletilir.
  // Her biri için fromMe alanı kendi açısından hesaplanır; personId de mesajın hangi sohbete ait
  // olduğunu (karşı tarafın kimliğini) söyler. Telefon sadece o sohbet açıksa mesajı ekrana ekler.
  sendToUser(person._id, 'newMessage', { ...formatMessage(message, person._id), personId: String(id) });
  sendToUser(id, 'newMessage', { ...formatMessage(message, id), personId: String(person._id) });

  res.status(201).json(formatMessage(message, id));

  // Push bildirim cevaptan SONRA gönderilir: gönderen bildirimin gitmesini beklemez.
  // Alıcının uygulaması kapalı veya arka plandaysa telefonuna "Gönderen adı: mesaj" bildirimi düşer.
  // pushData.personId: telefon, bu kişiyle sohbet zaten ekranda açıksa bildirimi göstermez (mesaj zaten ekrana düşüyor).
  // Uzun mesajın sadece ilk 100 karakteri gösterilir. sendPush hata fırlatmaz, sadece loglar.
  if (person.pushToken) {
    const short = message.content.length > 100 ? `${message.content.slice(0, 100)}…` : message.content;
    sendPush([person.pushToken], {
      title: req.user.name,
      content: short,
      pushData: { screen: 'Chat', personId: String(id) },
    });
  }
});

module.exports = router;
