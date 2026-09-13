import {ApiClient} from './api.js';
import {EmployeeWorkspace as WorkspaceViews} from './employee-workspace.js';
const el = id => document.getElementById(id);

class DirectoryApp {
  constructor(api) {
    this.api = api;
    this.role = ''; this.offset = 0; this.editing = null; this.requestVersion = 0;
    this.current = {}; this.workspace = new WorkspaceViews(api, this.current, () => this.lock());
    document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => this.navigate(button.dataset.view));
    el('signin').onsubmit = event => this.signin(event);
    el('login').onsubmit = event => this.login(event);
    el('logout').onclick = () => this.lock();
    el('search').onsubmit = event => { event.preventDefault(); this.offset = 0; this.load().catch(error => this.message(error)); };
    el('previous').onclick = () => this.page(-20);
    el('next').onclick = () => this.page(20);
    el('add').onclick = () => this.openEditor();
    el('cancel').onclick = () => el('editor').close();
    el('person-form').onsubmit = event => this.save(event);
    this.initializeSSO();
  }
  async initializeSSO() {
    const outcome = new URLSearchParams(location.search).get('sso');
    if (outcome) history.replaceState(null, '', '/');
    try {
      const result = await this.api.request('/auth/sso/providers');
      for (const provider of result.items) {
        const link = document.createElement('a'); link.className = 'sso-button';
        link.textContent = 'Continue with ' + provider.name;
        link.href = '/api/v1/auth/sso/' + encodeURIComponent(provider.id) + '/start';
        el('sso-buttons').append(link);
      }
      if (outcome === 'failed') throw new Error('Single sign-on failed. Check that your administrator linked your identity to an active Interface account, then try again.');
      if (outcome === 'complete') {
        const session = await this.api.request('/auth/sso/session', {method:'POST'});
        this.api.unlock(session.access_token); await this.finishLogin();
        el('access').hidden = true; el('logout').hidden = false; el('add').hidden = this.role !== 'admin';
        await this.navigate(this.current.person_id ? 'profile' : 'directory');
      }
    } catch(error) { this.api.lock(); this.message(error); }
  }
  message(error) { el('message').textContent = error.message; }
  async login(event) {
    event.preventDefault(); this.api.unlock(el('key').value); el('message').textContent = '';
    try {
      await this.finishLogin();
      this.offset = 0;
      await this.load();
      el('key').value = ''; el('access').hidden = true; el('directory').hidden = false;
      el('logout').hidden = false; el('add').hidden = this.role !== 'admin';
    } catch (error) { this.api.lock(); this.message(error); }
  }
  async finishLogin() {
    this.current = await this.api.request('/me'); this.role = this.current.role; this.workspace.current = this.current;
    document.querySelectorAll('[data-view]').forEach(button => {
      const view = button.dataset.view;
      button.hidden = view === 'directory' ? false : view === 'profile' ? !this.current.person_id : ['leave','tasks'].includes(view) ? this.role === 'reader' : this.role !== 'admin';
    });
  }
  async signin(event) {
    event.preventDefault(); el('message').textContent = '';
    try {
      const result = await this.api.request('/auth/login', {method:'POST',body:JSON.stringify({email:el('login-email').value,password:el('login-password').value})});
      this.api.unlock(result.access_token); el('login-password').value = ''; await this.finishLogin();
      el('access').hidden = true; el('logout').hidden = false; el('add').hidden = this.role !== 'admin';
      await this.navigate(this.current.person_id ? 'profile' : 'directory');
    } catch(error) { this.api.lock(); this.message(error); }
  }
  async navigate(view) {
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('nav-active',button.dataset.view === view));
    el('page-title').textContent = {directory:'People',profile:'My workspace',leave:'Time off',tasks:'Onboarding',insights:'Insights & planning',accounts:'Accounts',connectors:'Connectors',talent:'Hiring & quality',imports:'Import data',hires:'Hire inbox'}[view] || 'Employment';
    el('directory').hidden = view !== 'directory'; el('workspace').hidden = view === 'directory';
    if(view === 'directory') { this.workspace.clear(); try { await this.load(); } catch(error) { this.message(error); } }
    else await this.workspace.show(view);
  }
  async lock() {
    try { await this.api.request('/auth/logout',{method:'POST'}); } catch(error) { /* Local access keys do not create sessions. */ }
    this.workspace.clear(); el('workspace').hidden = true;
    document.querySelectorAll('[data-view]').forEach(button => button.hidden = button.dataset.view !== 'directory');
    this.requestVersion++; this.api.lock(); this.role = ''; this.editing = null;
    el('rows').replaceChildren(); el('person-form').reset(); el('editor').close();
    el('directory').hidden = true; el('access').hidden = false; el('logout').hidden = true;
    el('message').textContent = ''; el('key').focus();
  }
  page(delta) { this.offset = Math.max(0, this.offset + delta); this.load().catch(error => this.message(error)); }
  async load() {
    const version = ++this.requestVersion;
    const data = await this.api.request('/people?' + new URLSearchParams({q: el('query').value, limit: 20, offset: this.offset}));
    if (version !== this.requestVersion) return; // Never render an older search over a newer one.
    el('rows').replaceChildren(...data.items.map(person => this.row(person)));
    el('count').textContent = `${data.total} ${data.total === 1 ? 'person' : 'people'} · ${this.role === 'admin' ? 'Administrator' : 'Read access'}`;
    el('empty').hidden = data.total !== 0;
    el('empty-text').textContent = el('query').value ? 'No matches. Try a different name or department.' : this.role === 'admin' ? 'Import a CSV, review ATS hires, or add your first colleague.' : 'Your administrator can add people here.';
    el('page').textContent = data.total ? `${this.offset + 1}–${Math.min(this.offset + 20, data.total)} of ${data.total}` : '0 people';
    el('previous').disabled = this.offset === 0; el('next').disabled = this.offset + 20 >= data.total;
  }
  row(person) {
    const row = document.createElement('tr');
    for (const field of ['name', 'title', 'department', 'status']) {
      const cell = document.createElement('td');
      const text = document.createElement(field === 'status' ? 'span' : 'div');
      text.textContent = person[field] || '—';
      if (field === 'status') text.className = 'badge ' + person.status;
      cell.append(text);
      if (field === 'name') { const email = document.createElement('small'); email.textContent = person.email; cell.append(email); }
      row.append(cell);
    }
    const actions = document.createElement('td');
    if (this.role === 'admin') {
      const edit = document.createElement('button'); edit.className = 'secondary'; edit.textContent = 'Edit';
      edit.setAttribute('aria-label', 'Edit ' + person.name); edit.onclick = () => this.openEditor(person); actions.append(edit);
      const employment = document.createElement('button'); employment.className = 'secondary'; employment.textContent = 'Employee record'; employment.onclick = async () => { el('directory').hidden = true; el('workspace').hidden = false; await this.workspace.employeeRecord(person); }; actions.append(employment);
    }
    row.append(actions); return row;
  }
  openEditor(person = null) {
    this.editing = person; el('person-form').reset(); el('form-message').textContent = '';
    el('editor-title').textContent = person ? 'Edit person' : 'Add person';
    if (person) for (const field of ['name', 'email', 'title', 'department', 'preferred_name', 'status']) el(field).value = person[field];
    el('editor').showModal();
  }
  async save(event) {
    event.preventDefault(); el('save').disabled = true; el('form-message').textContent = '';
    const data = Object.fromEntries(new FormData(event.target));
    if (this.editing) data.version = this.editing.version;
    try {
      await this.api.request('/people' + (this.editing ? '/' + this.editing.id : ''), {method: this.editing ? 'PUT' : 'POST', body: JSON.stringify(data)});
    } catch (error) { el('form-message').textContent = error.message; return; }
    finally { el('save').disabled = false; }
    el('editor').close(); el('message').textContent = '';
    try { await this.load(); } catch (error) { this.message(error); }
  }
}
new DirectoryApp(new ApiClient());
