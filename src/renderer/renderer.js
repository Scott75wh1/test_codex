const form = document.getElementById('doc-form');
const statusEl = document.getElementById('form-status');
const simulationForm = document.getElementById('simulation-form');
const queueTableBody = document.querySelector('#queue-table tbody');
const inboxTableBody = document.querySelector('#inbox-table tbody');
const logsEl = document.getElementById('logs');

function fmtDate(value) {
  return new Date(value).toLocaleString();
}

function renderQueue(queue) {
  queueTableBody.innerHTML = queue
    .map(
      (job) => `
      <tr>
        <td>${job.id}</td>
        <td>${job.customer_name}</td>
        <td>${job.document_type}</td>
        <td>$${Number(job.amount).toFixed(2)}</td>
        <td>${job.status}</td>
        <td>${job.error_message || '-'}</td>
        <td>${job.remote_receipt_id || '-'}</td>
        <td>${fmtDate(job.updated_at)}</td>
      </tr>`
    )
    .join('');
}

function renderInbox(items) {
  inboxTableBody.innerHTML = items
    .map(
      (row) => `
      <tr>
        <td>${row.id}</td>
        <td>${row.source_job_id ?? '-'}</td>
        <td>${row.customer_name}</td>
        <td>${row.document_type}</td>
        <td>$${Number(row.amount).toFixed(2)}</td>
        <td>${row.notes || '-'}</td>
        <td>${fmtDate(row.received_at)}</td>
      </tr>`
    )
    .join('');
}

function renderLogs(logs) {
  logsEl.textContent = logs
    .map((entry) => `${entry.created_at} [${entry.level}] ${entry.message} ${entry.context || ''}`)
    .join('\n');
}

async function refresh() {
  const [queue, inbox, logs, simulation] = await Promise.all([
    window.slyceApi.getQueue(),
    window.slyceApi.getInbox(),
    window.slyceApi.getLogs(),
    window.slyceApi.getSimulation()
  ]);

  renderQueue(queue);
  renderInbox(inbox);
  renderLogs(logs);

  simulationForm.latencyMs.value = simulation.latency_ms;
  simulationForm.failureMode.value = simulation.failure_mode;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);

  const payload = {
    customerName: data.get('customerName').toString(),
    documentType: data.get('documentType').toString(),
    amount: Number(data.get('amount')),
    notes: data.get('notes').toString()
  };

  const result = await window.slyceApi.createDocument(payload);
  statusEl.textContent = `Queued job #${result.jobId} for printing.`;
  form.reset();
  await refresh();
});

simulationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await window.slyceApi.setSimulation({
    latencyMs: Number(simulationForm.latencyMs.value),
    failureMode: simulationForm.failureMode.value
  });
  statusEl.textContent = 'Simulation settings updated.';
  await refresh();
});

document.getElementById('seed-data').addEventListener('click', async () => {
  const result = await window.slyceApi.seedDemo();
  statusEl.textContent = `Seeded ${result.count} demo jobs.`;
  await refresh();
});

document.getElementById('run-queue').addEventListener('click', async () => {
  await window.slyceApi.processQueue();
  statusEl.textContent = 'Manual queue run triggered.';
  await refresh();
});

setInterval(refresh, 2500);
refresh();
