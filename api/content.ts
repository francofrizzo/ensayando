import { handleContentRequest, parseContentRequest } from "../server/admin/content.js";
import { jsonBody, postHandler, requireAuthorization } from "../server/http.js";
import { createRequestSupabaseClient } from "../server/supabase.js";

// Deleting songs and collections: the rows go through the caller's client (RLS decides),
// then their audio and artwork are removed from R2.
export default postHandler("Content", async (req) => {
  const authorization = requireAuthorization(req);
  const request = parseContentRequest(jsonBody(req));
  const result = await handleContentRequest(createRequestSupabaseClient(authorization), request);
  return { status: 200, body: result };
});
