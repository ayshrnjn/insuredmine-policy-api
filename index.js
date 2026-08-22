require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');

require('./models/Carrier');
require('./models/LOB');
const Policy = require('./models/Policy');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'insuredmine';

app.use(cors());
app.use(express.json());

const uploadsDirectory = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDirectory, { recursive: true });

const upload = multer({
  dest: uploadsDirectory,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (extension !== '.csv' && extension !== '.xlsx') {
      return callback(new Error('Only CSV and XLSX files are allowed'));
    }
    return callback(null, true);
  },
});

const removeFile = (filePath) => fs.unlink(filePath, () => {});
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

app.get('/health', (_request, response) => {
  response.json({ message: 'API is running' });
});

app.post('/api/upload', upload.single('file'), (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'Please upload a file' });

  const fileType = path.extname(request.file.originalname).toLowerCase() === '.csv' ? 'csv' : 'xlsx';
  const worker = new Worker(path.join(__dirname, 'workers', 'upload-worker.js'), {
    workerData: {
      filePath: request.file.path,
      fileType,
      mongoUri: MONGO_URI,
      dbName: MONGO_DB_NAME,
    },
  });

  worker.once('message', (message) => {
    removeFile(request.file.path);
    if (!message.success) return response.status(500).json({ error: message.error });
    return response.json({ message: 'Data imported successfully', ...message.result });
  });

  worker.once('error', (error) => {
    removeFile(request.file.path);
    return response.status(500).json({ error: error.message });
  });
});

app.get('/api/policies/search', async (request, response) => {
  try {
    const username = String(request.query.username || '').trim();
    if (!username) return response.status(400).json({ error: 'Username is required' });

    const users = await User.find({
      firstName: { $regex: new RegExp(escapeRegex(username), 'i') },
    });

    const policies = await Policy.find({ userId: { $in: users.map((user) => user._id) } })
      .populate('userId')
      .populate('categoryId', 'categoryName')
      .populate('companyId', 'companyName');

    return response.json(policies);
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
});

app.get('/api/policies/aggregated', async (_request, response) => {
  try {
    const result = await User.aggregate([
      {
        $lookup: {
          from: 'policies',
          localField: '_id',
          foreignField: 'userId',
          as: 'policies',
        },
      },
      {
        $project: {
          firstName: 1,
          email: 1,
          policyCount: { $size: '$policies' },
          policies: {
            $map: {
              input: '$policies',
              as: 'policy',
              in: {
                policyNumber: '$$policy.policyNumber',
                policyStartDate: '$$policy.policyStartDate',
                policyEndDate: '$$policy.policyEndDate',
              },
            },
          },
        },
      },
      { $sort: { policyCount: -1 } },
    ]);

    return response.json(result);
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
});

app.use((error, _request, response, _next) => {
  response.status(400).json({ error: error.message });
});

const startServer = async () => {
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB_NAME });
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
};

if (require.main === module) {
  startServer().catch((error) => console.error('MongoDB connection failed:', error.message));
}

module.exports = app;
