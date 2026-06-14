import nodemailer from 'nodemailer';

export class MailError extends Error {
    stage: string
    details: Record<string, unknown>

    constructor(message: string, stage: string, details: Record<string, unknown> = {}) {
        super(message)
        this.name = 'MailError'
        this.stage = stage
        this.details = details
    }
}

function getErrorDetails(err: unknown) {
    if(err && typeof err === 'object'){
        const error = err as NodeJS.ErrnoException & {code?: string, command?: string, response?: string, responseCode?: number}

        return {
            name: error.name,
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode,
        }
    }

    return {
        message: String(err),
    }
}

function getSmtpConfig() {
    const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']
    const missingVars = requiredVars.filter((key) => !process.env[key])

    if (missingVars.length > 0) {
        throw new MailError(`Missing SMTP env vars: ${missingVars.join(', ')}`, 'config', {
            missingVars,
        })
    }

    return {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    }
}

export function buildVerificationLink(token: string) {
    const appUrl = process.env.APP_URL || 'http://localhost:3001'

    return `${appUrl}/api/auth/verify-email/${token}`
}

export async function sendVerificationEmail(to: string, token: string) {
    const smtpConfig = getSmtpConfig()
    console.log('Preparing verification email', {
        to,
        smtpHost: smtpConfig.host,
        smtpPort: smtpConfig.port,
        smtpSecure: smtpConfig.secure,
        smtpUser: smtpConfig.user,
        appUrl: process.env.APP_URL,
    })
    const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
        },
    });
    const verificationLink = buildVerificationLink(token)

    try {
        console.log('Verifying SMTP connection')
        await transporter.verify()
        console.log('SMTP connection verified')
    }
    catch(err) {
        const details = getErrorDetails(err)
        console.error('SMTP connection verification failed', details)
        throw new MailError('SMTP connection failed', 'verify', details)
    }

    let info

    try {
        console.log('Sending verification email', {
            to,
            verificationLink,
        })
        info = await transporter.sendMail({
            from: smtpConfig.user,
            to,
            subject: 'Verify your email',
            text: `Verify your email by opening this link: ${verificationLink}`,
            html: `<p>Verify your email by clicking this link:</p><a href="${verificationLink}">${verificationLink}</a>`,
        });
    }
    catch(err) {
        const details = getErrorDetails(err)
        console.error('Verification email send failed', details)
        throw new MailError('Verification email send failed', 'send', details)
    }

    console.log('Verification email send result', {
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
        messageId: info.messageId,
    })

    if (info.rejected.length > 0) {
        throw new MailError(`Email rejected for: ${info.rejected.join(', ')}`, 'rejected', {
            accepted: info.accepted,
            rejected: info.rejected,
            response: info.response,
        })
    }
}
