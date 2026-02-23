"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  FileText,
  Calendar,
  ChevronRight,
  X,
  Copy,
  Download,
  Trash2,
  Sparkles,
  FileCheck,
  FileClock,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import ReactMarkdown from "react-markdown";
import { apiFetch } from "@/lib/api-client";
import { useErrorModal } from "@/components/error-modal";

interface BragDoc {
  id: string;
  title: string;
  content: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

type GenerationStatus = "idle" | "generating" | "done" | "error";

export default function BragDocsPage() {
  const { showError, showApiError } = useErrorModal();
  const [docs, setDocs] = useState<BragDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<BragDoc | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  const [generationStatus, setGenerationStatus] =
    useState<GenerationStatus>("idle");
  const [generationTitle, setGenerationTitle] = useState("");
  const generationAbortRef = useRef(false);

  const [title, setTitle] = useState(
    `Brag Doc - ${format(new Date(), "MMM yyyy")}`
  );
  const [periodStart, setPeriodStart] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [periodEnd, setPeriodEnd] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [mode, setMode] = useState<"detailed" | "summary">("detailed");

  const loadDocs = useCallback(async () => {
    try {
      const data = await apiFetch<BragDoc[]>("/api/brag-docs");
      setDocs(data ?? []);
    } catch (err) {
      showApiError(err, "Failed to load brag documents");
    } finally {
      setIsLoading(false);
    }
  }, [showApiError]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    if (!selectedDocId) {
      setSelectedDoc(null);
      return;
    }

    setSelectedLoading(true);
    apiFetch<BragDoc>(`/api/brag-docs/${selectedDocId}`)
      .then((data) => setSelectedDoc(data))
      .catch((err) => showApiError(err, "Failed to load document"))
      .finally(() => setSelectedLoading(false));
  }, [selectedDocId, showApiError]);

