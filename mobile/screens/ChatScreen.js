// Sohbet ekranı: iki kişi arasındaki mesajları WhatsApp benzeri baloncuklarla gösterir ve yeni mesaj gönderir.
// Yönetici ve sakin aynı ekranı kullanır. Yönetici bir sakine dokununca açılır (kisiId parametresiyle);
// sakin "Yöneticiye mesaj" butonuyla açar (kisiId verilmez, yöneticinin kimliği sunucudan öğrenilir).
// Yeni mesajlar Socket.io ile sayfa yenilemeden anında düşer. Kendi mesajlarımda ✓ = iletildi
// (sunucuya ulaştı), ✓✓ = görüldü (karşı taraf sohbeti açıp okudu) işareti görünür.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useSocketEvent } from '../services/socket';
import { setOpenChat } from '../services/notifications';
import ErrorMessage from '../components/ErrorMessage';
import { dayLabel, formatTime } from '../format';
import Icon from '../components/Icon';
import { radius, colors, fonts } from '../theme';

// Mesaj kutusuna yazılabilecek en fazla karakter (backend'deki sınırla aynı).
const MAX_LENGTH = 1000;

// Yeni mesajı listenin başına (en yeni) ekler. Aynı mesaj hem gönderim cevabıyla hem soketle
// gelebildiği için listede zaten varsa (id aynıysa) tekrar eklenmez.
// Liste henüz yüklenmediyse (null) mesaj tek başına tutulur; yükleme bitince load içindeki birleştirme onu korur.
const addMessage = (previous, message) =>
  previous?.some((m) => m.id === message.id) ? previous : [message, ...(previous ?? [])];

