// Uygulamanın giriş noktası: oturum bilgisini (OturumProvider) ve ekranlar arası geçişi
// yöneten React Navigation'ı kurar.
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { OturumProvider, useOturum } from './services/OturumContext';
import AcilisEkrani from './screens/AcilisEkrani';
import SiteOlusturEkrani from './screens/SiteOlusturEkrani';
import GirisEkrani from './screens/GirisEkrani';
import YoneticiAnaEkrani from './screens/YoneticiAnaEkrani';
import KurulumEkrani from './screens/KurulumEkrani';
import DaireListesiEkrani from './screens/DaireListesiEkrani';
import DaireKoduEkrani from './screens/DaireKoduEkrani';
import { renkler } from './tema';

// Stack navigator: ekranları üst üste dizer; yeni ekran açılınca öncekinin üstüne
// gelir, geri tuşuyla bir öncekine dönülür.
const Stack = createNativeStackNavigator();

// Ekran listesi oturuma göre değişir (React Navigation'ın önerdiği giriş akışı yöntemi):
// oturum yoksa sadece açılış/kayıt ekranları, varsa sadece yönetici ekranları tanımlıdır.
// Böylece giriş yapmamış biri yönetici ekranına hiçbir şekilde gidemez; oturum açılınca
// açılış ekranları listeden çıktığı için geri tuşu kullanıcıyı kayıt formuna döndürmez.
function Ekranlar() {
  // oturum: giriş yapılmış mı; hazir: açılıştaki otomatik giriş kontrolü bitti mi (OturumContext'ten).
  const { oturum, hazir } = useOturum();

  // Açılışta kayıtlı oturum kontrol edilirken boş ekran gösterilir (çok kısa sürer).
  // Bu sırada ekran seçilmez; yoksa giriş yapmış kullanıcı bir an açılış ekranını görürdü.
  if (!hazir) {
    return <View style={{ flex: 1, backgroundColor: renkler.arkaPlan }} />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: renkler.arkaPlan },
        headerTintColor: renkler.yazi,
        headerShadowVisible: false,
      }}
    >
      {oturum ? (
        <>
          <Stack.Screen name="YoneticiAna" component={YoneticiAnaEkrani} options={{ title: 'Apartmanım' }} />
          {/* Kurulum ekranı: yönetici ana ekranındaki "Bina ve daire kurulumu" butonuyla açılır */}
          <Stack.Screen name="Kurulum" component={KurulumEkrani} options={{ title: 'Bina ve daire kurulumu' }} />
          {/* Daire listesi: ana ekrandaki "Daireler ve davet kodları" butonuyla açılır */}
          <Stack.Screen name="DaireListesi" component={DaireListesiEkrani} options={{ title: 'Daireler' }} />
          {/* Daire kodu: alttan açılan pencere (formSheet); yüksekliği içeriğe göre ayarlanır */}
          <Stack.Screen
            name="DaireKodu"
            component={DaireKoduEkrani}
            options={{ presentation: 'formSheet', headerShown: false, sheetAllowedDetents: 'fitToContents' }}
          />
        </>
      ) : (
        <>
          {/* Açılış ekranında üst başlık çubuğu gizlenir, ekranın kendi başlığı var */}
          <Stack.Screen name="Acilis" component={AcilisEkrani} options={{ headerShown: false }} />
          <Stack.Screen name="Giris" component={GirisEkrani} options={{ title: 'Giriş yap' }} />
          <Stack.Screen name="SiteOlustur" component={SiteOlusturEkrani} options={{ title: 'Yeni site/apartman oluştur' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    // SafeAreaProvider: ekranların telefonun çentik ve alt çubuk ölçülerini bilmesini sağlar.
    // KeyboardProvider: klavyenin açılıp kapanmasını tüm ekranlar için takip eder
    // (formların klavyeye göre kaymasını sağlayan kütüphanenin çalışması için gerekli).
    // OturumProvider: içindeki tüm ekranlar useOturum() ile oturuma ulaşabilir.
    <SafeAreaProvider>
      <KeyboardProvider>
        <OturumProvider>
          {/* NavigationContainer: navigasyon durumunu tutar, tüm ekranları sarmalamak zorundadır */}
          <NavigationContainer>
            <Ekranlar />
            {/* StatusBar: telefonun üstteki saat/şarj çubuğu; açık arka planda okunsun diye koyu yazı */}
            <StatusBar style="dark" />
          </NavigationContainer>
        </OturumProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
