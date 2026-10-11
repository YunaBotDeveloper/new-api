package service

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	vcbExchangeRateURL = "https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx"
	// Vietcombank allows at most one request every 5 minutes.
	vcbExchangeRateInterval = 10 * time.Minute
)

var vcbExchangeRateOnce sync.Once

type vcbExrateList struct {
	Rates []struct {
		CurrencyCode string `xml:"CurrencyCode,attr"`
		Sell         string `xml:"Sell,attr"`
	} `xml:"Exrate"`
}

// StartVCBExchangeRateTask sets Price (VND per 1 USD of quota) to the
// Vietcombank USD sell rate while GPMPayAutoPrice is on.
func StartVCBExchangeRateTask() {
	vcbExchangeRateOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			ticker := time.NewTicker(vcbExchangeRateInterval)
			defer ticker.Stop()
			syncPriceFromVCB()
			for range ticker.C {
				syncPriceFromVCB()
			}
		})
	})
}

func syncPriceFromVCB() {
	if !setting.GPMPayAutoPrice {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	rate, err := fetchVCBUSDSellRate(ctx)
	if err != nil {
		logger.LogWarn(ctx, common.LogText("Vietcombank exchange rate sync failed: %s", err.Error()))
		return
	}
	if rate == operation_setting.Price {
		return
	}
	if err := model.UpdateOption("Price", strconv.FormatFloat(rate, 'f', -1, 64)); err != nil {
		logger.LogWarn(ctx, common.LogText("Vietcombank exchange rate sync failed: %s", err.Error()))
		return
	}
	logger.LogInfo(ctx, common.LogText("top-up price updated from Vietcombank USD sell rate: %v", rate))
}

func fetchVCBUSDSellRate(ctx context.Context) (float64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, vcbExchangeRateURL, nil)
	if err != nil {
		return 0, err
	}
	resp, err := GetHttpClient().Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return 0, err
	}
	return parseVCBUSDSellRate(body)
}

func parseVCBUSDSellRate(body []byte) (float64, error) {
	var list vcbExrateList
	if err := xml.Unmarshal(body, &list); err != nil {
		return 0, err
	}
	for _, rate := range list.Rates {
		if rate.CurrencyCode != "USD" {
			continue
		}
		value, err := strconv.ParseFloat(strings.ReplaceAll(strings.TrimSpace(rate.Sell), ",", ""), 64)
		if err != nil {
			return 0, fmt.Errorf("invalid USD sell rate %q", rate.Sell)
		}
		// A lower rate means the feed format changed; never price top-ups from it.
		if value < setting.GPMPayMinPrice {
			return 0, fmt.Errorf("implausible USD sell rate %q", rate.Sell)
		}
		return value, nil
	}
	return 0, errors.New("USD rate not found")
}
