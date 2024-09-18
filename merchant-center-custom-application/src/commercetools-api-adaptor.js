import {CHARGE_STATUSES} from './constants';
import PowerboardApiAdaptor from './powerboard-api-adaptor';
import {decrypt, encrypt} from "./helpers";

class CommerceToolsAPIAdapter {
    constructor(env) {
        this.env = env;
        this.clientId = env.clientId;
        this.clientSecret = env.clientSecret;
        this.projectKey = env.projectKey;
        this.region = env.region;
        this.accessToken = null;
        this.tokenExpirationTime = null;
        this.arrayPowerboardStatus = CHARGE_STATUSES;

    }

    async setAccessToken(accessToken, tokenExpirationInSeconds) {
        this.accessToken = accessToken;
        const tokenExpiration = new Date();
        tokenExpiration.setSeconds(tokenExpiration.getSeconds() + tokenExpirationInSeconds);
        this.tokenExpirationTime = tokenExpiration.getTime();
    }

    async getAccessToken() {
        const currentTimestamp = new Date().getTime();
        if (!this.accessToken || currentTimestamp > this.tokenExpirationTime) {
            await this.authenticate();
        }
        return this.accessToken;
    }

    async authenticate() {
        const authUrl = `https://auth.${this.region}.commercetools.com/oauth/token`;

        const authData = new URLSearchParams();
        authData.append('grant_type', 'client_credentials');
        authData.append('scope', [
            `manage_orders:${this.projectKey}`,
            `manage_payments:${this.projectKey}`,
        ].join(' '));

        const auth = btoa(`${this.clientId}:${this.clientSecret}`);

        try {
            const response = await fetch(authUrl, {
                headers: {
                    authorization: `Basic ${auth}`,
                    'content-type': 'application/x-www-form-urlencoded',
                },
                body: authData.toString(),
                method: 'POST',
            });

            const authResult = await response.json();
            this.setAccessToken(authResult.access_token, authResult.expires_in);
        } catch (error) {
            throw error;
        }
    }

    async makeRequest(endpoint, method = 'GET', body = null) {
        try {
            const accessToken = await this.getAccessToken();
            const apiUrl = `https://api.${this.region}.commercetools.com/${this.projectKey}${endpoint}`;
            const response = await fetch(apiUrl, {
                body: body ? JSON.stringify(body) : null,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                method: method,
            });

            if (!response.ok) {
                const error = new Error(`HTTP error! Status: ${response.status}`);
                error.status = response.status;
                throw error;
            }

            return await response.json();
        } catch (error) {
            throw error;
        }
    }

    async setConfigs(group, data) {
        let requestData = {
            id: data.id ?? crypto.randomUUID(),
            version: data.version ?? 0,
            createdAt: data.createdAt ?? new Date().toString(),
            lastModifiedAt: new Date().toString(),
            container: 'powerboardConfigContainer',
            key: group ?? 'empty',
            value: data.value ?? null,
        };
        const notificationUrl = await this.getNotificationUrl();
        this.updateAPINotification(group, data.value, notificationUrl);

        if (requestData.value.credentials_access_key) {
            requestData.value.credentials_access_key = await encrypt(requestData.value.credentials_access_key, this.clientSecret);
        }
        if (requestData.value.credentials_public_key) {
            requestData.value.credentials_public_key = await encrypt(requestData.value.credentials_public_key, this.clientSecret);
        }
        if (requestData.value.credentials_secret_key) {
            requestData.value.credentials_secret_key = await encrypt(requestData.value.credentials_secret_key, this.clientSecret);
        }
        await this.makeRequest('/custom-objects', 'POST', requestData)

        data = await this.getConfigs(group);

        return data;
    }

    updateAPINotification(group, data, notificationUrl) {
        const isToken = 'access_key' === data.credentials_type;
        const isLive = group === 'live';
        let secretKey = isToken ? data.credentials_access_key : data.credentials_secret_key;
        if (secretKey && notificationUrl) {
            const powerboardApiAdaptor = new PowerboardApiAdaptor(isLive, isToken, secretKey, notificationUrl);
            powerboardApiAdaptor.registerNotifications().catch(error => {
                throw error.response.data.error;
            });
        }
    }

