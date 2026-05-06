const babel = require("@babel/core");
const expoTransformer = require("@expo/metro-config/build/babel-transformer");

const transformReactJsx = require("@babel/plugin-transform-react-jsx");

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

function transform(args) {
  const result = expoTransformer.transform(args);

  if (!result.ast || !hasJsxNode(result.ast)) {
    return result;
  }

  const transformed = babel.transformFromAstSync(result.ast, args.src, {
    ast: true,
    code: false,
    cloneInputAst: false,
    filename: args.filename,
    plugins: [[transformReactJsx, { runtime: "automatic" }]],
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
