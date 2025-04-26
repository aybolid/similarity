import { openai } from ".";
import { EMBEDDING_DIMENSIONS } from "../constants";

export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replaceAll("\n", " ");

  const { data } = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return data[0]?.embedding ?? [];
};
