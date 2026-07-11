const babel = require("@babel/core");
const path = require("path");

function resolveExpoTransformer() {
  try {
    return require("@expo/metro-config/build/babel-transformer");
  } catch (error) {
    if (error?.code !== "MODULE_NOT_FOUND") {
      throw error;
    }
  }

  const expoPackagePath = require.resolve("expo/package.json");
  const expoRoot = path.dirname(expoPackagePath);
  return require(
    path.join(expoRoot, "node_modules", "@expo", "metro-config", "build", "babel-transformer.js"),
  );
}

const expoTransformer = resolveExpoTransformer();

const transformReactJsx = require("@babel/plugin-transform-react-jsx");
const t = babel.types;

function hasJsxNode(node) {
  if (!node || typeof node !== "object") {
    return false;
  }

  if (node.type === "JSXElement" || node.type === "JSXFragment") {
    return true;
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      if (value.some(hasJsxNode)) {
        return true;
      }
    } else if (hasJsxNode(value)) {
      return true;
    }
  }

  return false;
}

function isImportMetaEnvMember(node) {
  return (
    node?.type === "MemberExpression" &&
    node.object?.type === "MetaProperty" &&
    node.object.meta?.name === "import" &&
    node.object.property?.name === "meta" &&
    node.property?.type === "Identifier" &&
    node.property.name === "env"
  );
}

function hasImportMetaEnv(node) {
  if (!node || typeof node !== "object") {
    return false;
  }

  if (isImportMetaEnvMember(node)) {
    return true;
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      if (value.some(hasImportMetaEnv)) {
        return true;
      }
    } else if (hasImportMetaEnv(value)) {
      return true;
    }
  }

  return false;
}

function transformImportMetaEnv() {
  return {
    name: "hungry-transform-import-meta-env",
    visitor: {
      MemberExpression(path) {
        if (!isImportMetaEnvMember(path.node)) {
          return;
        }

        path.replaceWith(
          t.objectExpression([
            t.objectProperty(
              t.identifier("MODE"),
              t.stringLiteral(process.env.NODE_ENV === "production" ? "production" : "development"),
            ),
          ]),
        );
      },
    },
  };
}

function transform(args) {
  const result = expoTransformer.transform(args);
  const shouldLowerJsx = hasJsxNode(result.ast);
  const shouldTransformImportMetaEnv = hasImportMetaEnv(result.ast);

  if (!result.ast || (!shouldLowerJsx && !shouldTransformImportMetaEnv)) {
    return result;
  }

  const plugins = [];
  if (shouldLowerJsx) {
    plugins.push([transformReactJsx, { runtime: "automatic" }]);
  }
  if (shouldTransformImportMetaEnv) {
    plugins.push(transformImportMetaEnv);
  }

  const transformed = babel.transformFromAstSync(result.ast, args.src, {
    ast: true,
    code: false,
    cloneInputAst: false,
    filename: args.filename,
    plugins,
  });

  return {
    ...result,
    ast: transformed.ast,
    metadata: {
      ...result.metadata,
      hungryJsxLoweredForHermes: true,
    },
  };
}

module.exports = {
  ...expoTransformer,
  transform,
};
