// Push bildirim ayarları: bildirim izni istemek ve telefonun Expo push adresini (token) almak.
// Not: Push bildirim Expo Go'da çalışmaz; uygulama "npx expo run:android" ile derlenmiş olmalıdır.
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Şu an ekranda açık olan sohbetteki kişinin kimliği (sohbet açık değilse null).
// ChatScreen açılınca/kapanınca setOpenChat ile güncellenir.
// useState değil düz değişken: bildirim yakalayıcısı bir component değil, React dışında çalışır;
// ayrıca bu değer değişince hiçbir ekranın yeniden çizilmesi gerekmez.
let openChatPersonId = null;
export function setOpenChat(personId) {
  openChatPersonId = personId;
}

// Uygulama AÇIKKEN gelen bildirim de ekranın üstünde gösterilsin (varsayılan: gösterilmez).
// İstisna: bildirim, şu an ekranda açık olan sohbetin yeni mesajıysa gösterilmez; mesaj zaten
// soket ile ekrana düşüyor, bir de bildirim çıkması rahatsız edici olurdu (WhatsApp da böyle yapar).
// Uygulama kapalı veya arka plandayken bu fonksiyon çalışmaz; bildirimi telefon her zaman gösterir.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    const show = !(data?.screen === 'Chat' && data.personId === openChatPersonId);
    return {
      shouldShowBanner: show,
      shouldShowList: show,
      shouldPlaySound: show,
      shouldSetBadge: false,
    };
  },
});

// İzin ister ve telefonun push token'ını döner. Alınamazsa (izin verilmedi, emülatör, ağ hatası) null.
// Bildirimler uygulamanın ana işlevi değil; bu yüzden hata fırlatmaz, uygulama bildirimsiz çalışmaya devam eder.
export async function getPushToken() {
  // iOS simülatöründe push token alınamaz. Android emülatörü (Google Play destekli) ise
  // bildirim alabildiği için engellenmez; Görev 4.2'de iki emülatörle deneme yapılacak.
  if (!Device.isDevice && Platform.OS === 'ios') return null;

  try {
    // Android 8+ bildirimleri "kanal" üzerinden gösterir; backend 'default' kanalına gönderir.
    // MAX önem: bildirim ekranın üstünde açılır pencere olarak görünür.
    if (Platform.OS === 'android') {
      // Uygulamanın eski sürümü 'varsayilan' adlı bir kanal kullanıyordu; telefon ayarlarında boşta kalmasın diye silinir
      // (yoksa hata vermez, sessizce geçilir).
      await Notifications.deleteNotificationChannelAsync('varsayilan').catch(() => {});
      await Notifications.setNotificationChannelAsync('default', {
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
  } catch (error) {
    console.warn('Push token alınamadı:', error.message);
    return null;
  }
}
