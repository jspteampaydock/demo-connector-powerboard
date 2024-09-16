import bunyan from 'bunyan'
import config from '../config/config.js'

const {logLevel} = config.getModuleConfig()

let obj

function getLogger() {
    if (obj === undefined) {
        const NOTIFICATION_MODULE_NAME = 'ctp-powerboard-integration-notifications'
        obj = bunyan.createLogger({
            name: NOTIFICATION_MODULE_NAME,
            stream: process.stdout,
            level: logLevel || bunyan.INFO,
            serializers: {
                err: bunyan.stdSerializers.err,
                cause: bunyan.stdSerializers.err,
            },
        })
    }
    return obj
}

async function addPowerboardLog(paymentId, version, data) {
    const date = new Date();

    const updateActions = [
        {
            "action": "addInterfaceInteraction",
            "type": {
                "key": "powerboard-payment-log-interaction"
            },
            "fields": {
                "createdAt": date.toISOString(),
                "chargeId": data.chargeId,
                "operation": data.operation,
                "status": data.status,
                "message": data.message
            }
        }
    ];

    const ctpClient = await config.getCtpClient();
    const result = await ctpClient.update(
        ctpClient.builder.payments,
        paymentId.id,
        version,
        updateActions
    );

    return result?.body?.version;
}

export {getLogger, addPowerboardLog}
