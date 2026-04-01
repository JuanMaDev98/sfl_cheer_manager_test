// Minimal Supabase browser client
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  from(table) {
    return {
      select: (columns = '*') => this._query(table, columns),
      insert: (data) => this._insert(table, data),
      delete: () => this._delete(table)
    };
  }

  _query(table, columns) {
    return {
      order: (column, opts) => this._fetch(`${this.url}/rest/v1/${table}?select=${columns}&order=${column}.${opts?.ascending !== false ? 'asc' : 'desc'}`),
      then: (resolve, reject) => this._fetch(`${this.url}/rest/v1/${table}?select=${columns}`).then(resolve, reject)
    };
  }

  _insert(table, data) {
    return {
      select: () => this._mutate(`${this.url}/rest/v1/${table}`, {
        method: 'POST',
        body: Array.isArray(data) ? JSON.stringify(data) : JSON.stringify([data])
      })
    };
  }

  _delete(table) {
    return {
      eq: (column, value) => this._mutate(`${this.url}/rest/v1/${table}?${column}=eq.${value}`, {
        method: 'DELETE'
      })
    };
  }

  async _fetch(url) {
    try {
      const response = await fetch(url, { headers: this.headers });
      const data = await response.json();
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async _mutate(url, opts) {
    try {
      const response = await fetch(url, {
        ...opts,
        headers: { ...this.headers, ...(opts.headers || {}) }
      });
      const data = await response.json();
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }
}

function createClient(url, key) {
  return new SupabaseClient(url, key);
}
