const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const projectsFile = path.join(__dirname, 'projects.csv');
const transactionsFile = path.join(__dirname, 'transactions.csv');

// Read projects list
function readProjects() {
  return new Promise((resolve, reject) => {
    const projects = [];
    fs.createReadStream(projectsFile)
      .pipe(csv())
      .on('data', row => projects.push({ id: Number(row.id), name: row.name }))
      .on('end', () => resolve(projects))
      .on('error', reject);
  });
}

// Read all transactions
function readTransactions() {
  return new Promise((resolve, reject) => {
    const transactions = [];
    if (!fs.existsSync(transactionsFile)) return resolve([]);
    fs.createReadStream(transactionsFile)
      .pipe(csv())
      .on('data', row => transactions.push({
        id: Number(row.id),
        projectId: Number(row.projectId),
        type: row.type,
        amount: Number(row.amount),
        description: row.description,
        user: row.user,
        timestamp: row.timestamp
      }))
      .on('end', () => resolve(transactions))
      .on('error', reject);
  });
}

// Save new transaction
async function addTransaction(entry) {
  const exists = fs.existsSync(transactionsFile);
  const csvWriter = createObjectCsvWriter({
    path: transactionsFile,
    header: [
      { id: 'id', title: 'id' },
      { id: 'projectId', title: 'projectId' },
      { id: 'type', title: 'type' },
      { id: 'amount', title: 'amount' },
      { id: 'description', title: 'description' },
      { id: 'user', title: 'user' },
      { id: 'timestamp', title: 'timestamp' },
    ],
    append: exists
  });
  const id = Date.now();
  await csvWriter.writeRecords([{ ...entry, id }]);
}

app.get('/projects', async (req, res) => {
  try {
    const projects = await readProjects();
    const transactions = await readTransactions();

    const projectsWithTotals = projects.map(project => {
      const logs = transactions.filter(t => t.projectId === project.id);
      const spent = logs.filter(t => t.type === 'spent').reduce((a,b) => a + b.amount, 0);
      const received = logs.filter(t => t.type === 'received').reduce((a,b) => a + b.amount, 0);
      return {...project, spent, received};
    });

    res.json(projectsWithTotals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/transactions', async (req, res) => {
  try {
    const { projectId, user, type, from, to } = req.query;
    let transactions = await readTransactions();

    if (projectId) {
      transactions = transactions.filter(t => t.projectId === Number(projectId));
    }
    if (user) {
      transactions = transactions.filter(t => t.user.toLowerCase().includes(user.toLowerCase()));
    }
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }
    if (from) {
      const fromDate = new Date(from);
      transactions = transactions.filter(t => new Date(t.timestamp) >= fromDate);
    }
    if (to) {
      const toDate = new Date(to);
      transactions = transactions.filter(t => new Date(t.timestamp) <= toDate);
    }
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/transactions', async (req, res) => {
  try {
    const { projectId, type, amount, description, user } = req.body;
    if (!projectId || !type || !amount || !description || !user) {
      return res.status(400).json({ message: 'Missing fields' });
    }
    const entry = {
      projectId: Number(projectId),
      type,
      amount: Number(amount),
      description,
      user,
      timestamp: new Date().toISOString()
    };
    await addTransaction(entry);
    res.status(201).json({ message: 'Transaction recorded' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
