import {NextFunction, Request, Response} from "express";
import jwt from "jsonwebtoken";
import db from "../db/database";

interface AuthTokenPayload{
    id: number,
    email: string,
}

type UserDB = {
    id: number,
    name: string,
    email: string,
    status: 'unverified' | 'active' | 'blocked'
}

function getJwtSecret() {
    const secret = process.env.JWT_SECRET
    if (!secret) {
        throw new Error('JWT_SECRET is required')
    }
    return secret
}

function authMiddleware(req: Request, res: Response, next: NextFunction){
    try{
        const authHeader = req.headers['authorization'];
        if(!authHeader){
            return res.status(401).send('No header for authorization');
        }
        const token = authHeader.split(' ')[1];
        if(!token){
            return res.status(401).send('Token is missing');
        }
        const decodedToken = jwt.verify(token, getJwtSecret())
        const authPayload = decodedToken as AuthTokenPayload;
        const userId = authPayload.id;
        if(typeof userId !== 'number' || userId <= 0){
            return res.status(401).send('User Id is missing');
        }
        const getUser = db.prepare('select id, name, email, status from users where id=?');
        const resultDb = getUser.get(userId) as UserDB | undefined;
        if(!resultDb){
            return res.status(401).send('Account no longer exists');
        }
        if(resultDb.status === 'blocked'){
            return res.status(403).send('Account is blocked');
        }
        (req as any).user = resultDb;
        next();
    }
    catch(err){
        return res.status(401).send('Unauthorized');
    }
}

export default authMiddleware