    async getNotificationUrl() {
        let objectNotificationUrl =  await this.makeRequest('/custom-objects/powerboard-notification', 'GET');
        if(objectNotificationUrl.results.length){
            return objectNotificationUrl.results[0].value;
        }
        return null
    }

    async getConfigs(group) {

        let data = await this.makeRequest('/custom-objects/powerboardConfigContainer/' + group);

        if(data) {
            if (data.value.credentials_access_key) {
                data.value.credentials_access_key = await decrypt(data.value.credentials_access_key, this.clientSecret);
            }
            if (data.value.credentials_public_key) {
                data.value.credentials_public_key = await decrypt(data.value.credentials_public_key, this.clientSecret);
            }
            if (data.value.credentials_secret_key) {
                data.value.credentials_secret_key = await decrypt(data.value.credentials_secret_key, this.clientSecret);
            }
        }

        return data;
    }
    async getLogs() {
        let logs = [];
        let paydockLogs = await this.makeRequest('/payments/?&sort=createdAt+desc&limit=500');
        if (paydockLogs.results) {
            paydockLogs.results.forEach((paydockLog) => {
                paydockLog.interfaceInteractions.forEach((interactionLog) => {
                    let message = typeof interactionLog.fields.message === 'string' ? interactionLog.fields.message : null;
                    logs.push({
                        operation_id: interactionLog.fields.chargeId,
                        date: interactionLog.fields.createdAt,
                        operation: this.getStatusByKey(interactionLog.fields.operation),
                        status: interactionLog.fields.status,
                        message: message,
                    })
                })
            });
        }

        return logs.sort((first, second) => {
            const date1 = Date.parse(first.date);
            const date2 = Date.parse(second.date);

            return date2 - date1
        })
    }


    getStatusByKey(statusKey) {
        if (this.arrayPowerboardStatus[statusKey] !== undefined) {
            return this.arrayPowerboardStatus[statusKey];
        }
        return statusKey;
    }


    collectArrayPayments(payments, paymentsArray) {
        if (!payments.results) return;

        payments.results.forEach((payment) => {
            if (payment.custom.fields.AdditionalInformation === undefined) {
                return;
            }
            let customFields = payment.custom.fields;
            let additionalFields = customFields.AdditionalInformation;
            if (typeof additionalFields !== 'object') {
                additionalFields = JSON.parse(additionalFields);
            }
            let billingInformation = additionalFields.BillingInformation ?? '-';
            let shippingInformation = additionalFields.ShippingInformation ?? '-';
            if (shippingInformation != '-') {
                if (typeof shippingInformation !== 'object') {
                    shippingInformation = JSON.parse(shippingInformation);
                }
                shippingInformation = this.convertInfoToString(shippingInformation);
            }
            if (billingInformation !== '-') {
                if (typeof billingInformation !== 'object') {
                    billingInformation = JSON.parse(billingInformation);
                }
                billingInformation = this.convertInfoToString(billingInformation);
            }
            shippingInformation = billingInformation == shippingInformation ? '-' : shippingInformation;


            let amount = payment.amountPlanned.centAmount;
            if (payment.amountPlanned.type === 'centPrecision') {
                const fraction = 10 ** payment.amountPlanned.fractionDigits;
                amount = amount / fraction;
            }
            paymentsArray[payment.id] = {
                id: payment.id,
                amount: amount,
                currency: payment.amountPlanned.currencyCode,
                createdAt: payment.createdAt,
                lastModifiedAt: payment.lastModifiedAt,
                paymentSourceType: customFields.PowerboardPaymentType,
                powerboardPaymentStatus: customFields.PowerboardPaymentStatus,
                powerboardChargeId: customFields.PowerboardTransactionId,
                shippingInfo: shippingInformation,
                billingInfo: billingInformation,
                refundAmount: customFields.RefundedAmount ?? 0,
                capturedAmount: customFields.CapturedAmount ?? 0,
            };
        });
    }

    convertInfoToString(info) {
        let name = info['name'] ?? '-';
        let address = info['address'] ?? '-';
        return 'Name: ' + name + ' \n' + 'Address: ' + address;
    }

