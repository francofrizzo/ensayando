import { handleMembersRequest, parseMembersRequest } from "../server/admin/members.js";
import { jsonBody, postHandler, requestOrigin, requireAuthorization } from "../server/http.js";
import { createRequestSupabaseClient, createServiceSupabaseClient } from "../server/supabase.js";

// Account operations that need the service role: create managed accounts, invite by
// email and reset passwords. Every action first checks the caller's permission with
// their own token (RPCs is_collection_admin / account_reset_mode).
export default postHandler("Members", async (req) => {
  const authorization = requireAuthorization(req);
  const request = parseMembersRequest(jsonBody(req));
  const origin = requestOrigin(req);
  const result = await handleMembersRequest(
    {
      user: createRequestSupabaseClient(authorization),
      service: createServiceSupabaseClient(),
      redirectTo: origin ? `${origin}/reset-password` : undefined
    },
    request
  );
  return { status: 200, body: result };
});
