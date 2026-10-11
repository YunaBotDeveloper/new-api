package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/shopspring/decimal"
)

// GPMPay has no checkout API: the user transfers to the merchant bank account
// with the order's reconciliation code in the transfer note, and GPMPay posts
// every balance change to our webhook. See https://docs.gpmpay.com/webhook.
const (
	gpmPayCodeLength          = 10
	gpmPaySignatureToleranceS = 300
)

var gpmPayCodeCharset = append(append([]rune{}, lo.UpperCaseLettersCharset...), lo.NumbersCharset...)

type gpmPayWebhookPayload struct {
	Id             string          `json:"id"`
	AccountNumber  string          `json:"accountNumber"`
	SubAccount     string          `json:"subAccount"`
	Content        string          `json:"content"`
	TransferType   string          `json:"transferType"`
	TransferAmount decimal.Decimal `json:"transferAmount"`
	ReferenceCode  string          `json:"referenceCode"`
	Source         string          `json:"source"`
	Test           bool            `json:"test"`
}

func isGPMPayTopUpEnabled() bool {
	return operation_setting.IsPaymentComplianceConfirmed() &&
		operation_setting.Price >= setting.GPMPayMinPrice &&
		strings.TrimSpace(setting.GPMPayWebhookSecret) != "" &&
		strings.TrimSpace(setting.GPMPayBankBin) != "" &&
		strings.TrimSpace(setting.GPMPayAccountNumber) != ""
}

// gpmPayCodePrefix keeps only A-Z0-9 because banks strip other characters
// from transfer notes.
func gpmPayCodePrefix() string {
	prefix := strings.Map(func(r rune) rune {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			return r
		}
		return -1
	}, strings.ToUpper(setting.GPMPayCodePrefix))
	if prefix == "" {
		return "NAP"
	}
	return prefix
}

func RequestGPMPayPay(c *gin.Context) {
	if !isGPMPayTopUpEnabled() {
		paymentError(c, common.NewMessage("Online top-up is not enabled"))
		return
	}
	var req AmountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	if req.Amount < getMinTopup() {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": getMinTopup()}))
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		paymentError(c, common.NewMessage("Failed to get the user group"))
		return
	}
	// Bank transfers are whole VND; round up so the order is never underpaid.
	amountVND := decimal.NewFromFloat(getPayMoney(req.Amount, group)).Round(2).Ceil().IntPart()
	if amountVND < 1 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}

	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = decimal.NewFromInt(amount).Div(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart()
	}
	tradeNo := gpmPayCodePrefix() + lo.RandomString(gpmPayCodeLength, gpmPayCodeCharset)
	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           float64(amountVND),
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodVietQR,
		PaymentProvider: model.PaymentProviderGPMPay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("GPMPay failed to create top-up order user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}

	bankBin := strings.TrimSpace(setting.GPMPayBankBin)
	accountNumber := strings.TrimSpace(setting.GPMPayAccountNumber)
	accountName := strings.TrimSpace(setting.GPMPayAccountName)
	qrUrl := fmt.Sprintf("https://img.vietqr.io/image/%s-%s-compact.png?amount=%d&addInfo=%s&accountName=%s",
		url.PathEscape(bankBin), url.PathEscape(accountNumber), amountVND, url.QueryEscape(tradeNo), url.QueryEscape(accountName))
	logger.LogInfo(c.Request.Context(), common.LogText("GPMPay top-up order created user_id=%d trade_no=%s amount=%d amount_vnd=%d", id, tradeNo, req.Amount, amountVND))
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{
		"trade_no":       tradeNo,
		"amount_vnd":     amountVND,
		"qr_url":         qrUrl,
		"bank_bin":       bankBin,
		"account_number": accountNumber,
		"account_name":   accountName,
		"content":        tradeNo,
	}})
}

