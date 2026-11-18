import { Spin } from "antd";
import { lazy, Suspense, type ComponentProps } from "react";
import type { RichTextEditor as EditorComponent } from "./RichTextEditor";

const Editor = lazy(async () => ({
  default: (await import("./RichTextEditor")).RichTextEditor,
}));

export const RichTextEditor = (
  props: ComponentProps<typeof EditorComponent>,
) => (
  <Suspense fallback={<Spin />}>
    <Editor {...props} />
  </Suspense>
);
