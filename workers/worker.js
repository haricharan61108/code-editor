import { createClient } from 'redis';
import { exec } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';

const redisClient = createClient();
const execPromise = promisify(exec);
const prisma = new PrismaClient();

redisClient.on('error', (err) => console.error('Redis error:', err));

const removeFileIfExists = async (path) => {
  try {
    if (fs.existsSync(path)) {
      await fs.promises.unlink(path);
    }
  } catch (err) {
    console.error(`Error deleting file ${path}:`, err);
  }
};

const processJob = async (job) => {
  const { jobId, code, input } = job;
  console.log(`Processing job with ID: ${jobId}`);
  const filePath = `/tmp/${jobId}.cpp`;

  fs.writeFileSync(filePath, code);

  try {
    const command = `g++ -Wall ${filePath} -o /tmp/${jobId} && echo "${input}" | /tmp/${jobId}`;
    const { stdout, stderr } = await execPromise(command);

    await prisma.job.update({
      where: { id: jobId },
      data: { stdout: stdout || '', stderr: stderr || '' },
    });
  } catch (error) {
    await prisma.job.update({
      where: { id: jobId },
      data: { stderr: error.message },
    });
  } finally {
    await removeFileIfExists(filePath);
    await removeFileIfExists(`/tmp/${jobId}`);
  }
};

const pollQueue = async () => {
  while (true) {
    try {
      const jobData = await redisClient.brPop('codeQueue', 0);
      if (!jobData || !jobData.element) {
        console.error('Invalid job data received:', jobData);
        continue;
      }

      const job = JSON.parse(jobData.element);
      await processJob(job);
    } catch (error) {
      console.error('Error processing job:', error);
    }
  }
};

const startWorker = async () => {
  try {
    await redisClient.connect();
    pollQueue();
  } catch (error) {
    console.error('Error connecting to Redis:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  console.log('Received SIGINT. Gracefully shutting down...');
  redisClient.quit().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Gracefully shutting down...');
  redisClient.quit().then(() => process.exit(0));
});

startWorker();
