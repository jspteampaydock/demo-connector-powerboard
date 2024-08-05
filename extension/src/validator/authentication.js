import config from '../config/config.js'

function hasValidAuthorizationHeader(authTokenString) {
    if (!authTokenString || authTokenString.indexOf(' ') < 0) return false
    return (config.getAuthorizationHeaderValue() === authTokenString)
}

function isBasicAuthEnabled() {
    return config.getModuleConfig().basicAuth
}

function getAuthorizationRequestHeader(request) {
    return request?.headers?.['authorization']
}


export {
    hasValidAuthorizationHeader,
    getAuthorizationRequestHeader,
    isBasicAuthEnabled,
}
