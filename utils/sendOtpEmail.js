const nodemailer = require("nodemailer");

const sendOtpEmail = async (toEmail, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, 
      family: 4, 
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"Om Services Auth" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Your Verification Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">OM SERVICE SIGN IN</h2>
          <p style="font-size: 16px; color: #555;">Hello,</p>
          <p style="font-size: 16px; color: #555;">Please use the verification code below to complete your sign-in process.</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="display: inline-block; padding: 10px 20px; font-size: 24px; font-weight: bold; background: #FFD700; color: #111; border-radius: 5px; letter-spacing: 2px;">
              ${otp}
            </span>
          </div>
          <p style="font-size: 14px; color: #777;">This code is valid for 5 minutes. If you did not request this code, you can safely ignore this email.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ OTP Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Email error:", error);
    throw error;
  }
};

module.exports = sendOtpEmail;
