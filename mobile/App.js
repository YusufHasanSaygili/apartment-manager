// Uygulamanın giriş noktası: ekranlar arası geçişi yöneten React Navigation'ı kurar.
// Yeni ekranlar ilerleyen görevlerde aşağıdaki Stack'e eklenecek.
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BaglantiEkrani from './screens/BaglantiEkrani';

// Stack navigator: ekranları üst üste dizer; yeni ekran açılınca öncekinin üstüne
// gelir, geri tuşuyla bir öncekine dönülür.
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    // NavigationContainer: navigasyon durumunu tutar, tüm ekranları sarmalamak zorundadır.
    <NavigationContainer>
      <Stack.Navigator>
        {/* Şimdilik tek ekran var: uygulama açılınca BaglantiEkrani gösterilir.
            name: ekranın navigasyondaki adı, title: üst başlıkta görünen yazı */}
        <Stack.Screen name="Baglanti" component={BaglantiEkrani} options={{ title: 'Apartmanım' }} />
      </Stack.Navigator>
      {/* StatusBar: telefonun üstteki saat/şarj çubuğu; açık renkli arka planda okunsun diye koyu yazı */}
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}
