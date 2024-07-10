import config from '../config/config.js'

function getStoredCredential(ctpProjectKey) {
  const ctpConfig = config.getPowerboardConfig(ctpProjectKey)
  let storedCredential = null
  if (ctpConfig.authentication) {
    storedCredential = {
      username: ctpConfig.authentication.username,
      password: ctpConfig.authentication.password,
    }
  }
  return storedCredential
}

function hasValidAuthorizationHeader(storedCredential, authTokenString) {
  if (!authTokenString || authTokenString.indexOf(' ') < 0) return false
  const encodedAuthToken = authTokenString.split(' ')
  const decodedAuthToken = Buffer.from(encodedAuthToken[1], 'base64').toString()
  const credentialString = decodedAuthToken.split(':')
  const username = credentialString[0]
  const password = credentialString[1]

  return (
    storedCredential.username === username &&
    storedCredential.password === password
  )
}

function isBasicAuthEnabled() {
  return config.getModuleConfig().basicAuth
}

function getAuthorizationRequestHeader(request) {
  return request?.headers?.['authorization']
}

function generateBasicAuthorizationHeaderValue(ctpProjectKey) {
  const ctpConfig = config.getPowerboardConfig(ctpProjectKey)
  if (
    ctpConfig?.authentication?.username &&
    ctpConfig?.authentication?.password
  ) {
    const username = ctpConfig.authentication.username
    const password = ctpConfig.authentication.password

    const decodedAuthToken = `${username}:${password}`
    return `Basic ${Buffer.from(decodedAuthToken).toString('base64')}`
  }
  return null
}

export {
  hasValidAuthorizationHeader,
  getAuthorizationRequestHeader,
  generateBasicAuthorizationHeaderValue,
  isBasicAuthEnabled,
  getStoredCredential,
}
