// Aidat tutarı ekranı: yönetici sitenin aylık aidat tutarını belirler veya değiştirir.
// Bu tutar sakinlerin bildirim formunda hazır gelir (sakin isterse değiştirebilir).
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import Buton from '../components/Buton';
import HataMesaji from '../components/HataMesaji';
import { paraBicimi, tutarMetni, tutarOku, tutarTemizle } from '../bicim';
import SecimDugmesi from '../components/SecimDugmesi';
import { kose, renkler, yaziTipi, yazilar } from '../tema';

// Hazır tutarlar: dokununca kutuya yazılır (yine de elle başka tutar girilebilir)
const HAZIR = [1500, 5000, 10000];

// route.params.aidatTutari: mevcut tutar (yönetici ana ekranından gelir; yoksa kutu boş başlar).
export default function AidatTutariEkrani({ route, navigation }) {
  // useState: kutudaki tutar metni (örn. "750" veya "750,50").
  const [tutar, setTutar] = useState(tutarMetni(route.params?.aidatTutari));
  // useState: istek sürerken true; form iki kez gönderilmez.
  const [yukleniyor, setYukleniyor] = useState(false);
  // useState: hata olursa gösterilecek mesaj.
  const [hata, setHata] = useState('');

  // kaydet: "Kaydet" butonuna basınca çalışır; tutarı kontrol edip backend'e gönderir.
  const kaydet = async () => {
    // Telefondaki kontrol sadece hızlı geri bildirim içindir; asıl kontrol backend'de yapılır.
    const sayi = tutarOku(tutar);
    if (!(sayi > 0) || sayi > 99999.99) {
      setHata('0 ile 99.999,99 TL arasında bir tutar girin.');
      return;
    }

    setHata('');
    setYukleniyor(true);
    try {
      // API isteği: yeni tutarı PUT /api/kurulum/aidat-tutari adresine gönderir.
      await api.put('/kurulum/aidat-tutari', { aidatTutari: sayi });
      // Ana ekrana dönülür; ana ekran öne gelince yeni tutarı yeniden çeker.
      navigation.goBack();
    } catch (e) {
      setHata(e.message);
      setYukleniyor(false);
    }
  };

  const sayi = tutarOku(tutar);

  return (
    // KeyboardAwareScrollView: klavye açılınca alan ve buton klavyenin altında kalmaz.
    <KeyboardAwareScrollView
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={yazilar.aciklama}>Sakinler aidat bildirimi gönderirken bu tutar hazır gelir.</Text>

      {/* Büyük tutar kutusu: ortada, monospace; elle yazılır (sadece rakam ve virgül, örn. 750 veya 750,50) */}
      <View style={styles.tutarSatir}>
        <Text style={styles.tl}>₺</Text>
        <TextInput
          style={styles.tutar}
          value={tutar}
          onChangeText={(metin) => setTutar(tutarTemizle(metin))}
          keyboardType="decimal-pad"
          maxLength={8}
          placeholder="0"
          placeholderTextColor={renkler.sonuk}
          selectionColor={renkler.birincil}
          accessibilityLabel="Aylık aidat tutarı (TL)"
        />
      </View>

      {/* Hazır tutar düğmeleri: basınca o tutar kutuya yazılır; kutudaki tutarla aynıysa seçili görünür */}
      <View style={styles.hazirlar}>
        {HAZIR.map((t) => (
          <SecimDugmesi key={t} yazi={paraBicimi(t).replace(',00', '')} secili={sayi === t} style={styles.hazir} onPress={() => setTutar(String(t))} />
        ))}
      </View>

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {hata !== '' && <HataMesaji mesaj={hata} />}

      {/* "Kaydet" butonu: basınca kaydet çalışır ve tutar backend'e gönderilir */}
      <Buton baslik="Kaydet" onPress={kaydet} yukleniyor={yukleniyor} />
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
    gap: 14,
  },
  tutarSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  tl: {
    fontFamily: yaziTipi.mono,
    fontSize: 28,
    color: renkler.soluk,
  },
  tutar: {
    minWidth: 120,
    padding: 0,
    textAlign: 'center',
    fontFamily: yaziTipi.mono,
    fontSize: 52,
    fontWeight: '600',
    letterSpacing: -1.5,
    color: renkler.yazi,
  },
  hazirlar: {
    flexDirection: 'row',
    gap: 8,
  },
  hazir: {
    flex: 1,
    flexBasis: 0,
  },
});
