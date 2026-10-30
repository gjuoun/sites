/**
 * The one place an upstream model id becomes a label. Gateway ids differ per lane
 * (deepseek/deepseek-v4.1-flash vs deepseek-v4.1-flash, -fast, -1017), so the map is by id.
 * An id with no entry is shown as itself.
 */
export const MODEL_LABEL: Record<string, string> = {
  "deepseek/deepseek-v4.1-flash": "DeepSeek V4.1 Flash",
  "deepseek-v4.1-flash": "DeepSeek V4.1 Flash",
  "deepseek/deepseek-v4.1-flash-1017": "DeepSeek V4.1 Flash (1017)",
  "deepseek-v4.1-flash-1017": "DeepSeek V4.1 Flash (1017)",
  "deepseek/deepseek-v4.1-flash-fast": "DeepSeek V4.1 Flash (fast)",
  "deepseek-v4.1-flash-fast": "DeepSeek V4.1 Flash (fast)",
  "z-ai/glm-5.3-flash": "GLM-5.3-Flash",
  "glm-5.3-flash": "GLM-5.3-Flash",
  "glm-5.3": "GLM-5.3 (no list price)",
  "xiaomi/mimo-v2.6-flash": "MiMo v2.6 Flash",
  "mimo-v2.6-flash": "MiMo v2.6 Flash",
  "qwen3.8-flash": "Qwen3.8 Flash",
  "qwen3.8-max": "Qwen3.8 Max",
};

export function modelLabel(upstream: string): string {
  return MODEL_LABEL[upstream] ?? upstream;
}
