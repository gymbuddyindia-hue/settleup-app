const DB_NAME = "settleup-ledger";
const DB_VERSION = 2;
const STORE = {
  people: "people",
  entries: "entries",
  splits: "splits",
};

const SELF_ID = "self";
const SELF_NAME = "Sanin";
const MY_PAYMENT_NUMBER = "95920309";
const MAX_AMOUNT_DECIMALS = 3;

const CURRENCIES = {
  INR: { label: "Indian Rupee", symbol: "₹", locale: "en-IN", decimals: 3 },
  OMR: { label: "Omani Rial", symbol: "OMR", locale: "en-OM", decimals: 3 },
};

const state = {
  people: [],
  entries: [],
  splits: [],
  peopleQuery: "",
  deferredInstallPrompt: null,
};

const els = {
  installButton: document.querySelector("#installButton"),
  installHelpDialog: document.querySelector("#installHelpDialog"),
  peopleSearch: document.querySelector("#peopleSearch"),
  peopleList: document.querySelector("#peopleList"),
  ledgerList: document.querySelector("#ledgerList"),
  splitLogList: document.querySelector("#splitLogList"),
  digestText: document.querySelector("#digestText"),
  copyDigest: document.querySelector("#copyDigest"),
  backupData: document.querySelector("#backupData"),
  restoreData: document.querySelector("#restoreData"),
  restoreFile: document.querySelector("#restoreFile"),
  copyMyNumber: document.querySelector("#copyMyNumber"),
  owedTotal: document.querySelector("#owedTotal"),
  youOweTotal: document.querySelector("#youOweTotal"),
  summaryTitle: document.querySelector("#summaryTitle"),
  summaryCopy: document.querySelector("#summaryCopy"),
  personDialog: document.querySelector("#personDialog"),
  personForm: document.querySelector("#personForm"),
  personName: document.querySelector("#personName"),
  personPhone: document.querySelector("#personPhone"),
  entryDialog: document.querySelector("#entryDialog"),
  entryForm: document.querySelector("#entryForm"),
  entryType: document.querySelector("#entryType"),
  entryModeLabel: document.querySelector("#entryModeLabel"),
  entryTitle: document.querySelector("#entryTitle"),
  entryPerson: document.querySelector("#entryPerson"),
  entryAmount: document.querySelector("#entryAmount"),
  entryCurrency: document.querySelector("#entryCurrency"),
  entryReason: document.querySelector("#entryReason"),
  entryDate: document.querySelector("#entryDate"),
  settleDialog: document.querySelector("#settleDialog"),
  settleForm: document.querySelector("#settleForm"),
  settlePersonId: document.querySelector("#settlePersonId"),
  settlePersonName: document.querySelector("#settlePersonName"),
  settleBalanceCopy: document.querySelector("#settleBalanceCopy"),
  settleAmount: document.querySelector("#settleAmount"),
  settleCurrency: document.querySelector("#settleCurrency"),
  settleFull: document.querySelector("#settleFull"),
  splitDialog: document.querySelector("#splitDialog"),
  splitForm: document.querySelector("#splitForm"),
  splitCurrency: document.querySelector("#splitCurrency"),
  splitReason: document.querySelector("#splitReason"),
  splitDate: document.querySelector("#splitDate"),
  splitPeople: document.querySelector("#splitPeople"),
  addSplitExpense: document.querySelector("#addSplitExpense"),
  splitExpenseList: document.querySelector("#splitExpenseList"),
  splitPreview: document.querySelector("#splitPreview"),
  numberDialog: document.querySelector("#numberDialog"),
  numberForm: document.querySelector("#numberForm"),
  numberPersonId: document.querySelector("#numberPersonId"),
  numberPersonName: document.querySelector("#numberPersonName"),
  numberPhone: document.querySelector("#numberPhone"),
  deleteDialog: document.querySelector("#deleteDialog"),
  deleteForm: document.querySelector("#deleteForm"),
  deleteEntryId: document.querySelector("#deleteEntryId"),
  deleteCopy: document.querySelector("#deleteCopy"),
  deletePersonDialog: document.querySelector("#deletePersonDialog"),
  deletePersonForm: document.querySelector("#deletePersonForm"),
  deletePersonId: document.querySelector("#deletePersonId"),
  deletePersonCopy: document.querySelector("#deletePersonCopy"),
  toast: document.querySelector("#toast"),
};

let dbPromise;

