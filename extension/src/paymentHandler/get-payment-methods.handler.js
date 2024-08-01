import {
    createSetCustomFieldAction,
} from './payment-utils.js'
import c from '../config/constants.js'
import config from "../config/config.js";
import {getUserVaultTokens} from "../service/web-component-service.js";

async function execute(paymentObject) {
    try {
        const paymentExtensionRequest = getPaymentExtensionRequest(paymentObject);
        const CommerceToolsUserId = getCommerceToolsUserId(paymentExtensionRequest);

        const totalPrice = calculateTotalPrice(paymentObject.amountPlanned);
        const powerboardCredentials = await config.getPowerboardConfig('all', true);
        const connection = getConnectionConfig(powerboardCredentials);

        const savedCredentials = await getSavedCredentials(CommerceToolsUserId);
        const responseData = buildResponseData(powerboardCredentials, connection, totalPrice, savedCredentials);

        return { actions: [createSetCustomFieldAction(c.CTP_INTERACTION_PAYMENT_EXTENSION_RESPONSE, responseData)] };
    } catch (error) {
        console.error('Error in execute:', serializeError(error));
        throw error;
    }
}

function getPaymentExtensionRequest(paymentObject) {
    return JSON.parse(paymentObject?.custom?.fields?.PaymentExtensionRequest || '{}');
}

function getCommerceToolsUserId(paymentExtensionRequest) {
    return paymentExtensionRequest.request?.CommerceToolsUserId || null;
}

function calculateTotalPrice(amountPlanned) {
    if (amountPlanned?.type === "centPrecision") {
        const fraction = 10 ** amountPlanned.fractionDigits;
        return amountPlanned.centAmount / fraction;
    }
    return 0;
}

function getConnectionConfig(powerboardCredentials) {
    return powerboardCredentials.sandbox.sandbox_mode === "Yes"
        ? powerboardCredentials.sandbox
        : powerboardCredentials.live;
}

async function getSavedCredentials(CommerceToolsUserId) {
    const savedCredentials = {};
    if (CommerceToolsUserId) {
        const userVaultTokens = await getUserVaultTokens(CommerceToolsUserId);
        for (const item of userVaultTokens) {
            savedCredentials[item.type] = savedCredentials[item.type] || {};
            savedCredentials[item.type][item.vault_token] = item;
        }
    }
    return savedCredentials;
}

function buildResponseData(powerboardCredentials, connection, totalPrice, savedCredentials) {
    return {
        sandbox_mode: powerboardCredentials.sandbox.sandbox_mode,
        api_credentials: getApiCredentials(connection),
        payment_methods: getPaymentMethodsConfig(connection, powerboardCredentials, totalPrice),
        widget_configuration: getWidgetConfiguration(powerboardCredentials),
        saved_credentials: savedCredentials
    };
}

function getApiCredentials(connection) {
    return {
        credentials_type: connection.credentials_type,
        credentials_public_key: connection.credentials_public_key,
        credentials_widget_access_key: connection.credentials_widget_access_key
    };
}

function getPaymentMethodsConfig(connection, powerboardCredentials, totalPrice) {
    return {
        "card": buildPaymentMethodConfig("card", powerboardCredentials, connection),
        "bank_accounts": buildPaymentMethodConfig("bank_accounts", powerboardCredentials, connection),
        "apple-pay": buildPaymentMethodConfig("apple-pay", powerboardCredentials, connection),
        "google-pay": buildPaymentMethodConfig("google-pay", powerboardCredentials, connection),
        "afterpay_v2": buildPaymentMethodConfig("afterpay_v2", powerboardCredentials, connection),
        "paypal_smart": buildPaymentMethodConfig("paypal_smart", powerboardCredentials, connection),
        "afterpay_v1": buildAlternativePaymentMethodConfig("afterpay_v1", powerboardCredentials, connection, totalPrice),
        "zippay": buildAlternativePaymentMethodConfig("zippay", powerboardCredentials, connection, totalPrice)
    };
}

function buildPaymentMethodConfig(type, powerboardCredentials, connection) {
    return {
        name: `powerboard-pay-${type}`,
        type: type,
        title: powerboardCredentials.widget[`payment_methods_${type}_title`],
        description: powerboardCredentials.widget[`payment_methods_${type}_description`],
        config: {
            [`${type}_use_on_checkout`]: connection[`${type}_use_on_checkout`],
            [`${type}_gateway_id`]: connection[`${type}_gateway_id`],
            [`${type}_fraud`]: connection[`${type}_fraud`],
            [`${type}_fraud_service_id`]: connection[`${type}_fraud_service_id`],
            [`${type}_direct_charge`]: connection[`${type}_direct_charge`],
            ...getOptionalConfig(type, connection)
        }
    };
}

function getOptionalConfig(type, connection) {
    const optionalConfig = {};
    if (connection[`${type}_3ds`]) {
        optionalConfig[`${type}_3ds`] = connection[`${type}_3ds`];
        optionalConfig[`${type}_3ds_service_id`] = connection[`${type}_3ds_service_id`];
        optionalConfig[`${type}_3ds_flow`] = connection[`${type}_3ds_flow`];
    }
    if (connection[`${type}_supported_card_schemes`]) {
        optionalConfig[`${type}_supported_card_schemes`] = connection[`${type}_supported_card_schemes`];
    }
    if (connection[`${type}_card_save`]) {
        optionalConfig[`${type}_card_save`] = connection[`${type}_card_save`];
        optionalConfig[`${type}_card_method_save`] = connection[`${type}_card_method_save`];
    }
    return optionalConfig;
}

