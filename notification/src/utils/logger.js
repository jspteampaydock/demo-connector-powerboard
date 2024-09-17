import bunyan from 'bunyan'
import config from '../config/config.js'

const {logLevel} = config.getModuleConfig()

let obj
let logActions = [];

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

function addPowerboardLog(data) {
    const date = new Date();
    let message = '';
    if (typeof data.message === 'string'){
        message = data.message
    }else{
        message = data?.message?.message ?? ''
    }
    logActions.push({
        "action": "addInterfaceInteraction",
        "type": {
            "key": "powerboard-payment-log-interaction"
        },
        "fields": {
            "createdAt": date.toISOString(),
            "chargeId": data.chargeId,
            "operation": data.operation,
            "status": data.status,
            "message": message
        }
    })
}

function getLogActions(){
    const result = logActions
    logActions = [];

    return result;
}

export {getLogger, addPowerboardLog, getLogActions}