    async getOrders() {
        try {
            const powerboardOrders = [];
            const paymentsArray = [];
            const payments = await this.makeRequest('/payments?where=' + encodeURIComponent('paymentMethodInfo(method="powerboard-pay") and custom(fields(AdditionalInformation is not empty))') + '&sort=createdAt+desc&limit=500');
            this.collectArrayPayments(payments, paymentsArray);
            if(paymentsArray) {
                let orderQuery = '"' + Object.keys(paymentsArray).join('","') + '"';
                const orders = await this.makeRequest('/orders?where=' + encodeURIComponent('paymentInfo(payments(id in(' + orderQuery + ')))') + '&sort=createdAt+desc&limit=500');
                await this.collectArrayOrders(orders, paymentsArray, powerboardOrders);
            }
            return powerboardOrders;
        } catch (error) {
            throw error;
        }
    }

    async updateOrderStatus(data) {
        const orderId = data.orderId;
        let response = {};
        let error = null;
        try {
            const payment = await this.makeRequest('/payments/' + orderId);
            if (payment) {
                const requestData = {
                    version: payment.version,
                    actions: [
                        {
                            action: 'setCustomField',
                            name: 'PaymentExtensionRequest',
                            value: JSON.stringify({
                                action: 'updatePaymentStatus',
                                request: data,
                            }),
                        },
                    ],
                };

                let updateStatusResponse = await this.makeRequest('/payments/' + orderId, 'POST', requestData);
                let paymentExtensionResponse = updateStatusResponse.custom?.fields?.PaymentExtensionResponse;
                if (!paymentExtensionResponse) {
                    error = 'Error update status of payment';
                } else {
                    paymentExtensionResponse = JSON.parse(paymentExtensionResponse);
                    if (!paymentExtensionResponse.status) {
                        error = paymentExtensionResponse.message;
                    }
                }
            } else {
                error = 'Error fetching payment';
            }
        } catch (err) {
            return { success: false, message: 'Error update status of payment' };
        }

        if (error) {
            response = { success: false, message: error };
        } else {
            response = { success: true };
        }

        return response;
    }

    async collectArrayOrders(orders, paymentsArray, powerboardOrders) {
        for (const order of orders.results) {
            let objOrder = {
                id: order.id,
                order_number: order.orderNumber,
                order_payment_status: order.paymentState,
                order_url: `https://mc.${this.region}.commercetools.com/${this.projectKey}/orders/${order.id}`,
            };

            if (order.paymentInfo.payments) {
                this.collectArrayOrdersPayments(order.paymentInfo.payments, paymentsArray, objOrder);
            }
            powerboardOrders.push(objOrder);
        }
    }

    collectArrayOrdersPayments(orderPayments, paymentsArray, objOrder) {
        for (const payment of orderPayments) {
            if (paymentsArray[payment.id] !== undefined) {
                let currentPayment = paymentsArray[payment.id];
                let refundAmount = currentPayment.refundAmount > 0 ? Math.round(currentPayment.refundAmount * 100) / 100 : currentPayment.refundAmount;
                let capturedAmount = currentPayment.capturedAmount > 0 ? Math.round(currentPayment.capturedAmount * 100) / 100 : currentPayment.capturedAmount;

                objOrder.amount = currentPayment.amount;
                objOrder.currency = currentPayment.currency;
                objOrder.created_at = currentPayment.createdAt;
                objOrder.updated_at = currentPayment.lastModifiedAt;
                objOrder.payment_source_type = currentPayment.paymentSourceType;
                objOrder.status = currentPayment.powerboardPaymentStatus;
                objOrder.statusName = this.getStatusByKey(currentPayment.powerboardPaymentStatus);
                objOrder.powerboard_transaction = currentPayment.powerboardChargeId;
                objOrder.shipping_information = currentPayment.shippingInfo;
                objOrder.billing_information = currentPayment.billingInfo;
                objOrder.captured_amount = capturedAmount;
                objOrder.refund_amount = refundAmount;
                objOrder.possible_amount_captured = currentPayment.amount - capturedAmount;
            }
        }
    }

}

export default CommerceToolsAPIAdapter;

