export type Faq = {
  answer: string;
  id: string;
  question: string;
};
export type FaqRequest = Pick<Faq, "answer" | "question">;
