// Davet koduyla katılma ekranı: sakin, yöneticiden aldığı 6 haneli kodu ve hesap bilgilerini girer.
// Hesap, kodun ait olduğu siteye ve daireye otomatik bağlanır.
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import FormAlani from '../components/FormAlani';
import HataMesaji from '../components/HataMesaji';
import { renkler } from '../tema';

export default function DavetKatilEkrani() {
  // useState: formdaki 4 alanın değerleri. Kullanıcı yazdıkça güncellenir.
  const [davetKodu, setDavetKodu] = useState('');
  const [ad, setAd] = useState('');
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');

  // useState: istek sürerken true; butonda dönen simge çıkar, form iki kez gönderilmez.
  const [yukleniyor, setYukleniyor] = useState(false);

  // useState: formda veya sunucuda bir hata olursa gösterilecek mesaj.
  const [hata, setHata] = useState('');

  // oturumAc: katılma başarılı olunca token'ı kaydeder ve sakin ana ekranına geçirir.
  const { oturumAc } = useOturum();

  // katil: "Katıl" butonuna basınca çalışır. Önce telefonda basit kontrol, sonra backend'e istek.
  const katil = async () => {
    if (davetKodu.length !== 6) {
      setHata('Davet kodu 6 haneli olmalı.');
      return;
    }
    if (!ad.trim() || !eposta.trim() || !sifre) {
      setHata('Lütfen tüm alanları doldurun.');
      return;
    }
    if (sifre.length < 8) {
      setHata('Şifre en az 8 karakter olmalı.');
      return;
    }

    setHata('');
    setYukleniyor(true);
    try {
      // API isteği: kodu ve hesap bilgilerini POST /api/hesap/katil adresine gönderir.
      // Cevapta token, kullanıcı, site ve daire bilgisi gelir.
      const { data } = await api.post('/hesap/katil', { davetKodu, ad, eposta, sifre });
      // Oturum açılınca App.js rol 'sakin' olduğu için sakin ana ekranına geçer.
      // Başarılı durumda setYukleniyor(false) gerekmez; bu ekran kapanıyor.
      await oturumAc(data);
    } catch (e) {
      // Örn. "Davet kodu geçersiz veya kullanılmış." (mesajı backend ve services/api.js hazırlar)
      setHata(e.message);
      setYukleniyor(false);
    }
  };

  return (
    // KeyboardAwareScrollView: klavye açılınca sayfayı dokunulan alana kaydırır.
    <KeyboardAwareScrollView
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.aciklama}>
        Davet kodunu site yöneticinizden alabilirsiniz. Hesabınız kodun ait olduğu daireye bağlanır.
      </Text>

      {/* Davet kodu alanı: sadece rakam kabul eder (rakam olmayanlar silinir), en fazla 6 hane */}
      <FormAlani
        etiket="Davet kodu (6 haneli)"
        value={davetKodu}
        onChangeText={(metin) => setDavetKodu(metin.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={6}
      />
      <FormAlani etiket="Adınız Soyadınız" value={ad} onChangeText={setAd} autoComplete="name" />
      <FormAlani
        etiket="E-posta"
        value={eposta}
        onChangeText={setEposta}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      {/* secureTextEntry: şifre yazılırken karakterler gizlenir */}
      <FormAlani
        etiket="Şifre (en az 8 karakter)"
        value={sifre}
        onChangeText={setSifre}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
      />

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {hata !== '' && <HataMesaji mesaj={hata} />}

      {/* "Katıl" butonu: basınca katil çalışır ve bilgiler backend'e gönderilir */}
      <Buton baslik="Katıl" onPress={katil} yukleniyor={yukleniyor} />
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
