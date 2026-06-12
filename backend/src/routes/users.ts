import { Router } from "express";
import db from "../db/database";
import authMiddleware from "../middleware/auth";
const usersRouter = Router();

interface UsersList {
    id: number,
    name: string,
    email: string,
    status: 'unverified' | 'active' | 'blocked',
    last_login_at: string | null,
    created_at: string,
}

usersRouter.get('/', authMiddleware, (req, res) => {
    try{
        const getUsers = db.prepare('SELECT id, name, email, status, last_login_at, created_at FROM users ORDER BY last_login_at DESC, created_at DESC;');
        const resultDB = getUsers.all() as UsersList[];
        return res.status(200).json(resultDB);
    }
    catch(err){
        return res.status(500).send('Server Error');
    }
})

usersRouter.post('/block', authMiddleware, (req, res) => {
    try{
        const ids:unknown = req.body.ids;
        if(!Array.isArray(ids) || ids.length === 0){
            return res.status(400).send('No users selected');
        }
        for(let num of ids){
            if(typeof num !== 'number' || num<= 0 || !Number.isInteger(num)){
                return res.status(400).send('Bad id');
            }
        }
        const userIds = ids as number[];
        const placeholders = userIds.map(() => '?').join(', ');
        const blockUsers = db.prepare(`UPDATE users SET status ='blocked' WHERE id IN (${placeholders})`);
        const updateResults = blockUsers.run(...userIds);
        return res.status(200).json({message:"Users blocked successfully", affectedRows:updateResults.changes});
    }
    catch(err){
        return res.status(500).send('Server Error');
    }
})

export default usersRouter;