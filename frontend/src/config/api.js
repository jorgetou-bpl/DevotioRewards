const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

if (!BACKEND_URL) {
  // eslint-disable-next-line no-console
  console.error('REACT_APP_BACKEND_URL is not set — API calls will fail.');
}

export const API_BASE_URL = `${BACKEND_URL}/api`;
export default API_BASE_URL;
