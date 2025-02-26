import {serializeError} from 'serialize-error'
import httpUtils from '../../utils.js'
import {getAuthorizationRequestHeader} from '../../validator/authentication.js'
import paymentHandler from '../../paymentHandler/payment-handler.js'

const logger = httpUtils.getLogger()

async function processRequest(request, response) {
    if (request.method !== 'POST') {
        return httpUtils.sendResponse({
            response,
            statusCode: 400,
            data: {
                errors: [
                    {
                        code: 'InvalidInput',
                        message: 'Invalid HTTP method...',
                    },
                ],
            },
        })
    }
    let paymentObject = {}
    try {
        const authToken = getAuthorizationRequestHeader(request)
        paymentObject = await _getPaymentObject(request)
        const paymentResult =  await paymentHandler.handlePaymentByExtRequest(paymentObject, authToken);
        if (paymentResult === null) {
            return httpUtils.sendResponse({response, statusCode: 200, data: {actions: []}})
        }

        if (paymentResult.actions) {
            paymentResult.actions = paymentResult.actions.concat(httpUtils.getLogsAction())
        }

        const result = {
            response,
            statusCode: paymentResult.actions ? 200 : 400,
            data: paymentResult.actions
                ? paymentResult
                : {errors: paymentResult.errors},
        }

        logger.debug('Data to be returned', JSON.stringify(result.data))
        return httpUtils.sendResponse(result)
    } catch (err) {
        return httpUtils.sendResponse({
            response,
            statusCode: 400,
            data: httpUtils.handleUnexpectedPaymentError(paymentObject, err),
        })
    }
}

async function _getPaymentObject(request) {
    let body = {}
    try {
        body = await httpUtils.collectRequestData(request)
        const requestBody = JSON.parse(body)
        return requestBody.resource.obj
    } catch (err) {
        const errorStackTrace =
            `Error during parsing CTP request:  Ending the process. ` +
            `Error: ${JSON.stringify(serializeError(err))}`
        logger.error(errorStackTrace)
        throw err
    }
}

export default {processRequest}
