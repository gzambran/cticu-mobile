const ENV = {
  production: {
    API_BASE_URL: 'https://cticu.zambrano.nyc',
  },
  development: {
    API_BASE_URL: 'https://cticu.zambrano.nyc',
  },
};

const getEnvVars = () => {
  return __DEV__ ? ENV.development : ENV.production;
};

export default getEnvVars();