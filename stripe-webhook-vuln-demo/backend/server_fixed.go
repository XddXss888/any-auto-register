package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/stripe/stripe-go/v74/webhook"
)

func main() {
	// 【防御措施 1】: 从环境变量获取 Webhook Secret，并强制校验是否为空
	// 在实际生产环境中，请确保设置了正确的 STRIPE_WEBHOOK_SECRET 环境变量
	endpointSecret := os.Getenv("STRIPE_WEBHOOK_SECRET")
	if endpointSecret == "" {
		log.Fatal("🚨 致命错误: STRIPE_WEBHOOK_SECRET 环境变量未设置或为空！")
	}

	http.HandleFunc("/api/stripe/webhook", func(w http.ResponseWriter, r *http.Request) {
		const MaxBodyBytes = int64(65536)
		r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)
		payload, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Error reading request body", http.StatusServiceUnavailable)
			return
		}

		signatureHeader := r.Header.Get("Stripe-Signature")
		fmt.Printf("\n[请求到达] 收到 Webhook 请求，Signature Header: %s\n", signatureHeader)

		// 使用配置好的非空密钥进行验签
		event, err := webhook.ConstructEventWithOptions(payload, signatureHeader, endpointSecret, webhook.ConstructEventOptions{
			IgnoreAPIVersionMismatch: true,
		})

		if err != nil {
			fmt.Printf("❌ 签名验证失败: %v\n", err)
			http.Error(w, "Webhook signature verification failed", http.StatusBadRequest)
			return
		}

		if event.Type == "checkout.session.completed" {
			fmt.Println("✅ [验签通过] 成功解析事件类型: checkout.session.completed")

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

			// 【防御措施 2 (建议)】: 可以在这里增加主动调用 Stripe API 查询订单真实状态的逻辑
			// 示例：
			// checkoutSession, err := session.Get(event.Data.Object.ID, nil)
			// if checkoutSession.PaymentStatus == stripe.CheckoutSessionPaymentStatusPaid { ... }

			fmt.Println("--------------------------------------------------")
			fmt.Printf("🛡️  [业务处理 - 安全版] 读取 client_reference_id 查找订单: %s\n", clientRefID)
			fmt.Printf("🛡️  [业务处理 - 安全版] 标记订单已支付，给用户充值金额: %.2f\n", amount/100)
			fmt.Println("--------------------------------------------------")
		}

		w.WriteHeader(http.StatusOK)
	})

	fmt.Println("🚀 安全版 Webhook 服务器已启动，监听端口 8081...")
	fmt.Println("👉 Webhook 端点: http://localhost:8081/api/stripe/webhook")
	log.Fatal(http.ListenAndServe(":8081", nil))
}
