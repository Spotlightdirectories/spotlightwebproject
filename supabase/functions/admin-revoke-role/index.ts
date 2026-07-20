// ===============================================================
// admin-revoke-role
//
// Revokes an ACTIVE admin's role (not a pending invitation — see
// admin-revoke-invitation for that). Checks whether the account has
// a real vendor profile:
//   - If yes: downgrade to 'vendor', matching the original behaviour
//     — and now the message is actually true.
//   - If no: there's nothing to "downgrade" to. The account exists
//     solely because of admin-signup.html, so it's fully removed
//     instead — same clean-slate principle as revoking an
//     invitation, extended to this second path where it was
//     missing before.
// ===============================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // ---- AUTH CHECK: caller must be a logged-in super_admin ----
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization." }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: callerData, error: callerError } =
      await supabase.auth.getUser(token);

    if (callerError || !callerData?.user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated." }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { data: callerRoleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerData.user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!callerRoleRow) {
      return new Response(
        JSON.stringify({ error: "Only a super admin can revoke admin access." }),
        { status: 403, headers: corsHeaders }
      );
    }

    // ---- PARSE INPUT ----
    const body = await req.json();
    const { targetUserId, email, role } = body;

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "Missing targetUserId." }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ---- CHECK FOR A REAL VENDOR PROFILE ----
    const { data: vendorRow } = await supabase
      .from("vendors")
      .select("id")
      .eq("auth_user_id", targetUserId)
      .maybeSingle();

    let authAccountDeleted = false;
    let cleanupNote;

    if (vendorRow) {

      // Real vendor exists — downgrade to vendor, as before.
      const { error: updateError } = await supabase
        .from("user_roles")
        .update({ role: "vendor" })
        .eq("user_id", targetUserId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to revoke role: " + updateError.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      cleanupNote =
        "This person has an existing vendor profile — they are now a regular vendor account.";

    } else {

      // No vendor profile — nothing to fall back to. Remove the role
      // row first (avoids any FK ordering issue), then remove the
      // account itself entirely.
      const { error: deleteRoleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId);

      if (deleteRoleError) {
        return new Response(
          JSON.stringify({ error: "Failed to remove admin role: " + deleteRoleError.message }),
          { status: 500, headers: corsHeaders }
        );
      }

      const { error: deleteUserError } =
        await supabase.auth.admin.deleteUser(targetUserId);

      if (deleteUserError) {
        cleanupNote =
          "Admin role removed, but the account itself could not be deleted: " +
          deleteUserError.message;
      } else {
        authAccountDeleted = true;
        cleanupNote =
          "This person has no vendor profile — their account has been fully removed, not just downgraded.";
      }

    }

    // ---- LOG TO THE PERMANENT AUDIT TRAIL ----
    await supabase.from("admin_audit_log").insert({
      actor_id: callerData.user.id,
      actor_email: callerData.user.email,
      action: "revoked_role",
      target_email: email || null,
      role: role || null,
      details: cleanupNote,
    });

    return new Response(
      JSON.stringify({
        success: true,
        authAccountDeleted,
        cleanupNote,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});