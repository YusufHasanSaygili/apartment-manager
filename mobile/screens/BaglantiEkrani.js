// Bağlantı ekranı: uygulama açılınca backend'e sağlık kontrolü isteği atar ve
// "Sunucuya bağlandı" ya da hata mesajı gösterir. Kurulumun doğru yapıldığını
// telefonda görmek için kullanılır.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import { API_URL } from '../config';

export default function BaglantiEkrani() {
  // useState: bağlantı durumunu tutar ('yukleniyor' | 'bagli' | 'hata').
  // Durum değişince ekran kendini otomatik yeniler ve doğru mesajı gösterir.
  const [durum, setDurum] = useState('yukleniyor');

  // useState: hata olursa kullanıcıya gösterilecek açıklama metni.
  const [hataMesaji, setHataMesaji] = useState('');

  // API isteği: backend'deki GET /api/saglik adresine istek atar.
  // useCallback: fonksiyon her render'da yeniden oluşmasın diye; useEffect bağımlılığında kullanılıyor.
  const baglantiyiKontrolEt = useCallback(async () => {
    setDurum('yukleniyor');
    try {
      await api.get('/saglik');
      setDurum('bagli');
    } catch (hata) {
      // 503 → sunucu açık ama veritabanı yok; başka bir cevap → yanlış adres/port olabilir;
      // hiç cevap yoksa (hata.response boş) telefon sunucuya ağ üzerinden ulaşamamıştır.
      if (hata.response?.status === 503) {
        setHataMesaji('Sunucu açık ama veritabanına bağlanamadı.');
      } else if (hata.response) {
        setHataMesaji(`Sunucu beklenmeyen bir cevap verdi (${hata.response.status}).`);
      } else {
        setHataMesaji(`Sunucuya ulaşılamadı. Adres: ${API_URL}`);
      }
      setDurum('hata');
    }
  }, []);

  // useEffect: ekran ilk açıldığında bir kez çalışır ve bağlantıyı kontrol eder.
  useEffect(() => {
    baglantiyiKontrolEt();
  }, [baglantiyiKontrolEt]);

  return (
    <View style={styles.kapsayici}>
      {/* Durum 'yukleniyor' iken dönen yükleniyor simgesi gösterilir */}
      {durum === 'yukleniyor' && <ActivityIndicator size="large" color="#0F766E" />}

      {durum === 'bagli' && <Text style={[styles.baslik, styles.basarili]}>Sunucuya bağlandı</Text>}

      {durum === 'hata' && (
        <>
          <Text style={[styles.baslik, styles.hatali]}>Bağlantı kurulamadı</Text>
          <Text style={styles.aciklama}>{hataMesaji}</Text>

          {/* "Tekrar dene" butonu: basınca baglantiyiKontrolEt çalışır ve istek yeniden atılır */}
          <Pressable
            style={({ pressed }) => [styles.buton, pressed && styles.butonBasili]}
            onPress={baglantiyiKontrolEt}
          >
            <Text style={styles.butonYazi}>Tekrar dene</Text>
          </Pressable>
        </>
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
  baslik: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  basarili: {
    color: '#15803D',
  },
  hatali: {
    color: '#B91C1C',
  },
  aciklama: {
    marginTop: 8,
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
  },
  buton: {
    marginTop: 24,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: '#0F766E',
  },
  butonBasili: {
    opacity: 0.8,
  },
  butonYazi: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
