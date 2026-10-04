// Duyuru yazma ekranı: yönetici tüm siteye duyuru yapar ("Bugün çöp günü", "Tadilat olacak").
// Listeden bir duyuruya dokunulduysa aynı ekran düzenleme modunda açılır: alanlar dolu gelir,
// "Kaydet" ile düzeltilir, "Duyuruyu sil" ile silinir.
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import Buton from '../components/Buton';
import FormAlani from '../components/FormAlani';
import HataMesaji from '../components/HataMesaji';
import { renkler, yazilar } from '../tema';

// route.params.duyuru: düzenlenecek duyuru (listeden dokunulduysa). Yoksa yeni duyuru yazılır.
export default function DuyuruYazEkrani({ route, navigation }) {
  const duzenlenen = route.params?.duyuru;

  // useState: başlık ve içerik alanlarının değerleri (düzenlemede mevcut değerlerle başlar).
  const [baslik, setBaslik] = useState(duzenlenen?.baslik ?? '');
  const [icerik, setIcerik] = useState(duzenlenen?.icerik ?? '');
  // useState: istek sürerken true; duyuru iki kez gönderilmez.
  const [yukleniyor, setYukleniyor] = useState(false);
  // useState: hata olursa gösterilecek mesaj.
  const [hata, setHata] = useState('');

  // yayinla: "Yayınla" / "Kaydet" butonuna basınca çalışır. Telefonda kısa kontrol (hızlı geri bildirim),
  // asıl kontrol backend'de. Başarılıysa duyurular listesine dönülür.
  const yayinla = async () => {
    if (baslik.trim().length < 2 || !icerik.trim()) {
      setHata('Başlık (en az 2 karakter) ve içerik girin.');
      return;
    }

    setHata('');
    setYukleniyor(true);
    try {
      // API isteği: yeni duyuruda POST /api/duyurular, düzenlemede PUT /api/duyurular/:id.
      // Site bilgisi gönderilmez; backend yöneticinin sitesini token'dan bulur.
      if (duzenlenen) {
        await api.put(`/duyurular/${duzenlenen.id}`, { baslik, icerik });
      } else {
        await api.post('/duyurular', { baslik, icerik });
      }
      navigation.goBack();
    } catch (e) {
      setHata(e.message);
      setYukleniyor(false);
    }
  };

  // Silme geri alınamaz; önce onay sorulur. Onaylanırsa DELETE /api/duyurular/:id isteği atılır
  // ve listeye dönülür (liste öne gelince kendini yeniler).
  const silOnayi = () =>
    Alert.alert('Duyuruyu sil', `"${duzenlenen.baslik}" duyurusu silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          // Silme sürerken butonlar kilitlenir (aynı anda "Kaydet"e basılamaz).
          setYukleniyor(true);
          try {
            await api.delete(`/duyurular/${duzenlenen.id}`);
            navigation.goBack();
          } catch (e) {
            setHata(e.message);
            setYukleniyor(false);
          }
        },
      },
    ]);

  return (
    // KeyboardAwareScrollView: klavye açılınca alanlar ve buton klavyenin altında kalmaz.
    <KeyboardAwareScrollView
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[yazilar.aciklama, styles.aciklama]}>Duyuru sitedeki herkesin duyurular listesinde görünür.</Text>

      {/* sayac: yazılan karakter sayısı / en fazla (backend de aynı sınırları kontrol eder) */}
      <FormAlani etiket="Başlık" sayac={`${baslik.length} / 80`} value={baslik} onChangeText={setBaslik} maxLength={80} placeholder="Örn. Bugün çöp günü" />
      {/* multiline: içerik birden fazla satır olabilir */}
      <FormAlani
        etiket="İçerik"
        sayac={`${icerik.length} / 1000`}
        value={icerik}
        onChangeText={setIcerik}
        maxLength={1000}
        multiline
        style={styles.uzunAlan}
        placeholder="Örn. Çöpler akşam 20.00'de alınacak."
      />

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {hata !== '' && <HataMesaji mesaj={hata} />}

      {/* "Yayınla" / "Kaydet" butonu: basınca yayinla çalışır ve duyuru backend'e gönderilir */}
      <Buton baslik={duzenlenen ? 'Kaydet' : 'Yayınla'} onPress={yayinla} yukleniyor={yukleniyor} />

      {/* "Duyuruyu sil" butonu: sadece düzenlemede görünür; basınca silOnayi çalışır (önce onay sorulur) */}
      {duzenlenen && (
        <View style={styles.sil}>
          <Buton baslik="Duyuruyu sil" ikon="cop" tur="tehlikeCerceve" onPress={silOnayi} yukleniyor={yukleniyor} />
        </View>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
    backgroundColor: renkler.arkaPlan,
  },
  icerik: {
    padding: 18,
    gap: 4,
  },
  aciklama: {
    marginBottom: 16,
  },
  sil: {
    marginTop: 12,
  },
  uzunAlan: {
    minHeight: 140,
    textAlignVertical: 'top', // Android'de yazı kutunun üstünden başlasın
  },
});
