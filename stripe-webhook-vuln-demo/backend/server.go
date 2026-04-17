package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/stripe/stripe-go/v74/webhook"
)

func main() {
	http.HandleFunc("/api/stripe/webhook", func(w http.ResponseWriter, r *http.Request) {
		const MaxBodyBytes = int64(65536)
		r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)
		payload, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Error reading request body", http.StatusServiceUnavailable)
			return
		}

		// 【漏洞点】: 第一阶段，发现目标暴露了 Webhook 端点，并使用了空的 StripeWebhookSecret
		endpointSecret := ""

		signatureHeader := r.Header.Get("Stripe-Signature")
		fmt.Printf("\n[请求到达] 收到 Webhook 请求，Signature Header: %s\n", signatureHeader)

		// 【第二阶段】: Stripe 的签名机制，使用空密钥验签
		event, err := webhook.ConstructEventWithOptions(payload, signatureHeader, endpointSecret, webhook.ConstructEventOptions{
			IgnoreAPIVersionMismatch: true,
		})

		if err != nil {
			fmt.Printf("❌ 签名验证失败: %v\n", err)
			http.Error(w, "Webhook signature verification failed", http.StatusBadRequest)
			return
		}

		// 【第四阶段】: 收到请求，用空密钥验签通过
		if event.Type == "checkout.session.completed" {
			fmt.Println("✅ [验签通过] 成功解析事件类型: checkout.session.completed")

			// 解析 payload 获取 client_reference_id
			var session map[string]interface{}
			if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
				fmt.Println("❌ 解析事件数据失败:", err)
				w.WriteHeader(http.StatusBadRequest)
				return
			}

			clientRefID := ""
			amount := float64(0)
			
			if ref, ok := session["client_reference_id"].(string); ok {
				clientRefID = ref
			}
			if amt, ok := session["amount_total"].(float64); ok {
				amount = amt
			}

			// 【第五阶段】: 结果，服务端标记订单已支付，给用户充值
			fmt.Println("--------------------------------------------------")
			fmt.Printf("💰 [业务处理] 读取 client_reference_id 查找订单: %s\n", clientRefID)
			fmt.Printf("💰 [业务处理] 标记订单已支付，给用户充值金额: %.2f\n", amount/100)
			fmt.Println("⚠️  [安全警告] 实际上 Stripe 从未发生真实支付，系统被“零元充值”！")
			fmt.Println("--------------------------------------------------")
		}

		w.WriteHeader(http.StatusOK)
	})

	fmt.Println("🚀 漏洞测试服务器已启动，监听端口 8080...")
	fmt.Println("👉 Webhook 端点: http://localhost:8080/api/stripe/webhook")
	fmt.Println("等待接收伪造请求...")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
