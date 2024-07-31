import config from './config/config.js'

async function setupNotificationResources() {
    try {
        const moduleConfig = await config.getModuleConfig();
        const ctpClient = await config.getCtpClient();

        if (moduleConfig.apiNotificationnBaseUrl) {
            await createCustomObjectNotificationUrl(ctpClient, moduleConfig.apiNotificationnBaseUrl);
        }
    } catch (error) {
        throw error;  // Rethrow the error to ensure the calling function is aware of the failure
    }
}

async function createCustomObjectNotificationUrl(ctpClient, notificationUrl) {
    const objectNotificationUrlDraft = {
        container: "powerboard-notification",
        key: "url",
        value: notificationUrl
    };
    try {
        return await ctpClient.create(ctpClient.builder.customObjects, objectNotificationUrlDraft);
    } catch (error) {
        throw error;  // Rethrow the error to ensure the calling function is aware of the failure
    }
}

export {
    setupNotificationResources
}