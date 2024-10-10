/**
 * Set a cookie with the given name and value
 * @param {string} name - The name of the cookie
 * @param {string} value - The value of the cookie
 * @param {number} days - The number of days until the cookie expires
 */
export const setCookie = (name, value, days) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
};

/**
 * Get the value of a cookie by its name
 * @param {string} name - The name of the cookie
 * @returns {string|null} The value of the cookie, or null if not found
 */
export const getCookie = (name) => {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, null);
};

/**
 * Remove a cookie by setting its expiration to the past
 * @param {string} name - The name of the cookie to remove
 */
export const removeCookie = (name) => {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
};

/**
 * Check if a cookie exists
 * @param {string} name - The name of the cookie
 * @returns {boolean} True if the cookie exists, false otherwise
 */
export const hasCookie = (name) => {
    return getCookie(name) !== null;
};