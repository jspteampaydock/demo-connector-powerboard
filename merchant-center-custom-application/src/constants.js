export const INITIAL_LIVE_CONNECTION_FORM = {
  credentials_type: 'credentials',
  credentials_public_key: '',
  credentials_secret_key: '',
  credentials_access_key: '',
  credentials_widget_access_key: '',
  card_use_on_checkout: 'No',
  card_supported_card_schemes: '',
  card_gateway_id: '',
  card_3ds: 'Disable',
  card_3ds_service_id: '',
  card_3ds_flow: 'With vault',
  card_fraud: 'Disable',
  card_fraud_service_id: '',
  card_direct_charge: 'Enable',
  card_card_save: 'Disable',
  card_card_method_save: 'Vault token',
  bank_accounts_use_on_checkout: 'No',
  bank_accounts_gateway_id: '',
  bank_accounts_bank_account_save: 'Disable',
  bank_accounts_bank_method_save: 'Vault token',
  wallets_apple_pay_use_on_checkout: '',
  wallets_apple_pay_gateway_id: '',
  wallets_apple_pay_fraud: 'Disable',
  wallets_apple_pay_fraud_service_id: '',
  wallets_apple_pay_direct_charge: 'Disable',
  wallets_google_pay_use_on_checkout: '',
  wallets_google_pay_gateway_id: '',
  wallets_google_pay_fraud: 'Disable',
  wallets_google_pay_fraud_service_id: '',
  wallets_google_pay_direct_charge: 'Disable',
  wallets_paypal_smart_button_use_on_checkout: '',
  wallets_paypal_smart_button_gateway_id: '',
  wallets_paypal_smart_button_fraud: 'Disable',
  wallets_paypal_smart_button_fraud_service_id: '',
  wallets_paypal_smart_button_direct_charge: 'Disable',
  wallets_paypal_smart_button_pay_later: 'Disable',
  wallets_afterpay_v2_use_on_checkout: '',
  wallets_afterpay_v2_gateway_id: '',
  wallets_afterpay_v2_fraud: 'Disable',
  wallets_afterpay_v2_fraud_service_id: '',
  wallets_afterpay_v2_direct_charge: 'Disable',
  alternative_payment_methods_afterpay_v1_use_on_checkout: '',
  alternative_payment_methods_afterpay_v1_gateway_id: '',
  alternative_payment_methods_afterpay_v1_fraud: 'Disable',
  alternative_payment_methods_afterpay_v1_fraud_service_id: '',
  alternative_payment_methods_afterpay_v1_direct_charge: 'Enable',
  alternative_payment_methods_zippay_use_on_checkout: '',
  alternative_payment_methods_zippay_gateway_id: '',
  alternative_payment_methods_zippay_fraud: 'Disable',
  alternative_payment_methods_zippay_fraud_service_id: '',
  alternative_payment_methods_zippay_direct_charge: 'Disable',
};
export const INITIAL_SANDBOX_CONNECTION_FORM = {
  sandbox_mode: 'No', ...INITIAL_LIVE_CONNECTION_FORM,
};
export const INITIAL_WIDGET_FORM = {
  version_version: 'Custom',
  version_custom_version: '',
  payment_methods_cards_title: '',
  payment_methods_cards_description: '',
  payment_methods_wallets_apple_pay_title: '',
  payment_methods_wallets_apple_pay_description: '',
  payment_methods_wallets_google_pay_title: '',
  payment_methods_wallets_google_pay_description: '',
  payment_methods_wallets_paypal_title: '',
  payment_methods_wallets_paypal_description: '',
  payment_methods_alternative_payment_method_afterpay_v1_title: '',
  payment_methods_alternative_payment_method_afterpay_v1_description: '',
  payment_methods_alternative_payment_method_zip_title: '',
  payment_methods_alternative_payment_method_zip_description: '',
  widget_style_bg_color: '#D9D9D9',
  widget_style_text_color: '#000000',
  widget_style_border_color: '#000000',
  widget_style_error_color: '#E71313',
  widget_style_success_color: '#51B97C',
  widget_style_font_size: '14px',
  widget_style_font_family: 'ui-rounded',
  widget_style_custom_element: '',
};

export const CHARGE_STATUSES =  {
  'powerboard-pending': 'Pending via PowerBoard',
  'powerboard-paid': 'Paid via PowerBoard',
  'powerboard-authorize': 'Authorized via PowerBoard',
  'powerboard-cancelled': 'Cancelled via PowerBoard',
  'powerboard-refunded': 'Refunded via PowerBoard',
  'powerboard-p-refund': 'Partial refunded via PowerBoard',
  'powerboard-requested': 'Requested via PowerBoard',
  'powerboard-failed': 'Failed via PowerBoard',
  'powerboard-received': 'Received via PowerBoard',
  'powerboard-p-paid': 'Partial paid via PowerBoard',
}
export const API_LIVE_URL = 'https://api.powerboard.commbank.com.au';
export const API_SANDBOX_URL = 'https://api.preproduction.powerboard.commbank.com.au';

export const NOTIFICATIONS = [
  "standalone_fraud_check_success",
  "standalone_fraud_check_in_review_approved",
  "standalone_fraud_check_in_review_declined",
  "standalone_fraud_check_in_review_async_approved",
  "standalone_fraud_check_in_review_async_declined",
  "fraud_check_transaction_in_review_declined",
  "fraud_check_transaction_in_review_approved",
  "fraud_check_failed",
  "fraud_check_success",
  "fraud_check_transaction_in_review_async_declined",
  "fraud_check_transaction_in_review_async_approved",
  "fraud_check_in_review_async_declined",
  "fraud_check_in_review_async_approved",
  "fraud_check_in_review",
  "standalone_fraud_check_failed",
  "standalone_fraud_check_in_review",
  "refund_failure",
  "refund_success",
  "refund_requested",
  "standalone_fraud_check_in_review_declined",
  "transaction_success",
  "transaction_failure"
]