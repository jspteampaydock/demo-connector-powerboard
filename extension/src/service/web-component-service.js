import {serializeError} from 'serialize-error';
import config from '../config/config.js';
import c from '../config/constants.js';
import httpUtils from "../utils.js";
import ctp from "../ctp.js";
import customObjectsUtils from "../utils/custom-objects-utils.js";
import {callPowerboard} from './powerboard-api-service.js';
import {updateOrderPaymentState} from './ct-api-service.js';

const logger = httpUtils.getLogger();

async function makePayment(makePaymentRequestObj, paymentObject) {
    try {
        const orderId = makePaymentRequestObj.orderId;
        const paymentSource = makePaymentRequestObj.PowerboardTransactionId;
        const paymentType = makePaymentRequestObj.PowerboardPaymentType;
        const input = makePaymentRequestObj;
        const additionalInformation = input.AdditionalInfo ?? {};
        if (additionalInformation) {
            Object.assign(input, additionalInformation);
            delete input['AdditionalInfo'];
        }
        let vaultToken = makePaymentRequestObj.VaultToken;
        let status = "Success";
        let powerboardStatus = "powerboard-pending";
        let message = "Create Charge";

        let response = null;
        let chargeId = 0;

        const configurations = await config.getPowerboardConfig('connection');

        if (vaultToken === undefined || !vaultToken.length) {
            const data = {
                token: makePaymentRequestObj.PowerboardTransactionId
            }
            response = await createVaultToken({
                data,
                userId: input.CommerceToolsUserId,
                saveCard: input.SaveCard,
                type: paymentType,
                configurations
            });
            if (response.status === 'Success') {
                vaultToken = response.token;
            }
            status = response.status;
        }

        let customerId = null;

        if (input.CommerceToolsUserId && input.CommerceToolsUserId !== 'not authorized') {
             customerId = await getCustomerIdByVaultToken(input.CommerceToolsUserId, vaultToken);
        }
        response = await handlePaymentType(input, vaultToken, customerId, makePaymentRequestObj, paymentType, paymentSource, paymentObject);
        if (response) {
            status = response.status;
            message = response.message;
            powerboardStatus = response.powerboardStatus ?? powerboardStatus;
            chargeId = response.chargeId;
        }
        await updateOrderPaymentState(orderId, powerboardStatus);
        httpUtils.addPowerboardLog({
            powerboardChargeID: chargeId,
            operation: powerboardStatus,
            status,
            message
        });
        return response;
    } catch (error) {
        logger.error(`Error in makePayment: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function handlePaymentType(input, vaultToken, customerId, makePaymentRequestObj, paymentType, paymentSource, paymentObject) {
    const configurations = await config.getPowerboardConfig('connection');
    const amount = makePaymentRequestObj.amount.value;
    const currency = makePaymentRequestObj.amount.currency ?? 'AUD';
    try {
        switch (paymentType) {
            case 'card':
                if (configurations.card_use_on_checkout === 'Yes') {
                    return await cardFlow({
                        configurations,
                        input,
                        amount,
                        currency,
                        vaultToken,
                        customerId,
                        paymentObject
                    });
                }
                break;
            case 'Zippay':
            case 'Afterpay v1':
                return await apmFlow({
                    configurations,
                    input,
                    amount,
                    currency,
                    paymentSource,
                    paymentType,
                    paymentObject
                });
            case 'PayPal Smart':
            case 'Google Pay':
            case 'Apple Pay':
            case 'Afterpay v2':
                return {
                    status: 'Success',
                    message: 'Create Charge',
                    powerboardStatus: input.PowerboardPaymentStatus,
                    chargeId: input.charge_id,
                };
            default:
                return {
                    status: 'Error',
                    message: `Unknown payment type: ${paymentType}`,
                    powerboardStatus: input.PowerboardPaymentStatus,
                };
        }
        return null;
    } catch (error) {
        logger.error(`Error in handlePaymentType: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function getVaultToken(getVaultTokenRequestObj) {
    try {
        const {data, userId, saveCard, type} = getVaultTokenRequestObj;
        const configurations = await config.getPowerboardConfig('connection');
        return await createVaultToken({data, userId, saveCard, type, configurations});
    } catch (error) {
        logger.error(`Error in getVaultToken: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function createVaultToken({data, userId, saveCard, type, configurations}) {
    try {
        const {response} = await callPowerboard('/v1/vault/payment_sources/', data, 'POST');

        if (response.status === 201) {
            if (shouldSaveVaultToken({type, saveCard, userId, configurations})) {
                await saveUserToken({token: response.resource.data, user_id: userId, customer_id: null});
            }

            return {
                status: "Success",
                token: response.resource.data.vault_token,
            };
        }
        return {
            status: "Failure",
            message: response?.error?.message,
        };
    } catch (error) {
        logger.error(`Error in createVaultToken: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function createPreCharge(data, capture = true) {
    try {
        const {response} = await callPowerboard(`/v1/charges/wallet?capture=${capture ? 'true' : 'false'}`, data, 'POST');

        if (response.status === 201) {
            return {
                status: "Success",
                token: response.resource.data.token,
                chargeId: response.resource.data.charge._id
            };
        }
        return {
            status: "Failure",
            message: response?.error?.message,
        };
    } catch (error) {
        logger.error(`Error in createPreCharge: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function createStandalone3dsToken(data) {
    try {
        const {response} = await callPowerboard('/v1/charges/standalone-3ds', data, 'POST');

        if (response.status === 201) {
            return {
                status: "Success",
                token: response.resource.data._3ds.token
            };
        }
        return {
            status: "Failure",
            message: response?.error?.message,
        };
    } catch (error) {
        logger.error(`Error in createStandalone3dsToken: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function cardFlow({configurations, input, amount, currency, vaultToken, customerId, paymentObject}) {
    try {
        let result;

        switch (true) {
            case (configurations.card_card_save === 'Enable' && !!customerId):
            case (configurations.card_card_save === 'Enable' && configurations.card_card_method_save !== 'Vault token' && input.SaveCard):
                result = await cardCustomerCharge({
                    configurations,
                    input,
                    amount,
                    currency,
                    vaultToken,
                    customerId,
                    paymentObject
                });
                break;
            case (
                (configurations.card_3ds === 'Standalone 3DS' || configurations.card_3ds === 'In-built 3DS') &&
                (configurations.card_fraud === 'Standalone Fraud' || configurations.card_fraud === 'In-built Fraud')
            ):
                result = await cardFraud3DsCharge({
                    configurations,
                    input,
                    amount,
                    currency,
                    vaultToken,
                    customerId,
                    paymentObject
                });
                break;
            case (configurations.card_3ds === 'Standalone 3DS' || configurations.card_3ds === 'In-built 3DS'):
                result = await card3DsCharge({
                    configurations,
                    input,
                    amount,
                    currency,
                    vaultToken,
                    customerId,
                    paymentObject
                });
                break;
            case (configurations.card_fraud === 'Standalone Fraud' || configurations.card_fraud === 'In-built Fraud'):
                result = await cardFraudCharge({
                    configurations,
                    input,
                    amount,
                    currency,
                    vaultToken,
                    customerId,
                    paymentObject
                });
                break;
            case (configurations.card_card_save === 'Enable' && configurations.card_card_method_save === 'Vault token' && input.SaveCard): {
                const tokenData = await getVaultTokenData(vaultToken);
                await saveUserToken({
                    token: tokenData,
                    user_id: input.CommerceToolsUserId,
                    customer_id: customerId,
                });
                result = await cardCharge({configurations, input, amount, currency, vaultToken, paymentObject});
            }
                break;
            default:
                result = await cardCharge({configurations, input, amount, currency, vaultToken, paymentObject});
        }

        return result;
    } catch (error) {
        logger.error(`Error in cardFlow: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function cardFraud3DsCharge({
                                      configurations,
                                      input,
                                      amount,
                                      currency,
                                      vaultToken,
                                      customerId,
                                      paymentObject
                                  }) {
    try {
        let result;
        switch (true) {
            case (configurations.card_3ds === 'In-built 3DS' && configurations.card_fraud === 'In-built Fraud'):
                result = await cardFraud3DsInBuildCharge({configurations, input, amount, currency, vaultToken});
                break;

            case (configurations.card_3ds === 'Standalone 3DS' && configurations.card_fraud === 'Standalone Fraud'):
                result = await cardFraud3DsStandaloneCharge({configurations, input, amount, currency, vaultToken});
                break;

            case (configurations.card_3ds === 'In-built 3DS' && configurations.card_fraud === 'Standalone Fraud'):
                result = await cardFraudStandalone3DsInBuildCharge({
                    configurations,
                    input,
                    amount,
                    currency,
                    vaultToken
                });
                break;

            case (configurations.card_3ds === 'Standalone 3DS' && configurations.card_fraud === 'In-built Fraud'):
                result = await cardFraudInBuild3DsStandaloneCharge({
                    configurations,
                    input,
                    amount,
                    currency,
                    vaultToken
                });
                break;

            default:
                result = {
                    status: 'Failure',
                    message: 'In-built fraud & 3ds error',
                    powerboardStatus: 'powerboard-failed'
                };
        }

        if (result.status === 'Success' && configurations.card_card_save === 'Enable' && !customerId && (
            configurations.card_card_method_save === 'Customer with Gateway ID' ||
            configurations.card_card_method_save === 'Customer without Gateway ID'
        )) {
            await createCustomerAndSaveVaultToken({
                configurations,
                input,
                vaultToken,
                type: 'card',
                paymentObject
            });
        }

        return result;
    } catch (error) {
        logger.error(`Error in cardFraud3DsCharge: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function cardFraud3DsInBuildCharge({configurations, input, amount, currency, vaultToken}) {
    const payment_source = getAdditionalFields(input);
    if (configurations.card_3ds_flow === 'With OTT') {
        payment_source.amount = amount;
    } else {
        payment_source.vault_token = vaultToken;
    }

    if (configurations.card_gateway_id) {
        payment_source.gateway_id = configurations.card_gateway_id;
    }

    if (input.cvv) {
        payment_source.card_ccv = input.cvv;
    }

    const fraudData = {};
    fraudData.data = getAdditionalFields(input);
    fraudData.data.amount = amount;

    if (configurations.card_fraud_service_id) {
        fraudData.service_id = configurations.card_fraud_service_id
    }

    const threeDsData = {
        id: input.charge3dsId ?? ''
    }

    if (configurations.card_3ds_service_id) {
        threeDsData.service_id = configurations.card_3ds_service_id
    }

    const isDirectCharge = configurations.card_direct_charge === 'Enable';

    const request = {
        amount,
        reference: input.orderId ?? '',
        currency,
        customer: {
            first_name: input.billing_first_name ?? '',
            last_name: input.billing_last_name ?? '',
            email: input.billing_email ?? '',
            phone: input.billing_phone ?? '',
            payment_source
        },
        _3ds: threeDsData,
        fraud: fraudData,
        capture: isDirectCharge,
        authorization: !isDirectCharge
    }

    const result = await createCharge(request, {directCharge: isDirectCharge});
    result.powerboardStatus = getPowerboardStatusByAPIResponse(isDirectCharge, result.status);
    return result;
}

async function cardFraudInBuildCharge({configurations, input, amount, currency, vaultToken}) {
    const isDirectCharge = configurations.card_direct_charge === 'Enable';
    const request = buildRequestcardFraudInBuildCharge(input, configurations, vaultToken, amount, currency)
    const result = await createCharge(request, {directCharge: isDirectCharge});
    if (result.status === 'Success') {
        result.powerboardStatus = c.STATUS_TYPES.PENDING;
    } else {
        result.powerboardStatus = c.STATUS_TYPES.FAILED;
    }

    return result;
}

function buildRequestcardFraudInBuildCharge(input, configurations, vaultToken, amount, currency) {
    const payment_source = getAdditionalFields(input);
    payment_source.vault_token = vaultToken;
    if (configurations.card_gateway_id) {
        payment_source.gateway_id = configurations.card_gateway_id;
    }
    if (input.cvv) {
        payment_source.card_ccv = input.cvv;
    }
    const isDirectCharge = configurations.card_direct_charge === 'Enable';
    const billingFirstName = input.billing_first_name ?? '';
    const billingLastName = input.billing_last_name ?? '';
    const billingEmail = input.billing_email ?? '';
    const billingPhone = input.billing_phone ?? '';
    return {
        amount,
        reference: input.orderId ?? '',
        currency,
        customer: {
            first_name: billingFirstName,
            last_name: billingLastName,
            email: billingEmail,
            phone: billingPhone,
            payment_source
        },
        fraud: {
            service_id: configurations.card_fraud_service_id ?? '',
            data: {
                transaction: {
                    billing: {
                        customerEmailAddress: billingEmail,
                        shippingFirstName: billingFirstName,
                        shippingLastName: billingLastName,
                        shippingAddress1: input.billing_address_1 ?? '',
                        shippingAddress2: input.billing_address_2 ?? (input.billing_address_1 ?? ''),
                        shippingCity: input.billing_city ?? '',
                        shippingState: input.billing_state ?? '',
                        shippingPostcode: input.billing_postcode ?? '',
                        shippingCountry: input.billing_country ?? '',
                        shippingPhone: billingPhone,
                        shippingEmail: billingEmail,
                    }
                }
            }
        },
        capture: isDirectCharge,
        authorization: !isDirectCharge
    }
}

async function cardFraud3DsStandaloneCharge({configurations, input, amount, currency, vaultToken}) {
    try {
        const cacheData = {
            method: 'cardFraud3DsStandaloneCharge',
            capture: configurations.card_direct_charge === 'Enable',
            charge3dsId: input.charge3dsId ?? ''
        };

        const payment_source = getAdditionalFields(input);
        payment_source.vault_token = vaultToken;

        if (configurations.card_gateway_id) {
            payment_source.gateway_id = configurations.card_gateway_id;
            cacheData.gateway_id = configurations.card_gateway_id;
        }

        if (input.cvv) {
            payment_source.card_ccv = input.cvv;
            cacheData.ccv = input.cvv;
        }

        const billingFirstName = input.billing_first_name ?? '';
        const billingLastName = input.billing_last_name ?? '';
        const billingEmail = input.billing_email ?? '';
        const billingPhone = input.billing_phone ?? '';

        const fraudData = getAdditionalFields(input);
        fraudData.first_name = billingFirstName;
        fraudData.last_name = billingLastName;
        fraudData.email = billingEmail;
        fraudData.phone = billingPhone;

        const isDirectCharge = configurations.card_direct_charge === 'Enable';

        const request = {
            amount,
            reference: input.orderId ?? '',
            currency,
            customer: {
                first_name: billingFirstName,
                last_name: billingLastName,
                email: billingEmail,
                phone: billingPhone,
                payment_source
            },
            fraud: {
                service_id: configurations.card_fraud_service_id ?? '',
                data: fraudData
            },
            capture: isDirectCharge,
            authorization: !isDirectCharge
        };

        const result = await createCharge(request, {action: 'standalone-fraud'});

        if (result.status === 'Success') {
            cacheData.billingAddress = {
                firstName: billingFirstName,
                lastName: billingLastName,
                email: billingEmail,
                phone: billingPhone,
            };

            await customObjectsUtils.setItem(`powerboard_fraud_${input.orderId}`, JSON.stringify(cacheData));
            result.powerboardStatus = 'powerboard-pending';
        } else {
            result.powerboardStatus = 'powerboard-failed';
        }

        return result;
    } catch (error) {
        logger.error(`Error in cardFraud3DsStandaloneCharge: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function cardFraudStandalone3DsInBuildCharge({configurations, input, amount, currency, vaultToken}) {
    try {
        const cacheData = {
            method: 'cardFraudStandalone3DsInBuildCharge',
            capture: configurations.card_direct_charge === 'Enable',
            _3ds: {
                id: input.charge3dsId ?? '',
                service_id: configurations.card_3ds_service_id ?? '',
            }
        };

        const payment_source = getAdditionalFields(input);
        payment_source.vault_token = vaultToken;

        if (configurations.card_gateway_id) {
            payment_source.gateway_id = configurations.card_gateway_id;
            cacheData.gateway_id = configurations.card_gateway_id;
        }

        if (input.cvv) {
            payment_source.card_ccv = input.cvv;
            cacheData.ccv = input.cvv;
        }

        const fraudData = getAdditionalFields(input);
        fraudData.amount = amount;

        const billingFirstName = input.billing_first_name ?? '';
        const billingLastName = input.billing_last_name ?? '';
        const billingEmail = input.billing_email ?? '';
        const billingPhone = input.billing_phone ?? '';

        const request = {
            amount,
            reference: input.orderId ?? '',
            currency,
            customer: {
                first_name: billingFirstName,
                last_name: billingLastName,
                email: billingEmail,
                phone: billingPhone,
                payment_source
            },
            fraud: {
                service_id: configurations.card_fraud_service_id ?? '',
                data: fraudData
            }
        };

        const result = await createCharge(request, {action: 'standalone-fraud'});

        if (result.status === 'Success') {
            cacheData.billingAddress = {
                firstName: billingFirstName,
                lastName: billingLastName,
                email: billingEmail,
                phone: billingPhone
            };

            await customObjectsUtils.setItem(`powerboard_fraud_${input.orderId}`, JSON.stringify(cacheData));
            result.powerboardStatus = 'powerboard-pending';
        } else {
            result.powerboardStatus = 'powerboard-failed';
        }

        return result;
    } catch (error) {
        logger.error(`Error in cardFraudStandalone3DsInBuildCharge: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function cardFraudInBuild3DsStandaloneCharge({configurations, input, amount, currency, vaultToken}) {
    try {
        const payment_source = getAdditionalFields(input);
        payment_source.vault_token = vaultToken;

        if (configurations.card_gateway_id) {
            payment_source.gateway_id = configurations.card_gateway_id;
        }

        if (input.cvv) {
            payment_source.card_ccv = input.cvv;
        }

        const fraudData = getAdditionalFields(input);
        fraudData.amount = amount;

        const isDirectCharge = configurations.card_direct_charge === 'Enable';

        const request = {
            amount,
            reference: input.orderId ?? '',
            currency,
            customer: {
                first_name: input.billing_first_name ?? '',
                last_name: input.billing_last_name ?? '',
                email: input.billing_email ?? '',
                phone: input.billing_phone ?? '',
                payment_source
            },
            _3ds_charge_id: input.charge3dsId ?? '',
            fraud: {
                service_id: configurations.card_fraud_service_id ?? '',
                data: fraudData
            },
            capture: isDirectCharge,
            authorization: !isDirectCharge
        };

        const result = await createCharge(request, {directCharge: isDirectCharge});

        result.powerboardStatus = getPowerboardStatusByAPIResponse(isDirectCharge, result.status);

        return result;
    } catch (error) {
        logger.error(`Error in cardFraudInBuild3DsStandaloneCharge: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function card3DsCharge({configurations, input, amount, currency, vaultToken, customerId}) {
    try {
        let result;
        if (configurations.card_3ds === 'In-built 3DS') {
            result = await card3DsInBuildCharge({configurations, input, amount, currency, vaultToken});
        } else {
            result = await card3DsStandaloneCharge({configurations, input, amount, currency, vaultToken});
        }

        if (result.status === 'Success' && configurations.card_card_save === 'Enable' && !customerId && (
            configurations.card_card_method_save === 'Customer with Gateway ID' ||
            configurations.card_card_method_save === 'Customer without Gateway ID'
        )) {
            await createCustomerAndSaveVaultToken({
                configurations,
                input,
                vaultToken,
                type: 'card'
            });
        }

        const isDirectCharge = configurations.card_direct_charge === 'Enable';
        result.powerboardStatus = getPowerboardStatusByAPIResponse(isDirectCharge, result.status);

        return result;
    } catch (error) {
        logger.error(`Error in card3DsCharge: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function card3DsInBuildCharge({configurations, input, amount, currency, vaultToken}) {
    try {
        const payment_source = getAdditionalFields(input);
        if (configurations.card_3ds_flow === 'With OTT') {
            payment_source.amount = amount;
        } else {
            payment_source.vault_token = vaultToken;
        }

        if (configurations.card_gateway_id) {
            payment_source.gateway_id = configurations.card_gateway_id;
        }

        if (input.cvv) {
            payment_source.card_ccv = input.cvv;
        }

        const isDirectCharge = configurations.card_direct_charge === 'Enable';

        const threeDsData = {
            id: input.charge3dsId ?? ''
        };

        if (configurations.card_3ds_service_id) {
            threeDsData.service_id = configurations.card_3ds_service_id;
        }

        const request = {
            amount,
            reference: input.orderId ?? '',
            currency,
            customer: {
                first_name: input.billing_first_name ?? '',
                last_name: input.billing_last_name ?? '',
                email: input.billing_email ?? '',
                phone: input.billing_phone ?? '',
                payment_source
            },
            _3ds: threeDsData,
            capture: isDirectCharge,
            authorization: !isDirectCharge
        };

        return await createCharge(request, {directCharge: isDirectCharge});
    } catch (error) {
        logger.error(`Error in card3DsInBuildCharge: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function card3DsStandaloneCharge({configurations, input, amount, currency, vaultToken}) {
    try {
        const payment_source = getAdditionalFields(input);
        payment_source.vault_token = vaultToken;

        if (configurations.card_gateway_id) {
            payment_source.gateway_id = configurations.card_gateway_id;
        }

        if (input.cvv) {
            payment_source.card_ccv = input.cvv;
        }

        const isDirectCharge = configurations.card_direct_charge === 'Enable';

        const request = {
            amount,
            reference: input.orderId ?? '',
            currency,
            customer: {
                first_name: input.billing_first_name ?? '',
                last_name: input.billing_last_name ?? '',
                email: input.billing_email ?? '',
                phone: input.billing_phone ?? '',
                payment_source
            },
            _3ds_charge_id: input.charge3dsId ?? '',
            capture: isDirectCharge,
            authorization: !isDirectCharge
        };

        return await createCharge(request, {directCharge: isDirectCharge});
    } catch (error) {
        logger.error(`Error in card3DsStandaloneCharge: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function cardFraudCharge({
                                   configurations,
                                   input,
                                   amount,
                                   currency,
                                   vaultToken,
                                   customerId
                               }) {
    try {
        let result;
        if (configurations.card_fraud === 'In-built Fraud') {
            result = await cardFraudInBuildCharge({configurations, input, amount, currency, vaultToken});
        } else {
            result = await cardFraudStandaloneCharge({
                configurations,
                input,
                amount,
                currency,
                vaultToken
            });
        }

        if (result.status === 'Success' && configurations.card_card_save === 'Enable' && !customerId && (
            configurations.card_card_method_save === 'Customer with Gateway ID' ||
            configurations.card_card_method_save === 'Customer without Gateway ID'
        )) {
            await createCustomerAndSaveVaultToken({
                configurations,
                input,
                vaultToken,
                type: 'card'
            });
        }

        return result;
    } catch (error) {
        logger.error(`Error in cardFraudCharge: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function cardFraudStandaloneCharge({configurations, input, amount, currency, vaultToken}) {
    try {
        const cacheData = {
            method: 'cardFraudStandaloneCharge',
            capture: configurations.card_direct_charge === 'Enable'
        };

        const payment_source = getAdditionalFields(input);
        payment_source.vault_token = vaultToken;

        if (configurations.card_gateway_id) {
            payment_source.gateway_id = configurations.card_gateway_id;
            cacheData.gateway_id = configurations.card_gateway_id;
        }

        if (input.cvv) {
            payment_source.card_ccv = input.cvv;
            cacheData.ccv = input.cvv;
        }

        const fraudData = getAdditionalFields(input);
        fraudData.amount = amount;

        const isDirectCharge = configurations.card_direct_charge === 'Enable';

        const request = {
            amount,
            reference: input.orderId ?? '',
            currency,
            customer: {
                first_name: input.billing_first_name ?? '',
                last_name: input.billing_last_name ?? '',
                email: input.billing_email ?? '',
                phone: input.billing_phone ?? '',
                payment_source
            },
            fraud: {
                service_id: configurations.card_fraud_service_id ?? '',
                data: fraudData
            },
            capture: isDirectCharge,
            authorization: !isDirectCharge
        };

        const result = await createCharge(request, {action: 'standalone-fraud', directCharge: isDirectCharge});

        if (result.status === 'Success') {
            cacheData.billingAddress = {
                firstName: input.billing_first_name ?? '',
                lastName: input.billing_last_name ?? '',
                email: input.billing_email ?? '',
                phone: input.billing_phone ?? ''
            };

            await customObjectsUtils.setItem(`powerboard_fraud_${input.orderId}`, JSON.stringify(cacheData));
            result.powerboardStatus = 'powerboard-pending';
        } else {
            result.powerboardStatus = 'powerboard-failed';
        }

        return result;
    } catch (error) {
        logger.error(`Error in cardFraudStandaloneCharge: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function cardCustomerCharge({
                                      configurations,
                                      input,
                                      amount,
                                      currency,
                                      vaultToken,
                                      customerId
                                  }) {
    try {
        if (!customerId) {
            customerId = await createCustomerAndSaveVaultToken({
                configurations,
                input,
                vaultToken,
                type: 'card',
            });
        }

        const payment_source = getAdditionalFields(input);

        if (configurations.card_gateway_id) {
            payment_source.gateway_id = configurations.card_gateway_id;
        }
        const isDirectCharge = configurations.card_direct_charge === 'Enable';

        const request = {
            amount,
            reference: input.orderId ?? '',
            currency,
            customer_id: customerId,
            customer: {
                first_name: input.billing_first_name ?? '',
                last_name: input.billing_last_name ?? '',
                email: input.billing_email ?? '',
                phone: input.billing_phone ?? '',
                payment_source
            },
            capture: isDirectCharge,
            authorization: !isDirectCharge
        };
        const result = await createCharge(request, {directCharge: isDirectCharge});
        result.powerboardStatus = getPowerboardStatusByAPIResponse(isDirectCharge, result.status);

        return result;
    } catch (error) {
        logger.error(`Error in cardCustomerCharge: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function cardCharge({configurations, input, amount, currency, vaultToken}) {
    try {
        const payment_source = getAdditionalFields(input);
        payment_source.vault_token = vaultToken;

        if (configurations.card_gateway_id) {
            payment_source.gateway_id = configurations.card_gateway_id;
        }

        if (input.cvv) {
            payment_source.card_ccv = input.cvv;
        }

        const isDirectCharge = configurations.card_direct_charge === 'Enable';

        const request = {
            amount,
            reference: input.orderId ?? '',
            currency,
            customer: {
                first_name: input.billing_first_name ?? '',
                last_name: input.billing_last_name ?? '',
                email: input.billing_email ?? '',
                phone: input.billing_phone ?? '',
                payment_source
            },
            capture: isDirectCharge,
            authorization: !isDirectCharge
        };

        const result = await createCharge(request, {directCharge: isDirectCharge});

        result.powerboardStatus = getPowerboardStatusByAPIResponse(isDirectCharge, result.status);

        return result;
    } catch (error) {
        logger.error(`Error in cardCharge: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function apmFlow({configurations, input, amount, currency, paymentType}) {
    try {
        let isDirectCharge;
        let fraudServiceId = null;
        let fraud = false;
        if (paymentType === 'Zippay') {
            isDirectCharge = configurations.alternative_payment_methods_zippay_direct_charge === 'Enable';
            fraudServiceId = configurations.alternative_payment_methods_zippay_fraud_service_id;
            fraud = configurations.alternative_payment_methods_zippay_fraud === "Enable";
        } else {
            isDirectCharge = true;
            fraudServiceId = configurations.alternative_payment_methods_afterpay_v1_fraud_service_id;
            fraud = configurations.alternative_payment_methods_afterpay_v1_fraud === "Enable";
        }

        const request = {
            amount,
            reference: input.orderId ?? '',
            currency,
            token: input.PowerboardTransactionId,
            items: input.items ?? [],
            customer: {
                first_name: input.billing_first_name ?? '',
                last_name: input.billing_last_name ?? '',
                email: input.billing_email ?? '',
                phone: input.billing_phone ?? ''
            },
            capture: isDirectCharge,
            authorization: !isDirectCharge
        };

        if (fraud && fraudServiceId) {
            const fraudData = getAdditionalFields(input);
            fraudData.first_name = input.billing_first_name ?? '';
            fraudData.last_name = input.billing_last_name ?? '';
            fraudData.email = input.billing_email ?? '';
            fraudData.phone = input.billing_phone ?? '';
            request.fraud = {
                service_id: fraudServiceId,
                data: fraudData
            };
        }

        const result = await createCharge(request, {directCharge: isDirectCharge});
        result.powerboardStatus = getPowerboardStatusByAPIResponse(isDirectCharge, result.status);
        return result;
    } catch (error) {
        logger.error(`Error in apmFlow: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function createCustomer(data) {
    try {
        const {response} = await callPowerboard(`/v1/customers`, data, 'POST');
        if (response.status === 201) {
            return {
                status: "Success",
                customerId: response.resource.data._id
            };
        }

        return {
            status: "Failure",
            message: response.data?.error?.message,
        };
    } catch (error) {
        logger.error(`Error in createCustomer: ${JSON.stringify(serializeError(error))}`);
        return {
            status: "Failure",
            message: error.message || 'Unknown error',
        };
    }
}

function generateCustomerRequest(input, vaultToken, type, configurations) {
    const customerRequest = {
        first_name: input.billing_first_name ?? '',
        last_name: input.billing_last_name ?? '',
        email: input.billing_email ?? '',
        phone: input.billing_phone ?? '',
        payment_source: {
            vault_token: vaultToken
        }
    };

    if (type === 'card' && configurations.card_card_method_save === 'Customer with Gateway ID' && configurations.card_gateway_id) {
        customerRequest.payment_source.gateway_id = configurations.card_gateway_id;
    }
    return customerRequest;
}

async function createCustomerAndSaveVaultToken({configurations, input, vaultToken, type, paymentObject}) {
    let customerId = null;
    const customerRequest = generateCustomerRequest(input, vaultToken, type, configurations);
    const customerResponse = await createCustomer(customerRequest);
    if (customerResponse.status === 'Success' && customerResponse.customerId) {
        customerId = customerResponse.customerId;

        httpUtils.addPowerboardLog({
            powerboardChargeID: input.PowerboardTransactionId,
            operation: 'Create Customer',
            status: customerResponse.status,
            message: `Create Customer ${customerId}`
        });

        if (
            shouldSaveVaultToken({type, saveCard: input.SaveCard, userId: input.CommerceToolsUserId, configurations}) &&
            (
                (
                    type === 'card' && ['Customer with Gateway ID', 'Customer without Gateway ID'].includes(configurations.card_card_method_save)
                )
            )
        ) {
            const tokenData = await getVaultTokenData(vaultToken);
            const result = await saveUserToken({
                token: tokenData,
                user_id: input.CommerceToolsUserId,
                customer_id: customerId,
            });
            const messageLog = result.success ? 'Customer Vault Token saved successfully' : result.error;
            const statusLog = result.success ? 'Success' : 'Failure';
            httpUtils.addPowerboardLog({
                powerboardChargeID: input.PowerboardTransactionId,
                operation: 'Save Customer Vault Token',
                status: statusLog,
                message: messageLog
            });
        }
    } else {
        httpUtils.addPowerboardLog( {
            powerboardChargeID: input.PowerboardTransactionId,
            operation: 'Create Customer',
            status: customerResponse.status,
            message: customerResponse.message
        });
    }

    return customerId;
}

async function getVaultTokenData(token) {
    try {
        const {response} = await callPowerboard(`/v1/vault-tokens/${token}/`, null, 'GET');

        return response.resource.data;
    } catch (error) {
        logger.error(`Error in getVaultTokenData: ${JSON.stringify(serializeError(error))}`);
        return null;
    }
}

function shouldSaveVaultToken({type, saveCard, userId, configurations}) {
    let shouldSaveCard = saveCard;
    if (type === 'card') {
        shouldSaveCard = shouldSaveCard && (configurations.card_card_save === 'Enable');
    }
    return userId && (userId !== 'not authorized') && shouldSaveCard;
}

async function saveUserToken({token, user_id, customer_id}) {
    try {
        const unique_key = token.type === 'card' ? (token.card_number_bin + token.card_number_last4) : (token.account_routing + token.account_number);

        const title = getVaultTokenTitle(token);
        const type = 'card';
        return await insertOrUpdateUserVaultToken({
            unique_key,
            user_id,
            customer_id,
            type,
            vault_token: token.vault_token,
            title,
            data: token
        });
    } catch (error) {
        logger.error(`Error in saveUserToken: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

function getVaultTokenTitle(tokenData) {
    let title = '';

    if (tokenData) {
        if (tokenData.type === 'card') {
            let expire_month = tokenData.expire_month.toString();
            if (expire_month.length === 1) {
                expire_month = `0${expire_month}`;
            }
            const card_scheme = tokenData.card_scheme.charAt(0).toUpperCase() + tokenData.card_scheme.slice(1);
            title = `${card_scheme} ${tokenData.card_number_last4} ${expire_month}/${tokenData.expire_year}`;
        }
    }

    return title;
}

async function insertOrUpdateUserVaultToken({unique_key, user_id, customer_id, type, vault_token, title, data}) {
    const ctpClient = await ctp.get(config.getExtensionConfig());
    const key = `${type}-${unique_key}`;

    try {
        const response = await ctpClient.fetchById(ctpClient.builder.customers, user_id);
        if (response?.body) {
            let version = response.body.version;
            let actions = [{
                action: 'setCustomType',
                type: {
                    key: 'powerboard-components-customer-vault-type'
                }
            }];

            const setCustomTypeResponse = await ctpClient.update(ctpClient.builder.customers, user_id, version, actions);
            version = setCustomTypeResponse.body.version;

            const userVaultTokens = response.body?.custom?.fields?.userVaultTokens ? JSON.parse(response.body?.custom?.fields?.userVaultTokens) : {};
            if (userVaultTokens[key]) {
                userVaultTokens[key]['customer_id'] = customer_id;
                userVaultTokens[key]['vault_token'] = vault_token;
                userVaultTokens[key]['data'] = data;
                userVaultTokens[key]['title'] = title;
            } else {
                userVaultTokens[key] = {
                    user_id,
                    type,
                    vault_token,
                    customer_id,
                    data,
                    title
                };
            }

            actions = [{
                action: 'setCustomField',
                name: 'userVaultTokens',
                value: JSON.stringify(userVaultTokens)
            }];

            const setCustomFeildResponse = await ctpClient.update(ctpClient.builder.customers, user_id, version, actions);

            if (setCustomFeildResponse.statusCode === 200) {
                return {success: true};
            }
        }

        return {success: false};
    } catch (error) {
        logger.error(`Error in insertOrUpdateUserVaultToken: ${JSON.stringify(serializeError(error))}`);
        return {success: false, error: error.message};
    }
}

async function getCustomerIdByVaultToken(user_id, vault_token) {
    const ctpClient = await ctp.get(config.getExtensionConfig());
    let customerId = null;
    try {
        const response = await ctpClient.fetchById(ctpClient.builder.customers, user_id);
        if (response?.body) {
            const userVaultTokens = response.body?.custom?.fields?.userVaultTokens ? JSON.parse(response.body?.custom?.fields?.userVaultTokens) : {};

            for (const value of Object.values(userVaultTokens)) {
                if (value.vault_token === vault_token) {
                    customerId = value.customer_id;
                    break;
                }
            }
        }
        return customerId;
    } catch (error) {
        logger.error(`Error in getCustomerIdByVaultToken: ${JSON.stringify(serializeError(error))}`);
        throw error
    }
}

async function createCharge(data, params = {}, returnObject = false) {
    try {
        let isFraud = false;
        let url = '/v1/charges';
        if (params.action !== undefined) {
            if (params.action === 'standalone-fraud') {
                url += '/fraud';
                isFraud = true;
            }
            if (params.action === 'standalone-fraud-attach') {
                url += `/${params.chargeId}/fraud/attach`;
                isFraud = true;
            }
        }

        if (params.directCharge !== undefined && params.directCharge === false) {
            url += '?capture=false';
        }
        if (isFraud) {
            const addressLine2 = data.customer.payment_source.address_line2 ?? '';
            if (addressLine2 === '') {
                delete (data.customer.payment_source.address_line2);
                delete (data.fraud.data.address_line2);
            }
        }

        const {response} = await callPowerboard(url, data, 'POST');

        if (returnObject) {
            return response;
        }
        if (response.status === 201) {
            return {
                status: "Success",
                message: "Charge is created successfully",
                chargeId: response.resource.data._id
            };
        }

        return {
            status: "Failure",
            message: response?.error?.message,
            chargeId: '0'
        };
    } catch (error) {
        logger.error(`Error in createCharge: ${JSON.stringify(serializeError(error))}`);
        return {
            status: "Failure",
            message: error.message || 'Unknown error',
            chargeId: '0'
        };
    }
}

function getAdditionalFields(input) {
    const additionalFields = {
        address_country: input.address_country ?? '',
        address_postcode: input.address_postcode ?? '',
        address_city: input.address_city ?? '',
        address_line1: input.address_line ?? '',
        address_line2: input.address_line2 ?? (input.address_line ?? ''),
    };

    const addressState = input.address_state ?? '';
    if (addressState) {
        additionalFields.addressState = addressState;
    }
    return additionalFields;
}

function getPowerboardStatusByAPIResponse(isDirectCharge, paymentStatus) {
    let powerboardStatus;
    if (paymentStatus === 'Success') {
        if (isDirectCharge) {
            powerboardStatus = c.STATUS_TYPES.PAID;
        } else {
            powerboardStatus = c.STATUS_TYPES.AUTHORIZE;
        }
    } else {
        powerboardStatus = c.STATUS_TYPES.FAILED;
    }
    return powerboardStatus;
}

async function getUserVaultTokens(user_id) {
    const ctpClient = await ctp.get(config.getExtensionConfig());
    const result = [];
    try {
        const response = await ctpClient.fetchById(ctpClient.builder.customers, user_id);
        if (response?.body) {
            const userVaultTokens = response.body?.custom?.fields?.userVaultTokens ? JSON.parse(response.body?.custom?.fields?.userVaultTokens) : {};
            for (const value of Object.values(userVaultTokens)) {
                result.push(value);
            }
        }
        return result;
    } catch (error) {
        logger.error(`Error in getUserVaultTokens: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

async function updatePowerboardStatus(endpoint, method, data) {
    try {
        const {response} = await callPowerboard(endpoint, data, method);
        if ([200, 201].includes(response.status)) {
            return {
                status: "Success",
                chargeId: response.resource.data._id
            };
        }
        return {
            status: "Failure",
            message: response?.error?.message,
        };
    } catch (error) {
        logger.error(`Error in updatePowerboardStatus: ${JSON.stringify(serializeError(error))}`);
        throw error;
    }
}

export {
    getVaultToken,
    getUserVaultTokens,
    createStandalone3dsToken,
    makePayment,
    createVaultToken,
    updatePowerboardStatus,
    createPreCharge,
    createCharge
};
