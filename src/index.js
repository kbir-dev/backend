import dotenv from "dotenv"
import connectDB  from "../src/db/index.js"
dotenv.config()

connectDB()
