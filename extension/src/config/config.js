import {loadConfig} from './config-loader.js'
import ctpClientBuilder from "../ctp.js";

let config
let powerboardConfig;
let ctpClient;

function getExtensionUrl() {
    return  process.env.CONNECT_SERVICE_URL;
}

function getModuleConfig() {
    return {
        removeSensitiveData: true,
        port: config.port,
        logLevel: config.logLevel,
        apiExtensionBaseUrl:  getExtensionUrl(),
        basicAuth: true,
        projectKey: config.projectKey,
        keepAliveTimeout: 30,
        addCommercetoolsLineIteprojectKey: false,
        generateIdempotencyKey: false
    }
}

async function getCtpClient() {
    if(!ctpClient){
        ctpClient = await ctpClientBuilder.get(getExtensionConfig())
    }
    return ctpClient;
}
async function getPowerboardApiUrl() {
    const powerboardC = await getPowerboardConfig('connection');
    return powerboardC.api_url;
}

function getAuthorizationHeaderValue() {
   return  process.env.AUTH_HEADER_VALUE ?? null;
}

function getExtensionConfig() {
    return {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        projectKey: config.projectKey,
        apiUrl: config.apiUrl,
        authUrl: config.authUrl
    }
}

function getWidgetConfig() {
    return {
        widget_url: config.powerboardWidgetUrl ?? null,
        widget_test_url: config.powerboardWidgetTestUrl ?? null,
        type_sdk: config.powerboardWidgetTypeSdk ?? null
    }
}

async function getPowerboardConfig(type = 'all', disableCache = false) {
    if (!powerboardConfig || disableCache) {
        ctpClient = await getCtpClient();
        const responsePowerboardConfig = await ctpClient.fetchById(
            ctpClient.builder.customObjects,
            'powerboardConfigContainer',
        )
        if (responsePowerboardConfig.body.results) {
            powerboardConfig = {};
            const results = responsePowerboardConfig.body.results.sort((a,b) => {
                if (a.version > b.version){
                    return 1;
                } 
                return -1;
                
            });
            results.forEach((element) => {
                powerboardConfig[element.key] = element.value;
            });
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
            'Please verify that all projects have projectKey, clientId and clientSecret',
        )
    }
}

loadAndValidateConfig()

export default {
    getModuleConfig,
    getPowerboardConfig,
    getCtpClient,
    getWidgetConfig,
    getExtensionConfig,
    getPowerboardApiUrl,
    getAuthorizationHeaderValue
}
