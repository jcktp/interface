import {ApiClient} from './api.js';
const el = id => document.getElementById(id);

class DirectoryApp {
  constructor(api) {
    this.api = api;
    this.role = ''; this.offset = 0; this.editing = null; this.requestVersion = 0;
    el('login').onsubmit = event => this.login(event);
    el('logout').onclick = () => this.lock();
    el('search').onsubmit = event => { event.preventDefault(); this.offset = 0; this.load().catch(error => this.message(error)); };
    el('previous').onclick = () => this.page(-20);
    el('next').onclick = () => this.page(20);
    el('add').onclick = () => this.openEditor();
    el('cancel').onclick = () => el('editor').close();
    el('person-form').onsubmit = event => this.save(event);
  }
  message(error) { el('message').textContent = error.message; }
  async login(event) {
    event.preventDefault(); this.api.unlock(el('key').value); el('message').textContent = '';
    try {
      this.role = (await this.api.request('/me')).role;
      this.offset = 0;
      await this.load();
      el('key').value = ''; el('access').hidden = true; el('directory').hidden = false;
      el('logout').hidden = false; el('add').hidden = this.role !== 'admin';
    } catch (error) { this.api.lock(); this.message(error); }
  }
  lock() {
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
    el('empty-text').textContent = el('query').value ? 'No matches. Try a different name or department.' : this.role === 'admin' ? 'Add your first colleague to get started.' : 'Your administrator can add people here.';
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
    }
    row.append(actions); return row;
  }
  openEditor(person = null) {
    this.editing = person; el('person-form').reset(); el('form-message').textContent = '';
    el('editor-title').textContent = person ? 'Edit person' : 'Add person';
    if (person) for (const field of ['name', 'email', 'title', 'department', 'status']) el(field).value = person[field];
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
