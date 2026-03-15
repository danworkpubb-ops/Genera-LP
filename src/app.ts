import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.options('*', cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

export default app;