// verifyGPMPaySignature checks `X-GPMPay-Signature: t=<unix>,v1=<hex>` where
// v1 = HMAC_SHA256(secret, t + "." + raw_body), rejecting stale timestamps.
func verifyGPMPaySignature(header string, body []byte, secret string, now time.Time) bool {
	var timestamp string
	var signatures [][]byte
	for part := range strings.SplitSeq(header, ",") {
		key, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if !ok {
			continue
		}
		switch key {
		case "t":
			timestamp = value
		case "v1":
			if sig, err := hex.DecodeString(value); err == nil {
				signatures = append(signatures, sig)
			}
		}
	}
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil || len(signatures) == 0 || secret == "" {
		return false
	}
	if drift := now.Unix() - ts; drift > gpmPaySignatureToleranceS || drift < -gpmPaySignatureToleranceS {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(body)
	expected := mac.Sum(nil)
	for _, sig := range signatures {
		if hmac.Equal(sig, expected) {
			return true
		}
	}
	return false
}

// GPMPayWebhook answers 2xx for every event it has finished with (credited,
// duplicate, or deliberately ignored) and 5xx only when a retry can help.
func GPMPayWebhook(c *gin.Context) {
	ctx := c.Request.Context()
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	if !verifyGPMPaySignature(c.GetHeader("X-GPMPay-Signature"), body, strings.TrimSpace(setting.GPMPayWebhookSecret), time.Now()) {
		logger.LogWarn(ctx, common.LogText("GPMPay webhook signature verification failed client_ip=%s", c.ClientIP()))
		c.Status(http.StatusUnauthorized)
		return
	}
	var payload gpmPayWebhookPayload
	if err := common.Unmarshal(body, &payload); err != nil {
		logger.LogWarn(ctx, common.LogText("GPMPay webhook payload is invalid client_ip=%s error=%q", c.ClientIP(), err.Error()))
		c.Status(http.StatusBadRequest)
		return
	}
	if payload.Test || payload.TransferType != "in" {
		c.Status(http.StatusOK)
		return
	}
	// Simulator events are signed with the same secret; never let them mint quota.
	if payload.Source == "SIMULATED" {
		logger.LogInfo(ctx, common.LogText("GPMPay simulated event ignored id=%s content=%q", payload.Id, payload.Content))
		c.Status(http.StatusOK)
		return
	}
	accountNumber := strings.TrimSpace(setting.GPMPayAccountNumber)
	if payload.AccountNumber != accountNumber && payload.SubAccount != accountNumber {
		logger.LogInfo(ctx, common.LogText("GPMPay event for another account ignored id=%s account=%s", payload.Id, payload.AccountNumber))
		c.Status(http.StatusOK)
		return
	}

	codePattern := regexp.MustCompile(`(?i)` + gpmPayCodePrefix() + `[A-Z0-9]{` + strconv.Itoa(gpmPayCodeLength) + `}`)
	var topUp *model.TopUp
	for _, code := range codePattern.FindAllString(payload.Content, -1) {
		topUp = model.GetTopUpByTradeNo(strings.ToUpper(code))
		if topUp != nil && topUp.PaymentProvider == model.PaymentProviderGPMPay {
			break
		}
		topUp = nil
	}
	if topUp == nil {
		logger.LogInfo(ctx, common.LogText("GPMPay event without a matching order id=%s amount=%s content=%q", payload.Id, payload.TransferAmount.String(), payload.Content))
		c.Status(http.StatusOK)
		return
	}
	if payload.TransferAmount.LessThan(decimal.NewFromFloat(topUp.Money)) {
		logger.LogWarn(ctx, common.LogText("GPMPay underpaid order left pending trade_no=%s id=%s expected=%.0f received=%s", topUp.TradeNo, payload.Id, topUp.Money, payload.TransferAmount.String()))
		c.Status(http.StatusOK)
		return
	}

	LockOrder(topUp.TradeNo)
	defer UnlockOrder(topUp.TradeNo)
	alreadyDone, err := model.RechargeTopUp(topUp.TradeNo, model.PaymentProviderGPMPay, model.PaymentMethodVietQR, c.ClientIP())
	switch {
	case errors.Is(err, model.ErrTopUpStatusInvalid):
		logger.LogWarn(ctx, common.LogText("GPMPay paid order is not pending trade_no=%s id=%s reference=%s", topUp.TradeNo, payload.Id, payload.ReferenceCode))
	case err != nil:
		logger.LogError(ctx, common.LogText("GPMPay top-up processing failed trade_no=%s id=%s error=%q", topUp.TradeNo, payload.Id, err.Error()))
		c.Status(http.StatusInternalServerError)
		return
	case alreadyDone:
		logger.LogInfo(ctx, common.LogText("GPMPay duplicate event ignored trade_no=%s id=%s", topUp.TradeNo, payload.Id))
	default:
		logger.LogInfo(ctx, common.LogText("GPMPay top-up succeeded trade_no=%s id=%s reference=%s amount=%s", topUp.TradeNo, payload.Id, payload.ReferenceCode, payload.TransferAmount.String()))
	}
	c.Status(http.StatusOK)
}
