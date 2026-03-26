// API Configuration — auto-detect local vs production
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
window.VITE_API_URL = isLocal ? window.location.origin : "https://om-services-production.up.railway.app";
const API_BASE_URL = window.VITE_API_URL;
window.API_BASE_URL = API_BASE_URL;
console.log("🔗 API Base URL:", API_BASE_URL);

// Global Fetch Interceptor to handle cross-origin API calls automatically
const originalFetch = window.fetch;
window.fetch = function (resource, init) {
    if (typeof resource === 'string' && resource.startsWith('/api/')) {
        resource = window.API_BASE_URL + resource;
    }
    return originalFetch(resource, init);
};

const API_ENDPOINTS = {


    // Auth
    LOGIN: `${API_BASE_URL}/api/auth/login`,
    GET_CURRENT_ADMIN: `${API_BASE_URL}/api/auth/me`,
    
    // Bookings
    BOOKINGS: `${API_BASE_URL}/api/bookings`,
    BOOKING_BY_ID: (id) => `${API_BASE_URL}/api/bookings/${id}`,
    BOOKING_PDF: (id) => `${API_BASE_URL}/api/bookings/${id}/pdf`,
    EXPORT_EXCEL: `${API_BASE_URL}/api/bookings/export/excel`,
    EXPORT_STATISTICS: `${API_BASE_URL}/api/bookings/export/statistics`,
    STATISTICS: `${API_BASE_URL}/api/bookings/statistics`
};

// Status colors
const STATUS_COLORS = {
    'Pending': '#FFA500',
    'Confirmed': '#4BB543',
    'Completed': '#0066CC',
    'Cancelled': '#FF0000'
};

// Status badges
const STATUS_BADGES = {
    'Pending': 'bg-warning',
    'Confirmed': 'bg-success',
    'Completed': 'bg-primary',
    'Cancelled': 'bg-danger'
};

// Service type colors
const SERVICE_COLORS = {
    'Catering': 'bg-warning',
    'Travels': 'bg-info',
    'Photography': 'bg-primary',
    'Sweet Stall': 'bg-danger'
};

// Local storage keys
const STORAGE_KEYS = {
    TOKEN: 'om_service_token',
    ADMIN: 'om_service_admin'
};

// Toast notification duration
const TOAST_DURATION = 5000;

// Pagination
const ITEMS_PER_PAGE = 20;
