import express from "express";
import cors from "cors";
import 'dotenv/config'
import './db/database'
import authRouter from './routes/auth';
import usersRouter from "./routes/users";
const app = express()
const port = Number(process.env.PORT) || 3001
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true)
        }
        return callback(new Error('Not allowed by CORS'))
    }
}))
app.use(express.json())
app.get('/api/health', (_req, res) => {
    res.status(200).json({status: 'ok'})
})
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)



app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})
