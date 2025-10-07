import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Key, Plus, Copy, Trash2, AlertTriangle, ArrowLeft, Sparkles } from "lucide-react";
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
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const res = await apiRequest("DELETE", `/api/api-keys/${keyId}`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Success",
        description: "API key revoked successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to revoke API key",
        variant: "destructive",
      });
    },
  });

  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for your API key",
        variant: "destructive",
      });
      return;
    }
    createKeyMutation.mutate(newKeyName);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const activeKeys = apiKeys.filter(key => !key.revokedAt);
  const revokedKeys = apiKeys.filter(key => key.revokedAt);

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link 
            href="/"
            className="inline-flex items-center justify-center h-9 w-9 rounded-md hover-elevate active-elevate-2 transition-colors"
            data-testid="link-back-home"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Cliver</h1>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={() => window.location.href = user?.isGuest ? '/api/login' : '/api/logout'}
          data-testid={user?.isGuest ? "button-signin" : "button-logout"}
        >
          {user?.isGuest ? "Sign In" : "Log Out"}
        </Button>
      </header>
      <div className="p-6 border-b">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">API Keys</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your API keys for programmatic access
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-api-key">
                <Plus className="h-4 w-4" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-create-key">
              <DialogHeader>
                <DialogTitle>Create New API Key</DialogTitle>
                <DialogDescription>
                  Give your API key a descriptive name to help you remember what it's for.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Name</Label>
                  <Input
                    id="keyName"
                    data-testid="input-key-name"
                    placeholder="e.g., Production API, Development Testing"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateKey();
                      }
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateKey}
                  disabled={createKeyMutation.isPending}
                  data-testid="button-confirm-create"
                >
                  Create Key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : activeKeys.length === 0 ? (
          <Card data-testid="card-empty-state">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Key className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No API keys yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first API key to get started with the API
              </p>
              <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-key">
                <Plus className="h-4 w-4" />
                Create API Key
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Active Keys</h2>
              <div className="grid gap-4">
                {activeKeys.map((key) => (
                  <Card key={key.id} data-testid={`card-api-key-${key.id}`}>
                    <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                      <div>
                        <CardTitle className="text-base" data-testid={`text-key-name-${key.id}`}>
                          {key.name}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs mt-1" data-testid={`text-key-prefix-${key.id}`}>
                          {key.keyPrefix}...
                        </CardDescription>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-revoke-${key.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent data-testid={`dialog-confirm-revoke-${key.id}`}>
                          <AlertDialogHeader>
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                              <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                            </div>
                            <AlertDialogDescription>
                              Are you sure you want to revoke "{key.name}"? This action cannot be undone and
                              any applications using this key will immediately lose access.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid={`button-cancel-revoke-${key.id}`}>
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => revokeKeyMutation.mutate(key.id)}
                              data-testid={`button-confirm-revoke-${key.id}`}
                            >
                              Revoke Key
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-6 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Created:</span>{" "}
                          <span data-testid={`text-created-${key.id}`}>
                            {formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        {key.lastUsedAt && (
                          <div>
                            <span className="font-medium">Last used:</span>{" "}
                            <span data-testid={`text-last-used-${key.id}`}>
                              {formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {revokedKeys.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-muted-foreground">Revoked Keys</h2>
                <div className="grid gap-4">
                  {revokedKeys.map((key) => (
                    <Card key={key.id} className="opacity-60" data-testid={`card-revoked-key-${key.id}`}>
                      <CardHeader>
                        <CardTitle className="text-base" data-testid={`text-revoked-name-${key.id}`}>
                          {key.name}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs">
                          {key.keyPrefix}... (revoked {formatDistanceToNow(new Date(key.revokedAt!), { addSuffix: true })})
                        </CardDescription>
                      </CardHeader>
                    </Card>
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
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Make sure to copy your API key now. You won't be able to see it again!
            </DialogDescription>
          </DialogHeader>
          {newlyCreatedKey && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <div className="text-sm" data-testid="text-new-key-name">{newlyCreatedKey.name}</div>
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={newlyCreatedKey.apiKey}
                    className="font-mono text-sm"
                    data-testid="input-new-key-value"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(newlyCreatedKey.apiKey)}
                    data-testid="button-copy-key"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200 dark:border-amber-800">
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    This is the only time you'll see the full API key. Store it securely.
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                setShowKeyDialogOpen(false);
                setNewlyCreatedKey(null);
              }}
              data-testid="button-close-new-key"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
