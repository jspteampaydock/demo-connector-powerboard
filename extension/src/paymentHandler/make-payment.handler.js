import {
    createSetCustomFieldAction,
    createAddTransactionActionByResponse,
    getPaymentKeyUpdateAction, deleteCustomFieldAction,
} from './payment-utils.js'
import c from '../config/constants.js'
import {makePayment} from '../service/web-component-service.js'

async function execute(paymentObject) {
    const makePaymentRequestObj = JSON.parse(
        paymentObject.custom.fields.makePaymentRequest,
    )
    let capturedAmount = paymentObject.amountPlanned.centAmount;
    if (paymentObject.amountPlanned.type === 'centPrecision') {
        const fraction = 10 ** paymentObject.amountPlanned.fractionDigits;
        capturedAmount = paymentObject.amountPlanned.centAmount / fraction;
        makePaymentRequestObj.amount.value = capturedAmount;
    }
    let paymentActions = [];
    const actions = []
    const customFieldsToDelete = [
        'makePaymentRequest',
        'makePaymentResponse',
        'getVaultTokenRequest',
        'getVaultTokenResponse',
        'PaymentExtensionRequest'
    ];

    const [response] = await Promise.all([makePayment(makePaymentRequestObj)])

    if (response.status === 'Failure') {
        const errorMessage = response.message ?? "Invalid transaction details"
        actions.push(createSetCustomFieldAction(c.CTP_INTERACTION_PAYMENT_EXTENSION_RESPONSE, JSON.stringify({
            status: "Failure",
            message: errorMessage
        })));
        paymentActions = await deleteCustomFields(actions, paymentObject, customFieldsToDelete);
        return {
            actions: paymentActions
        };
    }

    const requestBodyJson = JSON.parse(paymentObject?.custom?.fields?.makePaymentRequest);

    const paymentMethod = requestBodyJson?.PowerboardPaymentType;
    const powerboardTransactionId = response?.chargeId ?? requestBodyJson?.PowerboardTransactionId;
    const powerboardStatus = response?.powerboardStatus ?? requestBodyJson?.PowerboardPaymentStatus;
    const commerceToolsUserId = requestBodyJson?.CommerceToolsUserId;
    const additionalInfo = requestBodyJson?.AdditionalInfo;

    if (paymentMethod) {
        actions.push(createSetCustomFieldAction(c.CTP_CUSTOM_FIELD_POWERBOARD_PAYMENT_TYPE, paymentMethod));
    }
    if (powerboardStatus) {
        actions.push(createSetCustomFieldAction(c.CTP_CUSTOM_FIELD_POWERBOARD_PAYMENT_STATUS, powerboardStatus));
    }
    if (powerboardTransactionId) {
        actions.push(createSetCustomFieldAction(c.CTP_CUSTOM_FIELD_POWERBOARD_TRANSACTION_ID, powerboardTransactionId));
    }

    if (commerceToolsUserId) {
        actions.push(createSetCustomFieldAction(c.CTP_CUSTOM_FIELD_COMMERCE_TOOLS_USER, commerceToolsUserId));
    }

    if (additionalInfo) {
        actions.push(createSetCustomFieldAction(c.CTP_CUSTOM_FIELD_ADDITIONAL_INFORMATION, JSON.stringify(additionalInfo)));
    }
    const updatePaymentAction = getPaymentKeyUpdateAction(
        paymentObject.key,
        {body: paymentObject.custom.fields.makePaymentRequest},
        response,
    )
    if (updatePaymentAction) actions.push(updatePaymentAction)

    const addTransactionAction = createAddTransactionActionByResponse(
        paymentObject.amountPlanned.centAmount,
        paymentObject.amountPlanned.currencyCode,
        response,
    )

    if (addTransactionAction) {
        actions.push(addTransactionAction)
    }

    if (powerboardStatus) {
        const {orderState, orderPaymentState} = await getCommercetoolsStatusesByPowerboardStatus(powerboardStatus)
        actions.push(createSetCustomFieldAction(c.CTP_INTERACTION_PAYMENT_EXTENSION_RESPONSE, JSON.stringify({
            orderPaymentStatus: orderPaymentState,
            orderStatus: orderState
        })));
        if (powerboardStatus === c.STATUS_TYPES.PAID) {
            actions.push(createSetCustomFieldAction('CapturedAmount', capturedAmount));
        }
    } else {
        customFieldsToDelete.push(c.CTP_INTERACTION_PAYMENT_EXTENSION_RESPONSE)
    }

    paymentActions = await deleteCustomFields(actions, paymentObject, customFieldsToDelete)
    return {
        actions: paymentActions
    }
}

async function getCommercetoolsStatusesByPowerboardStatus(powerboardStatus) {
    let orderPaymentState
    let orderState

    switch (powerboardStatus) {
        case c.STATUS_TYPES.PAID:
        case c.STATUS_TYPES.P_PAID:
        case c.STATUS_TYPES.REFUNDED:
        case c.STATUS_TYPES.P_REFUND:
            orderPaymentState = 'Paid'
            orderState = 'Complete'
            break
        case c.STATUS_TYPES.AUTHORIZE:
            orderPaymentState = 'Paid'
            orderState = 'Open'
            break
        case c.STATUS_TYPES.CANCELLED:
            orderPaymentState = 'Paid'
            orderState = 'Cancelled'
            break
        case c.STATUS_TYPES.FAILED:
            orderPaymentState = 'Failed'
            orderState = 'Cancelled'
            break
        default:
            orderPaymentState = 'Pending'
            orderState = 'Open'
    }

    return {orderState, orderPaymentState}
}


async function deleteCustomFields(actions, paymentObject, customFieldsToDelete) {
    const customFields = paymentObject?.custom?.fields;
    if (customFields) {
        customFieldsToDelete.forEach(field => {
            if (typeof customFields[field] !== 'undefined' && customFields[field]) {
                actions.push(deleteCustomFieldAction(field));
            }
        });
    }

    return actions
}


export default {execute}
