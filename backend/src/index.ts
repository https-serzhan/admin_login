import express from "express";
import cors from "cors";
import './db/database'
import 'dotenv/config'
import authRouter from './routes/auth';
const app = express()

app.use(cors({
    origin: 'http://localhost:5173',
}))
app.use(express.json())
app.use('/api/auth', authRouter)

// app.get("/", (req, res) => {
//
// })



app.listen(3001, () => {
    console.log("Server is running on port 3001")
})