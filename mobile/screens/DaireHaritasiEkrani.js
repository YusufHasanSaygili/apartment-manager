// Daire haritası ekranı (yönetici): seçilen ayda her dairenin aidat durumunu bina bina gösterir.
// Ödeyen daireler yeşil (₺ coin ikonu ve parlama), onay bekleyenler sarı (saat), ödemeyenler kırmızı (yarım halka,
// nefes alan efekt), sakini olmayanlar çizgili gri (aralık kapı). Üstteki oklarla ay değiştirilir.
// Bir daireye dokununca o dairenin aidat takvimi açılır.
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import HataMesaji from '../components/HataMesaji';
import { useYenileme } from '../components/Yenileme';
import SayfaSecici from '../components/SayfaSecici';
import { BinaKarti, DURUMLAR, Lejant } from '../components/Durum';
import { ayAdi } from '../bicim';
import { renkler, yaziTipi } from '../tema';

// Bugünün ayı (harita açılınca bu ay seçili gelir) ve gidilebilecek en ileri ay (gelecek yılın Aralık'ı).
const bugun = new Date();
const BU_AY = { ay: bugun.getMonth() + 1, yil: bugun.getFullYear() };
const EN_SON_AY = { ay: 12, yil: bugun.getFullYear() + 1 };

// Ayı ileri/geri kaydırır; Date nesnesi yıl geçişini (Aralık → Ocak) kendisi halleder.
function ayKaydir({ ay, yil }, fark) {
  const tarih = new Date(yil, ay - 1 + fark, 1);
  return { ay: tarih.getMonth() + 1, yil: tarih.getFullYear() };
}

// navigation: daireye dokununca AidatTakvimi ekranını açmak için kullanılır.
export default function DaireHaritasiEkrani({ navigation }) {
  // useState: seçili ay. Değişince yukle yeniden oluşur ve harita o ay için istenir.
  const [secilenAy, setSecilenAy] = useState(BU_AY);
  // useState: sunucudan gelen harita ({ binalar, ozet }). null → yükleniyor.
  const [veri, setVeri] = useState(null);
  // useState: harita yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');

  // useRef: son isteğin numarası. Oklara hızlı basılınca eski ayın geç gelen cevabı yeni ayın üstüne yazılmasın diye
  // sadece en son isteğin cevabı ekrana konur.
  const sonIstek = useRef(0);

  // API isteği: GET /api/yonetim/aidatlar/harita?ay=10&yil=2026 → seçilen ayda tüm dairelerin durumu ve özet sayılar.
  // useCallback: fonksiyon her çizimde yeniden oluşmasın; useFocusEffect/useEffect buna bağlı olduğu için istek gereksiz yere tekrar atılmaz.
  const yukle = useCallback(async () => {
    const no = ++sonIstek.current;
    setHata('');
    try {
      const { data } = await api.get('/yonetim/aidatlar/harita', { params: secilenAy });
      if (no === sonIstek.current) setVeri(data);
    } catch (e) {
      if (no === sonIstek.current) setHata(e.message);
    }
  }, [secilenAy]);

  // Ok butonları ayı değiştirir; eski ayın haritası yeni ay yüklenene kadar görünmesin diye veri temizlenir.
  const ayDegistir = (fark) => {
    setVeri(null);
    setSecilenAy((a) => ayKaydir(a, fark));
  };

  // useFocusEffect: ekran her öne geldiğinde (ve ay değişince) harita yeniden yüklenir; takvimde elle işaretleme
  // yapılıp geri dönülünce renkler güncel olur.
  useFocusEffect(
    useCallback(() => {
      yukle();
    }, [yukle]),
  );

  // Aşağı çekip yenileme: sayfa en üstteyken aşağı çekilince yukle tekrar çalışır (components/Yenileme.js).
  const yenileme = useYenileme(yukle);

  const sondaMi = secilenAy.ay === EN_SON_AY.ay && secilenAy.yil === EN_SON_AY.yil;
  const ozet = veri?.ozet;
  const dolu = ozet ? ozet.odendi + ozet.bekliyor + ozet.odenmedi : 0;

  // Listenin üst kısmı: ay seçici, lejant (durumlar ve sayıları), hata veya yükleniyor
  const ust = (
    <View style={styles.ust}>
      {/* Ay seçici: sol ok bir önceki ay, sağ ok bir sonraki ay (gelecek yılın Aralık'ında durur) */}
      <SayfaSecici
        baslik={ayAdi(secilenAy.ay, secilenAy.yil)}
        alt={ozet ? `${dolu} dolu daire · ${ozet.odendi} ödedi` : ' '}
        onOnceki={() => ayDegistir(-1)}
        onSonraki={() => ayDegistir(1)}
        sonrakiPasif={sondaMi}
        oncekiAdi="Önceki ay"
        sonrakiAdi="Sonraki ay"
      />
      {ozet && (
        <Lejant
          ogeler={[
            ['odendi', ozet.odendi],
            ['bekliyor', ozet.bekliyor],
            ['odenmedi', ozet.odenmedi],
            ['bos', ozet.bos],
          ]}
        />
      )}
      {/* Hata kutusundaki "Tekrar dene" butonu: basınca yukle çalışır ve harita yeniden istenir */}
      {hata !== '' && <HataMesaji mesaj={hata} tekrarDene={yukle} />}
      {veri === null && hata === '' && <ActivityIndicator color={renkler.birincil} />}
    </View>
  );

  return (
    // FlatList: binaları alt alta listeler; her bina kendi kartında, daireleri 4'lü satırlarda.
    <FlatList
      refreshControl={yenileme}
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      data={veri?.binalar ?? []}
      keyExtractor={(bina) => bina.id}
      ListHeaderComponent={ust}
      ListEmptyComponent={veri && <Text style={styles.bos}>Henüz daire oluşturulmamış.</Text>}
      renderItem={({ item: bina }) => (
        // Daire kutusuna basınca o dairenin aidat takvimi açılır (daire adı başlıkta görünür)
        <BinaKarti
          ad={bina.ad}
          daireler={bina.daireler.map((d) => ({ ...d, erisimAdi: `Daire ${d.ad}: ${DURUMLAR[d.durum]?.ad ?? d.durum}. Aidat takvimini aç` }))}
          daireBasinca={(d) => navigation.navigate('AidatTakvimi', { daireId: d.id, daireAdi: d.ad })}
        />
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
    gap: 14,
  },
  ust: {
    gap: 12,
  },
  bos: {
    textAlign: 'center',
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    color: renkler.soluk,
  },
});
