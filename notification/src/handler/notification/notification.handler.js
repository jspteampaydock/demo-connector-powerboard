import {serializeError} from 'serialize-error'
import VError from 'verror'
import config from '../../config/config.js'
import {addPowerboardLog, getLogActions} from '../../utils/logger.js'
import ctp from '../../utils/ctp.js'
import customObjectsUtils from '../../utils/custom-objects-utils.js'
import {callPowerboard} from './powerboard-api-service.js';

async function processNotification(
    notificationResponse
) {
    const {notification, event} = notificationResponse

    const ctpConfig = config.getNotificationConfig()
    const ctpClient = await ctp.get(ctpConfig)

    let result = {}

    if (!notification.reference) {
        result.status = 'Failure'
        result.message = 'Reference not found'
    } else {
        const paymentKey = notification.reference
        let paymentObject = await getPaymentByMerchantReference(ctpClient, paymentKey)

        if (!paymentObject) {
            result.status = 'Failure'
            result.message = 'Payment not found'
        } else if (event !== undefined) {
            switch (event) {
                case 'transaction_success':
                case 'transaction_failure':
                case 'fraud_check_in_review':
                case 'fraud_check_in_review_async_approved':
                case 'fraud_check_transaction_in_review_async_approved':
                case 'fraud_check_success':
                case 'fraud_check_transaction_in_review_approved':
                case 'fraud_check_failed':
                case 'fraud_check_transaction_in_review_declined':
                    result = await processWebhook(event, paymentObject, notification, ctpClient)
                    break
                case 'standalone_fraud_check_success':
                case 'standalone_fraud_check_failed':
                case 'standalone_fraud_check_in_review_approved':
                case 'standalone_fraud_check_in_review_declined':
                case 'standalone_fraud_check_in_review_async_approved':
                case 'standalone_fraud_check_in_review_async_declined':
                    result = await processFraudNotification(event, paymentObject, notification, ctpClient)
                    break
                case 'refund_success':
                    result = await processRefundSuccessNotification(event, paymentObject, notification, ctpClient)
                    break
                default:
                    result.status = 'Failure'
                    result.message = 'Notification Event not found'
            }

            const logs = getLogActions();

            if (logs.length) {
                paymentObject = await ctpClient.fetchById(ctpClient.builder.payments, paymentObject.id);
                await ctpClient.update(
                    ctpClient.builder.payments,
                    paymentObject.body.id,
                    paymentObject.body.version,
                    logs
                );
            }
        }
    }

    return result
}

async function processWebhook(event, payment, notification, ctpClient) {
    const result = {}
    const {status, paymentStatus, orderStatus} =  getNewStatuses(notification)
    let customStatus = status;
    const chargeId = notification._id
    const currentPayment = payment
    const currentVersion = payment.version
    const updateActions = [];
    if (status === 'powerboard-paid') {
        const capturedAmount = parseFloat(notification.transaction.amount) || 0
        const orderAmount = calculateOrderAmount(payment);
        customStatus = capturedAmount < orderAmount ? 'powerboard-p-paid' : 'powerboard-paid'
        updateActions.push({
            action: 'setCustomField',
            name: 'CapturedAmount',
            value: capturedAmount
        })
    }

    let operation = notification.type
    operation = operation ? operation.toLowerCase() : 'undefined'
    operation = operation.charAt(0).toUpperCase() + operation.slice(1)

    updateActions.push({
        action: 'setCustomField',
        name: 'PowerboardPaymentStatus',
        value: customStatus
    })

    updateActions.push({
        action: 'setCustomField',
        name: 'PaymentExtensionRequest',
        value: JSON.stringify({
            action: 'FromNotification',
            request: {}
        })
    })
    try {
        await ctpClient.update(
            ctpClient.builder.payments,
            currentPayment.id,
            currentVersion,
            updateActions.concat(getLogActions())
        )
        await updateOrderStatus(ctpClient, currentPayment.id, paymentStatus, orderStatus);
        result.status = 'Success'
    } catch (error) {
        result.status = 'Failure'
        result.message = error
    }

    addPowerboardLog({
        powerboardChargeID: chargeId,
        operation,
        status: result.status,
        message: result.message ?? ''
    })

    return result
}

