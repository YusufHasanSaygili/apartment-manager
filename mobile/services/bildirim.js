// Push bildirim ayarları: bildirim izni istemek ve telefonun Expo push adresini (token) almak.
// Not: Push bildirim Expo Go'da çalışmaz; uygulama "npx expo run:android" ile derlenmiş olmalıdır.
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Uygulama AÇIKKEN gelen bildirim de ekranın üstünde gösterilsin (varsayılan: gösterilmez).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// İzin ister ve telefonun push token'ını döner. Alınamazsa (izin verilmedi, emülatör, ağ hatası) null.
// Bildirimler uygulamanın ana işlevi değil; bu yüzden hata fırlatmaz, uygulama bildirimsiz çalışmaya devam eder.
export async function pushTokenAl() {
  // iOS simülatöründe push token alınamaz. Android emülatörü (Google Play destekli) ise
  // bildirim alabildiği için engellenmez; Görev 4.2'de iki emülatörle deneme yapılacak.
  if (!Device.isDevice && Platform.OS === 'ios') return null;

  try {
    // Android 8+ bildirimleri "kanal" üzerinden gösterir; backend 'varsayilan' kanalına gönderir.
    // MAX önem: bildirim ekranın üstünde açılır pencere olarak görünür.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('varsayilan', {
        name: 'Duyurular ve bildirimler',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    // İzin daha önce verilmediyse kullanıcıya sorulur (Android 13+ ve iOS'ta izin penceresi çıkar).
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      // Parantez gerekli: let ile tanımlı status'a sonradan nesne parçalama ile yeni değer atanıyor.
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    // projectId: app.json'daki Expo (EAS) proje kimliği. Expo hangi uygulamaya bildirim
    // gönderdiğini bununla bilir.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data; // "ExponentPushToken[...]"
  } catch (hata) {
    console.warn('Push token alınamadı:', hata.message);
    return null;
  }
}