function on(target, eventName, handler) {
  if (!target) return;
  target.addEventListener(eventName, handler);
}

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE.people)) {
        db.createObjectStore(STORE.people, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE.entries)) {
        const entries = db.createObjectStore(STORE.entries, { keyPath: "id" });
        entries.createIndex("personId", "personId");
        entries.createIndex("date", "date");
      }
      if (!db.objectStoreNames.contains(STORE.splits)) {
        const splits = db.createObjectStore(STORE.splits, { keyPath: "id" });
        splits.createIndex("date", "date");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function readAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveRecord(storeName, record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(record);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function deleteRecord(storeName, id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function clearStore(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function money(amount, currency = "INR") {
  const config = CURRENCIES[currency] || CURRENCIES.INR;
  const value = new Intl.NumberFormat(config.locale, {
    maximumFractionDigits: amount % 1 === 0 ? 0 : config.decimals,
  }).format(Math.abs(amount));
  return `${config.symbol}${currency === "INR" ? "" : " "}${value}`;
}

function roundCurrency(amount, currency = "INR") {
  const decimals = CURRENCIES[currency]?.decimals || 2;
  const factor = 10 ** decimals;
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

function parseAmount(value, currency = "INR") {
  const trimmed = String(value || "").trim();
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const [, decimals = ""] = trimmed.split(".");
  if (decimals.length > MAX_AMOUNT_DECIMALS) return null;
  return roundCurrency(amount, currency);
}

function displayDate(date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function getAmount(entry) {
  if (entry.kind === "lent") return entry.amount;
  if (entry.kind === "borrowed") return -entry.amount;
  return entry.amount;
}

function getCurrency(entry) {
  return entry.currency || "INR";
}

function getBalances(personId) {
  return state.entries
    .filter((entry) => entry.personId === personId)
    .reduce((balances, entry) => {
      const currency = getCurrency(entry);
      balances[currency] = (balances[currency] || 0) + getAmount(entry);
      return balances;
    }, {});
}

function getNonZeroBalances(personId) {
  return Object.entries(getBalances(personId))
    .filter(([, balance]) => balance !== 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

function getSortWeight(personId) {
  return getNonZeroBalances(personId).reduce((total, [, balance]) => total + Math.abs(balance), 0);
}

function getPerson(personId) {
  return state.people.find((person) => person.id === personId);
}

function getPartyName(partyId) {
  if (partyId === SELF_ID) return SELF_NAME;
  return getPerson(partyId)?.name || "Unknown";
}

function getEntry(entryId) {
  return state.entries.find((entry) => entry.id === entryId);
}

function getOutstandingEntries(personId) {
  return state.entries
    .filter((entry) => entry.personId === personId && entry.kind !== "settlement")
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getTotals() {
  return state.people.reduce(
    (totals, person) => {
      getNonZeroBalances(person.id).forEach(([currency, balance]) => {
        totals.owed[currency] = (totals.owed[currency] || 0) + Math.max(balance, 0);
        totals.owe[currency] = (totals.owe[currency] || 0) + Math.max(-balance, 0);
        totals.net[currency] = (totals.net[currency] || 0) + balance;
      });
      return totals;
    },
    { owed: {}, owe: {}, net: {} },
  );
}

function formatBalanceMap(balances, emptyText = "₹0") {
  const parts = Object.entries(balances)
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => money(amount, currency));
  return parts.length ? parts.join(" · ") : emptyText;
}

function render() {
  renderSummary();
  renderPeople();
  renderLedger();
  renderSplitLog();
  renderDigest();
  populatePeopleSelect();
}

function renderSummary() {
  const totals = getTotals();
  els.owedTotal.textContent = formatBalanceMap(totals.owed);
  els.youOweTotal.textContent = formatBalanceMap(totals.owe);
  els.summaryTitle.textContent = formatBalanceMap(totals.net);

  const netText = formatBalanceMap(totals.net, "");
  const hasNet = Object.values(totals.net).some((amount) => amount !== 0);
  if (hasNet) {
    els.summaryCopy.textContent = `Outstanding net by currency: ${netText}.`;
  } else {
    els.summaryCopy.textContent = "Nobody owes anything right now.";
  }
}

function renderPeople() {
  if (!state.people.length) {
    els.peopleList.innerHTML = `<div class="empty-state">Add the first person, then log who owes you or who you owe.</div>`;
    return;
  }

  const query = state.peopleQuery.trim().toLowerCase();
  const matches = state.people.filter((person) => {
    if (!query) return true;
    return person.name.toLowerCase().includes(query) || (person.phone || "").toLowerCase().includes(query);
  });

  if (!matches.length) {
    els.peopleList.innerHTML = `<div class="empty-state">No matching people found.</div>`;
    return;
  }

  const sorted = matches.sort((a, b) => {
    if (query) {
      const aStarts = a.name.toLowerCase().startsWith(query) ? 1 : 0;
      const bStarts = b.name.toLowerCase().startsWith(query) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;
      return a.name.localeCompare(b.name);
    }
    return getSortWeight(b.id) - getSortWeight(a.id);
  });
  els.peopleList.innerHTML = sorted
    .map((person) => {
      const balances = getNonZeroBalances(person.id);
      const label = balances.length
        ? balances.map(([currency, balance]) => (
          balance > 0
            ? `${person.name} owes you ${money(balance, currency)}`
            : `You owe ${person.name} ${money(balance, currency)}`
        )).join(" · ")
        : `Settled with ${person.name}`;
      const balanceClass = balances.some(([, balance]) => balance > 0) ? "balance-positive" : balances.some(([, balance]) => balance < 0) ? "balance-negative" : "";
      const settleDisabled = balances.length ? "" : "disabled";
      const copyDisabled = person.phone ? "" : "disabled";
      return `
        <article class="person-card">
          <div class="person-main">
            <h3>${escapeHtml(person.name)}</h3>
            <p class="person-meta">${person.phone ? `Payment number: ${escapeHtml(person.phone)}` : "No payment number added"}</p>
            <p class="balance-line ${balanceClass}">${escapeHtml(label)}</p>
          </div>
          <div class="person-actions">
            <button class="secondary-action" type="button" data-action="settle" data-person="${person.id}" ${settleDisabled}>Settle</button>
            <button class="secondary-action" type="button" data-action="edit-number" data-person="${person.id}">${person.phone ? "Edit no." : "Add no."}</button>
            <button class="secondary-action" type="button" data-action="copy-payment" data-person="${person.id}" ${copyDisabled}>Copy no.</button>
            <button class="secondary-action" type="button" data-action="delete-person" data-person="${person.id}">Delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderLedger() {
  if (!state.entries.length) {
    els.ledgerList.innerHTML = `<div class="empty-state">Your ledger will appear here after the first entry.</div>`;
    return;
  }

  const sorted = [...state.entries].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
  els.ledgerList.innerHTML = sorted
    .map((entry) => {
      const person = getPerson(entry.personId);
      const signed = getAmount(entry);
      const currency = getCurrency(entry);
      const title = entry.kind === "lent"
        ? `${person?.name || "Unknown"} owes you`
        : entry.kind === "borrowed"
          ? `You owe ${person?.name || "Unknown"}`
          : `Settlement with ${person?.name || "Unknown"}`;
      return `
        <article class="ledger-item">
          <div class="ledger-icon ${signed < 0 ? "negative" : ""}" aria-hidden="true">${signed < 0 ? "−" : "+"}</div>
          <div>
            <p class="ledger-title">${escapeHtml(title)}</p>
            <p class="ledger-meta">${displayDate(entry.date)} · ${escapeHtml(entry.reason || "No reason")}</p>
          </div>
          <p class="ledger-amount ${signed < 0 ? "balance-negative" : "balance-positive"}">${signed < 0 ? "−" : "+"}${money(signed, currency)}</p>
          <button class="secondary-action" type="button" data-action="delete-entry" data-entry="${entry.id}">Delete</button>
        </article>
      `;
    })
    .join("");
}

function renderSplitLog() {
  if (!els.splitLogList) return;

  if (!state.splits.length) {
    els.splitLogList.innerHTML = `<div class="empty-state">Smart split logs will appear here after you save a group split.</div>`;
    return;
  }

  const sorted = [...state.splits].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
  els.splitLogList.innerHTML = sorted
    .map((split) => {
      const settlements = split.settlements?.length
        ? split.settlements.map((item) => `
          <li>
            <span>${escapeHtml(getPartyName(item.fromId))} pays ${escapeHtml(getPartyName(item.toId))}</span>
            <strong>${money(item.amount, split.currency)}</strong>
          </li>
        `).join("")
        : `<li><span>Everyone is even</span><strong>${money(0, split.currency)}</strong></li>`;
      const expenses = split.expenses
        .map((expense) => {
          const excluded = expense.excludedId ? `, excluding ${getPartyName(expense.excludedId)}` : "";
          return `${getPartyName(expense.payerId)} paid ${money(expense.amount, split.currency)} for ${expense.label || "expense"}${excluded}`;
        })
        .join(" · ");
      return `
        <article class="split-card">
          <div class="split-card-head">
            <div>
              <h3>${escapeHtml(split.reason)}</h3>
              <p class="ledger-meta">${displayDate(split.date)} · ${money(split.total, split.currency)} · ${split.participants.length} people + ${SELF_NAME}</p>
            </div>
          </div>
          <p class="split-expense-copy">${escapeHtml(expenses)}</p>
          <ul class="settlement-list">${settlements}</ul>
        </article>
      `;
    })
    .join("");
}

function renderDigest() {
  const lines = ["Weekly outstanding digest", ""];
  const unsettled = state.people
    .map((person) => ({ person, balances: getNonZeroBalances(person.id) }))
    .filter(({ balances }) => balances.length)
    .sort((a, b) => getSortWeight(b.person.id) - getSortWeight(a.person.id));

  if (!unsettled.length) {
    lines.push("Everything is settled. Nice clean slate.");
  } else {
    unsettled.forEach(({ person, balances }) => {
      balances.forEach(([currency, balance]) => {
        lines.push(balance > 0
          ? `${person.name} owes you ${money(balance, currency)}`
          : `You owe ${person.name} ${money(balance, currency)}`);
      });
    });
    lines.push("");
    lines.push(`Net by currency: ${formatBalanceMap(getTotals().net)}`);
  }

  els.digestText.textContent = lines.join("\n");
}

function populatePeopleSelect() {
  els.entryPerson.innerHTML = state.people
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`)
    .join("");
}

function renderSplitPeople() {
  if (!state.people.length) {
    els.splitPeople.innerHTML = `<div class="empty-state">Add people first.</div>`;
    return;
  }

  els.splitPeople.innerHTML = [...state.people]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((person) => `
      <label class="checkbox-row">
        <input type="checkbox" value="${person.id}" checked>
        <span>${escapeHtml(person.name)}</span>
      </label>
    `)
    .join("");
}

function openPersonDialog() {
  els.personForm.reset();
  els.personDialog.showModal();
  els.personName.focus();
}

function openEntryDialog(type) {
  if (!state.people.length) {
    showToast("Add a person first.");
    openPersonDialog();
    return;
  }

  els.entryForm.reset();
  els.entryType.value = type;
  els.entryCurrency.value = "INR";
  els.entryDate.value = todayIso();
  els.entryModeLabel.textContent = type === "lent" ? "Owes me" : "I owe";
  els.entryTitle.textContent = type === "lent" ? "Owes Me" : "I Owe";
  populatePeopleSelect();
  els.entryDialog.showModal();
  els.entryAmount.focus();
}

function openSplitDialog() {
  if (!els.splitDialog || !els.splitForm) return;

  if (!state.people.length) {
    showToast("Add people first.");
    openPersonDialog();
    return;
  }

  els.splitForm.reset();
  if (els.splitCurrency) els.splitCurrency.value = "INR";
  if (els.splitDate) els.splitDate.value = todayIso();
  renderSplitPeople();
  renderSplitExpenseRows([{ payerId: SELF_ID, excludedId: "", label: "", amount: "" }]);
  updateSplitPreview();
  els.splitDialog.showModal();
  els.splitReason?.focus();
}

function getSplitPartyOptions(selectedPayerId = SELF_ID) {
  const partyIds = [SELF_ID, ...getSelectedSplitPeople()];
  return partyIds
    .map((partyId) => `<option value="${partyId}" ${partyId === selectedPayerId ? "selected" : ""}>${escapeHtml(getPartyName(partyId))}</option>`)
    .join("");
}

function getSplitExcludeOptions(selectedExcludedId = "") {
  const partyIds = [SELF_ID, ...getSelectedSplitPeople()];
  return [
    `<option value="">No one</option>`,
    ...partyIds.map((partyId) => `<option value="${partyId}" ${partyId === selectedExcludedId ? "selected" : ""}>${escapeHtml(getPartyName(partyId))}</option>`),
  ].join("");
}

function renderSplitExpenseRows(expenses = getSplitExpenseInputs()) {
  if (!els.splitExpenseList) return;

  const rows = expenses.length ? expenses : [{ payerId: SELF_ID, excludedId: "", label: "", amount: "" }];
  els.splitExpenseList.innerHTML = rows
    .map((expense, index) => `
      <div class="split-expense-row">
        <select data-split-payer aria-label="Who paid">${getSplitPartyOptions(expense.payerId || SELF_ID)}</select>
        <input data-split-label placeholder="Item" maxlength="40" value="${escapeHtml(expense.label || "")}">
        <input data-split-amount inputmode="decimal" min="0.001" step="0.001" type="number" placeholder="0.000" value="${escapeHtml(expense.amount || "")}" aria-label="Amount">
        <select data-split-excluded aria-label="Exclude from item">${getSplitExcludeOptions(expense.excludedId || "")}</select>
        <button class="secondary-action compact-action" data-remove-expense="${index}" type="button" ${rows.length === 1 ? "disabled" : ""}>Remove</button>
      </div>
    `)
    .join("");
}

function openNumberDialog(personId) {
  const person = getPerson(personId);
  if (!person) return;

  els.numberForm.reset();
  els.numberPersonId.value = personId;
  els.numberPersonName.textContent = person.phone ? `Edit ${person.name}` : `Add Number for ${person.name}`;
  els.numberPhone.value = person.phone || "";
  els.numberDialog.showModal();
  els.numberPhone.focus();
}

function openSettleDialog(personId) {
  const person = getPerson(personId);
  const balances = getNonZeroBalances(personId);
  if (!person || !balances.length) return;

  els.settleForm.reset();
  els.settlePersonId.value = personId;
  els.settlePersonName.textContent = person.name;
  els.settleCurrency.innerHTML = balances
    .map(([currency, balance]) => `<option value="${currency}">${CURRENCIES[currency]?.label || currency} (${money(balance, currency)})</option>`)
    .join("");
  syncSettleCurrency(personId);
  els.settleDialog.showModal();
  els.settleAmount.focus();
}

function syncSettleCurrency(personId) {
  const person = getPerson(personId);
  const currency = els.settleCurrency.value || getNonZeroBalances(personId)[0]?.[0] || "INR";
  const balance = getBalances(personId)[currency] || 0;
  els.settleBalanceCopy.textContent = balance > 0
    ? `${person.name} owes you ${money(balance, currency)}.`
    : `You owe ${person.name} ${money(balance, currency)}.`;
  els.settleAmount.value = Math.abs(balance);
  els.settleAmount.max = Math.abs(balance);
}

async function addPerson(event) {
  event.preventDefault();
  const name = els.personName.value.trim();
  if (!name) return;

  await saveRecord(STORE.people, {
    id: uid("person"),
    name,
    phone: normalizePhone(els.personPhone.value),
    createdAt: new Date().toISOString(),
  });

  els.personDialog.close();
  await refresh();
  showToast(`${name} added.`);
}

async function savePaymentNumber(event) {
  event.preventDefault();
  const person = getPerson(els.numberPersonId.value);
  if (!person) return;

  const phone = normalizePhone(els.numberPhone.value);
  if (!phone) return;

  await saveRecord(STORE.people, {
    ...person,
    phone,
    updatedAt: new Date().toISOString(),
  });

  els.numberDialog.close();
  await refresh();
  showToast("Payment number saved.");
}

async function addEntry(event) {
  event.preventDefault();
  const personId = els.entryPerson.value;
  const currency = els.entryCurrency.value || "INR";
  const amount = parseAmount(els.entryAmount.value, currency);
  if (!personId || amount === null) {
    showToast("Use an amount above 0 with up to 3 decimals.");
    return;
  }

  await saveRecord(STORE.entries, {
    id: uid("entry"),
    personId,
    kind: els.entryType.value,
    amount,
    currency,
    reason: els.entryReason.value.trim(),
    date: els.entryDate.value || todayIso(),
    createdAt: new Date().toISOString(),
  });

  els.entryDialog.close();
  await refresh();
  showToast("Entry saved.");
}

async function addSplit(event) {
  event.preventDefault();
  const currency = els.splitCurrency?.value || "INR";
  const selectedPeople = getSelectedSplitPeople();
  const participants = [SELF_ID, ...selectedPeople];
  const expenses = getSplitExpenseInputs()
    .map((expense) => ({
      payerId: expense.payerId,
      excludedId: expense.excludedId,
      label: expense.label || "Expense",
      amount: parseAmount(expense.amount, currency),
    }))
    .filter((expense) => expense.payerId && expense.amount !== null);

  if (!selectedPeople.length) {
    showToast("Select at least one person.");
    return;
  }
  if (!expenses.length) {
    showToast("Add at least one paid expense.");
    return;
  }

  const splitId = uid("split");
  const reason = els.splitReason?.value.trim() || "Group";
  const date = els.splitDate?.value || todayIso();
  const calculation = calculateSplit(expenses, participants, currency);
  const createdAt = new Date().toISOString();

  await Promise.all([
    saveRecord(STORE.splits, {
      id: splitId,
      reason,
      currency,
      date,
      participants: selectedPeople,
      expenses,
      settlements: calculation.settlements,
      total: calculation.total,
      share: calculation.share,
      createdAt,
    }),
    ...calculation.personalEntries.map((entry) => saveRecord(STORE.entries, {
      id: uid("entry"),
      splitId,
      personId: entry.personId,
      kind: entry.kind,
      amount: entry.amount,
      currency,
      reason: `${reason} split`,
      date,
      createdAt,
    })),
  ]);

  els.splitDialog.close();
  await refresh();
  showToast("Smart split saved.");
}

async function addSettlement(event) {
  event.preventDefault();
  const personId = els.settlePersonId.value;
  const currency = els.settleCurrency.value || "INR";
  const balance = getBalances(personId)[currency] || 0;
  const enteredAmount = parseAmount(els.settleAmount.value, currency);
  const amount = enteredAmount === null ? null : Math.min(enteredAmount, Math.abs(balance));
  if (!personId || amount === null || balance === 0) {
    showToast("Use an amount above 0 with up to 3 decimals.");
    return;
  }

  await saveRecord(STORE.entries, {
    id: uid("settlement"),
    personId,
    kind: "settlement",
    amount: balance > 0 ? -amount : amount,
    currency,
    reason: "Settled",
    date: todayIso(),
    createdAt: new Date().toISOString(),
  });

  els.settleDialog.close();
  await refresh();
  showToast("Settlement recorded.");
}

function openDeleteDialog(entryId) {
  const entry = getEntry(entryId);
  if (!entry) return;

  const person = getPerson(entry.personId);
  const amount = getAmount(entry);
  const currency = getCurrency(entry);
  const action = entry.kind === "lent"
    ? `${person?.name || "This person"} owes you`
    : entry.kind === "borrowed"
      ? `You owe ${person?.name || "this person"}`
      : `Settlement with ${person?.name || "this person"}`;

  els.deleteEntryId.value = entryId;
  els.deleteCopy.textContent = `${action}: ${money(amount, currency)} for ${entry.reason || "No reason"} on ${displayDate(entry.date)}.`;
  els.deleteDialog.showModal();
}

function openDeletePersonDialog(personId) {
  const person = getPerson(personId);
  if (!person) return;

  const logCount = state.entries.filter((entry) => entry.personId === personId).length;
  els.deletePersonId.value = personId;
  els.deletePersonCopy.textContent = `Delete ${person.name}${logCount ? ` and ${logCount} log${logCount === 1 ? "" : "s"}` : ""}?`;
  els.deletePersonDialog.showModal();
}

async function deleteEntry(event) {
  event.preventDefault();
  const entryId = els.deleteEntryId.value;
  if (!entryId) return;

  await deleteRecord(STORE.entries, entryId);
  els.deleteDialog.close();
  await refresh();
  showToast("Log deleted.");
}

async function deletePerson(event) {
  event.preventDefault();
  const personId = els.deletePersonId.value;
  const person = getPerson(personId);
  if (!person) return;

  const relatedEntries = state.entries.filter((entry) => entry.personId === personId);
  const relatedSplits = state.splits.filter((split) => split.participants.includes(personId));
  await Promise.all([
    ...relatedEntries.map((entry) => deleteRecord(STORE.entries, entry.id)),
    ...relatedSplits.map((split) => deleteRecord(STORE.splits, split.id)),
    deleteRecord(STORE.people, personId),
  ]);

  els.deletePersonDialog.close();
  await refresh();
  showToast(`${person.name} deleted.`);
}

function getSelectedSplitPeople() {
  if (!els.splitPeople) return [];

  return [...els.splitPeople.querySelectorAll("input[type='checkbox']:checked")]
    .map((input) => input.value);
}

function getSplitExpenseInputs() {
  if (!els.splitExpenseList) return [];

  return [...els.splitExpenseList.querySelectorAll(".split-expense-row")]
    .map((row) => ({
      payerId: row.querySelector("[data-split-payer]")?.value || SELF_ID,
      excludedId: row.querySelector("[data-split-excluded]")?.value || "",
      label: row.querySelector("[data-split-label]")?.value.trim() || "",
      amount: row.querySelector("[data-split-amount]")?.value || "",
    }));
}

function updateSplitPreview() {
  if (!els.splitPreview) return;

  const currency = els.splitCurrency?.value || "INR";
  const selectedPeople = getSelectedSplitPeople();
  const participants = [SELF_ID, ...selectedPeople];
  const expenses = getSplitExpenseInputs()
    .map((expense) => ({ ...expense, amount: parseAmount(expense.amount, currency) }))
    .filter((expense) => expense.amount !== null);

  if (!selectedPeople.length || !expenses.length) {
    els.splitPreview.textContent = "Select people and add paid expenses to preview settlement.";
    return;
  }

  const calculation = calculateSplit(expenses, participants, currency);
  if (!calculation.settlements.length) {
    els.splitPreview.textContent = `${money(calculation.total, currency)} split across ${participants.length} people. Everyone is even.`;
    return;
  }

  els.splitPreview.textContent = `${money(calculation.total, currency)} split across ${participants.length} people. Average share is ${money(calculation.share, currency)}. ${calculation.settlements.map((item) => `${getPartyName(item.fromId)} pays ${getPartyName(item.toId)} ${money(item.amount, currency)}`).join(" · ")}`;
}

function calculateSplit(expenses, participants, currency) {
  const total = roundCurrency(expenses.reduce((sum, expense) => sum + expense.amount, 0), currency);
  const netByParty = participants.reduce((net, partyId) => {
    net[partyId] = 0;
    return net;
  }, {});

  expenses.forEach((expense) => {
    const involved = participants.filter((partyId) => partyId !== expense.excludedId);
    const itemShare = roundCurrency(expense.amount / involved.length, currency);
    netByParty[expense.payerId] = roundCurrency((netByParty[expense.payerId] || 0) + expense.amount, currency);
    involved.forEach((partyId) => {
      netByParty[partyId] = roundCurrency((netByParty[partyId] || 0) - itemShare, currency);
    });
  });

  const share = roundCurrency(total / participants.length, currency);

  const creditors = Object.entries(netByParty)
    .filter(([, amount]) => amount > 0)
    .map(([partyId, amount]) => ({ partyId, amount }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = Object.entries(netByParty)
    .filter(([, amount]) => amount < 0)
    .map(([partyId, amount]) => ({ partyId, amount: Math.abs(amount) }))
    .sort((a, b) => b.amount - a.amount);
  const settlements = [];

  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = roundCurrency(Math.min(creditor.amount, debtor.amount), currency);
    if (amount > 0) {
      settlements.push({ fromId: debtor.partyId, toId: creditor.partyId, amount });
    }
    creditor.amount = roundCurrency(creditor.amount - amount, currency);
    debtor.amount = roundCurrency(debtor.amount - amount, currency);
    if (creditor.amount <= 0) creditorIndex += 1;
    if (debtor.amount <= 0) debtorIndex += 1;
  }

  const personalEntries = settlements
    .filter((item) => item.fromId === SELF_ID || item.toId === SELF_ID)
    .map((item) => ({
      personId: item.fromId === SELF_ID ? item.toId : item.fromId,
      kind: item.fromId === SELF_ID ? "borrowed" : "lent",
      amount: item.amount,
    }))
    .filter((entry) => entry.amount > 0);

  return { total, share, netByParty, settlements, personalEntries };
}

async function copyDigest() {
  await copyText(els.digestText.textContent);
  showToast("Digest copied.");
}

async function backupData() {
  const backup = {
    app: "SettleUp",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      people: state.people,
      entries: state.entries,
      splits: state.splits,
    },
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `settleup-backup-${todayIso()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Backup downloaded.");
}

function restoreData() {
  els.restoreFile?.click();
}

async function importBackupFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const backup = JSON.parse(await file.text());
    const data = backup.data || backup;
    const people = Array.isArray(data.people) ? data.people : [];
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const splits = Array.isArray(data.splits) ? data.splits : [];

    if (!people.length && !entries.length && !splits.length) {
      showToast("Backup file has no SettleUp data.");
      return;
    }

    await Promise.all([clearStore(STORE.people), clearStore(STORE.entries), clearStore(STORE.splits)]);
    await Promise.all([
      ...people.map((person) => saveRecord(STORE.people, person)),
      ...entries.map((entry) => saveRecord(STORE.entries, entry)),
      ...splits.map((split) => saveRecord(STORE.splits, split)),
    ]);
    await refresh();
    showToast("Backup restored.");
  } catch {
    showToast("Could not restore this backup file.");
  } finally {
    event.target.value = "";
  }
}

async function installApp() {
  if (state.deferredInstallPrompt) {
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    return;
  }

  els.installHelpDialog?.showModal();
}

async function copyPaymentNumber(personId) {
  const person = getPerson(personId);
  if (!person?.phone) return;
  await copyText(person.phone);
  showToast("Payment number copied.");
}

async function copyMyPaymentNumber() {
  await copyText(MY_PAYMENT_NUMBER);
  showToast("Your payment number copied.");
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some installed mobile PWAs expose clipboard but reject writes.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  document.execCommand("copy");
  textarea.remove();
}

function normalizePhone(value) {
  return value.trim().replace(/\s+/g, "");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 2200);
}

async function refresh() {
  const [people, entries, splits] = await Promise.all([readAll(STORE.people), readAll(STORE.entries), readAll(STORE.splits)]);
  state.people = people;
  state.entries = entries;
  state.splits = splits;
  render();
}

function switchView(viewId, activeTab) {
  document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  activeTab?.classList.add("active");
  document.querySelector(`#${CSS.escape(viewId)}`)?.classList.add("active");
}

function handleAppClick(event) {
  const tab = event.target.closest(".tab[data-view]");
  if (tab) {
    event.preventDefault();
    switchView(tab.dataset.view, tab);
    return;
  }

  const closeButton = event.target.closest("[data-close-dialog]");
  if (closeButton) {
    event.preventDefault();
    closeButton.closest("dialog")?.close();
    return;
  }

  const actionButton = event.target.closest("button");
  if (!actionButton) return;

  if (actionButton.id === "quickAddPerson") {
    event.preventDefault();
    openPersonDialog();
    return;
  }
  if (actionButton.id === "openLent") {
    event.preventDefault();
    openEntryDialog("lent");
    return;
  }
  if (actionButton.id === "openBorrowed") {
    event.preventDefault();
    openEntryDialog("borrowed");
    return;
  }
  if (actionButton.id === "openSplit" || actionButton.id === "quickAddSplit") {
    event.preventDefault();
    openSplitDialog();
    return;
  }
  if (actionButton.id === "copyDigest") {
    event.preventDefault();
    copyDigest();
    return;
  }
  if (actionButton.id === "backupData") {
    event.preventDefault();
    backupData();
    return;
  }
  if (actionButton.id === "restoreData") {
    event.preventDefault();
    restoreData();
    return;
  }
  if (actionButton.id === "installButton") {
    event.preventDefault();
    installApp();
    return;
  }
  if (actionButton.id === "copyMyNumber") {
    event.preventDefault();
    copyMyPaymentNumber();
    return;
  }
  if (actionButton.id === "addSplitExpense") {
    event.preventDefault();
    renderSplitExpenseRows([...getSplitExpenseInputs(), { payerId: SELF_ID, excludedId: "", label: "", amount: "" }]);
    updateSplitPreview();
    return;
  }
  if (actionButton.dataset.removeExpense !== undefined) {
    event.preventDefault();
    const index = Number(actionButton.dataset.removeExpense);
    renderSplitExpenseRows(getSplitExpenseInputs().filter((_, rowIndex) => rowIndex !== index));
    updateSplitPreview();
    return;
  }

  const personAction = actionButton.dataset.action;
  if (personAction) {
    event.preventDefault();
    if (personAction === "settle") openSettleDialog(actionButton.dataset.person);
    if (personAction === "edit-number") openNumberDialog(actionButton.dataset.person);
    if (personAction === "copy-payment") copyPaymentNumber(actionButton.dataset.person);
    if (personAction === "delete-person") openDeletePersonDialog(actionButton.dataset.person);
    if (personAction === "delete-entry") openDeleteDialog(actionButton.dataset.entry);
  }
}

function wireEvents() {
  on(els.peopleSearch, "input", () => {
    state.peopleQuery = els.peopleSearch?.value || "";
    renderPeople();
  });
  on(els.personForm, "submit", addPerson);
  on(els.numberForm, "submit", savePaymentNumber);
  on(els.entryForm, "submit", addEntry);
  on(els.splitForm, "submit", addSplit);
  on(els.settleForm, "submit", addSettlement);
  on(els.deleteForm, "submit", deleteEntry);
  on(els.deletePersonForm, "submit", deletePerson);
  on(els.restoreFile, "change", importBackupFile);
  on(els.settleFull, "click", () => {
    const currency = els.settleCurrency.value || "INR";
    const balance = getBalances(els.settlePersonId.value)[currency] || 0;
    els.settleAmount.value = Math.abs(balance);
  });
  on(els.settleCurrency, "change", () => syncSettleCurrency(els.settlePersonId.value));
  on(els.splitPeople, "change", () => {
    const partyIds = [SELF_ID, ...getSelectedSplitPeople()];
    renderSplitExpenseRows(getSplitExpenseInputs().map((expense) => ({
      ...expense,
      payerId: partyIds.includes(expense.payerId) ? expense.payerId : SELF_ID,
      excludedId: partyIds.includes(expense.excludedId) ? expense.excludedId : "",
    })));
    updateSplitPreview();
  });
  on(els.splitExpenseList, "input", updateSplitPreview);
  on(els.splitExpenseList, "change", updateSplitPreview);
  [els.splitCurrency].forEach((target) => {
    on(target, "input", updateSplitPreview);
    on(target, "change", updateSplitPreview);
  });

  on(document, "click", handleAppClick);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    els.installButton.hidden = false;
  });
}

async function boot() {
  wireEvents();
  window.settleUpReady = true;
  try {
    await refresh();
  } catch (error) {
    console.error("SettleUp refresh failed", error);
    showToast("App loaded. Stored data needs a refresh.");
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
  }
}

boot();
