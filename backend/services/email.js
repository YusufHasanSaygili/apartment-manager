// E-posta gönderme: "şifremi unuttum" kodunu kullanıcının e-postasına gönderir.
// nodemailer: Node.js'in standart e-posta kütüphanesi; SMTP (e-posta gönderme protokolü) ile çalışır.
// Hangi e-posta hesabından gönderileceği koda yazılmaz, .env'deki SMTP_ ayarlarından okunur:
// Gmail, alan adlı bir e-posta veya başka bir sağlayıcıya geçmek için sadece .env değişir.
const nodemailer = require('nodemailer');

// Bir e-posta gönderir. SMTP ayarlanmamışsa veya gönderim başarısız olursa hata fırlatır (çağıran yakalar).
// Bağlantı her gönderimde yeniden kurulur: günde birkaç e-posta için bağlantıyı saklamaya (önbelleğe) gerek yok.
async function sendEmail({ to, subject, text }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) throw new Error('E-posta ayarları (.env içindeki SMTP_) yapılmamış.');
  const port = Number(SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    // 465 portu baştan şifreli (SSL) bağlanır; 587 önce düz bağlanıp STARTTLS ile şifreli bağlantıya geçer.
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
  await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to, subject, text });
}

module.exports = { sendEmail };
