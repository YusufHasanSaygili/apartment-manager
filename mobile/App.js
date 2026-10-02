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
import SakinAnaEkrani from './screens/SakinAnaEkrani';
import DavetKatilEkrani from './screens/DavetKatilEkrani';
import AidatBildirEkrani from './screens/AidatBildirEkrani';
import AidatTutariEkrani from './screens/AidatTutariEkrani';
import { renkler } from './tema';

// Stack navigator: ekranları üst üste dizer; yeni ekran açılınca öncekinin üstüne
// gelir, geri tuşuyla bir öncekine dönülür.
const Stack = createNativeStackNavigator();

// Ekran listesi oturuma ve role göre değişir (React Navigation'ın önerdiği giriş akışı yöntemi):
// oturum yoksa açılış/kayıt ekranları, yöneticiyse yönetici ekranları, sakinse sakin ekranları
// tanımlıdır. Tanımlı olmayan bir ekrana hiçbir şekilde gidilemez; oturum açılınca açılış
// ekranları listeden çıktığı için geri tuşu kullanıcıyı kayıt formuna döndürmez.
// (Asıl yetki kontrolü backend'dedir; bu ayrım kullanıcıya doğru ekranları göstermek içindir.)
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
      {oturum?.kullanici.rol === 'yonetici' ? (
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
          {/* Aidat tutarı: ana ekrandaki "Aidat tutarını belirle/değiştir" butonuyla açılır */}
          <Stack.Screen name="AidatTutari" component={AidatTutariEkrani} options={{ title: 'Aylık aidat tutarı' }} />
        </>
      ) : oturum ? (
        // Sakin ekranları: ana ekran ve aidat bildirimi (duyuru, mesaj ileride eklenecek).
        <>
          <Stack.Screen name="SakinAna" component={SakinAnaEkrani} options={{ title: 'Apartmanım' }} />
          <Stack.Screen name="AidatBildir" component={AidatBildirEkrani} options={{ title: 'Aidat bildirimi' }} />
        </>
      ) : (
        <>
          {/* Açılış ekranında üst başlık çubuğu gizlenir, ekranın kendi başlığı var */}
          <Stack.Screen name="Acilis" component={AcilisEkrani} options={{ headerShown: false }} />
          <Stack.Screen name="Giris" component={GirisEkrani} options={{ title: 'Giriş yap' }} />
          <Stack.Screen name="SiteOlustur" component={SiteOlusturEkrani} options={{ title: 'Yeni site/apartman oluştur' }} />
          <Stack.Screen name="DavetKatil" component={DavetKatilEkrani} options={{ title: 'Davet koduyla katıl' }} />
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
