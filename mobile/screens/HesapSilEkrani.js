// Hesabımı sil ekranı: kullanıcı hesabını kalıcı olarak siler.
// Sakin: neyin silinip neyin kalacağı açıklanır, şifre istenir, son bir onaydan sonra hesap silinir.
// Yönetici: hesabını silemez; önce yöneticiliği devretmesi gerektiği yazılır ve Devir ekranına geçiş butonu gösterilir.
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import FormAlani from '../components/FormAlani';
import HataMesaji from '../components/HataMesaji';
import Ikon from '../components/Ikon';
import { kose, renkler, yaziTipi } from '../tema';

// navigation: yöneticiyi Devir ekranına göndermek için kullanılır.
export default function HesapSilEkrani({ navigation }) {
  // oturum: rolü öğrenmek için; oturumuKapat: silme başarılı olunca bu telefondaki oturumu kapatıp mesaj gösterir.
  const { oturum, oturumuKapat } = useOturum();
  // yonetici: aynı ekran iki rolde de açılır; bu değere göre aşağıda farklı içerik gösterilir.
  const yonetici = oturum.kullanici.rol === 'yonetici';

  // useState: şifre kutusundaki metin, istek sürerken true olan yükleniyor bayrağı ve hata mesajı.
  const [sifre, setSifre] = useState('');
  const [siliniyor, setSiliniyor] = useState(false);
  const [hata, setHata] = useState('');

  // API isteği: DELETE /api/hesap ile şifreyi gönderir (axios'ta DELETE gövdesi "data" ile verilir).
  // Başarılıysa oturum bu telefonda kapatılır, uygulama açılış ekranına döner ve "Hesabınız silindi" gösterilir.
  // Şifre yanlışsa sunucu 400 döner; mesaj ekranda gösterilir, kullanıcı tekrar deneyebilir.
  const sil = async () => {
    setHata('');
    setSiliniyor(true);
    try {
      await api.delete('/hesap', { data: { sifre } });
    } catch (e) {
      // siliniyor sadece hata olunca false yapılır: başarıda ekran zaten kapanıp açılış ekranına geçilir.
      setHata(e.message);
      setSiliniyor(false);
      return;
    }
    // Hesap silindi: telefondaki oturum kapatılır (oturumuKapat kendi hatasını içeride yakalar; hesap zaten silindiği
    // için ekranda "silinemedi" gibi yanlış bir hata gösterilmez).
    await oturumuKapat('Hesabınız ve kişisel bilgileriniz silindi.', 'Hesap silindi');
  };

  // Silme geri alınamaz; şifre girildikten sonra bir kez daha onay sorulur. "Sil" seçilirse sil çalışır.
  const silOnayi = () => {
    if (!sifre) return setHata('Şifrenizi girin.');
    Alert.alert('Hesabı kalıcı olarak sil', 'Bu işlem geri alınamaz. Hesabınız silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: sil },
    ]);
  };

  // Yönetici hesabı silinemez (backend de 403 döner); önce yöneticilik bir sakine devredilmelidir.
  if (yonetici) {
    return (
      <View style={styles.yoneticiKutu}>
        {/* Uyarı kartı: gri zeminde sarı kalkan, başlık ve açıklama */}
        <View style={styles.kart}>
          <View style={styles.buyukIkon}>
            <Ikon ad="kalkan" boyut={30} renk={renkler.uyari} arka={renkler.yuzey3} />
          </View>
          <Text style={styles.kartBaslik}>Önce yöneticiliği devredin</Text>
          <Text style={styles.metin}>
            Site yöneticisiz kalamaz. Yöneticiliği bir sakine devrettikten sonra sakin olursunuz ve hesabınızı buradan
            silebilirsiniz.
          </Text>
        </View>
        {/* "Yöneticiliği devret" butonu: basınca Devir ekranı açılır */}
        <Buton baslik="Yöneticiliği devret" ikon="devret" onPress={() => navigation.navigate('Devir')} />
      </View>
    );
  }

  return (
    // KeyboardAwareScrollView: klavye açılınca şifre kutusu ve buton klavyenin altında kalmaz.
    <KeyboardAwareScrollView
      style={styles.dis}
      contentContainerStyle={styles.icerik}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      {/* Uyarı kartı: kırmızı çerçeve, piksellere dağılan kimlik kartı ikonu ve silinecek bilgiler */}
      <View style={[styles.kart, styles.kartTehlike]}>
        <View style={[styles.buyukIkon, styles.buyukIkonTehlike]}>
          <Ikon ad="hesapSil" boyut={30} renk={renkler.hata} arka={renkler.hataZemin} />
        </View>
        <Text style={styles.kartBaslik}>Hesabınız kalıcı olarak silinecek</Text>
        <Text style={styles.metin}>
          Adınız, e-postanız ve mesajlarınız silinir; bu hesapla bir daha giriş yapılamaz. Aidat geçmişi dairede kalır ama
          sizinle bağlantısı kaldırılır. Bu işlem geri alınamaz.
        </Text>
      </View>

      {/* Şifre: hesabı sadece sahibinin silebilmesi için tekrar istenir (sağdaki göz ikonuyla görülebilir) */}
      <FormAlani etiket="Şifreniz" value={sifre} onChangeText={setSifre} secureTextEntry autoCapitalize="none" />

      {hata !== '' && <HataMesaji mesaj={hata} />}
      {/* "Hesabımı kalıcı olarak sil" butonu: basınca silOnayi çalışır (önce son onay sorulur) */}
      <Buton baslik="Hesabımı kalıcı olarak sil" ikon="hesapSil" tur="tehlike" onPress={silOnayi} yukleniyor={siliniyor} />
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
  yoneticiKutu: {
    flex: 1,
    padding: 18,
    gap: 14,
    backgroundColor: renkler.arkaPlan,
  },
  kart: {
    padding: 16,
    gap: 9,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  kartTehlike: {
    borderColor: renkler.hataCizgi,
  },
  // Büyük ikon kutusu: yöneticide gri zeminde sarı kalkan; sakinde koyu kırmızı zeminde kırmızı ikon (buton da aynı kırmızı)
  buyukIkon: {
    width: 56,
    height: 56,
    borderRadius: kose,
    backgroundColor: renkler.yuzey3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyukIkonTehlike: {
    backgroundColor: renkler.hataZemin,
    borderWidth: 1,
    borderColor: renkler.hataCizgi,
  },
  kartBaslik: {
    fontFamily: yaziTipi.metin,
    fontSize: 17,
    fontWeight: '600',
    color: renkler.yazi,
  },
  metin: {
    fontFamily: yaziTipi.metin,
    fontSize: 14,
    lineHeight: 20,
    color: renkler.soluk,
  },
});
