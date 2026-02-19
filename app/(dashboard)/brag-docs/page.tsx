"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import ReactMarkdown from "react-markdown";

interface BragDoc {
  id: string;
  title: string;
  content: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export default function BragDocsPage() {
  const [docs, setDocs] = useState<BragDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<BragDoc | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form state
  const [title, setTitle] = useState(
    `Brag Doc - ${format(new Date(), "MMM yyyy")}`
  );
  const [periodStart, setPeriodStart] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [periodEnd, setPeriodEnd] = useState(
    format(new Date(), "yyyy-MM-dd")
  );

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/brag-docs");
      if (res.ok) {
        setDocs(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Load selected doc
  useEffect(() => {
    if (!selectedDocId) {
      setSelectedDoc(null);
      return;
    }

    setSelectedLoading(true);
    fetch(`/api/brag-docs/${selectedDocId}`)
      .then((res) => res.json())
      .then((data) => setSelectedDoc(data))
      .catch(() => {})
      .finally(() => setSelectedLoading(false));
  }, [selectedDocId]);

  const handleGenerate = async () => {
    if (!title || !periodStart || !periodEnd) {
      toast.error("All fields are required");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/brag-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, periodStart, periodEnd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success("Brag doc generated successfully!");
      setIsGenerateOpen(false);
      setSelectedDocId(data.id);
      loadDocs();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/brag-docs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Document deleted");
      if (selectedDocId === id) setSelectedDocId(null);
      loadDocs();
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const handleCopy = () => {
    if (selectedDoc) {
      navigator.clipboard.writeText(selectedDoc.content);
      toast.success("Copied to clipboard!");
    }
  };

  const handleDownload = () => {
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

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6">
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
              <Button size="sm" className="shadow-lg shadow-primary/20 gap-1">
                <Plus className="w-4 h-4" /> New
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Generate New Brag Doc</DialogTitle>
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
              </div>
              <DialogFooter>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate with AI"
                  )}
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
          !selectedDocId ? "hidden md:flex" : ""
        }`}
      >
        {selectedDocId ? (
          selectedLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : selectedDoc ? (
            <>
              <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/10">
                <div>
                  <h2 className="text-2xl font-bold">{selectedDoc.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    Generated on{" "}
                    {format(new Date(selectedDoc.createdAt), "MMMM d, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleDownload}
                    title="Download as Markdown"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setSelectedDocId(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-6 md:p-8">
                  <article className="prose prose-invert max-w-none prose-headings:font-bold prose-h1:text-3xl prose-p:leading-relaxed prose-li:marker:text-primary">
                    <ReactMarkdown>{selectedDoc.content}</ReactMarkdown>
                  </article>
                </div>
              </ScrollArea>
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
