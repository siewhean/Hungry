import type { BlogPost } from "@/types/domain";
export async function loadExactArticle(
  id: string | undefined,
  getArticle: (id: string) => Promise<BlogPost | undefined>,
): Promise<BlogPost | undefined> {
  if (!id?.trim()) return undefined;
  const article = await getArticle(id);
  return article?.id === id ? article : undefined;
}
