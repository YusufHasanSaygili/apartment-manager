// Duyurular ekranı: sitedeki duyuruları yeniden eskiye listeler. Hem yönetici hem sakin kullanır.
// Her kartta solda kare tarih bloğu (gün ve ay), başlık, zümrüt renkli göreli zaman ("Bugün · 09:12",
// "2 gün önce · 18:40") ve duyurunun metni var. Bugünün duyurusu zümrüt çerçeveyle öne çıkar.
// Yönetici için üstte iki kutu (Yeni duyuru, Tekrarlayan) vardır ve bir karta dokununca düzenleme ekranı açılır;
// sakin sadece okur.
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import HataMesaji from '../components/HataMesaji';
import { useYenileme } from '../components/Yenileme';
import Ikon from '../components/Ikon';
import Kutu from '../components/Kutu';
import { goreliGun, saatBicimi, tarihBlogu } from '../bicim';
import { kose, renkler, yaziTipi, yazilar } from '../tema';

// navigation: yönetici için DuyuruYaz ve TekrarlananDuyurular ekranlarına geçmek için kullanılır.
export default function DuyurularEkrani({ navigation }) {
  const { oturum } = useOturum();
  // Rol kontrolü sadece ekranı düzenlemek için; asıl yetki kontrolü backend'de (sakin duyuru yazamaz/silemez).
  const yonetici = oturum.kullanici.rol === 'yonetici';

  // useState: duyuru listesi. null → henüz yüklenmedi.
  const [duyurular, setDuyurular] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');

  // API isteği: GET /api/duyurular → sitenin duyuruları (yeniden eskiye).
  // useCallback: fonksiyon her çizimde yeniden oluşmasın; useFocusEffect/useEffect buna bağlı olduğu için istek gereksiz yere tekrar atılmaz.
  const yukle = useCallback(async () => {
    setHata('');
    try {
      const { data } = await api.get('/duyurular');
      setDuyurular(data);
    } catch (e) {
      setHata(e.message);
    }
  }, []);

  // useFocusEffect: ekran her öne geldiğinde liste yeniden yüklenir; duyuru yazıp/düzenleyip geri dönülünce güncel olur.
  useFocusEffect(
    useCallback(() => {
      yukle();
    }, [yukle]),
  );

  // Aşağı çekip yenileme: sayfa en üstteyken aşağı çekilince yukle tekrar çalışır (components/Yenileme.js).
  const yenileme = useYenileme(yukle);

  // Listenin üst kısmı: yöneticiye iki kutu ve kısa ipucu; hata veya yükleniyor
  const ust = (
    <View style={styles.ust}>
      {yonetici && (
        <>
          <View style={styles.kutular}>
            {/* "Yeni duyuru" kutusu: basınca boş DuyuruYaz ekranı açılır */}
            <Kutu ikon="ekle" baslik="Yeni duyuru" alt="Herkese bildirim gider" onPress={() => navigation.navigate('DuyuruYaz')} />
            {/* "Tekrarlayan" kutusu: basınca TekrarlananDuyurular ekranı açılır ("Her pazartesi çöp günü" gibi) */}
            <Kutu ikon="tekrar" baslik="Tekrarlayan" alt="Gün ve saat seçerek" onPress={() => navigation.navigate('TekrarlananDuyurular')} />
          </View>
          <Text style={yazilar.etiket}>SON DUYURULAR · DÜZENLEMEK İÇİN DOKUNUN</Text>
        </>
      )}
      {/* Hata kutusundaki "Tekrar dene" butonu: basınca yukle çalışır ve liste yeniden istenir */}
      {hata !== '' && <HataMesaji mesaj={hata} tekrarDene={yukle} />}
      {duyurular === null && hata === '' && <ActivityIndicator color={renkler.birincil} />}
    </View>
  );

  return (
    // FlatList: duyuruları alt alta listeler.
    <FlatList
      refreshControl={yenileme}
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      data={duyurular ?? []}
      keyExtractor={(d) => d.id}
      ListHeaderComponent={ust}
      ListEmptyComponent={duyurular && <Text style={styles.bos}>Henüz duyuru yok.</Text>}
      renderItem={({ item: d }) => {
        const gun = goreliGun(d.tarih);
        const yeni = gun === 'Bugün';
        const blok = tarihBlogu(d.tarih);
        return (
          // Yönetici karta basınca duyuru düzenleme ekranı (DuyuruYaz) bu duyuruyla açılır; sakin için kart basılamaz.
          <Pressable
            style={({ pressed }) => [styles.kart, yeni && styles.kartYeni, pressed && yonetici && styles.basili]}
            onPress={() => navigation.navigate('DuyuruYaz', { duyuru: d })}
            disabled={!yonetici}
            accessibilityRole={yonetici ? 'button' : undefined}
            accessibilityHint={yonetici ? 'Duyuruyu düzenler veya siler' : undefined}
          >
            <View style={styles.kartUst}>
              {/* Kare tarih bloğu: gün ve ayın kısa adı */}
              <View style={styles.tarih}>
                <Text style={styles.tarihGun}>{blok.gun}</Text>
                <Text style={styles.tarihAy}>{blok.ay}</Text>
              </View>
              <View style={styles.baslikBlok}>
                <Text style={styles.baslik}>{d.baslik}</Text>
                {/* Göreli zaman: zümrüt renkte; bugünün duyurusunda zümrüt zeminli etiket */}
                <View style={[styles.goreli, yeni && styles.goreliYeni]}>
                  <Ikon ad={yeni ? 'duyuru' : 'takvim'} boyut={14} renk={renkler.zumrut} />
                  <Text style={styles.goreliYazi}>
                    {gun} · {saatBicimi(d.tarih)}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.metin}>{d.icerik}</Text>
          </Pressable>
        );
      }}
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
  ust: {
    gap: 12,
  },
  kutular: {
    flexDirection: 'row',
    gap: 10,
  },
  bos: {
    textAlign: 'center',
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    color: renkler.soluk,
  },
  kart: {
    padding: 14,
    paddingHorizontal: 16,
    gap: 10,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  kartYeni: {
    borderColor: renkler.zumrutCizgi,
  },
  basili: {
    opacity: 0.75,
  },
  kartUst: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tarih: {
    width: 46,
    height: 46,
    borderRadius: kose,
    backgroundColor: renkler.yuzey3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tarihGun: {
    fontFamily: yaziTipi.mono,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 19,
    color: renkler.yazi,
  },
  tarihAy: {
    fontFamily: yaziTipi.mono,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: renkler.soluk,
  },
  baslikBlok: {
    flex: 1,
    gap: 3,
  },
  baslik: {
    fontFamily: yaziTipi.metin,
    fontSize: 16,
    fontWeight: '600',
    color: renkler.yazi,
  },
  goreli: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  goreliYeni: {
    paddingVertical: 2,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.zumrutCizgi,
    backgroundColor: renkler.zumrutZemin,
  },
  goreliYazi: {
    fontFamily: yaziTipi.metin,
    fontSize: 12.5,
    fontWeight: '600',
    color: renkler.zumrut,
  },
  metin: {
    fontFamily: yaziTipi.metin,
    fontSize: 14,
    lineHeight: 20,
    color: renkler.soluk,
  },
});
