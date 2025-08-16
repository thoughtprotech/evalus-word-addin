import React from "react";
import parse, {
  domToReact,
  HTMLReactParserOptions,
  Element as HtmlElement,
  DOMNode,
} from "html-react-parser";

interface TextOrHtmlProps {
  content: string;
}

export function TextOrHtml({ content }: TextOrHtmlProps) {
  const containsHtml = /<\/?[a-z][\s\S]*>/i.test(content);

  if (containsHtml) {
    const options: HTMLReactParserOptions = {
      replace: (node) => {
        // Unwrap <p> inside <li> so prose styles apply
        if (node.type === "tag" && node.name === "li") {
          const liNode = node as HtmlElement;
          if (
            liNode.children.length === 1 &&
            (liNode.children[0] as HtmlElement).type === "tag" &&
            (liNode.children[0] as HtmlElement).name === "p"
          ) {
            const pNode = liNode.children[0] as HtmlElement;
            return <li>{domToReact(pNode.children as DOMNode[], options)}</li>;
          }
        }
        return undefined;
      },
    };

    return (
      <div className="editor-content prose prose-sm whitespace-pre-wrap max-w-full">
        {parse(content, options)}
      </div>
    );
  }

  return (
    <div className="whitespace-pre-wrap text-gray-800 max-w-full">
      {content}
    </div>
  );
}
