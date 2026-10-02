// Ortak çıkış butonu: hem yönetici hem sakin ana ekranında kullanılır.
// Yanlışlıkla basılmasın diye önce onay sorar.
import { Alert } from 'react-native';
import { useOturum } from '../services/OturumContext';
import Buton from './Buton';

export default function CikisButonu() {
  // cikisYap: token'ı siler ve oturumu kapatır → App.js açılış ekranına döner.
  const { cikisYap } = useOturum();

  // Onay penceresi: "Çıkış yap" seçilirse cikisYap çalışır, "Vazgeç" seçilirse hiçbir şey olmaz.
  const cikisOnayi = () =>
    Alert.alert('Çıkış yap', 'Hesabınızdan çıkmak istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: cikisYap },
    ]);

  // "Çıkış yap" butonu: basınca cikisOnayi çalışır.
  return <Buton baslik="Çıkış yap" tur="ikincil" onPress={cikisOnayi} />;
}
