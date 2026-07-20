// ===============================================================
// admin-revoke-invitation
//
// Revokes a pending admin invitation AND, if safe, removes the
// orphaned auth account tied to it — so re-inviting the same email
// starts completely fresh, matching how normal SaaS access revocation
// works. Also logs the action to the permanent audit trail.
//
// SAFETY: auth.users is shared platform-wide (vendors AND admins live
// in the same table). This function NEVER deletes an account that:
//   - has a vendors row (a real vendor, regardless of admin history)
//   - has a user_roles row (an already-active admin)
// It only removes an account that exists SOLELY because someone
// created it via admin-signup.html and never claimed any role —
// i.e. it has no purpose left once the invitation is gone.
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
        JSON.stringify({ error: "Only a super admin can revoke invitations." }),
        { status: 403, headers: corsHeaders }
      );
    }

    // ---- PARSE INPUT ----
    const body = await req.json();
    const { invitationId } = body;

    if (!invitationId) {
      return new Response(
        JSON.stringify({ error: "Missing invitationId." }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ---- LOOK UP THE INVITATION ----
    const { data: invitation, error: invError } = await supabase
      .from("admin_invitations")
      .select("id, email, role, used")
      .eq("id", invitationId)
      .maybeSingle();

    if (invError || !invitation) {
      return new Response(
        JSON.stringify({ error: "Invitation not found." }),
        { status: 404, headers: corsHeaders }
      );
    }

    // ---- DELETE THE INVITATION ITSELF ----
    const { error: deleteInviteError } = await supabase
      .from("admin_invitations")
      .delete()
      .eq("id", invitationId);

    if (deleteInviteError) {
      return new Response(
        JSON.stringify({
          error: "Failed to delete invitation: " + deleteInviteError.message,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // ---- CONDITIONALLY CLEAN UP AN ORPHANED SIGNUP ACCOUNT ----
    let authAccountDeleted = false;
    let cleanupNote = "No matching signup account found for this email.";

    const { data: userListResult } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    const matchedUser = userListResult?.users?.find(
      (u: { email?: string }) =>
        u.email?.toLowerCase() === invitation.email.toLowerCase()
    );

    if (matchedUser) {

      const { data: vendorRow } = await supabase
        .from("vendors")
        .select("id")
        .eq("auth_user_id", matchedUser.id)
        .maybeSingle();

      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", matchedUser.id)
        .maybeSingle();

      if (vendorRow) {
        cleanupNote =
          "A vendor account exists for this email — left untouched.";
      } else if (roleRow) {
        cleanupNote =
          "This person already has an active admin role — left untouched.";
      } else {

        const { error: deleteUserError } =
          await supabase.auth.admin.deleteUser(matchedUser.id);

        if (deleteUserError) {
          cleanupNote =
            "Invitation revoked, but could not remove the signup account: " +
            deleteUserError.message;
        } else {
          authAccountDeleted = true;
          cleanupNote =
            "The orphaned signup account was also removed. This email can sign up completely fresh.";
        }

      }

    }

    // ---- LOG TO THE PERMANENT AUDIT TRAIL ----
    // Uses the service-role client, so this always succeeds regardless
    // of RLS — the log entry itself outlives the invitation/account
    // that was just cleaned up above.
    await supabase.from("admin_audit_log").insert({
      actor_id: callerData.user.id,
      actor_email: callerData.user.email,
      action: "revoked_invitation",
      target_email: invitation.email,
      role: invitation.role,
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