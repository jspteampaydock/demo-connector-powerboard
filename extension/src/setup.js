import {serializeError} from "serialize-error";
import config from './config/config.js'
import ctpClientBuilder from './ctp.js'
import utils from './utils.js'
import {ensureResources} from './config/init/ensure-resources.js'
import {generateBasicAuthorizationHeaderValue} from './validator/authentication.js'

const logger = utils.getLogger()

async function setupExtensionResources(apiExtensionBaseUrl) {
    const moduleConfig = config.getModuleConfig()
    const ctpConfig = config.getExtensionConfig()
    const ctpClient = await ctpClientBuilder.get(ctpConfig)
    await Promise.all(
        await ensureResources(
            ctpClient,
            ctpConfig.projectKey,
            apiExtensionBaseUrl || moduleConfig.apiExtensionBaseUrl,
            generateBasicAuthorizationHeaderValue(),
        )
    )
    logger.info(
        `Configured commercetools project keys are: ${JSON.stringify(
            ctpConfig,
        )}. `,
    )
}

async function cleanupExtensionResources() {
    try {
        const ctpConfig = config.getExtensionConfig()
        const ctpClient = await ctpClientBuilder.get(ctpConfig)
        const apiExtensionTemplate = await utils.readAndParseJsonFile(
            'resources/api-extension.json',
        )
        const apiExtensionOrderTemplate = await utils.readAndParseJsonFile(
            'resources/api-order-extension.json',
        )
        await utils.deleteElementByKeyIfExists(ctpClient, apiExtensionTemplate.key)
        await utils.deleteElementByKeyIfExists(ctpClient, apiExtensionOrderTemplate.key)
    } catch (err) {
        throw Error(`Error: ${JSON.stringify(serializeError(err))}`)
    }
}

export {
    setupExtensionResources,
    cleanupExtensionResources
}
