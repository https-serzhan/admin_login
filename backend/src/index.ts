import express from "express";
import cors from "cors";
import './db/database'
import 'dotenv/config'
import authRouter from './routes/auth';
import usersRouter from "./routes/users";
const app = express()

app.use(cors({
    origin: process.env.FRONTEND_URL
}))
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)



app.listen(3001, () => {
    console.log("Server is running on port 3001")
})