async function processFraudNotification(event, payment, notification, ctpClient) {
    let result = {}
    const currentPayment = payment
    const currentVersion = payment.version
    const cacheName = `powerboard_fraud_${notification.reference}`

    let operation = notification.type
    operation = operation ? operation.charAt(0).toUpperCase() + operation.slice(1).toLowerCase() : 'Undefined';

    if (notification.status !== 'complete') {
        result.message = operation
        result.powerboardStatus = 'powerboard-failed'
        await customObjectsUtils.removeItem(cacheName)

        const updateActions = [{
            action: 'setCustomField',
            name: 'PowerboardPaymentStatus',
            value: result.powerboardStatus
        },
            {
                action: 'setCustomField',
                name: 'PaymentExtensionRequest',
                value: JSON.stringify({
                    action: 'FromNotification',
                    request: {}
                })
            }]
        try {
            await ctpClient.update(
                ctpClient.builder.payments,
                currentPayment.id,
                currentVersion,
                updateActions.concat(getLogActions())
            )
        } catch (error) {
            result.status = 'Failure'
            result.message = error
        }
    } else {
        result = await processFraudNotificationComplete(event, payment, notification, ctpClient);
    }
    return result
}


async function processFraudNotificationComplete(event, payment, notification, ctpClient) {

    const fraudChargeId = notification._id ?? null;
    const cacheName = `powerboard_fraud_${notification.reference}`
    const result= {};

    let cacheData = await customObjectsUtils.getItem(cacheName)
    if (!cacheData) {
        return {message: 'Fraud data not found in local storage'};
    }
    cacheData = JSON.parse(cacheData)
    const request = generateChargeRequest(notification, cacheData, fraudChargeId)
    const isDirectCharge = cacheData.capture
    await customObjectsUtils.removeItem(cacheName)
    const response = await createCharge(request, {directCharge: isDirectCharge}, true)
    const updatedChargeId = extractChargeIdFromNotification(response);

    if (response?.error) {
        result.status = 'UnfulfilledCondition'
        result.message = `Can't charge.${errorMessageToString(response)}`

        addPowerboardLog({
            powerboardChargeID: updatedChargeId,
            operation: 'Charge',
            status: result.status,
            message: result.message
        })
        return result
    }

    if (cacheData._3ds) {
         const attachResponse =  await createCharge({
            fraud_charge_id: fraudChargeId
        }, {action: 'standalone-fraud-attach', updatedChargeId}, true)
        if (attachResponse?.error) {
            result.status = 'UnfulfilledCondition'
            result.message = `Can't fraud attach.${errorMessageToString(attachResponse)}`

            addPowerboardLog( {
                powerboardChargeID: updatedChargeId,
                operation: 'Fraud Attach',
                status: result.status,
                message: result.message
            })
            return result
        }
    }

    const returnHandleFraudNotification = await handleFraudNotification(response, updatedChargeId, ctpClient, payment)
    return returnHandleFraudNotification;
}

function extractChargeIdFromNotification(response) {
    return response?.resource?.data?._id || response?.resource?.data?.id || 0;
}

async function handleFraudNotification(response, updatedChargeId, ctpClient, payment) {
    let updateActions = [];
    const result= {};
    const currentPayment = payment
    const currentVersion = payment.version
    let status = response?.resource?.data?.status
    status = status ? status.toLowerCase() : 'undefined'
    status = status.charAt(0).toUpperCase() + status.slice(1)

    let operation = response?.resource?.data?.type
    operation = operation ? operation.toLowerCase() : 'undefined'
    operation = operation.charAt(0).toUpperCase() + operation.slice(1)

    const isAuthorization = response?.resource?.data?.authorization ?? 0

    const {commerceToolsPaymentStatus, powerboardStatus} = determineFraudPaymentStatus(isAuthorization, status);
    result.powerboardStatus = powerboardStatus

    updateActions = [
        {
            action: 'setCustomField',
            name: 'PowerboardPaymentStatus',
            value: result.powerboardStatus
        },
        {
            action: 'setCustomField',
            name: 'PowerboardTransactionId',
            value: updatedChargeId
        }
    ]

    try {
        await ctpClient.update(ctpClient.builder.payments, currentPayment.id, currentVersion, updateActions)
        await updateOrderStatus(ctpClient, currentPayment.id, commerceToolsPaymentStatus, 'Open');

        result.status = 'Success'

        addPowerboardLog({
            powerboardChargeID: updatedChargeId,
            operation,
            status: result.status,
            message: ''
        })

        return result
    } catch (error) {
        result.status = 'Failure'
        result.message = error

        updateActions = [
            {
                action: 'setCustomField',
                name: 'PowerboardPaymentStatus',
                value: 'powerboard-failed'
            },
            {
                action: 'setCustomField',
                name: 'PowerboardTransactionId',
                value: updatedChargeId
            },
            {
                action: 'setCustomField',
                name: 'PaymentExtensionRequest',
                value: JSON.stringify({
                    action: 'FromNotification',
                    request: {}
                })
            }
        ]
        await ctpClient.update(ctpClient.builder.payments, currentPayment.id, currentVersion, updateActions)
        await updateOrderStatus(ctpClient, currentPayment.id, 'Failed', 'Cancelled');
    }
    return result;
}

