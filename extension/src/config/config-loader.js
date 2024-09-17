import { config } from "dotenv";

const requiredEnvVars = [
  'COMMERCETOOLS_CLIENT_ID',
  'COMMERCETOOLS_CLIENT_SECRET',
  'COMMERCETOOLS_PROJECT_KEY',
  'COMMERCETOOLS_API_URL',
  'COMMERCETOOLS_AUTH_URL',
  'POWERBOARD_API_LIVE_URL',
  'POWERBOARD_API_SANDBOX_URL',
  'POWERBOARD_WIDGET_TYPE_SDK',
  'POWERBOARD_WIDGET_URL',
  'POWERBOARD_WIDGET_TEST_URL'
];

function loadConfig() {
  config();
  if (requiredEnvVars.every(varName => process.env[varName])) {
    return loadFromPowerboardIntegrationEnvVar();
  }
  return {};
}

function loadFromPowerboardIntegrationEnvVar() {
  const envConfig = {
    clientId: process.env.COMMERCETOOLS_CLIENT_ID,
    clientSecret: process.env.COMMERCETOOLS_CLIENT_SECRET,
    projectKey: process.env.COMMERCETOOLS_PROJECT_KEY,
    apiUrl: process.env.COMMERCETOOLS_API_URL,
    authUrl: process.env.COMMERCETOOLS_AUTH_URL,
    powerboardSandboxUrl: process.env.POWERBOARD_API_SANDBOX_URL,
    powerboardStagingUrl: process.env.POWERBOARD_API_STAGING_URL,
    powerboardLiveUrl: process.env.POWERBOARD_API_LIVE_URL,
    powerboardWidgetTypeSdk: process.env.POWERBOARD_WIDGET_TYPE_SDK,
    powerboardWidgetUrl: process.env.POWERBOARD_WIDGET_URL,
    powerboardWidgetTestUrl: process.env.POWERBOARD_WIDGET_TEST_URL,
  };
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  return envConfig;
}

export { loadConfig };
