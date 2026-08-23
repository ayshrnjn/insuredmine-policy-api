# Insurance Policy API

A simple fresher-level Node.js assessment project using Express, MongoDB, Mongoose, and worker threads.

## Features

- Upload CSV or XLSX policy data using a worker thread.
- Store data in separate Agent, User, User Account, LOB, Carrier, and Policy collections.
- Search policy information using the user's first name.
- Get policy details aggregated for every user.
- Re-uploading the same sheet updates records instead of creating policy duplicates.


## Environment variables

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB_NAME=insuredmine
```

## APIs

### Upload CSV/XLSX

```http
POST /api/upload
```

Send the file as `multipart/form-data` using the field name `file`.

```bash
curl -X POST http://localhost:3000/api/upload -F "file=@data-sheet.csv"
```

### Search policies by username

The supplied sheet does not have a separate username column, so `username` searches the `firstname` column.

```http
GET /api/policies/search?username=Lura
```

### Aggregate policies by user

```http
GET /api/policies/aggregated
```

### Health check

```http
GET /health
```

## Project structure

```text
index.js                 Express app and APIs
models/                  Six MongoDB collection models
workers/upload-worker.js CSV/XLSX import worker
```
