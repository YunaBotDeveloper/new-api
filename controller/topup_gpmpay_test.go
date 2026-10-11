package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func signGPMPayBody(secret string, ts int64, body string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(strconv.FormatInt(ts, 10) + "." + body))
	return fmt.Sprintf("t=%d,v1=%s", ts, hex.EncodeToString(mac.Sum(nil)))
}

func TestVerifyGPMPaySignature(t *testing.T) {
	now := time.Unix(1_760_000_000, 0)
	body := `{"id":"evt"}`
	valid := signGPMPayBody("whsec", now.Unix(), body)
	testCases := []struct {
		name   string
		header string
		body   string
		want   bool
	}{
		{name: "valid", header: valid, body: body, want: true},
		{name: "valid among rotated signatures", header: "t=1760000000,v1=00ff," + strings.TrimPrefix(valid, "t=1760000000,"), body: body, want: true},
		{name: "wrong secret", header: signGPMPayBody("other", now.Unix(), body), body: body},
		{name: "tampered body", header: valid, body: `{"id":"evt2"}`},
		{name: "stale timestamp", header: signGPMPayBody("whsec", now.Unix()-301, body), body: body},
		{name: "future timestamp", header: signGPMPayBody("whsec", now.Unix()+301, body), body: body},
		{name: "missing header", header: "", body: body},
		{name: "missing signature", header: "t=1760000000", body: body},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, verifyGPMPaySignature(tc.header, []byte(tc.body), "whsec", now))
		})
	}
}

func TestGPMPayWebhookCreditsMatchingOrder(t *testing.T) {
	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldQuotaPerUnit, oldRedis := common.QuotaPerUnit, common.RedisEnabled
	oldSecret, oldAccount, oldPrefix := setting.GPMPayWebhookSecret, setting.GPMPayAccountNumber, setting.GPMPayCodePrefix
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.Log{}))
	model.DB, model.LOG_DB = db, db
	common.QuotaPerUnit, common.RedisEnabled = 500000, false
	setting.GPMPayWebhookSecret, setting.GPMPayAccountNumber, setting.GPMPayCodePrefix = "whsec", "0123456789", "NAP"
	t.Cleanup(func() {
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.QuotaPerUnit, common.RedisEnabled = oldQuotaPerUnit, oldRedis
		setting.GPMPayWebhookSecret, setting.GPMPayAccountNumber, setting.GPMPayCodePrefix = oldSecret, oldAccount, oldPrefix
		if sqlDB, dbErr := db.DB(); dbErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	testCases := []struct {
		name       string
		account    string
		amount     int
		source     string
		signSecret string
		deliveries int
		wantHTTP   int
		wantStatus string
		wantQuota  int
	}{
		{name: "paid order credits exactly once", account: "0123456789", amount: 26000, source: "REAL", signSecret: "whsec", deliveries: 2, wantHTTP: http.StatusOK, wantStatus: common.TopUpStatusSuccess, wantQuota: 500000},
		{name: "underpaid order stays pending", account: "0123456789", amount: 25999, source: "REAL", signSecret: "whsec", deliveries: 1, wantHTTP: http.StatusOK, wantStatus: common.TopUpStatusPending},
		{name: "simulated event is ignored", account: "0123456789", amount: 26000, source: "SIMULATED", signSecret: "whsec", deliveries: 1, wantHTTP: http.StatusOK, wantStatus: common.TopUpStatusPending},
		{name: "other bank account is ignored", account: "999", amount: 26000, source: "REAL", signSecret: "whsec", deliveries: 1, wantHTTP: http.StatusOK, wantStatus: common.TopUpStatusPending},
		{name: "forged signature is rejected", account: "0123456789", amount: 26000, source: "REAL", signSecret: "forged", deliveries: 1, wantHTTP: http.StatusUnauthorized, wantStatus: common.TopUpStatusPending},
	}
	gin.SetMode(gin.TestMode)
	for i, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			userId := 100 + i
			tradeNo := fmt.Sprintf("NAPTESTCODE%02d", i)
			require.NoError(t, db.Create(&model.User{Id: userId, Username: fmt.Sprintf("gpmpay_%d", i), Status: common.UserStatusEnabled, AffCode: tradeNo}).Error)
			require.NoError(t, db.Create(&model.TopUp{
				UserId: userId, Amount: 1, Money: 26000, TradeNo: tradeNo,
				PaymentMethod: model.PaymentMethodVietQR, PaymentProvider: model.PaymentProviderGPMPay,
				CreateTime: time.Now().Unix(), Status: common.TopUpStatusPending,
			}).Error)

			// Banks rewrite the note around the code (and may change its case).
			body := fmt.Sprintf(`{"id":"evt-%d","accountNumber":%q,"subAccount":null,"content":"MBVCB.1.%s.CT tu A","transferType":"in","transferAmount":%d,"referenceCode":"FT1","source":%q}`,
				i, tc.account, strings.ToLower(tradeNo), tc.amount, tc.source)
			for range tc.deliveries {
				recorder := httptest.NewRecorder()
				ctx, _ := gin.CreateTestContext(recorder)
				ctx.Request = httptest.NewRequest(http.MethodPost, "/api/gpmpay/webhook", strings.NewReader(body))
				ctx.Request.Header.Set("X-GPMPay-Signature", signGPMPayBody(tc.signSecret, time.Now().Unix(), body))
				GPMPayWebhook(ctx)
				ctx.Writer.WriteHeaderNow() // gin flushes the status after the handler
				assert.Equal(t, tc.wantHTTP, recorder.Code)
			}

			var topUp model.TopUp
			require.NoError(t, db.Where("trade_no = ?", tradeNo).First(&topUp).Error)
			assert.Equal(t, tc.wantStatus, topUp.Status)
			var user model.User
			require.NoError(t, db.Select("quota").Where("id = ?", userId).First(&user).Error)
			assert.Equal(t, tc.wantQuota, user.Quota)
		})
	}
}

func TestGPMPayTopUpDisabledWhilePriceIsNotVND(t *testing.T) {
	paymentSetting := operation_setting.GetPaymentSetting()
	oldPrice, oldConfirmed, oldVersion := operation_setting.Price, paymentSetting.ComplianceConfirmed, paymentSetting.ComplianceTermsVersion
	oldSecret, oldBin, oldAccount := setting.GPMPayWebhookSecret, setting.GPMPayBankBin, setting.GPMPayAccountNumber
	paymentSetting.ComplianceConfirmed, paymentSetting.ComplianceTermsVersion = true, operation_setting.CurrentComplianceTermsVersion
	setting.GPMPayWebhookSecret, setting.GPMPayBankBin, setting.GPMPayAccountNumber = "whsec", "970436", "0123456789"
	t.Cleanup(func() {
		operation_setting.Price, paymentSetting.ComplianceConfirmed, paymentSetting.ComplianceTermsVersion = oldPrice, oldConfirmed, oldVersion
		setting.GPMPayWebhookSecret, setting.GPMPayBankBin, setting.GPMPayAccountNumber = oldSecret, oldBin, oldAccount
	})

	operation_setting.Price = 7.3 // legacy CNY default would sell 1 USD for 7 dong
	assert.False(t, isGPMPayTopUpEnabled())
	operation_setting.Price = 26070
	assert.True(t, isGPMPayTopUpEnabled())
}
