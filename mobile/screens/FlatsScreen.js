// Daire listesi ekranı (yönetici): tüm daireleri bina bina, 4'lü hizalı kutularda gösterir.
// Sakini katılmış daireler yeşil tonlu, henüz katılmamış daireler çizgili gri. Bir daireye dokununca
// o dairenin davet kodu alttan açılan pencerede (InviteCode) gösterilir; oradan paylaşılabilir veya sakin çıkarılabilir.
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import ErrorMessage from '../components/ErrorMessage';
import { useRefresh } from '../components/Refresh';
import { BuildingCard, Legend } from '../components/Status';
import { colors, fonts } from '../theme';

// navigation: daireye dokununca InviteCode penceresini açmak için kullanılır.
export default function FlatsScreen({ navigation }) {
  // useState: sunucudan gelen binalar ve daireleri. null → henüz yüklenmedi.
  const [buildings, setBuildings] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata mesajı.
  const [error, setError] = useState('');

  // API isteği: GET /api/flats → binalar, her binanın daireleri, davet kodları ve dairedeki sakin.
  // useCallback: fonksiyon her çizimde yeniden oluşmasın; useFocusEffect/useEffect buna bağlı olduğu için istek gereksiz yere tekrar atılmaz.
  const loadList = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/flats');
      setBuildings(data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // useFocusEffect: ekran her öne geldiğinde liste yeniden yüklenir; sakin çıkarılıp pencere kapanınca
  // dairenin rengi (dolu → boş) hemen güncellenir.
  useFocusEffect(
    useCallback(() => {
      loadList();
    }, [loadList]),
  );

  // Aşağı çekip yenileme (refreshControl): sayfa en üstteyken aşağı çekilince loadList tekrar çalışır (components/Refresh.js).
  const refreshControl = useRefresh(loadList);

  if (error !== '') {
    return (
      <View style={styles.center}>
        {/* "Tekrar dene" butonu: basınca loadList yeniden çalışır */}
        <ErrorMessage message={error} onRetry={loadList} />
      </View>
    );
  }

  if (buildings === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    // FlatList: binaları alt alta listeler; her bina kendi kartında.
    <FlatList
      refreshControl={refreshControl}
      style={styles.container}
      contentContainerStyle={styles.content}
      data={buildings}
      keyExtractor={(building) => building.id}
      ListEmptyComponent={<Text style={styles.empty}>Henüz daire oluşturulmamış.</Text>}
      ListHeaderComponent={<Legend items={[['occupied'], ['emptyFlat']]} />}
      renderItem={({ item: building }) => (
        // Daire kutusuna basınca InviteCode penceresi açılır; dairenin kodu, sakini ve durumu da gönderilir
        <BuildingCard
          name={building.name}
          hideIcon
          flats={building.flats.map((d) => ({
            ...d,
            name: `${building.name}${d.flatNumber}`,
            status: d.occupied ? 'occupied' : 'emptyFlat',
            accessibilityName: `Daire ${building.name}${d.flatNumber}${d.occupied ? ', sakin katılmış' : ''}, davet kodunu göster`,
          }))}
          onFlatPress={(d) =>
            navigation.navigate('InviteCode', {
              flatId: d.id,
              flatName: d.name,
              inviteCode: d.inviteCode,
              occupied: d.occupied,
              residentName: d.residentName,
              managerFlat: d.managerFlat,
            })
          }
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 18,
    gap: 14,
  },
  center: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  empty: {
    textAlign: 'center',
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.muted,
  },
});
