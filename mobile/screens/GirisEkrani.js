// Giriş ekranı: hesabı olan kullanıcı (yönetici veya sakin) e-posta ve şifresiyle giriş yapar.
// Şifresini unutan kullanıcı "Şifremi unuttum" bağlantısıyla sıfırlama ekranına geçer.
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import FormAlani from '../components/FormAlani';
import HataMesaji from '../components/HataMesaji';
import { renkler } from '../tema';

// navigation: "Şifremi unuttum" bağlantısıyla SifremiUnuttum ekranını açmak için kullanılır.
export default function GirisEkrani({ navigation }) {
  // useState: formdaki e-posta ve şifre. Kullanıcı yazdıkça güncellenir.
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');

  // useState: istek sürerken true; butonda dönen simge çıkar, form iki kez gönderilmez.
  const [yukleniyor, setYukleniyor] = useState(false);

  // useState: hatalı giriş vb. durumda gösterilecek mesaj.
  const [hata, setHata] = useState('');

  // oturumAc: giriş başarılı olunca token'ı kaydeder ve uygulamayı ana ekrana geçirir.
  const { oturumAc } = useOturum();

  // girisYap: "Giriş yap" butonuna basınca çalışır. Formu kontrol eder, backend'e gönderir,
  // başarılıysa oturumu açar, hatalıysa mesajı ekranda gösterir.
  const girisYap = async () => {
    // Boş alanı sunucuya göndermeden yakalar.
    if (!eposta.trim() || !sifre) {
      setHata('E-posta ve şifre girin.');
      return;
    }

    setHata('');
    setYukleniyor(true);
    try {
      // API isteği: e-posta ve şifreyi POST /api/hesap/giris adresine gönderir.
      // Cevapta token, kullanıcı ve site bilgisi gelir.
      const { data } = await api.post('/hesap/giris', { eposta, sifre });
      // Oturum açılınca App.js otomatik olarak ana ekrana geçer (bu ekran kapanır).
      // Bu yüzden başarılı durumda setYukleniyor(false) çağrılmaz; ekran zaten kapanıyor.
      await oturumAc(data);
    } catch (e) {
      // Örn. "E-posta veya şifre hatalı." (mesajı backend ve services/api.js hazırlar)
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
      {/* E-posta alanı: autoCapitalize="none" ile ilk harf büyütülmez, e-posta klavyesi açılır */}
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
        etiket="Şifre"
        value={sifre}
        onChangeText={setSifre}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
      />

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {hata !== '' && <HataMesaji mesaj={hata} />}

      {/* "Giriş yap" butonu: basınca girisYap çalışır ve bilgiler backend'e gönderilir */}
      <Buton baslik="Giriş yap" onPress={girisYap} yukleniyor={yukleniyor} />

      {/* "Şifremi unuttum" bağlantısı: basınca SifremiUnuttum ekranı açılır; yazılmış e-posta da oraya taşınır */}
      <Pressable
        style={styles.unuttum}
        onPress={() => navigation.navigate('SifremiUnuttum', { eposta })}
        hitSlop={8}
        accessibilityRole="button"
      >
        <Text style={styles.unuttumYazi}>Şifremi unuttum</Text>
      </Pressable>
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
  unuttum: {
    alignSelf: 'center',
    marginTop: 20,
  },
  unuttumYazi: {
    fontSize: 15,
    fontWeight: '600',
    color: renkler.birincil,
  },
});