// route.params.kisiId: konuşulan kişi (yönetici açarken verir; sakin açarken boştur).
export default function ChatScreen({ route }) {
  // Alttaki güvenli boşluk (telefonun alt çubuğu/hareket çizgisi): yazma kutusu bu çubuğun altında kalmasın diye.
  const bottomInset = useSafeAreaInsets().bottom;

  // useRef: konuşulan kişinin kimliği. Yönetici için parametreden gelir; sakin için ilk yüklemede bulunur.
  // useState yerine useRef: değeri değişince ekran yeniden çizilmez ve load fonksiyonu yeniden oluşmaz;
  // böylece sakin sohbeti açınca mesajlar iki kez istenmez. Değer personRef.current ile okunur/yazılır.
  const personRef = useRef(route.params?.kisiId ?? null);
  // useState: mesajlar (yeniden eskiye). null → henüz yüklenmedi.
  const [messages, setMessages] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata mesajı.
  const [error, setError] = useState('');
  // useState: yazma kutusundaki metin. Her harf yazıldığında güncellenir.
  const [text, setText] = useState('');
  // useState: ekranın pencerenin tepesinden uzaklığı (üstteki durum çubuğu + başlık çubuğu yüksekliği).
  // Klavye açılınca yazma kutusunun ne kadar yukarı itileceği hesaplanırken bu kadar düzeltme yapılır;
  // yoksa kutu başlık yüksekliği kadar klavyenin arkasında kalır.
  const [topOffset, setTopOffset] = useState(0);
  // useRef: ekranın dış kutusuna erişmek (konumunu ölçmek) için.
  const containerRef = useRef(null);
  // useState: mesaj gönderilemezse yazma kutusunun üstünde gösterilecek hata (liste hatasından ayrı tutulur,
  // çünkü listedeki "Tekrar dene" mesajı yeniden göndermez, sadece listeyi yeniler).
  const [sendError, setSendError] = useState('');
  // useState: mesaj gönderilirken true; gönder butonu bu sırada kapalıdır (aynı mesaj iki kez gitmez).
  const [sending, setSending] = useState(false);
  // useRef: bu ekran şu an önde mi (kullanıcı sohbete bakıyor mu). Mesajlar sadece kullanıcı gerçekten
  // bakarken "görüldü" sayılır. Değişince ekranın yeniden çizilmesine gerek olmadığı için useRef.
  const visibleRef = useRef(false);

  // API isteği: PUT /api/mesajlar/:kisiId/okundu ile karşı taraftan gelen okunmamış mesajları "okundu" yapar;
  // sunucu da karşı tarafa haber verir ve onun ekranında ✓ → ✓✓ olur.
  // Sadece ekran öndeyse VE uygulama açıksa (AppState 'active') çağrılır; telefon cepteyken veya kullanıcı
  // başka ekrandayken gelen mesaj okunmuş sayılmaz. Hata olursa sessizce geçilir (sadece işaret gecikir).
  // useCallback (boş bağımlılık): değerleri ref'lerden okuduğu için hiç yeniden oluşturulmasına gerek yok;
  // böylece onu kullanan load, onNewMessage ve AppState dinleyicisi de sabit kalır.
  const markRead = useCallback(() => {
    if (!visibleRef.current || AppState.currentState !== 'active' || !personRef.current) return;
    api.put(`/mesajlar/${personRef.current}/okundu`).catch(() => {});
  }, []);

  // API isteği: önce (sakinse) GET /api/mesajlar/sohbetler ile yöneticinin kimliğini bulur,
  // sonra GET /api/mesajlar/:kisiId ile bu kişiyle olan son 100 mesajı çeker.
  // useCallback: fonksiyonu tek bir kez oluşturur (tek bağımlılığı markRead de hiç değişmez); böylece
  // useFocusEffect ve soket dinleyicisi her çizimde gereksiz yere yeniden kurulmaz.
  const load = useCallback(async () => {
    setError('');
    try {
      if (!personRef.current) {
        const { data } = await api.get('/mesajlar/sohbetler');
        // Sakinin listesinde sadece sitenin yöneticisi bulunur.
        if (data.length === 0) throw new Error('Sitenin yöneticisi bulunamadı.');
        personRef.current = data[0].id;
      }
      const { data } = await api.get(`/mesajlar/${personRef.current}`);
      // Liste sunucudan gelenle değiştirilir; ama istek sürerken soketle gelen (sunucunun listesinden
      // daha yeni) mesajlar kaybolmasın diye onlar listenin başında korunur.
      // Tarihler ISO metni ("2026-10-03T12:00:00.000Z") olarak geldiği için > ile doğrudan karşılaştırılabilir.
      setMessages((previous) => {
        const newest = data[0]?.tarih ?? '';
        const incoming = (previous ?? []).filter((m) => m.tarih > newest && !data.some((d) => d.id === m.id));
        return [...incoming, ...data];
      });
      // Ekran öndeyse: bu sohbet "açık" olarak kaydedilir (bu kişiden gelen bildirimler gösterilmez)
      // ve gelen mesajlar okundu işaretlenir.
      if (visibleRef.current) {
        setOpenChat(personRef.current);
        markRead();
      }
    } catch (e) {
      setError(e.message);
    }
  }, [markRead]);

  // useFocusEffect: ekran her öne geldiğinde mesajlar yeniden çekilir ve ekran "görünür" işaretlenir.
  // Döndürülen temizlik fonksiyonu ekran arkaya gidince (geri basılınca) çalışır: ekran artık görünmez
  // ve açık sohbet kaydı silinir; bu kişiden gelen mesajlar yine bildirim olarak gösterilir.
  useFocusEffect(
    useCallback(() => {
      visibleRef.current = true;
      load();
      return () => {
        visibleRef.current = false;
        setOpenChat(null);
      };
    }, [load])
  );

  // useEffect: uygulama arka plandan öne gelince (AppState 'active') sohbet açıksa, arka plandayken
  // gelen mesajlar okundu işaretlenir. Ekran kapanınca dinleyici kaldırılır (remove).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') markRead();
    });
    return () => subscription.remove();
  }, [markRead]);

  // Soketten yeni mesaj gelince çalışır. Mesaj sadece AÇIK OLAN sohbete aitse (mesajın kisiId'si bu ekrandaki
  // kişiyse) listeye eklenir; başka bir sakinden gelen mesaj bu ekranda görünmez.
  // useCallback: dinleyici her çizimde yeniden kurulmasın diye fonksiyon sabit tutulur.
  // Karşı taraftan gelen mesajsa ve kullanıcı ekrana bakıyorsa hemen okundu işaretlenir.
  const onNewMessage = useCallback(
    (message) => {
      if (message.kisiId !== personRef.current) return;
      setMessages((previous) => addMessage(previous, message));
      if (!message.benden) markRead();
    },
    [markRead]
  );

  // Soketten "mesajlarınız okundu" haberi gelince çalışır: bu sohbetse, benim gönderdiğim mesajlar
  // okundu sayılır ve ekranda ✓ işaretleri ✓✓ olur. map: listeyi değiştirmeden yeni bir liste üretir
  // (React state'i doğrudan değiştirilmez, yeni değer verilir ki ekran yenilensin).
  // zaman: karşı tarafın okuduğu an; sadece o andan önce gönderilmiş mesajlar ✓✓ yapılır (ISO metin karşılaştırması).
  const messagesRead = useCallback(({ kisiId: personId, zaman: time }) => {
    if (personId !== personRef.current) return;
    setMessages((previous) =>
      previous?.map((m) => (m.benden && !m.okundu && m.tarih <= time ? { ...m, okundu: true } : m))
    );
  }, []);

  // Soket olayları: 'yeniMesaj' gelince mesaj ekrana eklenir; 'mesajlarOkundu' gelince messagesRead çalışır ve ✓✓ yapılır. 'connect': bağlantı koptuysa (internet gitti,
  // uygulama arka plana alındı) yeniden bağlanınca o arada kaçırılan mesajlar için liste yeniden çekilir.
  useSocketEvent('yeniMesaj', onNewMessage);
  useSocketEvent('mesajlarOkundu', messagesRead);
  useSocketEvent('connect', load);

  // API isteği: POST /api/mesajlar ile { aliciId, icerik } gönderir. Başarılıysa sunucunun döndürdüğü
  // mesaj listenin başına (en yeni) eklenir ve yazma kutusu temizlenir; hata olursa metin silinmez.
  const send = async () => {
    const content = text.trim();
    if (!content || !personRef.current || sending) return;
    setSending(true);
    setSendError('');
    try {
      const { data } = await api.post('/mesajlar', { aliciId: personRef.current, icerik: content });
      setMessages((previous) => addMessage(previous, data));
      setText('');
    } catch (e) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  };

  // Gönder butonu sadece metin boş değilse, mesajlar yüklendiyse (yani konuşulan kişi belliyse)
  // ve önceki gönderim bittiyse açıktır.
  const canSend = text.trim() !== '' && messages !== null && !sending;

  return (
    // KeyboardAvoidingView: klavye açılınca alttaki yazma kutusunu klavyenin üstüne iter.
    // keyboardVerticalOffset: ekranın üstündeki başlık yüksekliği kadar düzeltme (yukarıda ölçülen topOffset).
    // onLayout: ekran yerleşince measureInWindow ile dış kutunun pencereye göre konumu (y) ölçülür.
    <KeyboardAvoidingView
      ref={containerRef}
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={topOffset}
      onLayout={() => containerRef.current?.measureInWindow((x, y) => setTopOffset(y))}
    >
      {error !== '' && (
        <View style={styles.error}>
          {/* Hata kutusundaki "Tekrar dene" butonu: basınca load çalışır */}
          <ErrorMessage mesaj={error} onRetry={load} />
        </View>
      )}
      {messages === null && error === '' && <ActivityIndicator style={styles.loading} color={colors.primary} />}

      {/* FlatList inverted: liste ters çevrilir, en yeni mesaj en altta görünür ve açılışta oraya kaydırmak gerekmez.
          Bu yüzden veriler sunucudan YENİDEN ESKİYE gelir. keyExtractor: her mesajın benzersiz anahtarı (id). */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={messages ?? []}
        inverted
        keyExtractor={(m) => m.id}
        // Boş liste yazısı: ters listede React Native bu yazıyı kendisi düz çevirir, ayrıca bir şey yapmaya gerek yok.
        ListEmptyComponent={
          messages && <Text style={styles.bos}>Henüz mesaj yok. İlk mesajı siz yazın.</Text>
        }
        renderItem={({ item: m, index }) => {
          // Gün ayıracı: bu mesaj kendi gününün ilk (en eski) mesajıysa üstünde "Bugün / Dün / 2 Ekim 2026" çıkar.
          // Liste yeniden eskiye sıralı olduğu için bir sonraki eleman (index + 1) bir önceki mesajdır.
          const previous = messages[index + 1];
          const newDay = !previous || new Date(previous.tarih).toDateString() !== new Date(m.tarih).toDateString();
          return (
            <View>
              {newDay && (
                <View style={styles.daySeparator}>
                  <Text style={styles.dayText}>{dayLabel(m.tarih).toLocaleUpperCase('tr-TR')}</Text>
                </View>
              )}
              {/* Baloncuk: benim mesajım sağda ve koyu zümrüt, karşı tarafınki solda ve koyu gri. */}
              <View style={[styles.bubble, m.benden ? styles.mine : styles.theirs]}>
                <Text style={[styles.mesaj, m.benden && styles.myText]}>{m.icerik}</Text>
                {/* Sadece saat (gün yukarıdaki ayıraçta); benim mesajımsa yanında ✓ (iletildi) veya altın ✓✓ (görüldü) */}
                <Text style={[styles.saat, m.benden && styles.myTime]}>
                  {formatTime(m.tarih)}
                  {m.benden && (
                    <Text
                      style={m.okundu && styles.seen}
                      accessibilityLabel={m.okundu ? 'Görüldü' : 'İletildi'}
                    >
                      {m.okundu ? '  ✓✓' : '  ✓'}
                    </Text>
                  )}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Gönderim hatası: yazılan metin silinmediği için kullanıcı tekrar "Gönder"e basarak yeniden deneyebilir */}
      {sendError !== '' && <Text style={styles.sendError}>{sendError}</Text>}

      {/* Yazma alanı: çok satırlı kutu + gönder butonu. paddingBottom: telefonun alt çubuğu kadar boşluk. */}
      <View style={[styles.composer, { paddingBottom: 8 + bottomInset }]}>
        <TextInput
          style={styles.box}
          value={text}
          onChangeText={setText}
          placeholder="Mesaj yazın"
          placeholderTextColor={colors.faint}
          multiline
          maxLength={MAX_LENGTH}
          accessibilityLabel="Mesaj"
        />
        {/* "Gönder" butonu: basınca send çalışır; boş metinde veya gönderim sürerken kapalıdır */}
        <Pressable
          style={({ pressed }) => [styles.send, (!canSend || pressed) && styles.muted]}
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Gönder"
          accessibilityState={{ disabled: !canSend, busy: sending }}
        >
          {sending ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            // Kağıt uçak ikonu: yazı yerine; ekran okuyucu için butonun adı accessibilityLabel'da
            <Icon ad="send" size={24} color={colors.onPrimary} background={colors.primary} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  error: {
    padding: 16,
  },
  loading: {
    marginTop: 24,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  // Gün ayıracı: ortada küçük köşeli etiket, monospace büyük harf
  daySeparator: {
    alignSelf: 'center',
    marginVertical: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius,
    backgroundColor: colors.card,
  },
  dayText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  bos: {
    textAlign: 'center',
    fontFamily: fonts.metin,
    fontSize: 15,
    color: colors.muted,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: radius,
    gap: 2,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.bubble, // koyu zümrüt: göz yormaz, altın sadece okundu tikinde
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface2,
  },
  mesaj: {
    fontFamily: fonts.metin,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  myText: {
    color: colors.bubbleText,
  },
  saat: {
    alignSelf: 'flex-end',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.muted,
  },
  seen: {
    color: colors.primary, // görüldü: altın tik, iletildi (soluk) tikinden ayırt edilsin diye
  },
  myTime: {
    color: colors.muted, // koyu zümrüt balon üstünde okunaklı soluk ton
  },
  sendError: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontFamily: fonts.metin,
    fontSize: 14,
    color: colors.error,
    backgroundColor: colors.card,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  box: {
    flex: 1,
    minHeight: 50,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius,
    fontFamily: fonts.metin,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface2,
  },
  // Gönder: kare altın buton (köşeli tasarım), içinde kağıt uçak ikonu
  send: {
    width: 50,
    height: 50,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  muted: {
    opacity: 0.5,
  },
});
