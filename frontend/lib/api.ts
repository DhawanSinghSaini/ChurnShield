const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('cs_token');
}

// Internal helper to perform fetch requests with retry resilience for cold-starts
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, delayMs = 4000): Promise<Response> {
  let lastError: any = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      
      // If we get a server response, stop retrying (even if status is 4xx/5xx)
      // This is because a cold start failure is a network drop/failure to connect, not a 404/500 code
      return res;
    } catch (err: any) {
      lastError = err;
      console.warn(`Connection failed (attempt ${i + 1}/${retries}). Server may be spinning up from sleep. Retrying in ${delayMs}ms...`);
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delayMs));
      }
    }
  }
  
  throw new Error(lastError?.message || 'Connection failed. The free-tier server is taking longer than expected to wake up.');
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  
  const response = await fetchWithRetry(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errBody.error || `Error ${response.status}`);
  }

  return response.json();
}

// Specialised PDF fetch — returns a Blob instead of JSON
export async function apiFetchBlob(path: string): Promise<Blob> {
  const token = getToken();
  const response = await fetchWithRetry(`${API_BASE}${path}`, {
    headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
  });
  
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.blob();
}
