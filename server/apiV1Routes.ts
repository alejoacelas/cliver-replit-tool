import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { authenticateApiKey } from "./apiAuth";
import { streamOpenAIResponse } from "./openai";
import { z } from "zod";
import { insertUserCallConfigSchema } from "@shared/schema";

const createConfigSchema = insertUserCallConfigSchema.extend({
  displayName: z.string().min(1).max(100),
  model: z.enum(["gpt-4.1-nano", "gpt-4o", "gpt-5", "o3-mini"]),
  systemPrompt: z.string().max(10000).optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional().nullable(),
  webSearchEnabled: z.boolean(),
  topP: z.number().min(0).max(1).optional().nullable(),
  responseMode: z.enum(["markdown", "json-field"]),
  enabled: z.boolean(),
});

const updateConfigSchema = createConfigSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

const createRequestSchema = z.object({
  input: z.string().min(1).max(50000),
  configIds: z.array(z.string().uuid()).min(1).max(10),
  metadata: z.record(z.any()).optional(),
});

export function registerApiV1Routes(app: Express) {
  app.get('/api/v1/configurations', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const enabled = req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const allConfigs = await storage.getUserCallConfigs(userId);
      
      let filtered = allConfigs;
      if (enabled !== undefined) {
        filtered = allConfigs.filter(c => c.enabled === enabled);
      }

      const paginated = filtered.slice(offset, offset + limit);

      res.json({
        configurations: paginated,
        total: filtered.length,
        limit,
        offset
      });
    } catch (error) {
      console.error("Error fetching configurations:", error);
      res.status(500).json({
        error: {
          code: "server_error",
          message: "Failed to fetch configurations",
        }
      });
    }
  });

  app.get('/api/v1/configurations/:configId', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { configId } = req.params;

      const config = await storage.getUserCallConfig(configId);

      if (!config || config.userId !== userId) {
        return res.status(404).json({
          error: {
            code: "resource_not_found",
            message: "Configuration not found",
          }
        });
      }

      res.json(config);
    } catch (error) {
      console.error("Error fetching configuration:", error);
      res.status(500).json({
        error: {
          code: "server_error",
          message: "Failed to fetch configuration",
        }
      });
    }
  });

  app.post('/api/v1/configurations', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      
      const validationResult = createConfigSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: {
            code: "validation_error",
            message: "Invalid request body",
            details: validationResult.error.errors
          }
        });
      }

      const data = validationResult.data;

      const existingConfigs = await storage.getUserCallConfigs(userId);
      const duplicate = existingConfigs.find(c => c.displayName === data.displayName);
      if (duplicate) {
        return res.status(409).json({
          error: {
            code: "conflict",
            message: "Configuration with this name already exists",
          }
        });
      }

      const highestOrder = existingConfigs.reduce((max, c) => Math.max(max, c.order), 0);

      const created = await storage.createUserCallConfig({
        userId,
        displayName: data.displayName,
        model: data.model,
        systemPrompt: data.systemPrompt || null,
        reasoningEffort: data.reasoningEffort || null,
        webSearchEnabled: data.webSearchEnabled,
        topP: data.topP || null,
        responseMode: data.responseMode,
        enabled: data.enabled,
        order: highestOrder + 1,
        isDefault: false,
      });

      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating configuration:", error);
      res.status(500).json({
        error: {
          code: "server_error",
          message: "Failed to create configuration",
        }
      });
    }
  });

  app.patch('/api/v1/configurations/:configId', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { configId } = req.params;

      const config = await storage.getUserCallConfig(configId);

      if (!config || config.userId !== userId) {
        return res.status(404).json({
          error: {
            code: "resource_not_found",
            message: "Configuration not found",
          }
        });
      }

      if (config.isDefault) {
        return res.status(403).json({
          error: {
            code: "permission_denied",
            message: "Cannot modify default configuration",
          }
        });
      }

      const validationResult = updateConfigSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: {
            code: "validation_error",
            message: "Invalid update data",
            details: validationResult.error.errors
          }
        });
      }

      const data = validationResult.data;

      if (data.displayName) {
        const existingConfigs = await storage.getUserCallConfigs(userId);
        const duplicate = existingConfigs.find(c => c.displayName === data.displayName && c.id !== configId);
        if (duplicate) {
          return res.status(409).json({
            error: {
              code: "conflict",
              message: "Configuration with this name already exists",
            }
          });
        }
      }

      const updated = await storage.updateUserCallConfig(configId, data);

      res.json(updated);
    } catch (error) {
      console.error("Error updating configuration:", error);
      res.status(500).json({
        error: {
          code: "server_error",
          message: "Failed to update configuration",
        }
      });
    }
  });

  app.delete('/api/v1/configurations/:configId', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { configId } = req.params;

      const config = await storage.getUserCallConfig(configId);

      if (!config || config.userId !== userId) {
        return res.status(404).json({
          error: {
            code: "resource_not_found",
            message: "Configuration not found",
          }
        });
      }

      if (config.isDefault) {
        return res.status(403).json({
          error: {
            code: "permission_denied",
            message: "Cannot delete default configuration",
          }
        });
      }

      await storage.deleteUserCallConfig(configId);

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting configuration:", error);
      res.status(500).json({
        error: {
          code: "server_error",
          message: "Failed to delete configuration",
        }
      });
    }
  });

  app.post('/api/v1/requests', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const apiKeyId = (req as any).apiKey.id;

      const validationResult = createRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: {
            code: "validation_error",
            message: "Invalid request body",
            details: validationResult.error.errors
          }
        });
      }

      const { input, configIds, metadata } = validationResult.data;

      const pendingCount = await storage.countPendingRequests(userId);
      if (pendingCount >= 100) {
        return res.status(429).json({
          error: {
            code: "rate_limit_exceeded",
            message: "Too many concurrent requests. Maximum 100 pending/processing requests allowed.",
          }
        });
      }

      const configs = await storage.getUserCallConfigsByIds(userId, configIds);

      if (configs.length !== configIds.length) {
        const foundIds = configs.map(c => c.id);
        const missingIds = configIds.filter(id => !foundIds.includes(id));
        return res.status(403).json({
          error: {
            code: "permission_denied",
            message: "One or more configurations not found or not enabled",
            details: { missingConfigIds: missingIds }
          }
        });
      }

      const disabledConfigs = configs.filter(c => !c.enabled);
      if (disabledConfigs.length > 0) {
        return res.status(403).json({
          error: {
            code: "permission_denied",
            message: "One or more configurations are disabled",
            details: { disabledConfigIds: disabledConfigs.map(c => c.id) }
          }
        });
      }

      const apiRequest = await storage.createApiRequest({
        userId,
        apiKeyId,
        input,
        configIds,
        status: "processing",
        metadata: metadata || null,
        webhookUrl: null,
      });

      const responsePlaceholders = await Promise.all(
        configs.map(config =>
          storage.createApiRequestResponse({
            requestId: apiRequest.id,
            callConfigId: config.id,
            displayName: config.displayName,
            model: config.model,
            content: "",
            status: "streaming",
            responseId: null,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
            duration: null,
            toolCalls: null,
            annotations: null,
            error: null,
          })
        )
      );

      processApiRequestAsync(apiRequest.id, input, configs);

      res.status(202).json({
        id: apiRequest.id,
        status: apiRequest.status,
        input: apiRequest.input,
        configIds: apiRequest.configIds,
        metadata: apiRequest.metadata,
        responses: responsePlaceholders.map(r => ({
          id: r.id,
          displayName: r.displayName,
          model: r.model,
          status: r.status,
          content: r.content,
          createdAt: r.createdAt,
        })),
        createdAt: apiRequest.createdAt,
      });
    } catch (error) {
      console.error("Error creating request:", error);
      res.status(500).json({
        error: {
          code: "server_error",
          message: "Failed to create request",
        }
      });
    }
  });

  app.get('/api/v1/requests/:requestId', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { requestId } = req.params;

      const request = await storage.getApiRequest(requestId);

      if (!request || request.userId !== userId) {
        return res.status(404).json({
          error: {
            code: "resource_not_found",
            message: "Request not found",
          }
        });
      }

      const responses = await storage.getApiRequestResponses(requestId);

      res.json({
        id: request.id,
        status: request.status,
        input: request.input,
        configIds: request.configIds,
        metadata: request.metadata,
        responses: responses.map(r => ({
          id: r.id,
          displayName: r.displayName,
          model: r.model,
          status: r.status,
          content: r.content,
          responseId: r.responseId,
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          totalTokens: r.totalTokens,
          duration: r.duration,
          toolCalls: r.toolCalls,
          annotations: r.annotations,
          error: r.error,
          createdAt: r.createdAt,
          completedAt: r.completedAt,
        })),
        createdAt: request.createdAt,
        completedAt: request.completedAt,
      });
    } catch (error) {
      console.error("Error fetching request:", error);
      res.status(500).json({
        error: {
          code: "server_error",
          message: "Failed to fetch request",
        }
      });
    }
  });

  app.get('/api/v1/requests', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const status = req.query.status as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const { requests, total } = await storage.getApiRequests(userId, {
        status,
        limit,
        offset,
        startDate,
        endDate,
      });

      res.json({
        requests: requests.map(r => ({
          id: r.id,
          status: r.status,
          input: r.input.substring(0, 200),
          metadata: r.metadata,
          createdAt: r.createdAt,
          completedAt: r.completedAt,
        })),
        total,
        limit,
        offset,
      });
    } catch (error) {
      console.error("Error fetching requests:", error);
      res.status(500).json({
        error: {
          code: "server_error",
          message: "Failed to fetch requests",
        }
      });
    }
  });
}

