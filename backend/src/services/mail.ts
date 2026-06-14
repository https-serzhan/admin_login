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
        const error = err as NodeJS.ErrnoException & {code?: string, cause?: unknown}

        return {
            name: error.name,
            message: error.message,
            code: error.code,
            cause: error.cause,
        }
    }

    return {
        message: String(err),
    }
}

function getEnvValue(key: string) {
    const value = process.env[key]

    if(!value){
        return ''
    }

    return value.trim().replace(/^['"]|['"]$/g, '')
}

function getResendConfig() {
    const apiKey = getEnvValue('RESEND_API_KEY')
    const from = getEnvValue('RESEND_FROM')
    const missingVars = [
        !apiKey && 'RESEND_API_KEY',
        !from && 'RESEND_FROM',
    ].filter(Boolean)

    if (missingVars.length > 0) {
        throw new MailError(`Missing Resend env vars: ${missingVars.join(', ')}`, 'config', {
            provider: 'resend',
            missingVars,
        })
    }

    return {
        apiKey,
        from,
        apiUrl: getEnvValue('RESEND_API_URL') || 'https://api.resend.com/emails',
    }
}

type ResendConfig = ReturnType<typeof getResendConfig>

type ResendResponseBody = Record<string, unknown> | string | null

export function buildVerificationLink(token: string) {
    const appUrl = process.env.APP_URL || 'http://localhost:3001'

    return `${appUrl}/api/auth/verify-email/${token}`
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => {
        switch(character){
            case '&':
                return '&amp;'
            case '<':
                return '&lt;'
            case '>':
                return '&gt;'
            case '"':
                return '&quot;'
            case "'":
                return '&#39;'
            default:
                return character
        }
    })
}

async function readResendResponse(response: Response): Promise<ResendResponseBody> {
    const responseText = await response.text()

    if(!responseText){
        return null
    }

    try {
        return JSON.parse(responseText) as Record<string, unknown>
    }
    catch {
        return responseText
    }
}

async function sendVerificationEmailWithResend(resendConfig: ResendConfig, to: string, verificationLink: string) {
    const payload = {
        from: resendConfig.from,
        to,
        subject: 'Verify your email',
        text: `Verify your email by opening this link: ${verificationLink}`,
        html: `<p>Verify your email by clicking this link:</p><p><a href="${escapeHtml(verificationLink)}">${escapeHtml(verificationLink)}</a></p>`,
    }

    console.log('Sending verification email with Resend', {
        provider: 'resend',
        to,
        from: resendConfig.from,
        appUrl: process.env.APP_URL,
    })

    let response: Response

    try {
        response = await fetch(resendConfig.apiUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${resendConfig.apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'admin-login/1.0',
            },
            body: JSON.stringify(payload),
        })
    }
    catch(err) {
        const details = {
            provider: 'resend',
            ...getErrorDetails(err),
        }
        console.error('Resend request failed', details)
        throw new MailError('Resend request failed', 'send', details)
    }

    const responseBody = await readResendResponse(response)

    if(!response.ok){
        const details = {
            provider: 'resend',
            status: response.status,
            statusText: response.statusText,
            response: responseBody,
        }
        console.error('Resend email send failed', details)
        throw new MailError('Resend email send failed', 'send', details)
    }

    console.log('Verification email sent with Resend', {
        provider: 'resend',
        status: response.status,
        response: responseBody,
    })
}

export async function sendVerificationEmail(to: string, token: string) {
    const resendConfig = getResendConfig()
    const verificationLink = buildVerificationLink(token)

    await sendVerificationEmailWithResend(resendConfig, to, verificationLink)
}
