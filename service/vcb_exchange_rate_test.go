package service

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseVCBUSDSellRate(t *testing.T) {
	const feed = `<!--For reference only. Only one request every 5 minutes!-->
<ExrateList>
  <DateTime>10/11/2026 11:20:35 PM</DateTime>
  <Exrate CurrencyCode="AUD" CurrencyName="AUSTRALIAN DOLLAR   " Buy="17,609.30" Transfer="17,787.17" Sell="18,357.26" />
  <Exrate CurrencyCode="USD" CurrencyName="US DOLLAR           " Buy="25,660.00" Transfer="25,690.00" Sell="%s" />
  <Source>Joint Stock Commercial Bank for Foreign Trade of Vietnam - Vietcombank</Source>
</ExrateList>`
	testCases := []struct {
		name    string
		body    string
		want    float64
		wantErr bool
	}{
		{name: "usd sell rate", body: fmt.Sprintf(feed, "26,070.00"), want: 26070},
		{name: "european number format is rejected", body: fmt.Sprintf(feed, "26.070,00"), wantErr: true},
		{name: "dash is rejected", body: fmt.Sprintf(feed, "-"), wantErr: true},
		{name: "missing usd", body: `<ExrateList><Exrate CurrencyCode="EUR" Sell="29,826.12" /></ExrateList>`, wantErr: true},
		{name: "not xml", body: `<html>maintenance`, wantErr: true},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseVCBUSDSellRate([]byte(tc.body))
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}
