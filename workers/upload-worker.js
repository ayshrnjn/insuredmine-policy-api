const fs = require('fs');
const { parentPort, workerData } = require('worker_threads');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const xlsx = require('xlsx');

const Agent = require('../models/Agent');
const Carrier = require('../models/Carrier');
const LOB = require('../models/LOB');
const Policy = require('../models/Policy');
const User = require('../models/User');
const UserAccount = require('../models/UserAccount');

const text = (value) => String(value ?? '').trim();

const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const mapRow = (row) => {
  const mapped = {
    agentName: text(row.agent),
    firstName: text(row.firstname),
    dob: parseDate(row.dob),
    address: text(row.address),
    phoneNumber: text(row.phone),
    state: text(row.state),
    zipCode: text(row.zip),
    email: text(row.email).toLowerCase(),
    gender: text(row.gender),
    userType: text(row.userType),
    accountName: text(row.account_name),
    categoryName: text(row.category_name),
    companyName: text(row.company_name),
    policyNumber: text(row.policy_number),
    policyStartDate: parseDate(row.policy_start_date),
    policyEndDate: parseDate(row.policy_end_date),
  };

  const required = [
    mapped.agentName,
    mapped.firstName,
    mapped.email,
    mapped.accountName,
    mapped.categoryName,
    mapped.companyName,
    mapped.policyNumber,
    mapped.policyStartDate,
    mapped.policyEndDate,
  ];

  return required.every(Boolean) ? mapped : null;
};

const uniqueBy = (items, getKey) => [
  ...new Map(items.map((item) => [getKey(item), item])).values(),
];

const readRows = async () => {
  if (workerData.fileType === 'csv') {
    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(workerData.filePath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });
    return rows;
  }

  const workbook = xlsx.readFile(workerData.filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
};

const upsertSimpleCollection = async (Model, items, field) => {
  const uniqueItems = uniqueBy(items, (item) => item[field]);
  if (!uniqueItems.length) return;

  await Model.bulkWrite(
    uniqueItems.map((item) => ({
      updateOne: {
        filter: { [field]: item[field] },
        update: { $set: item },
        upsert: true,
      },
    })),
  );
};

const runImport = async () => {
  await mongoose.connect(workerData.mongoUri, { dbName: workerData.dbName });

  const inputRows = await readRows();
  const rows = inputRows.map(mapRow).filter(Boolean);
  if (!rows.length) throw new Error('No valid rows found in the uploaded file');

  await Promise.all([
    upsertSimpleCollection(
      Agent,
      rows.map((row) => ({ agentName: row.agentName })),
      'agentName',
    ),
    upsertSimpleCollection(
      LOB,
      rows.map((row) => ({ categoryName: row.categoryName })),
      'categoryName',
    ),
    upsertSimpleCollection(
      Carrier,
      rows.map((row) => ({ companyName: row.companyName })),
      'companyName',
    ),
    upsertSimpleCollection(
      User,
      rows.map((row) => ({
        firstName: row.firstName,
        dob: row.dob,
        address: row.address,
        phoneNumber: row.phoneNumber,
        state: row.state,
        zipCode: row.zipCode,
        email: row.email,
        gender: row.gender,
        userType: row.userType,
      })),
      'email',
    ),
  ]);

  const [users, lobs, carriers] = await Promise.all([
    User.find({ email: { $in: rows.map((row) => row.email) } }).lean(),
    LOB.find({ categoryName: { $in: rows.map((row) => row.categoryName) } }).lean(),
    Carrier.find({ companyName: { $in: rows.map((row) => row.companyName) } }).lean(),
  ]);

  const userIds = new Map(users.map((user) => [user.email, user._id]));
  const lobIds = new Map(lobs.map((lob) => [lob.categoryName, lob._id]));
  const carrierIds = new Map(carriers.map((carrier) => [carrier.companyName, carrier._id]));

  const accounts = uniqueBy(
    rows.map((row) => ({ accountName: row.accountName, userId: userIds.get(row.email) })),
    (account) => `${account.accountName}:${account.userId}`,
  );

  await UserAccount.bulkWrite(
    accounts.map((account) => ({
      updateOne: {
        filter: { accountName: account.accountName, userId: account.userId },
        update: { $set: account },
        upsert: true,
      },
    })),
  );

  await Policy.bulkWrite(
    rows.map((row) => ({
      updateOne: {
        filter: { policyNumber: row.policyNumber },
        update: {
          $set: {
            policyNumber: row.policyNumber,
            policyStartDate: row.policyStartDate,
            policyEndDate: row.policyEndDate,
            categoryId: lobIds.get(row.categoryName),
            companyId: carrierIds.get(row.companyName),
            userId: userIds.get(row.email),
          },
        },
        upsert: true,
      },
    })),
  );

  return {
    totalRows: inputRows.length,
    importedRows: rows.length,
    skippedRows: inputRows.length - rows.length,
  };
};

runImport()
  .then((result) => parentPort.postMessage({ success: true, result }))
  .catch((error) => parentPort.postMessage({ success: false, error: error.message }))
  .finally(() => mongoose.disconnect().catch(() => {}));
