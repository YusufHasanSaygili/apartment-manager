// Şifremi unuttum ekranı: iki adımda şifre sıfırlanır.
// 1. adım: kullanıcı e-postasını yazar, "Kod gönder"e basar; e-postasına 6 haneli bir kod gelir.
// 2. adım: kodu ve yeni şifresini yazar; şifre değişir ve kullanıcı doğrudan giriş yapmış olur.
// route.params.eposta: giriş ekranında yazılmışsa e-posta kutusu dolu gelir.
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import FormAlani from '../components/FormAlani';
import HataMesaji from '../components/HataMesaji';
import { renkler } from '../tema';

export default function SifremiUnuttumEkrani({ route }) {
  // oturumAc: şifre değişince sunucudan gelen token ile oturumu açar; App.js ana ekrana geçer.
  const { oturumAc } = useOturum();

  // useState: form alanları. kodGonderildi: 2. adıma geçildi mi (kod ve yeni şifre alanları görünür).
  const [eposta, setEposta] = useState(route.params?.eposta ?? '');
  const [kodGonderildi, setKodGonderildi] = useState(false);
  const [kod, setKod] = useState('');
  const [yeniSifre, setYeniSifre] = useState('');
  // useState: istek sürerken true (buton tekrar basılamaz); bilgi: kod gönderildi mesajı; hata: hata mesajı.
  const [yukleniyor, setYukleniyor] = useState(false);
  const [bilgi, setBilgi] = useState('');
  const [hata, setHata] = useState('');

  // API isteği: POST /api/hesap/sifre-sifirla/kod-iste ile e-postayı gönderir. Sunucu, e-posta kayıtlı olsun
  // olmasın aynı mesajı döner (hangi e-postaların kayıtlı olduğu anlaşılmasın diye); mesaj ekranda gösterilir.
  const kodIste = async () => {
    if (!eposta.trim()) return setHata('E-posta adresinizi girin.');
    setHata('');
    setYukleniyor(true);
    try {
      const { data } = await api.post('/hesap/sifre-sifirla/kod-iste', { eposta });
      setBilgi(data.mesaj);
      setKodGonderildi(true);
    } catch (e) {
      setHata(e.message);
    } finally {
      setYukleniyor(false);
    }
  };

  // API isteği: POST /api/hesap/sifre-sifirla ile e-posta, kod ve yeni şifreyi gönderir.
  // Başarılıysa sunucu token döner; oturum açılır ve uygulama kendiliğinden ana ekrana geçer.
  const sifirla = async () => {
    if (!/^\d{6}$/.test(kod.trim())) return setHata('E-postanıza gelen 6 haneli kodu girin.');
    if (yeniSifre.length < 8) return setHata('Yeni şifre en az 8 karakter olmalı.');
    setHata('');
    setYukleniyor(true);
    try {
      const { data } = await api.post('/hesap/sifre-sifirla', { eposta, kod: kod.trim(), yeniSifre });
      // Başarılıysa setYukleniyor(false) çağrılmaz: oturum açılınca bu ekran kapanıp ana ekrana geçilir.
      await oturumAc(data);
    } catch (e) {
      // Örn. "Kod hatalı veya süresi dolmuş." (mesajı backend ve services/api.js hazırlar)
      setHata(e.message);
      setYukleniyor(false);
    }
  };

  return (
    // KeyboardAwareScrollView: klavye açılınca alanlar ve butonlar klavyenin altında kalmaz.
    <KeyboardAwareScrollView
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.aciklama}>
        Hesabınızın e-posta adresini yazın; şifrenizi sıfırlamak için 6 haneli bir kod göndereceğiz.
      </Text>

      {/* E-posta alanı: kod gönderildikten sonra değiştirilemez (editable false), yanlışlıkla başka e-postaya
          kod denenmesin diye. Değiştirmek için "Farklı e-posta" bağlantısı kullanılır. */}
      <FormAlani
        etiket="E-posta"
        value={eposta}
        onChangeText={setEposta}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!kodGonderildi}
      />

      {!kodGonderildi ? (
        // "Kod gönder" butonu: basınca kodIste çalışır ve kod e-postaya gönderilir.
        <Buton baslik="Kod gönder" onPress={kodIste} yukleniyor={yukleniyor} />
      ) : (
        <>
          {bilgi !== '' && <Text style={styles.bilgi}>{bilgi}</Text>}
          <FormAlani
            etiket="E-postanıza gelen kod"
            value={kod}
            onChangeText={setKod}
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
          />
          <FormAlani
            etiket="Yeni şifre (en az 8 karakter)"
            value={yeniSifre}
            onChangeText={setYeniSifre}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          {hata !== '' && <HataMesaji mesaj={hata} />}
          {/* "Şifremi değiştir" butonu: basınca sifirla çalışır; kod doğruysa şifre değişir ve giriş yapılır */}
          <Buton baslik="Şifremi değiştir" onPress={sifirla} yukleniyor={yukleniyor} />
          {/* "Kodu tekrar gönder" bağlantısı: basınca kodIste yeniden çalışır; yeni kod gelir, eskisi geçersiz olur */}
          <Pressable style={styles.baglanti} onPress={kodIste} disabled={yukleniyor} hitSlop={8} accessibilityRole="button">
            <Text style={styles.baglantiYazi}>Kodu tekrar gönder</Text>
          </Pressable>
          {/* "Farklı e-posta" bağlantısı: 1. adıma döner, e-posta kutusu yeniden düzenlenebilir olur */}
          <Pressable
            style={styles.baglanti}
            onPress={() => {
              setKodGonderildi(false);
              setKod('');
              setYeniSifre('');
              setBilgi('');
              setHata('');
            }}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.baglantiYazi}>Farklı e-posta</Text>
          </Pressable>
        </>
      )}

      {/* 1. adımdaki hata (2. adımın hatası yukarıda, kendi butonunun hemen üstünde gösterilir) */}
      {!kodGonderildi && hata !== '' && <HataMesaji mesaj={hata} />}
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
  bilgi: {
    marginBottom: 16,
    fontSize: 15,
    lineHeight: 22,
    color: renkler.basarili,
  },
  baglanti: {
    alignSelf: 'center',
    marginTop: 16,
  },
  baglantiYazi: {
    fontSize: 15,
    fontWeight: '600',
    color: renkler.birincil,
  },
});
