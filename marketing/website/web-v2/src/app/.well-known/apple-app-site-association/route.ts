// iOS Universal Links: lets usehungry.com share links open in the Hungry app.
// appID is the Apple team ID + bundle identifier from the app's app.json.
const APP_ID = "94R58J6LA2.app.hungry.mobile";
const APP_PATHS = [
  "/dish/*",
  "/stall/*",
  "/venue/*",
  "/post/*",
  "/portfolio/*",
  "/user/*",
  "/join/*",
  "/home",
];

export const dynamic = "force-static";

export function GET() {
  return Response.json({
    applinks: {
      details: [{ appIDs: [APP_ID], components: APP_PATHS.map((path) => ({ "/": path })) }],
    },
  });
}
