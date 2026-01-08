export async function fetchWithRetry(
  url: string, 
  options: RequestInit = {}, 
  retries = 3, 
  delay = 1000
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Retriable error: ${response.status}`);
      }
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    return response;
  } catch (err) {
    if (retries > 0) {
      console.warn(`Retrying... attempts left: ${retries}, error:`, err);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
}