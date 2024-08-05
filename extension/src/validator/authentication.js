import config from '../config/config.js'

function hasValidAuthorizationHeader(authTokenString) {
    if (!authTokenString || authTokenString.indexOf(' ') < 0) return false
    return (config.getAuthorizationHeaderValue() === authTokenString)
}

function getAuthorizationRequestHeader(request) {
    return request?.headers?.['x-auth-token']
}

export {
    hasValidAuthorizationHeader,
    getAuthorizationRequestHeader
}
