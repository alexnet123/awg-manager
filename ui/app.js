const state = {
  apiKey: '',
  interfaces: [],
  clients: [],
  activeTab: 'interfaces',
};

const elements = {
  loginView: document.getElementById('login-view'),
  appView: document.getElementById('app-view'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  globalError: document.getElementById('global-error'),
  interfacesCount: document.getElementById('interfaces-count'),
  clientsCount: document.getElementById('clients-count'),
  interfacesList: document.getElementById('interfaces-list'),
  clientsList: document.getElementById('clients-list'),
  interfaceForm: document.getElementById('interface-form'),
  clientForm: document.getElementById('client-form'),
  clientInterfaceSelect: document.getElementById('client-interface'),
  configOutput: document.getElementById('config-output'),
  qrOutput: document.getElementById('qr-output'),
  interfacesPanel: document.getElementById('interfaces-panel'),
  clientsPanel: document.getElementById('clients-panel'),
  refreshAll: document.getElementById('refresh-all'),
  logoutButton: document.getElementById('logout-button'),
  tabs: Array.from(document.querySelectorAll('.tab')),
};

function setError(message, target = elements.globalError) {
  if (!message) {
    target.hidden = true;
    target.textContent = '';
    return;
  }
  target.hidden = false;
  target.textContent = message;
}

function apiHeaders(extraHeaders = {}) {
  return {
    'X-API-Key': state.apiKey,
    ...extraHeaders,
  };
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...apiHeaders(),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Request failed');
    }
    return payload;
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response;
}

function activateTab(tabName) {
  state.activeTab = tabName;
  elements.interfacesPanel.hidden = tabName !== 'interfaces';
  elements.clientsPanel.hidden = tabName !== 'clients';
  for (const tab of elements.tabs) {
    tab.classList.toggle('is-active', tab.dataset.tab === tabName);
  }
}

function renderMetrics() {
  elements.interfacesCount.textContent = String(state.interfaces.length);
  elements.clientsCount.textContent = String(state.clients.length);
}

function renderClientInterfaceOptions() {
  const currentValue = elements.clientInterfaceSelect.value;
  elements.clientInterfaceSelect.innerHTML = '';
  for (const item of state.interfaces) {
    const option = document.createElement('option');
    option.value = item.wg_interface;
    option.textContent = `${item.wg_interface} (v${item.awg_version})`;
    elements.clientInterfaceSelect.appendChild(option);
  }
  if (currentValue) {
    elements.clientInterfaceSelect.value = currentValue;
  }
  const submitButton = elements.clientForm.querySelector('button[type="submit"]');
  const isDisabled = state.interfaces.length === 0;
  elements.clientInterfaceSelect.disabled = isDisabled;
  submitButton.disabled = isDisabled;
  submitButton.textContent = isDisabled ? 'Create an Interface First' : 'Create Client';
}

function renderInterfaces() {
  elements.interfacesList.innerHTML = '';
  if (!state.interfaces.length) {
    elements.interfacesList.innerHTML = '<div class="empty-state">No interfaces yet.</div>';
    return;
  }

  for (const item of state.interfaces) {
    const card = document.createElement('article');
    card.className = 'list-card';
    const params = Object.entries(item.awg_params || {})
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
    card.innerHTML = `
      <div class="list-card-head">
        <div>
          <h3>${item.wg_interface}</h3>
          <p>Version ${item.awg_version} · ${item.wg_ip_addr}/${item.wg_ip_cidr} · port ${item.port_number}</p>
        </div>
        <button class="btn btn-danger" type="button" data-action="delete-interface" data-id="${item.id}">Delete</button>
      </div>
      <div class="meta-grid">
        <span>Server IP: ${item.srv_ip}</span>
        <span>DNS: ${item.srv_dns}</span>
        <span>Public key: ${item.public_key}</span>
      </div>
      <p class="params-line">${params || 'Default generated parameters'}</p>
    `;
    elements.interfacesList.appendChild(card);
  }
}

