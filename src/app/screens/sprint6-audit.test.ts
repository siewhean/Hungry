import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();

function read(filePath: string): string {
  return readFileSync(path.join(root, filePath), "utf8");
}

type BoundaryProps = {
  title?: string;
  body?: string;
};

function extractBoundaries(filePath: string): BoundaryProps[] {
  const source = read(filePath);
  const ast = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const boundaries: BoundaryProps[] = [];

  function getAttributeText(
    attributes: ts.JsxAttributes,
    attributeName: string,
  ): string | undefined {
    for (const attribute of attributes.properties) {
      if (!ts.isJsxAttribute(attribute)) {
        continue;
      }
      const name = ts.isIdentifier(attribute.name)
        ? attribute.name.text
        : `${attribute.name.namespace.text}:${attribute.name.name.text}`;

      if (name !== attributeName || !attribute.initializer) {
        continue;
      }

      if (ts.isStringLiteral(attribute.initializer)) {
        return attribute.initializer.text;
      }
      if (
        ts.isJsxExpression(attribute.initializer) &&
        attribute.initializer.expression &&
        ts.isStringLiteral(attribute.initializer.expression)
      ) {
        return attribute.initializer.expression.text;
      }
    }
    return undefined;
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxElement(node)) {
      const tagName = node.openingElement.tagName.getText(ast);
      if (tagName === "FeedErrorBoundary") {
        boundaries.push({
          title: getAttributeText(node.openingElement.attributes, "title"),
          body: getAttributeText(node.openingElement.attributes, "body"),
        });
      }
    }

    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(ast);
      if (tagName === "FeedErrorBoundary") {
        boundaries.push({
          title: getAttributeText(node.attributes, "title"),
          body: getAttributeText(node.attributes, "body"),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(ast);
  return boundaries;
}

test("Sprint 6: required screens are wrapped by FeedErrorBoundary", () => {
  const screens = [
    "src/app/screens/auth/LoginScreen.tsx",
    "src/app/screens/auth/SignUpScreen.tsx",
    "src/app/screens/auth/ForgotPasswordScreen.tsx",
    "src/app/screens/auth/EmailVerificationScreen.tsx",
    "src/app/screens/auth/ResetPasswordScreen.tsx",
    "src/app/screens/detail/DishDetailScreenV2.tsx",
    "src/app/screens/detail/StallDetailScreen.tsx",
  ];

  for (const screenPath of screens) {
    const boundaries = extractBoundaries(screenPath);
    assert.ok(boundaries.length > 0, `${screenPath} must include FeedErrorBoundary`);
  }
});

test("Sprint 6: dead files are removed", () => {
  const deadPaths = [
    "src/app/screens/discover/HomeMapScreen (1).tsx",
    "src/app/screens/discover/BuildingInfoSheet.tsx",
    "src/app/screens/discover/DiscoverTabScreen.tsx",
    ".tmp_todo_current.md",
  ];

  for (const deadPath of deadPaths) {
    assert.equal(existsSync(path.join(root, deadPath)), false, `${deadPath} should be deleted`);
  }
});

test("Sprint 6: environment template exists", () => {
  assert.equal(existsSync(path.join(root, ".env.example")), true);
});

test("Sprint 6: detail fallback copy matches expected content", () => {
  // Each detail screen names what it failed to load.
  const detailScreens = [
    ["src/app/screens/detail/DishDetailScreenV2.tsx", "Couldn't load this dish — try again."],
    ["src/app/screens/detail/StallDetailScreen.tsx", "Couldn't load this stall — try again."],
  ] as const;

  for (const [screenPath, body] of detailScreens) {
    const boundaries = extractBoundaries(screenPath);
    assert.ok(
      boundaries.some((boundary) => boundary.body === body),
      `${screenPath} must include the required detail fallback body`,
    );
  }
});
