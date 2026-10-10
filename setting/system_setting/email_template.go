package system_setting

import (
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// EmailTemplateKind identifies one transactional email. Administrators may
// override its subject and HTML body per language under email_template.<kind>.
type EmailTemplateKind string

const (
	EmailTemplateVerification   EmailTemplateKind = "verification"
	EmailTemplatePasswordReset  EmailTemplateKind = "password_reset"
	EmailTemplateEmailBinding   EmailTemplateKind = "email_binding"
	EmailTemplateEmailChange    EmailTemplateKind = "email_change"
	EmailTemplateSecurityNotice EmailTemplateKind = "security_notice"
)

const (
	emailTemplateFallbackLang    = "en"
	emailTemplateSubjectMaxRunes = 200
	emailTemplateBodyMaxBytes    = 20000
)

type EmailTemplate struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// EmailTemplateSettings stores administrator overrides as JSON objects keyed by
// language, e.g. {"en":{"subject":"...","body":"..."}}. A missing language or
// a blank subject/body falls back to the built-in default for that language.
type EmailTemplateSettings struct {
	Verification   string `json:"verification"`
	PasswordReset  string `json:"password_reset"`
	EmailBinding   string `json:"email_binding"`
	EmailChange    string `json:"email_change"`
	SecurityNotice string `json:"security_notice"`
}

var emailTemplateSettings = EmailTemplateSettings{}

func init() {
	config.GlobalConfig.Register("email_template", &emailTemplateSettings)
}

// EmailTemplatePlaceholders lists the placeholders each email supports; the
// first entry is required in the body so the email keeps doing its job (a
// verification email without the code would lock users out).
var EmailTemplatePlaceholders = map[EmailTemplateKind][]string{
	EmailTemplateVerification:   {"{{code}}", "{{site}}", "{{minutes}}"},
	EmailTemplatePasswordReset:  {"{{link}}", "{{site}}", "{{minutes}}"},
	EmailTemplateEmailBinding:   {"{{code}}", "{{site}}"},
	EmailTemplateEmailChange:    {"{{code}}", "{{site}}"},
	EmailTemplateSecurityNotice: {"{{event}}", "{{site}}"},
}

func emailLayout(content string) string {
	return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;line-height:1.6">` +
		`<h2 style="margin:0 0 16px;font-size:20px">{{site}}</h2>` + content + `</div>`
}

const emailCodeBlock = `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0">{{code}}</p>`

func emailResetButton(label string) string {
	return `<p style="margin:20px 0"><a href="{{link}}" style="background:#2563eb;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">` + label + `</a></p>`
}

// DefaultEmailTemplates holds the built-in templates. Its languages are the
// only ones administrators can override; add a language here to support it.
var DefaultEmailTemplates = map[EmailTemplateKind]map[string]EmailTemplate{
	EmailTemplateVerification: {
		"en": {
			Subject: "{{site}} - Email verification code",
			Body: emailLayout(`<p>Hello,</p><p>Your email verification code is:</p>` + emailCodeBlock +
				`<p>This code expires in {{minutes}} minutes. If you did not request it, you can ignore this email.</p>`),
		},
		"zh-CN": {
			Subject: "{{site}} 邮箱验证码",
			Body: emailLayout(`<p>您好，</p><p>您的邮箱验证码为：</p>` + emailCodeBlock +
				`<p>验证码 {{minutes}} 分钟内有效。如果不是本人操作，请忽略此邮件。</p>`),
		},
		"zh-TW": {
			Subject: "{{site}} 電子郵件驗證碼",
			Body: emailLayout(`<p>您好，</p><p>您的電子郵件驗證碼為：</p>` + emailCodeBlock +
				`<p>驗證碼 {{minutes}} 分鐘內有效。如果不是本人操作，請忽略此郵件。</p>`),
		},
	},
	EmailTemplatePasswordReset: {
		"en": {
			Subject: "{{site}} - Password reset",
			Body: emailLayout(`<p>Hello,</p><p>We received a request to reset the password for your account.</p>` +
				emailResetButton("Reset password") +
				`<p>If the button does not work, open this link in your browser:<br><a href="{{link}}">{{link}}</a></p>` +
				`<p>This link expires in {{minutes}} minutes. If you did not request it, you can ignore this email.</p>`),
		},
		"zh-CN": {
			Subject: "{{site}} 密码重置",
			Body: emailLayout(`<p>您好，</p><p>我们收到了重置您账户密码的请求。</p>` +
				emailResetButton("重置密码") +
				`<p>如果按钮无法点击，请将以下链接复制到浏览器中打开：<br><a href="{{link}}">{{link}}</a></p>` +
				`<p>链接 {{minutes}} 分钟内有效。如果不是本人操作，请忽略此邮件。</p>`),
		},
		"zh-TW": {
			Subject: "{{site}} 密碼重設",
			Body: emailLayout(`<p>您好，</p><p>我們收到了重設您帳戶密碼的請求。</p>` +
				emailResetButton("重設密碼") +
				`<p>如果按鈕無法點擊，請將以下連結複製到瀏覽器中開啟：<br><a href="{{link}}">{{link}}</a></p>` +
				`<p>連結 {{minutes}} 分鐘內有效。如果不是本人操作，請忽略此郵件。</p>`),
		},
	},
	EmailTemplateEmailBinding: {
		"en": {
			Subject: "{{site}} - Confirm your email address",
			Body: emailLayout(`<p>Hello,</p><p>Confirm linking this email address to your account. Verification code:</p>` + emailCodeBlock +
				`<p>This code expires in 10 minutes. If you did not request this change, do not share this code.</p>`),
		},
		"zh-CN": {
			Subject: "{{site}} 确认邮箱地址",
			Body: emailLayout(`<p>您好，</p><p>请确认将此邮箱地址绑定到您的账户。验证码：</p>` + emailCodeBlock +
				`<p>验证码 10 分钟内有效。如果不是本人操作，请勿泄露此验证码。</p>`),
		},
		"zh-TW": {
			Subject: "{{site}} 確認電子郵件地址",
			Body: emailLayout(`<p>您好，</p><p>請確認將此電子郵件地址綁定到您的帳戶。驗證碼：</p>` + emailCodeBlock +
				`<p>驗證碼 10 分鐘內有效。如果不是本人操作，請勿洩露此驗證碼。</p>`),
		},
	},
	EmailTemplateEmailChange: {
		"en": {
			Subject: "{{site}} - Confirm email change",
			Body: emailLayout(`<p>Hello,</p><p>A change to your account email address was requested. Confirm replacing your current address with this code:</p>` + emailCodeBlock +
				`<p>This code expires in 10 minutes. If you did not request this change, do not share this code and contact your administrator.</p>`),
		},
		"zh-CN": {
			Subject: "{{site}} 确认更换邮箱",
			Body: emailLayout(`<p>您好，</p><p>有人请求更换您账户的邮箱地址。请使用以下验证码确认替换当前地址：</p>` + emailCodeBlock +
				`<p>验证码 10 分钟内有效。如果不是本人操作，请勿泄露此验证码并联系管理员。</p>`),
		},
		"zh-TW": {
			Subject: "{{site}} 確認更換電子郵件",
			Body: emailLayout(`<p>您好，</p><p>有人請求更換您帳戶的電子郵件地址。請使用以下驗證碼確認替換目前地址：</p>` + emailCodeBlock +
				`<p>驗證碼 10 分鐘內有效。如果不是本人操作，請勿洩露此驗證碼並聯絡管理員。</p>`),
		},
	},
	EmailTemplateSecurityNotice: {
		"en": {
			Subject: "{{site}} - Account security notification",
			Body: emailLayout(`<p>Hello,</p><p>Your account security settings have changed: <strong>{{event}}</strong>.</p>` +
				`<p>If you did not make this change, open your account security settings, revoke other login sessions, and contact your administrator.</p>`),
		},
		"zh-CN": {
			Subject: "{{site}} 账户安全通知",
			Body: emailLayout(`<p>您好，</p><p>您的账户安全设置已变更：<strong>{{event}}</strong>。</p>` +
				`<p>如果不是本人操作，请打开账户安全设置，撤销其他登录会话，并联系管理员。</p>`),
		},
		"zh-TW": {
			Subject: "{{site}} 帳戶安全通知",
			Body: emailLayout(`<p>您好，</p><p>您的帳戶安全設定已變更：<strong>{{event}}</strong>。</p>` +
				`<p>如果不是本人操作，請開啟帳戶安全設定，撤銷其他登入工作階段，並聯絡管理員。</p>`),
		},
	},
}

func emailTemplateOverrides(kind EmailTemplateKind) string {
	switch kind {
	case EmailTemplatePasswordReset:
		return emailTemplateSettings.PasswordReset
	case EmailTemplateEmailBinding:
		return emailTemplateSettings.EmailBinding
	case EmailTemplateEmailChange:
		return emailTemplateSettings.EmailChange
	case EmailTemplateSecurityNotice:
		return emailTemplateSettings.SecurityNotice
	default:
		return emailTemplateSettings.Verification
	}
}

// GetEmailTemplate returns the template for kind in lang. An administrator
// override wins per part; otherwise the built-in default for lang is used,
// and unknown languages fall back to English.
func GetEmailTemplate(kind EmailTemplateKind, lang string) EmailTemplate {
	defaults := DefaultEmailTemplates[kind]
	if _, ok := defaults[lang]; !ok {
		lang = emailTemplateFallbackLang
	}
	result := defaults[lang]

	var overrides map[string]EmailTemplate
	if raw := emailTemplateOverrides(kind); strings.TrimSpace(raw) != "" {
		if err := common.UnmarshalJsonStr(raw, &overrides); err != nil {
			common.SysError("invalid email template override for " + string(kind) + ": " + err.Error())
			return result
		}
	}
	override := overrides[lang]
	if strings.TrimSpace(override.Subject) != "" {
		result.Subject = override.Subject
	}
	if strings.TrimSpace(override.Body) != "" {
		result.Body = override.Body
	}
	return result
}

// ValidateEmailTemplateOption checks an email_template.<kind> value before it
// is saved. A blank value clears all overrides for that email.
func ValidateEmailTemplateOption(kind string, value string) error {
	defaults, ok := DefaultEmailTemplates[EmailTemplateKind(kind)]
	if !ok {
		return fmt.Errorf("unknown email template: %s", kind)
	}
	if strings.TrimSpace(value) == "" {
		return nil
	}
	var overrides map[string]EmailTemplate
	if err := common.UnmarshalJsonStr(value, &overrides); err != nil {
		return fmt.Errorf("email template must be a JSON object keyed by language")
	}
	required := EmailTemplatePlaceholders[EmailTemplateKind(kind)][0]
	for lang, tpl := range overrides {
		if _, ok := defaults[lang]; !ok {
			return fmt.Errorf("unsupported email template language: %s", lang)
		}
		if strings.ContainsAny(tpl.Subject, "\r\n") {
			return fmt.Errorf("email subject must be a single line")
		}
		if utf8.RuneCountInString(tpl.Subject) > emailTemplateSubjectMaxRunes {
			return fmt.Errorf("email subject must be at most %d characters", emailTemplateSubjectMaxRunes)
		}
		if len(tpl.Body) > emailTemplateBodyMaxBytes {
			return fmt.Errorf("email body must be at most %d bytes", emailTemplateBodyMaxBytes)
		}
		if strings.TrimSpace(tpl.Body) != "" && !strings.Contains(tpl.Body, required) {
			return fmt.Errorf("email body (%s) must contain %s", lang, required)
		}
	}
	return nil
}

// EmailTemplateLanguages returns the languages that have built-in templates.
func EmailTemplateLanguages() []string {
	langs := make([]string, 0, len(DefaultEmailTemplates[EmailTemplateVerification]))
	for lang := range DefaultEmailTemplates[EmailTemplateVerification] {
		langs = append(langs, lang)
	}
	slices.Sort(langs)
	return langs
}
