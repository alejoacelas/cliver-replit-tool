import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Copy, Trash2, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

interface CreateApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  apiKey: string;
  createdAt: string;
}

export default function ApiKeys() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<CreateApiKeyResponse | null>(null);
  const [showKeyDialogOpen, setShowKeyDialogOpen] = useState(false);

  const { data: apiKeys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
    enabled: !!user,
    retry: false,
  });

  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/api-keys", { name });
      return await res.json() as CreateApiKeyResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setNewlyCreatedKey(data);
      setShowKeyDialogOpen(true);
      setCreateDialogOpen(false);
      setNewKeyName("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create API key", variant: "destructive" });
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const res = await apiRequest("DELETE", `/api/api-keys/${keyId}`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({ title: "Done", description: "API key revoked" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke API key", variant: "destructive" });
    },
  });

  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      toast({ title: "Error", description: "Enter a name for your API key", variant: "destructive" });
      return;
    }
    createKeyMutation.mutate(newKeyName);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "API key copied to clipboard" });
  };

  const activeKeys = apiKeys.filter(key => !key.revokedAt);
  const revokedKeys = apiKeys.filter(key => key.revokedAt);

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent transition-colors"
            data-testid="link-back-home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-sm font-medium tracking-tight">cliver</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => window.location.href = user?.isGuest ? '/api/login' : '/api/logout'}
          data-testid={user?.isGuest ? "button-signin" : "button-logout"}
        >
          {user?.isGuest ? "Sign in" : "Log out"}
        </Button>
      </header>

      <div className="max-w-2xl mx-auto w-full px-6 py-8 flex-1 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-medium" data-testid="text-page-title">API Keys</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage keys for programmatic access
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-create-api-key">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create key
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-create-key">
              <DialogHeader>
                <DialogTitle className="text-base">Create API key</DialogTitle>
                <DialogDescription className="text-xs">
                  Give your key a descriptive name.
                </DialogDescription>
              </DialogHeader>
              <div className="py-3">
                <Label htmlFor="keyName" className="text-xs">Name</Label>
                <Input
                  id="keyName"
                  data-testid="input-key-name"
                  placeholder="e.g. Production, Development"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateKey(); }}
                  className="mt-1 text-sm"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)} data-testid="button-cancel-create">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreateKey} disabled={createKeyMutation.isPending} data-testid="button-confirm-create">
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-xs text-muted-foreground">Loading...</div>
        ) : activeKeys.length === 0 && revokedKeys.length === 0 ? (
          <div className="text-center py-16" data-testid="card-empty-state">
            <p className="text-sm text-muted-foreground mb-4">No API keys yet</p>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-key">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create key
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {activeKeys.length > 0 && (
              <div>
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Active</h2>
                <div className="space-y-2">
                  {activeKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between border border-border rounded-md px-3 py-2.5" data-testid={`card-api-key-${key.id}`}>
                      <div className="min-w-0">
                        <div className="text-sm font-medium" data-testid={`text-key-name-${key.id}`}>{key.name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5" data-testid={`text-key-prefix-${key.id}`}>
                          {key.keyPrefix}...
                          <span className="font-sans ml-2">
                            {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" data-testid={`button-revoke-${key.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent data-testid={`dialog-confirm-revoke-${key.id}`}>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-base">Revoke "{key.name}"?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs">
                              Applications using this key will immediately lose access. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="text-xs" data-testid={`button-cancel-revoke-${key.id}`}>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="text-xs" onClick={() => revokeKeyMutation.mutate(key.id)} data-testid={`button-confirm-revoke-${key.id}`}>
                              Revoke
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {revokedKeys.length > 0 && (
              <div>
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Revoked</h2>
                <div className="space-y-2">
                  {revokedKeys.map((key) => (
                    <div key={key.id} className="flex items-center border border-border rounded-md px-3 py-2.5 opacity-50" data-testid={`card-revoked-key-${key.id}`}>
                      <div className="min-w-0">
                        <div className="text-sm" data-testid={`text-revoked-name-${key.id}`}>{key.name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {key.keyPrefix}...
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showKeyDialogOpen} onOpenChange={setShowKeyDialogOpen}>
        <DialogContent data-testid="dialog-show-new-key">
          <DialogHeader>
            <DialogTitle className="text-base">Key created</DialogTitle>
            <DialogDescription className="text-xs">
              Copy your key now. You won't see it again.
            </DialogDescription>
          </DialogHeader>
          {newlyCreatedKey && (
            <div className="py-3 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                <div className="text-sm mt-0.5" data-testid="text-new-key-name">{newlyCreatedKey.name}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Key</Label>
                <div className="flex gap-2 mt-0.5">
                  <Input readOnly value={newlyCreatedKey.apiKey} className="font-mono text-xs" data-testid="input-new-key-value" />
                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(newlyCreatedKey.apiKey)} data-testid="button-copy-key">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button size="sm" onClick={() => { setShowKeyDialogOpen(false); setNewlyCreatedKey(null); }} data-testid="button-close-new-key">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
