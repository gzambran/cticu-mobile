// For development, you might need to use your local IP address
// For example: 'http://192.168.1.100:3000' (replace with your actual local IP)
// To find your IP on Mac: System Preferences > Network > Wi-Fi > Advanced > TCP/IP

const ENV = {
  production: {
    API_BASE_URL: 'https://cticu.zambrano.nyc',
  },
  development: {
    // Change this to your local IP if testing on a physical device
    API_BASE_URL: 'https://cticu.zambrano.nyc',
    // API_BASE_URL: 'http://192.168.1.100:3000', // Example for local development
  },
};

const getEnvVars = () => {
  // You can change this to 'development' when testing locally
  return __DEV__ ? ENV.development : ENV.production;
};

export default getEnvVars();