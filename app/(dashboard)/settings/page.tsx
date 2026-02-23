"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Key,
  Loader2,
  Save,
  UserCircle,
  X,
  Bot,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { PROVIDER_INFO, type AIProvider } from "@/lib/ai-service";
import { apiFetch } from "@/lib/api-client";
import { useErrorModal } from "@/components/error-modal";

interface AzureConfig {
  id: string;
  organization: string;
  pat: string;
  userAliases: string;
  aiProvider: string;
  aiModel: string;
  aiApiKey: string | null;
}

export default function SettingsPage() {
  const { showError, showApiError } = useErrorModal();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [organization, setOrganization] = useState("");
  const [pat, setPat] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [newAlias, setNewAlias] = useState("");
  const [aiProvider, setAiProvider] = useState<AIProvider>("deepseek");
  const [aiModel, setAiModel] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");

  // Load existing config
  useEffect(() => {
    apiFetch<AzureConfig | null>("/api/azure/config")
      .then((data) => {
        if (data) {
          setOrganization(data.organization);
          setPat(data.pat);
          setAliases(JSON.parse(data.userAliases || "[]"));
          setAiProvider(data.aiProvider as AIProvider);
          setAiModel(data.aiModel || "");
          setAiApiKey(data.aiApiKey || "");
        }
      })
      .catch((err) => showApiError(err, "Failed to load settings"))
      .finally(() => setIsLoading(false));
  }, [showApiError]);

  // Update model when provider changes
  useEffect(() => {
    const info = PROVIDER_INFO[aiProvider];
    if (info && !aiModel) {
      setAiModel(info.defaultModel);
    }
  }, [aiProvider, aiModel]);

  const addAlias = () => {
    const trimmed = newAlias.trim();
    if (trimmed && !aliases.includes(trimmed)) {
      setAliases([...aliases, trimmed]);
      setNewAlias("");
    }
  };

  const removeAlias = (alias: string) => {
    setAliases(aliases.filter((a) => a !== alias));
  };

  const handleSave = async () => {
    if (!organization || !pat) {
      showError({
        title: "Validation Error",
        message: "Organization and PAT are required fields.",
        type: "generic",
      });
      return;
    }
    if (aliases.length === 0) {
      showError({
        title: "Validation Error",
        message: "Add at least one username alias so we can identify your commits.",
        type: "generic",
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch("/api/azure/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization,
          pat,
          userAliases: aliases,
          aiProvider,
          aiModel: aiModel || PROVIDER_INFO[aiProvider].defaultModel,
          aiApiKey: aiApiKey || undefined,
        }),
      });
      toast.success("Configuration saved successfully!");
    } catch (err) {
      showApiError(err, "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const providerInfo = PROVIDER_INFO[aiProvider];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Configure your Azure DevOps connection and AI provider.
        </p>
      </div>

      {/* Azure DevOps Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Azure DevOps Connection
          </CardTitle>
          <CardDescription>
            Enter your organization name and Personal Access Token (PAT) to sync
            your work history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="org">Organization Name</Label>
            <Input
              id="org"
              placeholder="my-organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The organization name from your Azure DevOps URL:
              https://dev.azure.com/<strong>your-org</strong>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pat">Personal Access Token (PAT)</Label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="pat"
                type="password"
                placeholder="v6...your-token..."
                className="pl-9"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Required scopes: <strong>Code (Read)</strong>,{" "}
              <strong>Project and Team (Read)</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Username Aliases */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-primary" />
            Username Aliases
          </CardTitle>
          <CardDescription>
            Add all the names/emails that appear on your commits. We{"'"}ll
            match them case-insensitively across all projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder='e.g. "pedromotta462" or "Pedro Motta"'
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAlias();
                }
              }}
            />
            <Button variant="secondary" onClick={addAlias} type="button">
              Add
            </Button>
          </div>

          {aliases.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {aliases.map((alias) => (
                <Badge
                  key={alias}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm gap-1.5"
                >
                  {alias}
                  <button
                    type="button"
                    onClick={() => removeAlias(alias)}
                    className="ml-1 hover:text-destructive transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {aliases.length === 0 && (
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              No aliases added yet. Add the usernames/emails that appear on your
              Azure DevOps commits.
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            AI Provider
          </CardTitle>
          <CardDescription>
            Choose the AI model to generate brag documents and daily insights.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={aiProvider}
              onValueChange={(v) => {
                setAiProvider(v as AIProvider);
                setAiModel(PROVIDER_INFO[v as AIProvider].defaultModel);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(PROVIDER_INFO) as [AIProvider, typeof PROVIDER_INFO[AIProvider]][]).map(
                  ([key, info]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {info.label}
                        {info.free && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-500 border-green-500/20"
                          >
                            FREE
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <Select value={aiModel} onValueChange={setAiModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerInfo.models.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="apiKey"
                type="password"
                placeholder="Your API key..."
                className="pl-9"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
              />
            </div>
            <a
              href={providerInfo.tokenUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Get your {providerInfo.label} API key
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2 px-8">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save All Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