function determineFraudPaymentStatus(isAuthorization, status) {
    if (isAuthorization && ['Pending', 'Pre_authentication_pending'].includes(status)) {
        return {paymentStatus: 'Pending', powerboardStatus: 'powerboard-authorize'};
    }
    const isCompleted = status === 'Complete';
    return {
        paymentStatus: isCompleted ? 'Paid' : 'Pending',
        powerboardStatus: isCompleted ? 'powerboard-paid' : 'powerboard-pending'
    };
}

function generateChargeRequest(notification, cacheData, fraudChargeId) {
    const paymentSource = notification.customer.payment_source

    if (cacheData.gateway_id) {
        paymentSource.gateway_id = cacheData.gateway_id
    }

    const isDirectCharge = cacheData.capture


    const request = {
        amount: notification.amount,
        reference: notification.reference,
        currency: notification.currency,
        customer: {
            first_name: cacheData.billingAddress.firstName,
            last_name: cacheData.billingAddress.lastName,
            email: cacheData.billingAddress.email,
            phone: cacheData.billingAddress.phone
        },
        fraud_charge_id: fraudChargeId,
        capture: isDirectCharge,
        authorization: !isDirectCharge
    }
    request.customer.payment_source = paymentSource
    if (cacheData.charge3dsId) {
        request._3ds_charge_id = cacheData.charge3dsId
    }

    if (cacheData._3ds) {
        request._3ds = cacheData._3ds
    }

    if (cacheData.ccv) {
        request.customer.payment_source.card_ccv = cacheData.ccv
    }
    return request
}

async function createCharge(data, params = {}, returnObject = false) {
    try {
        let url = '/v1/charges'
        if (params.action !== undefined) {
            if (params.action === 'standalone-fraud') {
                url += '/fraud'
            }
            if (params.action === 'standalone-fraud-attach') {
                url += `/${params.chargeId}/fraud/attach`
            }
        }

        if (params.directCharge !== undefined && params.directCharge === false) {
            url += '?capture=false'
        }

        const {response} = await callPowerboard(url, data, 'POST')

        if (returnObject) {
            return response
        }

        if (response.status === 201) {
            return {
                status: 'Success',
                message: 'Charge is created successfully',
                chargeId: response.resource.data._id
            }
        }

        return {
            status: 'Failure',
            message: response?.error?.message,
            chargeId: '0'
        }
    } catch (error) {
        return {
            status: 'Failure',
            message: error.message || 'Unknown error',
            chargeId: '0'
        }
    }
}

async function processRefundSuccessNotification(event, payment, notification, ctpClient) {

    if (!notification.transaction || notification.from_webhook) {
        return {status: 'Failure'};
    }
    const result = {}
    let powerboardStatus
    const chargeId = notification._id
    const currentPayment = payment
    const currentVersion = payment.version

    if (wasMerchantRefundedFromCommercetools(currentPayment)) {
        await ctpClient.update(ctpClient.builder.payments, currentPayment.id, currentVersion, [
            {
                action: 'setCustomField',
                name: 'PaymentExtensionResponse',
                value: null
            },
            {
                action: 'setCustomField',
                name: 'PaymentExtensionRequest',
                value: JSON.stringify({
                    action: 'FromNotification',
                    request: {}
                })
            }
        ])
        return {status: 'Success', message: ''}
    }
    const refundAmount = parseFloat(notification.transaction.amount) || 0
    const orderAmount = parseFloat(payment?.custom?.fields?.CapturedAmount) || 0;
    const oldRefundAmount = parseFloat(payment?.custom?.fields?.RefundedAmount) || 0;
    const notificationStatus = formatNotificationStatus(notification.status);


    if (['REFUNDED', 'REFUND_REQUESTED'].includes(notificationStatus.toUpperCase())) {
        powerboardStatus = (oldRefundAmount + refundAmount) < orderAmount ? 'powerboard-p-refund' : 'powerboard-refunded'
    }
    if (powerboardStatus && refundAmount) {
        const refunded = calculateRefundedAmount(powerboardStatus, oldRefundAmount, refundAmount, orderAmount);
        const updateActions = [
            {
                action: 'setCustomField',
                name: 'PowerboardPaymentStatus',
                value: powerboardStatus
            },
            {
                action: 'setCustomField',
                name: 'RefundedAmount',
                value: refunded
            },
            {
                action: 'setCustomField',
                name: 'PowerboardTransactionId',
                value: chargeId
            },
            {
                action: 'setCustomField',
                name: 'PaymentExtensionRequest',
                value: JSON.stringify({
                    action: 'FromNotification',
                    request: {}
                })
            }
        ]

        try {
            await ctpClient.update(
                ctpClient.builder.payments,
                currentPayment.id,
                currentVersion,
                updateActions.concat(getLogActions())
            )
            await updateOrderStatus(ctpClient, currentPayment.id, 'Paid', 'Complete');

            result.status = 'Success'
            result.message = `Refunded ${refunded}`
        } catch (error) {
            result.status = 'Failure'
            result.message = error
        }
    }
    addPowerboardLog({
        powerboardChargeID: chargeId,
        operation: powerboardStatus,
        status: result.status,
        message: result.message ?? ''
    })

    return result

}