async function processApiRequestAsync(requestId: string, input: string, configs: any[]) {
  try {
    const responses = await storage.getApiRequestResponses(requestId);

    await Promise.all(
      configs.map(async (config, index) => {
        const responseRecord = responses[index];
        
        try {
          const startTime = Date.now();
          
          const stream = streamOpenAIResponse({
            model: config.model,
            input,
            instructions: config.systemPrompt || undefined,
            reasoningEffort: config.reasoningEffort || undefined,
            webSearchEnabled: config.webSearchEnabled,
            topP: config.topP || undefined,
            responseMode: config.responseMode,
          });

          let finalResponse: any = null;

          for await (const event of stream) {
            if (event.type === 'delta') {
              const currentResponse = await storage.getApiRequestResponses(requestId);
              const currentContent = currentResponse[index].content;
              await storage.updateApiRequestResponse(responseRecord.id, {
                content: currentContent + event.content,
              });
            } else if (event.type === 'complete') {
              finalResponse = event.response;
            } else if (event.type === 'error') {
              throw new Error(event.error);
            }
          }

          if (!finalResponse) {
            throw new Error('No complete response received');
          }

          const duration = Date.now() - startTime;

          await storage.updateApiRequestResponse(responseRecord.id, {
            content: finalResponse.text,
            status: "completed",
            responseId: finalResponse.response_id || null,
            inputTokens: finalResponse.usage?.input_tokens || null,
            outputTokens: finalResponse.usage?.output_tokens || null,
            totalTokens: finalResponse.usage?.total_tokens || null,
            duration,
            toolCalls: finalResponse.tool_calls as any,
            annotations: finalResponse.annotations as any,
            completedAt: new Date(),
          });
        } catch (error: any) {
          await storage.updateApiRequestResponse(responseRecord.id, {
            status: "error",
            error: error.message || "Unknown error",
            completedAt: new Date(),
          });
        }
      })
    );

    const finalResponses = await storage.getApiRequestResponses(requestId);
    const allCompleted = finalResponses.every(r => r.status === "completed" || r.status === "error");

    if (allCompleted) {
      const anyErrors = finalResponses.some(r => r.status === "error");
      await storage.updateApiRequest(requestId, {
        status: anyErrors ? "failed" : "completed",
        completedAt: new Date(),
      });
    }
  } catch (error) {
    console.error("Error processing API request:", error);
    await storage.updateApiRequest(requestId, {
      status: "failed",
      completedAt: new Date(),
    });
  }
}
