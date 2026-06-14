import type { AuthResponse, User } from './types'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '')

type ApiOptions = RequestInit & {
    body?: BodyInit | null,
}

type ActionResponse = {
    message: string
    affectedRows: number
}

export class ApiError extends Error {
    status : number

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
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
        const message =
            typeof data === 'string'
                ? data
                : data && typeof data === 'object' && 'message' in data
                    ? String(data.message)
                    : 'Request failed'

        throw new ApiError(response.status, message)
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





