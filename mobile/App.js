// Uygulamanın giriş noktası: oturum bilgisini (SessionProvider) ve ekranlar arası geçişi
// yöneten React Navigation'ı kurar.
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SessionProvider, useSession } from './services/SessionContext';
import WelcomeScreen from './screens/WelcomeScreen';
import CreateSiteScreen from './screens/CreateSiteScreen';
import LoginScreen from './screens/LoginScreen';
import ManagerHomeScreen from './screens/ManagerHomeScreen';
import SetupScreen from './screens/SetupScreen';
import FlatsScreen from './screens/FlatsScreen';
import InviteCodeScreen from './screens/InviteCodeScreen';
import ResidentHomeScreen from './screens/ResidentHomeScreen';
import JoinWithCodeScreen from './screens/JoinWithCodeScreen';
import ReportPaymentScreen from './screens/ReportPaymentScreen';
import DueAmountScreen from './screens/DueAmountScreen';
import PendingPaymentsScreen from './screens/PendingPaymentsScreen';
import FlatMapScreen from './screens/FlatMapScreen';
import DueCalendarScreen from './screens/DueCalendarScreen';
import AnnouncementsScreen from './screens/AnnouncementsScreen';
import WriteAnnouncementScreen from './screens/WriteAnnouncementScreen';
import RecurringAnnouncementsScreen from './screens/RecurringAnnouncementsScreen';
import ChatsScreen from './screens/ChatsScreen';
import HandoverScreen from './screens/HandoverScreen';
import DeleteAccountScreen from './screens/DeleteAccountScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ChatScreen from './screens/ChatScreen';
import IntroAnimation from './components/IntroAnimation';
import ConnectionBanner from './components/ConnectionBanner';
import ErrorMessage from './components/ErrorMessage';
import { radius, colors, fonts } from './theme';

// Telefonun koyu açılış ekranı (splash) kendiliğinden kapanmasın: açılış animasyonu ilk karesini çizince
// kapatılır (IntroAnimation içinde). Böylece splash ile animasyon arasında boş/beyaz kare görünmez.
SplashScreen.preventAutoHideAsync();

// Üst çubuktaki geri butonunun kutusu (36x36, koyu zemin, köşeli)
const backButtonStyle = {
  width: 36,
  height: 36,
  marginRight: 12,
  borderRadius: radius,
  backgroundColor: colors.surface2,
  alignItems: 'center',
  justifyContent: 'center',
};

// Stack navigator: ekranları üst üste dizer; yeni ekran açılınca öncekinin üstüne
// gelir, geri tuşuyla bir öncekine dönülür.
const Stack = createNativeStackNavigator();

