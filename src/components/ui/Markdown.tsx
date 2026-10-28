import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A deliberately small Markdown renderer for CMS content (##, ###, lists, tables, **bold**, *em*, [links](href)).
 * It never renders raw HTML, so editor content cannot inject markup.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${keyBase}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("[")) {
      const [, label, href] = t.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      const safe = /^(https?:\/\/|\/|#)/.test(href) ? href : "#";
      out.push(
        safe.startsWith("/") ? (
          <Link key={k} href={safe}>
            {label}
          </Link>
        ) : (
          <a key={k} href={safe} rel="noopener noreferrer" target="_blank">
            {label}
          </a>
        ),
      );
    } else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className = "prose-elans" }: { source: string; className?: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={key++}>{inline(line.slice(4), `h${key}`)}</h3>);
      i++;
    } else if (line.startsWith("## ")) {
      const text = line.slice(3);
      blocks.push(
        <h2 key={key++} id={text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}>
          {inline(text, `h${key}`)}
        </h2>,
      );
      i++;
    } else if (/^\s*[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*] /, ""));
      blocks.push(<ul key={key++}>{items.map((t, j) => <li key={j}>{inline(t, `l${key}-${j}`)}</li>)}</ul>);
    } else if (/^\s*\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\. /, ""));
      blocks.push(<ol key={key++}>{items.map((t, j) => <li key={j}>{inline(t, `o${key}-${j}`)}</li>)}</ol>);
    } else if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={key++} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>{head.map((h, j) => <th key={j} className="border-b border-line px-3 py-2 text-left font-semibold">{inline(h, `th${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>{r.map((c, j) => <td key={j} className="border-b border-line px-3 py-2 align-top">{inline(c, `td${ri}-${j}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(#|\s*[-*] |\s*\d+\. |\|)/.test(lines[i])) para.push(lines[i++]);
      blocks.push(<p key={key++}>{inline(para.join(" "), `p${key}`)}</p>);
    }
  }
  return <div className={className}>{blocks}</div>;
}
