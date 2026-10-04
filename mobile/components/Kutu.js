// Ana ekranlardaki 2'li ızgaranın (bento) kutucuğu: üstte ikon (ve varsa sayı rozeti), hemen altında başlık ve açıklama.
// genis: satırı tek başına kaplayan yatay kutu (örn. "Bekleyen aidatlar"). vurgulu: altın zeminli, öne çıkan kutu.
// children: başlığın üstüne eklenecek ek içerik (örn. mini daire haritası, mini takvim).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { karistir, kose, renkler, yaziTipi } from '../tema';
import Ikon from './Ikon';

export default function Kutu({ ikon, baslik, alt, rozet, onPress, genis = false, vurgulu = false, style, children }) {
  // Vurgulu kutuda zemin altın, yazılar koyu; diğerlerinde zemin koyu kart, ikon altın.
  const zemin = vurgulu ? renkler.birincil : renkler.kart;
  const yazi = vurgulu ? renkler.birincilUzeri : renkler.yazi;
  const ikonZemin = vurgulu ? karistir(renkler.birincilUzeri, 0.14, renkler.birincil) : karistir(renkler.birincil, 0.11);
  return (
    // Basınca ekranın verdiği onPress çalışır (ilgili ekrana gider)
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[baslik, alt, rozet].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.kutu,
        genis && styles.genis,
        { backgroundColor: zemin, borderColor: vurgulu ? renkler.birincil : renkler.kenarlik },
        pressed && styles.basili,
        style,
      ]}
    >
      <View style={[styles.ust, genis && styles.ustGenis]}>
        <View style={[styles.ikonKutu, { backgroundColor: ikonZemin }]}>
          <Ikon ad={ikon} boyut={22} renk={vurgulu ? renkler.birincilUzeri : renkler.birincil} arka={ikonZemin} />
        </View>
        {/* Rozet: geniş kutuda sağda ortada, normal kutuda sağ üstte (kare, mono sayı) */}
        {rozet && !genis ? (
          <View style={[styles.rozet, vurgulu && styles.rozetVurgulu]}>
            <Text style={[styles.rozetYazi, vurgulu && { color: renkler.birincil }]}>{rozet}</Text>
          </View>
        ) : null}
      </View>
      {children}
      <View style={genis ? styles.metinGenis : styles.metin}>
        <Text style={[styles.baslik, { color: yazi }]}>{baslik}</Text>
        {alt ? <Text style={[styles.alt, vurgulu && { color: karistir(renkler.birincilUzeri, 0.7, renkler.birincil) }]}>{alt}</Text> : null}
      </View>
      {rozet && genis ? (
        <View style={[styles.rozet, vurgulu && styles.rozetVurgulu]}>
          <Text style={[styles.rozetYazi, vurgulu && { color: renkler.birincil }]}>{rozet}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // İçerik üstten başlar (ikonun hemen altında yazı); kısa yazılı kutuda boşluk oluşmaz.
  kutu: {
    flex: 1,
    flexBasis: 0, // yan yana kutular yazı uzunluğundan bağımsız eşit genişlikte olsun
    minHeight: 112,
    padding: 14,
    gap: 12,
    borderRadius: kose,
    borderWidth: 1,
  },
  genis: {
    flex: 0, // geniş kutu dikey listede kendi içeriği kadar yer kaplar
    flexBasis: 'auto',
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
  },
  basili: {
    opacity: 0.75,
  },
  ust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ustGenis: {
    flex: 0,
  },
  ikonKutu: {
    width: 42,
    height: 42,
    borderRadius: kose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metin: {
    gap: 1,
  },
  metinGenis: {
    flex: 1,
    gap: 1,
  },
  baslik: {
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 19,
  },
  alt: {
    fontFamily: yaziTipi.metin,
    fontSize: 12.5,
    color: renkler.soluk,
  },
  rozet: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: kose,
    backgroundColor: renkler.birincil,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rozetVurgulu: {
    backgroundColor: renkler.birincilUzeri,
  },
  rozetYazi: {
    fontFamily: yaziTipi.mono,
    fontSize: 12,
    fontWeight: '600',
    color: renkler.birincilUzeri,
  },
});
