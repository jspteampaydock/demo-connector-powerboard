import { loadConfig } from './config-loader.js'
import ctpClientBuilder from '../utils/ctp.js'

let config
let powerboardConfig
let ctpClient;


function getNotificationUrl() {
  return  process.env.CONNECT_SERVICE_URL;
}

async function getCtpClient() {
  if(!ctpClient){
    ctpClient = await ctpClientBuilder.get(getNotificationConfig())
  }
  return ctpClient;
}

function getModuleConfig() {

  return {
    removeSensitiveData: true,
    port: config.port,
    logLevel: config.logLevel,
    apiNotificationnBaseUrl: getNotificationUrl(),
    basicAuth: false,
    projectKey: config.projectKey,
    keepAliveTimeout: 30,
    addCommercetoolsLineIteprojectKey: false,
    generateIdempotencyKey: false
  }
}

async function getPowerboardApiUrl(){
  const powerboardC = await getPowerboardConfig('connection');
  return powerboardC.api_url;
}

function getNotificationConfig() {
  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    projectKey: config.projectKey,
    apiUrl: config.apiUrl,
    authUrl: config.authUrl
  }
}

async function getPowerboardConfig(type = 'all') {
  if (!powerboardConfig) {
    ctpClient = await getCtpClient();
    const responsePowerboardConfig = await ctpClient.fetchById(
      ctpClient.builder.customObjects,
      'powerboardConfigContainer'
    )
    if (responsePowerboardConfig.body.results) {
      powerboardConfig = {}
      const {results} = responsePowerboardConfig.body
      results.forEach((element) => {
        powerboardConfig[element.key] = element.value
      })
    }
  }
  switch (type) {
    case 'connection':
      if (powerboardConfig['sandbox']?.sandbox_mode === 'Yes') {
        powerboardConfig['sandbox'].api_url = config.powerboardSandboxUrl;
        return powerboardConfig['sandbox'] ?? {};
      }
      powerboardConfig['live'].api_url = config.powerboardLiveUrl;
      return powerboardConfig['live'] ?? {};

    case 'widget:':
      return powerboardConfig['live'] ?? {};
    default:
      return powerboardConfig
  }

}

function loadAndValidateConfig() {
  config = loadConfig()
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      `[ CTP project credentials are missing. ` +
      'Please verify that all projects have projectKey, clientId and clientSecret'
    )
  }
}

loadAndValidateConfig()

// Using default, because the file needs to be exported as object.
export default {
  getModuleConfig,
  getPowerboardConfig,
  getPowerboardApiUrl,
  getCtpClient,
  getNotificationConfig
}
