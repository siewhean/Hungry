import type { TasteVector } from "@/types/domain";

/** Programmatic restoration never represents an answer; user drag events carry a question identity. */
export function createTasteCarouselGesture() {
  let question: keyof TasteVector | null = null;
  return {
    begin: (key: keyof TasteVector) => {
      question = key;
    },
    cancel: () => {
      question = null;
    },
    acceptEnd: (key: keyof TasteVector, final: boolean) => {
      const accepted = question === key;
      if (final && accepted) question = null;
      return accepted;
    },
  };
}
