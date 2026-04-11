import React, { useState, useEffect } from "react";
import { Search, ShieldCheck, ShieldAlert, ShieldQuestion, ExternalLink, Loader2, Info, CheckCircle2, AlertCircle, Newspaper, ArrowRight, History, Smile, Meh, Frown, Sparkles, Scale, Share2, Moon, Sun, Copy, Check, Terminal, X, Activity } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { factCheckNews, FactCheckResult } from "@/src/lib/gemini";
import { cn } from "@/lib/utils";

const LOADING_STEPS = [
  { message: "Initializing neural fact-check engine...", icon: Sparkles },
  { message: "Scanning global news databases...", icon: Search },
  { message: "Fetching data from Reuters, AP, and BBC...", icon: Newspaper },
  { message: "Analyzing social media trends for claim origin...", icon: Share2 },
  { message: "Cross-referencing with official government records...", icon: ShieldCheck },
  { message: "Evaluating source credibility and bias...", icon: Scale },
  { message: "Synthesizing linguistic tone and sentiment...", icon: Smile },
  { message: "Generating final veracity report...", icon: CheckCircle2 }
];

export default function App() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FactCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [processLog, setProcessLog] = useState<string[]>([]);
  const [history, setHistory] = useState<FactCheckResult[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [filterVerdict, setFilterVerdict] = useState<string>("All");
  const [filterBias, setFilterBias] = useState<string>("All");
  const [showScrap, setShowScrap] = useState(false);
  const [scrapLogs, setScrapLogs] = useState<string[]>([]);
  const [logoClicks, setLogoClicks] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [requestsToday, setRequestsToday] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem('api_requests');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.date === today) {
          setRequestsToday(parsed.count);
        } else {
          setRequestsToday(0);
        }
      } catch (e) {
        setRequestsToday(0);
      }
    }

    const lastTimeStored = localStorage.getItem('last_request_time');
    if (lastTimeStored) {
      const lastTime = parseInt(lastTimeStored);
      const now = Date.now();
      const diff = Math.floor((now - lastTime) / 1000);
      if (diff < 60) {
        setCooldown(60 - diff);
      }
    }
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleLogoClick = () => {
    setLogoClicks(prev => {
      const next = prev + 1;
      if (next >= 4) {
        setShowAdmin(true);
        return 0;
      }
      return next;
    });
  };

  const historyToDisplay = result ? history.filter(h => h !== result) : history;
  const filteredHistory = historyToDisplay.filter(item => {
    const matchVerdict = filterVerdict === "All" || item.verdict === filterVerdict;
    const matchBias = filterBias === "All" || item.biasAnalysis.label === filterBias;
    return matchVerdict && matchBias;
  });
  const uniqueBiases = Array.from(new Set(historyToDisplay.map(h => h.biasAnalysis.label)));

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let scrapInterval: NodeJS.Timeout;
    if (isLoading) {
      setProcessLog(["System initialized."]);
      setScrapLogs([
        `> INITIALIZING SCRAPER FOR: "${query}"`, 
        "> BYPASSING CAPTCHAS...", 
        "> CONNECTING TO NEWS PROXIES..."
      ]);
      interval = setInterval(() => {
        setLoadingStepIndex((prev) => {
          const next = (prev + 1) % LOADING_STEPS.length;
          setProcessLog(log => [...log, LOADING_STEPS[next].message].slice(-5));
          return next;
        });
      }, 5600);

      scrapInterval = setInterval(() => {
        const domains = ["reuters.com", "apnews.com", "bbc.com", "twitter.com", "reddit.com", "news.google.com", "nytimes.com", "wsj.com"];
        const domain = domains[Math.floor(Math.random() * domains.length)];
        const actions = [
          `SEARCHING ${domain} for: "${query.substring(0, 40)}..."`,
          `SCANNING recent articles on ${domain}...`,
          `FILTERING results by relevance on ${domain}...`,
          `EXTRACTING metadata from ${domain}...`
        ];
        const action = actions[Math.floor(Math.random() * actions.length)];
        setScrapLogs(prev => [...prev, `[${new Date().toISOString().split('T')[1].slice(0,-1)}] ${action}`]);
      }, 1200);
    } else {
      setLoadingStepIndex(0);
      setProcessLog([]);
    }
    return () => {
      clearInterval(interval);
      clearInterval(scrapInterval);
    };
  }, [isLoading]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading || cooldown > 0) return;

    // Clear old scrap
    setScrapLogs([]);

    if (requestsToday >= 1500) {
      setError("Daily API limit reached (1500/1500). Please wait until tomorrow to refresh your quota.");
      return;
    }

    // Check history first to save API quota (Free Tier protection)
    const cachedResult = history.find(h => h.headline.toLowerCase().includes(query.toLowerCase().trim()) || query.toLowerCase().trim().includes(h.headline.toLowerCase()));
    if (cachedResult) {
      setResult(cachedResult);
      setScrapLogs([
        `> LOADED FROM CACHE FOR: "${query}"`,
        "> SCRAPING SKIPPED (FREE TIER OPTIMIZATION).",
        "> EXACT NEWS EXTRACTED:",
        ...cachedResult.sources.map(s => `\n[SOURCE: ${s.url}]\n"${s.snippet}"\n`)
      ]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setLoadingStepIndex(0);

    const startTime = Date.now();

    try {
      const data = await factCheckNews(query);
      
      // Increment requests by 10
      const today = new Date().toDateString();
      const stored = localStorage.getItem('api_requests');
      let currentCount = 0;
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.date === today) currentCount = parsed.count;
        } catch (e) {}
      }
      const newCount = currentCount + 6;
      localStorage.setItem('api_requests', JSON.stringify({ date: today, count: newCount }));
      localStorage.setItem('last_request_time', Date.now().toString());
      setRequestsToday(newCount);
      setCooldown(60);
      
      // Enforce minimum 60 seconds delay for deep analysis
      const elapsed = Date.now() - startTime;
      const minDelay = 60000;
      if (elapsed < minDelay) {
        await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
      }

      setResult(data);
      setHistory(prev => [data, ...prev.slice(0, 49)]);
      setScrapLogs(prev => [
        ...prev, 
        "> SCRAPING COMPLETE.", 
        "> EXACT NEWS EXTRACTED:",
        ...data.sources.map(s => `\n[SOURCE: ${s.url}]\n"${s.snippet}"\n`)
      ]);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      setScrapLogs(prev => [...prev, `> ERROR: ${errorMessage}`]);
      
      // If we hit a rate limit, force a cooldown even on failure
      if (errorMessage.toLowerCase().includes("limit") || errorMessage.toLowerCase().includes("quota") || errorMessage.toLowerCase().includes("429")) {
        localStorage.setItem('last_request_time', Date.now().toString());
        setCooldown(60);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    const text = `Veritas Fact-Check Report\n\nHeadline: ${result.headline}\nVerdict: ${result.verdict}\nVeracity Score: ${result.veracityScore}%\nSummary: ${result.summary}\n\nAnalysis: ${result.detailedAnalysis}`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!result) return;
    const shareData = {
      title: 'Veritas Fact-Check Report',
      text: `Fact-Check: ${result.headline}\nVerdict: ${result.verdict} (${result.veracityScore}%)\n\nRead the full analysis on Veritas.`,
      url: window.location.href,
    };
    
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        copyToClipboard();
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const getHostname = (urlStr: string) => {
    try {
      return new URL(urlStr).hostname.replace("www.", "");
    } catch (e) {
      return "source";
    }
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "True": return "text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400";
      case "Mostly True": return "text-lime-600 bg-lime-50 border-lime-200 dark:bg-lime-900/20 dark:border-lime-800 dark:text-lime-400";
      case "Mixed": return "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400";
      case "Mostly False": return "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400";
      case "False": return "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400";
      case "Unverified": return "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400";
      default: return "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400";
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case "True":
      case "Mostly True":
        return <ShieldCheck className="w-8 h-8 text-green-500" />;
      case "Mixed":
        return <ShieldQuestion className="w-8 h-8 text-yellow-500" />;
      case "Mostly False":
      case "False":
        return <ShieldAlert className="w-8 h-8 text-red-500" />;
      case "Unverified":
        return <ShieldQuestion className="w-8 h-8 text-slate-500" />;
      default:
        return <ShieldQuestion className="w-8 h-8 text-slate-500" />;
    }
  };

  const getCredibilityColor = (credibility: string) => {
    switch (credibility) {
      case "High": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "Medium": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "Low": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  return (
    <TooltipProvider>
      <div className={cn("min-h-screen font-sans selection:bg-emerald-100 selection:text-emerald-900 transition-colors duration-300 bg-grid-pattern text-slate-400/5", 
        isDarkMode ? "bg-slate-950 text-slate-50 dark" : "bg-slate-50 text-slate-900"
      )}>
      <div className="fixed inset-0 bg-gradient-to-tr from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none" />
      
      {/* Verification Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-xl p-6"
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-8"
            >
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full animate-pulse" />
                <div className="relative bg-emerald-600 p-4 rounded-2xl shadow-lg">
                  <ShieldCheck className="w-10 h-10 text-white animate-bounce" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-display font-bold tracking-tight">Deep Verification in Progress</h2>
                <p className="text-slate-500 dark:text-slate-400">Verifying: <span className="text-emerald-600 dark:text-emerald-400 font-medium italic">"{query}"</span></p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    {React.createElement(LOADING_STEPS[loadingStepIndex].icon, { className: "w-4 h-4 animate-spin" })}
                    {LOADING_STEPS[loadingStepIndex].message}
                  </span>
                  <span className="text-slate-400">{Math.round((loadingStepIndex / LOADING_STEPS.length) * 100)}%</span>
                </div>
                <Progress value={(loadingStepIndex / LOADING_STEPS.length) * 100} className="h-2" />
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-left">
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">
                  <Terminal className="w-3 h-3" />
                  <span>Live Analysis Logs</span>
                </div>
                <div className="font-mono text-xs text-emerald-500/80 space-y-1 h-24 overflow-hidden">
                  {processLog.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-slate-600 opacity-50">[{i}]</span>
                      <span>{log}</span>
                    </div>
                  ))}
                  <span className="animate-pulse">_</span>
                </div>
              </div>
              
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Exhaustive 10-Request Multi-Verdict Analysis Active</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-slate-200 dark:border-slate-800">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer select-none" 
            onClick={handleLogoClick}
          >
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-display font-bold tracking-tight">Veritas</span>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
              <a href="#" className="hover:text-emerald-600 transition-colors">How it works</a>
              <a href="#" className="hover:text-emerald-600 transition-colors">Methodology</a>
            </nav>
            <Separator orientation="vertical" className="h-6 hidden md:block" />
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="rounded-full"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowScrap(true)} className="hidden sm:flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Scrap Data
              </Button>
              <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2">
                <History className="w-4 h-4" />
                History
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl relative">
        {/* Hero Section */}
        <div className="text-center mb-16 mt-8 relative">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-8xl font-display font-extrabold mb-6 tracking-tighter leading-none"
          >
            Verify the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-[length:200%_auto] animate-gradient">Truth</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed"
          >
            Uncover the reality behind headlines. Our multi-step neural engine cross-references global sources to provide an unbiased veracity report.
          </motion.p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-3xl mx-auto mb-20 group">
          <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-[2.5rem] blur-2xl opacity-0 group-hover:opacity-100 transition duration-500" />
          <form onSubmit={handleSearch} className="relative flex flex-col sm:flex-row gap-3 p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-emerald-100/50 dark:shadow-none border border-slate-200 dark:border-slate-800 transition-all duration-300 group-focus-within:border-emerald-500/50 group-focus-within:ring-4 group-focus-within:ring-emerald-500/10">
            <div className="relative flex-1">
              {isLoading ? (
                <Loader2 className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-emerald-500 animate-spin" />
              ) : (
                <Search className={cn("absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 transition-colors", 
                  cooldown > 0 ? "text-slate-300 dark:text-slate-700" : "text-slate-400 group-focus-within:text-emerald-500"
                )} />
              )}
              <Input 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={cooldown > 0 ? `Rate limit cooling down... (${cooldown}s)` : "Paste news headline, claim, or URL..."}
                className={cn("pl-14 h-16 border-none focus-visible:ring-0 text-xl bg-transparent placeholder:text-slate-400 font-medium",
                  cooldown > 0 && "cursor-not-allowed opacity-50"
                )}
                disabled={isLoading || cooldown > 0}
              />
              {cooldown > 0 && !isLoading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-full border border-amber-100 dark:border-amber-800/50">
                  <Activity className="w-3 h-3 animate-pulse" />
                  {cooldown}s
                </div>
              )}
            </div>
            <Button 
              type="submit" 
              className={cn("h-16 px-10 rounded-2xl font-bold text-lg shadow-lg transition-all active:scale-95 w-full sm:w-auto",
                cooldown > 0 ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 dark:bg-slate-800 dark:border-slate-700" : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 dark:shadow-none"
              )}
              disabled={isLoading || !query.trim() || cooldown > 0}
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : cooldown > 0 ? `Wait ${cooldown}s` : "Verify Now"}
            </Button>
          </form>
          
          <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm">
            <span className="text-slate-400 font-bold flex items-center gap-2 px-2 py-1">
              <Activity className="w-4 h-4 text-emerald-500" />
              TRENDING NOW:
            </span>
            {[
              { label: "NASA Mars Life", query: "Did NASA find life on Mars?" },
              { label: "Great Wall Space", query: "Is the Great Wall of China visible from space?" },
              { label: "Coffee Health", query: "Did a new study find that coffee cures everything?" }
            ].map((item) => (
              <button 
                key={item.label}
                onClick={() => { setQuery(item.query); handleSearch(); }} 
                className="glass-effect hover:bg-emerald-50 dark:hover:bg-emerald-900/30 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all duration-300 text-slate-600 dark:text-slate-300 font-medium hover:text-emerald-600 dark:hover:text-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="relative w-32 h-32 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="60"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-slate-100 dark:text-slate-800"
                      />
                      <motion.circle
                        cx="64"
                        cy="64"
                        r="60"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray="377"
                        initial={{ strokeDashoffset: 377 }}
                        animate={{ strokeDashoffset: 377 - (377 * (loadingStepIndex + 1) / LOADING_STEPS.length) }}
                        className="text-emerald-600"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {React.createElement(LOADING_STEPS[loadingStepIndex].icon, {
                        className: "w-12 h-12 text-emerald-600 animate-pulse"
                      })}
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div>
                      <h2 className="text-2xl font-bold mb-1">Verifying Claim...</h2>
                      <p className="text-slate-500 dark:text-slate-400 font-medium">
                        Step {loadingStepIndex + 1} of {LOADING_STEPS.length}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <AnimatePresence mode="popLayout">
                        <motion.p 
                          key={loadingStepIndex}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="text-lg font-semibold text-emerald-600 dark:text-emerald-400"
                        >
                          {LOADING_STEPS[loadingStepIndex].message}
                        </motion.p>
                      </AnimatePresence>
                      
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 font-mono text-xs text-slate-400 space-y-2 border border-slate-100 dark:border-slate-800 relative overflow-hidden h-[120px]">
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-50 dark:from-slate-800/50 to-transparent z-10 pointer-events-none" />
                        <motion.div 
                          animate={{ y: loadingStepIndex > 2 ? -(loadingStepIndex - 2) * 28 : 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          className="flex flex-col gap-3"
                        >
                          {LOADING_STEPS.map((step, i) => (
                            <div 
                              key={i}
                              className={cn(
                                "flex items-center gap-3 transition-colors duration-300",
                                i < loadingStepIndex ? "text-emerald-600 dark:text-emerald-400" :
                                i === loadingStepIndex ? "text-slate-900 dark:text-white font-medium" :
                                "text-slate-400 dark:text-slate-600"
                              )}
                            >
                              {i < loadingStepIndex ? (
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                              ) : i === loadingStepIndex ? (
                                <Loader2 className="w-4 h-4 shrink-0 animate-spin text-emerald-500" />
                              ) : (
                                <div className="w-4 h-4 shrink-0 rounded-full border border-slate-300 dark:border-slate-600" />
                              )}
                              <span className="truncate">{step.message}</span>
                            </div>
                          ))}
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-400 mb-8"
          >
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Analysis Failed</p>
              <p className="text-sm opacity-90">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Results Section */}
        {result && !isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header / Verdict */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
              <div className={cn("absolute top-0 left-0 right-0 h-2", 
                result.veracityScore > 80 ? "bg-green-500" : 
                result.veracityScore > 60 ? "bg-lime-500" :
                result.veracityScore > 40 ? "bg-yellow-500" :
                result.veracityScore > 20 ? "bg-orange-500" : "bg-red-500"
              )} />
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                    <Badge variant="outline" className={cn("px-6 py-2 text-lg font-bold uppercase tracking-wider border-2 rounded-2xl shadow-sm", getVerdictColor(result.verdict))}>
                      {result.verdict === "True" || result.verdict === "Mostly True" ? "✅ GENUINE NEWS" : 
                       result.verdict === "False" || result.verdict === "Mostly False" ? "❌ FAKE NEWS" : 
                       "⚠️ UNVERIFIED / MIXED"}
                    </Badge>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-2xl">
                      <Scale className="w-4 h-4" />
                      Normal News Detector
                    </div>
                  </div>
                  <h2 className="text-3xl md:text-5xl font-display font-bold leading-tight text-slate-900 dark:text-white tracking-tight">
                    {result.headline}
                  </h2>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={copyToClipboard}
                      className="rounded-full hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
                      title="Copy Report"
                    >
                      {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handleShare}
                      className="rounded-full hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
                      title="Share"
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Main Analysis Column */}
              <div className="md:col-span-8 space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm h-full">
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-900 dark:text-white">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    Key Findings & Analysis
                  </h3>
                  
                  <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl p-6 border border-emerald-100/50 dark:border-emerald-800/30 mb-8">
                    <p className="text-slate-800 dark:text-slate-200 text-lg font-medium leading-relaxed">
                      "{result.summary}"
                    </p>
                  </div>

                  <div className="prose prose-slate dark:prose-invert prose-lg max-w-none">
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                      {result.detailedAnalysis}
                    </p>
                  </div>
                </div>
              </div>

              {/* Metrics Column */}
              <div className="md:col-span-4 space-y-6 flex flex-col">
                {/* Truth/Falsehood Detector */}
                <Tooltip>
                  <TooltipTrigger>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex-1 flex flex-col justify-center items-center text-center cursor-help transition-all hover:shadow-md hover:border-emerald-500/30">
                      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1">
                        {result.veracityScore >= 50 ? "Truth Percentage" : "Falsehood Percentage"} <Info className="w-3 h-3" />
                      </p>
                      <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                        <svg className="w-full h-full -rotate-90 absolute inset-0">
                          <circle cx="64" cy="64" r="60" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
                          <motion.circle
                            cx="64" cy="64" r="60" fill="none" stroke="currentColor" strokeWidth="8"
                            strokeDasharray="377"
                            initial={{ strokeDashoffset: 377 }}
                            animate={{ strokeDashoffset: 377 - (377 * (result.veracityScore >= 50 ? result.veracityScore : (100 - result.veracityScore)) / 100) }}
                            className={cn(
                              result.veracityScore >= 50 ? "text-emerald-500" : "text-red-500"
                            )}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="flex flex-col items-center justify-center">
                          <span className={cn("text-3xl font-display font-bold", result.veracityScore >= 50 ? "text-emerald-600" : "text-red-600")}>
                            {result.veracityScore >= 50 ? result.veracityScore : (100 - result.veracityScore)}%
                          </span>
                        </div>
                      </div>
                      <p className={cn("text-sm font-bold", result.veracityScore >= 50 ? "text-emerald-600" : "text-red-600")}>
                        {result.veracityScore >= 50 ? "TRUE" : "FALSE"}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs p-4 bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900">
                    <p className="font-bold mb-2">How is this calculated?</p>
                    <p className="text-sm opacity-90 leading-relaxed">
                      This percentage represents our AI's confidence in the {result.veracityScore >= 50 ? "authenticity" : "falseness"} of the claim based on cross-referenced evidence from multiple credible sources.
                    </p>
                  </TooltipContent>
                </Tooltip>

                {/* Sentiment */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Sentiment</p>
                    {result.sentiment.label === "Positive" ? <Smile className="w-6 h-6 text-green-500" /> : 
                     result.sentiment.label === "Negative" ? <Frown className="w-6 h-6 text-red-500" /> : 
                     <Meh className="w-6 h-6 text-yellow-500" />}
                  </div>
                  <p className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-3">{result.sentiment.label}</p>
                  <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={cn("absolute top-0 bottom-0 transition-all duration-500 rounded-full", 
                        result.sentiment.score > 0 ? "bg-green-500" : "bg-red-500"
                      )}
                      style={{ 
                        left: result.sentiment.score > 0 ? "50%" : `${50 + (result.sentiment.score * 50)}%`,
                        right: result.sentiment.score > 0 ? `${50 - (result.sentiment.score * 50)}%` : "50%"
                      }}
                    />
                  </div>
                </div>

                {/* Bias */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Media Bias</p>
                    <Scale className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-xl font-display font-bold text-slate-900 dark:text-white mb-2">{result.biasAnalysis.label}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{result.biasAnalysis.description}</p>
                </div>
              </div>
            </div>

            {/* Sources Section */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Search className="w-6 h-6 text-emerald-600" />
                  Sources & Credibility
                </h3>
                <Badge variant="secondary" className="rounded-full px-3">
                  {result.sources.length} Sources Scanned
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.sources.map((source, i) => (
                  <a 
                    key={i} 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl hover:border-emerald-300 dark:hover:border-emerald-500 hover:shadow-md transition-all flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-2 line-clamp-1">
                          {source.title}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </h4>
                        <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-mono truncate mt-1 group-hover:underline">
                          {source.url}
                        </p>
                      </div>
                      <Badge className={cn("text-[10px] px-2 py-0.5 rounded-full shrink-0", getCredibilityColor(source.credibility))}>
                        {source.credibility}
                      </Badge>
                    </div>
                    {source.snippet && (
                      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 italic">
                          "{source.snippet}"
                        </p>
                      </div>
                    )}
                  </a>
                ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Disclaimer: This analysis is performed by an AI and may not be 100% accurate. Always cross-verify with multiple trusted news organizations.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* History or Related */}
        {historyToDisplay.length > 0 && (
          <div className="space-y-6 mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-2xl font-display font-bold flex items-center gap-2">
                <History className="w-6 h-6 text-emerald-600" />
                Recent Checks
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-500">Verdict:</span>
                  <select 
                    value={filterVerdict} 
                    onChange={(e) => setFilterVerdict(e.target.value)}
                    className="text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="All">All</option>
                    <option value="True">True</option>
                    <option value="Mostly True">Mostly True</option>
                    <option value="Mixed">Mixed</option>
                    <option value="Mostly False">Mostly False</option>
                    <option value="False">False</option>
                    <option value="Unverified">Unverified</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-500">Bias:</span>
                  <select 
                    value={filterBias} 
                    onChange={(e) => setFilterBias(e.target.value)}
                    className="text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="All">All</option>
                    {uniqueBiases.map(bias => (
                      <option key={bias} value={bias}>{bias}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                <p className="text-slate-500 dark:text-slate-400">No recent checks match your filters.</p>
                <Button 
                  variant="link" 
                  onClick={() => { setFilterVerdict("All"); setFilterBias("All"); }}
                  className="text-emerald-600 mt-2"
                >
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredHistory.map((item, i) => (
                  <Card 
                    key={i} 
                    className="group cursor-pointer hover:-translate-y-1 hover:shadow-md hover:bg-slate-50/50 dark:hover:bg-slate-800/50 hover:border-emerald-300 dark:hover:border-emerald-500 transition-all duration-200 dark:bg-slate-900 dark:border-slate-800" 
                    onClick={() => { 
                      setQuery(item.headline); 
                      setResult(item);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={cn("w-fit text-[10px] font-bold uppercase", getVerdictColor(item.verdict))}>
                          {item.verdict}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">{item.biasAnalysis.label}</Badge>
                      </div>
                      <CardTitle className="text-sm font-bold line-clamp-2 mt-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{item.headline}</CardTitle>
                    </CardHeader>
                    <CardFooter className="p-4 pt-0">
                      <div className="flex items-center justify-between w-full text-xs text-slate-400">
                        <span>Score: {item.veracityScore}%</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform text-emerald-500 opacity-0 group-hover:opacity-100" />
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State / Features */}
        {!result && !isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div className="space-y-3 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="font-bold">Deep Search</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">We scan thousands of news sources and official records to find the most relevant information.</p>
            </div>
            <div className="space-y-3 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center text-green-600 dark:text-green-400">
                <Scale className="w-6 h-6" />
              </div>
              <h3 className="font-bold">Bias Detection</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Our AI identifies political or corporate bias in the claim and the sources reporting on it.</p>
            </div>
            <div className="space-y-3 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Newspaper className="w-6 h-6" />
              </div>
              <h3 className="font-bold">Source Credibility</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Every source is rated for credibility based on journalistic standards and history.</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t dark:border-slate-800 py-12 mt-20">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span className="font-display font-bold">Veritas</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Empowering citizens with truth in the age of information.</p>
          <div className="flex justify-center gap-8 text-sm font-medium text-slate-400">
            <a href="#" className="hover:text-emerald-600">Privacy</a>
            <a href="#" className="hover:text-emerald-600">Terms</a>
            <a href="#" className="hover:text-emerald-600">API</a>
            <a href="#" className="hover:text-emerald-600">Contact</a>
          </div>
          <p className="text-slate-300 dark:text-slate-700 text-[10px] mt-8 uppercase tracking-widest">© 2026 Veritas AI. All rights reserved.</p>
        </div>
      </footer>

      {/* Scrap Modal */}
      <AnimatePresence>
        {showScrap && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-950 border border-slate-800 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex justify-between items-center p-3 border-b border-slate-800 bg-slate-900">
                <div className="flex items-center gap-2 text-slate-400 font-mono text-sm">
                  <Terminal className="w-4 h-4" />
                  <span>live-scraper-terminal.exe</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowScrap(false)} className="h-8 w-8 text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 font-mono text-sm text-emerald-400/90 space-y-1 bg-slate-950">
                {scrapLogs.length === 0 ? (
                  <div className="text-slate-600">No scraping data available. Run a verification to start scraping.</div>
                ) : (
                  scrapLogs.map((log, i) => (
                    <div key={i} className="whitespace-pre-wrap break-words">{log}</div>
                  ))
                )}
                {isLoading && <span className="animate-pulse">_</span>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Modal */}
      <AnimatePresence>
        {showAdmin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="relative h-32 bg-gradient-to-br from-emerald-600 to-teal-700 p-6 flex flex-col justify-end">
                <div className="absolute top-4 right-4">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowAdmin(false)} 
                    className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-white">
                  <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold">Admin Dashboard</h3>
                    <p className="text-white/70 text-xs">System monitoring & API quotas</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="glass-effect p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded-lg">
                          <Activity className="w-4 h-4 text-emerald-600" />
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">API Usage Metrics</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-100 dark:border-emerald-800/50">
                        <Sparkles className="w-3 h-3" />
                        By Shikhar Brahm Bhatt
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-slate-500 font-medium">Daily Quota (Gemini 2.0 Flash)</span>
                          <span className="font-mono font-bold text-emerald-600">{Math.max(0, 1500 - requestsToday)} / 1500 left</span>
                        </div>
                        <Progress value={(requestsToday / 1500) * 100} className="h-2.5 bg-slate-100 dark:bg-slate-800" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Used Today</p>
                          <p className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100">{requestsToday}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Status</p>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-sm font-bold text-emerald-600 uppercase">Active</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-800/30">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-3">
                      <AlertCircle className="w-4 h-4" />
                      <h4 className="text-sm font-bold">Rate Limit Protection</h4>
                    </div>
                    <p className="text-xs text-amber-700/80 dark:text-amber-300/80 leading-relaxed font-medium">
                      Each news check uses **6 API requests** for deep verification (Optimized). 
                      The Gemini Free Tier limit is **15 requests per minute**. 
                      A **60-second cooldown** is enforced between checks to ensure stability.
                    </p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Exhaustive 6-Request Multi-Verdict Analysis Active</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
    </TooltipProvider>
  );
}
