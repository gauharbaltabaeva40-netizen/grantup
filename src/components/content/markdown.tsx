import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { cn } from "@/lib/utils";
import "katex/dist/katex.min.css";

/**
 * Конспект, сұрақ, нұсқа, түсіндірме мәтіндері: Markdown + KaTeX ($...$, $$...$$) + кестелер (GFM).
 * Шикі HTML рендерленбейді (react-markdown әдепкі қауіпсіз режимі), сондықтан XSS қаупі жоқ.
 */
export function Markdown({ children, className, inline = false }: { children: string; className?: string; inline?: boolean }) {
  return (
    <div className={cn(inline ? "markdown-inline" : "markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}
        skipHtml
        components={{
          a: ({ children: text }) => <span className="font-semibold">{text}</span>,
          img: () => null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
