// Bekleyen bildirimler ekranı: yönetici sakinlerden gelen "aidatı verdim" bildirimlerini görür,
// her birini onaylar veya reddeder. Sonuçlanan bildirim listeden çıkar.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import Buton from '../components/Buton';
import HataMesaji from '../components/HataMesaji';
import { useYenileme } from '../components/Yenileme';
import { ayAdi, paraBicimi, tarihBicimi } from '../bicim';
import { kose, renkler, yaziTipi } from '../tema';

export default function BekleyenBildirimlerEkrani() {
  // useState: sunucudan gelen bekleyen bildirimler. null → henüz yüklenmedi.
  const [bildirimler, setBildirimler] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');
  // useState: şu an işlenen (onaylanan/reddedilen) bildirimin id'si; o kartın butonları
  // dönen simge gösterir ve tekrar basılamaz.
  const [islenenId, setIslenenId] = useState(null);

  // API isteği: GET /api/yonetim/aidatlar/bekleyen ile sitedeki bekleyen bildirimleri çeker.
  // useCallback: fonksiyon sabit kalır, useEffect gereksiz yere tekrar çalışmaz.
  const yukle = useCallback(async () => {
    setHata('');
    try {
      const { data } = await api.get('/yonetim/aidatlar/bekleyen');
      setBildirimler(data);
    } catch (e) {
      setHata(e.message);
    }
  }, []);

  // useEffect: ekran ilk açıldığında bir kez çalışır ve listeyi yükler.
  useEffect(() => {
    yukle();
  }, [yukle]);

  // Aşağı çekip yenileme: sayfa en üstteyken aşağı çekilince yukle tekrar çalışır (components/Yenileme.js).
  const yenileme = useYenileme(yukle);

  // islem: 'onayla' veya 'reddet'. API isteği: POST /api/yonetim/aidatlar/:id/onayla|reddet.
  // Başarılı olunca bildirim listeden çıkarılır (sunucudan yeniden çekmeye gerek yok).
  const sonuclandir = async (id, islem) => {
    // Bir işlem sürerken başka bir karta basılırsa yok sayılır (işlemler sırayla yapılır).
    if (islenenId !== null) return;
    setIslenenId(id);
    try {
      await api.post(`/yonetim/aidatlar/${id}/${islem}`);
      setBildirimler((onceki) => onceki.filter((b) => b.id !== id));
    } catch (e) {
      // Örn. bildirim bu arada başka bir cihazdan sonuçlandırıldıysa: liste yenilenir.
      Alert.alert('İşlem yapılamadı', e.message);
      yukle();
    } finally {
      setIslenenId(null);
    }
  };

  // Reddetme geri alınamaz; yanlışlıkla basılmasın diye önce onay sorulur.
  const reddetOnayi = (b) =>
    Alert.alert('Bildirimi reddet', `${b.daire} dairesinin ${ayAdi(b.ay, b.yil)} bildirimi reddedilsin mi? Sakin bu ay için tekrar bildirim gönderebilir.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Reddet', style: 'destructive', onPress: () => sonuclandir(b.id, 'reddet') },
    ]);

  // Hata varsa ortak hata kutusu; "Tekrar dene" yukle'yi yeniden çalıştırır.
  if (hata !== '') {
    return (
      <View style={styles.orta}>
        <HataMesaji mesaj={hata} tekrarDene={yukle} />
      </View>
    );
  }

  // Liste gelene kadar yükleniyor simgesi gösterilir.
  if (bildirimler === null) {
    return (
      <View style={styles.orta}>
        <ActivityIndicator size="large" color={renkler.birincil} />
      </View>
    );
  }

  return (
    // FlatList: bildirimleri listeler; boşsa ListEmptyComponent gösterilir.
    // keyExtractor: React'in her kartı ayırt etmesi için benzersiz anahtar (bildirim id'si).
    <FlatList
      refreshControl={yenileme}
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      data={bildirimler}
      keyExtractor={(b) => b.id}
      ListEmptyComponent={<Text style={styles.bos}>Onay bekleyen aidat yok.</Text>}
      renderItem={({ item: b }) => (
        <View style={styles.kart}>
          {/* Üst satır: solda daire rozeti, sağda tutar ve altında hangi ayın aidatı olduğu */}
          <View style={styles.ustSatir}>
            <View style={styles.daireRozet}>
              <Text style={styles.daire}>{b.daire}</Text>
            </View>
            <View style={styles.tutarBlok}>
              <Text style={styles.tutar}>{paraBicimi(b.tutar)}</Text>
              <Text style={styles.soluk}>{ayAdi(b.ay, b.yil)}</Text>
            </View>
          </View>
          {/* Ödeme yöntemi ve bildirimin gönderildiği tarih; altında sakinin adı tek başına */}
          <Text style={styles.soluk}>
            {b.odemeYontemi === 'banka' ? 'Banka havalesi' : 'Elden'} · {tarihBicimi(b.tarih)}
          </Text>
          <Text style={styles.sakin}>{b.sakin}</Text>
          {b.aciklama !== '' && (
            <View style={styles.alinti}>
              <Text style={styles.aciklama}>“{b.aciklama}”</Text>
            </View>
          )}

          <View style={styles.butonlar}>
            {/* "Onayla" butonu (₺ coin ikonlu): basınca sonuclandir(id, 'onayla') çalışır; o ay ödenmiş sayılır */}
            <View style={styles.buton}>
              <Buton baslik="Onayla" ikon="odedi" onPress={() => sonuclandir(b.id, 'onayla')} yukleniyor={islenenId === b.id} />
            </View>
            {/* "Reddet" butonu: basınca önce onay sorulur (reddetOnayi), onaylanırsa bildirim reddedilir */}
            <View style={styles.buton}>
              <Buton baslik="Reddet" tur="ikincil" onPress={() => reddetOnayi(b)} yukleniyor={islenenId === b.id} />
            </View>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
    backgroundColor: renkler.arkaPlan,
  },
  icerik: {
    padding: 18,
    gap: 12,
  },
  orta: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: renkler.arkaPlan,
  },
  bos: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    color: renkler.soluk,
  },
  kart: {
    padding: 16,
    gap: 6,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  ustSatir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  daireRozet: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: kose,
    backgroundColor: renkler.yuzey3,
  },
  daire: {
    fontFamily: yaziTipi.mono,
    fontSize: 17,
    fontWeight: '600',
    color: renkler.yazi,
  },
  tutarBlok: {
    alignItems: 'flex-end',
  },
  tutar: {
    fontFamily: yaziTipi.mono,
    fontSize: 20,
    fontWeight: '600',
    color: renkler.yazi,
  },
  soluk: {
    fontFamily: yaziTipi.metin,
    fontSize: 13,
    color: renkler.soluk,
  },
  sakin: {
    fontFamily: yaziTipi.metin,
    fontSize: 15.5,
    fontWeight: '600',
    color: renkler.yazi,
  },
  // Açıklama: solda ince çizgiyle alıntı gibi
  alinti: {
    marginTop: 2,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: renkler.kenarlikGuclu,
  },
  aciklama: {
    fontFamily: yaziTipi.metin,
    fontSize: 14,
    fontStyle: 'italic',
    color: renkler.yazi,
  },
  // İki buton yan yana, eşit genişlikte (flex: 1).
  butonlar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  buton: {
    flex: 1,
  },
});
