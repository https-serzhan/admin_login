import crypto from 'crypto'
import dns from 'dns'
import net from 'net'
import tls from 'tls'

dns.setDefaultResultOrder('ipv4first')

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

type MailProvider = 'smtp' | 'resend'

type EmailResponseBody = Record<string, unknown> | string | null

type VerificationEmailContent = {
    subject: string,
    text: string,
    html: string,
}

type SmtpReply = {
    code: number,
    message: string,
}

type SmtpReplyParseResult = {
    reply: SmtpReply,
    rest: string,
}

type PendingReply = {
    resolve: (reply: SmtpReply) => void,
    reject: (err: Error) => void,
    timer: ReturnType<typeof setTimeout>,
    stage: string,
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

function getMailProvider(): MailProvider {
    const provider = getEnvValue('MAIL_PROVIDER') || 'smtp'

    if(provider !== 'smtp' && provider !== 'resend'){
        throw new MailError(`Unsupported mail provider: ${provider}`, 'config', {
            provider,
        })
    }

    return provider
}

function getSmtpConfig() {
    const host = getEnvValue('SMTP_HOST')
    const port = getEnvValue('SMTP_PORT')
    const user = getEnvValue('SMTP_USER')
    const pass = getEnvValue('SMTP_PASS').replace(/\s/g, '')
    const missingVars = [
        !host && 'SMTP_HOST',
        !port && 'SMTP_PORT',
        !user && 'SMTP_USER',
        !pass && 'SMTP_PASS',
    ].filter(Boolean)

    if (missingVars.length > 0) {
        throw new MailError(`Missing SMTP env vars: ${missingVars.join(', ')}`, 'config', {
            provider: 'smtp',
            missingVars,
        })
    }

    const parsedPort = Number(port)

    if(!Number.isInteger(parsedPort) || parsedPort <= 0){
        throw new MailError('Invalid SMTP_PORT', 'config', {
            provider: 'smtp',
            smtpPort: port,
        })
    }

    return {
        host,
        port: parsedPort,
        secure: getEnvValue('SMTP_SECURE') === 'true',
        user,
        pass,
        from: getEnvValue('SMTP_FROM') || user,
        ehloName: getEnvValue('SMTP_EHLO_NAME') || 'localhost',
    }
}

type SmtpConfig = ReturnType<typeof getSmtpConfig>

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

class SmtpReader {
    private buffer = ''
    private pendingReply: PendingReply | null = null
    private lastError: Error | null = null

    constructor(private socket: net.Socket) {
        this.socket.setEncoding('utf8')
        this.socket.on('data', this.handleData)
        this.socket.on('error', this.handleError)
        this.socket.on('close', this.handleClose)
    }

    detach() {
        this.socket.off('data', this.handleData)
        this.socket.off('error', this.handleError)
        this.socket.off('close', this.handleClose)
    }

    readReply(stage: string, timeoutMs = 20000) {
        if(this.lastError){
            return Promise.reject(this.lastError)
        }

        const parsedReply = extractSmtpReply(this.buffer)

        if(parsedReply){
            this.buffer = parsedReply.rest
            return Promise.resolve(parsedReply.reply)
        }

        if(this.pendingReply){
            return Promise.reject(new Error('SMTP reply is already pending'))
        }

        return new Promise<SmtpReply>((resolve, reject) => {
            const timer = setTimeout(() => {
                if(this.pendingReply?.timer === timer){
                    this.pendingReply = null
                }
                reject(new Error(`SMTP reply timed out during ${stage}`))
            }, timeoutMs)

            this.pendingReply = {
                resolve,
                reject,
                timer,
                stage,
            }
        })
    }

    private handleData = (chunk: string | Buffer) => {
        this.buffer += chunk.toString()
        this.resolvePendingReply()
    }

    private handleError = (err: Error) => {
        this.rejectPendingReply(err)
    }

    private handleClose = () => {
        this.rejectPendingReply(new Error('SMTP connection closed'))
    }

    private resolvePendingReply() {
        if(!this.pendingReply){
            return
        }

        const parsedReply = extractSmtpReply(this.buffer)

        if(!parsedReply){
            return
        }

        const pendingReply = this.pendingReply
        this.pendingReply = null
        this.buffer = parsedReply.rest
        clearTimeout(pendingReply.timer)
        pendingReply.resolve(parsedReply.reply)
    }

    private rejectPendingReply(err: Error) {
        this.lastError = err

        if(!this.pendingReply){
            return
        }

        const pendingReply = this.pendingReply
        this.pendingReply = null
        clearTimeout(pendingReply.timer)
        pendingReply.reject(err)
    }
}

function extractSmtpReply(buffer: string): SmtpReplyParseResult | null {
    const lineMatches = buffer.matchAll(/[^\r\n]*(?:\r\n|\n)/g)
    const replyLines: string[] = []
    let consumedLength = 0

    for(const lineMatch of lineMatches){
        const lineWithEnding = lineMatch[0]
        const line = lineWithEnding.replace(/\r?\n$/, '')

        consumedLength += lineWithEnding.length

        if(!line){
            continue
        }

        replyLines.push(line)

        if(/^\d{3} /.test(line)){
            return {
                reply: {
                    code: Number(line.slice(0, 3)),
                    message: replyLines.join('\n'),
                },
                rest: buffer.slice(consumedLength),
            }
        }
    }

    return null
}

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

function buildVerificationEmailContent(verificationLink: string): VerificationEmailContent {
    return {
        subject: 'Verify your email',
        text: `Verify your email by opening this link: ${verificationLink}`,
        html: `<p>Verify your email by clicking this link:</p><p><a href="${escapeHtml(verificationLink)}">${escapeHtml(verificationLink)}</a></p>`,
    }
}

function sanitizeHeader(value: string) {
    return value.replace(/[\r\n]+/g, ' ').trim()
}

function getEmailAddress(value: string) {
    const addressMatch = value.match(/<([^<>]+)>/)

    if(addressMatch){
        return addressMatch[1].trim()
    }

    return value.trim()
}

function getEnvelopeAddress(value: string) {
    return getEmailAddress(value).replace(/[<>\r\n]/g, '').trim()
}

function buildSmtpMessage(from: string, to: string, content: VerificationEmailContent) {
    const boundary = `admin-login-${crypto.randomBytes(12).toString('hex')}`
    const lines = [
        `From: ${sanitizeHeader(from)}`,
        `To: ${sanitizeHeader(to)}`,
        `Subject: ${sanitizeHeader(content.subject)}`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: <${crypto.randomBytes(16).toString('hex')}@admin-login>`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        content.text,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        content.html,
        '',
        `--${boundary}--`,
        '',
    ]

    return lines.join('\r\n')
}

function dotStuffMessage(message: string) {
    return message
        .replace(/\r?\n/g, '\r\n')
        .split('\r\n')
        .map(line => line.startsWith('.') ? `.${line}` : line)
        .join('\r\n')
}

async function resolveSmtpConnectionHost(host: string) {
    if(net.isIP(host)){
        return host
    }

    try {
        const addresses = await dns.promises.resolve4(host)
        const connectionHost = addresses[0]

        if(connectionHost){
            return connectionHost
        }
    }
    catch(err) {
        console.error('SMTP IPv4 lookup failed', getErrorDetails(err))
    }

    return host
}

function openSmtpSocket(smtpConfig: SmtpConfig, connectionHost: string) {
    return new Promise<net.Socket>((resolve, reject) => {
        const socket = smtpConfig.secure
            ? tls.connect({
                host: connectionHost,
                port: smtpConfig.port,
                servername: smtpConfig.host,
            })
            : net.createConnection({
                host: connectionHost,
                port: smtpConfig.port,
            })
        const connectEvent = smtpConfig.secure ? 'secureConnect' : 'connect'
        const cleanup = () => {
            socket.off(connectEvent, handleConnect)
            socket.off('error', handleError)
            socket.off('timeout', handleTimeout)
        }
        const handleConnect = () => {
            cleanup()
            socket.setTimeout(20000, () => {
                socket.destroy(new Error('SMTP socket timed out'))
            })
            resolve(socket)
        }
        const handleError = (err: Error) => {
            cleanup()
            reject(err)
        }
        const handleTimeout = () => {
            cleanup()
            socket.destroy()
            reject(new Error('SMTP connection timed out'))
        }

        socket.once(connectEvent, handleConnect)
        socket.once('error', handleError)
        socket.setTimeout(15000, handleTimeout)
    })
}

function upgradeSocketToTls(socket: net.Socket, host: string) {
    return new Promise<tls.TLSSocket>((resolve, reject) => {
        const tlsSocket = tls.connect({
            socket,
            servername: host,
        })
        const cleanup = () => {
            tlsSocket.off('secureConnect', handleConnect)
            tlsSocket.off('error', handleError)
            tlsSocket.off('timeout', handleTimeout)
        }
        const handleConnect = () => {
            cleanup()
            tlsSocket.setTimeout(20000, () => {
                tlsSocket.destroy(new Error('SMTP socket timed out'))
            })
            resolve(tlsSocket)
        }
        const handleError = (err: Error) => {
            cleanup()
            reject(err)
        }
        const handleTimeout = () => {
            cleanup()
            tlsSocket.destroy()
            reject(new Error('SMTP TLS upgrade timed out'))
        }

        tlsSocket.once('secureConnect', handleConnect)
        tlsSocket.once('error', handleError)
        tlsSocket.setTimeout(15000, handleTimeout)
    })
}

async function expectSmtpReply(reply: SmtpReply, expectedCodes: number[], stage: string, details: Record<string, unknown>) {
    if(expectedCodes.includes(reply.code)){
        return
    }

    throw new MailError('SMTP command failed', stage, {
        ...details,
        responseCode: reply.code,
        response: reply.message,
    })
}

async function smtpCommand(
    socket: net.Socket,
    reader: SmtpReader,
    command: string,
    expectedCodes: number[],
    stage: string,
    details: Record<string, unknown>,
) {
    socket.write(`${command}\r\n`)
    const reply = await reader.readReply(stage)
    await expectSmtpReply(reply, expectedCodes, stage, details)
    return reply
}

async function sendVerificationEmailWithSmtp(smtpConfig: SmtpConfig, to: string, verificationLink: string) {
    const content = buildVerificationEmailContent(verificationLink)
    const message = buildSmtpMessage(smtpConfig.from, to, content)
    const fromAddress = getEnvelopeAddress(smtpConfig.from)
    const toAddress = getEnvelopeAddress(to)
    const connectionHost = await resolveSmtpConnectionHost(smtpConfig.host)
    const details = {
        provider: 'smtp',
        smtpHost: smtpConfig.host,
        smtpConnectionHost: connectionHost,
        smtpPort: smtpConfig.port,
        smtpSecure: smtpConfig.secure,
    }
    let socket: net.Socket | null = null
    let reader: SmtpReader | null = null

    console.log('Sending verification email with SMTP', {
        ...details,
        to,
        from: smtpConfig.from,
        appUrl: process.env.APP_URL,
    })

    try {
        socket = await openSmtpSocket(smtpConfig, connectionHost)
        reader = new SmtpReader(socket)

        await expectSmtpReply(await reader.readReply('connect'), [220], 'connect', details)
        await smtpCommand(socket, reader, `EHLO ${smtpConfig.ehloName}`, [250], 'ehlo', details)

        if(!smtpConfig.secure){
            await smtpCommand(socket, reader, 'STARTTLS', [220], 'starttls', details)
            reader.detach()
            socket = await upgradeSocketToTls(socket, smtpConfig.host)
            reader = new SmtpReader(socket)
            await smtpCommand(socket, reader, `EHLO ${smtpConfig.ehloName}`, [250], 'ehlo', details)
        }

        await smtpCommand(socket, reader, 'AUTH LOGIN', [334], 'auth', details)
        await smtpCommand(socket, reader, Buffer.from(smtpConfig.user).toString('base64'), [334], 'auth', details)
        await smtpCommand(socket, reader, Buffer.from(smtpConfig.pass).toString('base64'), [235], 'auth', details)
        await smtpCommand(socket, reader, `MAIL FROM:<${fromAddress}>`, [250], 'mail-from', details)
        await smtpCommand(socket, reader, `RCPT TO:<${toAddress}>`, [250, 251], 'rcpt-to', details)
        await smtpCommand(socket, reader, 'DATA', [354], 'data', details)

        socket.write(`${dotStuffMessage(message)}\r\n.\r\n`)
        await expectSmtpReply(await reader.readReply('send'), [250], 'send', details)
        await smtpCommand(socket, reader, 'QUIT', [221], 'quit', details).catch(() => undefined)

        console.log('Verification email sent with SMTP', details)
    }
    catch(err) {
        if(err instanceof MailError){
            console.error('SMTP email send failed', err.details)
            throw err
        }

        const errorDetails = {
            ...details,
            ...getErrorDetails(err),
        }

        console.error('SMTP email send failed', errorDetails)
        throw new MailError('SMTP email send failed', 'send', errorDetails)
    }
    finally {
        reader?.detach()
        socket?.end()
    }
}

async function readEmailResponse(response: Response): Promise<EmailResponseBody> {
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
    const content = buildVerificationEmailContent(verificationLink)
    const payload = {
        from: resendConfig.from,
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
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

    const responseBody = await readEmailResponse(response)

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
    const provider = getMailProvider()
    const verificationLink = buildVerificationLink(token)

    if(provider === 'resend'){
        await sendVerificationEmailWithResend(getResendConfig(), to, verificationLink)
        return
    }

    await sendVerificationEmailWithSmtp(getSmtpConfig(), to, verificationLink)
}