  const handleGenerate = async () => {
    if (!title || !periodStart || !periodEnd) {
      showError({
        title: "Validation Error",
        message: "Please fill in all fields: title, start date, and end date.",
        type: "generic",
      });
      return;
    }

    setIsGenerateOpen(false);
    setGenerationStatus("generating");
    setGenerationTitle(title);
    setSelectedDocId(null);
    setSelectedDoc(null);
    generationAbortRef.current = false;

    try {
      const data = await apiFetch<BragDoc>("/api/brag-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, periodStart, periodEnd, mode }),
      });

      if (generationAbortRef.current) return;

      setGenerationStatus("done");
      toast.success("Brag doc generated successfully!");
      setSelectedDocId(data.id);
      loadDocs();

      setTimeout(() => setGenerationStatus("idle"), 3000);
    } catch (err) {
      if (generationAbortRef.current) return;
      setGenerationStatus("error");
      showApiError(err, "Failed to generate brag document");
      setTimeout(() => setGenerationStatus("idle"), 4000);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/brag-docs/${id}`, { method: "DELETE" });
      toast.success("Document deleted");
      if (selectedDocId === id) setSelectedDocId(null);
      loadDocs();
    } catch (err) {
      showApiError(err, "Failed to delete document");
    }
  };

  const handleCopy = () => {
    if (selectedDoc) {
      navigator.clipboard.writeText(selectedDoc.content);
      toast.success("Copied to clipboard!");
    }
  };

  const handleDownloadMd = () => {
    if (selectedDoc) {
      const blob = new Blob([selectedDoc.content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedDoc.title.replace(/\s+/g, "-").toLowerCase()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadPdf = () => {
    if (!selectedDoc || !docRef.current) return;

    const html = docRef.current.innerHTML;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      toast.error("Failed to prepare PDF export.");
      return;
    }

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${selectedDoc.title}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a2e; background: #fff; line-height: 1.7; font-size: 11pt; }
  h1 { font-size: 22pt; font-weight: 700; color: #1a1a2e; margin-top: 0.6em; margin-bottom: 0.4em; padding-bottom: 0.25em; border-bottom: 2.5px solid #6366f1; }
  h2 { font-size: 16pt; font-weight: 600; color: #2d2d44; margin-top: 1em; margin-bottom: 0.3em; padding-bottom: 0.15em; border-bottom: 1.5px solid #e0e7ff; }
  h3 { font-size: 13pt; font-weight: 600; color: #3d3d5c; margin-top: 0.8em; margin-bottom: 0.25em; }
  p { margin-bottom: 0.6em; color: #374151; }
  ul, ol { margin-left: 1.5em; margin-bottom: 0.6em; }
  li { margin-bottom: 0.25em; color: #374151; }
  li::marker { color: #6366f1; }
  strong { font-weight: 600; color: #1a1a2e; }
  em { font-style: italic; color: #4b5563; }
  blockquote { border-left: 3px solid #6366f1; background: #f0f0ff; padding: 0.5em 1em; margin: 0.6em 0; border-radius: 0 6px 6px 0; }
  blockquote p { color: #3d3d5c; margin: 0; }
  code { font-family: 'Consolas', 'Courier New', monospace; background: #f3f4f6; color: #6366f1; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f3f4f6; padding: 0.8em 1em; border-radius: 6px; overflow-x: auto; margin: 0.6em 0; }
  pre code { background: none; padding: 0; color: #374151; }
  hr { border: none; border-top: 1px solid #d1d5db; margin: 1em 0; }
  table { width: 100%; border-collapse: collapse; margin: 0.6em 0; font-size: 0.9em; }
  th { background: #e0e7ff; padding: 0.4em 0.6em; text-align: left; font-weight: 600; color: #2d2d44; border: 1px solid #d1d5db; }
  td { padding: 0.4em 0.6em; border: 1px solid #d1d5db; color: #374151; }
  .doc-header { margin-bottom: 1.5em; padding-bottom: 1em; border-bottom: 2px solid #d1d5db; }
  .doc-header h1 { border: none; padding: 0; margin: 0 0 0.3em 0; }
  .doc-header .meta { font-size: 9.5pt; color: #6b7280; }
  .doc-footer { margin-top: 2em; padding-top: 0.8em; border-top: 1px solid #d1d5db; text-align: center; font-size: 8pt; color: #9ca3af; }
</style>
</head><body>
<div>
  <div class="doc-header">
    <h1>${selectedDoc.title}</h1>
    <div class="meta">
      ${new Date(selectedDoc.periodStart).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      &mdash;
      ${new Date(selectedDoc.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      &nbsp;&nbsp;|&nbsp;&nbsp;
      Generated ${new Date(selectedDoc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
    </div>
  </div>
  <div>${html}</div>
  <div class="doc-footer">Brag Doc Generator &bull; Auto-generated from Azure DevOps commit history</div>
</div>
</body></html>`);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  };

  const isGenerating = generationStatus === "generating";

  return (
    <div className="h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] flex flex-col md:flex-row gap-6">
      {/* Sidebar List */}
      <div
        className={`w-full md:w-1/3 flex flex-col gap-4 ${
          selectedDocId ? "hidden md:flex" : ""
        }`}
      >
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Brag Docs</h1>
            <p className="text-sm text-muted-foreground">Track your wins</p>
          </div>

          <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="shadow-lg shadow-primary/20 gap-1"
                disabled={isGenerating}
              >
                <Plus className="w-4 h-4" /> New
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px]">
              <DialogHeader>
                <DialogTitle>Generate New Brag Doc</DialogTitle>
                <DialogDescription>
                  Choose the period, format, and let AI create your document.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="docTitle">Document Title</Label>
                  <Input
                    id="docTitle"
                    placeholder="Q3 Review"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Document Format</Label>
                  <Select
                    value={mode}
                    onValueChange={(v) => setMode(v as "detailed" | "summary")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="detailed">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            Detailed & Comprehensive
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Full document for performance reviews
                          </span>
                        </div>
                      </SelectItem>
                      <SelectItem value="summary">
                        <div className="flex flex-col">
                          <span className="font-medium">Quick Summary</span>
                          <span className="text-xs text-muted-foreground">
                            Brief overview, readable in 2 minutes
                          </span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleGenerate} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  Generate with AI
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-3 pr-2">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : docs.length > 0 ? (
              docs.map((doc) => (
                <Card
                  key={doc.id}
                  className={`cursor-pointer transition-all duration-200 border-border/50 hover:border-primary/50 hover:bg-muted/50 ${
                    selectedDocId === doc.id ? "border-primary bg-muted" : ""
                  }`}
                  onClick={() => setSelectedDocId(doc.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{doc.title}</h3>
                      <p className="text-xs text-muted-foreground flex items-center mt-1">
                        <Calendar className="w-3 h-3 mr-1" />
                        {format(new Date(doc.periodStart), "MMM d")} -{" "}
                        {format(new Date(doc.periodEnd), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <ChevronRight
                        className={`w-4 h-4 text-muted-foreground transition-transform ${
                          selectedDocId === doc.id
                            ? "translate-x-1 text-primary"
                            : ""
                        }`}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
                <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No docs yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click {'"'}New{'"'} to generate your first brag document
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div
        className={`w-full md:w-2/3 flex flex-col h-full bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden ${
          !selectedDocId && !isGenerating && generationStatus !== "done"
            ? "hidden md:flex"
            : ""
        }`}
      >
        {isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileClock className="w-10 h-10 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">
              Generating your Brag Doc
            </h3>
            <p className="text-muted-foreground max-w-sm mb-2">
              AI is analyzing your commits and crafting{" "}
              <span className="font-medium text-foreground">
                {generationTitle}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              This may take 15-60 seconds depending on the number of commits and
              AI provider...
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
              </div>
              Processing commits...
            </div>
          </div>
        ) : selectedDocId ? (
          selectedLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : selectedDoc ? (
            <>
              {/* Toolbar */}
              <div className="px-6 py-3 border-b border-border/50 flex items-center justify-between bg-muted/10 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {selectedDoc.title}
                  </span>
                  {generationStatus === "done" && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full shrink-0">
                      <FileCheck className="w-3 h-3" />
                      Just generated
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8 px-3 border-border/60 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
                    onClick={handleCopy}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8 px-3 border-border/60 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
                    onClick={handleDownloadMd}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Markdown
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5 text-xs h-8 px-3.5 shadow-sm"
                    onClick={handleDownloadPdf}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-8 w-8"
                    onClick={() => setSelectedDocId(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Professional document view */}
              <div className="flex-1 overflow-y-auto bg-neutral-100 dark:bg-neutral-900/50">
                <div className="max-w-[816px] mx-auto my-6 md:my-10">
                  {/* Paper-like container */}
                  <div
                    className="bg-white text-neutral-900 shadow-xl rounded-sm"
                    style={{ minHeight: "1056px" }}
                  >
                    {/* Document header */}
                    <div className="px-12 pt-12 pb-8 border-b-2 border-neutral-200">
                      <h1 className="text-3xl font-bold text-neutral-900 mb-3 leading-tight">
                        {selectedDoc.title}
                      </h1>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-neutral-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {format(
                            new Date(selectedDoc.periodStart),
                            "MMMM d, yyyy"
                          )}{" "}
                          &mdash;{" "}
                          {format(
                            new Date(selectedDoc.periodEnd),
                            "MMMM d, yyyy"
                          )}
                        </span>
                        <span className="text-neutral-300">|</span>
                        <span>
                          Generated{" "}
                          {format(
                            new Date(selectedDoc.createdAt),
                            "MMM d, yyyy"
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Document body */}
                    <div className="px-12 py-10">
                      <article ref={docRef} className="brag-doc-content">
                        <ReactMarkdown
                          components={{
                            h1: ({ children }) => (
                              <h1 className="text-2xl font-bold text-neutral-900 mt-8 mb-4 pb-2 border-b border-neutral-200 first:mt-0">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-xl font-semibold text-neutral-800 mt-7 mb-3">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-lg font-semibold text-neutral-700 mt-5 mb-2">
                                {children}
                              </h3>
                            ),
                            p: ({ children }) => (
                              <p className="text-sm leading-7 text-neutral-700 mb-4">
                                {children}
                              </p>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc pl-6 mb-4 space-y-1.5">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal pl-6 mb-4 space-y-1.5">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="text-sm leading-6 text-neutral-700">
                                {children}
                              </li>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold text-neutral-900">
                                {children}
                              </strong>
                            ),
                            em: ({ children }) => (
                              <em className="italic text-neutral-600">
                                {children}
                              </em>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-indigo-400 pl-4 py-1 my-4 bg-indigo-50 rounded-r-md">
                                {children}
                              </blockquote>
                            ),
                            hr: () => (
                              <hr className="my-6 border-neutral-200" />
                            ),
                            code: ({ children }) => (
                              <code className="text-xs bg-neutral-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
                                {children}
                              </code>
                            ),
                            table: ({ children }) => (
                              <div className="overflow-x-auto mb-4">
                                <table className="w-full text-sm border-collapse border border-neutral-200">
                                  {children}
                                </table>
                              </div>
                            ),
                            th: ({ children }) => (
                              <th className="border border-neutral-200 bg-neutral-50 px-3 py-2 text-left font-semibold text-neutral-800 text-xs uppercase tracking-wider">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="border border-neutral-200 px-3 py-2 text-neutral-700">
                                {children}
                              </td>
                            ),
                          }}
                        >
                          {selectedDoc.content}
                        </ReactMarkdown>
                      </article>
                    </div>

                    {/* Document footer */}
                    <div className="px-12 py-6 border-t border-neutral-200 mt-auto">
                      <p className="text-xs text-neutral-400 text-center">
                        This document was auto-generated by Brag Doc Generator
                        based on Azure DevOps commit history.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Select a Document</h3>
            <p className="max-w-xs">
              Choose a brag doc from the list or generate a new one to see
              details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
