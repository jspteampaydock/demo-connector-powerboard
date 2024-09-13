import _ from 'lodash'
import {serializeError} from 'serialize-error'
import utils from '../../utils.js'

const mainLogger = utils.getLogger()

async function initApiExtensions(
    ctpClient,
    ctpProjectKey,
    ctpPowerboardIntegrationBaseUrl,
    authHeaderValue
) {

  const apiExtensionTemplate = await utils.readAndParseJsonFile(
      'resources/api-extension.json',
  )

  apiExtensionTemplate.destination.authentication = JSON.parse(
      `{` +
      `      "type": "AuthorizationHeader",` +
      `      "headerValue": "${authHeaderValue}"` +
      `    }`,
  )


  try {
    const logger = mainLogger.child({
      commercetools_project_key: ctpProjectKey,
    })
    const extensionDraft = JSON.parse(
        _.template(JSON.stringify(apiExtensionTemplate))({
          ctpPowerboardIntegrationBaseUrl,
        }),
    )
    await utils.deleteElementByKeyIfExists(ctpClient, apiExtensionTemplate.key)
    await ctpClient.create(ctpClient.builder.extensions, extensionDraft)
    logger.info(
        'Successfully created an API extension for payment resource type ' +
        `(key=${apiExtensionTemplate.key})`,
    )
  } catch
      (err) {
    throw Error(
        `Failed to sync API extension (key=${apiExtensionTemplate.key}). ` +
        `Error: ${JSON.stringify(serializeError(err))}`,
    )
  }
}


export {initApiExtensions}