function renderClients() {
  elements.clientsList.innerHTML = '';
  if (!state.clients.length) {
    elements.clientsList.innerHTML = '<div class="empty-state">No clients yet.</div>';
    return;
  }

  for (const item of state.clients) {
    const card = document.createElement('article');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="list-card-head">
        <div>
          <h3>${item.name}</h3>
          <p>${item.ip} · ${item.wg_interface}</p>
        </div>
        <button class="btn btn-danger" type="button" data-action="delete-client" data-id="${item.id}">Delete</button>
      </div>
      <div class="button-row">
        <button class="btn btn-secondary" type="button" data-action="preview-config" data-id="${item.id}">Show Config</button>
        <button class="btn btn-secondary" type="button" data-action="preview-qr" data-id="${item.id}">Show QR</button>
        <button class="btn btn-ghost" type="button" data-action="download-config" data-id="${item.id}">Download .conf</button>
        <button class="btn btn-ghost" type="button" data-action="download-qr" data-id="${item.id}">Download SVG</button>
      </div>
    `;
    elements.clientsList.appendChild(card);
  }
}

async function refreshData() {
  setError('');
  const [interfacesResponse, clientsResponse] = await Promise.all([
    apiRequest('/interfaces'),
    apiRequest('/clients'),
  ]);
  state.interfaces = interfacesResponse.items || [];
  state.clients = clientsResponse.items || [];
  renderMetrics();
  renderClientInterfaceOptions();
  renderInterfaces();
  renderClients();
}

async function handleLogin(event) {
  event.preventDefault();
  setError('', elements.loginError);
  state.apiKey = document.getElementById('api-key').value.trim();

  if (!state.apiKey) {
    setError('API token is required.', elements.loginError);
    return;
  }

  try {
    await apiRequest('/health');
    elements.loginView.hidden = true;
    elements.appView.hidden = false;
    await refreshData();
  } catch (error) {
    setError(error.message, elements.loginError);
    state.apiKey = '';
  }
}

function logout() {
  state.apiKey = '';
  state.interfaces = [];
  state.clients = [];
  elements.loginForm.reset();
  elements.loginView.hidden = false;
  elements.appView.hidden = true;
  elements.configOutput.textContent = 'Select a client to preview its .conf';
  elements.qrOutput.textContent = 'Select a client to preview its QR';
  setError('');
  setError('', elements.loginError);
}

function parseJsonField(rawValue) {
  const cleaned = rawValue.trim();
  if (!cleaned) {
    return undefined;
  }
  return JSON.parse(cleaned);
}

async function createInterface(event) {
  event.preventDefault();
  setError('');
  try {
    const formData = new FormData(elements.interfaceForm);
    const payload = {
      wg_interface: String(formData.get('wg_interface') || '').trim(),
      awg_version: String(formData.get('awg_version') || '').trim(),
      port_number: Number(formData.get('port_number')),
      wg_ip_addr: String(formData.get('wg_ip_addr') || '').trim(),
      wg_ip_cidr: Number(formData.get('wg_ip_cidr')),
      srv_ip: String(formData.get('srv_ip') || '').trim(),
      srv_dns: String(formData.get('srv_dns') || '').trim(),
    };
    const rawParams = formData.get('awg_params');
    if (typeof rawParams === 'string' && rawParams.trim()) {
      payload.awg_params = parseJsonField(rawParams);
    }
    await apiRequest('/interfaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    elements.interfaceForm.reset();
    elements.interfaceForm.querySelector('select[name="awg_version"]').value = '2';
    elements.interfaceForm.querySelector('input[name="port_number"]').value = '51820';
    elements.interfaceForm.querySelector('input[name="wg_ip_cidr"]').value = '24';
    await refreshData();
  } catch (error) {
    setError(error.message);
  }
}

async function createClient(event) {
  event.preventDefault();
  setError('');
  try {
    const formData = new FormData(elements.clientForm);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      wg_interface: String(formData.get('wg_interface') || '').trim(),
    };
    const clientIp = String(formData.get('ip') || '').trim();
    if (clientIp) {
      payload.ip = clientIp;
    }
    await apiRequest('/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    elements.clientForm.reset();
    await refreshData();
    activateTab('clients');
  } catch (error) {
    setError(error.message);
  }
}

async function deleteItem(kind, id) {
  const message = kind === 'client'
    ? 'Delete this client?'
    : 'Delete this interface?';
  if (!window.confirm(message)) {
    return;
  }
  try {
    await apiRequest(`/${kind === 'client' ? 'clients' : 'interfaces'}/${id}`, {
      method: 'DELETE',
    });
    await refreshData();
  } catch (error) {
    setError(error.message);
  }
}

async function showConfig(clientId) {
  try {
    const response = await apiRequest(`/clients/${clientId}/config`);
    elements.configOutput.textContent = response.config || '';
    activateTab('clients');
  } catch (error) {
    setError(error.message);
  }
}

async function showQr(clientId) {
  try {
    const response = await fetch(`/clients/${clientId}/qr?format=svg`, {
      headers: apiHeaders(),
    });
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || 'Failed to load QR');
    }
    elements.qrOutput.innerHTML = await response.text();
    activateTab('clients');
  } catch (error) {
    setError(error.message);
  }
}

async function downloadFile(path, fileName) {
  const response = await fetch(path, {
    headers: apiHeaders(),
  });
  if (!response.ok) {
    let errorMessage = `Download failed with status ${response.status}`;
    try {
      const payload = await response.json();
      errorMessage = payload.error || errorMessage;
    } catch (error) {
      // Keep the generic error from above if the body is not JSON.
    }
    throw new Error(errorMessage);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function handleClientsListClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }
  const { action, id } = button.dataset;
  try {
    if (action === 'delete-client') {
      await deleteItem('client', id);
      return;
    }
    if (action === 'preview-config') {
      await showConfig(id);
      return;
    }
    if (action === 'preview-qr') {
      await showQr(id);
      return;
    }
    if (action === 'download-config') {
      await downloadFile(`/clients/${id}/config/download`, `client-${id}.conf`);
      return;
    }
    if (action === 'download-qr') {
      await downloadFile(`/clients/${id}/qr/download?format=svg`, `client-${id}.svg`);
    }
  } catch (error) {
    setError(error.message);
  }
}

async function handleInterfacesListClick(event) {
  const button = event.target.closest('button[data-action="delete-interface"]');
  if (!button) {
    return;
  }
  await deleteItem('interface', button.dataset.id);
}

function wireEvents() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.interfaceForm.addEventListener('submit', createInterface);
  elements.clientForm.addEventListener('submit', createClient);
  elements.clientsList.addEventListener('click', handleClientsListClick);
  elements.interfacesList.addEventListener('click', handleInterfacesListClick);
  elements.refreshAll.addEventListener('click', () => refreshData().catch((error) => setError(error.message)));
  elements.logoutButton.addEventListener('click', logout);
  for (const tab of elements.tabs) {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  }
}

wireEvents();
activateTab('interfaces');
