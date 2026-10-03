// Uygulamanın giriş noktası: oturum bilgisini (OturumProvider) ve ekranlar arası geçişi
// yöneten React Navigation'ı kurar.
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import BekleyenBildirimlerEkrani from './screens/BekleyenBildirimlerEkrani';
import DaireHaritasiEkrani from './screens/DaireHaritasiEkrani';
import AidatTakvimiEkrani from './screens/AidatTakvimiEkrani';
import DuyurularEkrani from './screens/DuyurularEkrani';
import DuyuruYazEkrani from './screens/DuyuruYazEkrani';
import TekrarlananDuyurularEkrani from './screens/TekrarlananDuyurularEkrani';
import SohbetlerEkrani from './screens/SohbetlerEkrani';
import SohbetEkrani from './screens/SohbetEkrani';
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
  // useSafeAreaInsets: telefonun alt gezinme çubuğunun yüksekliği. Android'de uygulama ekranın en altına kadar
  // uzandığı için bu kadar boşluk bırakılmazsa ekranların en alttaki butonları çubuğun arkasında kalır.
  const { bottom: altBosluk } = useSafeAreaInsets();
  // Sohbet ekranı alt boşluğu kendisi hesaplar (yazma kutusu klavyeyle birlikte hareket ettiği için); ona boşluk eklenmez.
  const sohbetIcerikStili = { backgroundColor: renkler.arkaPlan };

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
        // contentStyle: her ekranın dış kutusu. Alt çubuk kadar boşluk tüm ekranlara tek yerden eklenir.
        contentStyle: { paddingBottom: altBosluk, backgroundColor: renkler.arkaPlan },
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
          {/* Bekleyen bildirimler: ana ekrandaki "Bekleyen bildirimler" butonuyla açılır */}
          <Stack.Screen
            name="BekleyenBildirimler"
            component={BekleyenBildirimlerEkrani}
            options={{ title: 'Bekleyen bildirimler' }}
          />
          {/* Daire haritası: ana ekrandaki "Daire haritası" butonuyla açılır */}
          <Stack.Screen name="DaireHaritasi" component={DaireHaritasiEkrani} options={{ title: 'Daire haritası' }} />
          {/* Aidat takvimi (yönetici): haritada bir daireye dokununca açılır; başlıkta daire adı görünür */}
          <Stack.Screen
            name="AidatTakvimi"
            component={AidatTakvimiEkrani}
            options={({ route }) => ({ title: `${route.params.daireAdi} aidat takvimi` })}
          />
          {/* Duyurular (yönetici): liste. DuyuruYaz "Yeni duyuru" butonuyla boş, bir duyuru kartına dokununca
              düzenleme modunda (dolu alanlar + silme butonu) açılır.
              DuyuruYaz sadece yönetici grubunda tanımlı: sakin bu ekrana hiç gidemez (asıl engel yine backend'de). */}
          <Stack.Screen name="Duyurular" component={DuyurularEkrani} options={{ title: 'Duyurular' }} />
          <Stack.Screen
            name="DuyuruYaz"
            component={DuyuruYazEkrani}
            options={({ route }) => ({ title: route.params?.duyuru ? 'Duyuruyu düzenle' : 'Yeni duyuru' })}
          />
          {/* Tekrarlayan duyurular: Duyurular ekranındaki "Tekrarlayan duyurular" butonuyla açılır (sadece yönetici) */}
          <Stack.Screen
            name="TekrarlananDuyurular"
            component={TekrarlananDuyurularEkrani}
            options={{ title: 'Tekrarlayan duyurular' }}
          />
          {/* Mesajlar (yönetici): ana ekrandaki "Mesajlar" butonuyla sakin listesi açılır; bir sakine dokununca
              Sohbet ekranı o sakinle açılır, başlıkta sakinin adı ve dairesi görünür */}
          <Stack.Screen name="Sohbetler" component={SohbetlerEkrani} options={{ title: 'Mesajlar' }} />
          <Stack.Screen
            name="Sohbet"
            component={SohbetEkrani}
            options={({ route }) => ({ title: route.params.baslik, contentStyle: sohbetIcerikStili })}
          />
        </>
      ) : oturum ? (
        // Sakin ekranları: ana ekran, aidat bildirimi, aidat takvimi, duyurular ve yöneticiyle sohbet.
        <>
          <Stack.Screen name="SakinAna" component={SakinAnaEkrani} options={{ title: 'Apartmanım' }} />
          <Stack.Screen name="AidatBildir" component={AidatBildirEkrani} options={{ title: 'Aidat bildirimi' }} />
          {/* Aidat takvimi (sakin): aynı ekran, daireId verilmeden açılır → sakinin kendi dairesi */}
          <Stack.Screen name="AidatTakvimi" component={AidatTakvimiEkrani} options={{ title: 'Aidat takvimim' }} />
          {/* Duyurular (sakin): aynı ekran, sadece okuma */}
          <Stack.Screen name="Duyurular" component={DuyurularEkrani} options={{ title: 'Duyurular' }} />
          {/* Sohbet (sakin): aynı ekran, kisiId verilmeden açılır → sakinin konuşabileceği tek kişi olan yönetici */}
          <Stack.Screen
            name="Sohbet"
            component={SohbetEkrani}
            options={{ title: 'Yönetici ile mesajlar', contentStyle: sohbetIcerikStili }}
          />
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
