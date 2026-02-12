import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Trash2, Copy, Plus, Check } from "lucide-react";
import type { UserCallConfig } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ControlPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configs: UserCallConfig[];
  onSave: (configs: UserCallConfig[]) => void;
  userId: string;
}

export function ControlPanel({ open, onOpenChange, configs, onSave, userId }: ControlPanelProps) {
  const [editingConfigs, setEditingConfigs] = useState<UserCallConfig[]>(configs);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setEditingConfigs(configs);
  }, [configs]);

  const handleToggle = (id: string) => {
    setEditingConfigs(prev =>
      prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)
    );
  };

  const handleDelete = (id: string) => {
    setEditingConfigs(prev => prev.filter(c => c.id !== id));
  };

  const handleDuplicate = (config: UserCallConfig) => {
    const newConfig: UserCallConfig = {
      ...config,
      id: crypto.randomUUID(),
      displayName: `${config.displayName} (copy)`,
      isDefault: false,
      order: editingConfigs.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setEditingConfigs(prev => [...prev, newConfig]);
  };

  const handleAddNew = () => {
    const newConfig: UserCallConfig = {
      id: crypto.randomUUID(),
      userId: userId,
      displayName: 'New configuration',
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'Investigate the background of the following customer',
      reasoningEffort: null,
      webSearchEnabled: true,
      topP: null,
      responseMode: 'markdown',
      enabled: true,
      order: editingConfigs.length,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setEditingConfigs(prev => [...prev, newConfig]);
    setEditingId(newConfig.id);
  };

  const handleSave = () => {
    onSave(editingConfigs);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setEditingConfigs(configs);
    setEditingId(null);
    onOpenChange(false);
  };

  const updateConfig = (id: string, updates: Partial<UserCallConfig>) => {
    setEditingConfigs(prev =>
      prev.map(c => c.id === id ? { ...c, ...updates } : c)
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[420px] p-0">
        <ScrollArea className="h-full">
          <div className="p-5">
            <SheetHeader className="mb-5">
              <SheetTitle className="text-base">Configurations</SheetTitle>
              <SheetDescription className="text-xs">
                Configure AI models and how they respond to queries
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-3" data-testid="control-panel-configs">
              {editingConfigs.map((config) => {
                const isEditing = editingId === config.id;

                return (
                  <div key={config.id} className="border border-border rounded-md p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isEditing ? (
                          <Input
                            value={config.displayName}
                            onChange={(e) => updateConfig(config.id, { displayName: e.target.value })}
                            className="h-7 text-sm"
                            data-testid={`config-name-input-${config.id}`}
                          />
                        ) : (
                          <span className="text-sm font-medium truncate" data-testid={`config-name-${config.id}`}>
                            {config.displayName}
                          </span>
                        )}
                      </div>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={() => handleToggle(config.id)}
                        data-testid={`config-toggle-${config.id}`}
                      />
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Model</Label>
                          <Select
                            value={config.model}
                            onValueChange={(value) => updateConfig(config.id, { model: value })}
                          >
                            <SelectTrigger className="mt-1 h-8 text-xs" data-testid={`config-model-select-${config.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Instructions</Label>
                          <Textarea
                            value={config.systemPrompt || ''}
                            onChange={(e) => updateConfig(config.id, { systemPrompt: e.target.value || null })}
                            placeholder="Instructions for this model..."
                            className="mt-1 min-h-[140px] text-xs"
                            data-testid={`config-prompt-input-${config.id}`}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Reasoning</Label>
                            <Select
                              value={config.reasoningEffort || 'none'}
                              onValueChange={(value) => updateConfig(config.id, {
                                reasoningEffort: value === 'none' ? null : value as any
                              })}
                            >
                              <SelectTrigger className="mt-1 h-8 text-xs" data-testid={`config-reasoning-select-${config.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs text-muted-foreground">Response mode</Label>
                            <Select
                              value={config.responseMode}
                              onValueChange={(value) => updateConfig(config.id, { responseMode: value as any })}
                            >
                              <SelectTrigger className="mt-1 h-8 text-xs" data-testid={`config-mode-select-${config.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="markdown">Markdown</SelectItem>
                                <SelectItem value="json-field">JSON</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Web search</Label>
                          <Switch
                            checked={config.webSearchEnabled}
                            onCheckedChange={(checked) => updateConfig(config.id, { webSearchEnabled: checked })}
                            data-testid={`config-websearch-toggle-${config.id}`}
                          />
                        </div>

                        {config.topP !== null && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Top P: {config.topP?.toFixed(2) || 1.0}</Label>
                            <Slider
                              value={[config.topP || 1.0]}
                              onValueChange={([value]) => updateConfig(config.id, { topP: value })}
                              min={0}
                              max={1}
                              step={0.01}
                              className="mt-2"
                              data-testid={`config-topp-slider-${config.id}`}
                            />
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                          className="w-full text-xs h-7"
                          data-testid={`config-save-${config.id}`}
                        >
                          <Check className="w-3 h-3 mr-1.5" />
                          Done
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="text-xs text-muted-foreground mb-2 space-y-0.5">
                          <div>{config.model}</div>
                          <div className="flex gap-3">
                            {config.reasoningEffort && <span>Reasoning: {config.reasoningEffort}</span>}
                            <span>Search: {config.webSearchEnabled ? 'on' : 'off'}</span>
                            <span>{config.responseMode}</span>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {!config.isDefault && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(config.id)}
                                className="h-7 text-xs px-2"
                                data-testid={`config-edit-${config.id}`}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(config.id)}
                                className="h-7 w-7 p-0"
                                data-testid={`config-delete-${config.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDuplicate(config)}
                            className="h-7 w-7 p-0"
                            data-testid={`config-duplicate-${config.id}`}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              onClick={handleAddNew}
              variant="outline"
              size="sm"
              className="w-full mt-3 text-xs h-8"
              data-testid="config-add-new"
            >
              <Plus className="w-3 h-3 mr-1.5" />
              Add configuration
            </Button>

            <div className="border-t border-border mt-5 pt-4 flex gap-2">
              <Button onClick={handleCancel} variant="outline" size="sm" className="flex-1 text-xs" data-testid="control-panel-cancel">
                Cancel
              </Button>
              <Button onClick={handleSave} size="sm" className="flex-1 text-xs" data-testid="control-panel-save">
                Save
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
