document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const tabs = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.tab');

  const projectSelect = document.getElementById("projectSelect");
  const transactionProjectName = document.getElementById("transactionProjectName");
  const filterUser = document.getElementById("filterUser");
  const filterType = document.getElementById("filterType");
  const filterFrom = document.getElementById("filterFrom");
  const filterTo = document.getElementById("filterTo");
  const applyBtn = document.getElementById("applyFiltersBtn");
  const clearBtn = document.getElementById("clearFiltersBtn");
  const exportBtn = document.getElementById("exportCsvBtn");
  const transactionsTable = document.getElementById("transactionsTable");

  const addTransactionForm = document.getElementById("addTransactionForm");
  const addProjectSelect = document.getElementById("addProject");
  const addTypeSelect = document.getElementById("addType");
  const addAmountInput = document.getElementById("addAmount");
  const addDescriptionInput = document.getElementById("addDescription");
  const addUserInput = document.getElementById("addUser");

  const costChartCanvas = document.getElementById("costChart").getContext('2d');

  let projects = [];
  let transactions = [];
  let currentProjectId = null;
  let costChart;

  // === Tab Navigation ===
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      // Activate button
      tabs.forEach(t => t.classList.toggle('active', t === btn));
      // Show section
      sections.forEach(sec => sec.classList.toggle('active', sec.id === target));
      // Load content for active tab
      if (target === "dashboardTab") {
        loadDashboard();
      } else if (target === "transactionsTab") {
        loadProjectsForTransactions();
      }
    });
  });

  // === Load Projects ===
  async function loadProjects() {
    const res = await fetch('/projects');
    projects = await res.json();
    return projects;
  }

  // === Load Dashboard ===
  async function loadDashboard() {
    await loadProjects();
    if (costChart) costChart.destroy();

    const labels = projects.map(p => p.name);
    const spent = projects.map(p => p.spent);
    const received = projects.map(p => p.received);

    costChart = new Chart(costChartCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Spent',
            data: spent,
            backgroundColor: 'rgba(220,38,38,0.7)', // red
          },
          {
            label: 'Received',
            data: received,
            backgroundColor: 'rgba(34,197,94,0.7)', // green
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  // === Load Projects for Transactions Tab ===
  async function loadProjectsForTransactions() {
    await loadProjects();
    projectSelect.innerHTML = projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    addProjectSelect.innerHTML = projectSelect.innerHTML;

    if (!currentProjectId) currentProjectId = projects[0]?.id;
    projectSelect.value = currentProjectId;
    addProjectSelect.value = currentProjectId;
    transactionProjectName.textContent = projects.find(p => p.id == currentProjectId)?.name || '';
    loadTransactions();
  }

  // === Load Transactions with Filters ===
  async function loadTransactions() {
    if (!currentProjectId) return;

    const params = new URLSearchParams();
    params.append('projectId', currentProjectId);

    if (filterUser.value.trim()) params.append('user', filterUser.value.trim());
    if (filterType.value) params.append('type', filterType.value);
    if (filterFrom.value) params.append('from', filterFrom.value);
    if (filterTo.value) params.append('to', filterTo.value);

    try {
      const res = await fetch('/transactions?' + params.toString());
      transactions = await res.json();
      renderTransactions();
    } catch (err) {
      console.error('Failed to load transactions', err);
    }
  }

  // === Render Transactions Table ===
  function renderTransactions() {
    if (!transactions.length) {
      transactionsTable.innerHTML = `<tbody><tr><td colspan="6" style="text-align:center;">No transactions found</td></tr></tbody>`;
      return;
    }

    transactionsTable.innerHTML = `
      <thead>
        <tr>
          <th>ID</th>
          <th>Type</th>
          <th>Amount</th>
          <th>Description</th>
          <th>User</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${transactions.map(t => `
          <tr>
            <td>${t.id}</td>
            <td class="type-${t.type}">${t.type}</td>
            <td>$${t.amount.toFixed(2)}</td>
            <td>${t.description}</td>
            <td>${t.user}</td>
            <td>${new Date(t.timestamp).toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
  }

  // === Event Listeners ===

  // Change project in transactions tab
  projectSelect.addEventListener('change', () => {
    currentProjectId = projectSelect.value;
    transactionProjectName.textContent = projectSelect.options[projectSelect.selectedIndex].text;
    loadTransactions();
  });

  // Apply filters
  applyBtn.addEventListener('click', loadTransactions);

  // Clear filters
  clearBtn.addEventListener('click', () => {
    filterUser.value = '';
    filterType.value = '';
    filterFrom.value = '';
    filterTo.value = '';
    loadTransactions();
  });

  // Press Enter triggers filter apply
  [filterUser, filterType, filterFrom, filterTo].forEach(el => {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') loadTransactions();
    });
  });

  // Export CSV
  exportBtn.addEventListener('click', () => {
    if (!transactions.length) {
      alert("No transactions to export.");
      return;
    }

    const csvRows = [
      ['ID','Type','Amount','Description','User','Timestamp'],
      ...transactions.map(t => [
        t.id,
        t.type,
        t.amount.toFixed(2),
        `"${t.description.replace(/"/g, '""')}"`,
        t.user,
        new Date(t.timestamp).toISOString()
      ])
    ];

    const csvContent = csvRows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_project_${currentProjectId}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  });

  // Add transaction form submit
  addTransactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newTransaction = {
      projectId: addProjectSelect.value,
      type: addTypeSelect.value,
      amount: parseFloat(addAmountInput.value),
      description: addDescriptionInput.value.trim(),
      user: addUserInput.value.trim()
    };

    // Basic validation
    if (!newTransaction.projectId || !newTransaction.type || isNaN(newTransaction.amount) || !newTransaction.description || !newTransaction.user) {
      alert("Please fill all fields correctly.");
      return;
    }

    try {
      const res = await fetch('/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTransaction)
      });

      if (!res.ok) throw new Error("Failed to add transaction");

      alert("Transaction added successfully!");

      // Reset form
      addTransactionForm.reset();

      // Reload transactions if on that project
      if (newTransaction.projectId === currentProjectId) loadTransactions();

      // Reload dashboard data
      loadDashboard();
    } catch (err) {
      alert("Error adding transaction: " + err.message);
    }
  });

  // === Initialize ===
  loadDashboard();
});
