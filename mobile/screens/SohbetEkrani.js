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
import { useSoketOlayi } from '../services/soket';
import { acikSohbetAyarla } from '../services/bildirim';
import HataMesaji from '../components/HataMesaji';
import { gunEtiketi, saatBicimi } from '../bicim';
import Ikon from '../components/Ikon';
import { kose, renkler, yaziTipi } from '../tema';

// Mesaj kutusuna yazılabilecek en fazla karakter (backend'deki sınırla aynı).
const EN_FAZLA_KARAKTER = 1000;

// Yeni mesajı listenin başına (en yeni) ekler. Aynı mesaj hem gönderim cevabıyla hem soketle
// gelebildiği için listede zaten varsa (id aynıysa) tekrar eklenmez.
// Liste henüz yüklenmediyse (null) mesaj tek başına tutulur; yükleme bitince yukle içindeki birleştirme onu korur.
const mesajEkle = (onceki, mesaj) =>
  onceki?.some((m) => m.id === mesaj.id) ? onceki : [mesaj, ...(onceki ?? [])];

// route.params.kisiId: konuşulan kişi (yönetici açarken verir; sakin açarken boştur).
export default function SohbetEkrani({ route }) {
  // Alttaki güvenli boşluk (telefonun alt çubuğu/hareket çizgisi): yazma kutusu bu çubuğun altında kalmasın diye.
  const altBosluk = useSafeAreaInsets().bottom;

  // useRef: konuşulan kişinin kimliği. Yönetici için parametreden gelir; sakin için ilk yüklemede bulunur.
  // useState yerine useRef: değeri değişince ekran yeniden çizilmez ve yukle fonksiyonu yeniden oluşmaz;
  // böylece sakin sohbeti açınca mesajlar iki kez istenmez. Değer kisiRef.current ile okunur/yazılır.
  const kisiRef = useRef(route.params?.kisiId ?? null);
  // useState: mesajlar (yeniden eskiye). null → henüz yüklenmedi.
  const [mesajlar, setMesajlar] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');
  // useState: yazma kutusundaki metin. Her harf yazıldığında güncellenir.
  const [metin, setMetin] = useState('');
  // useState: ekranın pencerenin tepesinden uzaklığı (üstteki durum çubuğu + başlık çubuğu yüksekliği).
  // Klavye açılınca yazma kutusunun ne kadar yukarı itileceği hesaplanırken bu kadar düzeltme yapılır;
  // yoksa kutu başlık yüksekliği kadar klavyenin arkasında kalır.
  const [ustBosluk, setUstBosluk] = useState(0);
  // useRef: ekranın dış kutusuna erişmek (konumunu ölçmek) için.
  const disRef = useRef(null);
  // useState: mesaj gönderilemezse yazma kutusunun üstünde gösterilecek hata (liste hatasından ayrı tutulur,
  // çünkü listedeki "Tekrar dene" mesajı yeniden göndermez, sadece listeyi yeniler).
  const [gonderimHatasi, setGonderimHatasi] = useState('');
  // useState: mesaj gönderilirken true; gönder butonu bu sırada kapalıdır (aynı mesaj iki kez gitmez).
  const [gonderiliyor, setGonderiliyor] = useState(false);
  // useRef: bu ekran şu an önde mi (kullanıcı sohbete bakıyor mu). Mesajlar sadece kullanıcı gerçekten
  // bakarken "görüldü" sayılır. Değişince ekranın yeniden çizilmesine gerek olmadığı için useRef.
  const gorunurRef = useRef(false);

  // API isteği: PUT /api/mesajlar/:kisiId/okundu ile karşı taraftan gelen okunmamış mesajları "okundu" yapar;
  // sunucu da karşı tarafa haber verir ve onun ekranında ✓ → ✓✓ olur.
  // Sadece ekran öndeyse VE uygulama açıksa (AppState 'active') çağrılır; telefon cepteyken veya kullanıcı
  // başka ekrandayken gelen mesaj okunmuş sayılmaz. Hata olursa sessizce geçilir (sadece işaret gecikir).
  // useCallback (boş bağımlılık): değerleri ref'lerden okuduğu için hiç yeniden oluşturulmasına gerek yok;
  // böylece onu kullanan yukle, yeniMesajGeldi ve AppState dinleyicisi de sabit kalır.
  const okunduIsaretle = useCallback(() => {
    if (!gorunurRef.current || AppState.currentState !== 'active' || !kisiRef.current) return;
    api.put(`/mesajlar/${kisiRef.current}/okundu`).catch(() => {});
  }, []);

  // API isteği: önce (sakinse) GET /api/mesajlar/sohbetler ile yöneticinin kimliğini bulur,
  // sonra GET /api/mesajlar/:kisiId ile bu kişiyle olan son 100 mesajı çeker.
  // useCallback: fonksiyonu tek bir kez oluşturur (tek bağımlılığı okunduIsaretle de hiç değişmez); böylece
  // useFocusEffect ve soket dinleyicisi her çizimde gereksiz yere yeniden kurulmaz.
  const yukle = useCallback(async () => {
    setHata('');
    try {
      if (!kisiRef.current) {
        const { data } = await api.get('/mesajlar/sohbetler');
        // Sakinin listesinde sadece sitenin yöneticisi bulunur.
        if (data.length === 0) throw new Error('Sitenin yöneticisi bulunamadı.');
        kisiRef.current = data[0].id;
      }
      const { data } = await api.get(`/mesajlar/${kisiRef.current}`);
      // Liste sunucudan gelenle değiştirilir; ama istek sürerken soketle gelen (sunucunun listesinden
      // daha yeni) mesajlar kaybolmasın diye onlar listenin başında korunur.
      // Tarihler ISO metni ("2026-10-03T12:00:00.000Z") olarak geldiği için > ile doğrudan karşılaştırılabilir.
      setMesajlar((onceki) => {
        const enYeni = data[0]?.tarih ?? '';
        const yeniGelenler = (onceki ?? []).filter((m) => m.tarih > enYeni && !data.some((d) => d.id === m.id));
        return [...yeniGelenler, ...data];
      });
      // Ekran öndeyse: bu sohbet "açık" olarak kaydedilir (bu kişiden gelen bildirimler gösterilmez)
      // ve gelen mesajlar okundu işaretlenir.
      if (gorunurRef.current) {
        acikSohbetAyarla(kisiRef.current);
        okunduIsaretle();
      }
    } catch (e) {
      setHata(e.message);
    }
  }, [okunduIsaretle]);

  // useFocusEffect: ekran her öne geldiğinde mesajlar yeniden çekilir ve ekran "görünür" işaretlenir.
  // Döndürülen temizlik fonksiyonu ekran arkaya gidince (geri basılınca) çalışır: ekran artık görünmez
  // ve açık sohbet kaydı silinir; bu kişiden gelen mesajlar yine bildirim olarak gösterilir.
  useFocusEffect(
    useCallback(() => {
      gorunurRef.current = true;
      yukle();
      return () => {
        gorunurRef.current = false;
        acikSohbetAyarla(null);
      };
    }, [yukle])
  );

  // useEffect: uygulama arka plandan öne gelince (AppState 'active') sohbet açıksa, arka plandayken
  // gelen mesajlar okundu işaretlenir. Ekran kapanınca dinleyici kaldırılır (remove).
  useEffect(() => {
    const abonelik = AppState.addEventListener('change', (durum) => {
      if (durum === 'active') okunduIsaretle();
    });
    return () => abonelik.remove();
  }, [okunduIsaretle]);

  // Soketten yeni mesaj gelince çalışır. Mesaj sadece AÇIK OLAN sohbete aitse (kisiId bu ekrandaki
  // kişiyse) listeye eklenir; başka bir sakinden gelen mesaj bu ekranda görünmez.
  // useCallback: dinleyici her çizimde yeniden kurulmasın diye fonksiyon sabit tutulur.
  // Karşı taraftan gelen mesajsa ve kullanıcı ekrana bakıyorsa hemen okundu işaretlenir.
  const yeniMesajGeldi = useCallback(
    (mesaj) => {
      if (mesaj.kisiId !== kisiRef.current) return;
      setMesajlar((onceki) => mesajEkle(onceki, mesaj));
      if (!mesaj.benden) okunduIsaretle();
    },
    [okunduIsaretle]
  );

  // Soketten "mesajlarınız okundu" haberi gelince çalışır: bu sohbetse, benim gönderdiğim mesajlar
  // okundu sayılır ve ekranda ✓ işaretleri ✓✓ olur. map: listeyi değiştirmeden yeni bir liste üretir
  // (React state'i doğrudan değiştirilmez, yeni değer verilir ki ekran yenilensin).
  // zaman: karşı tarafın okuduğu an; sadece o andan önce gönderilmiş mesajlar ✓✓ yapılır (ISO metin karşılaştırması).
  const mesajlarOkundu = useCallback(({ kisiId, zaman }) => {
    if (kisiId !== kisiRef.current) return;
    setMesajlar((onceki) =>
      onceki?.map((m) => (m.benden && !m.okundu && m.tarih <= zaman ? { ...m, okundu: true } : m))
    );
  }, []);

  // Soket olayları: 'yeniMesaj' gelince mesaj ekrana eklenir; 'mesajlarOkundu' gelince ✓✓ yapılır. 'connect': bağlantı koptuysa (internet gitti,
  // uygulama arka plana alındı) yeniden bağlanınca o arada kaçırılan mesajlar için liste yeniden çekilir.
  useSoketOlayi('yeniMesaj', yeniMesajGeldi);
  useSoketOlayi('mesajlarOkundu', mesajlarOkundu);
  useSoketOlayi('connect', yukle);

  // API isteği: POST /api/mesajlar ile { aliciId, icerik } gönderir. Başarılıysa sunucunun döndürdüğü
  // mesaj listenin başına (en yeni) eklenir ve yazma kutusu temizlenir; hata olursa metin silinmez.
  const gonder = async () => {
    const icerik = metin.trim();
    if (!icerik || !kisiRef.current || gonderiliyor) return;
    setGonderiliyor(true);
    setGonderimHatasi('');
    try {
      const { data } = await api.post('/mesajlar', { aliciId: kisiRef.current, icerik });
      setMesajlar((onceki) => mesajEkle(onceki, data));
      setMetin('');
    } catch (e) {
      setGonderimHatasi(e.message);
    } finally {
      setGonderiliyor(false);
    }
  };

  // Gönder butonu sadece metin boş değilse, mesajlar yüklendiyse (yani konuşulan kişi belliyse)
  // ve önceki gönderim bittiyse açıktır.
  const gonderilebilir = metin.trim() !== '' && mesajlar !== null && !gonderiliyor;

  return (
    // KeyboardAvoidingView: klavye açılınca alttaki yazma kutusunu klavyenin üstüne iter.
    // keyboardVerticalOffset: ekranın üstündeki başlık yüksekliği kadar düzeltme (yukarıda ölçülen ustBosluk).
    // onLayout: ekran yerleşince measureInWindow ile dış kutunun pencereye göre konumu (y) ölçülür.
    <KeyboardAvoidingView
      ref={disRef}
      style={styles.dis}
      behavior="padding"
      keyboardVerticalOffset={ustBosluk}
      onLayout={() => disRef.current?.measureInWindow((x, y) => setUstBosluk(y))}
    >
      {hata !== '' && (
        <View style={styles.hata}>
          {/* Hata kutusundaki "Tekrar dene" butonu: basınca yukle çalışır */}
          <HataMesaji mesaj={hata} tekrarDene={yukle} />
        </View>
      )}
      {mesajlar === null && hata === '' && <ActivityIndicator style={styles.yukleniyor} color={renkler.birincil} />}

      {/* FlatList inverted: liste ters çevrilir, en yeni mesaj en altta görünür ve açılışta oraya kaydırmak gerekmez.
          Bu yüzden veriler sunucudan YENİDEN ESKİYE gelir. keyExtractor: her mesajın benzersiz anahtarı (id). */}
      <FlatList
        style={styles.liste}
        contentContainerStyle={styles.listeIcerik}
        data={mesajlar ?? []}
        inverted
        keyExtractor={(m) => m.id}
        // Boş liste yazısı: ters listede React Native bu yazıyı kendisi düz çevirir, ayrıca bir şey yapmaya gerek yok.
        ListEmptyComponent={
          mesajlar && <Text style={styles.bos}>Henüz mesaj yok. İlk mesajı siz yazın.</Text>
        }
        renderItem={({ item: m, index }) => {
          // Gün ayıracı: bu mesaj kendi gününün ilk (en eski) mesajıysa üstünde "Bugün / Dün / 2 Ekim 2026" çıkar.
          // Liste yeniden eskiye sıralı olduğu için bir sonraki eleman (index + 1) bir önceki mesajdır.
          const onceki = mesajlar[index + 1];
          const yeniGun = !onceki || new Date(onceki.tarih).toDateString() !== new Date(m.tarih).toDateString();
          return (
            <View>
              {yeniGun && (
                <View style={styles.gunAyrac}>
                  <Text style={styles.gunYazi}>{gunEtiketi(m.tarih).toLocaleUpperCase('tr-TR')}</Text>
                </View>
              )}
              {/* Baloncuk: benim mesajım sağda ve koyu zümrüt, karşı tarafınki solda ve koyu gri. */}
              <View style={[styles.balon, m.benden ? styles.benim : styles.onun]}>
                <Text style={[styles.mesaj, m.benden && styles.benimYazi]}>{m.icerik}</Text>
                {/* Sadece saat (gün yukarıdaki ayıraçta); benim mesajımsa yanında ✓ (iletildi) veya altın ✓✓ (görüldü) */}
                <Text style={[styles.saat, m.benden && styles.benimSaat]}>
                  {saatBicimi(m.tarih)}
                  {m.benden && (
                    <Text
                      style={m.okundu && styles.goruldu}
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
      {gonderimHatasi !== '' && <Text style={styles.gonderimHatasi}>{gonderimHatasi}</Text>}

      {/* Yazma alanı: çok satırlı kutu + gönder butonu. paddingBottom: telefonun alt çubuğu kadar boşluk. */}
      <View style={[styles.yazmaAlani, { paddingBottom: 8 + altBosluk }]}>
        <TextInput
          style={styles.kutu}
          value={metin}
          onChangeText={setMetin}
          placeholder="Mesaj yazın"
          placeholderTextColor={renkler.sonuk}
          multiline
          maxLength={EN_FAZLA_KARAKTER}
          accessibilityLabel="Mesaj"
        />
        {/* "Gönder" butonu: basınca gonder çalışır; boş metinde veya gönderim sürerken kapalıdır */}
        <Pressable
          style={({ pressed }) => [styles.gonder, (!gonderilebilir || pressed) && styles.soluk]}
          onPress={gonder}
          disabled={!gonderilebilir}
          accessibilityRole="button"
          accessibilityLabel="Gönder"
          accessibilityState={{ disabled: !gonderilebilir, busy: gonderiliyor }}
        >
          {gonderiliyor ? (
            <ActivityIndicator color={renkler.birincilUzeri} />
          ) : (
            // Kağıt uçak ikonu: yazı yerine; ekran okuyucu için butonun adı accessibilityLabel'da
            <Ikon ad="gonder" boyut={24} renk={renkler.birincilUzeri} arka={renkler.birincil} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
    backgroundColor: renkler.arkaPlan,
  },
  hata: {
    padding: 16,
  },
  yukleniyor: {
    marginTop: 24,
  },
  liste: {
    flex: 1,
  },
  listeIcerik: {
    padding: 16,
    gap: 8,
  },
  // Gün ayıracı: ortada küçük köşeli etiket, monospace büyük harf
  gunAyrac: {
    alignSelf: 'center',
    marginVertical: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: kose,
    backgroundColor: renkler.kart,
  },
  gunYazi: {
    fontFamily: yaziTipi.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: renkler.soluk,
  },
  bos: {
    textAlign: 'center',
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    color: renkler.soluk,
  },
  balon: {
    maxWidth: '80%',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: kose,
    gap: 2,
  },
  benim: {
    alignSelf: 'flex-end',
    backgroundColor: renkler.balon, // koyu zümrüt: göz yormaz, altın sadece okundu tikinde
  },
  onun: {
    alignSelf: 'flex-start',
    backgroundColor: renkler.yuzey2,
  },
  mesaj: {
    fontFamily: yaziTipi.metin,
    fontSize: 16,
    lineHeight: 22,
    color: renkler.yazi,
  },
  benimYazi: {
    color: renkler.balonYazi,
  },
  saat: {
    alignSelf: 'flex-end',
    fontFamily: yaziTipi.mono,
    fontSize: 11,
    color: renkler.soluk,
  },
  goruldu: {
    color: renkler.birincil, // görüldü: altın tik, iletildi (soluk) tikinden ayırt edilsin diye
  },
  benimSaat: {
    color: renkler.soluk, // koyu zümrüt balon üstünde okunaklı soluk ton
  },
  gonderimHatasi: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontFamily: yaziTipi.metin,
    fontSize: 14,
    color: renkler.hata,
    backgroundColor: renkler.kart,
  },
  yazmaAlani: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: renkler.arkaPlan,
    borderTopWidth: 1,
    borderTopColor: renkler.kenarlik,
  },
  kutu: {
    flex: 1,
    minHeight: 50,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: kose,
    fontFamily: yaziTipi.metin,
    fontSize: 16,
    color: renkler.yazi,
    backgroundColor: renkler.yuzey2,
  },
  // Gönder: kare altın buton (köşeli tasarım), içinde kağıt uçak ikonu
  gonder: {
    width: 50,
    height: 50,
    borderRadius: kose,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: renkler.birincil,
  },
  soluk: {
    opacity: 0.5,
  },
});
