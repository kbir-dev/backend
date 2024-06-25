import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import dotenv from "dotenv"
dotenv.config()

const app = express()
app.use(cors({
    origin: process.env.CROSS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"})); //For JSON Data
app.use(express.urlencoded({extended: true,limit : "16kb"})); //For URL decoding [%20 or ?= Sometimes it get error i.e why we used this]
app.use(express.static("public")) //For serving public files
app.use(cookieParser())

//Importing Routes
import userRouter from "./routes/users.routes.js"

//Declaring Routes 
app.use("/api/v1/users",userRouter)

export {app};