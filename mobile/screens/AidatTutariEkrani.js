// Aidat tutarı ekranı: yönetici sitenin aylık aidat tutarını belirler veya değiştirir.
// Bu tutar sakinlerin bildirim formunda hazır gelir (sakin isterse değiştirebilir).
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import Buton from '../components/Buton';
import FormAlani from '../components/FormAlani';
import HataMesaji from '../components/HataMesaji';
import { tutarMetni, tutarOku, tutarTemizle } from '../bicim';
import { renkler } from '../tema';

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

  return (
    // KeyboardAwareScrollView: klavye açılınca alan ve buton klavyenin altında kalmaz.
    <KeyboardAwareScrollView
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.aciklama}>
        Bu tutar sakinlerin aidat bildirimi formunda hazır gelir. Sakin farklı bir tutar ödediyse
        (örn. 2 aylık) kendisi değiştirebilir.
      </Text>

      {/* Tutar kutusu: sadece rakam ve virgül yazılabilir, örn. 750 veya 750,50 */}
      <FormAlani
        etiket="Aylık aidat tutarı (TL)"
        value={tutar}
        onChangeText={(metin) => setTutar(tutarTemizle(metin))}
        keyboardType="decimal-pad"
        maxLength={8}
      />

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
    padding: 24,
    gap: 4,
  },
  aciklama: {
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
    color: renkler.soluk,
  },
});
