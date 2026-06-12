import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { hash } from 'bcrypt'
import db from "../db/database";
import crypto from "crypto";
interface User {
    name: string,
    email: string,
    password_hash: string,
    email_token: string,
}

const authRouter = Router()

authRouter.post('/register', async (req: Request, res: Response) => {
    try{
        const { name, email, password } = req.body
        if (!name || !email || !password) {
            return res.status(400).send('All fields are required')
        }
        const password_hash = await hash(password, 10);
        const newUser: User = {
            name,
            email,
            password_hash,
            email_token: crypto.randomBytes(16).toString('hex'),
        }
        const insertUser = db.prepare<User>
        (`insert into users (name, email, password_hash, email_token) 
            values (@name , @email, @password_hash, @email_token )`);
        const result = insertUser.run(newUser)
        const token = jwt.sign({id: result.lastInsertRowid, email},
            process.env.JWT_SECRET || 'fallback_secret', {expiresIn: '24h'})
        return res.status(200).json(token)
    }
    catch(err: any){
        console.error(err)
        if(err.message.includes('UNIQUE constraint failed: users.email')){
            return res.status(409).send('User already exists')
        }
        return res.status(500).send('Server Error')
    }

})

export default authRouter;