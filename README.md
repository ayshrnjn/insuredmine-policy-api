# Insurance Policy API

A simple fresher-level Node.js assessment project using Express, MongoDB, Mongoose, and worker threads.

## Features

- Upload CSV or XLSX policy data using a worker thread.
- Store data in separate Agent, User, User Account, LOB, Carrier, and Policy collections.
- Search policy information using the user's first name.
- Get policy details aggregated for every user.
- Re-uploading the same sheet updates records instead of creating policy duplicates.

