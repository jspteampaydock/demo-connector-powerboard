import config from '../config/config.js'

function hasValidAuthorizationHeader(authTokenString) {
    return (config.getAuthorizationHeaderValue() === authTokenString)
}

function getAuthorizationRequestHeader(request) {
    return request?.headers?.['x-auth-token']
}

export {
    hasValidAuthorizationHeader,
    getAuthorizationRequestHeader
}
