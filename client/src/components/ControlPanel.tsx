import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Lock, Trash2, Copy, Plus, Check } from "lucide-react";
import type { UserCallConfig } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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

  // Sync editing configs when props change
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
      displayName: `${config.displayName} (Copy)`,
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
      displayName: 'New Configuration',
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
      <SheetContent side="right" className="w-full sm:max-w-[480px] p-0">
        <ScrollArea className="h-full">
          <div className="p-6">
            <SheetHeader className="mb-6">
              <SheetTitle>Configure AI Calls</SheetTitle>
              <SheetDescription>
                Customize which AI models analyze each query and how they respond
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4" data-testid="control-panel-configs">
              {editingConfigs.map((config) => {
                const isEditing = editingId === config.id;

                return (
                  <Card key={config.id} className={`p-4 ${config.isDefault ? 'border-primary/50' : ''}`}>
                    {/* Config Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {config.isDefault && <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        {isEditing ? (
                          <Input
                            value={config.displayName}
                            onChange={(e) => updateConfig(config.id, { displayName: e.target.value })}
                            className="h-8 text-sm font-medium"
                            data-testid={`config-name-input-${config.id}`}
                          />
                        ) : (
                          <h4 className="font-medium truncate" data-testid={`config-name-${config.id}`}>
                            {config.displayName}
                          </h4>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Switch
                          checked={config.enabled}
                          onCheckedChange={() => handleToggle(config.id)}
                          data-testid={`config-toggle-${config.id}`}
                        />
                      </div>
                    </div>

                    {/* Config Body */}
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs">Model</Label>
                          <Select
                            value={config.model}
                            onValueChange={(value) => updateConfig(config.id, { model: value })}
                          >
                            <SelectTrigger className="mt-1" data-testid={`config-model-select-${config.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs">Customer Screening Instructions</Label>
                          <Textarea
                            value={config.systemPrompt || ''}
                            onChange={(e) => updateConfig(config.id, { systemPrompt: e.target.value || null })}
                            placeholder="Custom instructions for this model..."
                            className="mt-1 min-h-[200px]"
                            data-testid={`config-prompt-input-${config.id}`}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs">Reasoning Effort</Label>
                            <Select
                              value={config.reasoningEffort || 'none'}
                              onValueChange={(value) => updateConfig(config.id, { 
                                reasoningEffort: value === 'none' ? null : value as any 
                              })}
                            >
                              <SelectTrigger className="mt-1" data-testid={`config-reasoning-select-${config.id}`}>
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
                            <Label className="text-xs">Response Mode</Label>
                            <Select
                              value={config.responseMode}
                              onValueChange={(value) => updateConfig(config.id, { responseMode: value as any })}
                            >
                              <SelectTrigger className="mt-1" data-testid={`config-mode-select-${config.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="markdown">Markdown</SelectItem>
                                <SelectItem value="json-field">JSON Field</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs">Web Search</Label>
                            <Switch
                              checked={config.webSearchEnabled}
                              onCheckedChange={(checked) => updateConfig(config.id, { webSearchEnabled: checked })}
                              data-testid={`config-websearch-toggle-${config.id}`}
                            />
                          </div>
                        </div>

                        {config.topP !== null && (
                          <div>
                            <Label className="text-xs">Top P: {config.topP?.toFixed(2) || 1.0}</Label>
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

                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => setEditingId(null)}
                            variant="outline"
                            className="flex-1"
                            data-testid={`config-save-${config.id}`}
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Done
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                          <div>Model: <span className="text-foreground">{config.model}</span></div>
                          {config.reasoningEffort && (
                            <div>Reasoning: <span className="text-foreground">{config.reasoningEffort}</span></div>
                          )}
                          <div>Web Search: <span className="text-foreground">{config.webSearchEnabled ? 'Yes' : 'No'}</span></div>
                          <div>Mode: <span className="text-foreground">{config.responseMode}</span></div>
                        </div>

                        <div className="flex gap-2">
                          {!config.isDefault && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingId(config.id)}
                                className="flex-1"
                                data-testid={`config-edit-${config.id}`}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(config.id)}
                                data-testid={`config-delete-${config.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDuplicate(config)}
                            data-testid={`config-duplicate-${config.id}`}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </Card>
                );
              })}
            </div>

            <Button
              onClick={handleAddNew}
              variant="outline"
              className="w-full mt-4"
              data-testid="config-add-new"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Configuration
            </Button>

            <Separator className="my-6" />

            <div className="flex gap-3">
              <Button onClick={handleCancel} variant="outline" className="flex-1" data-testid="control-panel-cancel">
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex-1" data-testid="control-panel-save">
                Save Changes
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
