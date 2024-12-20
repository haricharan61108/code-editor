import express from 'express';
import bodyParser from 'body-parser';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const redisClient = createClient();
const SECRET_KEY = process.env.SECRET_KEY; // Get secret key from environment
const PORT = process.env.PORT || 3000; // Get port from environment, default to 3000

app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

redisClient.on('error', (err) => console.error('Redis error:', err));

app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      }
    });
    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/signin', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });
      res.status(200).json({ message: 'Signin successful', token });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Failed to authenticate token' });
    req.userId = decoded.userId;
    next();
  });
};

app.post('/submit', authenticateToken, async (req, res) => {
  const { code, input } = req.body;
  const jobId = uuidv4();

  await prisma.job.create({
    data: {
      id: jobId,
      code: code,
      input: input
    }
  });

  redisClient.rPush('codeQueue', JSON.stringify({ jobId, code, input }));

  res.status(200).json({ jobId });
});

app.get('/result/:jobId', async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.jobId }
  });

  if (job) {
    res.status(200).json({ stdout: job.stdout, stderr: job.stderr });
  } else {
    res.status(404).json({ error: 'Job not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});

redisClient.connect();