function buildAlternativePaymentMethodConfig(type, powerboardCredentials, connection, totalPrice) {
    return {
        name: `powerboard-pay-${type}`,
        type: type,
        title: powerboardCredentials.widget[`payment_methods_alternative_payment_method_${type}_title`],
        description: powerboardCredentials.widget[`payment_methods_alternative_payment_method_${type}_description`],
        config: {
            [`alternative_payment_methods_${type}_use_on_checkout`]: isUseOnCheckout(type, connection, powerboardCredentials, totalPrice),
            [`alternative_payment_methods_${type}_gateway_id`]: connection[`alternative_payment_methods_${type}_gateway_id`],
            [`alternative_payment_methods_${type}_fraud`]: connection[`alternative_payment_methods_${type}_fraud`],
            [`alternative_payment_methods_${type}_direct_charge`]: connection[`alternative_payment_methods_${type}_direct_charge`],
            [`alternative_payment_methods_${type}_fraud_service_id`]: connection[`alternative_payment_methods_${type}_fraud_service_id`]
        }
    };
}

function getWidgetConfiguration(powerboardCredentials) {
    return {
        config: config.getWidgetConfig(),
        version: {
            version_version: powerboardCredentials.widget.version_version,
            version_custom_version: powerboardCredentials.widget.version_custom_version
        },
        payment_methods: getWidgetPaymentMethods(powerboardCredentials),
        widget_style: getWidgetStyleConfig(powerboardCredentials)
    };
}

function getWidgetPaymentMethods(powerboardCredentials) {
    return {
        cards: {
            payment_methods_cards_title: powerboardCredentials.widget.payment_methods_cards_title,
            payment_methods_cards_description: powerboardCredentials.widget.payment_methods_cards_description
        },
        bank_accounts: {
            payment_methods_bank_accounts_title: powerboardCredentials.widget.payment_methods_bank_accounts_title,
            payment_methods_bank_accounts_description: powerboardCredentials.widget.payment_methods_bank_accounts_description,
        },
        wallets: {
            payment_methods_wallets_apple_pay_title: powerboardCredentials.widget.payment_methods_wallets_apple_pay_title,
            payment_methods_wallets_apple_pay_description: powerboardCredentials.widget.payment_methods_wallets_apple_pay_description,
            payment_methods_wallets_google_pay_title: powerboardCredentials.widget.payment_methods_wallets_google_pay_title,
            payment_methods_wallets_google_pay_description: powerboardCredentials.widget.payment_methods_wallets_google_pay_description,
            payment_methods_wallets_afterpay_v2_title: powerboardCredentials.widget.payment_methods_wallets_afterpay_v2_title,
            payment_methods_wallets_afterpay_v2_description: powerboardCredentials.widget.payment_methods_wallets_afterpay_v2_description,
            payment_methods_wallets_paypal_title: powerboardCredentials.widget.payment_methods_wallets_paypal_title,
            payment_methods_wallets_paypal_description: powerboardCredentials.widget.payment_methods_wallets_paypal_description
        },
        alternative_payment_methods: {
            payment_methods_alternative_payment_method_afterpay_v1_title: powerboardCredentials.widget.payment_methods_alternative_payment_method_afterpay_v1_title,
            payment_methods_alternative_payment_method_afterpay_v1_description: powerboardCredentials.widget.payment_methods_alternative_payment_method_afterpay_v1_description,
            payment_methods_alternative_payment_method_zip_title: powerboardCredentials.widget.payment_methods_alternative_payment_method_zip_title,
            payment_methods_alternative_payment_method_zip_description: powerboardCredentials.widget.payment_methods_alternative_payment_method_zip_description
        }
    };
}

function getWidgetStyleConfig(powerboardCredentials) {
    return {
        widget_style_bg_color: powerboardCredentials.widget.widget_style_bg_color,
        widget_style_text_color: powerboardCredentials.widget.widget_style_text_color,
        widget_style_border_color: powerboardCredentials.widget.widget_style_border_color,
        widget_style_error_color: powerboardCredentials.widget.widget_style_success_color,
        widget_style_success_color: powerboardCredentials.widget.widget_style_success_color,
        widget_style_font_size: powerboardCredentials.widget.widget_style_font_size,
        widget_style_font_family: powerboardCredentials.widget.widget_style_font_family,
        widget_style_custom_element: powerboardCredentials.widget.widget_style_custom_element
    };
}

function isUseOnCheckout(paymentMethod, connection, powerboardCredentials, totalPrice) {
    const paymentMethods = {
        'afterpay_v1': 'alternative_payment_method_afterpay_v1',
        'zippay': 'alternative_payment_method_zippay'
    };

    const keysUseOnCheckout = {
        'afterpay_v1': 'alternative_payment_methods_afterpay_v1',
        'zippay': 'alternative_payment_methods_zippay'
    };
    const keyUseOnCheckout = keysUseOnCheckout[paymentMethod];
    const methodKey = paymentMethods[paymentMethod];
    if (!methodKey || !paymentMethod) {
        return 'No';
    }

    const methodConfig = {
        useOnCheckout: connection[`${keyUseOnCheckout}_use_on_checkout`],
        minValue: powerboardCredentials.widget[`payment_methods_${methodKey}_min_value`],
        maxValue: powerboardCredentials.widget[`payment_methods_${methodKey}_max_value`]
    };

    totalPrice = Number(totalPrice);
    const isWithinRange = (!methodConfig.minValue || totalPrice >= Number(methodConfig.minValue)) &&
        (!methodConfig.maxValue || totalPrice <= Number(methodConfig.maxValue));
    return methodConfig.useOnCheckout === 'Yes' && isWithinRange ? 'Yes' : 'No';
}

export default {execute}
