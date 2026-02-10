import nodemailer from 'nodemailer';

// 创建邮件传输器
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

interface SendVerificationEmailParams {
  to: string;
  token: string;
}

/**
 * 发送验证邮件
 */
export async function sendVerificationEmail({ to, token }: SendVerificationEmailParams) {
  const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify?token=${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject: '验证您的币安交易复盘系统账户',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">欢迎注册币安交易复盘系统</h2>
        <p>感谢您注册！请点击下面的按钮验证您的邮箱地址：</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #3B82F6; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            验证邮箱
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          或者复制以下链接到浏览器：<br>
          <a href="${verificationUrl}">${verificationUrl}</a>
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          如果您没有注册此账户，请忽略此邮件。
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Verification email sent to:', to);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('发送验证邮件失败');
  }
}
