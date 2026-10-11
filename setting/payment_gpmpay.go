package setting

var GPMPayWebhookSecret = ""
var GPMPayBankBin = ""
var GPMPayAccountNumber = ""
var GPMPayAccountName = ""
var GPMPayCodePrefix = "NAP"

// GPMPayMinPrice is the lowest plausible Price (VND per 1 USD of quota). Below it
// Price is still in another currency (default 7.3) and would sell quota for a few dong.
const GPMPayMinPrice = 1000

// GPMPayAutoPrice keeps operation_setting.Price in sync with the Vietcombank USD sell rate.
var GPMPayAutoPrice = false
