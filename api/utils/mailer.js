

const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
  service: "gmail", 
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
});


async function sendMail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"MVPI Support Team" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`Email enviado a ${to}`);
  } catch (err) {
    console.error("Error enviando correo:", err);
    throw err;
  }
}

module.exports = { sendMail };
