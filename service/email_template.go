package service

import (
	"html"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// RenderEmail fills the template for kind in lang. {{site}} is always set.
// Values are HTML-escaped in the body and substituted in a single pass, so a
// value can never inject another placeholder; the subject is kept on one line.
func RenderEmail(kind system_setting.EmailTemplateKind, lang string, values map[string]string) (subject string, body string) {
	tpl := system_setting.GetEmailTemplate(kind, lang)

	subjectPairs := []string{"{{site}}", common.SystemName}
	bodyPairs := []string{"{{site}}", html.EscapeString(common.SystemName)}
	for key, value := range values {
		placeholder := "{{" + key + "}}"
		subjectPairs = append(subjectPairs, placeholder, value)
		bodyPairs = append(bodyPairs, placeholder, html.EscapeString(value))
	}

	subject = strings.NewReplacer(subjectPairs...).Replace(tpl.Subject)
	subject = strings.Join(strings.Fields(subject), " ")
	body = strings.NewReplacer(bodyPairs...).Replace(tpl.Body)
	return subject, body
}
