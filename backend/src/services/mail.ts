import nodemailer from 'nodemailer';

function getSmtpConfig() {
    const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
    const missingVars = requiredVars.filter((key) => !process.env[key])

    if (missingVars.length > 0) {
        throw new Error(`Missing SMTP env vars: ${missingVars.join(', ')}`)
    }

    return {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    }
}

export async function sendVerificationEmail(to: string, token: string) {
    const smtpConfig = getSmtpConfig()
    const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
        },
    });
    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    const verificationLink = `${appUrl}/api/auth/verify-email/${token}`;

    const info = await transporter.sendMail({
        from: smtpConfig.user,
        to,
        subject: 'Verify your email',
        text: `Verify your email by opening this link: ${verificationLink}`,
        html: `<p>Verify your email by clicking this link:</p><a href="${verificationLink}">${verificationLink}</a>`,
    });

    if (info.rejected.length > 0) {
        throw new Error(`Email rejected for: ${info.rejected.join(', ')}`)
    }
}
