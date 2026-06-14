import type { AuthResponse, User } from './types'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '')

type ApiOptions = RequestInit & {
    body?: BodyInit | null,
}

type ActionResponse = {
    message: string
    affectedRows: number
}

type MessageResponse = {
    message: string
}

export class ApiError extends Error {
    status : number
    details: unknown

    constructor(status: number, message: string, details?: unknown) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

function getApiErrorMessage(data: unknown) {
    if(typeof data === 'string'){
        return data
    }
    if(data && typeof data === 'object' && 'message' in data){
        const errorData = data as {message: unknown, stage?: unknown, details?: unknown}
        const details = errorData.details && typeof errorData.details === 'object'
            ? errorData.details as {message?: unknown, response?: unknown, code?: unknown, responseCode?: unknown}
            : null
        const detailMessage = details?.response || details?.message || details?.code || details?.responseCode

        return [errorData.message, errorData.stage && `stage: ${errorData.stage}`, detailMessage]
            .filter(Boolean)
            .map(String)
            .join(' | ')
    }

    return 'Request failed'
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const token = localStorage.getItem('token');
    const headers = new Headers(options.headers);

    if(!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json')
    }
    if(token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    })

    const contentType = response.headers.get('content-type')
    const isJson = contentType?.includes('application/json')

    const data = isJson ? await response.json() : await response.text();

    if(!response.ok) {
        if(response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
        throw new ApiError(response.status, getApiErrorMessage(data), data)
    }
    return data as T
}

export function login(email: string, password: string) {
    return apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    })
}

export function register(name: string, email: string, password: string) {
    return apiRequest<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
    })
}

export function resendVerificationEmail() {
    return apiRequest<MessageResponse>('/auth/resend-verification', {
        method: 'POST',
    })
}

export function getUsers() {
    return apiRequest<User[]>('/users')
}

export function blockUsers(ids: number[]) {
    return apiRequest<ActionResponse>('/users/block', {
        method: 'POST',
        body: JSON.stringify({ ids }),
    })
}
export function unblockUsers(ids: number[]) {
    return apiRequest<ActionResponse>('/users/unblock', {
        method: 'POST',
        body: JSON.stringify({ ids }),
    })
}

export function deleteUsers(ids: number[]) {
    return apiRequest<ActionResponse>('/users', {
        method: 'DELETE',
        body: JSON.stringify({ ids }),
    })
}

export function deleteUnverifiedUsers() {
    return apiRequest<ActionResponse>('/users/unverified', {
        method: 'DELETE',
    })
}



