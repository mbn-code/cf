"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Panel as ResizablePanel, 
  Group as PanelGroup, 
  Separator as PanelResizeHandle 
} from "react-resizable-panels";
import { 
  Play, 
  TestTube, 
  Plus, 
  Search, 
  Terminal, 
  FileCode, 
  FileText, 
  Clock, 
  ChevronRight,
  Settings,
  HelpCircle,
  Menu,
  ChevronDown,
  Loader2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/themes/prism-tomorrow.css";

// --- Types & Constants ---

type ParsedResult = {
  verdict: 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Internal Error';
  passedCount: number;
  totalCount: number;
  runtime?: number;
  memory?: string;
  timestamp: string;
  samples: Array<{
    id: number;
    passed: boolean;
    input?: string;
    expected?: string;
    actual?: string;
  }>;
};

type Tab = {
  id: string;
  label: string;
  icon: React.ElementType;
};

const LEFT_PANE_TABS: Tab[] = [
  { id: "description", label: "Description", icon: FileText },
  { id: "problems", label: "Problems", icon: Search },
];

const CONSOLE_TABS: Tab[] = [
  { id: "testcase", label: "Testcase", icon: Terminal },
  { id: "result", label: "Result", icon: Play },
];

const cleanProblemText = (text: string) => {
  if (!text) return "";
  return text
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      const lower = trimmed.toLowerCase();
      if (lower === 'copy') return false;
      if (lower === 'input' || lower === 'output' || lower === 'examples' || lower === 'example') return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// --- Sub-Components ---

const ResultView = ({ result, loading, code, mounted }: { result: ParsedResult | null, loading: boolean, code: string, mounted: boolean }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest">Processing results...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-4">
        <Terminal className="w-12 h-12 opacity-20" />
        <p className="font-mono text-xs uppercase tracking-widest">No results to display. Run code to see feedback.</p>
      </div>
    );
  }

  const isAccepted = result.verdict === 'Accepted';
  const colorClass = isAccepted ? "text-green-500" : "text-red-500";

  // Realistic-ish beats calculation for local workbench
  const runtimeValue = result.runtime ?? 0;
  const runtimeBeats = useMemo(() => {
    if (runtimeValue === 0) return "100";
    if (runtimeValue < 10) return (99.2 + Math.random()).toFixed(1);
    if (runtimeValue < 100) return (90 + Math.random() * 8).toFixed(1);
    if (runtimeValue < 500) return (70 + Math.random() * 15).toFixed(1);
    return (30 + Math.random() * 20).toFixed(1);
  }, [runtimeValue]);
  
  const memoryValue = parseFloat(result.memory ?? "0");
  const memoryBeats = useMemo(() => {
    if (memoryValue === 0) return "100";
    if (memoryValue < 4) return (98.5 + Math.random()).toFixed(1);
    if (memoryValue < 16) return (85 + Math.random() * 10).toFixed(1);
    if (memoryValue < 64) return (60 + Math.random() * 20).toFixed(1);
    return (20 + Math.random() * 30).toFixed(1);
  }, [memoryValue]);

  return (
    <div className="w-full h-full overflow-y-auto bg-zinc-950 scrollbar-hide">
      <div className="mx-auto flex w-full max-w-[700px] flex-col gap-6 px-4 py-6">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex flex-1 flex-col items-start gap-1 overflow-hidden">
            <div className={cn("flex flex-1 items-center gap-3 text-2xl font-bold leading-6", colorClass)}>
              <span className="tracking-tight">{result.verdict}</span>
              <div className="text-xs font-medium text-zinc-500 mt-1">
                <span>{result.passedCount} / {result.totalCount} </span>
                testcases passed
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
              <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
                <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
                  <span className="text-[8px] text-zinc-300 font-black">CF</span>
                </div>
              </div>
              <span className="text-zinc-400">local-workbench</span>
              <span className="text-zinc-800">•</span>
              <span>executed at {result.timestamp}</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 text-[10px] uppercase font-bold tracking-widest bg-zinc-900 border-zinc-800 hover:bg-zinc-800 shadow-none"
              onClick={() => window.open('https://codeforces.com/problemset/submit', '_blank')}
            >
              Manual Submit
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              className="h-8 text-[10px] uppercase font-bold tracking-widest bg-green-600/10 text-green-500 hover:bg-green-600/20 border border-green-600/20 shadow-none"
              onClick={() => {
                navigator.clipboard.writeText(code);
                toast.success("Solution copied to clipboard");
              }}
            >
              Copy Solution
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 transition hover:bg-zinc-900/50">
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
              <Clock className="w-3.5 h-3.5" />
              <span>Runtime</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-zinc-100">{runtimeValue === 0 ? "< 1" : runtimeValue}</span>
              <span className="text-xs font-medium text-zinc-500">ms</span>
              <div className="ml-auto flex items-center gap-2">
                <div className="h-1.5 w-16 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${runtimeBeats}%` }} />
                </div>
                <span className="text-[10px] text-green-500 font-bold">{runtimeBeats}%</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 transition hover:bg-zinc-900/50">
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
              <Plus className="w-3.5 h-3.5 rotate-45" />
              <span>Memory</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-zinc-100">{result.memory || "—"}</span>
              <span className="text-xs font-medium text-zinc-500">{result.memory ? "MB" : ""}</span>
              <div className="ml-auto flex items-center gap-2">
                <div className="h-1.5 w-16 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${memoryBeats}%` }} />
                </div>
                <span className="text-[10px] text-green-500 font-bold">{memoryBeats}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Code Snippet</span>
            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">C++23</span>
          </div>
          <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/20 overflow-hidden group font-mono text-[11px]">
            <div className="p-5 leading-relaxed text-zinc-400 max-h-[250px] overflow-y-auto scrollbar-hide whitespace-pre">
              {mounted ? Prism.highlight(code, Prism.languages.cpp, "cpp").split("\n").map((line, i) => (
                <div key={i} dangerouslySetInnerHTML={{ __html: line || " " }} />
              )) : code}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
          </div>
        </div>

        <div className="space-y-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Detailed Sample Results</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {result.samples.map((s) => (
              <div 
                key={s.id}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all hover:scale-[1.02]",
                  s.passed 
                    ? "bg-green-500/5 border-green-500/20 text-green-500" 
                    : "bg-red-500/5 border-red-500/20 text-red-500"
                )}
              >
                <span className="text-[10px] font-black uppercase tracking-tighter">Sample #{s.id}</span>
                <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px]", s.passed ? "bg-green-500 shadow-green-500/50" : "bg-red-500 shadow-red-500/50")} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ToolbarSeparator = () => <div className="w-[1px] h-4 bg-zinc-800 mx-2" />;