// Ekran listesi oturuma ve role göre değişir (React Navigation'ın önerdiği giriş akışı yöntemi):
// oturum yoksa açılış/kayıt ekranları, yöneticiyse yönetici ekranları, sakinse sakin ekranları
// tanımlıdır. Tanımlı olmayan bir ekrana hiçbir şekilde gidilemez; oturum açılınca açılış
// ekranları listeden çıktığı için geri tuşu kullanıcıyı kayıt formuna döndürmez.
// (Asıl yetki kontrolü backend'dedir; bu ayrım kullanıcıya doğru ekranları göstermek içindir.)
function Screens() {
  // session: giriş yapılmış mı; ready: açılıştaki otomatik giriş kontrolü bitti mi (SessionContext'ten).
  const { session, ready, startupError, loadSavedSession } = useSession();
  // useState: açılıştaki "Tekrar dene" isteği sürüyor mu. Sürerken buton yerine dönen simge gösterilir
  // (sunucu cevap vermezse istek 10 sn sürebilir; kullanıcı butonun çalıştığını görsün).
  const [retrying, setRetrying] = useState(false);
  // useSafeAreaInsets: telefonun alt gezinme çubuğunun yüksekliği. Android'de uygulama ekranın en altına kadar
  // uzandığı için bu kadar boşluk bırakılmazsa ekranların en alttaki butonları çubuğun arkasında kalır.
  const { bottom: bottomInset } = useSafeAreaInsets();
  // Sohbet ekranı alt boşluğu kendisi hesaplar (yazma kutusu klavyeyle birlikte hareket ettiği için); ona boşluk eklenmez.
  const chatContentStyle = { backgroundColor: colors.background };

  // Açılışta kayıtlı oturum kontrol edilirken boş ekran gösterilir (çok kısa sürer).
  // Bu sırada ekran seçilmez; yoksa giriş yapmış kullanıcı bir an açılış ekranını görürdü.
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  // Açılışta kayıtlı oturum sunucuya sorulamadı (internet yok, sunucu kapalı): açılış ekranı yerine hata ve
  // "Tekrar dene" gösterilir. Kullanıcı çıkış yapmış sayılmaz; sunucuya ulaşılınca oturum kaldığı yerden açılır.
  if (startupError) {
    // "Tekrar dene" butonuna basınca: SessionContext'teki loadSavedSession tekrar çalışır (GET /api/hesap/ben).
    // retrying kontrolü: butona hızlıca iki kez basılırsa ikinci istek atılmaz.
    const onRetry = async () => {
      if (retrying) return;
      setRetrying(true);
      await loadSavedSession();
      setRetrying(false);
    };
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
        {retrying ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <ErrorMessage mesaj={startupError} onRetry={onRetry} />
        )}
      </View>
    );
  }

  return (
    <Stack.Navigator
      // screenOptions fonksiyon: her ekranın navigation nesnesine ulaşıp kendi geri butonunu çizmek için.
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        // Başlık yazısı Geist yarı kalın; tüm ekranların üst çubuğu aynı görünür.
        headerTitleStyle: {
          fontFamily: fonts.metin,
          fontWeight: '600',
          fontSize: 18,
        },
        headerShadowVisible: false,
        // contentStyle: her ekranın dış kutusu. Alt çubuk kadar boşluk tüm ekranlara tek yerden eklenir.
        contentStyle: {
          paddingBottom: bottomInset,
          backgroundColor: colors.background,
        },
        // Geri butonu: köşeli koyu kutu içinde ok (önizlemedeki tasarım). Basınca bir önceki ekrana dönülür.
        headerLeft: ({ canGoBack }) =>
          canGoBack ? (
            <Pressable
              onPress={navigation.goBack}
              style={({ pressed }) => [backButtonStyle, pressed && { opacity: 0.6 }]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Geri"
            >
              <Feather name="arrow-left" size={20} color={colors.text} />
            </Pressable>
          ) : null,
      })}
    >
      {session?.kullanici.rol === 'yonetici' ? (
        <>
          {/* Ana ekranlarda üst çubuk yok: ekranın kendi büyük başlığı (site adı) var */}
          <Stack.Screen name="ManagerHome" component={ManagerHomeScreen} options={{ headerShown: false }} />
          {/* Kurulum ekranı: yönetici ana ekranındaki "Bina ve daire kurulumu" butonuyla açılır */}
          <Stack.Screen name="Setup" component={SetupScreen} options={{ title: 'Bina ve daire kurulumu' }} />
          {/* Daire listesi: ana ekrandaki "Daireler ve davet kodları" butonuyla açılır */}
          <Stack.Screen name="Flats" component={FlatsScreen} options={{ title: 'Daireler' }} />
          {/* Daire kodu: alttan açılan pencere. transparentModal: arkadaki daire listesi görünür kalır; karartma ve
              pencere ekranın kendisinde çizilir (Android'in hazır pencere karartması sabit ve önizlemedekinden zayıf) */}
          <Stack.Screen
            name="InviteCode"
            component={InviteCodeScreen}
            options={{
              presentation: 'transparentModal',
              animation: 'fade',
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          {/* Aidat tutarı: ana ekrandaki "Aidat tutarını belirle/değiştir" butonuyla açılır */}
          <Stack.Screen name="DueAmount" component={DueAmountScreen} options={{ title: 'Aylık aidat tutarı' }} />
          {/* Bekleyen bildirimler: ana ekrandaki "Bekleyen bildirimler" butonuyla açılır */}
          <Stack.Screen
            name="PendingPayments"
            component={PendingPaymentsScreen}
            options={{ title: 'Bekleyen aidatlar' }}
          />
          {/* Daire haritası: ana ekrandaki "Daire haritası" butonuyla açılır */}
          <Stack.Screen name="FlatMap" component={FlatMapScreen} options={{ title: 'Daire haritası' }} />
          {/* Aidat takvimi (yönetici): haritada bir daireye dokununca açılır; başlıkta daire adı görünür */}
          <Stack.Screen
            name="DueCalendar"
            component={DueCalendarScreen}
            options={({ route }) => ({
              title: `${route.params.flatName} aidat takvimi`,
            })}
          />
          {/* Duyurular (yönetici): liste. WriteAnnouncement "Yeni duyuru" butonuyla boş, bir duyuru kartına dokununca
              düzenleme modunda (dolu alanlar + silme butonu) açılır.
              WriteAnnouncement sadece yönetici grubunda tanımlı: sakin bu ekrana hiç gidemez (asıl engel yine backend'de). */}
          <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ title: 'Duyurular' }} />
          <Stack.Screen
            name="WriteAnnouncement"
            component={WriteAnnouncementScreen}
            options={({ route }) => ({
              title: route.params?.announcement ? 'Duyuruyu düzenle' : 'Yeni duyuru',
            })}
          />
          {/* Tekrarlayan duyurular: Duyurular ekranındaki "Tekrarlayan duyurular" butonuyla açılır (sadece yönetici) */}
          <Stack.Screen
            name="RecurringAnnouncements"
            component={RecurringAnnouncementsScreen}
            options={{ title: 'Tekrarlayan duyurular' }}
          />
          {/* Yöneticiliği devret: ana ekrandaki "Yöneticiliği devret" butonuyla açılır. Devir tamamlanınca rol
              "sakin" olur ve bu grup listeden çıkar; uygulama kendiliğinden sakin ekranlarına geçer. */}
          <Stack.Screen name="Handover" component={HandoverScreen} options={{ title: 'Yöneticiliği devret' }} />
          {/* Hesabımı sil (yönetici): sadece "önce yöneticiliği devredin" açıklaması ve Devir ekranına geçiş */}
          <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ title: 'Hesabımı sil' }} />
          {/* Mesajlar (yönetici): ana ekrandaki "Mesajlar" butonuyla sakin listesi açılır; bir sakine dokununca
              Sohbet ekranı o sakinle açılır, başlıkta sakinin adı ve dairesi görünür */}
          <Stack.Screen name="Chats" component={ChatsScreen} options={{ title: 'Mesajlar' }} />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={({ route }) => ({
              title: route.params.baslik,
              contentStyle: chatContentStyle,
            })}
          />
        </>
      ) : session ? (
        // Sakin ekranları: ana ekran, aidat bildirimi, aidat takvimi, duyurular ve yöneticiyle sohbet.
        <>
          <Stack.Screen name="ResidentHome" component={ResidentHomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ReportPayment" component={ReportPaymentScreen} options={{ title: 'Aidat bildirimi' }} />
          {/* Aidat takvimi (sakin): aynı ekran, daireId verilmeden açılır → sakinin kendi dairesi */}
          <Stack.Screen name="DueCalendar" component={DueCalendarScreen} options={{ title: 'Aidat takvimim' }} />
          {/* Duyurular (sakin): aynı ekran, sadece okuma */}
          <Stack.Screen name="Announcements" component={AnnouncementsScreen} options={{ title: 'Duyurular' }} />
          {/* Sohbet (sakin): aynı ekran, kisiId verilmeden açılır → sakinin konuşabileceği tek kişi olan yönetici */}
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            // Başlık: ana ekrandan yöneticinin adıyla gelir ("Ayşe Yılmaz · Yönetici"); gelmezse genel başlık
            options={({ route }) => ({
              title: route.params?.baslik ?? 'Yönetici ile mesajlar',
              contentStyle: chatContentStyle,
            })}
          />
          {/* Hesabımı sil (sakin): şifre onayıyla hesap kalıcı olarak silinir */}
          <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ title: 'Hesabımı sil' }} />
        </>
      ) : (
        <>
          {/* Açılış ekranında üst başlık çubuğu gizlenir, ekranın kendi başlığı var */}
          <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Giriş yap' }} />
          {/* Şifremi unuttum: giriş ekranındaki bağlantıyla açılır (giriş yapmamış kullanıcılar için) */}
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Şifremi unuttum' }} />
          <Stack.Screen
            name="CreateSite"
            component={CreateSiteScreen}
            options={{ title: 'Yeni site/apartman oluştur' }}
          />
          <Stack.Screen name="JoinWithCode" component={JoinWithCodeScreen} options={{ title: 'Davet koduyla katıl' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  // useState: açılış animasyonu bitti mi. Bitince (veya ekrana dokunup atlanınca) true olur ve animasyon kaldırılır.
  const [animationDone, setAnimationDone] = useState(false);

  return (
    // SafeAreaProvider: ekranların telefonun çentik ve alt çubuk ölçülerini bilmesini sağlar.
    // KeyboardProvider: klavyenin açılıp kapanmasını tüm ekranlar için takip eder
    // (formların klavyeye göre kaymasını sağlayan kütüphanenin çalışması için gerekli).
    // SessionProvider: içindeki tüm ekranlar useSession() ile oturuma ulaşabilir.
    <SafeAreaProvider>
      <KeyboardProvider>
        <SessionProvider>
          {/* NavigationContainer: navigasyon durumunu tutar, tüm ekranları sarmalamak zorundadır */}
          <NavigationContainer>
            <Screens />
            {/* StatusBar: telefonun üstteki saat/şarj çubuğu; koyu temada okunsun diye açık renk yazı */}
            <StatusBar style="light" />
          </NavigationContainer>
          {/* Bağlantı yok şeridi: sunucuya ulaşılamayınca her ekranın altında görünür, bağlantı gelince kaybolur */}
          <ConnectionBanner />
          {/* Açılış animasyonu: uygulamanın üstünde tam ekran oynar; o sırada altta oturum kontrolü yapılır */}
          {!animationDone && <IntroAnimation onFinish={() => setAnimationDone(true)} />}
        </SessionProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