function calculateRefundedAmount(powerboardStatus, oldRefundAmount, refundAmount, orderAmount) {
    return powerboardStatus === 'powerboard-refunded' ? orderAmount : oldRefundAmount + refundAmount;
}

function calculateOrderAmount(payment) {
    let fraction = 1;
    if (payment?.amountPlanned?.type === 'centPrecision') {
        fraction = 10 ** payment.amountPlanned.fractionDigits;
    }
    return payment.amountPlanned.centAmount / fraction;
}

function wasMerchantRefundedFromCommercetools(payment) {
    const prevResponse = payment?.custom?.fields?.PaymentExtensionResponse;
    return prevResponse && JSON.parse(prevResponse)?.message === 'Merchant refunded money';
}

function formatNotificationStatus(status) {
    return status ? status.toLowerCase().charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Undefined';
}

async function updateOrderStatus(
    ctpClient,
    id,
    paymentStatus,
    orderStatus
) {
    let order = await ctpClient.fetchOrderByNymber(ctpClient.builder.orders, id)
    if (order) {
        order = order.body
        const updateOrderActions = [
            {
                action: 'changePaymentState',
                paymentState: paymentStatus,
            },
            {
                action: 'changeOrderState',
                orderState: orderStatus
            }
        ]
        await ctpClient.update(ctpClient.builder.orders, order.id, order.version, updateOrderActions)
    }
}

async function getPaymentByMerchantReference(
    ctpClient,
    paymentKey
) {
    try {
        // eslint-disable-next-line no-shadow
        const result = await ctpClient.fetchById(ctpClient.builder.payments, paymentKey)
        return result.body
    } catch (err) {
        if (err.statusCode === 404) return null
        const errMsg =
            `Failed to fetch a payment` +
            `Error: ${JSON.stringify(serializeError(err))}`
        throw new VError(err, errMsg)
    }
}

function getNewStatuses(notification) {
    let {status} = notification
    status = status ? status.toLowerCase() : 'undefined'
    status = status.charAt(0).toUpperCase() + status.slice(1)

    let powerboardPaymentStatus
    let commerceToolsPaymentStatus
    let orderPaymentStatus


    switch (status.toUpperCase()) {
        case 'COMPLETE':
            powerboardPaymentStatus = 'powerboard-paid'
            commerceToolsPaymentStatus = 'Paid'
            orderPaymentStatus = 'Complete'
            break
        case 'PENDING':
        case 'PRE_AUTHENTICATION_PENDING':
            powerboardPaymentStatus = notification.capture ? 'powerboard-pending' : 'powerboard-authorize'
            commerceToolsPaymentStatus = notification.capture ? 'Pending' : 'Paid'
            orderPaymentStatus = 'Open'
            break
        case 'CANCELLED':
            powerboardPaymentStatus = 'powerboard-cancelled'
            commerceToolsPaymentStatus = 'Paid'
            orderPaymentStatus = 'Cancelled'
            break
        case 'REFUNDED':
            powerboardPaymentStatus = 'powerboard-refunded'
            commerceToolsPaymentStatus = 'Paid'
            orderPaymentStatus = 'Complete'
            break
        case 'REQUESTED':
            powerboardPaymentStatus = 'powerboard-requested'
            commerceToolsPaymentStatus = 'Pending'
            orderPaymentStatus = 'Open'
            break
        case 'FAILED':
        case 'DECLINED':
            powerboardPaymentStatus = 'powerboard-failed'
            commerceToolsPaymentStatus = 'Failed'
            orderPaymentStatus = 'Cancelled'
            break
        default:
            powerboardPaymentStatus = 'powerboard-pending'
            commerceToolsPaymentStatus = 'Pending'
            orderPaymentStatus = 'Open'
    }
    return {status: powerboardPaymentStatus, paymentStatus: commerceToolsPaymentStatus, orderStatus: orderPaymentStatus}
}




function errorMessageToString(response) {
    let result = ` ${response.error?.message ?? ''}`;
    if (response.error?.details) {
        const {details} = response.error;
        if (Array.isArray(details.messages) && details.messages.length > 0) {
            return details.messages[0];
        }
        const firstDetail = Object.values(details)[0];
        if (Array.isArray(firstDetail)) {
            result += ` ${firstDetail.join(',')}`;
        } else {
            result += ` ${Object.values(details).join(',')}`;
        }
    }
    return result.trim();
}

export default {processNotification}
