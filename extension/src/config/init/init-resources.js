import {
  initPaymentCustomType,
  initCustomerVaultTokens,
} from './init-custom-type.js'
import { initApiExtensions } from './init-api-extensions.js'

function initCustomTypes(ctpClient, ctpProjectKey) {

  return Promise.all([
    initPaymentCustomType(ctpClient, ctpProjectKey),
    initCustomerVaultTokens(ctpClient, ctpProjectKey),
  ])
}

function initResources(
  ctpClient,
  ctpProjectKey,
  apiExtensionBaseUrl,
  authHeaderValue,
) {
  return Promise.all([
    initCustomTypes(ctpClient, ctpProjectKey),
    initApiExtensions(
      ctpClient,
      ctpProjectKey,
      apiExtensionBaseUrl,
      authHeaderValue,
    ),
  ])
}

export { initResources}
