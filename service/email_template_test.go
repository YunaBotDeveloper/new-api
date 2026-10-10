package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setEmailTemplateOverride(t *testing.T, kind string, value string) {
	t.Helper()
	cfg := config.GlobalConfig.Get("email_template")
	require.NotNil(t, cfg)
	require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{kind: value}))
	t.Cleanup(func() {
		require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{kind: ""}))
	})
}

func TestRenderEmailEscapesValuesAndKeepsSubjectOnOneLine(t *testing.T) {
	originalName := common.SystemName
	common.SystemName = "Acme <Gateway>"
	t.Cleanup(func() { common.SystemName = originalName })
	setEmailTemplateOverride(t, "security_notice",
		`{"en":{"subject":"{{site}}: {{event}}","body":"<p>{{site}} {{event}}</p>"}}`)

	subject, body := RenderEmail(system_setting.EmailTemplateSecurityNotice, "en",
		map[string]string{"event": "<script>x</script>\r\nBcc: a@b.c {{site}}"})

	assert.Equal(t, "Acme <Gateway>: <script>x</script> Bcc: a@b.c {{site}}", subject)
	assert.Equal(t, "<p>Acme &lt;Gateway&gt; &lt;script&gt;x&lt;/script&gt;\r\nBcc: a@b.c {{site}}</p>", body)
}

func TestGetEmailTemplateFallsBackPerPartAndLanguage(t *testing.T) {
	setEmailTemplateOverride(t, "verification", `{"zh-CN":{"subject":"自定义 {{code}}","body":""}}`)

	zh := system_setting.GetEmailTemplate(system_setting.EmailTemplateVerification, "zh-CN")
	assert.Equal(t, "自定义 {{code}}", zh.Subject)
	assert.Equal(t, system_setting.DefaultEmailTemplates[system_setting.EmailTemplateVerification]["zh-CN"].Body, zh.Body)

	unknown := system_setting.GetEmailTemplate(system_setting.EmailTemplateVerification, "vi")
	assert.Equal(t, system_setting.DefaultEmailTemplates[system_setting.EmailTemplateVerification]["en"], unknown)
}

func TestValidateEmailTemplateOption(t *testing.T) {
	tests := []struct {
		name    string
		kind    string
		value   string
		wantErr bool
	}{
		{name: "blank restores defaults", kind: "verification", value: "", wantErr: false},
		{name: "valid override", kind: "verification", value: `{"en":{"subject":"Code","body":"<b>{{code}}</b>"}}`, wantErr: false},
		{name: "subject-only override keeps default body", kind: "password_reset", value: `{"en":{"subject":"Reset","body":""}}`, wantErr: false},
		{name: "body without required code", kind: "verification", value: `{"en":{"subject":"Code","body":"no code"}}`, wantErr: true},
		{name: "reset body without link", kind: "password_reset", value: `{"en":{"subject":"","body":"{{code}}"}}`, wantErr: true},
		{name: "multi-line subject", kind: "email_binding", value: `{"en":{"subject":"a\nb","body":""}}`, wantErr: true},
		{name: "unsupported language", kind: "verification", value: `{"xx":{"subject":"a","body":"{{code}}"}}`, wantErr: true},
		{name: "unknown template", kind: "welcome", value: `{}`, wantErr: true},
		{name: "not a JSON object", kind: "verification", value: `[1]`, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := system_setting.ValidateEmailTemplateOption(tt.kind, tt.value)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestNormalizeLangMapsFrontendTraditionalChineseCode(t *testing.T) {
	assert.Equal(t, i18n.LangZhTW, i18n.NormalizeLang("zhTW"))
	assert.Equal(t, i18n.LangZhTW, i18n.NormalizeLang("zh-Hant-TW"))
	assert.Equal(t, i18n.LangZhCN, i18n.NormalizeLang("zhCN"))
	assert.Equal(t, i18n.LangEn, i18n.NormalizeLang("vi"))
}
