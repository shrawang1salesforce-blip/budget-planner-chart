const monthPicker = document.querySelector("#month-picker");
const budgetForm = document.querySelector("#budget-form");
const expenseForm = document.querySelector("#expense-form");
const budgetList = document.querySelector("#budget-list");
const expenseList = document.querySelector("#expense-list");
const expenseCategory = document.querySelector("#expense-category");
const expenseDate = document.querySelector("#expense-date");

let budgetChart;
let monthData = { budgets: [], expenses: [] };

monthPicker.value = localDateString().slice(0, 7);
monthPicker.addEventListener("change", loadMonth);
budgetForm.addEventListener("submit", saveBudget);
expenseForm.addEventListener("submit", saveExpense);
loadMonth();

function loadMonth() {
  const allMonths = readSavedMonths();
  monthData = allMonths[monthPicker.value] || { budgets: [], expenses: [] };
  const today = localDateString();
  expenseDate.value =
    monthPicker.value === today.slice(0, 7) ? today : `${monthPicker.value}-01`;
  render();
}

function readSavedMonths() {
  try {
    return JSON.parse(localStorage.getItem("pocket-budget-data")) || {};
  } catch {
    return {};
  }
}

function saveMonth() {
  const allMonths = readSavedMonths();
  allMonths[monthPicker.value] = monthData;
  localStorage.setItem("pocket-budget-data", JSON.stringify(allMonths));
}

function saveBudget(event) {
  event.preventDefault();
  const formData = new FormData(budgetForm);
  const category = formData.get("category").trim();
  const amount = Number(formData.get("amount"));
  const existingBudget = monthData.budgets.find(
    (budget) => budget.category.toLowerCase() === category.toLowerCase(),
  );

  if (existingBudget) {
    existingBudget.amount = amount;
  } else {
    monthData.budgets.push({ category, amount });
  }

  saveMonth();
  budgetForm.reset();
  render();
}

function saveExpense(event) {
  event.preventDefault();
  const formData = new FormData(expenseForm);

  monthData.expenses.push({
    id: crypto.randomUUID(),
    description: formData.get("description").trim(),
    category: formData.get("category"),
    amount: Number(formData.get("amount")),
    date: formData.get("date"),
  });

  saveMonth();
  expenseForm.reset();
  render();
}

function removeExpense(id) {
  monthData.expenses = monthData.expenses.filter(
    (expense) => expense.id !== id,
  );
  saveMonth();
  render();
}

function render() {
  renderBudgets();
  renderExpenses();
  renderCategoryOptions();
  renderSummary();
  renderChart();
}

function renderBudgets() {
  budgetList.replaceChildren();
  document.querySelector("#category-count").textContent =
    `${monthData.budgets.length} ${monthData.budgets.length === 1 ? "category" : "categories"}`;

  if (monthData.budgets.length === 0) {
    budgetList.innerHTML =
      '<p class="empty-table">Add your first category budget below.</p>';
    return;
  }

  for (const budget of monthData.budgets) {
    const spent = spentFor(budget.category);
    const percent =
      budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;
    const isOverBudget = spent > budget.amount;
    const row = document.createElement("div");
    row.className = "budget-row";
    row.innerHTML = `
      <div class="budget-row-top">
        <span class="budget-category">${escapeHtml(budget.category)}</span>
        <span class="budget-numbers"><strong>${formatMoney(spent)}</strong> / ${formatMoney(budget.amount)}</span>
      </div>
      <div class="progress-track" role="progressbar" aria-label="${escapeHtml(budget.category)} budget used" aria-valuenow="${Math.round(percent)}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-fill${isOverBudget ? " over-budget" : ""}" style="width: ${percent}%"></div>
      </div>
      ${isOverBudget ? `<span class="over-budget-note">${formatMoney(spent - budget.amount)} over budget</span>` : ""}
    `;
    budgetList.append(row);
  }
}

function renderExpenses() {
  expenseList.replaceChildren();
  const expenses = [...monthData.expenses].sort((first, second) =>
    second.date.localeCompare(first.date),
  );
  document.querySelector("#expense-count").textContent =
    `${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"}`;
  document.querySelector("#expense-empty").hidden = expenses.length > 0;

  for (const expense of expenses) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="expense-name">${escapeHtml(expense.description)}</td>
      <td class="expense-category">${escapeHtml(expense.category)}</td>
      <td class="expense-date">${formatDate(expense.date)}</td>
      <td class="amount-cell">${formatMoney(expense.amount)}</td>
      <td class="remove-cell"><button class="remove-expense" type="button" aria-label="Remove ${escapeHtml(expense.description)}" title="Remove expense">&times;</button></td>
    `;
    row
      .querySelector("button")
      .addEventListener("click", () => removeExpense(expense.id));
    expenseList.append(row);
  }
}

function renderCategoryOptions() {
  const selected = expenseCategory.value;
  expenseCategory.replaceChildren();

  if (monthData.budgets.length === 0) {
    expenseCategory.add(new Option("Add a budget first", ""));
    document.querySelector("#expense-submit").disabled = true;
    return;
  }

  expenseCategory.add(new Option("Choose a category", ""));
  for (const budget of monthData.budgets) {
    expenseCategory.add(new Option(budget.category, budget.category));
  }
  expenseCategory.value = monthData.budgets.some(
    (budget) => budget.category === selected,
  )
    ? selected
    : "";
  document.querySelector("#expense-submit").disabled = false;
}

function renderSummary() {
  const budgetTotal = monthData.budgets.reduce(
    (total, budget) => total + budget.amount,
    0,
  );
  const spentTotal = monthData.expenses.reduce(
    (total, expense) => total + expense.amount,
    0,
  );

  document.querySelector("#total-spent").textContent = formatMoney(spentTotal);
  document.querySelector("#total-budget").textContent =
    formatMoney(budgetTotal);
  document.querySelector("#total-remaining").textContent = formatMoney(
    budgetTotal - spentTotal,
  );
}

function renderChart() {
  const canvas = document.querySelector("#budget-chart");
  const emptyMessage = document.querySelector("#chart-empty");
  emptyMessage.hidden = monthData.budgets.length > 0;

  if (budgetChart) {
    budgetChart.destroy();
    budgetChart = undefined;
  }
  if (monthData.budgets.length === 0 || !window.Chart) return;

  budgetChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: monthData.budgets.map((budget) => budget.category),
      datasets: [
        {
          label: "Budget",
          data: monthData.budgets.map((budget) => budget.amount),
          backgroundColor: "#a7cc86",
          borderRadius: 3,
          maxBarThickness: 24,
        },
        {
          label: "Spent",
          data: monthData.budgets.map((budget) => spentFor(budget.category)),
          backgroundColor: "#ef8067",
          borderRadius: 3,
          maxBarThickness: 24,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#778078", font: { family: "DM Sans", size: 10 } },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#eeefe9" },
          ticks: {
            color: "#929890",
            font: { family: "DM Sans", size: 9 },
            callback: (value) => `$${value}`,
          },
          border: { display: false },
        },
      },
    },
  });
}

function spentFor(category) {
  return monthData.expenses
    .filter((expense) => expense.category === category)
    .reduce((total, expense) => total + expense.amount, 0);
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}