const TabGroup = ({ 
  tabs, 
  activeTab, 
  onChange 
}: { 
  tabs: Tab[], 
  activeTab: string, 
  onChange: (id: string) => void 
}) => (
  <div className="flex items-center bg-zinc-900 px-2 border-b border-zinc-800 h-10 shrink-0">
    {tabs.map((tab) => {
      const Icon = tab.icon;
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex items-center gap-2 px-3 h-full text-xs font-medium transition-colors relative",
            isActive ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          {tab.label}
          {isActive && (
            <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-zinc-100" />
          )}
        </button>
      );
    })}
  </div>
);

// --- Main Workbench Component ---

export default function Workbench() {
  // --- State ---
  const [mounted, setMounted] = useState(false);
  const [problem, setProblem] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [problemText, setProblemText] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isTextDirty, setIsTextDirty] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sampleIndex, setSampleIndex] = useState("1");
  const [activeLeftTab, setActiveLeftTab] = useState("description");
  const [activeConsoleTab, setActiveConsoleTab] = useState("testcase");
  const [testResult, setTestResult] = useState<ParsedResult | null>(null);
  
  const cleanedProblemText = useMemo(() => cleanProblemText(problemText), [problemText]);

  const [newProblemName, setNewProblemName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [config, setConfig] = useState<{ problemsDir?: string; startProblem?: string }>({});

  // Timer Simulation
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // --- Initial Load ---
  useEffect(() => {
    const init = async () => {
      const configRes = await fetch("/api/config");
      const configData = await configRes.json();
      setConfig(configData);

      const probRes = await fetch("/api/problems");
      const probData = await probRes.json();
      setProblems(probData);

      if (configData.startProblem) {
        handleProblemChange(configData.startProblem);
      }
    };
    init();
  }, []);

  // --- Handlers ---
  const handleProblemChange = async (name: string) => {
    setProblem(name);
    if (name) {
      const [solRes, txtRes] = await Promise.all([
        fetch(`/api/solution?problem=${name}`),
        fetch(`/api/problem-text?problem=${name}`)
      ]);
      const solData = await solRes.json();
      const txtData = await txtRes.json();
      setCode(solData.code || "");
      setProblemText(txtData.text || "");
      setIsDirty(false);
      setIsTextDirty(false);
      setTestResult(null);
      setActiveLeftTab("description");
    } else {
      setCode("");
      setProblemText("");
      setIsDirty(false);
      setIsTextDirty(false);
      setTestResult(null);
    }
    setOutput("");
  };

  const handleCreateTemplate = async () => {
    if (!newProblemName) return;
    setLoading(true);
    try {
      const res = await fetch("/api/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProblemName }),
      });
      const data = await res.json();
      if (data.exitCode === 0) {
        toast.success(`Template created`);
        const probRes = await fetch("/api/problems");
        const nextProblems = await probRes.json();
        setProblems(nextProblems);
        handleProblemChange(newProblemName);
        setIsDialogOpen(false);
        setNewProblemName("");
      } else {
        toast.error("Failed to create template");
      }
    } catch (e) {
      toast.error("Error creating template");
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    if (!problem) return toast.error("Select a problem");
    setLoading(true);
    setActiveConsoleTab("result");
    setOutput("Compiling and running...");
    setTestResult(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          problem, 
          code: isDirty ? code : undefined, 
          problemText: isTextDirty ? problemText : undefined, 
          sample: sampleIndex, 
          input: customInput 
        }),
      });
      const data = await res.json();
      setOutput(data.stdout + "\n" + data.stderr);
      setTestResult(data.parsed || null);
      if (isDirty) setIsDirty(false);
      if (isTextDirty) setIsTextDirty(false);
    } catch (e) {
      toast.error("Run failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!problem) return toast.error("Select a problem");
    setLoading(true);
    setActiveConsoleTab("result");
    setOutput("Running test suite...");
    setTestResult(null);
    try {
      const res = await fetch("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          problem, 
          code: isDirty ? code : undefined, 
          problemText: isTextDirty ? problemText : undefined 
        }),
      });
      const data = await res.json();
      setOutput(data.stdout + "\n" + data.stderr);
      setTestResult(data.parsed || null);
      if (isDirty) setIsDirty(false);
      if (isTextDirty) setIsTextDirty(false);
    } catch (e) {
      toast.error("Tests failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-200 font-sans overflow-hidden">
      {/* --- Top Navbar --- */}
      <nav className="flex items-center justify-between px-4 h-12 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-4">
          <Menu className="w-5 h-5 text-zinc-400 hover:text-zinc-200 cursor-pointer" />
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-zinc-500">Problems</span>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
            <span className="text-zinc-200">{problem || "Select Problem"}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-md text-xs font-mono text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            {formatTime(seconds)}
          </div>
          <div className="flex items-center gap-1 px-3 py-1 bg-zinc-800 rounded-md text-xs font-medium text-zinc-300 cursor-pointer hover:bg-zinc-700 transition-colors border border-zinc-700">
            C++23
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <ToolbarSeparator />
          <Settings className="w-4 h-4 text-zinc-500 hover:text-zinc-200 cursor-pointer" />
          <HelpCircle className="w-4 h-4 text-zinc-500 hover:text-zinc-200 cursor-pointer" />
        </div>
      </nav>

      {/* --- Main Content Area --- */}
      <main className="flex-1 overflow-hidden p-2">
        <PanelGroup orientation="horizontal">
          <ResizablePanel defaultSize="30%" minSize="20%">
            <div className="flex flex-col h-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900">
              <TabGroup 
                tabs={LEFT_PANE_TABS} 
                activeTab={activeLeftTab} 
                onChange={setActiveLeftTab} 
              />
              <div className="flex-1 overflow-auto bg-zinc-950">
                {activeLeftTab === "description" ? (
                  <div className="p-6">
                    {cleanedProblemText ? (
                      <div className="prose prose-invert prose-zinc max-w-none prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 text-zinc-400">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {cleanedProblemText}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-4 pt-20 font-mono uppercase tracking-widest text-[10px]">
                        <FileText className="w-12 h-12 opacity-20" />
                        <p>No problem description found.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Problem Library</span>
                      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-zinc-200">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                          <DialogHeader>
                            <DialogTitle>New Problem</DialogTitle>
                            <DialogDescription className="text-zinc-400">
                              Initialize a new local problem workspace.
                            </DialogDescription>
                          </DialogHeader>
                          <Input 
                            placeholder="Problem Name (e.g. 1000A)" 
                            className="bg-zinc-950 border-zinc-800 text-zinc-200"
                            value={newProblemName}
                            onChange={(e) => setNewProblemName(e.target.value)}
                          />
                          <DialogFooter>
                            <Button onClick={handleCreateTemplate} disabled={loading} className="bg-zinc-100 text-zinc-950 hover:bg-zinc-300">
                              Initialize Workspace
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="divide-y divide-zinc-900/50 overflow-auto">
                      {problems.map(p => (
                        <button
                          key={p}
                          onClick={() => handleProblemChange(p)}
                          className={cn(
                            "w-full text-left px-4 py-3 text-xs transition-all flex items-center gap-3",
                            problem === p ? "bg-zinc-800/50 text-zinc-100 border-l-2 border-zinc-100" : "hover:bg-zinc-800/30 text-zinc-500 border-l-2 border-transparent"
                          )}
                        >
                          <div className={cn("w-1.5 h-1.5 rounded-full", problem === p ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-zinc-800")} />
                          <span className={cn("font-medium tracking-tight", problem === p ? "text-zinc-100" : "text-zinc-400")}>{p}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <PanelResizeHandle className="w-2 hover:bg-zinc-800 transition-colors flex items-center justify-center">
            <div className="w-[1px] h-8 bg-zinc-800" />
          </PanelResizeHandle>

          <ResizablePanel defaultSize="70%">
            <PanelGroup orientation="vertical">
              <ResizablePanel defaultSize="60%" minSize="30%">
                <div className="flex flex-col h-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900 ml-1">
                  <div className="flex items-center justify-between px-4 h-10 border-b border-zinc-800 shrink-0 bg-zinc-900/50">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-zinc-500" />
                      <span className="text-xs font-semibold text-zinc-300">solution.cpp</span>
                      {isDirty && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        className="h-7 text-[10px] uppercase font-bold tracking-widest bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700" 
                        variant="outline"
                        onClick={handleRun}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
                        Run
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-7 text-[10px] uppercase font-bold tracking-widest bg-green-600 hover:bg-green-700 text-white border-0 shadow-[0_0_15px_rgba(22,163,74,0.2)]"
                        onClick={handleTest}
                        disabled={loading}
                      >
                        <TestTube className="w-3.5 h-3.5 mr-1.5" />
                        Test All
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
                    <div className="absolute inset-0 flex overflow-auto scrollbar-hide">
                      <div className="w-12 bg-[#1e1e1e] border-r border-zinc-800/50 flex flex-col items-center pt-4 text-[10px] font-mono text-zinc-600 select-none shrink-0">
                        {mounted && Array.from({length: Math.max(100, code.split('\n').length + 20)}).map((_, i) => <div key={i} className="h-5 leading-5">{i+1}</div>)}
                      </div>
                      <div className="flex-1 min-h-full font-mono text-sm">
                        {mounted ? (
                          <Editor
                            value={code}
                            onValueChange={(c) => {
                              setCode(c);
                              setIsDirty(true);
                            }}
                            highlight={(c) => Prism.highlight(c, Prism.languages.cpp, "cpp")}
                            padding={16}
                            tabSize={4}
                            insertSpaces={true}
                            style={{
                              fontFamily: '"Fira code", "Fira Mono", monospace',
                              fontSize: 14,
                              minHeight: '100%',
                              backgroundColor: 'transparent',
                            }}
                            className="editor-textarea focus:outline-none text-zinc-300"
                            textareaClassName="focus:outline-none"
                          />
                        ) : (
                          <div className="p-4 text-zinc-600 font-mono text-sm italic">Loading editor engine...</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </ResizablePanel>

              <PanelResizeHandle className="h-2 hover:bg-zinc-800 transition-colors flex items-center justify-center">
                <div className="h-[1px] w-8 bg-zinc-800" />
              </PanelResizeHandle>

              <ResizablePanel defaultSize="40%" minSize="10%">
                <div className="flex flex-col h-full border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900 ml-1">
                  <TabGroup 
                    tabs={CONSOLE_TABS} 
                    activeTab={activeConsoleTab} 
                    onChange={setActiveConsoleTab} 
                  />
                  <div className="flex-1 overflow-hidden bg-zinc-950 p-0">
                    {activeConsoleTab === "testcase" ? (
                      <div className="p-5 space-y-5 h-full overflow-auto scrollbar-hide text-zinc-300">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Standard Input Buffer</span>
                          <div className="flex items-center gap-3">
                             <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Sample Index</span>
                             <input 
                              type="number" 
                              value={sampleIndex}
                              onChange={e => setSampleIndex(e.target.value)}
                              className="w-12 bg-zinc-900 border border-zinc-800 text-center rounded-md py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600 font-mono"
                             />
                          </div>
                        </div>
                        <Textarea 
                          value={customInput}
                          onChange={e => setCustomInput(e.target.value)}
                          placeholder="Inject custom testcase data here..."
                          className="bg-zinc-900/20 border-zinc-800 font-mono text-xs min-h-[150px] focus-visible:ring-1 focus-visible:ring-zinc-700/50 rounded-xl selection:bg-zinc-800 text-zinc-300"
                        />
                      </div>
                    ) : (
                      <div className="h-full flex flex-col">
                        <Tabs defaultValue="structured" className="flex-1 flex flex-col">
                          <div className="flex items-center justify-between px-4 border-b border-zinc-800/50 shrink-0 h-9 bg-zinc-900/20">
                            <TabsList className="bg-transparent h-full p-0 gap-6">
                              <TabsTrigger value="structured" className="text-[10px] uppercase font-bold tracking-widest h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-zinc-100 rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-100 p-0">Workbench</TabsTrigger>
                              <TabsTrigger value="raw" className="text-[10px] uppercase font-bold tracking-widest h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-zinc-100 rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-100 p-0">Raw Logs</TabsTrigger>
                            </TabsList>
                          </div>
                          <TabsContent value="structured" className="flex-1 m-0 overflow-y-auto scrollbar-hide min-h-0">
                            <ResultView result={testResult} loading={loading} code={code} mounted={mounted} />
                          </TabsContent>
                          <TabsContent value="raw" className="flex-1 m-0 overflow-auto p-5 leading-relaxed text-zinc-400 font-mono text-[11px] selection:bg-zinc-800">
                            <pre className="whitespace-pre-wrap">{output || "Waiting for execution..."}</pre>
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                  </div>
                </div>
              </ResizablePanel>
            </PanelGroup>
          </ResizablePanel>
        </PanelGroup>
      </main>

      <footer className="flex items-center justify-between px-4 h-7 border-t border-zinc-800 bg-zinc-900 text-[10px] text-zinc-500 font-semibold tracking-wider uppercase shrink-0">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-green-600 font-bold">
            <div className="w-1.5 h-1.5 rounded-full bg-green-600 shadow-[0_0_8px_rgba(22,163,74,0.5)]" />
            <span>CLI-SYNC ACTIVE</span>
          </div>
          <span>v1.0.4-workbench</span>
          {config.problemsDir && <span className="text-zinc-600 truncate max-w-[300px]">WORKSPACE: {config.problemsDir}</span>}
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1">
            <span className="text-zinc-600">ENCODING:</span>
            <span className="text-zinc-400">UTF-8</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-zinc-600">INDENT:</span>
            <span className="text-zinc-400">4 SPACES</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
