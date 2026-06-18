import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const baseSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  modified: z.coerce.date().optional(),
  lang: z.enum(['th', 'en']),
  slug: z.string(),
  path: z.string(),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  cover: z.string().optional(),
  excerpt: z.string().optional(),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: baseSchema,
});
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: baseSchema.extend({
    issues: z.array(z.string()).default([]),   // ประเด็น (displayed; sparse on source)
    type: z.string().optional(),               // ประเภท
    year: z.union([z.number(), z.string()]).optional(), // ปีที่พัฒนา
    partners: z.array(z.string()).default([]),  // ร่วมกับองค์กร
  }),
});
const policies = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/policies' }),
  schema: z.object({
    title: z.string(),
    lang: z.enum(['th', 'en']),
    slug: z.string(),
    path: z.string(),
  }),
});

export const collections = { posts, projects, policies };
