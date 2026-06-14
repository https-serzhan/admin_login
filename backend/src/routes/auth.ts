import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import {compare, hash} from 'bcrypt'
import db from "../db/database";
import crypto from "crypto";
import {buildVerificationLink, sendVerificationEmail} from '../services/mail'

type UserStatus = 'unverified' | 'active' | 'blocked'
interface InsertUser {
    name: string,
    email: string,
    password_hash: string,
    email_token: string,
}

interface AuthTokenPayload{
    id: number,
    email: string,
}

interface DBUser {
    id: number,
    name: string,
    email: string,
    password_hash: string,
    status: UserStatus,
    created_at: string,
    last_login_at: string | null,
    email_token: string | null,
}

interface AuthResponseUser {
    id: number,
    name: string,
    email: string,
    status: UserStatus,
    last_login_at: string | null,
}

interface AuthResponse {
    token: string,
    user: AuthResponseUser
    verificationEmailSent?: boolean
    verificationLink?: string
}

const authRouter = Router()

function getJwtSecret() {
    const secret = process.env.JWT_SECRET
    if (!secret) {
        throw new Error('JWT_SECRET is required')
    }
    return secret
}

function buildAuthResponse(user: AuthResponseUser): AuthResponse {
    const authTokenPayload: AuthTokenPayload = {
        id: user.id,
        email: user.email
    }

    return {
        token: jwt.sign(authTokenPayload, getJwtSecret(), {expiresIn: '24h'}),
        user,
    }
}

async function trySendVerificationEmail(email: string, token: string) {
    try {
        await sendVerificationEmail(email, token)
        return {
            verificationEmailSent: true,
        }
    }
    catch(err) {
        console.error('Failed to send verification email:', err)
        return {
            verificationEmailSent: false,
            verificationLink: buildVerificationLink(token),
        }
    }
}

authRouter.post('/register', async (req: Request, res: Response) => {
    try{
        const { name, email, password } = req.body
        if (!name || !email || !password) {
            return res.status(400).send('All fields are required')
        }
        const password_hash = await hash(password, 10);
        const newUser: InsertUser = {
            name,
            email,
            password_hash,
            email_token: crypto.randomBytes(16).toString('hex'),
        }
        const insertUser = db.prepare<InsertUser>
        (`insert into users (name, email, password_hash, email_token) 
            values (@name , @email, @password_hash, @email_token )`);
        const result = insertUser.run(newUser)
        const registeredUserId = Number(result.lastInsertRowid);
        const user: AuthResponseUser = {
            id: registeredUserId,
            name,
            email,
            status: 'unverified',
            last_login_at: null,
        }
        const emailResult = await trySendVerificationEmail(email, newUser.email_token)
        return res.status(200).json({
            ...buildAuthResponse(user),
            ...emailResult,
        })
    }
    catch(err: any){
        console.error(err)
        if(err.message.includes('UNIQUE constraint failed: users.email')){
            const { name, email, password } = req.body
            const getUser = db.prepare(`select * from users where email=?`)
            const existingUser = getUser.get(email) as DBUser | undefined

            if(!existingUser){
                return res.status(409).send('User already exists')
            }
            if(existingUser.status === 'active'){
                return res.status(409).send('User already exists')
            }
            if(existingUser.status === 'blocked'){
                return res.status(403).send('Account is blocked')
            }

            const emailToken = crypto.randomBytes(16).toString('hex')
            const passwordHash = await hash(password, 10)
            const updateUser = db.prepare(`update users set name = ?, password_hash = ?, email_token = ? where id = ?`)
            updateUser.run(name, passwordHash, emailToken, existingUser.id)

            const user: AuthResponseUser = {
                id: existingUser.id,
                name,
                email,
                status: 'unverified',
                last_login_at: existingUser.last_login_at,
            }

            const emailResult = await trySendVerificationEmail(email, emailToken)
            return res.status(200).json({
                ...buildAuthResponse(user),
                ...emailResult,
            })
        }
        return res.status(500).send('Server Error')
    }

})

authRouter.post('/login', async (req: Request, res: Response) => {
    try{
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).send('All fields are required')
        }
        const getUser = db.prepare<DBUser>
        (`select * from users where email=?`)
        const result = getUser.get(email) as DBUser | undefined;
        if(!result){
            return res.status(404).send('User does not exist')
        }
        if(result.status === 'blocked'){
            return res.status(403).send('Account is blocked')
        }
        if(!(await compare(password, result.password_hash))){
            return res.status(401).send('Password or email is wrong')
        }
        const currentLoginTime = new Date().toISOString()
        const updateUser =
            db.prepare(`update users set last_login_at = ? where id = ?`)
        updateUser.run(currentLoginTime,result.id);
        const user: AuthResponseUser = {
            id: result.id,
            name: result.name,
            email: result.email,
            status: result.status,
            last_login_at: currentLoginTime,
        };
        const authTokenPayload: AuthTokenPayload = {id: result.id, email: result.email};
        const authResponse: AuthResponse = {
            token: jwt.sign(authTokenPayload, getJwtSecret(), {expiresIn: '24h'}),
            user,
        }
        return res.status(200).json(authResponse);
    }
    catch(err){
        console.error(err)
        return res.status(500).send('Server Error')
    }
})

authRouter.get('/verify-email/:token', (req: Request, res: Response) => {
    try {
        const token = req.params.token;
        if (!token) {
            return res.status(400).send('All fields are required')
        }
        const findUser = db.prepare(`select * from users where email_token=?`);
        const result = findUser.get(token) as DBUser | undefined;
        if(!result){
            return res.status(400).send('Invalid verification token')
        }
        if(result.status === 'blocked'){
            return res.status(403).send('Account is blocked')
        }
        const activateUser = db.prepare(`update users set status = 'active', email_token = NULL where id=?`);
        activateUser.run(result.id)
        return res.status(200).json({message: "Email verified successfully"});
    }
    catch(err){
        console.log(err)
        return res.status(500).send('Server Error')
    }
})

export default authRouter;
