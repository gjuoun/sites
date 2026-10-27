import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { PROJECT_STATUSES } from "./lib/content-rules";

const posts = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
	schema: z.object({
		title: z.string(),
		slug: z.string(),
		summary: z.string().max(160),
		date: z.coerce.date(),
		draft: z.boolean().default(false),
		series: z.string().optional(),
		order: z.number().int().min(1).optional(),
		tags: z.array(z.string()).default([]),
		starter: z.boolean().default(false),
	}),
});

const series = defineCollection({
	loader: glob({ pattern: "*.md", base: "./src/content/series" }),
	schema: z.object({
		title: z.string(),
		slug: z.string(),
		summary: z.string().max(160),
		order: z.number().int().min(1),
	}),
});

const projects = defineCollection({
	loader: glob({ pattern: "*.md", base: "./src/content/projects" }),
	schema: z.object({
		name: z.string(),
		slug: z.string(),
		summary: z.string().max(160),
		status: z.enum(PROJECT_STATUSES),
		url: z.string().url().optional(),
		repo: z.string().optional(),
		stack: z.array(z.string()).default([]),
		order: z.number().int().min(1),
	}),
});

export const collections = { posts, series, projects };
