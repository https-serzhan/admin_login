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

function getUsersIdValidated(val : unknown): number[] | null{
    if(!Array.isArray(val) || val.length === 0){
        return null;
    }
    for(let num of val){
        if(typeof num !== 'number' || num<= 0 || !Number.isInteger(num)){
            return null;
        }
    }
    return val;
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
        const ids: number[] | null = getUsersIdValidated(req.body.ids);
        if(!ids){
            return res.status(400).send('Invalid user ids');
        }
        const placeholders = ids.map(() => '?').join(', ');
        const blockUsers = db.prepare(`UPDATE users SET status ='blocked' WHERE id IN (${placeholders})`);
        const updateResults = blockUsers.run(...ids);
        return res.status(200).json({message:"Users blocked successfully", affectedRows:updateResults.changes});
    }
    catch(err){
        return res.status(500).send('Server Error');
    }
})

usersRouter.post('/unblock', authMiddleware, (req, res) => {
    try{
        const ids: number[] | null = getUsersIdValidated(req.body.ids);
        if(!ids){
            return res.status(400).send('Invalid user ids');
        }
        const placeholders = ids.map(() => '?').join(', ');
        const unblockUsers = db.prepare(`UPDATE users SET status ='active' WHERE id IN (${placeholders})`);
        const updateResults = unblockUsers.run(...ids);
        return res.status(200).json({message:"Users unblocked successfully", affectedRows:updateResults.changes});
    }
    catch(err){
        return res.status(500).send('Server Error');
    }
})

usersRouter.delete('/', authMiddleware, (req, res) => {
    try{
        const ids: number[] | null = getUsersIdValidated(req.body.ids);
        if(!ids){
            return res.status(400).send('Invalid user ids');
        }
        const placeholders = ids.map(() => '?').join(', ');
        const deleteUsers = db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`);
        const deleteResults = deleteUsers.run(...ids);
        return res.status(200).json({message:"Users deleted successfully", affectedRows:deleteResults.changes});
    }
    catch(err){
        return res.status(500).send('Server Error');
    }
})

usersRouter.delete('/unverified', authMiddleware, (req, res) => {
    try{
        const deleteUsers = db.prepare(`DELETE FROM users WHERE status = 'unverified'`);
        const deleteResults = deleteUsers.run();
        return res.status(200).json({message:"Unverified users deleted successfully", affectedRows:deleteResults.changes});
    }
    catch(err){
        return res.status(500).send('Server Error');
    }
})

export default usersRouter;