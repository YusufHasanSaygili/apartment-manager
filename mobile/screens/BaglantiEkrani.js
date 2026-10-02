// Bağlantı ekranı: uygulama açılınca backend'e sağlık kontrolü isteği atar ve
// "Sunucuya bağlandı" ya da hata mesajı gösterir. Kurulumun doğru yapıldığını
// telefonda görmek için kullanılır.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import HataMesaji from '../components/HataMesaji';

export default function BaglantiEkrani() {
  // useState: bağlantı durumunu tutar ('yukleniyor' | 'bagli' | 'hata').
  // Durum değişince ekran kendini otomatik yeniler ve doğru mesajı gösterir.
  const [durum, setDurum] = useState('yukleniyor');

  // useState: hata olursa kullanıcıya gösterilecek açıklama metni.
  const [hataMesaji, setHataMesaji] = useState('');

  // API isteği: verilen backend adresine GET isteği atar ve sonuca göre durumu günceller.
  // Hata mesajını services/api.js içindeki ortak yapı hazırlar; burada sadece gösteririz.
  // useCallback: fonksiyon her render'da yeniden oluşmasın diye; useEffect bağımlılığında kullanılıyor.
  const istekAt = useCallback(async (adres) => {
    setDurum('yukleniyor');
    try {
      await api.get(adres);
      setDurum('bagli');
    } catch (hata) {
      setHataMesaji(hata.message);
      setDurum('hata');
    }
  }, []);

  // Sağlık kontrolü: backend'deki GET /api/saglik adresine istek atar.
  const baglantiyiKontrolEt = useCallback(() => istekAt('/saglik'), [istekAt]);

  // Sadece geliştirme sırasında: var olmayan bir adrese istek atarak ortak hata
  // gösteriminin çalıştığını dener. Backend 404 + { mesaj: 'Bulunamadı' } döner.
  const hataliIstekDene = () => istekAt('/olmayan-adres');

  // useEffect: ekran ilk açıldığında bir kez çalışır ve bağlantıyı kontrol eder.
  useEffect(() => {
    baglantiyiKontrolEt();
  }, [baglantiyiKontrolEt]);

  return (
    <View style={styles.kapsayici}>
      {/* Durum 'yukleniyor' iken dönen yükleniyor simgesi gösterilir */}
      {durum === 'yukleniyor' && <ActivityIndicator size="large" color="#0F766E" />}

      {/* Bağlantı başarılıysa yeşil başarı yazısı gösterilir */}
      {durum === 'bagli' && <Text style={styles.basarili}>Sunucuya bağlandı</Text>}

      {/* Hata varsa ortak HataMesaji component'i gösterilir; "Tekrar dene"ye basınca
          baglantiyiKontrolEt çalışır ve istek yeniden atılır */}
      {durum === 'hata' && <HataMesaji mesaj={hataMesaji} tekrarDene={baglantiyiKontrolEt} />}

      {/* "Hatalı istek dene" butonu: basınca hataliIstekDene çalışır. __DEV__ sayesinde
          sadece geliştirme sürümünde görünür, gerçek kullanıcıya hiç gösterilmez */}
      {__DEV__ && durum !== 'yukleniyor' && (
        <Pressable
          style={({ pressed }) => [styles.denemeButon, pressed && styles.butonBasili]}
          onPress={hataliIstekDene}
        >
          <Text style={styles.denemeButonYazi}>Hatalı istek dene</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kapsayici: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  basarili: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#15803D',
  },
  denemeButon: {
    marginTop: 32,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  butonBasili: {
    opacity: 0.7,
  },
  denemeButonYazi: {
    color: '#475569',
    fontSize: 15,
  },
});
