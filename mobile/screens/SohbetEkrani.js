// Sohbet ekranı: iki kişi arasındaki mesajları WhatsApp benzeri baloncuklarla gösterir ve yeni mesaj gönderir.
// Yönetici ve sakin aynı ekranı kullanır. Yönetici bir sakine dokununca açılır (kisiId parametresiyle);
// sakin "Yöneticiye mesaj" butonuyla açar (kisiId verilmez, yöneticinin kimliği sunucudan öğrenilir).
// Mesajlar ekran açılınca ve "Yenile"ye basınca güncellenir (anında düşmesi Görev 4.2'de eklenecek).
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import HataMesaji from '../components/HataMesaji';
import { tarihBicimi } from '../bicim';
import { renkler } from '../tema';

// Mesaj kutusuna yazılabilecek en fazla karakter (backend'deki sınırla aynı).
const EN_FAZLA_KARAKTER = 1000;

// route.params.kisiId: konuşulan kişi (yönetici açarken verir; sakin açarken boştur).
// navigation: başlık çubuğuna "Yenile" butonu eklemek için kullanılır.
export default function SohbetEkrani({ route, navigation }) {
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

  // API isteği: önce (sakinse) GET /api/mesajlar/sohbetler ile yöneticinin kimliğini bulur,
  // sonra GET /api/mesajlar/:kisiId ile bu kişiyle olan son 100 mesajı çeker.
  // useCallback: fonksiyonu tek bir kez oluşturur (bağımlılık listesi boş); böylece useFocusEffect ve
  // "Yenile" butonu her çizimde gereksiz yere yeniden kurulmaz.
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
      setMesajlar(data);
    } catch (e) {
      setHata(e.message);
    }
  }, []);

  // useFocusEffect: ekran her öne geldiğinde mesajlar yeniden çekilir.
  useFocusEffect(
    useCallback(() => {
      yukle();
    }, [yukle])
  );

  // useLayoutEffect: ekran çizilmeden önce başlık çubuğunun sağına "Yenile" butonu ekler.
  // Mesajlar henüz anında düşmediği için karşı tarafın yeni mesajını görmek için kullanılır.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        // "Yenile" butonu: basınca yukle çalışır ve mesajlar sunucudan yeniden çekilir.
        <Pressable onPress={yukle} hitSlop={12} accessibilityRole="button">
          <Text style={styles.yenile}>Yenile</Text>
        </Pressable>
      ),
    });
  }, [navigation, yukle]);

  // API isteği: POST /api/mesajlar ile { aliciId, icerik } gönderir. Başarılıysa sunucunun döndürdüğü
  // mesaj listenin başına (en yeni) eklenir ve yazma kutusu temizlenir; hata olursa metin silinmez.
  const gonder = async () => {
    const icerik = metin.trim();
    if (!icerik || !kisiRef.current || gonderiliyor) return;
    setGonderiliyor(true);
    setGonderimHatasi('');
    try {
      const { data } = await api.post('/mesajlar', { aliciId: kisiRef.current, icerik });
      setMesajlar((onceki) => [data, ...(onceki ?? [])]);
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
        renderItem={({ item: m }) => (
          // Baloncuk: benim mesajım sağda ve renkli, karşı tarafınki solda ve beyaz.
          <View style={[styles.balon, m.benden ? styles.benim : styles.onun]}>
            <Text style={[styles.mesaj, m.benden && styles.benimYazi]}>{m.icerik}</Text>
            <Text style={[styles.saat, m.benden && styles.benimSaat]}>{tarihBicimi(m.tarih)}</Text>
          </View>
        )}
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
          placeholderTextColor={renkler.soluk}
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
          accessibilityState={{ disabled: !gonderilebilir, busy: gonderiliyor }}
        >
          {gonderiliyor ? (
            <ActivityIndicator color={renkler.birincilUzeri} />
          ) : (
            <Text style={styles.gonderYazi}>Gönder</Text>
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
  yenile: {
    fontSize: 16,
    fontWeight: '600',
    color: renkler.birincil,
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
  bos: {
    textAlign: 'center',
    fontSize: 15,
    color: renkler.soluk,
  },
  balon: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 2,
  },
  benim: {
    alignSelf: 'flex-end',
    backgroundColor: renkler.birincil,
    borderBottomRightRadius: 4,
  },
  onun: {
    alignSelf: 'flex-start',
    backgroundColor: renkler.kart,
    borderBottomLeftRadius: 4,
  },
  mesaj: {
    fontSize: 16,
    lineHeight: 22,
    color: renkler.yazi,
  },
  benimYazi: {
    color: renkler.birincilUzeri,
  },
  saat: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: renkler.soluk,
  },
  benimSaat: {
    color: '#CCFBF1', // birincil renk üstünde okunaklı açık ton
  },
  gonderimHatasi: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontSize: 14,
    color: renkler.hata,
    backgroundColor: renkler.kart,
  },
  yazmaAlani: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: renkler.kart,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: renkler.kenarlik,
  },
  kutu: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    fontSize: 16,
    color: renkler.yazi,
    backgroundColor: renkler.arkaPlan,
  },
  gonder: {
    height: 44,
    minWidth: 80,
    paddingHorizontal: 16,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: renkler.birincil,
  },
  soluk: {
    opacity: 0.5,
  },
  gonderYazi: {
    fontSize: 16,
    fontWeight: '600',
    color: renkler.birincilUzeri,
  },
});
