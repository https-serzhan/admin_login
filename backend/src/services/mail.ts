import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function sendVerificationEmail(to: string, token: string) {
    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    const verificationLink = `${appUrl}/api/auth/verify-email/${token}`;

    await transporter.sendMail({
        from: process.env.SMTP_USER,
        to,
        subject: 'Verify your email',
        text: `Verify your email by opening this link: ${verificationLink}`,
        html: `<p>Verify your email by clicking this link:</p><a href="${verificationLink}">${verificationLink}</a>`,
    });
}
