import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps {
  children: string;
  className?: string;
}

export default function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={className ?? "prose prose-lg max-w-none"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <Link
              href={href ?? "#"}
              className="text-ctp-blue underline hover:text-ctp-sky"
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
            >
              {children}
            </Link>
          ),
          ul: ({ children }) => <ul className="list-disc pl-6">{children}</ul>,
          ol: ({ children }) => (
            <ol className="list-decimal pl-6">{children}</ol>
          ),
          li: ({ children }) => <li className="mb-1">{children}</li>,
          p: ({ children }) => (
            <p className="mb-4 leading-relaxed">{children}</p>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
