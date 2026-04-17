export function createRootLinking(prefix: string) {
  return {
    prefixes: [prefix, "hungry://", "https://hungry.sg"],
    config: {
      screens: {
        DishDetail: "dish/:id",
        StallDetail: "venue/:id",
        Post: "order",
        WheelStack: {
          path: "join/:code",
          screens: {
            WheelHome: "",
          },
        },
      },
    },
  };
}

export function parseOrderDeepLinkQuery(rawPath: string): { venueId?: string } {
  const queryIndex = rawPath.indexOf("?");
  if (queryIndex < 0) {
    return {};
  }

  const query = rawPath.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  const venueId = params.get("venueId") ?? undefined;
  return venueId ? { venueId } : {};
}
