export type UserStatus = 'unverified' | 'active' | 'blocked'

export type User = {
    id: number,
    name: string,
    email: string,
    status: UserStatus,
    last_login_at: string | null,
    created_at: string,
}

export type AuthResponseUser = {
    id: number,
    name: string,
    email: string,
    status: UserStatus,
    last_login_at: string | null,
}

export type AuthResponse = {
    token: string,
    user: AuthResponseUser
}
