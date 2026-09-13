export class ApiClient {
  #key = '';
  unlock(key) { this.#key = key; }
  lock() { this.#key = ''; }
  async request(path, options = {}) {
    const response = await fetch('/api/v1' + path, {...options, headers: {'Authorization': 'Bearer ' + this.#key, 'Content-Type': 'application/json'}});
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Check the form fields and try again.');
    return result;
  }
}
